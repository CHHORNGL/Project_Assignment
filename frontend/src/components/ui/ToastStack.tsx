import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToast, type ToastKind } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

const KIND_STYLES: Record<ToastKind, string> = {
  success:
    "border-emerald-500/30 bg-white/95 text-slate-900 dark:border-emerald-500/30 dark:bg-slate-900/95 dark:text-slate-100",
  danger:
    "border-rose-500/35 bg-white/95 text-slate-900 dark:border-rose-500/35 dark:bg-slate-900/95 dark:text-slate-100",
  warning:
    "border-amber-500/35 bg-white/95 text-slate-900 dark:border-amber-500/35 dark:bg-slate-900/95 dark:text-slate-100",
  info:
    "border-indigo-500/30 bg-white/95 text-slate-900 dark:border-indigo-500/30 dark:bg-slate-900/95 dark:text-slate-100",
};

const KIND_ICON_COLORS: Record<ToastKind, string> = {
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  info: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
};

function ToastIcon({ kind }: { kind: ToastKind }) {
  switch (kind) {
    case "success":
      return <CheckCircle2 className="h-4 w-4" />;
    case "danger":
      return <XCircle className="h-4 w-4" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

export default function ToastStack() {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed right-4 top-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === "danger" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-glass backdrop-blur-xl animate-fade-in-up",
            KIND_STYLES[toast.kind],
          )}
        >
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              KIND_ICON_COLORS[toast.kind],
            )}
          >
            <ToastIcon kind={toast.kind} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">{toast.title}</p>
            <p className="mt-0.5 text-sm font-medium leading-snug break-words">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
