import React from "react";

export type AdminTone = "indigo" | "emerald" | "amber" | "rose" | "sky" | "slate";

const TONE_MAP: Record<
  AdminTone,
  {
    iconBg: string;
    iconText: string;
    badgeBg: string;
    badgeText: string;
    dot: string;
    bar: string;
    stackBg: string;
    bannerBg: string;
  }
> = {
  indigo: {
    iconBg: "bg-[#e5edff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:ring-[#3874ff]/30",
    iconText: "text-[#004dff] dark:text-[#85a9ff]",
    badgeBg: "border border-[#adc5ff] bg-[#e5edff] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15",
    badgeText: "text-[#004dff] dark:text-[#85a9ff]",
    dot: "bg-[#3874ff]",
    bar: "from-[#3874ff] to-[#6091ff]",
    stackBg: "bg-[#d5e3ff] dark:bg-[#1e2d52]",
    bannerBg:
      "border-[#adc5ff] bg-[#e5edff]/75 text-[#003cc7] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15 dark:text-[#b0c8ff]",
  },
  emerald: {
    iconBg: "bg-[#d9fbd0] ring-1 ring-[#25b003]/20 dark:bg-[#25b003]/15 dark:ring-[#25b003]/30",
    iconText: "text-[#1c6c09] dark:text-[#7ee864]",
    badgeBg: "border border-[#90d67f] bg-[#d9fbd0] dark:border-[#25b003]/40 dark:bg-[#25b003]/15",
    badgeText: "text-[#1c6c09] dark:text-[#90ee7a]",
    dot: "bg-[#25b003]",
    bar: "from-[#25b003] to-[#4bc42b]",
    stackBg: "bg-[#c5f5b9] dark:bg-[#1b3a22]",
    bannerBg:
      "border-[#90d67f] bg-[#d9fbd0]/75 text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#a8f294]",
  },
  amber: {
    iconBg: "bg-[#ffefca] ring-1 ring-[#e5780b]/25 dark:bg-[#e5780b]/15 dark:ring-[#e5780b]/35",
    iconText: "text-[#bc3803] dark:text-[#ffbd6b]",
    badgeBg: "border border-[#ffcc85] bg-[#ffefca] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15",
    badgeText: "text-[#bc3803] dark:text-[#ffbd6b]",
    dot: "bg-[#e5780b]",
    bar: "from-[#e5780b] to-[#f49a3c]",
    stackBg: "bg-[#ffe3a6] dark:bg-[#3f2c17]",
    bannerBg:
      "border-[#ffcc85] bg-[#ffefca]/80 text-[#9c3203] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15 dark:text-[#ffd399]",
  },
  rose: {
    iconBg: "bg-[#ffe0db] ring-1 ring-[#fa3b1d]/25 dark:bg-[#fa3b1d]/15 dark:ring-[#fa3b1d]/35",
    iconText: "text-[#b81800] dark:text-[#ff8f7d]",
    badgeBg: "border border-[#f48270] bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15",
    badgeText: "text-[#b81800] dark:text-[#ff9c8c]",
    dot: "bg-[#fa3b1d]",
    bar: "from-[#fa3b1d] to-[#fc6d56]",
    stackBg: "bg-[#ffcdc5] dark:bg-[#492226]",
    bannerBg:
      "border-[#f48270] bg-[#ffe0db]/80 text-[#9e1400] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15 dark:text-[#ffb4a8]",
  },
  sky: {
    iconBg: "bg-[#dcf4ff] ring-1 ring-[#0097eb]/25 dark:bg-[#0097eb]/15 dark:ring-[#0097eb]/30",
    iconText: "text-[#005585] dark:text-[#6fd0ff]",
    badgeBg: "border border-[#7ad3ff] bg-[#dcf4ff] dark:border-[#0097eb]/40 dark:bg-[#0097eb]/15",
    badgeText: "text-[#005585] dark:text-[#7ed4ff]",
    dot: "bg-[#0097eb]",
    bar: "from-[#0097eb] to-[#38b6ff]",
    stackBg: "bg-[#bfe8ff] dark:bg-[#19354a]",
    bannerBg:
      "border-[#7ad3ff] bg-[#dcf4ff]/80 text-[#004f7a] dark:border-[#0097eb]/40 dark:bg-[#0097eb]/15 dark:text-[#a2e1ff]",
  },
  slate: {
    iconBg: "bg-[#eff2f6] ring-1 ring-[#cbd0dd] dark:bg-[#1e2436] dark:ring-[#373e53]",
    iconText: "text-[#525b75] dark:text-[#9fa6bc]",
    badgeBg: "border border-[#cbd0dd] bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#1e2436]",
    badgeText: "text-[#525b75] dark:text-[#9fa6bc]",
    dot: "bg-[#8a94ad]",
    bar: "from-[#6e7891] to-[#8a94ad]",
    stackBg: "bg-[#e3e6ed] dark:bg-[#272f42]",
    bannerBg:
      "border-[#cbd0dd] bg-[#eff2f6] text-[#31374a] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6]",
  },
};

function staggerStyle(delayIndex = 0): React.CSSProperties {
  return { ["--stagger" as string]: delayIndex };
}

export interface PhoenixSummaryItem {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: AdminTone;
  href?: string;
}

/**
 * Cardless horizontal stat strip modeled directly after Phoenix Tailwind v1.3.0 dashboard header metrics.
 */
export function PhoenixSummaryStrip({
  items,
  withDivider = true,
}: {
  items: PhoenixSummaryItem[];
  withDivider?: boolean;
}) {
  return (
    <div className="ai-stagger">
      <div className="flex flex-wrap items-center gap-x-10 gap-y-5 py-2">
        {items.map((item, idx) => {
          const tone = TONE_MAP[item.tone || "indigo"];
          const content = (
            <div className="group flex items-center gap-4">
              <div className="relative h-12 w-12 shrink-0">
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-xl transition-transform duration-200 ease-out -rotate-6 group-hover:-rotate-12 ${tone.stackBg}`}
                />
                <div
                  className={`relative flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 ease-out group-hover:scale-105 ${tone.iconBg} ${tone.iconText}`}
                >
                  {item.icon}
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-display text-2xl font-extrabold leading-tight tracking-tight text-[#141824] tabular-nums dark:text-[#eff2f6]">
                  {item.value}
                </div>
                <div className="mt-0.5 text-sm font-bold text-[#31374a] dark:text-[#cbd0dd]">
                  {item.label}
                </div>
                {item.hint && (
                  <p className="text-xs font-medium text-[#6e7891] dark:text-[#8a94ad]">
                    {item.hint}
                  </p>
                )}
              </div>
            </div>
          );

          if (item.href) {
            return (
              <a key={`${item.label}-${idx}`} href={item.href} className="focus:outline-none">
                {content}
              </a>
            );
          }
          return <div key={`${item.label}-${idx}`}>{content}</div>;
        })}
      </div>
      {withDivider && <hr className="mt-4 border-[#e3e6ed] dark:border-[#2b3245]" />}
    </div>
  );
}

export function AdminKpiCard({
  label,
  value,
  hint,
  icon,
  tone = "indigo",
  badge,
  progress,
  delayIndex = 0,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: AdminTone;
  badge?: string;
  progress?: number;
  delayIndex?: number;
  href?: string;
}) {
  const styles = TONE_MAP[tone];
  const clamped = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  const inner = (
    <div
      style={staggerStyle(delayIndex)}
      className="ai-surface ai-card-hover ai-stagger group relative overflow-hidden p-5"
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6e7891] dark:text-[#8a94ad]">
            {label}
          </div>
          <div className="mt-2 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#141824] tabular-nums dark:text-[#eff2f6]">
            {value}
          </div>
          {hint && <div className="mt-1.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">{hint}</div>}
        </div>
        {icon && (
          <div className="relative h-10 w-10 shrink-0">
            <span
              aria-hidden="true"
              className={`absolute inset-0 rounded-xl -rotate-6 transition-transform duration-200 group-hover:-rotate-12 ${styles.stackBg}`}
            />
            <div
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${styles.iconBg} ${styles.iconText}`}
            >
              {icon}
            </div>
          </div>
        )}
      </div>

      {badge && (
        <div className="relative mt-3">
          <AdminStatusBadge tone={tone}>{badge}</AdminStatusBadge>
        </div>
      )}

      {clamped !== null && (
        <div className="relative mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436]">
          <div
            className={`h-full origin-left animate-progress-fill rounded-full bg-gradient-to-r ${styles.bar}`}
            style={{ width: `${clamped}%` }}
          />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block focus:outline-none">
        {inner}
      </a>
    );
  }
  return inner;
}

export function AdminSectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
  delayIndex = 0,
  noPadding = false,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delayIndex?: number;
  noPadding?: boolean;
}) {
  const hasHeader = Boolean(title || subtitle || icon || action);
  return (
    <section
      style={staggerStyle(delayIndex)}
      className={`ai-surface ai-stagger overflow-hidden ${className}`}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] px-5 py-3.5 dark:border-[#2b3245]">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e5edff] text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff] dark:ring-[#3874ff]/30">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="font-display text-[15px] font-bold tracking-tight text-[#141824] dark:text-[#eff2f6]">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function AdminStatusBadge({
  tone = "slate",
  pulse = false,
  children,
  className = "",
}: {
  tone?: AdminTone;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = TONE_MAP[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${styles.badgeBg} ${styles.badgeText} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${styles.dot}`}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      </span>
      <span>{children}</span>
    </span>
  );
}

export function AdminProgressBar({
  value,
  max = 100,
  tone = "indigo",
  label,
  valueLabel,
  height = "md",
}: {
  value: number;
  max?: number;
  tone?: AdminTone;
  label?: string;
  valueLabel?: string;
  height?: "sm" | "md";
}) {
  const styles = TONE_MAP[tone];
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#525b75] dark:text-[#9fa6bc]">
          <span>{label}</span>
          <span className="font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
            {valueLabel ?? `${Math.round(pct)}%`}
          </span>
        </div>
      )}
      <div
        className={`w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436] ${
          height === "sm" ? "h-1.5" : "h-2"
        }`}
      >
        <div
          className={`h-full origin-left animate-progress-fill rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out ${styles.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AdminSegmentedTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  className = "",
}: {
  tabs: Array<{ id: T; label: string; badge?: string | number; icon?: React.ReactNode }>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#cbd0dd] bg-[#eff2f6] p-1 dark:border-[#373e53] dark:bg-[#0f111a] ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 sm:text-[13px] ${
              active
                ? "bg-white text-[#004dff] shadow-xs ring-1 ring-[#cbd0dd]/80 dark:bg-[#181d2b] dark:text-[#85a9ff] dark:ring-[#373e53]"
                : "text-[#525b75] hover:bg-white/60 hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#181d2b]/70 dark:hover:text-[#eff2f6]"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  active
                    ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                    : "bg-[#e3e6ed] text-[#525b75] dark:bg-[#1e2436] dark:text-[#9fa6bc]"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AdminCollapsePanel({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
      } ${className}`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

export function AdminNoticeBanner({
  tone = "emerald",
  message,
  onDismiss,
}: {
  tone?: AdminTone;
  message: string;
  onDismiss?: () => void;
}) {
  const styles = TONE_MAP[tone];
  return (
    <div
      role="status"
      className={`animate-slide-down flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${styles.bannerBg}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2 py-1 text-xs font-semibold opacity-75 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd0dd] bg-[#f5f7fa]/70 px-6 py-10 text-center dark:border-[#373e53] dark:bg-[#0f111a]/60">
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e5edff] text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
          {icon}
        </div>
      )}
      <div className="font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">{title}</div>
      {description && (
        <p className="mt-1 max-w-md text-xs text-[#6e7891] dark:text-[#8a94ad]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
