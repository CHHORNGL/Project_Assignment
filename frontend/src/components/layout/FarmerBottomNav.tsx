import React from "react";
import {
  History,
  Home,
  ScanLine,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import type { FarmerBottomNavId, FarmerBottomNavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const TAB_ICON_MAP: Record<FarmerBottomNavId, LucideIcon> = {
  home: Home,
  diagnose: ScanLine,
  "ask-ai": Sparkles,
  history: History,
  profile: User,
};

function AiOrbGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Voice / AI vertical equalizer bars paired with 4-point sparkle star */}
      <rect x="4" y="10" width="2.2" height="5" rx="1.1" fill="currentColor" />
      <rect x="8.1" y="6" width="2.2" height="12" rx="1.1" fill="currentColor" />
      <rect x="12.2" y="8.2" width="2.2" height="9.2" rx="1.1" fill="currentColor" />
      <rect x="16.3" y="10.2" width="2.2" height="4.6" rx="1.1" fill="currentColor" />
      <path
        d="M18.6 3.5L19.3 5.7L21.5 6.4L19.3 7.1L18.6 9.3L17.9 7.1L15.7 6.4L17.9 5.7L18.6 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FarmerBottomNav({
  items,
  ariaLabel = "Farmer navigation",
}: {
  items: FarmerBottomNavItem[];
  ariaLabel?: string;
}) {
  if (!items.length) return null;

  const askAiItem = items.find((item) => item.id === "ask-ai") || null;
  const dockItems = askAiItem
    ? items.filter((item) => item.id !== "ask-ai")
    : items;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
      <nav
        aria-label={ariaLabel}
        className="pointer-events-auto mx-auto flex w-full max-w-[440px] items-center gap-2.5 sm:max-w-[480px] sm:gap-3"
      >
        {/* Left Floating Frosted Pill Dock */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/95 p-1 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.16),0_2px_10px_-3px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-slate-800/90 dark:bg-obsidian-900/95 dark:shadow-[0_18px_42px_-10px_rgba(0,0,0,0.75)] sm:gap-1 sm:p-1.5">
          {dockItems.map((item) => {
            const Icon = TAB_ICON_MAP[item.id];
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1.5 py-2 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-2",
                  item.active
                    ? "bg-[#f1f3f5] text-slate-950 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85),0_1px_2px_rgba(15,23,42,0.06)] dark:bg-white/[0.12] dark:text-white dark:ring-1 dark:ring-white/15 dark:shadow-none"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center transition-transform duration-150 group-hover:scale-105">
                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={item.active ? 2.25 : 1.75}
                  />
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-[10px] leading-tight sm:text-[11px]",
                    item.active ? "font-bold" : "font-medium",
                  )}
                >
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>

        {/* Right Standalone Circular AI Action Orb */}
        {askAiItem && (
          <a
            href={askAiItem.href}
            title={askAiItem.label}
            aria-label={askAiItem.label}
            aria-current={askAiItem.active ? "page" : undefined}
            className={cn(
              "group flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/35 sm:h-[64px] sm:w-[64px]",
              askAiItem.active
                ? "bg-indigo-600 text-white shadow-[0_14px_32px_-6px_rgba(79,70,229,0.5)] ring-4 ring-indigo-500/25 dark:bg-indigo-500 dark:ring-indigo-400/30"
                : "bg-[#0b0d12] text-white shadow-[0_14px_32px_-8px_rgba(11,13,18,0.48)] hover:scale-[1.04] hover:bg-[#171b24] active:scale-[0.96] dark:bg-white dark:text-[#0b0d12] dark:shadow-[0_14px_32px_-8px_rgba(0,0,0,0.75)] dark:hover:bg-slate-100",
            )}
          >
            <AiOrbGlyph className="h-6 w-6 transition-transform duration-150 group-hover:scale-105" />
            <span className="sr-only">{askAiItem.label}</span>
          </a>
        )}
      </nav>
    </div>
  );
}
