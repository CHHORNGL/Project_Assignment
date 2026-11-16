import React, { useMemo, useState } from "react";
import { ArrowRight, Clock, MessageSquare, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertHeaderActions,
  ExpertSearchField,
  formatShortDateTime,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface FarmerChatsData {
  sessionCount: number;
  sessions: Array<{
    id: number;
    farmerName: string;
    title: string;
    updatedAt?: string | null;
    replyUrl: string;
  }>;
}

export default function ExpertFarmerChatsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<FarmerChatsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return d.sessions;
    return d.sessions.filter(
      (s) =>
        s.farmerName.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        String(s.id).includes(q),
    );
  }, [d.sessions, query]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminKpiCard
            delayIndex={0}
            label={labels.session || (isKhmer ? "វគ្គសន្ទនាសរុប" : "Active Chat Sessions")}
            value={d.sessionCount}
            hint={isKhmer ? "កសិករកំពុងរង់ចាំការឆ្លើយតប" : "Farmer inquiry threads available"}
            icon={<MessageSquare className="h-5 w-5" />}
            tone="indigo"
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "កំពុងបង្ហាញ" : "Visible Threads"}
            value={filtered.length}
            hint={
              query.trim()
                ? isKhmer
                  ? "លទ្ធផលតាមពាក្យស្វែងរក"
                  : "Filtered by search query"
                : isKhmer
                  ? "បង្ហាញការសន្ទនាទាំងអស់"
                  : "All sessions shown"
            }
            icon={<Search className="h-5 w-5" />}
            tone="emerald"
          />
        </div>

        <AdminSectionCard delayIndex={1}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ExpertSearchField
              value={query}
              onChange={setQuery}
              placeholder={labels.search || "Search farmer, topic, or session ID..."}
              className="sm:w-80"
            />
            <div className="flex items-center gap-2">
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="ai-btn-secondary h-8 px-2.5 text-xs"
                >
                  {isKhmer ? "សម្អាត" : "Clear"}
                </button>
              )}
              <AdminStatusBadge tone="indigo">
                {filtered.length} / {d.sessionCount}
              </AdminStatusBadge>
            </div>
          </div>
        </AdminSectionCard>

        {filtered.length === 0 ? (
          <AdminSectionCard delayIndex={2}>
            <AdminEmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title={
                query.trim()
                  ? isKhmer
                    ? "រកមិនឃើញការសន្ទនាទេ"
                    : "No matching farmer chats"
                  : labels.emptyTitle || "No farmer chats"
              }
              description={
                query.trim()
                  ? isKhmer
                    ? "សូមសម្អាតពាក្យស្វែងរក ដើម្បីមើលវគ្គសន្ទនាទាំងអស់។"
                    : "Try clearing your search filter to view all threads."
                  : labels.emptyText
              }
              action={
                query.trim() ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="ai-btn-secondary h-8 px-3 text-xs"
                  >
                    {isKhmer ? "សម្អាត" : "Clear search"}
                  </button>
                ) : undefined
              }
            />
          </AdminSectionCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="ai-surface ai-card-hover flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <AdminStatusBadge tone="indigo">#{s.id}</AdminStatusBadge>
                    {s.updatedAt && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#8a94ad]">
                        <Clock className="h-3 w-3" />
                        {formatShortDateTime(s.updatedAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3.5 flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e5edff] font-display text-sm font-bold text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                      {(s.farmerName || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                        {s.farmerName}
                      </h3>
                      <p className="truncate text-xs text-[#6e7891] dark:text-[#8a94ad]">
                        {s.title}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                  <a href={s.replyUrl} className="ai-btn-primary h-9 w-full justify-center gap-1.5 text-xs">
                    <span>{labels.respond || "Respond Now"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
