import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  ShieldAlert,
  Sprout,
  UserCheck,
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
import { AdminProgressBar, AdminSectionCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
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
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const diag = d.diagnosis;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};
  const [solution, setSolution] = useState(diag.solutionDraft || "");

  const confidencePct = normalizeConfidencePercent(diag.confidencePercent);
  const confTone = confidenceTone(confidencePct);

  const templates = useMemo(
    () =>
      isKhmer
        ? [
            {
              label: "ព្យាបាលផ្សិត & អនាម័យចម្ការ",
              body: "សូមដកស្លឹកដែលឆ្លងជំងឺចេញ និងបំផ្លាញចោល កាត់បន្ថយសំណើម និងប្រើថ្នាំការពារផ្សិតតាមកម្រិតណែនាំនៅពេលព្រឹកព្រលឹម ឬពេលល្ងាច។",
            },
            {
              label: "តាមដាន & ការពារ IPM",
              body: "សូមបាញ់ទឹកនៅគល់ដំណាំជៀសវាងការបាញ់លើស្លឹក សម្អាតស្មៅជុំវិញរង និងតាមដានរោគសញ្ញាបន្ថែមក្នុងរយៈពេល 48 ម៉ោង។",
            },
            {
              label: "ស្នើសុំរូបភាពបន្ថែម",
              body: "រោគសញ្ញាបច្ចុប្បន្នមិនទាន់ច្បាស់គ្រប់គ្រាន់ទេ។ សូមថតរូបស្លឹកដំណាំឱ្យច្បាស់ក្នុងពន្លឺថ្ងៃ និងបង្ហោះម្តងទៀតដើម្បីផ្ទៀងផ្ទាត់។",
            },
          ]
        : [
            {
              label: "Targeted treatment & sanitation",
              body: "Prune and safely dispose of severely infected leaves, improve airflow between rows, and apply the recommended crop-safe treatment early morning or late afternoon.",
            },
            {
              label: "IPM irrigation & monitoring",
              body: "Water at the root zone rather than overhead, clear weed hosts around the plot, and inspect adjacent plants again in 48 hours.",
            },
            {
              label: "Request clearer field photo",
              body: "Visual signs are inconclusive from this sample. Please upload a sharp close-up of both leaf surfaces in natural daylight for re-evaluation.",
            },
          ],
    [isKhmer],
  );

  const applyTemplate = (snippet: string) => {
    setSolution((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${snippet}` : snippet;
    });
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid items-start gap-6 lg:grid-cols-5">
        {/* Left Clinical Case Summary */}
        <AdminSectionCard
          className="lg:col-span-3"
          delayIndex={0}
          title={sections.information || "Diagnosis Information"}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">
                {labels.case || "Case"} #{diag.id}
              </span>
              {diag.createdAt && (
                <span className="inline-flex items-center gap-1">
                  · <Calendar className="h-3 w-3" /> {formatShortDateTime(diag.createdAt)}
                </span>
              )}
            </span>
          }
          icon={<ClipboardCheck className="h-4 w-4" />}
          action={
            <span
              className={cn(
                "inline-flex rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
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
                <p className="mt-1.5 font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {diag.cropLabel || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  <UserCheck className="h-3.5 w-3.5 text-[#3874ff]" />
                  {labels.farmer || "Farmer"}
                </div>
                <p className="mt-1.5 font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {diag.farmerName || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  <ShieldAlert className="h-3.5 w-3.5 text-[#e5780b]" />
                  {labels.autoDisease || "Auto Disease"}
                </div>
                <p className="mt-1.5 font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {diag.diseaseLabel || "-"}
                </p>
                {diag.categoryLabel && (
                  <p className="mt-1 text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                    {diag.categoryLabel}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                  <span>{labels.confidence || "Confidence"}</span>
                  <AdminStatusBadge tone={confTone}>
                    {confidencePct !== null ? `${confidencePct}%` : "-"}
                  </AdminStatusBadge>
                </div>
                <AdminProgressBar
                  value={confidencePct ?? 0}
                  tone={confTone}
                  height="sm"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                {labels.symptoms || "Observed Symptoms"}
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
                <div className="mt-2 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3.5 text-sm leading-relaxed text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#eff2f6]">
                  {diag.symptomsText || "-"}
                </div>
              )}
            </div>

            {diag.reasonText && (
              <div className="rounded-xl border border-[#adc5ff]/70 bg-[#e5edff]/45 p-4 text-xs leading-relaxed text-[#31374a] dark:border-[#3874ff]/30 dark:bg-[#3874ff]/10 dark:text-[#cbd0dd]">
                <div className="mb-1.5 flex items-center gap-2 font-bold text-[#004dff] dark:text-[#85a9ff]">
                  <Bot className="h-4 w-4" />
                  <span>{labels.reason || "System Diagnostic Rationale"}</span>
                </div>
                <p>{diag.reasonText}</p>
              </div>
            )}
          </div>
        </AdminSectionCard>

        {/* Right Expert Decision Panel */}
        <AdminSectionCard
          className="lg:col-span-2 lg:sticky lg:top-20"
          delayIndex={1}
          title={sections.decision || "Expert Decision"}
          subtitle={
            isKhmer
              ? "សរសេរដំណោះស្រាយច្បាស់លាស់សម្រាប់កសិករ"
              : "Review and send final guidance to the farmer"
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-4">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            {/* Quick Clinical Solution Templates */}
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                <FilePlus2 className="h-3.5 w-3.5" />
                <span>{isKhmer ? "គំរូណែនាំរហ័ស" : "Quick guidance templates"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => applyTemplate(tpl.body)}
                    className="rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] px-2.5 py-1 text-[11px] font-medium text-[#31374a] transition hover:border-[#3874ff]/50 hover:bg-[#e5edff]/60 hover:text-[#004dff] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#cbd0dd] dark:hover:border-[#3874ff]/50 dark:hover:bg-[#3874ff]/15 dark:hover:text-[#85a9ff]"
                  >
                    + {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="expert-solution"
                  className="text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]"
                >
                  {labels.expertSolution || "Expert Solution"}
                </label>
                <span className="font-mono text-[11px] text-[#8a94ad]">
                  {solution.length} {isKhmer ? "តួអក្សរ" : "chars"}
                </span>
              </div>
              <textarea
                id="expert-solution"
                name="solution"
                rows={7}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                placeholder={
                  labels.solutionPlaceholder || "Provide actionable treatment and field advice..."
                }
                className="ai-input min-h-[175px] resize-y text-xs leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="submit"
                name="action"
                value="approve"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#25b003] px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#1e9302] focus:outline-none focus:ring-2 focus:ring-[#25b003]/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                {labels.approveDiagnosis || "Approve Diagnosis"}
              </button>
              <button
                type="submit"
                name="action"
                value="reject"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#f48270] bg-white px-4 text-xs font-semibold text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/45 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
              >
                <XCircle className="h-4 w-4" />
                {labels.rejectDiagnosis || "Reject Diagnosis"}
              </button>
              <a
                href={d.dashboardUrl}
                className="ai-btn-secondary mt-1 h-9 w-full justify-center gap-1.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {labels.back || (isKhmer ? "ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង" : "Back to dashboard")}
              </a>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
