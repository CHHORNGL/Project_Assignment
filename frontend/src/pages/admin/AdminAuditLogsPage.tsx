import React, { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface AuditLogsData {
  logs: Array<{
    id: number;
    action: string;
    targetUser: string;
    detail: string;
    actorName: string;
    createdAt?: string | null;
  }>;
}

export default function AdminAuditLogsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AuditLogsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return d.logs;
    return d.logs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.targetUser.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q),
    );
  }, [d.logs, query]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-5">
        <AdminSectionCard delayIndex={0}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isKhmer
                    ? "ស្វែងរកសកម្មភាព អ្នកប្រើ ឬព័ត៌មាន..."
                    : "Filter by action, actor, target, or detail..."
                }
                className="ai-input py-2 pl-9 text-xs"
              />
            </div>
            <AdminStatusBadge tone="indigo">{filtered.length} logs</AdminStatusBadge>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={1} noPadding title="Audit Trail" icon={<ScrollText className="h-4 w-4" />}>
          {filtered.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<ScrollText className="h-5 w-5" />}
                title="No matching audit entries"
                description="Try another filter keyword to inspect system activity."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-obsidian-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Actor</th>
                    <th className="px-4 py-3 font-semibold">Target</th>
                    <th className="px-4 py-3 font-semibold">Detail</th>
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {filtered.map((log) => (
                    <tr key={log.id} className="ai-table-row">
                      <td className="px-5 py-3.5 font-mono text-slate-400">{log.id}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-lg bg-indigo-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                        {log.actorName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {log.targetUser || "-"}
                      </td>
                      <td className="max-w-md px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {log.detail || "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-slate-400">
                        {log.createdAt ? log.createdAt.slice(0, 19).replace("T", " ") : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
