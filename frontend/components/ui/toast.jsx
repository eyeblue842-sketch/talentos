"use client";

import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ToastContext = createContext(null);

const toneStyles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const api = useMemo(() => ({
    push({ title, description, tone = 'info', duration = 3200 }) {
      const id = `toast-${idRef.current += 1}`;
      setToasts((current) => [...current, { id, title, description, tone }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, duration);
    },
    remove(id) {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    },
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-md flex-col gap-3 px-4">
        {toasts.map((toast) => (
          <div key={toast.id} className={cn('pointer-events-auto rounded-[var(--radius-lg)] border px-4 py-3 shadow-[var(--shadow-lg)]', toneStyles[toast.tone])} role="status">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="font-semibold">{toast.title}</p>
                {toast.description ? <p className="text-sm">{toast.description}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full shadow-none" aria-label="Dismiss notification" onClick={() => api.remove(toast.id)}>
                <X size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }
  return context;
}
