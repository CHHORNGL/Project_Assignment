import React, { useMemo, useState } from "react";
import { ArrowRight, Clock, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, statusBadgeClass } from "@/components/expert/ExpertShared";
import { AdminEmptyState, AdminSectionCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface PendingDiagnosesData {
  pendingCount: number;
  diagnoses: Array<{
    id: number;
    cropName: string;
    symptomsText: string;
    farmerName: string;
    status: string;
    statusLabel: string;
    createdAt?: string | null;
    reviewUrl: string;
  }>;
}

export default function ExpertPendingDiagnosesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<PendingDiagnosesData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const table = ui.table || {};
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return d.diagnoses;
    return d.diagnoses.filter(
      (item) =>
        item.cropName.toLowerCase().includes(q) ||
        item.farmerName.toLowerCase().includes(q) ||
        item.symptomsText.toLowerCase().includes(q) ||
        String(item.id).includes(q),
    );
  }, [d.diagnoses, query]);

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
                placeholder={
                  isKhmer
                    ? "ស្វែងរកកសិករ ដំណាំ ឬរោគសញ្ញា..."
                    : "Search farmer, crop, or symptom..."
                }
                className="ai-input py-2 pl-9 text-xs"
              />
            </div>
            <AdminStatusBadge tone="amber">
              <Clock className="mr-1 inline h-3 w-3" />
              {d.pendingCount} {ui.sections?.queue || "Pending"}
            </AdminStatusBadge>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={1} noPadding>
          {filtered.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<Clock className="h-5 w-5" />}
                title={table.emptyTitle || "No pending diagnoses"}
                description={table.emptyText}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="px-4 py-3 font-bold">{table.id || "ID"}</th>
                    <th className="px-4 py-3 font-bold">{table.crop || "Crop"}</th>
                    <th className="px-4 py-3 font-bold">{table.symptoms || "Symptoms"}</th>
                    <th className="px-4 py-3 font-bold">{table.farmer || "Farmer"}</th>
                    <th className="px-4 py-3 font-bold">{table.date || "Date"}</th>
                    <th className="px-4 py-3 text-right font-bold">{table.action || "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filtered.map((row) => (
                    <tr key={row.id} className="ai-table-row">
                      <td className="px-4 py-3 font-mono text-[#6e7891] dark:text-[#8a94ad]">
                        #{row.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                          {row.cropName || "-"}
                        </div>
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            statusBadgeClass(row.status),
                          )}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="max-w-md px-4 py-3 text-[#525b75] dark:text-[#9fa6bc]">
                        <p className="line-clamp-2">{row.symptomsText || "-"}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#31374a] dark:text-[#eff2f6]">
                        {row.farmerName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        {row.createdAt ? row.createdAt.slice(0, 16).replace("T", " ") : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a href={row.reviewUrl} className="ai-btn-primary h-8 px-3 text-xs">
                          {table.review || "Review"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
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
