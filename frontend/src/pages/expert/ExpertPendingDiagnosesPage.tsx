import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Filter, Sprout } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertHeaderActions,
  ExpertSearchField,
  formatShortDateTime,
  statusBadgeClass,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
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
  const [cropFilter, setCropFilter] = useState("all");

  const crops = useMemo(() => {
    const unique = new Set<string>();
    for (const item of d.diagnoses) {
      if (item.cropName && item.cropName !== "-") unique.add(item.cropName);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [d.diagnoses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.diagnoses.filter((item) => {
      if (cropFilter !== "all" && item.cropName !== cropFilter) return false;
      if (!q) return true;
      return (
        item.cropName.toLowerCase().includes(q) ||
        item.farmerName.toLowerCase().includes(q) ||
        item.symptomsText.toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    });
  }, [d.diagnoses, query, cropFilter]);

  const hasFilters = query.trim().length > 0 || cropFilter !== "all";

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminKpiCard
            delayIndex={0}
            label={ui.sections?.queue || (isKhmer ? "ករណីរង់ចាំសរុប" : "Pending Queue")}
            value={d.pendingCount}
            hint={isKhmer ? "ករណីរង់ចាំការវាយតម្លៃ" : "Cases awaiting clinical review"}
            icon={<Clock className="h-5 w-5" />}
            tone="amber"
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "ប្រភេទដំណាំ" : "Affected Crops"}
            value={crops.length}
            hint={isKhmer ? "ដំណាំខុសៗគ្នាក្នុងជួរ" : "Distinct crops in queue"}
            icon={<Sprout className="h-5 w-5" />}
            tone="emerald"
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "កំពុងបង្ហាញ" : "Filtered Results"}
            value={filtered.length}
            hint={hasFilters ? (isKhmer ? "បានច្រោះរួច" : "Active filter applied") : (isKhmer ? "បង្ហាញទាំងអស់" : "All queue items")}
            icon={<Filter className="h-5 w-5" />}
            tone="indigo"
          />
        </div>

        <AdminSectionCard delayIndex={1} noPadding>
          {/* Integrated Search & Crop Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] px-4 py-3 dark:border-[#2b3245] sm:px-5 sm:py-3.5">
            <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2.5">
              <ExpertSearchField
                value={query}
                onChange={setQuery}
                placeholder={
                  isKhmer
                    ? "ស្វែងរកលេខករណី កសិករ ដំណាំ ឬរោគសញ្ញា..."
                    : "Search case ID, farmer, crop, or symptom..."
                }
                className="min-w-0 sm:w-80"
              />
              {crops.length > 0 && (
                <select
                  value={cropFilter}
                  onChange={(e) => setCropFilter(e.target.value)}
                  aria-label={isKhmer ? "ច្រោះតាមដំណាំ" : "Filter by crop"}
                  className="ai-input h-9 w-full min-w-0 py-1 text-xs sm:w-auto sm:min-w-[150px]"
                >
                  <option value="all">{isKhmer ? "ដំណាំទាំងអស់" : "All crops"}</option>
                  {crops.map((crop) => (
                    <option key={crop} value={crop}>
                      {crop}
                    </option>
                  ))}
                </select>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCropFilter("all");
                  }}
                  className="ai-btn-secondary h-9 px-3 text-xs"
                >
                  {isKhmer ? "សម្អាត" : "Clear"}
                </button>
              )}
            </div>
            <AdminStatusBadge tone="amber" pulse={d.pendingCount > 0}>
              {filtered.length} / {d.pendingCount}
            </AdminStatusBadge>
          </div>

          {filtered.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={hasFilters ? <Filter className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                title={
                  hasFilters
                    ? isKhmer
                      ? "មិនមានករណីត្រូវនឹងការច្រោះទេ"
                      : "No cases match your filters"
                    : table.emptyTitle || "No pending diagnoses"
                }
                description={
                  hasFilters
                    ? isKhmer
                      ? "សូមសាកល្បងសម្អាតពាក្យស្វែងរក ឬជ្រើសរើសដំណាំទាំងអស់។"
                      : "Try clearing the search query or switching back to all crops."
                    : table.emptyText
                }
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCropFilter("all");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញករណីទាំងអស់" : "Reset filters"}
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Mobile Pending Queue Cards */}
              <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245] sm:hidden">
                {filtered.map((row) => (
                  <div key={row.id} className="space-y-2.5 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-[#525b75] dark:text-[#9fa6bc]">
                          #{row.id}
                        </span>
                        <span className="font-bold text-[#141824] dark:text-[#eff2f6]">
                          {row.cropName || "-"}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          statusBadgeClass(row.status),
                        )}
                      >
                        {row.statusLabel}
                      </span>
                    </div>

                    <p className="line-clamp-3 [overflow-wrap:anywhere] leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                      {row.symptomsText || "-"}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e5edff] text-[11px] font-bold text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                          {(row.farmerName || "?").slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate font-semibold text-[#31374a] dark:text-[#eff2f6]">
                          {row.farmerName}
                        </span>
                      </div>
                      <span className="font-mono text-[#6e7891] dark:text-[#8a94ad]">
                        {formatShortDateTime(row.createdAt)}
                      </span>
                    </div>

                    <a href={row.reviewUrl} className="ai-btn-primary h-9 w-full justify-center gap-1.5 text-xs">
                      <span>{table.review || "Review"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>

              {/* Desktop Queue Table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                    <tr>
                      <th className="px-4 py-3 font-bold">{table.id || "Case"}</th>
                      <th className="px-4 py-3 font-bold">{table.crop || "Crop"}</th>
                      <th className="px-4 py-3 font-bold">{table.symptoms || "Observed Symptoms"}</th>
                      <th className="px-4 py-3 font-bold">{table.farmer || "Farmer"}</th>
                      <th className="px-4 py-3 font-bold">{table.date || "Submitted"}</th>
                      <th className="px-4 py-3 text-right font-bold">{table.action || "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {filtered.map((row) => (
                      <tr key={row.id} className="ai-table-row">
                        <td className="px-4 py-3.5 font-mono font-semibold text-[#525b75] dark:text-[#9fa6bc]">
                          #{row.id}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[#141824] dark:text-[#eff2f6]">
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
                        <td className="max-w-md px-4 py-3.5 text-[#525b75] dark:text-[#9fa6bc]">
                          <p className="line-clamp-2 leading-relaxed">{row.symptomsText || "-"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e5edff] text-[11px] font-bold text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                              {(row.farmerName || "?").slice(0, 1).toUpperCase()}
                            </span>
                            <span className="font-semibold text-[#31374a] dark:text-[#eff2f6]">
                              {row.farmerName}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          {formatShortDateTime(row.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <a href={row.reviewUrl} className="ai-btn-primary h-8 gap-1.5 px-3 text-xs">
                            <span>{table.review || "Review"}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
