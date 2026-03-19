import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import React from 'react';

// ── Configure storage namespaces ──
const requisitionStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'requisitions' });
const activityStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'activity' });

// ── Seed data (Empty for Real Live Usage) ──
const SEED_REQUISITIONS = [];

// ── Initialize store with seed data ──
let _initialized = false;
async function ensureInitialized() {
  if (_initialized) return;
  const existing = await requisitionStore.getItem('all');
  if (!existing || existing.length === 0) {
    await requisitionStore.setItem('all', SEED_REQUISITIONS);
  }
  const existingActivity = await activityStore.getItem('log');
  if (!existingActivity) {
    await activityStore.setItem('log', []);
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
