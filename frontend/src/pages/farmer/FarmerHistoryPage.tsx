import React, { useMemo, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";

interface HistoryItem {
  id: number;
  cropName: string;
  diseaseName: string;
  status: string;
  statusLabel: string;
  confidence: number;
  symptoms: string;
  createdAt?: string | null;
  resultUrl: string;
}

interface HistoryData {
  mode: string;
  diagnoseUrl: string;
  diagnoses: HistoryItem[];
}

export default function FarmerHistoryPage({ bootstrap }: { bootstrap: AppBootstrap<HistoryData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.diagnoses.filter((item) => {
      if (statusFilter !== "ALL" && item.status.toUpperCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        item.cropName.toLowerCase().includes(q) ||
        item.diseaseName.toLowerCase().includes(q) ||
        item.symptoms.toLowerCase().includes(q)
      );
    });
  }, [d.diagnoses, query, statusFilter]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.diagnoseUrl} className="ai-btn-primary h-9 px-3 text-xs">
          <Plus className="h-3.5 w-3.5" />
          {isKhmer ? "វិនិច្ឆ័យថ្មី" : "New Diagnosis"}
        </a>
      }
    >
      <div className="space-y-4">
        <div className="ai-surface flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isKhmer ? "ស្វែងរកដំណាំ ឬជំងឺ..." : "Search crop, disease, symptom..."}
              className="ai-input py-2 pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "AUTO", "PENDING", "APPROVED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={statusFilter === st ? "ai-btn-primary h-8 px-3 text-xs" : "ai-btn-secondary h-8 px-3 text-xs"}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-surface overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">No matching diagnosis records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-obsidian-900">
                    <th className="px-4 py-3">Crop</th>
                    <th className="px-4 py-3">Diagnosis</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-obsidian-900/40">
                      <td className="px-4 py-3 font-semibold">{item.cropName}</td>
                      <td className="px-4 py-3">{item.diseaseName}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{item.confidence}%</td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a href={item.resultUrl} className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                          Report <ArrowRight className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
