import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]); // Keep max 5 toasts

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const toast = {
    success: (msg: string) => showToast(msg, 'success'),
    error: (msg: string) => showToast(msg, 'error'),
    info: (msg: string) => showToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start justify-between gap-3 text-xs font-semibold transition-all ${
                t.type === 'success'
                  ? 'bg-slate-900/95 border-emerald-500/60 text-emerald-200 shadow-emerald-950/40'
                  : t.type === 'error'
                  ? 'bg-slate-900/95 border-rose-500/60 text-rose-200 shadow-rose-950/40'
                  : 'bg-slate-900/95 border-cyan-500/60 text-cyan-200 shadow-cyan-950/40'
              }`}
            >
              <div className="flex items-start gap-2.5 pt-0.5">
                {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                {t.type === 'info' && <Info className="w-5 h-5 text-cyan-400 shrink-0" />}
                <span className="leading-relaxed whitespace-pre-line">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (msg: string) => console.log('[Toast]', msg),
      toast: {
        success: (msg: string) => console.log('[Toast Success]', msg),
        error: (msg: string) => console.log('[Toast Error]', msg),
        info: (msg: string) => console.log('[Toast Info]', msg),
      },
    };
  }
  return ctx;
};
