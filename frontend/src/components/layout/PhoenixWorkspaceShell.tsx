import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Bug,
  ChevronDown,
  ChevronRight,
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
  MonitorSmartphone,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Stethoscope,
  Tag,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import type { ShellNavSection } from "./WorkspaceShell";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  getNotificationHref,
  getNotificationMessage,
  getNotificationTimeLabel,
  isNotificationRead,
} from "@/lib/notificationHelpers";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "agri_phoenix_sidebar_collapsed";
const COLLAPSED_GROUPS_KEY = "agri_phoenix_nav_collapsed_groups";

function resolveNavIcon(href: string, label: string) {
  const key = `${href} ${label}`.toLowerCase();
  if (key.includes("/users/profile")) return UserCircle;
  if (key.includes("/users/login-activity")) return MonitorSmartphone;
  if (key.includes("/users/notifications")) return Bell;
  if (key.includes("/users/settings")) return SlidersHorizontal;
  if (key.includes("/world") || key.includes("world")) return Globe;
  if (key.includes("expert-stat") || key.includes("statistic") || key.includes("performance")) return Award;
  if (key.includes("/users") || key.includes("users") || key.includes("farmer")) return Users;
  if (key.includes("/roles") || key.includes("role")) return Shield;
  if (key.includes("audit") || key.includes("log")) return FileText;
  if (key.includes("crop")) return Sprout;
  if (key.includes("disease")) return Bug;
  if (key.includes("marquee") || key.includes("banner")) return Megaphone;
  if (key.includes("promo")) return Tag;
  if (key.includes("chat") || key.includes("reply")) return MessageSquare;
  if (key.includes("support")) return Headphones;
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

function PhoenixBrandLockup({
  homeHref,
  logoLight,
  logoDark,
  isAdmin,
  isKhmer,
  compact = false,
}: {
  homeHref?: string;
  logoLight?: string;
  logoDark?: string;
  isAdmin: boolean;
  isKhmer: boolean;
  compact?: boolean;
}) {
  const roleLabel = isAdmin ? (isKhmer ? "អ្នកគ្រប់គ្រង" : "Admin") : isKhmer ? "អ្នកជំនាញ" : "Expert";
  return (
    <a
      href={homeHref || "/"}
      className="group flex shrink-0 items-center gap-2.5 rounded-lg py-1 transition-opacity hover:opacity-90 focus:outline-none"
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border border-[#cbd0dd]/90 bg-white shadow-sm dark:border-[#373e53] dark:bg-[#181d2b]",
          compact ? "h-8 w-8 p-1.5" : "h-9 w-9 p-1.5",
        )}
      >
        <img
          src={logoLight || "/static/img/newlogo.svg"}
          alt="AGRI SYSTEM"
          className="h-full w-full object-contain dark:hidden"
        />
        <img
          src={logoDark || "/static/img/newlogo-dark.svg"}
          alt="AGRI SYSTEM"
          className="hidden h-full w-full object-contain dark:block"
        />
      </div>
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[13.5px] font-extrabold tracking-[0.04em] text-[#141824] dark:text-[#eff2f6]">
            AGRI SYSTEM
          </span>
          <span
            className={cn(
              "rounded border border-[#adc5ff]/80 bg-[#e5edff]/85 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#004dff] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]",
              compact ? "inline-flex" : "hidden sm:inline-flex",
            )}
          >
            {roleLabel}
          </span>
        </div>
        {!compact && (
          <span className="mt-1 hidden text-[10px] font-medium text-[#6e7891] dark:text-[#8a94ad] sm:block">
            {isAdmin
              ? isKhmer
                ? "មជ្ឈមណ្ឌលគ្រប់គ្រង AI"
                : "AI Control Center"
              : isKhmer
                ? "តុការងារអ្នកជំនាញកសិកម្ម"
                : "Expert Workbench"}
          </span>
        )}
      </div>
    </a>
  );
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
      return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeSearchIdx, setActiveSearchIdx] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const toggleSection = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
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

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setNotifOpen(false);
        setProfileOpen(false);
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
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

  useEffect(() => {
    setActiveSearchIdx(0);
  }, [searchQuery, searchOpen]);

  const activeLocation = useMemo(() => {
    for (const sec of navSections) {
      const found = sec.items.find((item) => item.active);
      if (found) {
        return { section: sec.title, item: found.label };
      }
    }
    return {
      section: isAdmin ? (isKhmer ? "អ្នកគ្រប់គ្រង" : "Admin") : isKhmer ? "អ្នកជំនាញ" : "Expert",
      item: pageTitle || "",
    };
  }, [navSections, isAdmin, isKhmer, pageTitle]);

  const userDisplayName =
    bootstrap.user?.full_name || bootstrap.user?.username || (isAdmin ? "Administrator" : "Expert");
  const userInitial = userDisplayName.slice(0, 1).toUpperCase();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && searchResults.length > 0) {
      e.preventDefault();
      setActiveSearchIdx((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === "ArrowUp" && searchResults.length > 0) {
      e.preventDefault();
      setActiveSearchIdx((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter" && searchResults.length > 0) {
      e.preventDefault();
      const chosen = searchResults[activeSearchIdx] || searchResults[0];
      if (chosen?.href) {
        window.location.assign(chosen.href);
      }
    }
  };

  return (
    <div className="phoenix-panel min-h-screen text-[#31374a] dark:text-[#eff2f6]">
      {/* Fixed Full-Width Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#e3e6ed] bg-white/95 backdrop-blur-md transition-colors dark:border-[#2b3245] dark:bg-[#141824]/95">
        <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Sidebar Controls + Brand + Contextual Breadcrumb */}
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] text-[#525b75] transition-colors hover:bg-[#eff2f6] hover:text-[#141824] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc] dark:hover:bg-[#22283a] lg:hidden"
              aria-label={isKhmer ? "បើកម៉ឺនុយ" : "Open navigation"}
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? (isKhmer ? "ពង្រីករបារចំហៀង" : "Expand sidebar") : isKhmer ? "បង្រួមរបារចំហៀង" : "Collapse sidebar"}
              title={collapsed ? (isKhmer ? "ពង្រីករបារចំហៀង" : "Expand sidebar") : isKhmer ? "បង្រួមរបារចំហៀង" : "Collapse sidebar"}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e3e6ed] bg-[#f5f7fa]/80 text-[#525b75] transition-colors hover:border-[#cbd0dd] hover:bg-[#eff2f6] hover:text-[#141824] dark:border-[#2b3245] dark:bg-[#0f111a]/70 dark:text-[#9fa6bc] dark:hover:border-[#373e53] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6] lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <PhoenixBrandLockup
              homeHref={bootstrap.urls.home}
              logoLight={bootstrap.urls.logoLight}
              logoDark={bootstrap.urls.logoDark}
              isAdmin={isAdmin}
              isKhmer={isKhmer}
            />

            {activeLocation.item && (
              <nav
                aria-label="Breadcrumb"
                className="ml-1 hidden items-center gap-1.5 border-l border-[#e3e6ed] pl-3 text-xs dark:border-[#2b3245] xl:flex"
              >
                <span className="font-medium text-[#6e7891] dark:text-[#8a94ad]">
                  {activeLocation.section}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[#8a94ad]" />
                <span className="max-w-[180px] truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                  {activeLocation.item}
                </span>
              </nav>
            )}
          </div>

          {/* Center: Quick Jump Search Bar */}
          <div ref={searchRef} className="relative hidden max-w-md flex-1 md:block">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[#8a94ad]" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={
                  isKhmer ? "ស្វែងរកម៉ឺនុយ ឬទំព័រការងារ..." : "Quick jump to page, tool, or setting..."
                }
                aria-label={isKhmer ? "ស្វែងរកម៉ឺនុយ" : "Search navigation"}
                className={cn(
                  "h-9 w-full rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] pl-9 text-[13px] text-[#31374a] placeholder:text-[#8a94ad] transition-colors focus:border-[#3874ff] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3874ff]/15 dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#eff2f6] dark:placeholder:text-[#6e7891] dark:focus:bg-[#181d2b] [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
                  searchQuery ? "pr-9" : "pr-3 lg:pr-16",
                )}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear quick jump search"
                  className="absolute right-2.5 rounded p-0.5 text-[#8a94ad] transition-colors hover:text-[#141824] dark:hover:text-[#eff2f6]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-[#cbd0dd] bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#6e7891] dark:border-[#373e53] dark:bg-[#141824] dark:text-[#9fa6bc] lg:inline-block">
                  {shortcutLabel}
                </kbd>
              )}
            </div>

            {searchOpen && (
              <div className="animate-slide-down absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[#cbd0dd] bg-white p-1.5 shadow-lg dark:border-[#373e53] dark:bg-[#141824]">
                <div className="flex items-center justify-between px-2.5 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a94ad]">
                    {isKhmer ? "ផ្លូវកាត់រហ័ស" : "Quick Navigation"}
                  </span>
                  <span className="text-[10px] text-[#8a94ad]">↑↓ · ↵</span>
                </div>
                {searchResults.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-[#6e7891]">
                    {isKhmer ? "មិនមានលទ្ធផលត្រូវគ្នាទេ។" : "No matching workspace pages."}
                  </p>
                ) : (
                  <ul className="max-h-72 space-y-0.5 overflow-y-auto phoenix-scroll">
                    {searchResults.map((item, idx) => {
                      const Icon = resolveNavIcon(item.href, item.label);
                      const highlighted = idx === activeSearchIdx;
                      return (
                        <li key={`${item.sectionTitle}:${item.href}`}>
                          <a
                            href={item.href}
                            onMouseEnter={() => setActiveSearchIdx(idx)}
                            className={cn(
                              "flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                              highlighted
                                ? "bg-[#e5edff]/80 text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                                : "text-[#31374a] hover:bg-[#eff2f6] dark:text-[#eff2f6] dark:hover:bg-[#1e2436]",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <Icon
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0",
                                  highlighted ? "text-[#3874ff] dark:text-[#85a9ff]" : "text-[#8a94ad]",
                                )}
                              />
                              <span className="truncate">{item.label}</span>
                              {item.active && (
                                <span className="rounded bg-[#e5edff] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                                  {isKhmer ? "បច្ចុប្បន្ន" : "Current"}
                                </span>
                              )}
                            </span>
                            <span className="ml-2 shrink-0 text-[10px] font-semibold text-[#8a94ad]">
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

          {/* Right: Consistent h-9 Utility Bar & Account Menu */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              aria-label={isKhmer ? "ស្វែងរកម៉ឺនុយ" : "Search navigation"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] text-[#525b75] transition-colors hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc] md:hidden"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setAiOpen((prev) => !prev)}
              aria-label={isKhmer ? "ជំនួយការ AI" : "AI Copilot"}
              className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-[#3874ff]/30 bg-[#e5edff]/75 text-xs font-semibold text-[#004dff] transition-colors hover:bg-[#e5edff] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/25 sm:w-auto sm:px-3"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{isKhmer ? "ជំនួយការ AI" : "AI Copilot"}</span>
            </button>

            <div className="hidden sm:inline-flex">
              <LanguageSwitcher
                variant="phoenix"
                lang={bootstrap.lang}
                enUrl={bootstrap.urls.updateLanguageEn}
                kmUrl={bootstrap.urls.updateLanguageKm}
              />
            </div>

            <ThemeToggle variant="phoenix" />

            {/* Notifications Dropdown */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] text-[#525b75] transition-colors hover:border-[#b3bac9] hover:bg-[#eff2f6] hover:text-[#3874ff] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc] dark:hover:bg-[#22283a] dark:hover:text-[#85a9ff]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#fa3b1d] px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#141824]">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="animate-slide-down origin-top-right absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#cbd0dd] bg-white p-3 shadow-lg dark:border-[#373e53] dark:bg-[#141824]">
                  <div className="mb-2 flex items-center justify-between border-b border-[#e3e6ed] px-1 pb-2 dark:border-[#2b3245]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#525b75] dark:text-[#9fa6bc]">
                        {isKhmer ? "ការជូនដំណឹង" : "Notifications"}
                      </span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-[#ffe0db] px-1.5 py-0.5 text-[10px] font-bold text-[#b81800] dark:bg-[#fa3b1d]/20 dark:text-[#ff9c8c]">
                          {unreadCount}
                        </span>
                      )}
                    </div>
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
                    <div className="px-2 py-6 text-center">
                      <Bell className="mx-auto mb-1.5 h-5 w-5 text-[#8a94ad]" />
                      <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                        {isKhmer ? "មិនមានការជូនដំណឹងថ្មីទេ។" : "You're all caught up."}
                      </p>
                    </div>
                  ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto phoenix-scroll">
                      {notifItems.map((n) => {
                        const msg = getNotificationMessage(n);
                        const href = getNotificationHref(n) || bootstrap.notifications?.link || "#";
                        const read = isNotificationRead(n);
                        const timeLabel = getNotificationTimeLabel(n, isKhmer);
                        return (
                          <li key={n.id}>
                            <a
                              href={href}
                              className="block rounded-lg p-2.5 text-xs transition-colors hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {!read && (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3874ff]" />
                                  )}
                                  <p className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                                    {n.title}
                                  </p>
                                </div>
                                {timeLabel && (
                                  <span className="shrink-0 text-[10px] text-[#8a94ad]">
                                    {timeLabel}
                                  </span>
                                )}
                              </div>
                              {msg && (
                                <p className="mt-0.5 line-clamp-2 text-[#525b75] dark:text-[#9fa6bc]">
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

            <span
              aria-hidden="true"
              className="mx-0.5 hidden h-5 w-px bg-[#e3e6ed] dark:bg-[#2b3245] sm:block"
            />

            {/* Profile Avatar & Account Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                aria-label="Account menu"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] px-1.5 transition-colors hover:border-[#3874ff]/45 hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:hover:bg-[#22283a] sm:px-2 lg:gap-2"
              >
                {bootstrap.user?.avatar_url ? (
                  <img
                    src={bootstrap.user.avatar_url}
                    alt={userDisplayName}
                    className="h-6 w-6 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3874ff] text-[11px] font-bold text-white">
                    {userInitial}
                  </span>
                )}
                <span className="hidden max-w-[110px] truncate text-xs font-semibold text-[#141824] dark:text-[#eff2f6] lg:inline">
                  {userDisplayName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#6e7891] dark:text-[#9fa6bc]" />
              </button>

              {profileOpen && (
                <div className="animate-slide-down origin-top-right absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#cbd0dd] bg-white shadow-lg dark:border-[#373e53] dark:bg-[#141824]">
                  <div className="border-b border-[#e3e6ed] px-4 py-3 dark:border-[#2b3245]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                        {userDisplayName}
                      </p>
                      <span className="shrink-0 rounded bg-[#e5edff] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                        {isAdmin ? "Admin" : "Expert"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#6e7891] dark:text-[#9fa6bc]">
                      {bootstrap.user?.email || (isAdmin ? "Admin workspace" : "Expert workspace")}
                    </p>
                  </div>
                  <div className="p-1.5 text-xs font-medium text-[#31374a] dark:text-[#eff2f6]">
                    <a
                      href={bootstrap.urls.profile}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                    >
                      <UserCircle className="h-3.5 w-3.5 text-[#6e7891]" />
                      <span>{isKhmer ? "ប្រវត្តិរូប និងសុវត្ថិភាព" : "Profile & Security"}</span>
                    </a>
                    <a
                      href={bootstrap.urls.settings}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                    >
                      <Settings className="h-3.5 w-3.5 text-[#6e7891]" />
                      <span>{isKhmer ? "ការកំណត់គណនី" : "Workspace Preferences"}</span>
                    </a>
                    <a
                      href={bootstrap.urls.loginActivity}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#eff2f6] dark:hover:bg-[#1e2436]"
                    >
                      <MonitorSmartphone className="h-3.5 w-3.5 text-[#6e7891]" />
                      <span>{isKhmer ? "ឧបករណ៍ និងសម័យចូល" : "Devices & Sessions"}</span>
                    </a>
                    <div className="my-1 px-2.5 pt-1 sm:hidden">
                      <LanguageSwitcher
                        variant="phoenix"
                        lang={bootstrap.lang}
                        enUrl={bootstrap.urls.updateLanguageEn}
                        kmUrl={bootstrap.urls.updateLanguageKm}
                        className="w-full justify-between"
                      />
                    </div>
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
        </div>

        {/* Mobile Quick Search Tray */}
        {mobileSearchOpen && (
          <div className="border-t border-[#e3e6ed] bg-white px-4 py-2.5 dark:border-[#2b3245] dark:bg-[#141824] md:hidden">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[#8a94ad]" />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={isKhmer ? "ស្វែងរកម៉ឺនុយ..." : "Jump to page or module..."}
                className="h-9 w-full rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] pl-9 pr-9 text-xs text-[#31374a] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#eff2f6] [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear mobile search"
                  className="absolute right-2.5 rounded p-0.5 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
                {searchResults.slice(0, 6).map((item) => {
                  const Icon = resolveNavIcon(item.href, item.label);
                  return (
                    <li key={`mobile:${item.href}`}>
                      <a
                        href={item.href}
                        className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-[#31374a] hover:bg-[#eff2f6] dark:text-[#eff2f6] dark:hover:bg-[#1e2436]"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-[#8a94ad]" />
                          <span>{item.label}</span>
                        </span>
                        <span className="text-[10px] text-[#8a94ad]">{item.sectionTitle}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </header>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#141824]/45 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Vertical Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#e3e6ed] bg-white transition-[width,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-[#2b3245] dark:bg-[#141824] lg:top-16 lg:z-30 lg:translate-x-0",
          sidebarOpen ? "translate-x-0 w-sidebar shadow-2xl lg:shadow-none" : "-translate-x-full",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-sidebar",
        )}
      >
        {/* Mobile Drawer Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#e3e6ed] px-4 dark:border-[#2b3245] lg:hidden">
          <PhoenixBrandLockup
            homeHref={bootstrap.urls.home}
            logoLight={bootstrap.urls.logoLight}
            logoDark={bootstrap.urls.logoDark}
            isAdmin={isAdmin}
            isKhmer={isKhmer}
            compact
          />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label={isKhmer ? "បិទម៉ឺនុយ" : "Close navigation"}
            className="rounded-lg p-1.5 text-[#525b75] hover:bg-[#eff2f6] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Nav Sections with Collapsible Headers */}
        <nav
          aria-label={isKhmer ? "ម៉ឺនុយកិច្ចការ" : "Workspace navigation"}
          className="phoenix-scroll flex-1 space-y-4 overflow-y-auto px-3 py-4"
        >
          {navSections.map((section, sectionIdx) => {
            const hasActiveChild = section.items.some((item) => item.active);
            const isSectionOpen = hasActiveChild || !collapsedGroups[section.title];
            return (
              <div key={section.title}>
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    aria-expanded={isSectionOpen}
                    className="mb-1.5 flex w-full items-center justify-between rounded-md px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#6e7891] transition-colors hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-[#eff2f6]"
                  >
                    <span>{section.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-150",
                        !isSectionOpen && "-rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  sectionIdx > 0 && (
                    <hr className="mx-2 mb-2 border-[#e3e6ed] dark:border-[#2b3245]" />
                  )
                )}

                {(collapsed || isSectionOpen) && (
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = resolveNavIcon(item.href, item.label);
                      return (
                        <li key={`${item.href}:${item.label}`}>
                          <a
                            href={item.href}
                            aria-current={item.active ? "page" : undefined}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                              "group relative flex items-center rounded-lg text-[13px] transition-all duration-150",
                              collapsed ? "justify-center px-2 py-2.5" : "justify-between px-2.5 py-2",
                              item.active
                                ? "bg-[#e5edff]/90 font-semibold text-[#004dff] ring-1 ring-[#3874ff]/15 before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-r-full before:bg-[#3874ff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff] dark:ring-[#3874ff]/25"
                                : "font-medium text-[#424b64] hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#1b2234] dark:hover:text-[#eff2f6]",
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
                )}
              </div>
            );
          })}
        </nav>

        {/* Clean Sidebar Account & Quick Preferences Footer */}
        <div className="border-t border-[#e3e6ed] p-2.5 dark:border-[#2b3245]">
          {collapsed ? (
            <a
              href={bootstrap.urls.profile}
              title={`${userDisplayName} · ${isKhmer ? "ប្រវត្តិរូប" : "Profile"}`}
              className="flex h-10 w-full items-center justify-center rounded-lg text-[#525b75] transition-colors hover:bg-[#eff2f6] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436]"
            >
              {bootstrap.user?.avatar_url ? (
                <img
                  src={bootstrap.user.avatar_url}
                  alt={userDisplayName}
                  className="h-7 w-7 rounded-md object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#3874ff] text-xs font-bold text-white">
                  {userInitial}
                </span>
              )}
            </a>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 px-2.5 py-2 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
              <a
                href={bootstrap.urls.profile}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md transition-opacity hover:opacity-85"
              >
                {bootstrap.user?.avatar_url ? (
                  <img
                    src={bootstrap.user.avatar_url}
                    alt={userDisplayName}
                    className="h-7 w-7 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#3874ff] text-xs font-bold text-white">
                    {userInitial}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#141824] dark:text-[#eff2f6]">
                    {userDisplayName}
                  </p>
                  <p className="truncate text-[10.5px] text-[#6e7891] dark:text-[#8a94ad]">
                    {isAdmin
                      ? isKhmer
                        ? "សិទ្ធិអ្នកគ្រប់គ្រង"
                        : "Administrator"
                      : isKhmer
                        ? "សិទ្ធិអ្នកជំនាញ"
                        : "Agri Expert"}
                  </p>
                </div>
              </a>
              <a
                href={bootstrap.urls.settings}
                title={isKhmer ? "ការកំណត់គណនី" : "Workspace Preferences"}
                aria-label={isKhmer ? "ការកំណត់គណនី" : "Workspace Preferences"}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#6e7891] transition-colors hover:bg-white hover:text-[#3874ff] dark:text-[#8a94ad] dark:hover:bg-[#1e2436] dark:hover:text-[#85a9ff]"
              >
                <Settings className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex min-h-[calc(100vh-4rem)] flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[4.5rem]" : "lg:pl-sidebar",
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
              AGRI SYSTEM · {isAdmin ? "Admin Control Center" : "Expert Workbench"}
            </span>
          </footer>
        </main>
      </div>

      <AiCopilotDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        isKhmer={isKhmer}
        phoenix
        csrfToken={bootstrap.csrfToken}
        scope={bootstrap.page.scope}
        userName={userDisplayName}
      />
    </div>
  );
}
