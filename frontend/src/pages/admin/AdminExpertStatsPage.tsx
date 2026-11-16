import React, { useMemo, useState } from "react";
import {
  Activity,
  Award,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  LayoutDashboard,
  Search,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface CropStat {
  cropName: string;
  count: number;
  avgConfidence?: number | null;
}

interface DiseaseStat {
  diseaseName: string;
  cropName?: string;
  count: number;
}

interface ReviewerStat {
  expertId: number;
  username: string;
  displayName: string;
  totalReviewed: number;
  approvedCount: number;
  rejectedCount: number;
}

interface RecentCaseRow {
  id: number;
  cropName: string;
  diseaseName: string;
  status: string;
  confidencePct?: number | null;
  farmerName: string;
  expertName?: string;
  feedbackRating?: string;
  createdAt?: string | null;
}

interface AdminExpertStatsData {
  totalDiagnoses: number;
  pendingCount: number;
  approvedCount: number;
  completionPercent: number;
  avgConfidence?: number | null;
  statusCounts?: {
    APPROVED: number;
    REJECTED: number;
    AUTO: number;
    MANUAL: number;
    PENDING: number;
  };
  feedbackCounts?: {
    helpful: number;
    notHelpful: number;
  };
  cropBreakdown?: CropStat[];
  diseaseBreakdown?: DiseaseStat[];
  reviewerStats?: ReviewerStat[];
  recentCases?: RecentCaseRow[];
  links?: {
    dashboardUrl: string;
    exportCsvUrl: string;
    exportJsonUrl: string;
  };
}

type BreakdownTab = "crops" | "diseases";
type CaseStatusFilter = "ALL" | "PENDING" | "AUTO" | "MANUAL" | "APPROVED" | "REJECTED";

function diagnosisStatusTone(status: string): AdminTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "emerald";
    case "REJECTED":
      return "rose";
    case "PENDING":
      return "amber";
    case "AUTO":
      return "indigo";
    case "MANUAL":
      return "sky";
    default:
      return "slate";
  }
}

export default function AdminExpertStatsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminExpertStatsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>("crops");
  const [statusFilter, setStatusFilter] = useState<CaseStatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const statusCounts = d.statusCounts ?? {
    APPROVED: d.approvedCount,
    REJECTED: 0,
    AUTO: 0,
    MANUAL: 0,
    PENDING: d.pendingCount,
  };
  const feedbackCounts = d.feedbackCounts ?? { helpful: 0, notHelpful: 0 };
  const cropBreakdown = d.cropBreakdown ?? [];
  const diseaseBreakdown = d.diseaseBreakdown ?? [];
  const reviewerStats = d.reviewerStats ?? [];
  const recentCases = d.recentCases ?? [];
  const links = d.links ?? {
    dashboardUrl: "/admin/dashboard",
    exportCsvUrl: "/admin/expert-statistics/export?format=csv",
    exportJsonUrl: "/admin/expert-statistics/export?format=json",
  };

  const expertVerifiedCount = statusCounts.APPROVED + statusCounts.REJECTED;
  const ratedFeedbackTotal = feedbackCounts.helpful + feedbackCounts.notHelpful;
  const unratedCount = Math.max(0, d.totalDiagnoses - ratedFeedbackTotal);

  const pipelineSegments: Array<{
    key: Exclude<CaseStatusFilter, "ALL">;
    label: string;
    count: number;
    tone: AdminTone;
    segmentColor: string;
  }> = [
    {
      key: "APPROVED",
      label: isKhmer ? "អនុម័តដោយអ្នកជំនាញ" : "Approved by Expert",
      count: statusCounts.APPROVED,
      tone: "emerald",
      segmentColor: "bg-[#25b003]",
    },
    {
      key: "AUTO",
      label: isKhmer ? "វិភាគដោយ AI ស្វ័យប្រវត្តិ" : "Automated AI Scan",
      count: statusCounts.AUTO,
      tone: "indigo",
      segmentColor: "bg-[#3874ff]",
    },
    {
      key: "MANUAL",
      label: isKhmer ? "កត់ត្រាដោយផ្ទាល់" : "Manual Evaluation",
      count: statusCounts.MANUAL,
      tone: "sky",
      segmentColor: "bg-[#0097eb]",
    },
    {
      key: "PENDING",
      label: isKhmer ? "កំពុងរង់ចាំពិនិត្យ" : "Pending Review",
      count: statusCounts.PENDING,
      tone: "amber",
      segmentColor: "bg-[#e5780b]",
    },
    {
      key: "REJECTED",
      label: isKhmer ? "បានបដិសេធ" : "Rejected",
      count: statusCounts.REJECTED,
      tone: "rose",
      segmentColor: "bg-[#fa3b1d]",
    },
  ];

  const maxCropCount = useMemo(
    () => Math.max(1, ...cropBreakdown.map((c) => c.count)),
    [cropBreakdown],
  );
  const maxDiseaseCount = useMemo(
    () => Math.max(1, ...diseaseBreakdown.map((x) => x.count)),
    [diseaseBreakdown],
  );
  const maxReviewerTotal = useMemo(
    () => Math.max(1, ...reviewerStats.map((r) => r.totalReviewed)),
    [reviewerStats],
  );

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recentCases.filter((item) => {
      if (statusFilter !== "ALL" && item.status.toUpperCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.cropName.toLowerCase().includes(q) ||
        item.diseaseName.toLowerCase().includes(q) ||
        item.farmerName.toLowerCase().includes(q) ||
        (item.expertName || "").toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    });
  }, [recentCases, statusFilter, search]);

  const caseFilterTabs: Array<{ key: CaseStatusFilter; label: string; count: number }> = [
    { key: "ALL", label: isKhmer ? "ទាំងអស់" : "All", count: recentCases.length },
    {
      key: "PENDING",
      label: isKhmer ? "រង់ចាំ" : "Pending",
      count: recentCases.filter((c) => c.status === "PENDING").length,
    },
    {
      key: "AUTO",
      label: "Auto",
      count: recentCases.filter((c) => c.status === "AUTO").length,
    },
    {
      key: "MANUAL",
      label: "Manual",
      count: recentCases.filter((c) => c.status === "MANUAL").length,
    },
    {
      key: "APPROVED",
      label: isKhmer ? "អនុម័ត" : "Approved",
      count: recentCases.filter((c) => c.status === "APPROVED").length,
    },
    {
      key: "REJECTED",
      label: isKhmer ? "បដិសេធ" : "Rejected",
      count: recentCases.filter((c) => c.status === "REJECTED").length,
    },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <a href={links.exportCsvUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </a>
          <a href={links.exportJsonUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </a>
          <a href={links.dashboardUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>{isKhmer ? "ផ្ទាំងគ្រប់គ្រង" : "Dashboard"}</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Executive Diagnostic KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "ករណីសរុប" : "Total Diagnoses"}
            value={d.totalDiagnoses.toLocaleString()}
            tone="indigo"
            icon={<Activity className="h-5 w-5" />}
            hint={isKhmer ? "សរុបការស្កេនដំណាំទាំងអស់" : "Cumulative crop diagnostic cases"}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "ផ្ទៀងផ្ទាត់ដោយអ្នកជំនាញ" : "Expert Verified"}
            value={expertVerifiedCount.toLocaleString()}
            tone="emerald"
            icon={<CheckCircle2 className="h-5 w-5" />}
            progress={d.completionPercent}
            hint={
              isKhmer
                ? `${statusCounts.APPROVED} អនុម័ត · ${statusCounts.REJECTED} បដិសេធ`
                : `${d.completionPercent}% resolved · ${statusCounts.APPROVED} approved · ${statusCounts.REJECTED} rejected`
            }
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "កំពុងរង់ចាំពិនិត្យ" : "Pending Queue"}
            value={d.pendingCount.toLocaleString()}
            tone={d.pendingCount > 0 ? "amber" : "slate"}
            icon={<Clock className="h-5 w-5" />}
            hint={
              d.pendingCount === 0
                ? isKhmer
                  ? "គ្មានករណីកកស្ទះឡើយ"
                  : "Queue cleared — zero backlog"
                : isKhmer
                  ? "កំពុងរង់ចាំអ្នកជំនាញពិនិត្យ"
                  : "Awaiting specialist review"
            }
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "ទំនុកចិត្ត AI មធ្យម" : "Mean Confidence"}
            value={
              d.avgConfidence !== null && d.avgConfidence !== undefined
                ? `${d.avgConfidence.toFixed(1)}%`
                : "—"
            }
            tone="sky"
            icon={<Gauge className="h-5 w-5" />}
            hint={
              isKhmer
                ? `${feedbackCounts.helpful} ពេញចិត្ត · ${feedbackCounts.notHelpful} មិនពេញចិត្ត`
                : `${feedbackCounts.helpful} helpful · ${feedbackCounts.notHelpful} unhelpful ratings`
            }
          />
        </div>

        {/* Middle Row: Status Pipeline Distribution + Crop/Disease Analytics */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <AdminSectionCard
              delayIndex={1}
              title={isKhmer ? "លំហូរការងារ និងស្ថានភាពករណី" : "Diagnostic Pipeline & Status Mix"}
              subtitle={
                isKhmer
                  ? "ការបែងចែកករណីរវាងការវិភាគស្វ័យប្រវត្តិ ការពិនិត្យដោយអ្នកជំនាញ និងមតិកសិករ"
                  : "Distribution across AI inference, manual entries, and specialist sign-off"
              }
              icon={<Gauge className="h-4 w-4" />}
              action={
                <AdminStatusBadge tone={d.completionPercent >= 75 ? "emerald" : "amber"} pulse>
                  {d.completionPercent}% {isKhmer ? "បានដំណើរការ" : "Processed"}
                </AdminStatusBadge>
              }
            >
              <div className="space-y-5">
                {/* Multi-Segment Stacked Bar */}
                <div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436]">
                    {d.totalDiagnoses > 0 &&
                      pipelineSegments.map((seg) => {
                        const widthPct = (seg.count / d.totalDiagnoses) * 100;
                        if (widthPct <= 0) return null;
                        return (
                          <div
                            key={seg.key}
                            title={`${seg.label}: ${seg.count} (${Math.round(widthPct)}%)`}
                            className={`h-full transition-all duration-500 ${seg.segmentColor}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        );
                      })}
                  </div>
                </div>

                {/* Individual Progress Tracks */}
                <div className="space-y-3">
                  {pipelineSegments.map((seg) => {
                    const pct =
                      d.totalDiagnoses > 0
                        ? Math.round((seg.count / d.totalDiagnoses) * 100)
                        : 0;
                    return (
                      <AdminProgressBar
                        key={seg.key}
                        label={seg.label}
                        value={seg.count}
                        max={Math.max(d.totalDiagnoses, 1)}
                        tone={seg.tone}
                        height="sm"
                        valueLabel={`${seg.count.toLocaleString()} (${pct}%)`}
                      />
                    );
                  })}
                </div>

                {/* Farmer Feedback Sentiment Summary */}
                <div className="grid gap-3 border-t border-[#e3e6ed] pt-4 sm:grid-cols-3 dark:border-[#2b3245]">
                  <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3.5 py-2.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1c6c09] dark:text-[#90ee7a]">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "មានប្រយោជន៍" : "Helpful"}</span>
                    </div>
                    <span className="font-display text-sm font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {feedbackCounts.helpful.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3.5 py-2.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#b81800] dark:text-[#ff9c8c]">
                      <ThumbsDown className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "មិនសូវមានប្រយោជន៍" : "Unhelpful"}</span>
                    </div>
                    <span className="font-display text-sm font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {feedbackCounts.notHelpful.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3.5 py-2.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <span className="text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "គ្មានការវាយតម្លៃ" : "Unrated"}
                    </span>
                    <span className="font-display text-sm font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {unratedCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </AdminSectionCard>
          </div>

          {/* Crop & Disease Volume Card */}
          <div className="min-w-0 lg:col-span-5">
            <AdminSectionCard
              delayIndex={2}
              title={isKhmer ? "បរិមាណតាមដំណាំ និងជំងឺ" : "Case Volume & Conditions"}
              subtitle={
                isKhmer
                  ? "ដំណាំ និងជំងឺដែលត្រូវបានវិភាគញឹកញាប់ជាងគេ"
                  : "Most diagnosed crops and top detected conditions"
              }
              icon={<Sprout className="h-4 w-4" />}
              action={
                <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 dark:border-[#373e53] dark:bg-[#0f111a]">
                  <button
                    type="button"
                    onClick={() => setBreakdownTab("crops")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      breakdownTab === "crops"
                        ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                        : "text-[#6e7891] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-[#eff2f6]",
                    )}
                  >
                    {isKhmer ? "តាមដំណាំ" : "By Crop"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownTab("diseases")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      breakdownTab === "diseases"
                        ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                        : "text-[#6e7891] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-[#eff2f6]",
                    )}
                  >
                    {isKhmer ? "ជំងឺកំពូល" : "Conditions"}
                  </button>
                </div>
              }
            >
              {breakdownTab === "crops" ? (
                cropBreakdown.length === 0 ? (
                  <AdminEmptyState
                    icon={<Sprout className="h-5 w-5" />}
                    title={isKhmer ? "មិនទាន់មានទិន្នន័យដំណាំទេ" : "No crop analytics yet"}
                  />
                ) : (
                  <div className="space-y-3.5">
                    {cropBreakdown.map((item) => {
                      const pct = Math.round((item.count / maxCropCount) * 100);
                      return (
                        <div key={item.cropName} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {item.cropName}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              {item.avgConfidence !== null && item.avgConfidence !== undefined && (
                                <span className="rounded bg-[#e5edff] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                                  {item.avgConfidence.toFixed(1)}% conf
                                </span>
                              )}
                              <span className="font-mono font-bold tabular-nums text-[#31374a] dark:text-[#cbd0dd]">
                                {item.count}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#25b003] to-[#4bc42b]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : diseaseBreakdown.length === 0 ? (
                <AdminEmptyState
                  icon={<Activity className="h-5 w-5" />}
                  title={isKhmer ? "មិនទាន់មានទិន្នន័យជំងឺទេ" : "No disease analytics yet"}
                />
              ) : (
                <div className="space-y-3.5">
                  {diseaseBreakdown.map((item) => {
                    const pct = Math.round((item.count / maxDiseaseCount) * 100);
                    return (
                      <div key={item.diseaseName} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {item.diseaseName}
                            </div>
                            {item.cropName && (
                              <div className="truncate text-[10.5px] text-[#6e7891] dark:text-[#8a94ad]">
                                {item.cropName}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 font-mono font-bold tabular-nums text-[#31374a] dark:text-[#cbd0dd]">
                            {item.count}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#3874ff] to-[#6091ff]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminSectionCard>
          </div>
        </div>

        {/* Bottom Row: Specialist Reviewer Leaderboard + Recent Queue Table */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-4">
            <AdminSectionCard
              delayIndex={3}
              noPadding
              title={isKhmer ? "អ្នកជំនាញពិនិត្យករណី" : "Specialist Reviewers"}
              subtitle={
                isKhmer
                  ? "បញ្ជីអ្នកជំនាញដែលបានផ្ទៀងផ្ទាត់ករណី"
                  : "Review throughput attributed by expert"
              }
              icon={<Award className="h-4 w-4" />}
            >
              {reviewerStats.length === 0 ? (
                <div className="p-6">
                  <AdminEmptyState
                    icon={<Award className="h-5 w-5" />}
                    title={isKhmer ? "មិនទាន់មានកំណត់ត្រាអ្នកជំនាញទេ" : "No specialist sign-offs yet"}
                    description={
                      isKhmer
                        ? "ករណីដែលបានពិនិត្យដោយអ្នកជំនាញនឹងបង្ហាញនៅទីនេះ។"
                        : "Assigned expert reviews and approval ratios will appear here."
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {reviewerStats.map((rev, idx) => {
                    const initial = (rev.displayName || rev.username || "E").slice(0, 1).toUpperCase();
                    const sharePct = Math.round((rev.totalReviewed / maxReviewerTotal) * 100);
                    return (
                      <div key={rev.expertId} className="space-y-2 px-5 py-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e5edff] font-display text-xs font-extrabold text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                              {idx === 0 ? "★" : initial}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-[#141824] dark:text-[#eff2f6]">
                                {rev.displayName}
                              </div>
                              <div className="truncate font-mono text-[10.5px] text-[#6e7891] dark:text-[#8a94ad]">
                                @{rev.username}
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 font-display text-sm font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                            {rev.totalReviewed}
                          </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#3874ff] to-[#25b003]"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>

                        <div className="flex items-center gap-2 text-[10.5px] font-semibold">
                          <span className="text-[#1c6c09] dark:text-[#90ee7a]">
                            {rev.approvedCount} {isKhmer ? "អនុម័ត" : "approved"}
                          </span>
                          <span className="text-[#cbd0dd] dark:text-[#373e53]">·</span>
                          <span className="text-[#b81800] dark:text-[#ff9c8c]">
                            {rev.rejectedCount} {isKhmer ? "បដិសេធ" : "rejected"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminSectionCard>
          </div>

          <div className="min-w-0 lg:col-span-8">
            <AdminSectionCard
              delayIndex={4}
              noPadding
              title={isKhmer ? "កំណត់ត្រាវិនិច្ឆ័យថ្មីៗ" : "Recent Diagnostic Queue"}
              subtitle={
                isKhmer
                  ? `បង្ហាញ ${filteredCases.length} នៃ ${recentCases.length} ករណីចុងក្រោយ`
                  : `Showing ${filteredCases.length} of ${recentCases.length} most recent cases`
              }
              icon={<Activity className="h-4 w-4" />}
            >
              {/* Search & Status Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      isKhmer ? "ស្វែងរកដំណាំ ជំងឺ ឬអ្នកជំនាញ..." : "Filter crop, condition, or expert..."
                    }
                    className="ai-input h-9 py-1 pl-9 pr-8 text-xs"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                  {caseFilterTabs.map((tab) => {
                    const active = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatusFilter(tab.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                          active
                            ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                            : "text-[#525b75] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#eff2f6]",
                        )}
                      >
                        <span>{tab.label}</span>
                        <span className="font-mono text-[10px] opacity-80">{tab.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredCases.length === 0 ? (
                <div className="p-6">
                  <AdminEmptyState
                    icon={<Activity className="h-5 w-5" />}
                    title={isKhmer ? "មិនមានករណីត្រូវនឹងការត្រងទេ" : "No diagnostic cases match this filter"}
                    action={
                      statusFilter !== "ALL" || search.trim().length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter("ALL");
                            setSearch("");
                          }}
                          className="ai-btn-secondary h-8 px-3 text-xs"
                        >
                          {isKhmer ? "បង្ហាញទាំងអស់" : "Reset Filters"}
                        </button>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                      <tr>
                        <th className="px-5 py-3">{isKhmer ? "ករណី និងដំណាំ" : "Case & Crop"}</th>
                        <th className="px-4 py-3">{isKhmer ? "លទ្ធផលវិនិច្ឆ័យ" : "Condition"}</th>
                        <th className="px-4 py-3 text-right">{isKhmer ? "ទំនុកចិត្ត" : "Conf."}</th>
                        <th className="px-4 py-3">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                        <th className="px-4 py-3">{isKhmer ? "អ្នកពិនិត្យ និងមតិ" : "Reviewer & Feedback"}</th>
                        <th className="px-5 py-3 text-right">{isKhmer ? "កាលបរិច្ឆេទ" : "Submitted"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                      {filteredCases.map((item) => (
                        <tr key={item.id} className="ai-table-row">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {item.cropName}
                            </div>
                            <div className="font-mono text-[10.5px] text-[#6e7891] dark:text-[#8a94ad]">
                              #{item.id} · @{item.farmerName}
                            </div>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 font-medium text-[#31374a] dark:text-[#cbd0dd]">
                            {item.diseaseName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                            {item.confidencePct !== null && item.confidencePct !== undefined
                              ? `${item.confidencePct.toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <AdminStatusBadge tone={diagnosisStatusTone(item.status)}>
                              {item.status}
                            </AdminStatusBadge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-[#31374a] dark:text-[#cbd0dd]">
                                {item.expertName ||
                                  (item.status === "AUTO"
                                    ? isKhmer
                                      ? "ស្វ័យប្រវត្តិ AI"
                                      : "Automated AI"
                                    : item.status === "PENDING"
                                      ? isKhmer
                                        ? "មិនទាន់ចាត់តាំង"
                                        : "Unassigned"
                                      : "—")}
                              </span>
                              {item.feedbackRating === "helpful" && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-[#d9fbd0] px-1.5 py-0.5 text-[10px] font-semibold text-[#1c6c09] dark:bg-[#25b003]/15 dark:text-[#90ee7a]">
                                  <ThumbsUp className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {item.feedbackRating === "not_helpful" && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-[#ffe0db] px-1.5 py-0.5 text-[10px] font-semibold text-[#b81800] dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]">
                                  <ThumbsDown className="h-2.5 w-2.5" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="whitespace-nowrap px-5 py-3 text-right font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]"
                            title={item.createdAt || undefined}
                          >
                            {formatAccountTimestamp(item.createdAt)}
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
      </div>
    </WorkspaceShell>
  );
}
