import localforage from 'localforage';
import { toast } from 'react-hot-toast';

// ── Configure storage namespaces ──
const requisitionStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'requisitions' });
const activityStore = localforage.createInstance({ name: 'CSS_RMS', storeName: 'activity' });

// ── Seed data (loaded on first use) ──
const SEED_REQUISITIONS = [
  { id: 'REQ-2026-001', type: 'Cash', title: 'Office Supplies Reimbursement', amount: 45000, department: 'Hatchery', status: 'pending', urgency: 'normal', description: 'Reimbursement for office supplies purchased for Q1 operations.', createdBy: 'Administrator', createdAt: '2026-03-19T08:00:00Z' },
  { id: 'REQ-2026-002', type: 'Material', title: 'Printer Toner Cartridges (10 units)', amount: 120000, department: 'Poultry', status: 'pending', urgency: 'urgent', description: '10 HP LaserJet toner cartridges for the poultry admin block.', createdBy: 'Administrator', createdAt: '2026-03-19T07:30:00Z' },
  { id: 'REQ-2026-003', type: 'Memo', title: 'Request for Policy Review Meeting', amount: null, department: 'HR Department', status: 'approved', urgency: 'normal', description: 'Memo requesting a quarterly policy review meeting with department heads.', createdBy: 'Administrator', createdAt: '2026-03-18T14:00:00Z' },
  { id: 'REQ-2026-004', type: 'Cash', title: 'Vehicle Maintenance', amount: 350000, department: 'Logistics', status: 'rejected', urgency: 'critical', description: 'Emergency brake repair for delivery truck #14.', createdBy: 'Staff User', createdAt: '2026-03-17T10:00:00Z' },
  { id: 'REQ-2026-005', type: 'Material', title: 'PPE Kits (50 units)', amount: 200000, department: 'QA/QC', status: 'pending', urgency: 'normal', description: 'Personal protective equipment kits for field inspection team.', createdBy: 'Administrator', createdAt: '2026-03-19T09:15:00Z' },
];

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
    await activityStore.setItem('log', [
      { id: 1, action: 'Logged In', detail: 'Administrator logged into the portal', timestamp: new Date().toISOString() },
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
  toast.success(data.isDraft ? `Draft ${newReq.id} saved locally` : `Requisition ${newReq.id} submitted for approval`);
  return newReq;
}

export async function updateRequisitionStatus(id, newStatus) {
  const all = await getRequisitions();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return;
  all[idx].status = newStatus;
  await requisitionStore.setItem('all', all);
  await logActivity(`${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Requisition`, `${id} status changed to ${newStatus}`);
  toast.success(`${id} has been ${newStatus}`);
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
