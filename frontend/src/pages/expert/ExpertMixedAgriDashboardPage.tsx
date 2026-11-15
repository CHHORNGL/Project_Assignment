import React from "react";
import { Database, FileText } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, PaginationBar, type PaginationInfo } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
  PhoenixSummaryStrip,
} from "@/components/admin/AdminPrimitives";

interface MixedAgriDashboardData {
  metrics: { sourceCount: number; factCount: number };
  filters: { perPage: number };
  pagination: PaginationInfo;
  facts: Array<{
    id: number;
    sourceTitle: string;
    topic: string;
    region: string;
    factText: string;
  }>;
  links: { dashboardUrl: string; sourcesUrl: string; factsUrl: string };
  options: { perPage: number[] };
}

export default function ExpertMixedAgriDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MixedAgriDashboardData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const labels = ui.labels || {};

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        <PhoenixSummaryStrip
          items={[
            {
              label: metrics.sources || "Sources",
              hint: metrics.sourcesMeta,
              value: d.metrics.sourceCount,
              icon: <Database className="h-5 w-5" />,
              tone: "indigo",
              href: d.links.sourcesUrl,
            },
            {
              label: metrics.facts || "Facts",
              hint: metrics.factsMeta,
              value: d.metrics.factCount,
              icon: <FileText className="h-5 w-5" />,
              tone: "emerald",
              href: d.links.factsUrl,
            },
          ]}
        />

        <AdminSectionCard
          delayIndex={1}
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
          <div className="space-y-4">
            {d.facts.length === 0 ? (
              <AdminEmptyState
                icon={<FileText className="h-5 w-5" />}
                title={labels.noFactsAdded || "No facts added yet."}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                    <tr>
                      <th className="px-4 py-3 font-bold">{labels.id || "ID"}</th>
                      <th className="px-4 py-3 font-bold">{labels.source || "Source"}</th>
                      <th className="px-4 py-3 font-bold">{labels.topic || "Topic"}</th>
                      <th className="px-4 py-3 font-bold">{labels.region || "Region"}</th>
                      <th className="px-4 py-3 font-bold">{labels.fact || "Fact"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.facts.map((fact) => (
                      <tr key={fact.id} className="ai-table-row">
                        <td className="px-4 py-3 font-mono text-[#6e7891] dark:text-[#8a94ad]">
                          #{fact.id}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#141824] dark:text-[#eff2f6]">
                          {fact.sourceTitle}
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusBadge tone="indigo">{fact.topic}</AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3 text-[#6e7891] dark:text-[#8a94ad]">
                          {fact.region}
                        </td>
                        <td className="max-w-lg px-4 py-3 text-[#31374a] dark:text-[#eff2f6]">
                          {fact.factText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationBar
              pagination={d.pagination}
              showingRange={labels.showingRange}
              pageOf={labels.pageOf}
              prevLabel={labels.prev}
              nextLabel={labels.next}
              baseUrl={d.links.dashboardUrl}
            />
          </div>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
