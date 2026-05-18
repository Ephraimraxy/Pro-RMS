import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ArrowRight, CheckCircle2, Building2, Eye, EyeOff, Smartphone, HelpCircle, X, PhoneCall } from 'lucide-react';
import { getDepartments } from '../lib/store';
import { toast } from 'react-hot-toast';

const LoginPagePremium = () => {
  const [selectedDept, setSelectedDept] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [departments, setDepartments] = useState([]);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showForgotCode, setShowForgotCode] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [useVideo, setUseVideo] = useState(false);
  const { deptLogin } = useAuth();

  useEffect(() => {
    getDepartments().then(setDepartments);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsStandalone(true);

    // Only render video on fast connections
    const conn = navigator.connection;
    const canPlayVideo = !conn || (!conn.saveData && !['slow-2g', '2g', '3g'].includes(conn.effectiveType));
    if (canPlayVideo) setUseVideo(true);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      toast("To install: Open browser menu and select 'Add to Home Screen'", { icon: '📲' });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (!selectedDept) throw new Error('Please select a department');
      await deptLogin(selectedDept, accessCode, mfaCode);
    } catch (err) {
      const status = err.response?.status;
      let msg;
      if (status === 401) msg = err.response?.data?.error || 'Incorrect access code. Please try again.';
      else if (status === 429) msg = 'Too many attempts. Please wait a moment and try again.';
      else if (status >= 500) msg = 'The server is temporarily unavailable. Please try again in a few seconds.';
      else if (!navigator.onLine || err.code === 'ERR_NETWORK' || err.message === 'Network Error')
        msg = 'No internet connection. Please check your network and try again.';
      else msg = err.response?.data?.error || err.message || 'Authentication failed. Please try again.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#d4edda]">

      {/* ── Video / Poster Background ── */}
      <div className="absolute inset-0 z-0">
        {/* Poster — instant load, shows until video fades in */}
        <img
          src="/images/login-poster.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: videoReady ? 0 : 1, transition: 'opacity 1.4s ease' }}
        />
        {/* Video — only on fast connections */}
        {useVideo && (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlayThrough={() => setVideoReady(true)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: videoReady ? 1 : 0, transition: 'opacity 1.4s ease' }}
          >
            <source src="/videos/login-bg.webm" type="video/webm" />
            <source src="/videos/login-bg.mp4" type="video/mp4" />
          </video>
        )}
        {/* Very subtle top vignette for legibility */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" />
      </div>

      {/* ── Page Layout ── */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* ── Left Branding (Desktop only) — floats directly on video ── */}
        <div className="hidden lg:flex lg:w-[50%] flex-col justify-between p-14">

          {/* Logo + company name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white/60">
              <img src="/CSS_Favicon.png" alt="CSS Group" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Main headline block */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-black leading-tight tracking-tight" style={{ color: '#1a5c1a', textShadow: '0 1px 8px rgba(255,255,255,0.5)' }}>
                CSS GROUP OF COMPANIES
              </h1>
              <p className="text-xl font-bold mt-2" style={{ color: '#1a5c1a', textShadow: '0 1px 6px rgba(255,255,255,0.4)' }}>
                Requisition Management System
              </p>
              <p className="text-sm mt-4 leading-relaxed max-w-xs font-medium" style={{ color: '#1a3d1a', textShadow: '0 1px 4px rgba(255,255,255,0.6)' }}>
                Streamlined enterprise workflow for requisitions, memos, and procurement across all CSS Group departments.
              </p>
            </div>

            <div className="space-y-3">
              {[
                'End-to-end approval tracking',
                'Offline draft capability',
                'Multi-department oversight',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 size={16} style={{ color: '#1a5c1a', flexShrink: 0 }} />
                  <span className="text-sm font-semibold" style={{ color: '#1a3d1a', textShadow: '0 1px 4px rgba(255,255,255,0.5)' }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom spacer */}
          <div />
        </div>

        {/* ── Right Form Panel ── */}
        <div className="flex-1 flex items-center justify-center p-5 lg:p-12 min-h-screen lg:min-h-0">
          <div className="w-full max-w-sm">

            {/* Card */}
            <div className="bg-white rounded-[1.75rem] shadow-2xl shadow-black/20 overflow-hidden border border-white/40">

              {/* Mobile-only green header bar */}
              <div className="lg:hidden bg-primary px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/40 bg-white/10">
                    <img src="/CSS_Favicon.png" alt="CSS Group" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[9px] text-white/70 font-bold uppercase tracking-[0.2em] leading-none">CSS Group</p>
                    <p className="text-sm font-black text-white tracking-[0.15em] uppercase leading-tight">RMS Portal</p>
                  </div>
                </div>
              </div>

              {/* Form body */}
              <div className="p-7 space-y-5">

                {/* Heading — matches screenshot exactly */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">Welcome back</p>
                  <p className="text-[11px] text-muted-foreground/70">Authenticate to access the RMS portal</p>
                </div>

                <div className="space-y-1 text-center">
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Sign In to Dashboard</h2>
                  <p className="text-muted-foreground text-sm">Select your department and enter access code</p>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Department */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Department / Unit
                    </label>
                    <div className="relative group">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={15} />
                      <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        disabled={isSubmitting}
                        required
                        className="w-full bg-white border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 appearance-none cursor-pointer"
                      >
                        <option value="">Choose your unit...</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.name}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Access code */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Access Code
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={15} />
                      <input
                        type={showAccessCode ? 'text' : 'password'}
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        disabled={isSubmitting}
                        required
                        className="w-full bg-white border border-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 font-mono tracking-widest"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccessCode(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                      >
                        {showAccessCode ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* MFA pin — Super Admin only */}
                  {selectedDept === 'Super Admin' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
                        <span>MFA Security PIN</span>
                        <span className="text-[9px] lowercase opacity-60">Required for Admin</span>
                      </label>
                      <div className="relative group">
                        <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/50 group-focus-within:text-primary transition-colors" size={15} />
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
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 text-sm"
                  >
                    <span>{isSubmitting ? 'Authenticating…' : 'Enter RMS Portal'}</span>
                    {!isSubmitting && <ArrowRight size={16} />}
                  </button>

                  <div className="text-center">
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

                <p className="text-center text-[10px] text-muted-foreground/60 font-medium uppercase tracking-[0.15em]">
                  © 2026 CSS Group of Companies
                </p>
              </div>
            </div>
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
                <p className="text-xs text-muted-foreground leading-relaxed">No worries — it happens to the best of us.</p>
              </div>
              <div className="w-full bg-primary/5 border border-primary/15 rounded-2xl p-5 space-y-3 text-left">
                <p className="text-sm text-foreground font-semibold">Please reach out to 080********:</p>
                <div className="space-y-2">
                  {[
                    ['1', 'Your System Administrator — they can reset your access code immediately from the Department Manager.'],
                    ['2', 'The ICT Department — they will verify your identity and issue a new code promptly.'],
                  ].map(([num, text]) => (
                    <div key={num} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] font-black text-primary">{num}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed italic">
                For security reasons, access codes cannot be self-recovered.
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

      {/* ── PWA Install Button ── */}
      {!isStandalone && (
        <button
          onClick={handleInstallApp}
          className="fixed bottom-6 right-6 z-[100] bg-white/80 backdrop-blur-md border border-primary/20 hover:bg-white text-primary py-2.5 px-5 rounded-full shadow-2xl flex items-center gap-2.5 transition-all active:scale-95 group animate-in slide-in-from-bottom-10"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
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

export default LoginPagePremium;
