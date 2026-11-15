import React from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface MarqueesData {
  addUrl: string;
  marquees: Array<{
    id: number;
    text: string;
    textKh: string;
    sortOrder: number;
    isActive: boolean;
    editUrl: string;
    deleteAction: string;
  }>;
}

export default function AdminMarqueesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MarqueesData>;
}) {
  const d = bootstrap.data;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.addUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Marquee
        </a>
      }
    >
      <AdminSectionCard
        delayIndex={0}
        noPadding
        title="Announcement Ticker Banners"
        subtitle="Manage bilingual notice strips displayed to workspace users"
        icon={<Megaphone className="h-4 w-4" />}
      >
        {d.marquees.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState
              icon={<Megaphone className="h-5 w-5" />}
              title="No announcement marquees configured yet"
              action={
                <a href={d.addUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Marquee
                </a>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-obsidian-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">English</th>
                  <th className="px-4 py-3 font-semibold">Khmer</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {d.marquees.map((m) => (
                  <tr key={m.id} className="ai-table-row">
                    <td className="px-5 py-3.5 font-mono text-slate-500">#{m.sortOrder}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                      {m.text}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                      {m.textKh || "-"}
                    </td>
                    <td className="px-4 py-3.5">
                      <AdminStatusBadge tone={m.isActive ? "emerald" : "slate"} pulse={m.isActive}>
                        {m.isActive ? "Active" : "Paused"}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a href={m.editUrl} className="ai-btn-secondary h-8 px-2.5 text-xs">
                          <Pencil className="h-3 w-3" />
                        </a>
                        <form
                          method="POST"
                          action={m.deleteAction}
                          onSubmit={(e) => {
                            if (!window.confirm("Delete this marquee?")) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                          <button
                            type="submit"
                            className="ai-btn-secondary h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionCard>
    </WorkspaceShell>
  );
}
