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
import {
  confidenceTone,
  ExpertHeaderActions,
  formatShortDateTime,
  normalizeConfidencePercent,
  statusBadgeClass,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
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

function getInitial(name?: string): string {
  const clean = (name || "").trim();
  return clean ? clean.slice(0, 1).toUpperCase() : "?";
}

export default function ExpertDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<ExpertDashboardData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const table = ui.table || {};
  const actions = (ui.actions || {}) as Record<string, { href?: string }>;

  const totalReviewed = (d.approvedCount || 0) + (d.rejectedCount || 0);
  const approvalRate =
    totalReviewed > 0 ? Math.round(((d.approvedCount || 0) / totalReviewed) * 100) : 0;
  const totalChartSum = (d.chartValues || []).reduce((acc, v) => acc + (v || 0), 0);
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
        {/* Executive KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={metrics.pending || "Pending Cases"}
            value={d.pendingCount}
            hint={metrics.pendingMeta || "Awaiting review"}
            icon={<Clock className="h-5 w-5" />}
            tone="amber"
            badge={
              d.pendingCount > 0
                ? isKhmer
                  ? "ត្រូវការពិនិត្យ"
                  : "Needs review"
                : isKhmer
                  ? "រួចរាល់"
                  : "All clear"
            }
            href={actions.pending?.href}
          />
          <AdminKpiCard
            delayIndex={1}
            label={metrics.approved || "Approved"}
            value={d.approvedCount}
            hint={
              totalReviewed > 0
                ? `${approvalRate}% ${isKhmer ? "អត្រាអនុម័ត" : "approval rate"}`
                : metrics.approvedMeta || "Validated diagnoses"
            }
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="emerald"
            progress={totalReviewed > 0 ? approvalRate : 0}
          />
          <AdminKpiCard
            delayIndex={2}
            label={metrics.rejected || "Rejected"}
            value={d.rejectedCount}
            hint={metrics.rejectedMeta || "Needs correction"}
            icon={<XCircle className="h-5 w-5" />}
            tone="rose"
            progress={
              totalReviewed > 0 ? Math.round(((d.rejectedCount || 0) / totalReviewed) * 100) : 0
            }
          />
          <AdminKpiCard
            delayIndex={3}
            label={metrics.chats || "Active Chats"}
            value={d.chatCount}
            hint={metrics.chatsMeta || "Live farmer support"}
            icon={<MessageSquare className="h-5 w-5" />}
            tone="indigo"
            href="/expert/chats"
          />
        </div>

        {/* Analytics & Pipeline Row */}
        <div className="grid gap-6 lg:grid-cols-5">
          <AdminSectionCard
            className="lg:col-span-3"
            delayIndex={1}
            title={sections.outcomeMix || "Case Breakdown"}
            subtitle={sections.reviewSubtitle}
            icon={<Activity className="h-4 w-4" />}
            action={
              <AdminStatusBadge tone="indigo">
                {totalChartSum} {isKhmer ? "ករណីសរុប" : "total"}
              </AdminStatusBadge>
            }
          >
            <div className="relative pt-2">
              <div className="grid h-48 grid-cols-3 items-end gap-3 pt-4 sm:grid-cols-7 sm:gap-4">
                {(d.chartLabels || []).map((label, idx) => {
                  const val = d.chartValues[idx] || 0;
                  const heightPct = val > 0 ? Math.max(10, Math.round((val / maxChart) * 100)) : 4;
                  const isPeak = val > 0 && val === maxChart;
                  return (
                    <div
                      key={`${label}-${idx}`}
                      className="group flex h-full flex-col items-center justify-end gap-2"
                    >
                      <span
                        className={cn(
                          "text-[11px] font-bold tabular-nums transition-transform group-hover:-translate-y-0.5",
                          isPeak
                            ? "text-[#004dff] dark:text-[#85a9ff]"
                            : "text-[#31374a] dark:text-[#eff2f6]",
                        )}
                      >
                        {val}
                      </span>
                      <div className="flex w-full max-w-[36px] flex-1 items-end rounded-lg border border-[#e3e6ed]/80 bg-[#f5f7fa] p-1 dark:border-[#2b3245] dark:bg-[#0f111a]">
                        <div
                          className={cn(
                            "w-full origin-bottom rounded-md transition-all duration-500 ease-out",
                            val === 0
                              ? "bg-[#cbd0dd]/60 dark:bg-[#2b3245]"
                              : isPeak
                                ? "bg-gradient-to-t from-[#004dff] to-[#3874ff] shadow-xs"
                                : "bg-gradient-to-t from-[#3874ff]/85 to-[#6896ff] group-hover:from-[#004dff] group-hover:to-[#3874ff]",
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="max-w-full truncate text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            className="lg:col-span-2"
            delayIndex={2}
            title={sections.reviewPipeline || "Review Pipeline"}
            subtitle={sections.reviewSubtitle}
            icon={<ClipboardCheck className="h-4 w-4" />}
            action={
              <AdminStatusBadge tone="slate">
                {totalReviewed} {isKhmer ? "បានពិនិត្យ" : "reviewed"}
              </AdminStatusBadge>
            }
          >
            <div className="space-y-4">
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
                    value={row.value > 0 ? Math.min(100, Math.max(4, row.percent)) : 0}
                    valueLabel={`${row.value} (${row.percent}%)`}
                    tone={tone}
                    height="md"
                  />
                );
              })}
            </div>
          </AdminSectionCard>
        </div>

        {/* Review Queues Row */}
        <div className="grid gap-6 xl:grid-cols-2">
          <AdminSectionCard
            delayIndex={3}
            noPadding
            title={sections.pendingQueue || "Pending Diagnosis Queue"}
            subtitle={sections.pendingQueueSubtitle}
            icon={<Clock className="h-4 w-4" />}
            action={
              <div className="flex items-center gap-2">
                <AdminStatusBadge tone="amber" pulse={d.pendingCount > 0}>
                  {d.pendingCount}
                </AdminStatusBadge>
                {actions.pending?.href && (
                  <a href={actions.pending.href} className="ai-btn-secondary h-7 px-2.5 text-[11px]">
                    {isKhmer ? "មើលទាំងអស់" : "View all"}
                  </a>
                )}
              </div>
            }
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
                    {d.diagnoses.map((item) => {
                      const pct = normalizeConfidencePercent(item.confidence) ?? 0;
                      return (
                        <tr key={item.id} className="ai-table-row">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {item.diseaseName || "-"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                              <span className="font-mono">#{item.id}</span> · {item.cropName}
                              {item.createdAt ? ` · ${formatShortDateTime(item.createdAt)}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e5edff] text-[11px] font-bold text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                                {getInitial(item.farmerName)}
                              </span>
                              <span className="font-medium text-[#31374a] dark:text-[#cbd0dd]">
                                {item.farmerName || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <AdminStatusBadge tone={confidenceTone(pct)}>
                              {pct}%
                            </AdminStatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={item.reviewUrl}
                              className="ai-btn-secondary h-7 gap-1 px-2.5 text-[11px]"
                            >
                              <span>{table.review || "Review"}</span>
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
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
            action={
              <AdminStatusBadge tone="indigo">{d.autoCases.length}</AdminStatusBadge>
            }
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
                    {d.autoCases.map((item) => {
                      const pct = normalizeConfidencePercent(item.confidence) ?? 0;
                      return (
                        <tr key={item.id} className="ai-table-row">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {item.diseaseName || "-"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                              <span className="font-mono">#{item.id}</span> · {item.cropName}
                              {item.createdAt ? ` · ${formatShortDateTime(item.createdAt)}` : ""}
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
                          <td className="px-4 py-3">
                            <AdminStatusBadge tone={confidenceTone(pct)}>{pct}%</AdminStatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={item.reviewUrl}
                              className="ai-btn-secondary h-7 gap-1 px-2.5 text-[11px]"
                            >
                              <span>{table.validate || "Validate"}</span>
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
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
