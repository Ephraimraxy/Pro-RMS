import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import React from 'react';

// ── Configure storage namespaces ──
const requisitionStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'requisitions' });
const activityStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'activity' });
const workflowStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'workflows' });
const departmentStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'departments' });

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

// ── Requisition CRUD ──
export async function getRequisitions() {
  await ensureInitialized();
  return (await requisitionStore.getItem('all')) || [];
}

export async function addRequisition(data) {
  await ensureInitialized();
  const all = await getRequisitions();
  const nextNum = String(all.length + 1).padStart(3, '0');
  const newReq = {
    id: `REQ-2026-${nextNum}`,
    type: data.type || 'Cash',
    title: data.description || 'Untitled',
    amount: data.amount ? parseFloat(data.amount) : null,
    department: data.department || 'General',
    status: data.isDraft ? 'draft' : 'pending',
    urgency: data.urgency || 'normal',
    description: data.notes || data.description || '',
    createdBy: data.createdBy || 'Administrator',
    createdAt: new Date().toISOString(),
  };
  all.unshift(newReq);
  await requisitionStore.setItem('all', all);
  await logActivity(data.isDraft ? 'Saved Draft' : 'Submitted Requisition', `${newReq.id} — ${newReq.title}`);
  toast.success(data.isDraft ? `Draft ${newReq.id} saved locally` : `Requisition ${newReq.id} submitted for approval`, {
    icon: <img src="/favicon.png" className="w-5 h-5 object-contain" alt="" />
  });
  return newReq;
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
  return (await activityStore.getItem('log')) || [];
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

// ── Department CRUD ──
export async function getDepartments() {
  await ensureInitialized();
  return (await departmentStore.getItem('all')) || [];
}

export async function addDepartment(dept) {
  await ensureInitialized();
  const all = await getDepartments();
  const newDept = { id: Date.now(), ...dept };
  all.push(newDept);
  await departmentStore.setItem('all', all);
  await logActivity('Department Added', `${newDept.name} added to ${newDept.type}`);
  return newDept;
}

export async function deleteDepartment(id) {
  await ensureInitialized();
  const all = await getDepartments();
  const filtered = all.filter(d => d.id !== id);
  await departmentStore.setItem('all', filtered);
  await logActivity('Department Deleted', `ID: ${id} removed from system`);
}

export async function validateDepartmentLogin(deptName, code) {
  await ensureInitialized();
  const all = await getDepartments();
  const dept = all.find(d => d.name === deptName && d.accessCode === code);
  return dept || null;
}
