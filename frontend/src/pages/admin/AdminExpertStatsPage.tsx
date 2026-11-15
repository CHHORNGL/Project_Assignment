import React from "react";
import { Activity, CheckCircle2, Clock, Gauge } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import {
  AdminKpiCard,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface AdminExpertStatsData {
  totalDiagnoses: number;
  pendingCount: number;
  approvedCount: number;
  completionPercent: number;
}

export default function AdminExpertStatsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminExpertStatsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

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
            label={isKhmer ? "ករណីសរុប" : "Total Diagnoses"}
            value={d.totalDiagnoses.toLocaleString()}
            tone="indigo"
            icon={<Activity className="h-5 w-5" />}
            hint={isKhmer ? "សរុបការស្កេនទាំងអស់" : "Cumulative AI scans routed"}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "កំពុងរង់ចាំ" : "Pending Review"}
            value={d.pendingCount.toLocaleString()}
            tone="amber"
            icon={<Clock className="h-5 w-5" />}
            hint={isKhmer ? "កំពុងរង់ចាំអ្នកជំនាញ" : "Awaiting specialist verification"}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "បានដំណើរការ" : "Reviewed / Resolved"}
            value={d.approvedCount.toLocaleString()}
            tone="emerald"
            icon={<CheckCircle2 className="h-5 w-5" />}
            progress={d.completionPercent}
            hint={isKhmer ? "បានពិនិត្យ និងអនុម័តរួចរាល់" : "Verified & resolved diagnoses"}
          />
        </div>

        <AdminSectionCard
          delayIndex={3}
          title={isKhmer ? "អត្រាបញ្ចប់ការពិនិត្យ" : "Expert Review Throughput"}
          subtitle={
            isKhmer
              ? "សមាមាត្រនៃការពិនិត្យផ្ទៀងផ្ទាត់ដោយអ្នកជំនាញ"
              : "Verification completion rate across active diagnostic queue"
          }
          icon={<Gauge className="h-4 w-4" />}
          action={
            <AdminStatusBadge tone={d.completionPercent >= 75 ? "emerald" : "amber"} pulse>
              {d.completionPercent}% Complete
            </AdminStatusBadge>
          }
        >
          <div className="space-y-4">
            <AdminProgressBar
              label={isKhmer ? "វឌ្ឍនភាពសរុប" : "Resolution Ratio"}
              value={d.completionPercent}
              valueLabel={`${d.approvedCount.toLocaleString()} / ${d.totalDiagnoses.toLocaleString()} (${d.completionPercent}%)`}
              tone="emerald"
            />
          </div>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
