import React from "react";
import { History, Home, ScanLine, Sparkles, User } from "lucide-react";
import type { FarmerBottomNavId, FarmerBottomNavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const TAB_ICON_MAP: Record<FarmerBottomNavId, React.ComponentType<{ className?: string }>> = {
  home: Home,
  diagnose: ScanLine,
  "ask-ai": Sparkles,
  history: History,
  profile: User,
};

export function FarmerBottomNav({
  items,
  ariaLabel = "Farmer navigation",
}: {
  items: FarmerBottomNavItem[];
  ariaLabel?: string;
}) {
  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
      <nav
        aria-label={ariaLabel}
        className="pointer-events-auto mx-auto flex w-full max-w-xl items-center justify-around gap-1 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_-6px_28px_-8px_rgba(15,23,42,0.14),0_12px_32px_-8px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-800/90 dark:bg-obsidian-900/95 dark:shadow-[0_14px_38px_-6px_rgba(0,0,0,0.72)]"
      >
        {items.map((item) => {
          const Icon = TAB_ICON_MAP[item.id];
          const isAskAi = item.id === "ask-ai";
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 transition-all duration-150",
                item.active
                  ? "bg-indigo-50/95 text-indigo-600 ring-1 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/25"
                  : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-obsidian-800/80 dark:hover:text-slate-100",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-0.5 w-5 rounded-full transition-all duration-150",
                  item.active
                    ? "bg-indigo-600 opacity-100 dark:bg-indigo-400"
                    : "bg-transparent opacity-0",
                )}
              />
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105",
                  isAskAi && !item.active && "text-indigo-500 dark:text-indigo-400",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[10.5px] leading-tight sm:text-[11px]",
                  item.active ? "font-bold" : "font-semibold",
                )}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
