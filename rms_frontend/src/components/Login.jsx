import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ArrowRight, CheckCircle2, Building2, Eye, EyeOff, Smartphone, HelpCircle, X, PhoneCall } from 'lucide-react';
import { getDepartments } from '../lib/store';
import { toast } from 'react-hot-toast';

const Login = () => {
  const [selectedDept, setSelectedDept] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [departments, setDepartments] = useState([]);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showForgotCode, setShowForgotCode] = useState(false);
  const { deptLogin } = useAuth();

  useEffect(() => {
    const fetchDepts = async () => {
      const depts = await getDepartments();
      setDepartments(depts);
    };
    fetchDepts();

    // PWA Install Logic
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      toast("To install: Open browser menu and select 'Add to Home Screen'", { icon: '📲' });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!selectedDept) {
        throw new Error("Please select a department");
      }
      // Unify login to use the department portal (Backend now handles Super Admin role internally)
      await deptLogin(selectedDept, accessCode, mfaCode);
    } catch (err) {
      const status = err.response?.status;
      let displayString;
      if (status === 401) {
        displayString = err.response?.data?.error || 'Incorrect access code. Please try again.';
      } else if (status === 429) {
        displayString = 'Too many attempts. Please wait a moment and try again.';
      } else if (status >= 500 || status === 502 || status === 503) {
        displayString = 'The server is temporarily unavailable. Please try again in a few seconds.';
      } else if (!navigator.onLine || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        displayString = 'No internet connection. Please check your network and try again.';
      } else {
        displayString = err.response?.data?.error || err.message || 'Authentication failed. Please try again.';
      }
      setError(displayString);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">

      {/* ── Left Branding Panel (Desktop Only) ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.9)] to-[hsl(var(--primary)/0.7)] text-white relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-sm"></div>
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3"></div>

        {/* Branding Card Wrapper */}
        <div className="relative z-10 border border-white/20 bg-white/5 backdrop-blur-sm rounded-[40px] p-10 py-12 flex flex-col justify-center my-auto">
          <div>
            <div className="w-32 h-20 rounded-2xl overflow-hidden bg-white/10 border border-white/20 shadow-inner">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover object-center" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60 mt-4">CSS Group of Company</p>
          </div>

          <div className="mt-12">
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Requisition<br />
              <span className="italic font-black text-white/90">Management</span>
            </h1>
            <p className="text-sm text-white/70 mt-5 leading-relaxed max-w-xs">
              Streamlined enterprise workflow for requisitions, memos, and procurement across all CSS Group departments.
            </p>
            <div className="mt-8 space-y-3">
              {['End-to-end approval tracking', 'Offline draft capability', 'Multi-department oversight'].map((item, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <CheckCircle2 size={14} className="text-white/50 flex-shrink-0" />
                  <span className="text-xs text-white/60">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info (Outside Card) */}
        <div className="relative z-10">
          <div className="flex items-center space-x-4 text-[9px] text-white/40 uppercase tracking-widest">
            <span>Enterprise Portal</span>
            <div className="w-1 h-1 rounded-full bg-white/30"></div>
            <span>ISO 27001</span>
          </div>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex items-center justify-center p-5 lg:p-12">
        <div className="w-full max-w-sm border border-border/60 rounded-2xl p-8 bg-white shadow-sm lg:border-0 lg:shadow-none lg:bg-transparent lg:p-0">

          {/* Mobile logo + app name */}
          <div className="lg:hidden flex items-center space-x-3 mb-8 pb-6 border-b border-border/40">
            <div className="w-20 h-11 rounded-xl overflow-hidden shrink-0">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover object-center" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">CSS <span className="text-primary italic">RMS</span></h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Enterprise Portal</p>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Authenticate to access the RMS portal</p>
          </div>

          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign In to Dashboard</h2>
              <p className="text-muted-foreground text-sm font-medium">Select your department and enter access code</p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-xl mb-5 flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></div>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Department / Unit</label>
                <div className="relative group">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={16} />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-white border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Choose your unit...</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Access Code</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={16} />
                  <input
                    type={showAccessCode ? "text" : "password"}
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-white border border-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 font-mono tracking-widest"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode(!showAccessCode)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                  >
                    {showAccessCode ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {selectedDept === 'Super Admin' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[11px] font-medium text-primary uppercase tracking-wider flex items-center justify-between">
                    <span>MFA Security PIN</span>
                    <span className="text-[9px] lowercase opacity-60">Required for Admin</span>
                  </label>
                  <div className="relative group">
                    <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/50 group-focus-within:text-primary transition-colors" size={16} />
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      disabled={isSubmitting}
                      className="w-full bg-primary/5 border border-primary/20 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder-primary/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 font-mono tracking-[0.5em] text-center"
                      placeholder="000000"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all shadow-md shadow-primary/15 flex items-center justify-center space-x-2 active:scale-[0.98] disabled:opacity-50 text-sm h-12"
              >
                <span>{isSubmitting ? "Authenticating..." : "Enter RMS Portal"}</span>
                {!isSubmitting && <ArrowRight size={16} />}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotCode(true)}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
                >
                  <HelpCircle size={12} className="group-hover:scale-110 transition-transform" />
                  Forgot your access code?
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">© 2026 CSS Group of Company</p>
          </div>
        </div>
      </div>

      {/* ── Forgot Access Code Modal ── */}
      {showForgotCode && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowForgotCode(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <PhoneCall size={28} className="text-primary" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground tracking-tight">Need Help With Your Code?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No worries — it happens to the best of us.
                </p>
              </div>

              <div className="w-full bg-primary/5 border border-primary/15 rounded-2xl p-5 space-y-3 text-left">
                <p className="text-sm text-foreground font-semibold">Please reach out to 080********:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-black text-primary">1</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your <span className="font-semibold text-foreground">System Administrator</span> — they can reset your access code immediately from the Department Manager.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-black text-primary">2</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The <span className="font-semibold text-foreground">ICT Department</span> — they will verify your identity and issue a new code promptly.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground/70 leading-relaxed italic">
                For security reasons, access codes cannot be self-recovered. Our team is happy to assist you.
              </p>

              <button
                onClick={() => setShowForgotCode(false)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                Got it, thank you
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PWA Floating Install Button ── */}
      {!isStandalone && (
        <button
          onClick={handleInstallApp}
          className="fixed bottom-6 right-6 z-[100] glass border border-primary/20 bg-white/40 hover:bg-white/60 text-primary py-2.5 px-5 rounded-full shadow-2xl flex items-center space-x-2.5 transition-all active:scale-95 group animate-in slide-in-from-bottom-10"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Smartphone size={16} />
          </div>
          <div className="text-left pr-1">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-60">Install App</p>
            <p className="text-xs font-bold leading-tight mt-0.5">RMS Portal</p>
          </div>
        </button>
      )}
    </div>
  );
};

export default Login;
