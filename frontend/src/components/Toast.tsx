import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "./Button";

type ToastItem = {
  id: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  timeoutMs?: number;
};

type ToastCtx = {
  push: (t: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    const item: ToastItem = { id, timeoutMs: 6000, ...t };
    setItems((prev) => [item, ...prev].slice(0, 3));
    if (item.timeoutMs && item.timeoutMs > 0) {
      window.setTimeout(() => remove(id), item.timeoutMs);
    }
  }, [remove]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {items.map((t) => (
          <div key={t.id} className="surface border border-zinc-200/60 dark:border-zinc-800/70 shadow-soft rounded-2xl p-3 w-[320px]">
            <div className="text-sm font-medium">{t.title}</div>
            {t.message ? <div className="text-xs muted mt-0.5">{t.message}</div> : null}
            <div className="mt-2 flex items-center justify-end gap-2">
              {t.actionLabel && t.onAction ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try { await t.onAction?.(); } finally { remove(t.id); }
                  }}
                >
                  {t.actionLabel}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => remove(t.id)}>Dismiss</Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}