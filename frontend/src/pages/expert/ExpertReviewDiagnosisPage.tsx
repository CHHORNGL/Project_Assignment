import React, { useState } from "react";
import { CheckCircle2, ClipboardCheck, ShieldAlert, Sprout, UserCheck, XCircle } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, statusBadgeClass } from "@/components/expert/ExpertShared";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface ReviewDiagnosisData {
  diagnosis: {
    id: number;
    cropLabel: string;
    farmerName: string;
    symptomsText: string;
    symptomList: string[];
    diseaseLabel: string;
    confidencePercent: number | null;
    status: string;
    statusLabel: string;
    createdAt?: string | null;
    categoryLabel?: string;
    reasonText?: string;
    solutionDraft?: string;
  };
  formAction: string;
  dashboardUrl: string;
}

export default function ExpertReviewDiagnosisPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<ReviewDiagnosisData>;
}) {
  const d = bootstrap.data;
  const diag = d.diagnosis;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};
  const [solution, setSolution] = useState(diag.solutionDraft || "");

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <AdminSectionCard
          className="lg:col-span-3"
          delayIndex={0}
          title={sections.information || "Diagnosis Information"}
          subtitle={`${labels.case || "Case"} #${diag.id}`}
          icon={<ClipboardCheck className="h-4 w-4" />}
          action={
            <span
              className={cn(
                "inline-flex rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                statusBadgeClass(diag.status),
              )}
            >
              {diag.statusLabel}
            </span>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  <Sprout className="h-3.5 w-3.5 text-[#25b003]" />
                  {labels.crop || "Crop"}
                </div>
                <p className="mt-1.5 text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {diag.cropLabel || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  <UserCheck className="h-3.5 w-3.5 text-[#3874ff]" />
                  {labels.farmer || "Farmer"}
                </div>
                <p className="mt-1.5 text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {diag.farmerName || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  <ShieldAlert className="h-3.5 w-3.5 text-[#e5780b]" />
                  {labels.autoDisease || "Auto Disease"}
                </div>
                <p className="mt-1.5 text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {diag.diseaseLabel || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  {labels.confidence || "Confidence"}
                </div>
                <p className="mt-1.5 text-sm font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                  {diag.confidencePercent !== null ? `${diag.confidencePercent}%` : "-"}
                </p>
              </div>
            </div>

            {diag.categoryLabel && (
              <div>
                <p className="text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  {labels.category || "Category"}
                </p>
                <p className="mt-1 text-sm font-medium text-[#141824] dark:text-[#eff2f6]">
                  {diag.categoryLabel}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                {labels.symptoms || "Symptoms"}
              </p>
              {diag.symptomList.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {diag.symptomList.map((sym, idx) => (
                    <span
                      key={`${sym}-${idx}`}
                      className="rounded-lg border border-[#adc5ff] bg-[#e5edff] px-2.5 py-1 text-xs font-semibold text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                    >
                      {sym}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-[#525b75] dark:text-[#9fa6bc]">
                  {diag.symptomsText || "-"}
                </p>
              )}
            </div>

            {diag.reasonText && (
              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 text-xs leading-relaxed text-[#525b75] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#9fa6bc]">
                <p className="mb-1 font-bold text-[#141824] dark:text-[#eff2f6]">
                  {labels.reason || "Reason"}
                </p>
                {diag.reasonText}
              </div>
            )}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          className="lg:col-span-2"
          delayIndex={1}
          title={sections.decision || "Expert Decision"}
        >
          <form method="POST" action={d.formAction} className="flex h-full flex-col justify-between space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div>
              <label
                htmlFor="expert-solution"
                className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]"
              >
                {labels.expertSolution || "Expert Solution"}
              </label>
              <textarea
                id="expert-solution"
                name="solution"
                rows={7}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                placeholder={
                  labels.solutionPlaceholder || "Provide actionable treatment and field advice..."
                }
                className="ai-input min-h-[175px] resize-y"
              />
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="submit"
                name="action"
                value="approve"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#25b003] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1e9302] focus:outline-none focus:ring-2 focus:ring-[#25b003]/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                {labels.approveDiagnosis || "Approve Diagnosis"}
              </button>
              <button
                type="submit"
                name="action"
                value="reject"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#f48270] bg-white px-4 text-sm font-semibold text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/45 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
              >
                <XCircle className="h-4 w-4" />
                {labels.rejectDiagnosis || "Reject Diagnosis"}
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
