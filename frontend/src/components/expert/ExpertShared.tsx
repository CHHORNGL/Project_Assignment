import React, { useEffect } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  FileText,
  GitBranch,
  Headphones,
  MessageSquare,
  Plus,
  Save,
  Search,
  Sliders,
  Stethoscope,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import type { AdminTone } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  pages: number;
  start: number;
  end: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function statusBadgeClass(status?: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") {
    return "border border-[#90d67f] bg-[#d9fbd0] text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#90ee7a]";
  }
  if (s === "REJECTED") {
    return "border border-[#f48270] bg-[#ffe0db] text-[#b81800] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]";
  }
  if (s === "PENDING") {
    return "border border-[#ffcc85] bg-[#ffefca] text-[#bc3803] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]";
  }
  if (s === "AUTO") {
    return "border border-[#adc5ff] bg-[#e5edff] text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]";
  }
  return "border border-[#cbd0dd] bg-[#eff2f6] text-[#525b75] dark:border-[#373e53] dark:bg-[#1e2436] dark:text-[#9fa6bc]";
}

export function statusTone(status?: string): AdminTone {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "emerald";
  if (s === "REJECTED") return "rose";
  if (s === "PENDING") return "amber";
  if (s === "AUTO") return "indigo";
  return "slate";
}

export function normalizeConfidencePercent(val?: number | null): number | null {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return null;
  const num = Number(val);
  const pct = num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function confidenceTone(val?: number | null): AdminTone {
  const pct = normalizeConfidencePercent(val);
  if (pct === null) return "slate";
  if (pct >= 80) return "emerald";
  if (pct >= 50) return "amber";
  return "rose";
}

export function formatShortDateTime(raw?: string | null): string {
  if (!raw) return "-";
  return raw.slice(0, 16).replace("T", " ");
}

function resolveActionIcon(key: string, href: string, isLast: boolean): React.ReactNode {
  const k = key.toLowerCase();
  const h = href.toLowerCase();
  if (h.includes("create") || k.includes("create") || k.includes("add")) {
    return <Plus className="h-3.5 w-3.5" />;
  }
  if (h.includes("pending") || k.includes("pending")) {
    return <Clock className="h-3.5 w-3.5" />;
  }
  if (h.includes("symptom") || k.includes("symptom")) {
    return <Stethoscope className="h-3.5 w-3.5" />;
  }
  if (h.includes("rule") || k.includes("rule")) {
    return <GitBranch className="h-3.5 w-3.5" />;
  }
  if (h.includes("source") || k.includes("source")) {
    return <Database className="h-3.5 w-3.5" />;
  }
  if (h.includes("fact") || k.includes("fact")) {
    return <FileText className="h-3.5 w-3.5" />;
  }
  if (h.includes("chat") || k.includes("chat")) {
    return <MessageSquare className="h-3.5 w-3.5" />;
  }
  if (h.includes("support") || k.includes("support")) {
    return <Headphones className="h-3.5 w-3.5" />;
  }
  if (h.includes("disease") || h.includes("knowledge") || k.includes("knowledge")) {
    return <BookOpen className="h-3.5 w-3.5" />;
  }
  if (h.includes("optional") || k.includes("input")) {
    return <Sliders className="h-3.5 w-3.5" />;
  }
  if (k.includes("back") || !isLast) {
    return <ArrowLeft className="h-3.5 w-3.5" />;
  }
  return null;
}

export function ExpertHeaderActions({ bootstrap }: { bootstrap: AppBootstrap<any> }) {
  const entries = Object.entries(
    (bootstrap.ui.actions || {}) as Record<string, { label: string; href: string }>,
  );
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(([key, act], idx) => {
        const isLast = idx === entries.length - 1;
        const icon = resolveActionIcon(key, act.href, isLast);
        return (
          <a
            key={`${act.href}-${idx}`}
            href={act.href}
            className={
              isLast
                ? "ai-btn-primary h-9 gap-1.5 px-3.5 text-xs"
                : "ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs"
            }
          >
            {icon}
            <span>{act.label}</span>
          </a>
        );
      })}
    </div>
  );
}

export function buildPageUrl(
  baseUrl: string,
  params: Record<string, string | number | undefined | null>,
): string {
  const url = new URL(
    baseUrl,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  Object.entries(params).forEach(([key, val]) => {
    if (val === undefined || val === null || val === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(val));
    }
  });
  return `${url.pathname}${url.search}`;
}

export function PaginationBar({
  pagination,
  showingRange,
  pageOf,
  prevLabel,
  nextLabel,
  baseUrl,
  extraParams,
}: {
  pagination: PaginationInfo;
  showingRange?: string;
  pageOf?: string;
  prevLabel?: string;
  nextLabel?: string;
  baseUrl: string;
  extraParams?: Record<string, string | number | undefined | null>;
}) {
  if (!pagination || pagination.pages <= 1) {
    return showingRange ? (
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-[#6e7891] dark:text-[#8a94ad]">
        <span>{showingRange}</span>
        {pageOf && <span>{pageOf}</span>}
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 text-xs dark:border-[#2b3245]">
      <div className="text-[#6e7891] dark:text-[#8a94ad]">
        {showingRange}
        {pageOf ? (
          <span className="ml-2 font-semibold text-[#141824] dark:text-[#eff2f6]">({pageOf})</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={
            pagination.hasPrev
              ? buildPageUrl(baseUrl, {
                  ...extraParams,
                  page: pagination.page - 1,
                  per_page: pagination.perPage,
                })
              : "#"
          }
          aria-disabled={!pagination.hasPrev}
          onClick={(e) => {
            if (!pagination.hasPrev) e.preventDefault();
          }}
          className={cn(
            "ai-btn-secondary h-8 gap-1 px-2.5 text-xs",
            !pagination.hasPrev && "pointer-events-none opacity-45",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {prevLabel || "Prev"}
        </a>
        <a
          href={
            pagination.hasNext
              ? buildPageUrl(baseUrl, {
                  ...extraParams,
                  page: pagination.page + 1,
                  per_page: pagination.perPage,
                })
              : "#"
          }
          aria-disabled={!pagination.hasNext}
          onClick={(e) => {
            if (!pagination.hasNext) e.preventDefault();
          }}
          className={cn(
            "ai-btn-secondary h-8 gap-1 px-2.5 text-xs",
            !pagination.hasNext && "pointer-events-none opacity-45",
          )}
        >
          {nextLabel || "Next"}
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export function ExpertSearchField({
  value,
  defaultValue,
  onChange,
  onClear,
  name,
  placeholder,
  className = "",
  ariaLabel,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  onClear?: () => void;
  name?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const showClear = typeof value === "string" && value.length > 0 && Boolean(onClear || onChange);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94ad]"
        aria-hidden="true"
      />
      <input
        type="text"
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder || "Search"}
        className={cn("ai-input h-9 py-1.5 pl-10 text-xs", showClear ? "pr-9" : "pr-3")}
      />
      {showClear && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange?.(""))}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[#8a94ad] transition-colors hover:bg-[#eff2f6] hover:text-[#141824] dark:hover:bg-[#22283a] dark:hover:text-[#eff2f6]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ExpertFieldLabel({
  htmlFor,
  label,
  required = false,
  langTag,
  hint,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  langTag?: "EN" | "KM";
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label
        htmlFor={htmlFor}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]"
      >
        <span>{label}</span>
        {required && (
          <span className="text-[#fa3b1d]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="flex items-center gap-1.5">
        {hint && <span className="text-[11px] text-[#8a94ad]">{hint}</span>}
        {langTag && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
              langTag === "KM"
                ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                : "bg-[#eff2f6] text-[#525b75] dark:bg-[#1e2436] dark:text-[#9fa6bc]",
            )}
          >
            {langTag}
          </span>
        )}
      </div>
    </div>
  );
}

export function ExpertFormFooter({
  backUrl,
  cancelLabel,
  submitLabel,
  hint,
}: {
  backUrl: string;
  cancelLabel?: string;
  submitLabel: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3e6ed] bg-white px-4 py-3 shadow-xs dark:border-[#2b3245] dark:bg-[#141824] sm:px-5 sm:py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <a href={backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{cancelLabel || "Cancel"}</span>
        </a>
        {hint && (
          <span className="hidden text-xs text-[#6e7891] dark:text-[#8a94ad] sm:inline">
            {hint}
          </span>
        )}
      </div>
      <button type="submit" className="ai-btn-primary h-9 w-full justify-center gap-1.5 px-5 text-xs sm:w-auto">
        <Save className="h-3.5 w-3.5" />
        <span>{submitLabel}</span>
      </button>
    </div>
  );
}

export function ExpertBulkToolbar({
  selectedCount,
  selectedLabel,
  bulkAction,
  onBulkActionChange,
  options,
  actionPlaceholder,
  applySelectedLabel,
  applyAllLabel,
  onRequestSelected,
  onRequestAll,
}: {
  selectedCount: number;
  selectedLabel?: string;
  bulkAction: string;
  onBulkActionChange: (val: string) => void;
  options: Array<{ id: string; label: string }>;
  actionPlaceholder?: string;
  applySelectedLabel: string;
  applyAllLabel?: string;
  onRequestSelected: () => void;
  onRequestAll?: () => void;
}) {
  const isDanger = bulkAction === "delete";
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#e3e6ed] pt-3 dark:border-[#2b3245]">
      <span
        className={cn(
          "inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold tabular-nums",
          selectedCount > 0
            ? "border border-[#adc5ff] bg-[#e5edff] text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
            : "border border-[#e3e6ed] bg-[#f5f7fa] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]",
        )}
      >
        {selectedCount} {selectedLabel || "selected"}
      </span>

      <select
        value={bulkAction}
        onChange={(e) => onBulkActionChange(e.target.value)}
        aria-label={actionPlaceholder || "Bulk action"}
        className="ai-input h-8 w-full min-w-0 py-1 text-xs sm:w-44"
      >
        <option value="">{actionPlaceholder || "Bulk action..."}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRequestSelected}
        className={cn(
          "h-8 px-3 text-xs",
          isDanger
            ? "inline-flex items-center rounded-lg border border-[#f48270] bg-white font-semibold text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/40 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
            : "ai-btn-secondary",
        )}
      >
        {applySelectedLabel} ({selectedCount})
      </button>

      {onRequestAll && applyAllLabel && (
        <button
          type="button"
          onClick={onRequestAll}
          className={cn(
            "h-8 px-3 text-xs",
            isDanger
              ? "inline-flex items-center rounded-lg border border-[#f48270]/70 bg-white font-semibold text-[#b81800] transition-colors hover:bg-[#ffe0db]/50 dark:border-[#fa3b1d]/35 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
              : "ai-btn-secondary",
          )}
        >
          {applyAllLabel}
        </button>
      )}
    </div>
  );
}

export interface ExpertConfirmModalConfig {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "rose" | "indigo";
  formAction: string;
  csrfToken: string;
  hiddenFields?: Array<{ name: string; value: string }>;
}

export function ExpertConfirmModal({
  config,
  onClose,
}: {
  config: ExpertConfirmModalConfig | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!config) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [config, onClose]);

  if (!config) return null;
  const isDanger = (config.tone || "rose") === "rose";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f111a]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expert-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ai-surface animate-fade-in-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#cbd0dd] bg-white shadow-2xl dark:border-[#373e53] dark:bg-[#141824]">
        <div className="flex items-start gap-3.5 p-4 sm:p-5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isDanger
                ? "bg-[#ffe0db] text-[#b81800] ring-1 ring-[#fa3b1d]/25 dark:bg-[#fa3b1d]/15 dark:text-[#ff8f7d]"
                : "bg-[#e5edff] text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="expert-confirm-title"
              className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
            >
              {config.title}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
              {config.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={config.cancelLabel || "Cancel"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a94ad] transition hover:bg-[#eff2f6] hover:text-[#141824] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          method="POST"
          action={config.formAction}
          className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#e3e6ed] bg-[#f5f7fa] px-4 py-3 dark:border-[#2b3245] dark:bg-[#0f111a] sm:px-5 sm:py-3.5"
        >
          <input type="hidden" name="csrf_token" value={config.csrfToken} />
          {(config.hiddenFields || []).map((f, idx) => (
            <input key={`${f.name}-${idx}`} type="hidden" name={f.name} value={f.value} />
          ))}
          <button type="button" onClick={onClose} className="ai-btn-secondary h-9 px-3.5 text-xs">
            {config.cancelLabel || "Cancel"}
          </button>
          <button
            type="submit"
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-white transition-colors focus:outline-none focus:ring-2",
              isDanger
                ? "bg-[#fa3b1d] hover:bg-[#d92d12] focus:ring-[#fa3b1d]/30"
                : "bg-[#3874ff] hover:bg-[#004dff] focus:ring-[#3874ff]/30",
            )}
          >
            {config.confirmLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
