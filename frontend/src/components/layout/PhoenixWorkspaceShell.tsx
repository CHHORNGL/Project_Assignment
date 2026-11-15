import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Bug,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileText,
  Globe,
  Headphones,
  Layers,
  LayoutDashboard,
  Languages,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Sprout,
  Stethoscope,
  Tag,
  UserCheck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import type { ShellNavSection } from "./WorkspaceShell";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "agri_phoenix_sidebar_collapsed";

function resolveNavIcon(href: string, label: string) {
  const key = `${href} ${label}`.toLowerCase();
  if (key.includes("/world") || key.includes("world")) return Globe;
  if (key.includes("expert-stats") || key.includes("performance")) return Award;
  if (key.includes("/users") || key.includes("users") || key.includes("farmer")) return Users;
  if (key.includes("/roles") || key.includes("role")) return Shield;
  if (key.includes("audit") || key.includes("log")) return FileText;
  if (key.includes("crop")) return Sprout;
  if (key.includes("disease")) return Bug;
  if (key.includes("marquee") || key.includes("banner")) return Megaphone;
  if (key.includes("promo")) return Tag;
  if (key.includes("support")) return Headphones;
  if (key.includes("chat") || key.includes("reply")) return MessageSquare;
  if (key.includes("premium")) return Layers;
  if (key.includes("translation")) return Languages;
  if (key.includes("setting")) return Settings;
  if (key.includes("pending") || key.includes("diagnos") || key.includes("review")) return ClipboardCheck;
  if (key.includes("knowledge") && key.includes("input")) return Sliders;
  if (key.includes("knowledge")) return BookOpen;
  if (key.includes("symptom")) return Stethoscope;
  if (key.includes("rule")) return Activity;
  if (key.includes("mixed")) return Database;
  if (key.includes("dashboard") || key.endsWith("/admin") || key.endsWith("/expert")) {
    return LayoutDashboard;
  }
  return LayoutDashboard;
}

export function PhoenixWorkspaceShell({
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isKhmer = bootstrap.lang === "km";
  const isAdmin = bootstrap.page.scope === "admin" || bootstrap.path.startsWith("/admin");
  const unreadCount = bootstrap.notifications?.unreadCount || 0;
  const notifItems = bootstrap.notifications?.items || [];

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage errors in restricted environments
      }
      return next;
    });
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const flat = navSections.flatMap((sec) =>
      sec.items.map((item) => ({ ...item, sectionTitle: sec.title })),
    );
    if (!q) return flat.slice(0, 7);
    return flat
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.sectionTitle.toLowerCase().includes(q) ||
          item.href.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [navSections, searchQuery]);

  const userDisplayName =
    bootstrap.user?.full_name || bootstrap.user?.username || (isAdmin ? "Administrator" : "Expert");
  const userInitial = userDisplayName.slice(0, 1).toUpperCase();

  return (
    <div className="phoenix-panel min-h-screen text-[#31374a] dark:text-[#eff2f6]">
      {/* Phoenix Fixed Full-Width Top Navbar */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between gap-3 border-b border-[#cbd0dd]/85 bg-white px-4 transition-colors dark:border-[#373e53] dark:bg-[#141824] sm:px-6">
        {/* Left: Hamburger + Phoenix Brand Mark */}
        <div className="flex min-w-0 items-center gap-3 lg:w-[14.5rem]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#cbd0dd] text-[#525b75] transition-colors hover:bg-[#eff2f6] dark:border-[#373e53] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436] lg:hidden"
            aria-label={isKhmer ? "បើកម៉ឺនុយ" : "Open navigation"}
          >
            <Menu className="h-4 w-4" />
          </button>

          <a
            href={bootstrap.urls.home}
            className="flex min-w-0 items-center gap-2.5 focus:outline-none"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3874ff] text-white shadow-sm">
              <Sprout className="h-4 w-4" />
            </span>
            <span className="truncate font-display text-[17px] font-extrabold tracking-tight text-[#141824] dark:text-[#eff2f6]">
              agri<span className="text-[#3874ff]">.</span>sys
            </span>
            <span className="hidden rounded border border-[#cbd0dd]/80 bg-[#f5f7fa] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#525b75] dark:border-[#373e53] dark:bg-[#1e2436] dark:text-[#9fa6bc] xl:inline-flex">
              {isAdmin ? (isKhmer ? "អ្នកគ្រប់គ្រង" : "Admin") : isKhmer ? "អ្នកជំនាញ" : "Expert"}
            </span>
          </a>
        </div>

        {/* Center: Phoenix Pill Quick Navigation Search */}
        <div ref={searchRef} className="relative hidden max-w-md flex-1 md:block">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-[#8a94ad]" />
            <input
              type="search"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                } else if (e.key === "Enter" && searchResults.length > 0) {
                  window.location.assign(searchResults[0].href);
                }
              }}
              placeholder={
                isKhmer ? "ស្វែងរកម៉ឺនុយ ឬទំព័រការងារ..." : "Search modules, tools, or routes..."
              }
              aria-label={isKhmer ? "ស្វែងរកម៉ឺនុយ" : "Search navigation"}
              className="h-9 w-full rounded-full border border-[#cbd0dd] bg-[#f5f7fa] pl-9 pr-4 text-[13px] text-[#31374a] placeholder:text-[#8a94ad] transition-colors focus:border-[#3874ff] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3874ff]/15 dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#eff2f6] dark:placeholder:text-[#6e7891] dark:focus:bg-[#141824]"
            />
          </div>

          {searchOpen && (
            <div className="animate-slide-down absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[#cbd0dd] bg-white p-1.5 shadow-lg dark:border-[#373e53] dark:bg-[#141824]">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8a94ad]">
                {isKhmer ? "ផ្លូវកាត់រហ័ស" : "Quick Navigation"}
              </p>
              {searchResults.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[#6e7891]">
                  {isKhmer ? "មិនមានលទ្ធផលត្រូវគ្នាទេ។" : "No matching workspace pages."}
                </p>
              ) : (
                <ul className="max-h-72 space-y-0.5 overflow-y-auto phoenix-scroll">
                  {searchResults.map((item) => {
                    const Icon = resolveNavIcon(item.href, item.label);
                    return (
                      <li key={`${item.sectionTitle}:${item.href}`}>
                        <a
                          href={item.href}
                          className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-[#31374a] transition-colors hover:bg-[#e5edff]/70 hover:text-[#004dff] dark:text-[#eff2f6] dark:hover:bg-[#3874ff]/15 dark:hover:text-[#85a9ff]"
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon className="h-3.5 w-3.5 text-[#8a94ad]" />
                            <span>{item.label}</span>
                          </span>
                          <span className="text-[10px] font-semibold text-[#8a94ad]">
                            {item.sectionTitle}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right: Utilities & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setAiOpen((prev) => !prev)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#3874ff]/30 bg-[#e5edff]/70 px-3 text-xs font-semibold text-[#004dff] transition-colors hover:bg-[#e5edff] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/25"
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
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#525b75] transition-colors hover:bg-[#eff2f6] hover:text-[#3874ff] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436] dark:hover:text-[#85a9ff]"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#fa3b1d] px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#141824]">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="animate-slide-down origin-top-right absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#cbd0dd] bg-white p-3 shadow-lg dark:border-[#373e53] dark:bg-[#141824]">
                <div className="mb-2 flex items-center justify-between border-b border-[#e3e6ed] pb-2 px-1 dark:border-[#2b3245]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#525b75] dark:text-[#9fa6bc]">
                    {isKhmer ? "ការជូនដំណឹង" : "Notifications"}
                  </span>
                  {bootstrap.notifications?.link && (
                    <a
                      href={bootstrap.notifications.link}
                      className="text-xs font-semibold text-[#3874ff] hover:text-[#004dff]"
                    >
                      {isKhmer ? "មើលទាំងអស់" : "View all"}
                    </a>
                  )}
                </div>
                {notifItems.length === 0 ? (
                  <p className="px-2 py-5 text-center text-xs text-[#8a94ad]">
                    {isKhmer ? "មិនមានការជូនដំណឹងថ្មីទេ។" : "You're all caught up."}
                  </p>
                ) : (
                  <ul className="max-h-72 space-y-1 overflow-y-auto phoenix-scroll">
                    {notifItems.map((n) => (
                      <li key={n.id}>
                        <a
                          href={n.link || bootstrap.notifications?.link || "#"}
                          className="block rounded-lg p-2 text-xs transition-colors hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                        >
                          <p className="font-semibold text-[#141824] dark:text-[#eff2f6]">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[#525b75] dark:text-[#9fa6bc]">
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

          {/* Profile Avatar & Dropdown */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotifOpen(false);
              }}
              aria-label="Account menu"
              className="flex items-center gap-2 rounded-full border border-[#cbd0dd]/85 bg-[#f5f7fa] p-1 pr-2.5 transition-colors hover:border-[#3874ff]/45 dark:border-[#373e53] dark:bg-[#181d2b]"
            >
              {bootstrap.user?.avatar_url ? (
                <img
                  src={bootstrap.user.avatar_url}
                  alt={userDisplayName}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3874ff] text-xs font-bold text-white">
                  {userInitial}
                </span>
              )}
              <ChevronDown className="hidden h-3.5 w-3.5 text-[#525b75] dark:text-[#9fa6bc] sm:block" />
            </button>

            {profileOpen && (
              <div className="animate-slide-down origin-top-right absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[#cbd0dd] bg-white shadow-lg dark:border-[#373e53] dark:bg-[#141824]">
                <div className="border-b border-[#e3e6ed] px-4 py-3 dark:border-[#2b3245]">
                  <p className="truncate text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                    {userDisplayName}
                  </p>
                  <p className="truncate text-xs text-[#6e7891] dark:text-[#9fa6bc]">
                    {bootstrap.user?.email || (isAdmin ? "Admin workspace" : "Expert workspace")}
                  </p>
                </div>
                <div className="p-1.5 text-xs font-medium text-[#31374a] dark:text-[#eff2f6]">
                  <a
                    href={bootstrap.urls.profile}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                  >
                    <UserCircle className="h-3.5 w-3.5 text-[#6e7891]" />
                    <span>{isKhmer ? "ប្រវត្តិរូប" : "Profile"}</span>
                  </a>
                  <a
                    href={bootstrap.urls.settings}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                  >
                    <Settings className="h-3.5 w-3.5 text-[#6e7891]" />
                    <span>{isKhmer ? "ការកំណត់" : "Settings"}</span>
                  </a>
                  <a
                    href={bootstrap.urls.loginActivity}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[#6e7891]" />
                    <span>{isKhmer ? "សកម្មភាពចូល" : "Login Activity"}</span>
                  </a>
                </div>
                <div className="border-t border-[#e3e6ed] p-1.5 dark:border-[#2b3245]">
                  <a
                    href={bootstrap.urls.logout}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#fa3b1d] transition-colors hover:bg-[#ffe0db]/50 dark:hover:bg-[#492226]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "ចាកចេញ" : "Sign out"}</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#141824]/45 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Phoenix Vertical Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#cbd0dd]/85 bg-white transition-[width,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-[#373e53] dark:bg-[#141824] lg:top-16 lg:z-30 lg:translate-x-0",
          sidebarOpen ? "translate-x-0 w-sidebar shadow-2xl lg:shadow-none" : "-translate-x-full",
          collapsed ? "lg:w-[4.25rem]" : "lg:w-sidebar",
        )}
      >
        {/* Mobile Drawer Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#e3e6ed] px-4 dark:border-[#2b3245] lg:hidden">
          <a href={bootstrap.urls.home} className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3874ff] text-white">
              <Sprout className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-extrabold text-[#141824] dark:text-[#eff2f6]">
              agri.sys
            </span>
          </a>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label={isKhmer ? "បិទម៉ឺនុយ" : "Close navigation"}
            className="rounded-lg p-1.5 text-[#525b75] hover:bg-[#eff2f6] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Nav Sections */}
        <nav className="phoenix-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section, sectionIdx) => (
            <div key={section.title}>
              {!collapsed ? (
                <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.07em] text-[#6e7891] dark:text-[#8a94ad]">
                  {section.title}
                </p>
              ) : (
                sectionIdx > 0 && (
                  <hr className="mx-2 mb-2 border-[#e3e6ed] dark:border-[#2b3245]" />
                )
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = resolveNavIcon(item.href, item.label);
                  return (
                    <li key={`${item.href}:${item.label}`}>
                      <a
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150",
                          collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2",
                          item.active
                            ? "bg-[#e5edff]/80 font-semibold text-[#004dff] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-r-full before:bg-[#3874ff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                            : "text-[#525b75] hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              item.active
                                ? "text-[#3874ff] dark:text-[#85a9ff]"
                                : "text-[#6e7891] group-hover:text-[#141824] dark:text-[#8a94ad] dark:group-hover:text-[#eff2f6]",
                            )}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </span>
                        {!collapsed && item.badge !== undefined && (
                          <span className="ml-2 rounded-full bg-[#e5edff] px-1.5 py-0.5 text-[10px] font-bold text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Phoenix Sidebar Collapse Toggle Footer (Desktop) */}
        <div className="hidden border-t border-[#e3e6ed] p-2.5 dark:border-[#2b3245] lg:block">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex w-full items-center rounded-lg px-3 py-2 text-xs font-semibold text-[#525b75] transition-colors hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]",
              collapsed ? "justify-center" : "gap-2.5",
            )}
            title={collapsed ? (isKhmer ? "ពង្រីករបារចំហៀង" : "Expand View") : undefined}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span>{isKhmer ? "បង្រួមម៉ឺនុយ" : "Collapsed View"}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex min-h-[calc(100vh-4rem)] flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[4.25rem]" : "lg:pl-sidebar",
        )}
      >
        <main className="ai-enter mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-7">
          {(pageTitle || headerActions) && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {pageTitle && (
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#141824] dark:text-[#eff2f6] sm:text-[1.7rem]">
                    {pageTitle}
                  </h1>
                )}
                {pageSubtitle && (
                  <p className="mt-1 text-sm text-[#525b75] dark:text-[#9fa6bc]">
                    {pageSubtitle}
                  </p>
                )}
              </div>
              {headerActions && (
                <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
              )}
            </div>
          )}

          {children}

          <footer className="mt-10 flex items-center justify-between gap-2 border-t border-[#e3e6ed] pt-4 text-xs text-[#8a94ad] dark:border-[#2b3245]">
            <span>
              Agri-System AI Operations · {isAdmin ? "Admin Control" : "Expert Workbench"}
            </span>
          </footer>
        </main>
      </div>

      <AiCopilotDrawer open={aiOpen} onClose={() => setAiOpen(false)} isKhmer={isKhmer} phoenix />
    </div>
  );
}
