import { useState, useEffect, useRef } from 'react';
import { hrAPI, deptAPI } from '../lib/api';
import {
  Users, Search, Plus, X, Edit2, Trash2, Mail, Phone,
  MapPin, Briefcase, ChevronDown, Eye, Upload, User as UserIcon,
  CheckCircle2, AlertCircle, Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const STATUS_COLORS = {
  active:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  inactive: 'bg-muted border-border text-muted-foreground',
  on_leave: 'bg-amber-50 border-amber-200 text-amber-700',
};

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '', jobTitle: '',
  department: '', employeeId: '', gender: '', startDate: '',
  salary: '', status: 'active', address: '',
};

const Avatar = ({ name, size = 'md' }) => {
  const initials = (name || 'E').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const sz = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-11 h-11 text-sm';
  return (
    <div className={`${sz} rounded-2xl bg-primary/10 border border-primary/20 text-primary font-black flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
};

const EmployeeCard = ({ emp, onEdit, onDelete, onView }) => (
  <div className="glass bg-white/80 rounded-[1.5rem] border border-border/40 p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group flex flex-col gap-4">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <Avatar name={`${emp.firstName} ${emp.lastName}`} />
        <div>
          <p className="text-[13px] font-black text-foreground tracking-tight">{emp.firstName} {emp.lastName}</p>
          <p className="text-[10px] text-muted-foreground/70 font-medium">{emp.jobTitle || '—'}</p>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${STATUS_COLORS[emp.status] || STATUS_COLORS.active}`}>
        {(emp.status || 'active').replace('_', ' ')}
      </span>
    </div>

    <div className="space-y-1.5 border-t border-border/20 pt-3">
      {emp.department && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Briefcase size={11} className="text-primary/60 shrink-0" />
          <span className="font-medium truncate">{emp.department}</span>
        </div>
      )}
      {emp.email && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Mail size={11} className="text-primary/60 shrink-0" />
          <span className="truncate">{emp.email}</span>
        </div>
      )}
      {emp.phone && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Phone size={11} className="text-primary/60 shrink-0" />
          <span>{emp.phone}</span>
        </div>
      )}
      {emp.startDate && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <CheckCircle2 size={11} className="text-primary/60 shrink-0" />
          <span>Joined {new Date(emp.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      )}
    </div>

    <div className="flex items-center gap-2 pt-1 border-t border-border/20">
      <button onClick={() => onView(emp)} className="flex-1 py-2 rounded-xl bg-primary/5 hover:bg-primary hover:text-white text-primary text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5">
        <Eye size={13} /> View
      </button>
      <button onClick={() => onEdit(emp)} className="p-2 rounded-xl bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-border/40">
        <Edit2 size={14} />
      </button>
      <button onClick={() => onDelete(emp)} className="p-2 rounded-xl bg-muted hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors border border-border/40">
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

const FieldInput = ({ label, name, value, onChange, type = 'text', required, options }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {options ? (
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
      />
    )}
  </div>
);

const EmployeeDirectory = ({ onViewChange }) => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.allSettled([hrAPI.getEmployees(), deptAPI.getDepartments()]);
      if (empRes.status === 'fulfilled') {
        setEmployees(Array.isArray(empRes.value) ? empRes.value : (empRes.value?.results || []));
      }
      if (deptRes.status === 'fulfilled') {
        setDepartments(Array.isArray(deptRes.value) ? deptRes.value : (deptRes.value?.results || []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setFormData(EMPTY_FORM); setShowForm(true); };
  const openEdit = (emp) => { setEditing(emp); setFormData({ ...EMPTY_FORM, ...emp }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setFormData(EMPTY_FORM); };

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error('First name, last name and email are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await hrAPI.updateEmployee(editing.id, formData);
        toast.success('Employee updated.');
      } else {
        await hrAPI.createEmployee(formData);
        toast.success('Employee added.');
      }
      closeForm();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save employee.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await hrAPI.deleteEmployee(deleteTarget.id);
      toast.success('Employee removed.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error('Failed to delete employee.');
    }
  };

  const filtered = employees.filter(e => {
    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || (e.email || '').toLowerCase().includes(search.toLowerCase()) || (e.jobTitle || '').toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || e.department === deptFilter;
    const matchStatus = !statusFilter || e.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const deptOptions = [...new Set(employees.map(e => e.department).filter(Boolean))];

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
            Employee <span className="text-primary italic font-serif">Directory</span>
          </h1>
          <p className="text-muted-foreground text-[13px] font-medium">
            {employees.length} total employees across all departments.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 shrink-0"
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
        </div>
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-w-[160px]"
        >
          <option value="">All Departments</option>
          {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-w-[140px]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-48 bg-muted/40 rounded-[1.5rem] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass bg-white/70 rounded-[2rem] border border-border/40 py-24 text-center space-y-4">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-40">
            <Users size={32} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-black text-foreground tracking-tight">{search || deptFilter ? 'No Match Found' : 'No Employees Yet'}</p>
            <p className="text-sm text-muted-foreground">{search ? `No results for "${search}"` : 'Add your first employee to get started.'}</p>
          </div>
          {!search && !deptFilter && (
            <button onClick={openAdd} className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all">
              <Plus size={14} /> Add First Employee
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <EmployeeCard
              key={emp.id}
              emp={emp}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onView={setViewEmployee}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Form Slide-In */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto custom-scrollbar shadow-2xl animate-in slide-in-from-right-5 duration-300 flex flex-col">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-border/40 px-6 py-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-black text-foreground tracking-tight">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{editing ? `Updating ${editing.firstName}'s record` : 'Register a new team member'}</p>
              </div>
              <button onClick={closeForm} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required />
                <FieldInput label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required />
              </div>
              <FieldInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required />
              <FieldInput label="Phone Number" name="phone" type="tel" value={formData.phone} onChange={handleChange} />
              <FieldInput label="Employee ID" name="employeeId" value={formData.employeeId} onChange={handleChange} />
              <FieldInput label="Job Title / Position" name="jobTitle" value={formData.jobTitle} onChange={handleChange} />
              <FieldInput
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                options={deptOptions.length > 0 ? deptOptions : departments.map(d => d.name)}
              />
              <div className="grid grid-cols-2 gap-3">
                <FieldInput
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  options={['Male', 'Female', 'Other', 'Prefer not to say']}
                />
                <FieldInput
                  label="Status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'on_leave', label: 'On Leave' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </div>
              <FieldInput label="Start Date" name="startDate" type="date" value={formData.startDate} onChange={handleChange} />
              <FieldInput label="Basic Salary (₦)" name="salary" type="number" value={formData.salary} onChange={handleChange} />
              <FieldInput label="Office / Address" name="address" value={formData.address} onChange={handleChange} />

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeForm} className="flex-1 py-3 rounded-xl border border-border/50 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted transition-all">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60 active:scale-95"
                >
                  {saving ? 'Saving…' : editing ? 'Update Record' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Employee Detail Modal */}
      {viewEmployee && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewEmployee(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <button onClick={() => setViewEmployee(null)} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <X size={16} />
            </button>

            <div className="flex flex-col items-center gap-3 pb-4 border-b border-border/30">
              <Avatar name={`${viewEmployee.firstName} ${viewEmployee.lastName}`} size="lg" />
              <div className="text-center">
                <h2 className="text-xl font-black text-foreground">{viewEmployee.firstName} {viewEmployee.lastName}</h2>
                <p className="text-[11px] text-muted-foreground font-medium">{viewEmployee.jobTitle || 'No title'}</p>
                <span className={`mt-1 inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${STATUS_COLORS[viewEmployee.status] || STATUS_COLORS.active}`}>
                  {(viewEmployee.status || 'active').replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { icon: Briefcase, val: viewEmployee.department, label: 'Department' },
                { icon: Mail,      val: viewEmployee.email,      label: 'Email' },
                { icon: Phone,     val: viewEmployee.phone,      label: 'Phone' },
                { icon: MapPin,    val: viewEmployee.address,    label: 'Address' },
              ].filter(r => r.val).map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/5 border border-primary/10 text-primary flex items-center justify-center shrink-0">
                    <row.icon size={13} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">{row.label}</p>
                    <p className="text-[12px] font-medium text-foreground">{row.val}</p>
                  </div>
                </div>
              ))}
              {viewEmployee.salary && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black">₦</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Basic Salary</p>
                    <p className="text-[12px] font-black text-foreground">₦{Number(viewEmployee.salary).toLocaleString()}</p>
                  </div>
                </div>
              )}
              {viewEmployee.startDate && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={13} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Start Date</p>
                    <p className="text-[12px] font-medium text-foreground">{new Date(viewEmployee.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setViewEmployee(null); openEdit(viewEmployee); }} className="flex-1 py-2.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-1.5">
                <Edit2 size={13} /> Edit
              </button>
              <button onClick={() => { setViewEmployee(null); setDeleteTarget(viewEmployee); }} className="flex-1 py-2.5 rounded-xl bg-red-50 text-destructive text-[10px] font-black uppercase tracking-widest hover:bg-destructive hover:text-white transition-all flex items-center justify-center gap-1.5">
                <Trash2 size={13} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center mx-auto">
              <AlertCircle size={28} className="text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-foreground">Remove Employee?</h3>
              <p className="text-sm text-muted-foreground">
                <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong> will be permanently removed from the directory.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl border border-border/50 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted transition-all">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-destructive text-white text-[11px] font-black uppercase tracking-widest hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDirectory;
