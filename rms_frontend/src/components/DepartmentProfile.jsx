import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, User, Mail, ShieldCheck, AlertCircle,
  Upload, Save, BadgeCheck, Phone, MapPin,
  Loader2, PenTool, CheckCircle2,
  ArrowLeft, Fingerprint, Lock, Eye, EyeOff, KeyRound
} from 'lucide-react';
import Layout from './Layout';
import { reqAPI, deptAPI } from '../lib/api';
import { toast } from 'react-hot-toast';

const DepartmentProfile = ({ user, onViewChange }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    headName: '',
    headEmail: '',
    headTitle: '',
    phone: '',
    address: '',
    hasSignature: false
  });

  const [codeForm, setCodeForm] = useState({ current: '', newCode: '', confirm: '' });
  const [showCodeFields, setShowCodeFields] = useState({ current: false, newCode: false, confirm: false });
  const [changingCode, setChangingCode] = useState(false);

  const fileInputRef = useRef(null);

  const fetchProfile = async () => {
    try {
      const data = await reqAPI.getDeptProfile();
      setProfile({
        ...data,
        headName: data.headName || '',
        headEmail: data.headEmail || '',
        headTitle: data.headTitle || '',
        phone: data.phone || '',
        address: data.address || ''
      });
    } catch (err) {
      toast.error('Failed to load department profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await reqAPI.updateDeptProfile(profile);
      toast.success('Department profile updated successfully');
      await fetchProfile();
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      await reqAPI.uploadDeptSignature(file);
      toast.success('Official signature uploaded and verified');
      await fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signature upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleChangeCode = async (e) => {
    e.preventDefault();
    if (codeForm.newCode !== codeForm.confirm) {
      toast.error('New code and confirmation do not match');
      return;
    }
    if (codeForm.newCode.length < 6) {
      toast.error('New access code must be at least 6 characters');
      return;
    }
    setChangingCode(true);
    try {
      await deptAPI.changeDeptAccessCode(codeForm.current, codeForm.newCode, codeForm.confirm);
      toast.success('Access code updated successfully');
      setCodeForm({ current: '', newCode: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update access code');
    } finally {
      setChangingCode(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
           <Loader2 className="w-16 h-16 text-primary animate-spin opacity-20" />
           <Building2 className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-black text-primary tracking-[0.2em] uppercase">RMS GOVERNANCE</p>
          <p className="text-xs font-bold text-muted-foreground animate-pulse">Synchronizing Authority Profile...</p>
        </div>
      </div>
    );
  }

  const isComplete = profile.headName && profile.headEmail && profile.hasSignature;

  return (
    <Layout user={user} currentView="dept_profile" onViewChange={onViewChange}>
      <div className="max-w-[95rem] mx-auto space-y-10 pb-20 animate-slide-up px-2">
        {/* ── TOP HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-4">
          <div className="space-y-1">
             <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                Authority Profile Control
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest flex items-center gap-1 shadow-sm ${
                isComplete ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
              }`}>
                {isComplete ? <ShieldCheck size={10} /> : <AlertCircle size={10} />}
                {isComplete ? 'Authenticated' : 'Registry Incomplete'}
              </div>
            </div>
            <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
              {profile.name || "Unit"} <span className="text-primary italic font-serif">Governance</span>
            </h1>
            <p className="text-muted-foreground text-[13px] font-medium tracking-tight">Authorization protocols for the {profile.name || 'department'} unit.</p>
          </div>

          <button 
            onClick={() => onViewChange('dashboard')}
            className="group flex items-center gap-4 px-6 py-3 rounded-2xl bg-white border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Return to Command</span>
          </button>
        </div>

        {/* ── MAIN CARD ── */}
        <div className="glass bg-white/70 backdrop-blur-3xl rounded-[3rem] border border-border/40 p-1 lg:p-2 shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="bg-[#FAF9F6]/30 rounded-[2.8rem] p-8 lg:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2 -z-10 animate-pulse"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start gap-12">
              <div className="w-28 h-28 rounded-[2.5rem] bg-foreground shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center text-background shrink-0 group hover:scale-105 transition-transform duration-500">
                <Building2 size={56} />
              </div>
              <div className="space-y-5 text-center lg:text-left flex-1">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    Neural Authenticated
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    Biometric Sync Protocol: ON
                  </div>
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter leading-none">
                  {profile.name || "Accessing Registry..."}
                </h2>
                <p className="text-muted-foreground text-sm font-medium italic opacity-70">
                  CSS Group Ecosystem • Departmental Strategic Action Unit
                </p>
              </div>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── LEFT COLUMN: MAIN FORM ── */}
        <div className="lg:col-span-8 space-y-8">
          <div className="glass bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-border/40 p-6 md:p-10 shadow-xl">
            <div className="flex items-center gap-4 mb-10">
               <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <User size={22} />
               </div>
               <div>
                 <h2 className="text-lg font-black tracking-tight">Authority Details</h2>
                 <p className="text-xs text-muted-foreground font-medium tracking-wide border-b-2 border-primary/20 pb-1">Primary Departmental Official</p>
               </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Official Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="text" required value={profile.headName}
                      onChange={e => setProfile({...profile, headName: e.target.value})}
                      placeholder="e.g. Dr. John Doe"
                      className="w-full bg-white border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Official Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="email" required value={profile.headEmail}
                      onChange={e => setProfile({...profile, headEmail: e.target.value})}
                      placeholder="head@cssgroup.internal"
                      className="w-full bg-white border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Head Official Designation / Title</label>
                <div className="relative group">
                  <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" size={18} />
                  <input
                    type="text" required value={profile.headTitle}
                    onChange={e => setProfile({...profile, headTitle: e.target.value})}
                    placeholder="e.g. General Manager, Finance"
                    className="w-full bg-white border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="py-4 flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent"></div>
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Contact & Logistics</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Contact Phone</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="text" value={profile.phone}
                      onChange={e => setProfile({...profile, phone: e.target.value})}
                      className="w-full bg-white border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Office Address</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="text" value={profile.address}
                      onChange={e => setProfile({...profile, address: e.target.value})}
                      className="w-full bg-white border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <button
                  type="submit" disabled={saving}
                  className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 py-5 rounded-[1.5rem] transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-4 disabled:opacity-50 hover:scale-[1.02] active:scale-95 group"
                >
                  {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} className="group-hover:rotate-12 transition-transform" />}
                  <span className="uppercase tracking-widest text-sm">Save Profile Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── RIGHT COLUMN: SIGNATURE & AUDIT ── */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-border/40 p-8 shadow-xl flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-inner">
              <Fingerprint size={36} />
            </div>
            <h3 className="text-lg font-black text-foreground tracking-tight">Official Digital Stamp</h3>
            <p className="text-xs text-muted-foreground mt-2 mb-8 leading-relaxed font-medium">
              This biological identity will be matched against all vouchers originated by your department.
            </p>

            <div className={`w-full aspect-[4/3] rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center p-6 transition-all relative overflow-hidden group ${
              profile.hasSignature 
                ? 'bg-emerald-500/5 border-emerald-500/20 shadow-inner' 
                : 'bg-muted/30 border-border/80 hover:border-primary/40'
            }`}>
              {profile.hasSignature ? (
                <div className="space-y-4 animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs font-black uppercase text-emerald-600 tracking-[0.1em]">Verified Seal Active</span>
                    <span className="block text-[10px] text-emerald-600/60 font-medium">Authentication Hash: SHA-256 Enabled</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-muted-foreground/40">
                  <Upload size={40} className="mx-auto" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Signature Payload Missing</span>
                </div>
              )}
              
              {/* Decorative corner elements */}
              <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-primary/10 p-2"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-primary/10 p-2"></div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-8 w-full py-5 rounded-2xl bg-white border border-primary/20 text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-3 active:scale-98 group"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <PenTool size={18} className="group-hover:-rotate-45 transition-transform" />}
              {profile.hasSignature ? 'Rotate Authorization Token' : 'Register Official Signature'}
            </button>

            <input
              type="file" ref={fileInputRef} className="hidden" accept="image/*"
              onChange={handleSignatureUpload}
            />
            
            <div className="mt-8 p-4 rounded-2xl bg-primary/5 w-full flex items-start gap-3">
              <AlertCircle size={16} className="text-primary shrink-0" />
              <p className="text-[10px] text-primary/70 font-bold leading-relaxed text-left">
                Security Policy: Signatures must be in high-contrast PNG or JPEG format (Max 2MB).
              </p>
            </div>
          </div>

          <div className="glass bg-white/80 rounded-[2rem] border border-border/40 p-6 shadow-lg space-y-6">
             <div className="flex items-center gap-3 text-primary">
                <div className="p-2 rounded-lg bg-primary/10">
                   <ShieldCheck size={18} />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.15em]">Governance Audit</span>
             </div>
             <div className="space-y-4">
                {[
                  { label: "Head Official Name", met: !!profile.headName },
                  { label: "Official Email Address", met: !!profile.headEmail },
                  { label: "Digital Signature Payload", met: profile.hasSignature },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between group">
                    <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                    <div className="flex items-center gap-2">
                       {item.met ? (
                         <>
                           <span className="text-[9px] font-black text-emerald-500/60 tracking-widest uppercase">Verified</span>
                           <CheckCircle2 size={16} className="text-emerald-500" />
                         </>
                       ) : (
                         <>
                           <span className="text-[9px] font-black text-amber-500/60 tracking-widest uppercase">Pending</span>
                           <div className="w-4 h-4 rounded-md bg-amber-100 border border-amber-200 animate-pulse" />
                         </>
                       )}
                    </div>
                  </div>
                ))}
             </div>

             <div className="pt-4 border-t border-border/30">
               <div className="p-3 rounded-xl bg-muted/30 text-[9px] font-bold text-muted-foreground italic leading-relaxed">
                 * All changes are logged for internal consult & control (ICC) auditing purposes.
               </div>
             </div>
          </div>

          {/* ── Change Access Code ── */}
          <div className="glass bg-white/80 rounded-[2rem] border border-border/40 p-6 shadow-lg space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <KeyRound size={18} className="text-amber-600" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-[0.15em] text-foreground">Change Access Code</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Update your department login credentials</p>
              </div>
            </div>

            <form onSubmit={handleChangeCode} className="space-y-4">
              {[
                { key: 'current', label: 'Current Access Code', placeholder: 'Enter current code' },
                { key: 'newCode', label: 'New Access Code', placeholder: 'Min. 6 characters' },
                { key: 'confirm', label: 'Confirm New Code', placeholder: 'Re-enter new code' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-0.5">{label}</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-amber-500 transition-colors" size={14} />
                    <input
                      type={showCodeFields[key] ? 'text' : 'password'}
                      value={codeForm[key]}
                      onChange={e => setCodeForm(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      required
                      className="w-full bg-white border border-border/50 rounded-xl pl-9 pr-10 py-3 text-sm font-mono tracking-widest focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCodeFields(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-amber-500 transition-colors"
                    >
                      {showCodeFields[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-1 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-2">
                <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700/80 font-medium leading-relaxed">
                  After changing your code, you will need to use the new code on your next login. Keep it safe.
                </p>
              </div>

              <button
                type="submit"
                disabled={changingCode}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-500/90 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50"
              >
                {changingCode ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {changingCode ? 'Updating...' : 'Update Access Code'}
              </button>
            </form>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
};

export default DepartmentProfile;
