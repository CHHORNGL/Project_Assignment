import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { FlashMessage } from "@/types/app";

export type ToastKind = "success" | "danger" | "warning" | "info";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  pushToast: (message: string, category?: string, title?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function normalizeKind(category?: string): ToastKind {
  const cat = String(category || "info").toLowerCase();
  if (cat === "success") return "success";
  if (cat === "danger" || cat === "error" || cat === "failed" || cat === "fail") return "danger";
  if (cat === "warning" || cat === "warn") return "warning";
  return "info";
}

function defaultTitle(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "Success";
    case "danger":
      return "Error";
    case "warning":
      return "Notice";
    default:
      return "Info";
  }
}

export function ToastProvider({
  initialFlashes = [],
  children,
}: {
  initialFlashes?: FlashMessage[];
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, category = "info", title?: string) => {
      const text = String(message || "").trim();
      if (!text) return;
      const kind = normalizeKind(category);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [
        ...prev.slice(-4),
        { id, kind, title: title || defaultTitle(kind), message: text },
      ]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast],
  );

  useEffect(() => {
    if (Array.isArray(initialFlashes) && initialFlashes.length > 0) {
      initialFlashes.forEach((item) => {
        if (item?.message) {
          pushToast(item.message, item.category);
        }
      });
    }
  }, []);

  useEffect(() => {
    window.showToast = (message: string, category = "info") => {
      pushToast(message, category);
    };
    return () => {
      delete window.showToast;
    };
  }, [pushToast]);

  return (
    <ToastContext.Provider value={{ toasts, pushToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}
