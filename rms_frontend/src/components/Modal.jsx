import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, footer, size = 'lg' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    'full': 'max-w-full mx-4'
  };

  const maxWidth = sizeClasses[size] || sizeClasses['lg'];

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6 bg-background/20 backdrop-blur-sm custom-scrollbar animate-in fade-in duration-300 pt-[5vh] pb-10">
      <div 
        className="fixed inset-0 bg-background/60 backdrop-blur-sm -z-10" 
        onClick={onClose} 
      />
      <div className={`glass bg-white/95 w-full ${maxWidth} rounded-[2rem] border border-border/50 shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-500`}>
        <div className="p-6 lg:p-8 border-b border-border/50 flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">System Modal Active</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-all active:scale-90">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 lg:p-8 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
        {footer && (
          <div className="p-6 lg:p-8 border-t border-border/50 bg-muted/20 flex flex-col sm:flex-row gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
