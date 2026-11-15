import React, { useMemo, useState } from "react";
import { Bug, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";

interface AdminDiseasesData {
  createUrl: string;
  diseases: Array<{
    id: number;
    name: string;
    cropName: string;
    severityLabel: string;
    description: string;
    treatment: string;
    editUrl: string;
    deleteAction: string;
  }>;
}

function severityTone(label: string): AdminTone {
  const s = (label || "").toLowerCase();
  if (s.includes("high") || s.includes("crit") || s.includes("sev")) return "rose";
  if (s.includes("med") || s.includes("mod")) return "amber";
  return "emerald";
}

export default function AdminDiseasesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminDiseasesData>;
}) {
  const d = bootstrap.data;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return d.diseases;
    return d.diseases.filter(
      (item) => item.name.toLowerCase().includes(q) || item.cropName.toLowerCase().includes(q),
    );
  }, [d.diseases, query]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Disease
        </a>
      }
    >
      <div className="space-y-5">
        <AdminSectionCard delayIndex={0}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter diseases or crops..."
                className="ai-input py-2 pl-8 text-xs"
              />
            </div>
            <AdminStatusBadge tone="indigo">{filtered.length} entries</AdminStatusBadge>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          noPadding
          title="Disease Pathology Catalog"
          icon={<Bug className="h-4 w-4" />}
        >
          {filtered.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Bug className="h-5 w-5" />}
                title="No disease profiles match this filter"
                action={
                  <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add Disease
                  </a>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-obsidian-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Disease</th>
                    <th className="px-4 py-3 font-semibold">Crop</th>
                    <th className="px-4 py-3 font-semibold">Severity</th>
                    <th className="px-4 py-3 font-semibold">Treatment</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {filtered.map((item) => (
                    <tr key={item.id} className="ai-table-row">
                      <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        <AdminStatusBadge tone="slate">{item.cropName}</AdminStatusBadge>
                      </td>
                      <td className="px-4 py-3.5">
                        <AdminStatusBadge tone={severityTone(item.severityLabel)}>
                          {item.severityLabel || "Low"}
                        </AdminStatusBadge>
                      </td>
                      <td className="max-w-md px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        <p className="line-clamp-2">{item.treatment || item.description || "-"}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a href={item.editUrl} className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs">
                            <Pencil className="h-3 w-3" /> Edit
                          </a>
                          <form
                            method="POST"
                            action={item.deleteAction}
                            onSubmit={(e) => {
                              if (!window.confirm(`Delete "${item.name}"?`)) e.preventDefault();
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
      </div>
    </WorkspaceShell>
  );
}
