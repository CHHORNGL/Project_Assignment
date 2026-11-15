import React, { useMemo, useState } from "react";
import { Pencil, Plus, Search, Sprout, Trash2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface CropsData {
  createUrl: string;
  crops: Array<{
    id: number;
    name: string;
    nameKh: string;
    emoji: string;
    description: string;
    descriptionKh: string;
    editUrl: string;
    deleteAction: string;
  }>;
}

export default function AdminCropsPage({ bootstrap }: { bootstrap: AppBootstrap<CropsData> }) {
  const d = bootstrap.data;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return d.crops;
    return d.crops.filter(
      (c) => c.name.toLowerCase().includes(q) || c.nameKh.toLowerCase().includes(q),
    );
  }, [d.crops, query]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Crop
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
                placeholder="Search crops..."
                className="ai-input py-2 pl-8 text-xs"
              />
            </div>
            <AdminStatusBadge tone="emerald">{filtered.length} crops</AdminStatusBadge>
          </div>
        </AdminSectionCard>

        {filtered.length === 0 ? (
          <AdminEmptyState
            icon={<Sprout className="h-5 w-5" />}
            title="No crops found"
            description="Adjust your search filter or add a new crop variety."
            action={
              <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Crop
              </a>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((crop, idx) => (
              <div
                key={crop.id}
                style={{ ["--stagger" as string]: Math.min(idx + 1, 10) }}
                className="ai-surface ai-card-hover ai-stagger flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl ring-1 ring-emerald-500/20 dark:bg-emerald-500/15">
                      {crop.emoji || "🌱"}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                        {crop.name}
                      </h3>
                      {crop.nameKh && (
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {crop.nameKh}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {crop.description || crop.descriptionKh || "-"}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200/70 pt-3.5 dark:border-slate-800/80">
                  <a href={crop.editUrl} className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs">
                    <Pencil className="h-3 w-3" /> Edit
                  </a>
                  <form
                    method="POST"
                    action={crop.deleteAction}
                    onSubmit={(e) => {
                      if (!window.confirm(`Delete "${crop.name}"?`)) e.preventDefault();
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
              </div>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
