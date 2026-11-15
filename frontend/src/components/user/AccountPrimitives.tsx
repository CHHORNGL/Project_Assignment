import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountTone = "blue" | "emerald" | "amber" | "slate";

const TONE_CLASSES: Record<AccountTone, string> = {
  blue: "border-[#adc5ff]/70 bg-[#e5edff] text-[#004dff] dark:border-[#3874ff]/30 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]",
  emerald:
    "border-[#90d67f]/70 bg-[#d9fbd0] text-[#1c6c09] dark:border-[#25b003]/35 dark:bg-[#25b003]/15 dark:text-[#7ee864]",
  amber:
    "border-[#ffcc85]/80 bg-[#ffefca] text-[#bc3803] dark:border-[#e5780b]/35 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]",
  slate:
    "border-[#cbd0dd] bg-[#eff2f6] text-[#525b75] dark:border-[#373e53] dark:bg-[#1e2436] dark:text-[#9fa6bc]",
};

/**
 * Clean bordered card container with consistent header hierarchy and staggered entry animation.
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
      className={cn("ai-surface ai-stagger overflow-hidden", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] px-5 py-4 dark:border-[#2b3245]">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                TONE_CLASSES[tone],
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold tracking-tight text-[#141824] dark:text-[#eff2f6]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * Accessible toggle switch pill shared between form checkboxes and instant async security switches.
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
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200",
        checked
          ? "border-[#3874ff] bg-[#3874ff]"
          : "border-[#cbd0dd] bg-[#e3e6ed] dark:border-[#373e53] dark:bg-[#1e2436]",
        disabled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      >
        {busy && <Loader2 className="h-2.5 w-2.5 animate-spin text-[#3874ff]" />}
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
        <span className="rounded-full peer-focus-visible:ring-4 peer-focus-visible:ring-[#3874ff]/20">
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
      className="inline-flex cursor-pointer items-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3874ff]/25 disabled:cursor-not-allowed"
    >
      {track}
    </button>
  );
}
