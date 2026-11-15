import React, { useState } from "react";
import {
  Menu,
  X,
  Bell,
  LogOut,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { PhoenixWorkspaceShell } from "./PhoenixWorkspaceShell";
import { cn } from "@/lib/utils";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const isPhoenixWorkspace =
    bootstrap.page.scope === "admin" ||
    bootstrap.page.scope === "expert" ||
    bootstrap.path.startsWith("/admin") ||
    bootstrap.path.startsWith("/expert");

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-obsidian-950 dark:text-slate-100">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-68 flex-col border-r border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-slate-800/80 dark:bg-obsidian-900/95 lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200/70 px-5 dark:border-slate-800/70">
          <a href={bootstrap.urls.home || "/"} className="flex items-center gap-2.5">
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
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
              AI
            </span>
          </a>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 py-5">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <a
                    key={`${section.title}-${item.href}`}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      item.active
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20"
                        : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-obsidian-800 dark:hover:text-white",
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                          item.active
                            ? "bg-white/20 text-white"
                            : "bg-slate-200 text-slate-700 dark:bg-obsidian-800 dark:text-slate-300",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          item.active
                            ? "translate-x-0.5 opacity-90"
                            : "opacity-40 group-hover:translate-x-0.5 group-hover:opacity-75",
                        )}
                      />
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200/70 p-4 dark:border-slate-800/70">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-100/80 p-3 dark:bg-obsidian-850">
            <img
              src={bootstrap.user.avatar_url || "/static/img/avatar.png"}
              alt={bootstrap.user.full_name}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-indigo-500/20"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{bootstrap.user.full_name || bootstrap.user.username}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {bootstrap.user.email || bootstrap.user.roles.join(", ")}
              </p>
            </div>
            {bootstrap.urls.logout && (
              <a
                href={bootstrap.urls.logout}
                title={isKhmer ? "ចាកចេញ" : "Logout"}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              >
                <LogOut className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-col transition-[padding] duration-300 ease-out lg:pl-68">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl dark:border-slate-800/70 dark:bg-obsidian-950/80 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-obsidian-800 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            {pageTitle && (
              <div>
                <h1 className="font-display text-base font-bold tracking-tight sm:text-lg">{pageTitle}</h1>
                {pageSubtitle && (
                  <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
                    {pageSubtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={() => setAiOpen((prev) => !prev)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 text-xs font-semibold text-indigo-600 transition-all hover:bg-indigo-500/20 dark:text-indigo-300"
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
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
                <div className="ai-surface animate-slide-down origin-top-right absolute right-0 mt-2 w-80 p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {isKhmer ? "ការជូនដំណឹង" : "Notifications"}
                    </span>
                    {bootstrap.notifications?.link && (
                      <a
                        href={bootstrap.notifications.link}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
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
                    <ul className="space-y-1.5">
                      {notifItems.map((n) => (
                        <li key={n.id}>
                          <a
                            href={n.link || bootstrap.notifications?.link || "#"}
                            className="block rounded-xl p-2 text-xs transition-colors hover:bg-slate-100 dark:hover:bg-obsidian-800"
                          >
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                              {n.message}
                            </p>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="ai-enter mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      {/* Floating AI Copilot drawer */}
      <AiCopilotDrawer open={aiOpen} onClose={() => setAiOpen(false)} isKhmer={isKhmer} />
    </div>
  );
}
