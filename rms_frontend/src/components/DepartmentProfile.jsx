import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, User, Mail, ShieldCheck, AlertCircle, 
  Upload, Save, BadgeCheck, Phone, MapPin, 
  Loader2, PenTool, CheckCircle2
} from 'lucide-react';
import { reqAPI } from '../lib/api';
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

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-bold text-primary tracking-widest uppercase">Syncing Governance Profile</p>
      </div>
    );
  }

  const isComplete = profile.headName && profile.headEmail && profile.hasSignature;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Building2 className="text-primary" />
            <span>Department <span className="text-primary">Profile</span></span>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Manage official metadata and authorization credentials for {profile.name}.
          </p>
        </div>
        
        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${
          isComplete ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {isComplete ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest">Enrollment Status</span>
            <span className="text-xs font-bold">{isComplete ? 'Fully Verified & Ready' : 'Incomplete - Setup Required'}</span>
          </div>
        </div>
      </div>

      {!isComplete && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 animate-pulse">
          <AlertCircle className="text-amber-600 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-bold text-amber-700">Action Required: Complete Governance Setup</p>
            <p className="text-xs text-amber-600/80 leading-relaxed mt-1">
              You cannot initiate or process requisitions until the head official's info and digital signature are correctly configured.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass bg-white/70 rounded-3xl border border-border/50 p-6 lg:p-8 shadow-sm">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <User size={12} className="text-primary" /> Head Official Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profile.headName}
                    onChange={e => setProfile({...profile, headName: e.target.value})}
                    placeholder="e.g. Dr. John Doe"
                    className="w-full bg-white/80 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Mail size={12} className="text-primary" /> Official Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={profile.headEmail}
                    onChange={e => setProfile({...profile, headEmail: e.target.value})}
                    placeholder="head@cssgroup.ng"
                    className="w-full bg-white/80 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <BadgeCheck size={12} className="text-primary" /> Official Head Title
                </label>
                <input
                  type="text"
                  required
                  value={profile.headTitle}
                  onChange={e => setProfile({...profile, headTitle: e.target.value})}
                  placeholder="e.g. GM, Finance & Accounts"
                  className="w-full bg-white/80 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="divider h-px bg-border/30 my-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Phone size={12} className="text-primary" /> Contact Phone
                  </label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={e => setProfile({...profile, phone: e.target.value})}
                    className="w-full bg-white/80 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} className="text-primary" /> Office Address
                  </label>
                  <input
                    type="text"
                    value={profile.address}
                    onChange={e => setProfile({...profile, address: e.target.value})}
                    className="w-full bg-white/80 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-3.5 rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center gap-3 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  <span>Save Profile Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass bg-white/70 rounded-3xl border border-border/50 p-6 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <PenTool size={28} />
            </div>
            <h3 className="text-sm font-bold text-foreground">Official Signature</h3>
            <p className="text-[11px] text-muted-foreground mt-1 mb-6 leading-relaxed">
              This digital stamp will be used to authorize all vouchers originated or approved by your department head.
            </p>

            <div className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all ${
              profile.hasSignature 
                ? 'bg-emerald-500/5 border-emerald-500/20' 
                : 'bg-muted/30 border-border/80 hover:border-primary/30'
            }`}>
              {profile.hasSignature ? (
                <div className="space-y-3">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Verified Signature Active</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={24} className="text-muted-foreground/50 mx-auto" />
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">No Signature Uploaded</span>
                </div>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-6 w-full py-3.5 rounded-2xl border border-primary/20 text-primary font-bold text-xs hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} className="group-hover:-translate-y-1 transition-transform" />}
              {profile.hasSignature ? 'Update Signature' : 'Upload Official Signature'}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleSignatureUpload}
            />
            
            <p className="text-[9px] text-muted-foreground mt-4 italic">
              Format: PNG (transparent) preferred. Max 2MB.
            </p>
          </div>

          <div className="p-5 bg-white rounded-3xl border border-border/50 shadow-sm space-y-3">
             <div className="flex items-center gap-2 text-primary">
                <ShieldCheck size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Compliance Audit</span>
             </div>
             <ul className="space-y-2">
                {[
                  { label: "Head Official Name", met: !!profile.headName },
                  { label: "Official Email Address", met: !!profile.headEmail },
                  { label: "Digital Signature Block", met: profile.hasSignature },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
                    {item.met ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-amber-100 border border-amber-200" />
                    )}
                  </li>
                ))}
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentProfile;
