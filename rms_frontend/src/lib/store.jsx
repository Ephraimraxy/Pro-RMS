import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import React from 'react';
import api, { deptAPI, reqAPI, auditAPI } from './api';

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
    await requisitionStore.setItem('all', remote);
    return remote;
  } catch (err) {
    console.warn("Offline: Fetching cached requisitions", err);
    const local = await requisitionStore.getItem('all');
    return local || [];
  }
}

export async function addRequisition(data) {
  await ensureInitialized();
  try {
    const result = await reqAPI.addRequisition(Array.isArray(data) ? data : [data]);
    return result;
  } catch (err) {
    console.warn("Offline: Saving to local sync queue");
    const queue = (await syncQueueStore.getItem('pending')) || [];
    queue.push(data);
    await syncQueueStore.setItem('pending', queue);
    toast.info("Offline: Requisition saved locally for sync");
    return null;
  }
}

export async function flushSyncQueue() {
  const queue = (await syncQueueStore.getItem('pending')) || [];
  if (queue.length === 0) return;

  try {
    await reqAPI.addRequisition(queue);
    await syncQueueStore.setItem('pending', []);
    toast.success(`Synced ${queue.length} offline records to server!`);
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

export async function uploadAttachments(requisitionId, files) {
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

export async function updateRequisitionStatus(id, newStatus) {
  const all = await getRequisitions();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return;
  all[idx].status = newStatus;
  await requisitionStore.setItem('all', all);
  await logActivity(`${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Requisition`, `${id} status changed to ${newStatus}`);
  toast.success(`${id} has been ${newStatus}`, {
    icon: <img src="/favicon.svg" className="w-5 h-5 object-contain" alt="" />
  });
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
    await activityStore.setItem('log', remote);
    return remote;
  } catch (err) {
    console.warn("Offline: Fetching cached activity log", err);
    return (await activityStore.getItem('log')) || [];
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
    return await notificationAPI.getNotifications();
  } catch (err) {
    console.warn("Offline: Could not fetch notifications");
    return [];
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
