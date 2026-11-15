import React from "react";
import { Archive, Languages, Save, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface TranslationsData {
  currentSection: string;
  q: string;
  missingOnly: boolean;
  formAction: string;
  backupsUrl: string;
  crops: Array<{ id: number; name: string; nameKh: string; description: string; descriptionKh: string }>;
  diseases: Array<{
    id: number;
    name: string;
    nameKh: string;
    description: string;
    descriptionKh: string;
    treatment: string;
    treatmentKh: string;
  }>;
  symptoms: Array<{ id: number; name: string; nameKh: string; description: string; descriptionKh: string }>;
}

export default function AdminTranslationsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<TranslationsData>;
}) {
  const d = bootstrap.data;
  const activeTab = d.currentSection || "crops";
  const currentListCount =
    activeTab === "crops"
      ? d.crops.length
      : activeTab === "diseases"
        ? d.diseases.length
        : d.symptoms.length;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.backupsUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
          <Archive className="h-3.5 w-3.5" /> Backups
        </a>
      }
    >
      <div className="space-y-5">
        <AdminSectionCard delayIndex={0}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-obsidian-950/70">
              {(["crops", "diseases", "symptoms"] as const).map((sec) => {
                const isActive = activeTab === sec;
                return (
                  <a
                    key={sec}
                    href={`${d.formAction}?section=${sec}&q=${encodeURIComponent(d.q)}&missing=${d.missingOnly ? "1" : "0"}`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold capitalize transition-all duration-200",
                      isActive
                        ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/70 dark:bg-obsidian-800 dark:text-indigo-300 dark:ring-slate-700/80"
                        : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-obsidian-850 dark:hover:text-slate-200",
                    )}
                  >
                    <span>{sec}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        isActive
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                          : "bg-slate-200/80 text-slate-600 dark:bg-obsidian-800 dark:text-slate-400",
                      )}
                    >
                      {d[sec].length}
                    </span>
                  </a>
                );
              })}
            </div>

            <form method="GET" action={d.formAction} className="flex flex-wrap items-center gap-2.5">
              <input type="hidden" name="section" value={activeTab} />
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={d.q}
                  placeholder="Filter entries..."
                  className="ai-input h-9 py-1 pl-8 text-xs"
                />
              </div>
              <label className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-medium dark:border-slate-800 dark:bg-obsidian-950/60">
                <input type="checkbox" name="missing" value="1" defaultChecked={d.missingOnly} className="rounded" />
                Missing Khmer only
              </label>
              <button type="submit" className="ai-btn-primary h-9 px-3.5 text-xs">
                Filter
              </button>
            </form>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          title={`Khmer Localization Editor — ${activeTab}`}
          subtitle="Update Khmer labels alongside English reference descriptions"
          icon={<Languages className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-4">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
            <input type="hidden" name="section" value={activeTab} />
            <input type="hidden" name="q" value={d.q} />
            <input type="hidden" name="missing" value={d.missingOnly ? "1" : "0"} />

            {currentListCount === 0 ? (
              <AdminEmptyState
                icon={<Languages className="h-5 w-5" />}
                title="No entries match this filter"
                description="All visible items may already be translated, or widen your search."
              />
            ) : (
              <div key={activeTab} className="ai-tab-panel space-y-3">
                {activeTab === "crops" &&
                  d.crops.map((c) => (
                    <div
                      key={c.id}
                      className="ai-card-hover grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-obsidian-950/50 md:grid-cols-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{c.description || "-"}</p>
                      </div>
                      <input
                        type="text"
                        name={`crop_name_kh_${c.id}`}
                        defaultValue={c.nameKh}
                        placeholder="Khmer name..."
                        className="ai-input text-xs"
                      />
                      <input
                        type="text"
                        name={`crop_desc_kh_${c.id}`}
                        defaultValue={c.descriptionKh}
                        placeholder="Khmer description..."
                        className="ai-input text-xs"
                      />
                    </div>
                  ))}

                {activeTab === "diseases" &&
                  d.diseases.map((dis) => (
                    <div
                      key={dis.id}
                      className="ai-card-hover grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-obsidian-950/50 md:grid-cols-4"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{dis.name}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                          {dis.description || "-"}
                        </p>
                      </div>
                      <input
                        type="text"
                        name={`disease_name_kh_${dis.id}`}
                        defaultValue={dis.nameKh}
                        placeholder="Khmer name..."
                        className="ai-input text-xs"
                      />
                      <textarea
                        name={`disease_desc_kh_${dis.id}`}
                        rows={2}
                        defaultValue={dis.descriptionKh}
                        placeholder="Khmer description..."
                        className="ai-input text-xs"
                      />
                      <textarea
                        name={`disease_treatment_kh_${dis.id}`}
                        rows={2}
                        defaultValue={dis.treatmentKh}
                        placeholder="Khmer treatment..."
                        className="ai-input text-xs"
                      />
                    </div>
                  ))}

                {activeTab === "symptoms" &&
                  d.symptoms.map((sym) => (
                    <div
                      key={sym.id}
                      className="ai-card-hover grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-obsidian-950/50 md:grid-cols-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{sym.name}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{sym.description || "-"}</p>
                      </div>
                      <input
                        type="text"
                        name={`symptom_name_kh_${sym.id}`}
                        defaultValue={sym.nameKh}
                        placeholder="Khmer name..."
                        className="ai-input text-xs"
                      />
                      <input
                        type="text"
                        name={`symptom_desc_kh_${sym.id}`}
                        defaultValue={sym.descriptionKh}
                        placeholder="Khmer description..."
                        className="ai-input text-xs"
                      />
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-200/70 pt-4 dark:border-slate-800/80">
              <button type="submit" className="ai-btn-primary gap-1.5 px-6 text-xs">
                <Save className="h-3.5 w-3.5" /> Save Translations ({activeTab})
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
