import React, { useState } from "react";
import { Bell, Check, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import type { AppBootstrap, NotificationItem } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { postJson, requestJson } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NotificationsPageData {
  items: NotificationItem[];
  nextPage: number | null;
  perPage: number;
  dataUrl: string;
  seenUrl: string;
}

export default function NotificationsPage({ bootstrap }: { bootstrap: AppBootstrap<NotificationsPageData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [items, setItems] = useState<NotificationItem[]>(d.items || []);
  const [nextPage, setNextPage] = useState<number | null>(d.nextPage ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const handleMarkSeen = async (ids?: number[]) => {
    if (!ids) setMarkingAll(true);
    try {
      const res = await postJson<{ ok?: boolean }>(
        d.seenUrl,
        ids ? { ids } : {},
        bootstrap.csrfToken,
      );
      if (res.ok && res.data.ok) {
        setItems((prev) =>
          prev.map((item) => (!ids || ids.includes(item.id) ? { ...item, is_read: true } : item)),
        );
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const sep = d.dataUrl.includes("?") ? "&" : "?";
      const res = await requestJson<{ ok?: boolean; items?: NotificationItem[]; next_page?: number | null }>(
        `${d.dataUrl}${sep}page=${nextPage}&per_page=${d.perPage}`,
        "GET",
      );
      if (res.ok && res.data.ok) {
        setItems((prev) => [...prev, ...(res.data.items || [])]);
        setNextPage(res.data.next_page ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        unreadCount > 0 ? (
          <button
            type="button"
            disabled={markingAll}
            onClick={() => handleMarkSeen()}
            className="ai-btn-secondary h-9 px-3 text-xs"
          >
            {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {isKhmer ? "សម្គាល់ថាបានអានទាំងអស់" : "Mark All Read"}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="ai-surface flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              <Bell className="h-6 w-6" />
            </div>
            <h2 className="font-display text-base font-bold">
              {isKhmer ? "មិនទាន់មានការជូនដំណឹងទេ" : "No notifications yet"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isKhmer ? "ការជូនដំណឹងថ្មីៗនឹងបង្ហាញនៅទីនេះ។" : "Updates on diagnoses and team replies appear here."}
            </p>
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "ai-surface flex flex-col justify-between gap-3 p-4 transition sm:flex-row sm:items-center",
                !n.is_read && "border-indigo-500/40 bg-indigo-500/[0.03]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
                  <h3 className="text-sm font-bold">{n.title}</h3>
                  {n.created_at && (
                    <span className="text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString()}</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{n.message}</p>
              </div>
              <div className="flex items-center gap-2">
                {n.link && (
                  <a href={n.link} className="ai-btn-secondary h-8 px-3 text-xs">
                    {isKhmer ? "បើក" : "Open"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkSeen([n.id])}
                    className="ai-btn-secondary h-8 px-2.5 text-xs"
                    title={isKhmer ? "សម្គាល់ថាបានអាន" : "Mark read"}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {nextPage && (
          <div className="flex justify-center pt-2">
            <button type="button" disabled={loadingMore} onClick={handleLoadMore} className="ai-btn-secondary">
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {isKhmer ? "ផ្ទុកបន្ថែម" : "Load More"}
            </button>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
