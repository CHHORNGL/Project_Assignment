import React from "react";
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  Compass,
  Headphones,
  Info,
  LayoutGrid,
  LogOut,
  MonitorSmartphone,
  Newspaper,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  UserCircle,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import type { ShellNavSection } from "./WorkspaceShell";
import { cn } from "@/lib/utils";

type AppTileTone = "indigo" | "emerald" | "amber" | "sky" | "rose" | "violet" | "slate";

const TILE_TONE_CLASSES: Record<AppTileTone, string> = {
  indigo:
    "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-500/15 dark:text-indigo-300",
  emerald:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/15 dark:text-rose-300",
  violet:
    "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-300",
  slate:
    "border-slate-300/70 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-obsidian-800 dark:text-slate-300",
};

function resolveAppTileMeta(href: string): {
  Icon: React.ComponentType<{ className?: string }>;
  tone: AppTileTone;
  isNotification?: boolean;
} {
  const lower = href.toLowerCase();
  if (lower.includes("/diagnose")) return { Icon: Stethoscope, tone: "sky" };
  if (lower.includes("/diseases")) return { Icon: BookOpen, tone: "emerald" };
  if (lower.includes("/news")) return { Icon: Newspaper, tone: "indigo" };
  if (lower.includes("/detail")) return { Icon: Info, tone: "violet" };
  if (lower.includes("/rule-inference")) return { Icon: ClipboardCheck, tone: "indigo" };
  if (lower.includes("/notifications")) return { Icon: Bell, tone: "rose", isNotification: true };
  if (lower.includes("/settings")) return { Icon: SlidersHorizontal, tone: "slate" };
  if (lower.includes("/profile")) return { Icon: UserCircle, tone: "indigo" };
  if (lower.includes("/live-chat") || lower.includes("/support_chat")) {
    return { Icon: Headphones, tone: "emerald" };
  }
  if (lower.includes("/chat")) return { Icon: Sparkles, tone: "sky" };
  return { Icon: Compass, tone: "slate" };
}

export function AppsGridMenu({
  bootstrap,
  extraSections,
  open,
  unreadCount,
  isKhmer,
  menuRef,
  onToggle,
}: {
  bootstrap: AppBootstrap<any>;
  extraSections: ShellNavSection[];
  open: boolean;
  unreadCount: number;
  isKhmer: boolean;
  menuRef: React.RefObject<HTMLDivElement>;
  onToggle: () => void;
}) {
  if (extraSections.length === 0 && !bootstrap.urls.logout) {
    return null;
  }

  const seenKeys = new Set<string>();
  const flattenedApps = extraSections
    .flatMap((section) =>
      section.items.map((item) => ({
        ...item,
        sectionTitle: section.title,
      })),
    )
    .filter((item) => {
      const normalized = (item.href || "").split("#")[0].replace(/\/+$/, "").toLowerCase();
      const key = normalized.endsWith("/notifications") ? "/notifications" : normalized;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

  const profileHref = bootstrap.urls.profile || "/users/profile";
  const displayName = bootstrap.user?.full_name || bootstrap.user?.username || "AGRI SYSTEM";
  const subtitleText = bootstrap.user?.email || bootstrap.user?.roles?.join(", ") || "";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={isKhmer ? "កម្មវិធី និងម៉ឺនុយ" : "Workspace Apps"}
        title={isKhmer ? "កម្មវិធី និងម៉ឺនុយ" : "Workspace Apps"}
        className={cn(
          "group inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold shadow-sm backdrop-blur-md transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 xl:w-auto xl:gap-1.5 xl:px-3",
          open
            ? "border-indigo-500 bg-indigo-600 text-white ring-4 ring-indigo-500/15"
            : "border-slate-200/85 bg-white/90 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-900/90 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:text-indigo-300",
        )}
      >
        <LayoutGrid
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-150",
            open ? "scale-95" : "group-hover:scale-105",
          )}
        />
        <span className="hidden xl:inline">{isKhmer ? "កម្មវិធី" : "Apps"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="animate-slide-down fixed inset-x-3 top-[4.25rem] z-50 origin-top overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-obsidian-900/95 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2.5 sm:w-[min(calc(100vw-1.5rem),21.5rem)] sm:origin-top-right"
        >
          {/* User Identity Strip */}
          {bootstrap.user?.id && (
            <div className="mb-3 flex items-center justify-between gap-2.5 rounded-2xl border border-slate-200/75 bg-slate-50/90 p-2.5 dark:border-slate-800 dark:bg-obsidian-950/75">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src={bootstrap.user.avatar_url || "/static/img/avatar.png"}
                  alt={displayName}
                  onError={(e) => {
                    e.currentTarget.src = "/static/img/avatar.png";
                  }}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-obsidian-800"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {displayName}
                  </p>
                  {subtitleText && (
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {subtitleText}
                    </p>
                  )}
                </div>
              </div>

              <a
                href={profileHref}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-obsidian-900 dark:text-slate-200"
              >
                <UserCircle className="h-3.5 w-3.5 text-indigo-500" />
                <span>{isKhmer ? "គណនី" : "Account"}</span>
              </a>
            </div>
          )}

          {/* Header Micro-Label */}
          {flattenedApps.length > 0 && (
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {isKhmer ? "ឧបករណ៍ និងមុខងារបន្ថែម" : "Quick Apps & Tools"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 dark:bg-obsidian-800 dark:text-slate-400">
                {flattenedApps.length}
              </span>
            </div>
          )}

          {/* 3-Column Visual App Grid */}
          {flattenedApps.length > 0 && (
            <div className="grid max-h-[calc(100dvh-13.5rem)] grid-cols-3 gap-2 overflow-y-auto py-0.5 sm:max-h-[20rem]">
              {flattenedApps.map((item) => {
                const { Icon, tone, isNotification } = resolveAppTileMeta(item.href);
                const showUnread = Boolean(isNotification && unreadCount > 0);
                return (
                  <a
                    key={`${item.sectionTitle}-${item.href}`}
                    href={item.href}
                    role="menuitem"
                    className={cn(
                      "group relative flex flex-col items-center justify-start gap-2 rounded-2xl border p-2.5 text-center transition-all duration-150 hover:-translate-y-0.5",
                      item.active
                        ? "border-indigo-500/40 bg-indigo-50/75 text-indigo-700 ring-2 ring-indigo-500/15 dark:border-indigo-400/35 dark:bg-indigo-500/15 dark:text-indigo-200"
                        : "border-transparent bg-slate-50/70 text-slate-700 hover:border-slate-200 hover:bg-white hover:shadow-sm dark:bg-obsidian-950/55 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-obsidian-850",
                    )}
                  >
                    <span
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-2xl border transition-transform duration-150 group-hover:scale-105",
                        TILE_TONE_CLASSES[tone],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {showUnread && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold text-white ring-2 ring-white dark:ring-obsidian-900">
                          {unreadCount}
                        </span>
                      )}
                    </span>

                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight">
                      {item.label}
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Footer Bar */}
          {bootstrap.user?.id && bootstrap.urls.logout && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/75 pt-2.5 dark:border-slate-800">
              <a
                href={bootstrap.urls.loginActivity || "/users/login-activity"}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-obsidian-800"
              >
                <MonitorSmartphone className="h-3.5 w-3.5 text-slate-400" />
                <span>{isKhmer ? "ឧបករណ៍" : "Devices"}</span>
              </a>
              <a
                href={bootstrap.urls.logout}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/35 dark:text-rose-400 dark:hover:bg-rose-950/55"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{isKhmer ? "ចាកចេញ" : "Sign Out"}</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
