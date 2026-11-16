import React, { useEffect, useState } from "react";
import { BarChart3, Database, Eye, FileText, X } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, PaginationBar, type PaginationInfo } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface MixedFactPreview {
  id: number;
  sourceTitle: string;
  topic: string;
  region: string;
  factText: string;
}

interface MixedAgriDashboardData {
  metrics: { sourceCount: number; factCount: number };
  filters: { perPage: number };
  pagination: PaginationInfo;
  facts: MixedFactPreview[];
  links: { dashboardUrl: string; sourcesUrl: string; factsUrl: string };
  options: { perPage: number[] };
}

export default function ExpertMixedAgriDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MixedAgriDashboardData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const labels = ui.labels || {};

  const [inspectFact, setInspectFact] = useState<MixedFactPreview | null>(null);

  useEffect(() => {
    if (!inspectFact) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectFact(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectFact]);

  const avgFactsPerSource =
    d.metrics.sourceCount > 0 ? (d.metrics.factCount / d.metrics.sourceCount).toFixed(1) : "0.0";

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
            label={metrics.sources || "Sources"}
            hint={metrics.sourcesMeta || (isKhmer ? "គ្រប់គ្រងប្រភពឯកសារ" : "Manage cited references")}
            value={d.metrics.sourceCount}
            icon={<Database className="h-5 w-5" />}
            tone="indigo"
            href={d.links.sourcesUrl}
          />
          <AdminKpiCard
            delayIndex={1}
            label={metrics.facts || "Facts"}
            hint={metrics.factsMeta || (isKhmer ? "ទិន្នន័យកសិកម្មផ្ទៀងផ្ទាត់" : "Verified agronomy facts")}
            value={d.metrics.factCount}
            icon={<FileText className="h-5 w-5" />}
            tone="emerald"
            href={d.links.factsUrl}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "មធ្យមភាគទិន្នន័យ / ប្រភព" : "Facts per Source"}
            hint={isKhmer ? "កម្រិតដង់ស៊ីតេចំណេះដឹង" : "Average corpus density"}
            value={avgFactsPerSource}
            icon={<BarChart3 className="h-5 w-5" />}
            tone="sky"
          />
        </div>

        <AdminSectionCard
          delayIndex={1}
          noPadding
          title={sections.library || "Facts Library"}
          subtitle={sections.librarySubtitle}
          icon={<FileText className="h-4 w-4" />}
          action={
            <form method="GET" action={d.links.dashboardUrl} className="flex items-center gap-2">
              <label className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                {sections.density || "Per page"}
              </label>
              <select
                name="per_page"
                defaultValue={String(d.filters.perPage)}
                className="ai-input h-8 w-20 py-1 text-xs"
              >
                {d.options.perPage.map((opt) => (
                  <option key={opt} value={String(opt)}>
                    {opt}
                  </option>
                ))}
              </select>
              <button type="submit" className="ai-btn-secondary h-8 px-3 text-xs">
                {labels.apply || "Apply"}
              </button>
            </form>
          }
        >
          {d.facts.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<FileText className="h-5 w-5" />}
                title={labels.noFactsAdded || "No facts added yet."}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                    <tr>
                      <th className="px-4 py-3 font-bold">{labels.id || "ID"}</th>
                      <th className="px-4 py-3 font-bold">{labels.source || "Source"}</th>
                      <th className="px-4 py-3 font-bold">{labels.topic || "Topic"}</th>
                      <th className="px-4 py-3 font-bold">{labels.region || "Region"}</th>
                      <th className="px-4 py-3 font-bold">{labels.fact || "Fact"}</th>
                      <th className="px-4 py-3 text-right font-bold">{labels.view || ""}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.facts.map((fact) => (
                      <tr key={fact.id} className="ai-table-row align-top">
                        <td className="px-4 py-3.5 font-mono text-[#6e7891] dark:text-[#8a94ad]">
                          #{fact.id}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-[#141824] dark:text-[#eff2f6]">
                          {fact.sourceTitle}
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone="indigo">{fact.topic}</AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5 text-[#6e7891] dark:text-[#8a94ad]">
                          {fact.region || "-"}
                        </td>
                        <td className="max-w-lg px-4 py-3.5 text-[#31374a] dark:text-[#eff2f6]">
                          <p className="line-clamp-2 leading-relaxed">{fact.factText}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectFact(fact)}
                            className="ai-btn-secondary h-7 px-2.5 text-[11px]"
                            title={isKhmer ? "អានលម្អិត" : "Read full fact"}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 pb-4">
                <PaginationBar
                  pagination={d.pagination}
                  showingRange={labels.showingRange}
                  pageOf={labels.pageOf}
                  prevLabel={labels.prev}
                  nextLabel={labels.next}
                  baseUrl={d.links.dashboardUrl}
                />
              </div>
            </>
          )}
        </AdminSectionCard>
      </div>

      {inspectFact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f111a]/55 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectFact(null);
          }}
        >
          <div className="ai-surface animate-fade-in-up w-full max-w-lg overflow-hidden rounded-2xl border border-[#cbd0dd] bg-white shadow-2xl dark:border-[#373e53] dark:bg-[#141824]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ed] px-5 py-4 dark:border-[#2b3245]">
              <div>
                <div className="flex items-center gap-2">
                  <AdminStatusBadge tone="indigo">{inspectFact.topic}</AdminStatusBadge>
                  <span className="font-mono text-xs text-[#8a94ad]">#{inspectFact.id}</span>
                </div>
                <h3 className="mt-2 font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {inspectFact.sourceTitle}
                </h3>
                {inspectFact.region && (
                  <p className="mt-0.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {inspectFact.region}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectFact(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8a94ad] hover:bg-[#eff2f6] hover:text-[#141824] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#31374a] dark:text-[#cbd0dd]">
                {inspectFact.factText}
              </p>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
