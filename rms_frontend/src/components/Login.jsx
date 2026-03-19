import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, ArrowRight } from 'lucide-react';
import heroImage from '../assets/hero.png';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Hero Decoration (Chocolate Hue) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10 blur-[120px] pointer-events-none mix-blend-multiply">
        <img src={heroImage} alt="" className="w-full h-full object-contain filter sepia hue-rotate-[-30deg] saturate-200" />
      </div>

      <div className="glass w-full max-w-[440px] p-10 rounded-[40px] border border-border/50 shadow-2xl shadow-primary/5 relative z-10 bg-white/60">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary/5 border border-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10 transition-transform hover:scale-105 duration-500">
             <img src="/favicon.png" alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tighter mb-2">
            CSS <span className="text-primary italic">RMS</span>
          </h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.3em] font-mono">Enterprise Workflow Portal</p>
        </div>

        {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold px-4 py-3 rounded-2xl mb-8 flex items-center space-x-3 animate-shake">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></div>
                <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">System Identifier</label>
            <div className="relative group">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text"
                value={systemId}
                onChange={(e) => setSystemId(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-white/80 border border-border rounded-2xl pl-12 pr-4 py-4 text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50"
                placeholder="UID-000000"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Secret Key</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-white/80 border border-border rounded-2xl pl-12 pr-4 py-4 text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center space-x-3 relative overflow-hidden group active:scale-[0.98] disabled:opacity-50"
          >
            <span className="relative z-10 italic">{isSubmitting ? "AUTHENTICATING..." : "ACCESS PORTAL"}</span>
            {!isSubmitting && <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform"></div>
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">© 2026 CSS Group Holding</p>
          <div className="mt-4 flex items-center justify-center space-x-4">
             <div className="w-1 h-1 rounded-full bg-border"></div>
             <p className="text-[9px] text-muted-foreground">ISO 27001 Certified Environment</p>
             <div className="w-1 h-1 rounded-full bg-border"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
