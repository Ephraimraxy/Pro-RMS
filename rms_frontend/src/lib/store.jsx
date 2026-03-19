import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import React from 'react';
import { deptAPI, reqAPI } from './api';

// ── Configure storage namespaces ──
const requisitionStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'requisitions' });
const activityStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'activity' });
const workflowStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'workflows' });
const departmentStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'departments' });
const syncQueueStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'sync_queue' });

// ── Seed data (Empty for Real Live Usage) ──
const SEED_REQUISITIONS = [];

// ── Initialize store with seed data ──
let _initialized = false;
async function ensureInitialized() {
  if (_initialized) return;

  // CRITICAL: Clear out old mock data from previous sessions if they exist
  const dbVersion = await localforage.getItem('rms_db_version');
  if (dbVersion !== '2.0') {
    await requisitionStore.clear();
    await activityStore.clear();
    await workflowStore.clear();
    await departmentStore.clear();
    await localforage.setItem('rms_db_version', '2.0');
  }

  const existing = await requisitionStore.getItem('all');
  if (!existing || existing.length === 0) {
    await requisitionStore.setItem('all', SEED_REQUISITIONS);
  }
  const existingActivity = await activityStore.getItem('log');
  if (!existingActivity) {
    await activityStore.setItem('log', []);
  }
  const existingWorkflows = await workflowStore.getItem('all');
  if (!existingWorkflows) {
    await workflowStore.setItem('all', [
      { id: 1, sequence: 1, name: 'Admin Review', role: 'Admin', threshold: 0 },
      { id: 2, sequence: 2, name: 'Internal Audit', role: 'Audit', threshold: 0 },
      { id: 3, sequence: 3, name: 'Management Approval', role: 'GM', threshold: 500000 },
    ]);
  }
  const existingDepts = await departmentStore.getItem('all');
  if (!existingDepts) {
    // Initial core departments
    await departmentStore.setItem('all', [
      { id: 1, name: 'Hatchery', type: 'Operational', accessCode: 'HATCH-2026' },
      { id: 2, name: 'Poultry', type: 'Operational', accessCode: 'POULT-2026' },
      { id: 3, name: 'QA/QC', type: 'Strategic', accessCode: 'QAQC-2026' },
      { id: 4, name: 'Logistics', type: 'Operational', accessCode: 'LOG-2026' },
      { id: 5, name: 'HR Department', type: 'Strategic', accessCode: 'HR-2026' },
    ]);
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
  
  const newReq = {
    title: data.description || 'Untitled',
    type: data.type || 'Cash',
    amount: data.amount ? parseFloat(data.amount) : 0,
    description: data.notes || data.description || '',
    departmentId: data.departmentId || null,
    isDraft: data.isDraft || false,
    createdAt: new Date().toISOString()
  };

  try {
    if (!navigator.onLine) throw new Error("Offline");
    const result = await reqAPI.addRequisition(newReq);
    toast.success("Successfully submitted to server");
    return result;
  } catch (err) {
    console.warn("Sync Queue: Saving offline draft", err);
    const queue = (await syncQueueStore.getItem('pending')) || [];
    queue.push(newReq);
    await syncQueueStore.setItem('pending', queue);
    
    toast.success("Saved to local sync queue (Offline mode)", {
      icon: '☁️'
    });
    return newReq;
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

export async function updateRequisitionStatus(id, newStatus) {
  const all = await getRequisitions();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return;
  all[idx].status = newStatus;
  await requisitionStore.setItem('all', all);
  await logActivity(`${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Requisition`, `${id} status changed to ${newStatus}`);
  toast.success(`${id} has been ${newStatus}`, {
    icon: <img src="/favicon.png" className="w-5 h-5 object-contain" alt="" />
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
    const remote = await api.get('/audit-logs');
    await activityStore.setItem('log', remote);
    return remote;
  } catch (err) {
    console.warn("Offline: Fetching cached activity log", err);
    return (await activityStore.getItem('log')) || [];
  }
}

// ── Workflow CRUD ──
export async function getWorkflows() {
  await ensureInitialized();
  return (await workflowStore.getItem('all')) || [];
}

export async function updateWorkflows(stages) {
  await ensureInitialized();
  await workflowStore.setItem('all', stages);
  await logActivity('Workflow Updated', `Reconfigured approval chain with ${stages.length} stages`);
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
    const result = await api.post('/departments', dept);
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
    await api.delete(`/departments/${id}`);
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
