import React from "react";
import { Archive, RotateCcw } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface BackupsData {
  undoAction: string;
  backups: Array<{ id: number; section: string; createdAt?: string | null; summary: string }>;
}

export default function AdminTranslationsBackupsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<BackupsData>;
}) {
  const d = bootstrap.data;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <AdminSectionCard
        delayIndex={0}
        noPadding
        title="Translation Snapshots"
        subtitle="Roll back catalog localization edits to a prior checkpoint"
        icon={<Archive className="h-4 w-4" />}
        action={<AdminStatusBadge tone="indigo">{d.backups.length} snapshots</AdminStatusBadge>}
      >
        {d.backups.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState
              icon={<Archive className="h-5 w-5" />}
              title="No translation backups available yet"
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {d.backups.map((b) => (
              <div
                key={b.id}
                className="ai-table-row flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 dark:text-white">Backup #{b.id}</p>
                    <AdminStatusBadge tone="indigo">{b.section || "snapshot"}</AdminStatusBadge>
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-slate-300">{b.summary}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {b.createdAt ? b.createdAt.slice(0, 19).replace("T", " ") : ""}
                  </p>
                </div>
                <form method="POST" action={d.undoAction}>
                  <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                  <input type="hidden" name="backup_id" value={String(b.id)} />
                  <button type="submit" className="ai-btn-secondary h-8 gap-1.5 px-3.5 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </WorkspaceShell>
  );
}
