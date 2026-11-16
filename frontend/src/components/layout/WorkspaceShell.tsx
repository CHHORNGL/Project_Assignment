import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Sparkles,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { buildFarmerBottomNav } from "@/lib/navigation";
import {
  getNotificationHref,
  getNotificationMessage,
  getNotificationTimeLabel,
  isNotificationRead,
} from "@/lib/notificationHelpers";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { AppsGridMenu } from "./AppsGridMenu";
import { FarmerBottomNav } from "./FarmerBottomNav";
import { PhoenixWorkspaceShell } from "./PhoenixWorkspaceShell";

export interface ShellNavItem {
  label: string;
  href: string;
  active?: boolean;
  badge?: string | number;
}

export interface ShellNavSection {
  title: string;
  items: ShellNavItem[];
}

export function WorkspaceShell({
  bootstrap,
  navSections = [],
  pageTitle,
  pageSubtitle,
  headerActions,
  children,
}: {
  bootstrap: AppBootstrap<any>;
  navSections?: ShellNavSection[];
  pageTitle?: string;
  pageSubtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPhoenixWorkspace =
    bootstrap.page.scope === "admin" ||
    bootstrap.page.scope === "expert" ||
    bootstrap.path.startsWith("/admin") ||
    bootstrap.path.startsWith("/expert");

  useEffect(() => {
    if (isPhoenixWorkspace) return undefined;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isPhoenixWorkspace]);

  const bottomNavItems = useMemo(
    () => (isPhoenixWorkspace ? [] : buildFarmerBottomNav(bootstrap)),
    [bootstrap, isPhoenixWorkspace],
  );

  // Exclude the 5 primary Bottom Navigation hrefs from the secondary Explore menu to avoid duplication
  const extraSections = useMemo(() => {
    const primaryHrefs = new Set(bottomNavItems.map((item) => item.href.split("?")[0]));
    return navSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => !primaryHrefs.has(item.href)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [navSections, bottomNavItems]);

  if (isPhoenixWorkspace) {
    return (
      <PhoenixWorkspaceShell
        bootstrap={bootstrap}
        navSections={navSections}
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        headerActions={headerActions}
      >
        {children}
      </PhoenixWorkspaceShell>
    );
  }

  const isKhmer = bootstrap.lang === "km";
  const unreadCount = bootstrap.notifications?.unreadCount || 0;
  const notifItems = bootstrap.notifications?.items || [];
  const brandHref = bootstrap.user?.id ? "/farmer/dashboard" : bootstrap.urls.home || "/";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-obsidian-950 dark:text-slate-100">
      {/* Compact Full-Width Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-obsidian-950/85">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <a href={brandHref} className="flex shrink-0 items-center gap-2.5">
              <img
                src={bootstrap.urls.logoLight || "/static/img/newlogo.svg"}
                alt="Agri System"
                className="h-7 w-7 dark:hidden"
              />
              <img
                src={bootstrap.urls.logoDark || "/static/img/newlogo-dark.svg"}
                alt="Agri System"
                className="hidden h-7 w-7 dark:block"
              />
              <span className="font-display text-sm font-bold tracking-tight">AGRI SYSTEM</span>
            </a>

            {pageTitle && (
              <>
                <span
                  aria-hidden="true"
                  className="hidden h-5 w-px bg-slate-200 dark:bg-slate-800 sm:block"
                />
                <div className="hidden min-w-0 sm:block">
                  <h1 className="truncate font-display text-sm font-bold tracking-tight md:text-base">
                    {pageTitle}
                  </h1>
                  {pageSubtitle && (
                    <p className="hidden truncate text-[11px] text-slate-500 dark:text-slate-400 lg:block">
                      {pageSubtitle}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {headerActions}

            <button
              type="button"
              onClick={() => setAiOpen((prev) => !prev)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 text-xs font-semibold text-indigo-600 transition-all hover:bg-indigo-500/20 dark:text-indigo-300"
              aria-label={isKhmer ? "ជំនួយការ AI" : "AI Copilot"}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isKhmer ? "ជំនួយការ AI" : "AI Copilot"}</span>
            </button>

            <LanguageSwitcher
              lang={bootstrap.lang}
              enUrl={bootstrap.urls.updateLanguageEn}
              kmUrl={bootstrap.urls.updateLanguageKm}
            />
            <ThemeToggle />

            {/* Notifications Dropdown */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setMenuOpen(false);
                }}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-slate-600 shadow-sm hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-900 dark:text-slate-300"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="ai-surface animate-slide-down absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {isKhmer ? "ការជូនដំណឹង" : "Notifications"}
                      </span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {bootstrap.notifications?.link && (
                      <a
                        href={bootstrap.notifications.link}
                        className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {isKhmer ? "មើលទាំងអស់" : "View all"}
                      </a>
                    )}
                  </div>
                  {notifItems.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-slate-500">
                      {isKhmer ? "មិនមានការជូនដំណឹងថ្មីទេ។" : "You're all caught up."}
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                      {notifItems.map((n) => {
                        const msg = getNotificationMessage(n);
                        const href = getNotificationHref(n) || bootstrap.notifications?.link || "#";
                        const read = isNotificationRead(n);
                        const timeLabel = getNotificationTimeLabel(n, isKhmer);
                        return (
                          <li key={n.id}>
                            <a
                              href={href}
                              className="block rounded-xl p-2.5 text-xs transition-colors hover:bg-slate-100 dark:hover:bg-obsidian-800"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {!read && (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                                  )}
                                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                                    {n.title}
                                  </p>
                                </div>
                                {timeLabel && (
                                  <span className="shrink-0 text-[10px] text-slate-400">
                                    {timeLabel}
                                  </span>
                                )}
                              </div>
                              {msg && (
                                <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                                  {msg}
                                </p>
                              )}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Workspace Apps Grid Launcher */}
            <AppsGridMenu
              bootstrap={bootstrap}
              extraSections={extraSections}
              open={menuOpen}
              unreadCount={unreadCount}
              isKhmer={isKhmer}
              menuRef={menuRef}
              onToggle={() => {
                setMenuOpen((prev) => !prev);
                setNotifOpen(false);
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area (padded above persistent Bottom Navigation) */}
      <main className="ai-enter mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:px-6">
        {pageTitle && (
          <div className="mb-4 sm:hidden">
            <h1 className="font-display text-lg font-bold tracking-tight">{pageTitle}</h1>
            {pageSubtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{pageSubtitle}</p>
            )}
          </div>
        )}
        {children}
      </main>

      {/* Persistent Farmer Bottom Navigation */}
      <FarmerBottomNav
        items={bottomNavItems}
        ariaLabel={isKhmer ? "ការរុករកកសិករ" : "Farmer navigation"}
      />

      {/* Floating AI Copilot & Live Support drawer positioned above Bottom Nav */}
      <AiCopilotDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        isKhmer={isKhmer}
        enableLiveSupport={bootstrap.page.scope === "farmer" && Boolean(bootstrap.user?.id)}
        currentUserId={bootstrap.user?.id ?? null}
        csrfToken={bootstrap.csrfToken}
        scope={bootstrap.page.scope}
        userName={bootstrap.user?.full_name || bootstrap.user?.username}
        bottomOffsetClass="bottom-24 right-4 sm:bottom-24 sm:right-5"
      />
    </div>
  );
}
