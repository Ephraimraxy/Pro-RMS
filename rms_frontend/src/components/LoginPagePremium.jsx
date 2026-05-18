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

    // Only load video on reasonably fast connections
    const conn = navigator.connection;
    const canPlayVideo = !conn || (
      !conn.saveData &&
      !['slow-2g', '2g', '3g'].includes(conn.effectiveType)
    );
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
    <div className="relative min-h-screen overflow-hidden bg-[#0a1a0a]">

      {/* ── Video / Poster Background ── */}
      <div className="absolute inset-0 z-0">
        {/* Poster image — loads instantly, always visible until video plays */}
        <img
          src="/images/login-poster.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: videoReady ? 0 : 1, transition: 'opacity 1.2s ease' }}
        />
        {/* Video — only rendered on fast connections; fades over poster once ready */}
        {useVideo && (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlayThrough={() => setVideoReady(true)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: videoReady ? 1 : 0, transition: 'opacity 1.2s ease' }}
          >
            <source src="/videos/login-bg.webm" type="video/webm" />
            <source src="/videos/login-bg.mp4" type="video/mp4" />
          </video>
        )}
        {/* Dark gradient overlay — keeps text readable over any video frame */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/60" />
        {/* Extra left-side darkening for desktop branding legibility */}
        <div className="hidden lg:block absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-black/40 to-transparent" />
      </div>

      {/* ── Page Content ── */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* ── Left Branding Panel (Desktop Only) ── */}
        <div className="hidden lg:flex lg:w-[50%] flex-col justify-between p-14">

          {/* Top: Logo + company name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-9 rounded-xl overflow-hidden bg-white/10 border border-white/20 shadow-inner backdrop-blur-sm">
              <img src="/CSS_Group.png" alt="CSS Group" className="w-full h-full object-cover object-center" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">CSS Group</p>
              <p className="text-xs font-bold text-white/80 tracking-wider">of Companies</p>
            </div>
          </div>

          {/* Centre: headline + feature bullets */}
          <div className="space-y-8">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/80 mb-3">
                Enterprise Portal
              </p>
              <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
                Requisition<br />
                <span className="text-emerald-400">Management</span><br />
                System
              </h1>
            </div>

            <p className="text-sm text-white/60 leading-relaxed max-w-sm font-medium">
              Streamlined enterprise workflow for requisitions, memos, and procurement across all CSS Group departments.
            </p>

            <div className="space-y-3.5">
              {[
                'End-to-end approval tracking',
                'Offline draft capability',
                'Multi-department oversight',
                'Real-time notifications',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={11} className="text-emerald-400" />
                  </div>
                  <span className="text-sm text-white/70 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: compliance badge */}
          <div className="flex items-center gap-3 text-[10px] text-white/30 uppercase tracking-widest">
            <span>RMS v2</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span>ISO 27001</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span>© 2026 CSS Group</span>
          </div>
        </div>

        {/* ── Right Form Panel ── */}
        <div className="flex-1 flex items-center justify-center p-5 lg:p-12 min-h-screen lg:min-h-0">
          <div className="w-full max-w-sm">

            {/* Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-black/40 overflow-hidden border border-white/20">

              {/* Mobile header bar */}
              <div className="lg:hidden bg-primary px-6 py-5 flex items-center gap-4">
                <div className="w-20 h-11 rounded-xl overflow-hidden shrink-0 bg-white/10 p-0.5">
                  <img src="/CSS_Group.png" alt="Logo" className="w-full h-full object-cover object-center" />
                </div>
                <div>
                  <h1 className="text-base font-black text-white tracking-[0.1em] italic uppercase">RMS</h1>
                  <p className="text-[10px] text-white/80 uppercase tracking-[0.3em] font-bold leading-none">Portal</p>
                </div>
              </div>

              {/* Form body */}
              <div className="p-7 space-y-6">
                {/* Desktop heading (hidden on mobile — the green bar acts as header) */}
                <div className="hidden lg:block space-y-1">
                  <h2 className="text-xl font-black text-foreground tracking-tight">Welcome back</h2>
                  <p className="text-xs text-muted-foreground font-medium">Authenticate to access the RMS portal</p>
                </div>

                {/* Mobile heading */}
                <div className="lg:hidden space-y-1">
                  <h2 className="text-lg font-bold text-foreground">Sign In</h2>
                  <p className="text-xs text-muted-foreground">Select your department and enter access code</p>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Department selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
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
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
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

                  {/* MFA (Super Admin only) */}
                  {selectedDept === 'Super Admin' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center justify-between">
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
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 text-sm"
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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

      {/* ── PWA Install Button ── */}
      {!isStandalone && (
        <button
          onClick={handleInstallApp}
          className="fixed bottom-6 right-6 z-[100] bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 text-white py-2.5 px-5 rounded-full shadow-2xl flex items-center gap-2.5 transition-all active:scale-95 group animate-in slide-in-from-bottom-10"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Smartphone size={16} />
          </div>
          <div className="text-left pr-1">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-70">Install App</p>
            <p className="text-xs font-bold leading-tight mt-0.5">RMS Portal</p>
          </div>
        </button>
      )}
    </div>
  );
};

export default LoginPagePremium;
