import { useState, useEffect, useRef } from 'react';
import {
  User, Mail, ShieldCheck, AlertCircle,
  Upload, Save, BadgeCheck, Phone, MapPin,
  Loader2, PenTool, CheckCircle2, Lock, Eye, EyeOff,
  KeyRound, Shield
} from 'lucide-react';
import Layout from './Layout';
import { reqAPI, deptAPI, authAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

// ── Shared input field ────────────────────────────────────────────────────────
const Field = ({ icon: Icon, label, value, onChange, type = 'text', placeholder = '', required = false, disabled = false, readOnly = false }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">{label}</label>
    <div className="relative group">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" size={15} />}
      <input
        type={type} value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        placeholder={placeholder} required={required}
        disabled={disabled || readOnly}
        className={`w-full border rounded-xl py-2.5 text-sm transition-all outline-none ${Icon ? 'pl-10' : 'pl-3.5'} pr-4
          ${readOnly
            ? 'bg-muted/30 border-border/30 text-muted-foreground cursor-default'
            : 'bg-white border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50'}`}
      />
    </div>
  </div>
);

// ── Section card ──────────────────────────────────────────────────────────────
const Card = ({ title, subtitle, icon: Icon, iconBg = 'bg-primary/10', iconColor = 'text-primary', children }) => (
  <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground leading-none">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ── DEPARTMENT PROFILE ────────────────────────────────────────────────────────
const DeptProfileContent = ({ user: _user }) => {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile]   = useState({
    name: '', headName: '', headEmail: '', headTitle: '',
    phone: '', address: '', hasSignature: false
  });
  const [codeForm, setCodeForm] = useState({ current: '', newCode: '', confirm: '' });
  const [showFields, setShowFields] = useState({ current: false, newCode: false, confirm: false });
  const [changingCode, setChangingCode] = useState(false);
  const fileInputRef = useRef(null);

  const fetchProfile = async () => {
    try {
      const data = await reqAPI.getDeptProfile();
      setProfile({ ...data, headName: data.headName || '', headEmail: data.headEmail || '',
        headTitle: data.headTitle || '', phone: data.phone || '', address: data.address || '' });
    } catch { toast.error('Failed to load department profile'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await reqAPI.updateDeptProfile(profile);
      toast.success('Profile updated successfully');
      await fetchProfile();
    } catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      await reqAPI.uploadDeptSignature(file);
      toast.success('Signature uploaded successfully');
      await fetchProfile();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleChangeCode = async (e) => {
    e.preventDefault();
    if (codeForm.newCode !== codeForm.confirm) { toast.error('New codes do not match'); return; }
    if (codeForm.newCode.length < 6) { toast.error('Code must be at least 6 characters'); return; }
    setChangingCode(true);
    try {
      await deptAPI.changeDeptAccessCode(codeForm.current, codeForm.newCode, codeForm.confirm);
      toast.success('Access code updated');
      setCodeForm({ current: '', newCode: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update code'); }
    finally { setChangingCode(false); }
  };

  if (loading) return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  const isComplete = profile.headName && profile.headEmail && profile.hasSignature;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isComplete ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {isComplete ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
              {isComplete ? 'Profile Complete' : 'Setup Incomplete'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {profile.name || 'Department'} <span className="text-primary">Profile</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your department settings and official details.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT — main form (2/3 width) */}
        <div className="lg:col-span-2 space-y-5">
          <Card title="Department Head Details" subtitle="Official representative of this department" icon={User}>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field icon={User} label="Full Name" value={profile.headName}
                  onChange={v => setProfile(p => ({ ...p, headName: v }))}
                  placeholder="e.g. Dr. John Doe" required />
                <Field icon={Mail} label="Email Address" value={profile.headEmail} type="email"
                  onChange={v => setProfile(p => ({ ...p, headEmail: v }))}
                  placeholder="head@cssgroup.internal" required />
              </div>
              <Field icon={BadgeCheck} label="Job Title / Designation" value={profile.headTitle}
                onChange={v => setProfile(p => ({ ...p, headTitle: v }))}
                placeholder="e.g. Head of Procurement" required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field icon={Phone} label="Phone Number" value={profile.phone}
                  onChange={v => setProfile(p => ({ ...p, phone: v }))}
                  placeholder="+234 000 0000 000" />
                <Field icon={MapPin} label="Office Location / Address" value={profile.address}
                  onChange={v => setProfile(p => ({ ...p, address: v }))}
                  placeholder="e.g. Block A, Admin Building" />
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-all shadow-md shadow-primary/15 disabled:opacity-50 active:scale-[0.98]">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Card>

          {/* Change Access Code */}
          <Card title="Change Access Code" subtitle="Update your department login credentials"
            icon={KeyRound} iconBg="bg-amber-50" iconColor="text-amber-600">
            <form onSubmit={handleChangeCode} className="space-y-3">
              {[
                { key: 'current', label: 'Current Code' },
                { key: 'newCode', label: 'New Code' },
                { key: 'confirm', label: 'Confirm New Code' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-amber-500 transition-colors" size={14} />
                    <input
                      type={showFields[key] ? 'text' : 'password'}
                      value={codeForm[key]}
                      onChange={e => setCodeForm(p => ({ ...p, [key]: e.target.value }))}
                      required
                      className="w-full bg-white border border-border/60 rounded-xl pl-10 pr-10 py-2.5 text-sm font-mono tracking-widest focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none transition-all"
                    />
                    <button type="button"
                      onClick={() => setShowFields(p => ({ ...p, [key]: !p[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-amber-500 transition-colors">
                      {showFields[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-1">
                After changing your code, use the new one on your next login. Keep it confidential.
              </p>
              <button type="submit" disabled={changingCode}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-500/90 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50">
                {changingCode ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {changingCode ? 'Updating…' : 'Update Access Code'}
              </button>
            </form>
          </Card>
        </div>

        {/* RIGHT — signature + checklist (1/3 width) */}
        <div className="space-y-5">
          {/* Signature Upload */}
          <Card title="Official Signature" subtitle="Used on all PDF documents" icon={PenTool}>
            <div className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${
              profile.hasSignature ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/20 border-border hover:border-primary/40'
            }`}>
              {profile.hasSignature ? (
                <>
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={20} className="text-white" />
                  </div>
                  <p className="text-xs font-bold text-emerald-700">Signature Active</p>
                  <p className="text-[10px] text-emerald-600/70">Click below to replace</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-muted-foreground/30" />
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">No Signature</p>
                </>
              )}
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="mt-3 w-full py-2.5 rounded-xl border border-primary/30 text-primary font-bold text-xs uppercase tracking-wider hover:bg-primary/5 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : profile.hasSignature ? 'Replace Signature' : 'Upload Signature'}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleSignatureUpload} />
            <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">PNG or JPEG · Max 2MB</p>
          </Card>

          {/* Profile Checklist */}
          <Card title="Setup Checklist" subtitle="Complete your profile" icon={ShieldCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600">
            <div className="space-y-3">
              {[
                { label: 'Department Head Name', met: !!profile.headName },
                { label: 'Official Email Address', met: !!profile.headEmail },
                { label: 'Job Title / Designation', met: !!profile.headTitle },
                { label: 'Official Signature', met: profile.hasSignature },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <span className="text-xs text-foreground">{item.label}</span>
                  {item.met
                    ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CheckCircle2 size={13} /> Done</span>
                    : <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600"><AlertCircle size={13} /> Needed</span>
                  }
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ── ADMIN PROFILE ─────────────────────────────────────────────────────────────
const AdminProfileContent = ({ user }) => {
  const { logout } = useAuth();
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    if (pwForm.newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.newPw });
      toast.success('Password updated successfully. Please log in again.');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => logout(), 1500);
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed to update password'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Admin <span className="text-primary">Profile</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your Super Admin account settings.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Account Info */}
        <Card title="Account Information" subtitle="Your Super Admin identity" icon={User}>
          <div className="space-y-3">
            <Field icon={User} label="Display Name" value={user?.name || 'Super Admin'} readOnly />
            <Field icon={Mail} label="Email Address" value={user?.email || '—'} readOnly />
            <Field icon={Shield} label="Role" value="Super Administrator" readOnly />
          </div>
        </Card>

        {/* Change Password */}
        <Card title="Change Password" subtitle="Update your login password" icon={KeyRound} iconBg="bg-amber-50" iconColor="text-amber-600">
          <form onSubmit={handleChangePw} className="space-y-3">
            {[
              { key: 'current', label: 'Current Password' },
              { key: 'newPw',   label: 'New Password' },
              { key: 'confirm', label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-amber-500 transition-colors" size={14} />
                  <input
                    type={showPw[key] ? 'text' : 'password'}
                    value={pwForm[key]}
                    onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                    required
                    className="w-full bg-white border border-border/60 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none transition-all"
                  />
                  <button type="button"
                    onClick={() => setShowPw(p => ({ ...p, [key]: !p[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-amber-500 transition-colors">
                    {showPw[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}
            <button type="submit" disabled={saving}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-500/90 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-1">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
};

// ── Root component ────────────────────────────────────────────────────────────
const DepartmentProfile = ({ user, onViewChange }) => {
  const isAdmin = user?.role === 'global_admin';

  return (
    <Layout user={user} currentView="dept_profile" onViewChange={onViewChange}>
      <div className="px-1 pt-2">
        {isAdmin
          ? <AdminProfileContent user={user} />
          : <DeptProfileContent user={user} onViewChange={onViewChange} />
        }
      </div>
    </Layout>
  );
};

export default DepartmentProfile;
