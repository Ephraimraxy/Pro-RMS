import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const [systemId, setSystemId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(systemId, password);
    } catch (err) {
      setError(err.message || "Invalid System ID or Password");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">

      {/* ── Left Branding Panel (Desktop Only) ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.9)] to-[hsl(var(--primary)/0.7)] text-white relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-sm"></div>
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[440px] border border-white/10 rounded-[40px]"></div>

        <div className="relative z-10">
          <div className="w-14 h-14 bg-white/15 border border-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <img src="/favicon.png" alt="Logo" className="w-9 h-9 object-contain" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60 mt-4">CSS Group Holdings</p>
        </div>

        <div className="relative z-10">
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
            <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <img src="/favicon.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">CSS <span className="text-primary italic">RMS</span></h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Enterprise Portal</p>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Authenticate to access your portal</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-xl mb-5 flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></div>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">System Identifier</label>
              <div className="relative">
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                <input
                  type="text"
                  value={systemId}
                  onChange={(e) => setSystemId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-white border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                  placeholder="you@cssgroup.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Password</label>
                <button type="button" className="text-[11px] text-muted-foreground hover:text-primary transition-colors">Forgot?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-white border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl transition-all shadow-md shadow-primary/15 flex items-center justify-center space-x-2 active:scale-[0.98] disabled:opacity-50 text-sm"
            >
              <span>{isSubmitting ? "Authenticating..." : "Sign In"}</span>
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-muted-foreground">© 2026 CSS Group Holdings</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
