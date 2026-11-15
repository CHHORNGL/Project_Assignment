import React from "react";
import { ArrowLeft, FileText, Save } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface MixedAgriFactFormData {
  isEdit: boolean;
  formAction: string;
  backUrl: string;
  options: { sources: Array<{ id: number; title: string }> };
  formValues: {
    sourceId: string;
    topic: string;
    region: string;
    factText: string;
    metricValue: string;
    metricUnit: string;
    metricYear: string;
  };
}

export default function ExpertMixedAgriFactFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MixedAgriFactFormData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};
  const v = d.formValues;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="mx-auto max-w-3xl">
        <AdminSectionCard
          delayIndex={0}
          title={sections.form}
          subtitle={sections.formSubtitle}
          icon={<FileText className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.source || "Source"}
                </label>
                <select
                  name="source_id"
                  required
                  defaultValue={v.sourceId}
                  className="ai-input text-xs"
                >
                  <option value="">{labels.selectSource || "Select source"}</option>
                  {d.options.sources.map((src) => (
                    <option key={src.id} value={String(src.id)}>
                      {src.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.topic || "Topic"}
                </label>
                <input
                  type="text"
                  name="topic"
                  required
                  defaultValue={v.topic}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.region || "Region"}
                </label>
                <input
                  type="text"
                  name="region"
                  defaultValue={v.region}
                  className="ai-input text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.factText || "Fact Text"}
                </label>
                <textarea
                  name="fact_text"
                  rows={4}
                  required
                  defaultValue={v.factText}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.metricValue || "Metric Value"}
                </label>
                <input
                  type="text"
                  name="metric_value"
                  defaultValue={v.metricValue}
                  placeholder={labels.metricValuePlaceholder}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.metricUnit || "Metric Unit"}
                </label>
                <input
                  type="text"
                  name="metric_unit"
                  defaultValue={v.metricUnit}
                  placeholder={labels.metricUnitPlaceholder}
                  className="ai-input text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.metricYear || "Metric Year"}
                </label>
                <input
                  type="number"
                  name="metric_year"
                  defaultValue={v.metricYear}
                  className="ai-input text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a href={d.backUrl} className="ai-btn-secondary gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                {labels.cancel || labels.back || "Cancel"}
              </a>
              <button type="submit" className="ai-btn-primary gap-1.5 px-5 text-xs">
                <Save className="h-3.5 w-3.5" />
                {d.isEdit ? labels.update || "Update" : labels.save || "Save"}
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
