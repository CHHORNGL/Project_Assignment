import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CheckCircle2,
  Crown,
  Headphones,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import type { AppBootstrap, NotificationItem } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { useToast } from "@/context/ToastContext";
import { buildNavSections } from "@/lib/navigation";
import {
  getNotificationCategory,
  getNotificationDateGroup,
  getNotificationHref,
  getNotificationLevel,
  getNotificationMessage,
  getNotificationTimeLabel,
  isNotificationRead,
  parseNotificationDate,
  type NotificationCategory,
  type NotificationDateGroup,
  type NotificationLevel,
} from "@/lib/notificationHelpers";
import { postJson, requestJson } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NotificationsPageData {
  items: NotificationItem[];
  nextPage: number | null;
  perPage: number;
  totalCount?: number;
  unreadCount?: number;
  dataUrl: string;
  seenUrl: string;
}

type ReadFilter = "all" | "unread" | "read";
type CategoryFilter = "all" | NotificationCategory;

const LEVEL_STYLES: Record<
  NotificationLevel,
  { iconBox: string; badge: string }
> = {
  info: {
    iconBox:
      "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300",
    badge:
      "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  success: {
    iconBox:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300",
    badge:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    iconBox:
      "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-300",
    badge:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  danger: {
    iconBox:
      "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-400/25 dark:bg-rose-500/15 dark:text-rose-300",
    badge:
      "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

function getCategoryLabel(category: NotificationCategory, isKhmer: boolean): string {
  switch (category) {
    case "diagnosis":
      return isKhmer ? "ការវិនិច្ឆ័យ" : "Diagnosis";
    case "messages":
      return isKhmer ? "សារ និងជំនួយ" : "Messages";
    case "billing":
      return isKhmer ? "សមាជិកភាព" : "VIP & Billing";
    default:
      return isKhmer ? "ប្រព័ន្ធ" : "System";
  }
}

function getNotificationVisualIcon(
  category: NotificationCategory,
  level: NotificationLevel,
  kind?: string,
) {
  const k = String(kind || "").toLowerCase();
  if (k.includes("rejected") || level === "danger") return AlertTriangle;
  if (k.includes("approved") || (level === "success" && category === "diagnosis")) {
    return CheckCircle2;
  }
  if (category === "diagnosis") return Stethoscope;
  if (category === "messages") {
    return k.includes("support") ? Headphones : MessageSquare;
  }
  if (category === "billing") return Crown;
  return Bell;
}

function mergeUniqueById(
  existing: NotificationItem[],
  incoming: NotificationItem[],
): NotificationItem[] {
  const map = new Map<number, NotificationItem>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}

export default function NotificationsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<NotificationsPageData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [items, setItems] = useState<NotificationItem[]>(d.items || []);
  const [nextPage, setNextPage] = useState<number | null>(d.nextPage ?? null);
  const [totalCount, setTotalCount] = useState<number>(
    typeof d.totalCount === "number" ? d.totalCount : (d.items || []).length,
  );
  const [serverUnread, setServerUnread] = useState<number | null>(
    typeof d.unreadCount === "number" ? d.unreadCount : null,
  );

  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const localUnread = useMemo(
    () => items.filter((n) => !isNotificationRead(n)).length,
    [items],
  );
  const unreadCount = serverUnread !== null ? serverUnread : localUnread;
  const effectiveTotal = Math.max(totalCount, items.length);
  const readCount = Math.max(0, effectiveTotal - unreadCount);

  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      diagnosis: 0,
      messages: 0,
      billing: 0,
      system: 0,
    };
    for (const item of items) {
      counts[getNotificationCategory(item)] += 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const read = isNotificationRead(item);
      if (readFilter === "unread" && read) return false;
      if (readFilter === "read" && !read) return false;
      if (categoryFilter !== "all" && getNotificationCategory(item) !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      const title = String(item.title || "").toLowerCase();
      const body = getNotificationMessage(item).toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  }, [items, readFilter, categoryFilter, query]);

  const groupedSections = useMemo(() => {
    const now = new Date();
    const buckets: Record<NotificationDateGroup, NotificationItem[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const item of filteredItems) {
      buckets[getNotificationDateGroup(item, now)].push(item);
    }

    const defs: Array<{ key: NotificationDateGroup; label: string }> = [
      { key: "today", label: isKhmer ? "ថ្ងៃនេះ" : "Today" },
      { key: "yesterday", label: isKhmer ? "ម្សិលមិញ" : "Yesterday" },
      { key: "earlier", label: isKhmer ? "កន្លងមក" : "Earlier" },
    ];
    return defs
      .map((def) => ({ ...def, items: buckets[def.key] }))
      .filter((sec) => sec.items.length > 0);
  }, [filteredItems, isKhmer]);

  const markLocalItemsRead = (ids?: number[]) => {
    setItems((prev) =>
      prev.map((item) =>
        !ids || ids.includes(item.id)
          ? { ...item, is_read: true, unread: false }
          : item,
      ),
    );
  };

  const handleMarkSeen = async (ids?: number[]) => {
    if (!ids) {
      setMarkingAll(true);
    } else if (ids.length === 1) {
      setMarkingId(ids[0]);
    }
    try {
      const res = await postJson<{ ok?: boolean; unread_count?: number }>(
        d.seenUrl,
        ids ? { ids } : {},
        bootstrap.csrfToken,
      );
      if (res.ok && res.data.ok) {
        markLocalItemsRead(ids);
        if (typeof res.data.unread_count === "number") {
          setServerUnread(res.data.unread_count);
        } else if (!ids) {
          setServerUnread(0);
        } else {
          setServerUnread((prev) =>
            prev !== null ? Math.max(0, prev - ids.length) : null,
          );
        }
        if (!ids) {
          pushToast(
            "success",
            isKhmer
              ? "បានសម្គាល់ការជូនដំណឹងទាំងអស់ថាបានអានរួច។"
              : "All notifications marked as read.",
          );
        }
      } else {
        pushToast(
          "danger",
          isKhmer
            ? "មិនអាចធ្វើបច្ចុប្បន្នភាពស្ថានភាពអានបានទេ។"
            : "Could not update notification status.",
        );
      }
    } finally {
      setMarkingAll(false);
      setMarkingId(null);
    }
  };

  const handleOpenNotification = (item: NotificationItem) => {
    if (isNotificationRead(item)) return;
    markLocalItemsRead([item.id]);
    setServerUnread((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
    try {
      void fetch(d.seenUrl, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": bootstrap.csrfToken,
        },
        body: JSON.stringify({ ids: [item.id] }),
      }).catch(() => undefined);
    } catch {
      // Ignore navigation-abort fetch errors
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const sep = d.dataUrl.includes("?") ? "&" : "?";
      const res = await requestJson<{
        ok?: boolean;
        items?: NotificationItem[];
        next_page?: number | null;
        total?: number;
        unread_count?: number;
      }>(`${d.dataUrl}${sep}page=1&per_page=${d.perPage || 20}`, "GET");
      if (res.ok && res.data.ok) {
        setItems(res.data.items || []);
        setNextPage(res.data.next_page ?? null);
        if (typeof res.data.total === "number") setTotalCount(res.data.total);
        if (typeof res.data.unread_count === "number") {
          setServerUnread(res.data.unread_count);
        }
      } else {
        pushToast(
          "danger",
          isKhmer ? "មិនអាចផ្ទុកការជូនដំណឹងឡើងវិញបានទេ។" : "Failed to refresh notifications.",
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const sep = d.dataUrl.includes("?") ? "&" : "?";
      const res = await requestJson<{
        ok?: boolean;
        items?: NotificationItem[];
        next_page?: number | null;
        total?: number;
        unread_count?: number;
      }>(`${d.dataUrl}${sep}page=${nextPage}&per_page=${d.perPage || 20}`, "GET");
      if (res.ok && res.data.ok) {
        setItems((prev) => mergeUniqueById(prev, res.data.items || []));
        setNextPage(res.data.next_page ?? null);
        if (typeof res.data.total === "number") setTotalCount(res.data.total);
        if (typeof res.data.unread_count === "number") {
          setServerUnread(res.data.unread_count);
        }
      } else {
        pushToast(
          "danger",
          isKhmer ? "មិនអាចផ្ទុកការជូនដំណឹងបន្ថែមបានទេ។" : "Could not load more notifications.",
        );
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const hasActiveFilters =
    readFilter !== "all" || categoryFilter !== "all" || query.trim().length > 0;

  const resetFilters = () => {
    setReadFilter("all");
    setCategoryFilter("all");
    setQuery("");
  };

  const categoryTabs = (
    [
      { id: "all", label: isKhmer ? "គ្រប់ប្រភេទ" : "All Categories", count: items.length },
      { id: "diagnosis", label: getCategoryLabel("diagnosis", isKhmer), count: categoryCounts.diagnosis },
      { id: "messages", label: getCategoryLabel("messages", isKhmer), count: categoryCounts.messages },
      { id: "billing", label: getCategoryLabel("billing", isKhmer), count: categoryCounts.billing },
      { id: "system", label: getCategoryLabel("system", isKhmer), count: categoryCounts.system },
    ] satisfies Array<{ id: CategoryFilter; label: string; count: number }>
  ).filter((tab) => tab.id === "all" || tab.count > 0);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
            className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs"
            title={isKhmer ? "ផ្ទុកឡើងវិញ" : "Refresh"}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">{isKhmer ? "ផ្ទុកថ្មី" : "Refresh"}</span>
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={markingAll}
              onClick={() => void handleMarkSeen()}
              className="ai-btn-primary h-9 gap-1.5 px-3 text-xs"
            >
              {markingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              <span>{isKhmer ? "អានទាំងអស់" : "Mark All Read"}</span>
            </button>
          )}
        </div>
      }
    >
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Compact Summary Strip */}
        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <div
            className={cn(
              "ai-surface p-3 sm:p-4",
              unreadCount > 0 && "border-indigo-500/35 bg-indigo-50/40 dark:bg-indigo-500/[0.06]",
            )}
          >
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
              {isKhmer ? "មិនទាន់អាន" : "Unread"}
            </p>
            <p
              className={cn(
                "mt-1 font-display text-xl font-extrabold sm:text-2xl",
                unreadCount > 0
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-900 dark:text-white",
              )}
            >
              {unreadCount}
            </p>
          </div>

          <div className="ai-surface p-3.5 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isKhmer ? "សរុប" : "Total"}
            </p>
            <p className="mt-1 font-display text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
              {effectiveTotal}
            </p>
          </div>

          <div className="ai-surface p-3.5 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isKhmer ? "បានអាន" : "Read"}
            </p>
            <p className="mt-1 font-display text-xl font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-2xl">
              {readCount}
            </p>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <section className="ai-surface space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label={isKhmer ? "តម្រងស្ថានភាពអាន" : "Read status filter"}
              className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1 dark:border-slate-800 dark:bg-obsidian-950"
            >
              {(
                [
                  { id: "all" as const, label: isKhmer ? "ទាំងអស់" : "All", badge: undefined },
                  {
                    id: "unread" as const,
                    label: isKhmer ? "មិនទាន់អាន" : "Unread",
                    badge: unreadCount > 0 ? unreadCount : undefined,
                  },
                  { id: "read" as const, label: isKhmer ? "បានអាន" : "Read", badge: undefined },
                ] as const
              ).map((tab) => {
                const selected = readFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={selected}
                    onClick={() => setReadFilter(tab.id)}
                    className={cn(
                      "inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                      selected
                        ? "bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none",
                          selected
                            ? "bg-indigo-100 text-indigo-700 dark:bg-white/20 dark:text-white"
                            : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
                        )}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isKhmer ? "ស្វែងរកការជូនដំណឹង..." : "Search notifications..."}
                className="ai-input h-9 pl-10 pr-8 text-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={isKhmer ? "សម្អាត" : "Clear search"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {categoryTabs.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {categoryTabs.map((tab) => {
                const selected = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition",
                      selected
                        ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-200"
                        : "border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-400 dark:hover:text-slate-200",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-75">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Notifications List or Empty States */}
        {items.length === 0 ? (
          <div className="ai-surface flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Bell className="h-6 w-6" />
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {isKhmer ? "មិនទាន់មានការជូនដំណឹងទេ" : "You're all caught up"}
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {isKhmer
                ? "ការជូនដំណឹងថ្មីៗអំពីការវិនិច្ឆ័យ ការឆ្លើយតបរបស់អ្នកជំនាញ និងសមាជិកភាពនឹងបង្ហាញនៅទីនេះ។"
                : "Alerts for crop diagnoses, expert replies, support messages, and membership updates appear here."}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="ai-surface flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-obsidian-800 dark:text-slate-400">
              <BellOff className="h-5 w-5" />
            </div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {isKhmer ? "រកមិនឃើញការជូនដំណឹងដែលត្រូវគ្នាទេ" : "No matching notifications"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isKhmer
                ? "សាកល្បងសម្អាតតម្រង ឬស្វែងរកពាក្យផ្សេងទៀត។"
                : "Try clearing active filters or searching a different keyword."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="ai-btn-secondary mt-4 h-9 gap-1.5 px-3.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សម្អាតតម្រង" : "Reset filters"}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groupedSections.map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between px-2 pb-1.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {group.label}
                  </h2>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {group.items.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-200/75 overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:divide-slate-800/80 dark:border-slate-800 dark:bg-obsidian-900">
                  {group.items.map((n) => {
                    const read = isNotificationRead(n);
                    const category = getNotificationCategory(n);
                    const level = getNotificationLevel(n);
                    const style = LEVEL_STYLES[level];
                    const VisualIcon = getNotificationVisualIcon(category, level, n.kind);
                    const message = getNotificationMessage(n);
                    const href = getNotificationHref(n);
                    const timeLabel = getNotificationTimeLabel(n, isKhmer);
                    const exactDate = parseNotificationDate(n.created_at);

                    return (
                      <article
                        key={n.id}
                        className={cn(
                          "relative flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-start sm:justify-between",
                          !read
                            ? "bg-indigo-50/45 dark:bg-indigo-500/[0.06]"
                            : "hover:bg-slate-50/75 dark:hover:bg-obsidian-800/40",
                        )}
                      >
                        {!read && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400"
                          />
                        )}

                        <div className="flex min-w-0 flex-1 items-start gap-3.5 pl-1">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                              style.iconBox,
                            )}
                          >
                            <VisualIcon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {!read && (
                                <span
                                  aria-label={isKhmer ? "មិនទាន់អាន" : "Unread"}
                                  className="h-2 w-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400"
                                />
                              )}
                              <h3
                                className={cn(
                                  "text-sm tracking-tight text-slate-900 dark:text-white",
                                  read ? "font-semibold" : "font-bold",
                                )}
                              >
                                {n.title}
                              </h3>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                                  style.badge,
                                )}
                              >
                                {getCategoryLabel(category, isKhmer)}
                              </span>
                            </div>

                            {message && (
                              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                {message}
                              </p>
                            )}

                            {timeLabel && (
                              <p
                                title={exactDate ? exactDate.toLocaleString() : undefined}
                                className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500"
                              >
                                {timeLabel}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-2 pl-14 sm:pl-0">
                          {href && (
                            <a
                              href={href}
                              onClick={() => handleOpenNotification(n)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-950 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                            >
                              <span>{isKhmer ? "បើក" : "Open"}</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {!read && (
                            <button
                              type="button"
                              disabled={markingId === n.id}
                              onClick={() => void handleMarkSeen([n.id])}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-60 dark:border-slate-700/80 dark:bg-obsidian-950 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                              title={isKhmer ? "សម្គាល់ថាបានអាន" : "Mark as read"}
                              aria-label={isKhmer ? "សម្គាល់ថាបានអាន" : "Mark as read"}
                            >
                              {markingId === n.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {isKhmer
                  ? `កំពុងបង្ហាញ ${items.length} ក្នុងចំណោម ${effectiveTotal}`
                  : `Showing ${items.length} of ${effectiveTotal}`}
              </span>
              {nextPage && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void handleLoadMore()}
                  className="ai-btn-secondary h-9 gap-1.5 px-4 text-xs"
                >
                  {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isKhmer ? "ផ្ទុកបន្ថែម" : "Load More"}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
