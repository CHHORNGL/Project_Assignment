import React, { useMemo, useState } from "react";
import { ArrowRight, MessageSquare, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
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
      <div className="space-y-5">
        <AdminSectionCard delayIndex={0}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94ad]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.search || "Search farmer chats..."}
                className="ai-input py-2 pl-9 text-xs"
              />
            </div>
            <AdminStatusBadge tone="indigo">
              {d.sessionCount} {labels.session || "Sessions"}
            </AdminStatusBadge>
          </div>
        </AdminSectionCard>

        {filtered.length === 0 ? (
          <AdminSectionCard delayIndex={1}>
            <AdminEmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title={labels.emptyTitle || "No farmer chats"}
              description={labels.emptyText}
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
                    <span className="font-mono text-[11px] text-[#8a94ad]">
                      {s.updatedAt ? s.updatedAt.slice(0, 16).replace("T", " ") : ""}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                    {s.farmerName}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {s.title}
                  </p>
                </div>
                <div className="mt-4 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                  <a href={s.replyUrl} className="ai-btn-primary h-9 w-full justify-center text-xs">
                    {labels.respond || "Respond Now"}
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
