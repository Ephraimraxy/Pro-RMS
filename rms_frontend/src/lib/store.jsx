import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import React from 'react';
import api, { deptAPI, reqAPI, auditAPI, userAPI } from './api';

// ── Configure storage namespaces ──
const requisitionStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'requisitions' });
const activityStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'activity' });
const workflowStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'workflows' });
const departmentStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'departments' });
const syncQueueStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'sync_queue' });

// ── Seed data ──
const SEED_REQUISITIONS = [];

// ── Initialize store with seed data ──
let _initialized = false;
const generateClientId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};
async function ensureInitialized() {
  if (_initialized) return;

  // CRITICAL: Clear out old mock data from previous sessions if they exist
  const dbVersion = await localforage.getItem('rms_db_version');
  if (dbVersion !== '3.0') {
    await requisitionStore.clear();
    await activityStore.clear();
    await workflowStore.clear();
    await departmentStore.clear();
    await localforage.setItem('rms_db_version', '3.0');
  }

  const existingActivity = await activityStore.getItem('log');
  if (!existingActivity) {
    await activityStore.setItem('log', []);
  }
  _initialized = true;
}

// ── Requisition Logic ──
export async function getRequisitions() {
  await ensureInitialized();
  try {
    const remote = await reqAPI.getRequisitions();
    // Handle both paginated { data, total } and legacy plain-array responses
    const rawList = Array.isArray(remote) ? remote : (Array.isArray(remote?.data) ? remote.data : []);
    const normalized = rawList.map(r => ({
      ...r,
      department: r.department?.name || r.department || r.departmentName,
      creator: r.creator?.name || r.creator || r.creatorName,
      currentStageName: r.currentStage?.name || r.currentStageName
    }));
    await requisitionStore.setItem('all', normalized);
    return normalized;
  } catch (err) {
    console.warn("Offline: Fetching cached requisitions", err);
    const local = await requisitionStore.getItem('all');
    return Array.isArray(local) ? local : [];
  }
}

export async function addRequisition(data) {
  await ensureInitialized();
  const items = Array.isArray(data) ? data : [data];
  const withClientIds = items.map(item => ({
    ...item,
    clientId: item.clientId || generateClientId()
  }));
  try {
    const result = await reqAPI.addRequisition(withClientIds);
    return result;
  } catch (err) {
    const status = err?.response?.status;
    if (status && status >= 400 && status < 500) {
      // Auth/validation errors should not be queued as offline work.
      throw err;
    }
    console.warn("Offline: Saving to local sync queue");
    const queue = (await syncQueueStore.getItem('pending')) || [];
    withClientIds.forEach(payload => {
      queue.push({
        clientId: payload.clientId,
        payload,
        retryCount: 0,
        nextAttemptAt: Date.now(),
        lastError: null
      });
    });
    await syncQueueStore.setItem('pending', queue);
    toast("Offline: Requisition saved locally for sync");
    return null;
  }
}

export async function flushSyncQueue({ force = false } = {}) {
  const queue = (await syncQueueStore.getItem('pending')) || [];
  if (queue.length === 0) return { synced: 0, pending: 0 };

  const now = Date.now();
  const remaining = [];
  let synced = 0;

  for (const entry of queue) {
    if (!force && entry.nextAttemptAt && entry.nextAttemptAt > now) {
      remaining.push(entry);
      continue;
    }
    try {
      await reqAPI.addRequisition(entry.payload);
      synced += 1;
    } catch (err) {
      const retryCount = (entry.retryCount || 0) + 1;
      const delay = Math.min(60000, 2000 * Math.pow(2, retryCount));
      remaining.push({
        ...entry,
        retryCount,
        nextAttemptAt: now + delay,
        lastError: err?.message || 'Sync failed'
      });
    }
  }

  await syncQueueStore.setItem('pending', remaining);
  if (synced > 0) {
    toast.success(`Synced ${synced} offline record(s) to server!`);
  }
  return { synced, pending: remaining.length };
}

export async function getSyncQueueStatus() {
  const queue = (await syncQueueStore.getItem('pending')) || [];
  return { pending: queue.length };
}

export async function uploadAttachments(requisitionId, files) {
  if (!navigator.onLine) {
    toast.error("Attachments require an active connection");
    throw new Error('Offline - attachments blocked');
  }
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  
  try {
    const response = await api.post(`/requisitions/${requisitionId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    toast.success(`${files.length} files attached successfully`);
    return response;
  } catch (err) {
    console.error("Upload failed:", err);
    toast.error("File upload failed");
    throw err;
  }
}

export async function getAttachments(requisitionId) {
  try {
    return await api.get(`/requisitions/${requisitionId}/attachments`);
  } catch (err) {
    return [];
  }
}

export async function updateRequisitionStatus(id, newStatus, remarks = '') {
  let updated;
  if (newStatus === 'approved') {
    updated = await reqAPI.approveRequisition(id, remarks);
  } else if (newStatus === 'rejected') {
    updated = await reqAPI.rejectRequisition(id, remarks);
  } else {
    return;
  }

  const all = await getRequisitions();
  const idx = all.findIndex(r => r.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updated, status: updated.status || newStatus };
    await requisitionStore.setItem('all', all);
  }
  await logActivity(`${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Requisition`, `${id} status changed to ${newStatus}`);
  toast.success(`${id} has been ${newStatus}`, {
    icon: <img src="/favicon.svg" className="w-5 h-5 object-contain" alt="" />
  });
}

export async function downloadSignedPdf(id) {
  const blob = await reqAPI.getSignedPdf(id);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `requisition-${id}.pdf`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function downloadDynamicPdf(id) {
  try {
    const blob = await reqAPI.getDynamicPdf(id);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CSS-REPORT-${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to download dynamic PDF', err);
    throw err;
  }
}

// ── Stats Computation ──
export async function getDashboardStats() {
  const all = await getRequisitions();
  const pending = all.filter(r => r.status === 'pending').length;
  const approved = all.filter(r => r.status === 'approved').length;
  const rejected = all.filter(r => r.status === 'rejected').length;
  const totalSpent = all
    .filter(r => r.status === 'approved' && r.amount)
    .reduce((sum, r) => sum + r.amount, 0);

  return { pending, approved, rejected, totalSpent };
}

// ── Activity Log ──
export async function logActivity(action, detail) {
  await ensureInitialized();
  const log = (await activityStore.getItem('log')) || [];
  log.unshift({ id: Date.now(), action, detail, timestamp: new Date().toISOString() });
  // Keep last 100 entries
  if (log.length > 100) log.length = 100;
  await activityStore.setItem('log', log);
}

export async function getActivityLog() {
  await ensureInitialized();
  try {
    const remote = await auditAPI.getAuditLogs();
    // Handle both paginated { data, total } and legacy plain-array responses
    const rawList = Array.isArray(remote) ? remote : (Array.isArray(remote?.data) ? remote.data : []);
    const normalized = rawList.map(a => ({
      ...a,
      detail: a.detail || a.details
    }));
    await activityStore.setItem('log', normalized);
    return normalized;
  } catch (err) {
    console.warn("Offline: Fetching cached activity log", err);
    const local = await activityStore.getItem('log');
    return Array.isArray(local) ? local : [];
  }
}

import { workflowAPI, typeAPI, notificationAPI } from './api';

// ── Requisition Types ──
export async function getRequisitionTypes() {
  await ensureInitialized();
  try {
    return await typeAPI.getTypes();
  } catch (err) {
    console.warn("Offline: Using fallback types");
    return [
      { id: 1, name: 'Cash Requisition' },
      { id: 2, name: 'Material Request' },
      { id: 3, name: 'Memorandum' }
    ];
  }
}

export async function addRequisitionType(data) {
  try {
    const result = await typeAPI.addType(data);
    toast.success(`Type "${data.name}" added`);
    return result;
  } catch (err) {
    toast.error("Failed to add type");
  }
}

export async function deleteRequisitionType(id) {
  try {
    await typeAPI.deleteType(id);
    toast.error("Type removed");
  } catch (err) {
    toast.error("Failed to remove type");
  }
}

export async function getNotifications() {
  await ensureInitialized();
  try {
    const remote = await notificationAPI.getNotifications();
    const data = Array.isArray(remote) ? remote : [];
    return data.map(n => ({ ...n, message: n.message || n.content }));
  } catch (err) {
    console.warn("Offline: Could not fetch notifications", err);
    return [];
  }
}

export async function markNotificationRead(id) {
  try {
    return await notificationAPI.markRead(id);
  } catch (err) {
    console.warn("Could not mark notification read:", err);
  }
}

export async function markAllNotificationsRead() {
  try {
    return await notificationAPI.markAllRead();
  } catch (err) {
    console.warn("Could not mark all notifications read:", err);
  }
}

export async function clearNotifications() {
  try {
    const res = await notificationAPI.clearAll();
    toast.success('Cleared all read notifications');
    return res;
  } catch (err) {
    console.warn("Could not clear notifications:", err);
    toast.error('Failed to clear notifications');
  }
}

export async function getRequisitionDetail(id) {
  try {
    return await reqAPI.getRequisition(id);
  } catch (err) {
    console.warn("Could not fetch requisition detail:", err);
    return null;
  }
}

// ── Workflow CRUD ──
export async function getWorkflows() {
  await ensureInitialized();
  try {
    const remote = await workflowAPI.getStages();
    await workflowStore.setItem('all', remote);
    return remote;
  } catch (err) {
    console.warn("Offline: Fetching cached workflows", err);
    return (await workflowStore.getItem('all')) || [];
  }
}

export async function updateWorkflows(stages) {
  await ensureInitialized();
  try {
    await workflowAPI.updateStages(stages);
    await workflowStore.setItem('all', stages);
    await logActivity('Workflow Updated', `Cloud-sync: Reconfigured chain with ${stages.length} stages`);
  } catch (err) {
    console.error("Offline: Workflow update failed", err);
    throw err;
  }
}

// ── Department Logic ──
export async function getDepartments() {
  await ensureInitialized();
  try {
    const remote = await deptAPI.getDepartments();
    await departmentStore.setItem('all', remote);
    return remote;
  } catch (err) {
    console.warn("Offline: Fetching cached departments", err);
    return (await departmentStore.getItem('all')) || [];
  }
}

export async function getDepartmentById(id) {
  await ensureInitialized();
  try {
    return await deptAPI.getDepartment(id);
  } catch (err) {
    const all = await getDepartments();
    return all.find(d => d.id === id) || null;
  }
}

export async function addDepartment(dept) {
  await ensureInitialized();
  try {
    const result = await deptAPI.addDepartment(dept);
    toast.success(`${dept.name} added to cloud`);
    return result;
  } catch (err) {
    console.warn("Offline: Department saved locally ONLY", err);
    const all = await getDepartments();
    const newDept = { id: Date.now(), ...dept };
    all.push(newDept);
    await departmentStore.setItem('all', all);
    return newDept;
  }
}

export async function deleteDepartment(id) {
  await ensureInitialized();
  try {
    await deptAPI.deleteDepartment(id);
    toast.success("Department removed from cloud");
  } catch (err) {
    console.warn("Offline: Department removed locally ONLY", err);
    const all = await getDepartments();
    const filtered = all.filter(d => d.id !== id);
    await departmentStore.setItem('all', filtered);
  }
}

export async function validateDepartmentLogin(deptName, code) {
  await ensureInitialized();
  const all = await getDepartments();
  const dept = all.find(d => d.name === deptName && d.accessCode === code);
  return dept || null;
}

export async function updateDepartmentHead(deptId, payload) {
  try {
    const result = await deptAPI.updateHead(deptId, payload);
    const all = await getDepartments();
    const idx = all.findIndex(d => d.id === deptId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...result };
      await departmentStore.setItem('all', all);
    }
    toast.success("Department head updated");
    return result;
  } catch (err) {
    toast.error("Failed to update department head");
    throw err;
  }
}

export async function uploadDepartmentStamp(deptId, file) {
  try {
    const result = await deptAPI.uploadStamp(deptId, file);
    toast.success("Department stamp updated");
    return result;
  } catch (err) {
    toast.error("Failed to upload stamp");
    throw err;
  }
}

export async function uploadUserSignature(userId, file) {
  try {
    const result = await userAPI.uploadSignature(userId, file);
    toast.success("Signature updated");
    return result;
  } catch (err) {
    toast.error("Failed to upload signature");
    throw err;
  }
}
