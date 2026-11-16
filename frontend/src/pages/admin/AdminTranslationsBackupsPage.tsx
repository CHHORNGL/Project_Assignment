import React, { useEffect, useState } from "react";
import { Archive, ArrowLeft, Clock, RotateCcw, ShieldAlert } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";

interface BackupRow {
  id: number;
  section: string;
  createdAt?: string | null;
  summary: string;
}

interface BackupsData {
  backUrl?: string;
  undoAction: string;
  backups: BackupRow[];
}

function scopeTone(scope: string): AdminTone {
  switch ((scope || "").toLowerCase()) {
    case "crops":
      return "emerald";
    case "diseases":
      return "indigo";
    case "symptoms":
      return "sky";
    case "all":
      return "amber";
    default:
      return "slate";
  }
}

export default function AdminTranslationsBackupsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<BackupsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const [pendingRestore, setPendingRestore] = useState<BackupRow | null>(null);

  useEffect(() => {
    if (!pendingRestore) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingRestore(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingRestore]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        d.backUrl && (
          <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isKhmer ? "ត្រឡប់ទៅស្ទូឌីយោបកប្រែ" : "Back to Studio"}</span>
          </a>
        )
      }
    >
      <AdminSectionCard
        delayIndex={0}
        noPadding
        title={isKhmer ? "កំណែបម្រុងទុកការបកប្រែ" : "Translation Snapshots"}
        subtitle={
          isKhmer
            ? "ស្តារការបកប្រែភាសាខ្មែរទៅកាន់កំណែមុនពេលកែប្រែ ឬនាំចូលឯកសារ"
            : "Roll back catalog localization edits to a prior checkpoint (up to 20 retained)"
        }
        icon={<Archive className="h-4 w-4" />}
        action={
          <AdminStatusBadge tone="indigo">
            {d.backups.length} {isKhmer ? "កំណែ" : "snapshots"}
          </AdminStatusBadge>
        }
      >
        {d.backups.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState
              icon={<Archive className="h-5 w-5" />}
              title={isKhmer ? "មិនទាន់មានកំណែបម្រុងទុកទេ" : "No translation snapshots yet"}
              description={
                isKhmer
                  ? "កំណែបម្រុងទុកនឹងត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិនៅពេលអ្នករក្សាទុក ឬនាំចូលការបកប្រែ។"
                  : "Snapshots are captured automatically whenever you save inline edits or import CSV/ZIP archives."
              }
              action={
                d.backUrl ? (
                  <a href={d.backUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "ទៅកាន់ស្ទូឌីយោ" : "Open Translations Studio"}</span>
                  </a>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
            {d.backups.map((b) => (
              <div
                key={b.id}
                className="ai-table-row flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                      Snapshot #{b.id}
                    </span>
                    <AdminStatusBadge tone={scopeTone(b.section)}>
                      {b.section || "snapshot"}
                    </AdminStatusBadge>
                  </div>
                  <p className="text-xs text-[#31374a] dark:text-[#cbd0dd]">{b.summary}</p>
                  <p
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]"
                    title={b.createdAt || undefined}
                  >
                    <Clock className="h-3 w-3" />
                    <span>{formatAccountTimestamp(b.createdAt)}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPendingRestore(b)}
                  className="ai-btn-secondary h-8 gap-1.5 px-3.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "ស្តារឡើងវិញ" : "Restore"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminSectionCard>

      {pendingRestore && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-snapshot-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingRestore(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-xl dark:border-[#2b3245] dark:bg-[#141824] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffefca] text-[#bc3803] ring-1 ring-[#e5780b]/25 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="restore-snapshot-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការស្តារកំណែបកប្រែ" : "Restore Translation Snapshot"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      ស្តារការបកប្រែពី <strong>Snapshot #{pendingRestore.id}</strong> (
                      {pendingRestore.section})? តម្លៃបច្ចុប្បន្នក្នុងផ្នែកនេះនឹងត្រូវជំនួសដោយកំណែបម្រុងទុកនេះ។
                    </>
                  ) : (
                    <>
                      Restore Khmer text from <strong>Snapshot #{pendingRestore.id}</strong> (
                      {pendingRestore.section})? Matching entries will revert to this checkpoint.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <form method="POST" action={d.undoAction}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="backup_id" value={String(pendingRestore.id)} />
                <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "ស្តារឡើងវិញ" : "Restore Snapshot"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
