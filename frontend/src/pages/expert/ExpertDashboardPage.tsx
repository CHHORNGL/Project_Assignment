import React from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  MessageSquare,
  XCircle,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, statusBadgeClass, statusTone } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
  PhoenixSummaryStrip,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface ExpertDashboardData {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  chatCount: number;
  chartLabels: string[];
  chartValues: number[];
  pipeline: Array<{ key: string; label: string; value: number; percent: number }>;
  diagnoses: Array<{
    id: number;
    cropName: string;
    diseaseName: string;
    status: string;
    statusLabel: string;
    confidence: number;
    farmerName: string;
    createdAt?: string | null;
    reviewUrl: string;
  }>;
  autoCases: Array<{
    id: number;
    cropName: string;
    diseaseName: string;
    status: string;
    statusLabel: string;
    confidence: number;
    createdAt?: string | null;
    reviewUrl: string;
  }>;
}

export default function ExpertDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<ExpertDashboardData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const table = ui.table || {};

  const kpis = [
    {
      label: metrics.pending || "Pending Cases",
      hint: metrics.pendingMeta || "Awaiting review",
      value: d.pendingCount,
      icon: <Clock className="h-5 w-5" />,
      tone: "amber" as const,
    },
    {
      label: metrics.approved || "Approved",
      hint: metrics.approvedMeta || "Validated diagnoses",
      value: d.approvedCount,
      icon: <CheckCircle2 className="h-5 w-5" />,
      tone: "emerald" as const,
    },
    {
      label: metrics.rejected || "Rejected",
      hint: metrics.rejectedMeta || "Needs correction",
      value: d.rejectedCount,
      icon: <XCircle className="h-5 w-5" />,
      tone: "rose" as const,
    },
    {
      label: metrics.chats || "Active Chats",
      hint: metrics.chatsMeta || "Live farmer support",
      value: d.chatCount,
      icon: <MessageSquare className="h-5 w-5" />,
      tone: "indigo" as const,
    },
  ];

  const maxChart = Math.max(1, ...(d.chartValues || [0]));

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        <PhoenixSummaryStrip items={kpis} />

        <div className="grid gap-6 lg:grid-cols-5">
          <AdminSectionCard
            className="lg:col-span-3"
            delayIndex={1}
            title={sections.outcomeMix || "Case Breakdown"}
            subtitle={sections.reviewSubtitle}
            icon={<Activity className="h-4 w-4" />}
          >
            <div className="grid h-44 grid-cols-3 items-end gap-4 pt-3 sm:grid-cols-7">
              {(d.chartLabels || []).map((label, idx) => {
                const val = d.chartValues[idx] || 0;
                const heightPct = Math.max(8, Math.round((val / maxChart) * 100));
                return (
                  <div key={`${label}-${idx}`} className="flex h-full flex-col items-center justify-end gap-2">
                    <span className="text-[11px] font-bold tabular-nums text-[#31374a] dark:text-[#eff2f6]">
                      {val}
                    </span>
                    <div className="flex w-full max-w-[34px] flex-1 items-end rounded-lg bg-[#eff2f6] p-1 dark:bg-[#0f111a]">
                      <div
                        className="w-full origin-bottom rounded-md bg-gradient-to-t from-[#3874ff] to-[#6896ff] transition-all duration-500 ease-out"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="max-w-full truncate text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            className="lg:col-span-2"
            delayIndex={2}
            title={sections.reviewPipeline || "Review Pipeline"}
            subtitle={sections.reviewSubtitle}
            icon={<ClipboardCheck className="h-4 w-4" />}
          >
            <div className="space-y-3.5">
              {(d.pipeline || []).map((row) => {
                const tone =
                  row.key === "approved"
                    ? "emerald"
                    : row.key === "rejected"
                      ? "rose"
                      : row.key === "pending"
                        ? "amber"
                        : "indigo";
                return (
                  <AdminProgressBar
                    key={row.key}
                    label={row.label}
                    value={Math.min(100, Math.max(4, row.percent))}
                    valueLabel={`${row.value} (${row.percent}%)`}
                    tone={tone}
                    height="md"
                  />
                );
              })}
            </div>
          </AdminSectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminSectionCard
            delayIndex={3}
            noPadding
            title={sections.pendingQueue || "Pending Diagnosis Queue"}
            subtitle={sections.pendingQueueSubtitle}
            icon={<Clock className="h-4 w-4" />}
            action={<AdminStatusBadge tone="amber">{d.pendingCount}</AdminStatusBadge>}
          >
            {d.diagnoses.length === 0 ? (
              <div className="p-6">
                <AdminEmptyState
                  icon={<Clock className="h-5 w-5" />}
                  title={table.emptyTitle || "No records"}
                  description={table.emptyText}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                    <tr>
                      <th className="px-4 py-3 font-bold">{table.case || "Case"}</th>
                      <th className="px-4 py-3 font-bold">{table.farmer || "Farmer"}</th>
                      <th className="px-4 py-3 font-bold">{table.confidence || "Confidence"}</th>
                      <th className="px-4 py-3 text-right font-bold">{table.open || "Open"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.diagnoses.map((item) => (
                      <tr key={item.id} className="ai-table-row">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                            {item.diseaseName || "-"}
                          </div>
                          <div className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                            #{item.id} · {item.cropName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#525b75] dark:text-[#9fa6bc]">
                          {item.farmerName || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusBadge tone={statusTone(item.status)}>
                            {Math.round((item.confidence || 0) * 100)}%
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={item.reviewUrl}
                            className="inline-flex items-center gap-1 font-semibold text-[#3874ff] hover:text-[#004dff] hover:underline dark:text-[#85a9ff]"
                          >
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

          <AdminSectionCard
            delayIndex={4}
            noPadding
            title={sections.autoCases || "Auto Cases"}
            subtitle={sections.autoCasesSubtitle}
            icon={<Bot className="h-4 w-4" />}
          >
            {d.autoCases.length === 0 ? (
              <div className="p-6">
                <AdminEmptyState
                  icon={<Bot className="h-5 w-5" />}
                  title={table.emptyTitle || "No records"}
                  description={table.emptyText}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                    <tr>
                      <th className="px-4 py-3 font-bold">{table.suggestion || "Suggestion"}</th>
                      <th className="px-4 py-3 font-bold">{table.status || "Status"}</th>
                      <th className="px-4 py-3 font-bold">{table.confidence || "Confidence"}</th>
                      <th className="px-4 py-3 text-right font-bold">{table.validate || "Validate"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.autoCases.map((item) => (
                      <tr key={item.id} className="ai-table-row">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                            {item.diseaseName || "-"}
                          </div>
                          <div className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                            #{item.id} · {item.cropName}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              statusBadgeClass(item.status),
                            )}
                          >
                            {item.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-[#31374a] dark:text-[#eff2f6]">
                          {Math.round((item.confidence || 0) * 100)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={item.reviewUrl}
                            className="inline-flex items-center gap-1 font-semibold text-[#3874ff] hover:text-[#004dff] hover:underline dark:text-[#85a9ff]"
                          >
                            {table.validate || "Validate"}
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
      </div>
    </WorkspaceShell>
  );
}
