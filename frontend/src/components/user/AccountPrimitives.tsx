import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccountTone = "blue" | "emerald" | "amber" | "slate" | "rose";

export const ACCOUNT_TONE_CLASSES: Record<AccountTone, string> = {
  blue: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  slate: "border-slate-300/60 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-obsidian-800 dark:text-slate-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

/**
 * iOS/Android-style uppercase grouped section label rendered above account cards.
 */
export function MobileSectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2 pb-1.5">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {children}
      </h2>
      {right}
    </div>
  );
}

/**
 * Clean mobile-platform card container with rounded-3xl corners and header hierarchy.
 */
export function AccountSectionCard({
  title,
  subtitle,
  icon,
  tone = "blue",
  action,
  delayIndex = 0,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: AccountTone;
  action?: React.ReactNode;
  delayIndex?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      style={{ ["--stagger" as string]: delayIndex }}
      className={cn(
        "ai-stagger overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:border-slate-800 dark:bg-obsidian-900",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/75 px-4 py-3.5 dark:border-slate-800 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                ACCOUNT_TONE_CLASSES[tone],
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * Native-style toggle switch shared between form checkboxes and instant async security switches.
 */
export function AccountSwitch({
  checked,
  disabled = false,
  busy = false,
  label,
  name,
  value = "y",
  onChange,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  name?: string;
  value?: string;
  onChange?: (next: boolean) => void;
  onClick?: () => void;
}) {
  const track = (
    <span
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200",
        checked
          ? "border-emerald-500 bg-emerald-500"
          : "border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-obsidian-800",
        disabled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[23px]" : "translate-x-[3px]",
        )}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />}
      </span>
    </span>
  );

  if (name) {
    return (
      <span className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span className="rounded-full peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/20">
          {track}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onClick}
      className="inline-flex cursor-pointer items-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 disabled:cursor-not-allowed"
    >
      {track}
    </button>
  );
}
