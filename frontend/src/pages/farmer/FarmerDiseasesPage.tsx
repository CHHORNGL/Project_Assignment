import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Search, Sprout } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";

interface AtlasData {
  crops: Array<{ id: number; name: string; description: string; diagnoseUrl: string }>;
  diseases: Array<{ id: number; cropId: number | null; cropName: string; name: string; description: string; treatment: string; severity: string }>;
}

export default function FarmerDiseasesPage({ bootstrap }: { bootstrap: AppBootstrap<AtlasData> }) {
  const d = bootstrap.data;
  const [search, setSearch] = useState("");
  const [selectedCrop, setSelectedCrop] = useState<number | "ALL">("ALL");

  const filteredDiseases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return d.diseases.filter((dis) => {
      if (selectedCrop !== "ALL" && dis.cropId !== selectedCrop) return false;
      if (!q) return true;
      return (
        dis.name.toLowerCase().includes(q) ||
        dis.cropName.toLowerCase().includes(q) ||
        dis.description.toLowerCase().includes(q)
      );
    });
  }, [d.diseases, search, selectedCrop]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        <div className="ai-surface flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search disease or crop..."
              className="ai-input py-2 pl-10 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCrop("ALL")}
              className={selectedCrop === "ALL" ? "ai-btn-primary h-8 px-3 text-xs" : "ai-btn-secondary h-8 px-3 text-xs"}
            >
              All Crops
            </button>
            {d.crops.map((crop) => (
              <button
                key={crop.id}
                type="button"
                onClick={() => setSelectedCrop(crop.id)}
                className={selectedCrop === crop.id ? "ai-btn-primary h-8 px-3 text-xs" : "ai-btn-secondary h-8 px-3 text-xs"}
              >
                {crop.name}
              </button>
            ))}
          </div>
        </div>

        {/* Crops Strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.crops.map((crop) => (
            <div key={crop.id} className="ai-surface flex flex-col justify-between p-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sprout className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-display text-sm font-bold">{crop.name}</h3>
                </div>
                {crop.description && <p className="line-clamp-2 text-xs text-slate-500">{crop.description}</p>}
              </div>
              <a href={crop.diagnoseUrl} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                Diagnose {crop.name} <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>

        {/* Disease Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDiseases.map((dis) => (
            <div key={dis.id} className="ai-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {dis.cropName || "General"}
                  </span>
                  <h3 className="mt-0.5 flex items-center gap-1.5 font-display text-base font-bold">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                    {dis.name}
                  </h3>
                </div>
                {dis.severity && (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                    {dis.severity}
                  </span>
                )}
              </div>
              {dis.description && <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{dis.description}</p>}
              {dis.treatment && (
                <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-700 dark:bg-obsidian-800 dark:text-slate-300">
                  <strong>Treatment:</strong> {dis.treatment}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}
