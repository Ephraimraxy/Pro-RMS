import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Deletion", 
  message = "Are you sure you want to proceed? This action cannot be undone.",
  confirmText = "Delete Permanently",
  cancelText = "Cancel",
  type = "danger",
  isProcessing = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-end sm:justify-center p-4 sm:pt-[5vh] overflow-y-auto safe-p-top">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={!isProcessing ? onClose : undefined} 
      />
      <div className="glass bg-white/95 w-full max-w-sm mt-auto sm:my-auto rounded-[2rem] border border-border/50 shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-6 text-center space-y-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${
            type === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
          }`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
          </div>
          
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed px-2">
              {message}
            </p>
          </div>
        </div>

        <div className="p-6 pt-0 flex flex-col gap-2">
          <button 
            onClick={onConfirm}
            disabled={isProcessing}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center justify-center space-x-2 ${
              type === 'danger' 
                ? 'bg-destructive text-destructive-foreground shadow-destructive/20 hover:bg-destructive/90' 
                : 'bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isProcessing ? (
              <>
                <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${
                  type === 'danger' ? 'border-destructive-foreground' : 'border-primary-foreground'
                }`}></div>
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
          
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-3.5 rounded-2xl border border-border bg-white text-muted-foreground font-bold text-sm hover:bg-muted transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
