import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SkeletonVariant = "rounded" | "text" | "circular" | "rectangular";

export interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;
  phoenix?: boolean;
  style?: React.CSSProperties;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  rounded: "rounded-xl",
  text: "h-3 rounded-full",
  circular: "rounded-full",
  rectangular: "rounded-none",
};

/**
 * Reusable shimmer skeleton primitive adapted to both standard Slate/Obsidian
 * and Phoenix Admin/Expert light & dark surfaces.
 */
export function Skeleton({
  className,
  variant = "rounded",
  phoenix = false,
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "sk-shimmer",
        phoenix && "sk-phoenix",
        VARIANT_CLASSES[variant],
        className,
      )}
    />
  );
}

export function SkeletonText({
  lines = 3,
  phoenix = false,
  className,
  lineClassName,
  lastLineWidth = "w-2/3",
}: {
  lines?: number;
  phoenix?: boolean;
  className?: string;
  lineClassName?: string;
  lastLineWidth?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, idx) => {
        const isLast = idx === lines - 1 && lines > 1;
        return (
          <Skeleton
            key={idx}
            variant="text"
            phoenix={phoenix}
            className={cn(isLast ? lastLineWidth : "w-full", lineClassName)}
          />
        );
      })}
    </div>
  );
}

/**
 * Progressive image wrapper displaying a matching shimmer skeleton until load completes.
 */
export function SkeletonImage({
  src,
  alt,
  className,
  wrapperClassName,
  skeletonClassName,
  phoenix = false,
  loading = "lazy",
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  skeletonClassName?: string;
  phoenix?: boolean;
  loading?: "lazy" | "eager";
  onError?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden", wrapperClassName)}>
      {!loaded && (
        <Skeleton
          variant="rectangular"
          phoenix={phoenix}
          className={cn("absolute inset-0 h-full w-full", skeletonClassName)}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(true);
          onError?.();
        }}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </div>
  );
}

/**
 * Matches WeatherIntelligenceCard's 3-column grid (Hero Conditions, Smart Alerts, 7-Day Outlook).
 */
export function WeatherIntelligenceSkeleton({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || "Loading weather intelligence"}
      className="grid gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-3"
    >
      <span className="sr-only">{label || "Loading weather intelligence"}</span>

      {/* Column 1: Current Conditions Hero + 24h/7d Analytics */}
      <div className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/70 p-4 dark:border-indigo-500/20 dark:bg-indigo-950/30 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="w-full space-y-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton variant="circular" className="h-9 w-9 shrink-0" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-indigo-200/50 pt-3 dark:border-indigo-500/20">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton variant="text" className="h-2.5 w-14" />
                <Skeleton className="h-3.5 w-12" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800"
            >
              <Skeleton variant="text" className="h-2.5 w-16" />
              <Skeleton className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Column 2: Smart Alerts + Agronomy Recommendations */}
      <div className="min-w-0 space-y-4">
        <Skeleton variant="text" className="h-3 w-28" />
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <Skeleton variant="circular" className="h-4 w-4 shrink-0" />
                <Skeleton variant="text" className="h-3 w-36" />
              </div>
              <SkeletonText lines={2} className="mt-2.5" lastLineWidth="w-4/5" />
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-1">
          <Skeleton variant="text" className="h-3 w-40" />
          <SkeletonText lines={3} lastLineWidth="w-3/4" />
        </div>
      </div>

      {/* Column 3: 7-Day Outlook */}
      <div className="min-w-0 space-y-3">
        <Skeleton variant="text" className="h-3 w-28" />
        <div className="divide-y divide-slate-200/70 rounded-xl border border-slate-200/80 dark:divide-slate-800/70 dark:border-slate-800">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <div key={day} className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-3.5">
              <Skeleton variant="text" className="h-3 w-24" />
              <Skeleton variant="text" className="h-3 w-10" />
              <Skeleton variant="text" className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Matches AdminWorldPage Station Telemetry 2-column metric grid.
 */
export function StationTelemetrySkeleton({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || "Loading station telemetry"}
      className="space-y-4"
    >
      <span className="sr-only">{label || "Loading station telemetry"}</span>
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/65"
          >
            <div className="flex items-center justify-between">
              <Skeleton variant="text" phoenix className="h-2.5 w-16" />
              <Skeleton variant="circular" phoenix className="h-4 w-4" />
            </div>
            <Skeleton phoenix className="mt-2.5 h-6 w-20 rounded-lg" />
            <Skeleton variant="text" phoenix className="mt-2 h-2.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Matches FarmerNewsPage Featured Dispatch + 2-column Grid Article cards.
 */
export function NewsFeedSkeleton({ label, count = 4 }: { label?: string; count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || "Loading latest agronomy briefings"}
      className="space-y-5"
    >
      <span className="sr-only">{label || "Loading latest agronomy briefings"}</span>

      {/* Featured Article Skeleton */}
      <div className="ai-surface grid min-w-0 overflow-hidden lg:grid-cols-12">
        <Skeleton
          variant="rectangular"
          className="h-56 w-full lg:col-span-5 lg:h-full lg:min-h-[260px]"
        />
        <div className="flex min-w-0 flex-col justify-between p-4 sm:p-6 lg:col-span-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton variant="text" className="h-3 w-24" />
                <Skeleton variant="text" className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-6 w-11/12 rounded-lg" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <SkeletonText lines={3} className="pt-1" lastLineWidth="w-5/6" />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-200/75 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-32 rounded-xl" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
            <Skeleton variant="text" className="h-3 w-14" />
          </div>
        </div>
      </div>

      {/* Article Grid Skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="ai-surface flex min-w-0 flex-col justify-between overflow-hidden">
            <div>
              <Skeleton variant="rectangular" className="h-44 w-full" />
              <div className="space-y-2.5 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Skeleton variant="text" className="h-2.5 w-20" />
                  <Skeleton variant="text" className="h-2.5 w-14" />
                </div>
                <Skeleton className="h-5 w-11/12 rounded-lg" />
                <Skeleton className="h-5 w-2/3 rounded-lg" />
                <SkeletonText lines={3} className="pt-1" lastLineWidth="w-4/5" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/75 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-24 rounded-lg" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
              <Skeleton variant="text" className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Alternating left/right message bubbles for Live Chat & Support drawers.
 */
export function ChatThreadSkeleton({
  count = 5,
  phoenix = false,
  compact = false,
  label,
}: {
  count?: number;
  phoenix?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const widths = [
    ["w-44", "w-32"],
    ["w-36"],
    ["w-52", "w-44", "w-28"],
    ["w-40", "w-24"],
    ["w-48", "w-36"],
  ];

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || "Loading conversation"}
      className={cn("flex flex-col justify-end", compact ? "space-y-3 py-2" : "space-y-3.5 py-2")}
    >
      <span className="sr-only">{label || "Loading conversation"}</span>
      {Array.from({ length: count }).map((_, idx) => {
        const isOutgoing = idx % 2 === 1;
        const lines = widths[idx % widths.length];
        return (
          <div
            key={idx}
            className={cn("flex flex-col gap-1", isOutgoing ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[82%] space-y-2 rounded-2xl px-3.5 py-3",
                isOutgoing
                  ? phoenix
                    ? "rounded-br-md border border-[#3874ff]/20 bg-[#3874ff]/10 dark:border-[#3874ff]/25 dark:bg-[#3874ff]/15"
                    : "rounded-br-md border border-emerald-500/20 bg-emerald-500/10"
                  : phoenix
                    ? "rounded-bl-md border border-[#e3e6ed] bg-white dark:border-[#2b3245] dark:bg-[#141824]"
                    : "rounded-bl-md border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-obsidian-900",
              )}
            >
              {lines.map((w, lIdx) => (
                <Skeleton
                  key={lIdx}
                  variant="text"
                  phoenix={phoenix}
                  className={cn(compact ? "h-2.5" : "h-3", w)}
                />
              ))}
            </div>
            <Skeleton variant="text" phoenix={phoenix} className="mx-1 h-2 w-10" />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Streaming shimmer bubble rendered while AI assistant generates a reply.
 */
export function AiThinkingSkeleton({
  label,
  compact = false,
  bubbleClassName,
}: {
  label: string;
  compact?: boolean;
  bubbleClassName?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "min-w-[200px] max-w-[82%] space-y-2.5 rounded-2xl rounded-bl-sm border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-obsidian-900",
        compact ? "px-3.5 py-2.5" : "min-w-[230px] px-4 py-3",
        bubbleClassName,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 [animation-delay:400ms]" />
        </span>
        <span>{label}</span>
      </div>
      <SkeletonText lines={compact ? 2 : 3} lastLineWidth="w-3/5" />
    </div>
  );
}

/**
 * Matches ProfilePage WebAuthn passkeys list rows.
 */
export function PasskeyListSkeleton({ count = 2, label }: { count?: number; label?: string }) {
  return (
    <ul
      role="status"
      aria-busy="true"
      aria-label={label || "Loading passkeys"}
      className="divide-y divide-slate-200/75 overflow-hidden rounded-2xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800"
    >
      <span className="sr-only">{label || "Loading passkeys"}</span>
      {Array.from({ length: count }).map((_, idx) => (
        <li
          key={idx}
          className="flex items-center justify-between gap-3 bg-slate-50/50 px-3.5 py-2.5 dark:bg-obsidian-950/40"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton variant="text" className="h-3 w-36" />
              <Skeleton variant="text" className="h-2.5 w-24" />
            </div>
          </div>
          <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Matches LoginActivityPage signed-in device session cards.
 */
export function LoginActivitySkeleton({ count = 3, label }: { count?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || "Refreshing signed-in devices"}
      className="divide-y divide-slate-200/75 overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-obsidian-900"
    >
      <span className="sr-only">{label || "Refreshing signed-in devices"}</span>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-36 rounded-md" />
                {idx === 0 && <Skeleton className="h-4 w-20 rounded-full" />}
              </div>
              <Skeleton variant="text" className="h-3 w-44" />
              <Skeleton variant="text" className="h-3 w-52" />
              <Skeleton variant="text" className="h-2.5 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 shrink-0 self-end rounded-xl sm:self-center" />
        </div>
      ))}
    </div>
  );
}

/**
 * Scannable KHQR matrix skeleton card matching FarmerCheckoutPage QR box dimensions.
 */
export function QrCodeSkeleton({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || "Generating KHQR code"}
      className="flex h-48 w-48 max-w-full flex-col items-center justify-center rounded-xl bg-slate-50 p-4 dark:bg-slate-900/20 sm:h-60 sm:w-60"
    >
      <span className="sr-only">{label || "Generating KHQR code"}</span>
      <div className="relative grid h-32 w-32 grid-cols-3 gap-2 sm:h-40 sm:w-40">
        <Skeleton className="h-9 w-9 rounded-lg sm:h-11 sm:w-11" />
        <Skeleton className="h-9 w-full rounded-md sm:h-11" />
        <Skeleton className="h-9 w-9 justify-self-end rounded-lg sm:h-11 sm:w-11" />
        <Skeleton className="h-9 w-full rounded-md sm:h-11" />
        <Skeleton className="h-9 w-full rounded-lg sm:h-11" />
        <Skeleton className="h-9 w-full rounded-md sm:h-11" />
        <Skeleton className="h-9 w-9 rounded-lg sm:h-11 sm:w-11" />
        <Skeleton className="col-span-2 h-9 w-full rounded-md sm:h-11" />
      </div>
      {label && (
        <span className="mt-3 text-[11px] font-semibold text-slate-500">{label}</span>
      )}
    </div>
  );
}

/**
 * Sticky live suspects skeleton shown inside DiagnosisWizardPage during evaluation.
 */
export function LiveSuspectsSkeleton({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || "Evaluating disease probabilities"}
      className="space-y-3"
    >
      <span className="sr-only">{label || "Evaluating disease probabilities"}</span>
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-obsidian-950/60"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-6 rounded-md" />
              <Skeleton variant="text" className="h-3.5 w-32" />
            </div>
            <Skeleton variant="text" className="h-3.5 w-10" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <SkeletonText lines={2} lastLineWidth="w-3/4" />
        </div>
      ))}
    </div>
  );
}
