import React from 'react';
import { ArrowLeft } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, footer, size = 'lg' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-background flex flex-col overflow-y-auto safe-p-top p-4 sm:p-6 lg:p-8 custom-scrollbar animate-in fade-in duration-300">
      
      <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-6 flex-1 h-full min-h-screen pb-10">
        
        {/* Top Header / Back Button Navigation */}
        <div className="flex items-center justify-between">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-white border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-wider shadow-sm group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
        </div>

        <div className="glass bg-white/95 w-full flex-1 rounded-[2rem] border border-border/40 shadow-xl relative flex flex-col overflow-hidden">
          
          {/* Page Header */}
          <div className="p-6 lg:p-8 border-b border-border/50 flex items-center justify-between shrink-0 bg-white/50">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter leading-tight">{title}</h2>
              <div className="flex items-center space-x-2 pt-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">System Context Active</span>
              </div>
            </div>
          </div>
          
          {/* Main Auto-Expanding Body */}
          <div className="p-6 lg:p-8 flex-1 overflow-auto custom-scrollbar">
            {children}
          </div>

          {footer && (
            <div className="p-6 lg:p-8 border-t border-border/50 bg-white/80 flex flex-col sm:flex-row gap-3 items-center justify-end">
              {footer}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default Modal;
