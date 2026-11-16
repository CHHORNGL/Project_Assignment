import React, { useState } from "react";
import { BarChart3, FileText } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertFieldLabel,
  ExpertFormFooter,
  ExpertHeaderActions,
} from "@/components/expert/ExpertShared";
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
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};
  const v = d.formValues;

  const [factText, setFactText] = useState(v.factText || "");

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <form method="POST" action={d.formAction} className="mx-auto max-w-3xl space-y-6">
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

        <AdminSectionCard
          delayIndex={0}
          title={sections.form || (isKhmer ? "ព័ត៌មានទិន្នន័យកសិកម្ម" : "Fact Attribution & Content")}
          subtitle={sections.formSubtitle}
          icon={<FileText className="h-4 w-4" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ExpertFieldLabel label={labels.source || "Source"} required />
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
              <ExpertFieldLabel label={labels.topic || "Topic"} required />
              <input
                type="text"
                name="topic"
                required
                defaultValue={v.topic}
                className="ai-input text-xs"
              />
            </div>

            <div>
              <ExpertFieldLabel label={labels.region || "Region"} />
              <input
                type="text"
                name="region"
                defaultValue={v.region}
                className="ai-input text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <ExpertFieldLabel
                label={labels.factText || "Fact Text"}
                required
                hint={`${factText.length} ${isKhmer ? "តួអក្សរ" : "chars"}`}
              />
              <textarea
                name="fact_text"
                rows={4}
                required
                value={factText}
                onChange={(e) => setFactText(e.target.value)}
                className="ai-input text-xs leading-relaxed"
              />
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          title={isKhmer ? "ទិន្នន័យរង្វាស់ស្ថិតិ (ស្រេចចិត្ត)" : "Quantitative Metric (Optional)"}
          subtitle={
            isKhmer
              ? "កត់ត្រាតម្លៃ ឯកតា និងឆ្នាំនៃការស្រាវជ្រាវ"
              : "Record benchmark value, unit, and observation year if cited"
          }
          icon={<BarChart3 className="h-4 w-4" />}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <ExpertFieldLabel label={labels.metricValue || "Metric Value"} />
              <input
                type="text"
                name="metric_value"
                defaultValue={v.metricValue}
                placeholder={labels.metricValuePlaceholder}
                className="ai-input font-mono text-xs"
              />
            </div>
            <div>
              <ExpertFieldLabel label={labels.metricUnit || "Metric Unit"} />
              <input
                type="text"
                name="metric_unit"
                defaultValue={v.metricUnit}
                placeholder={labels.metricUnitPlaceholder}
                className="ai-input text-xs"
              />
            </div>
            <div>
              <ExpertFieldLabel label={labels.metricYear || "Metric Year"} />
              <input
                type="number"
                name="metric_year"
                defaultValue={v.metricYear}
                className="ai-input font-mono text-xs"
              />
            </div>
          </div>
        </AdminSectionCard>

        <ExpertFormFooter
          backUrl={d.backUrl}
          cancelLabel={labels.cancel || labels.back || "Cancel"}
          submitLabel={d.isEdit ? labels.update || "Update" : labels.save || "Save"}
        />
      </form>
    </WorkspaceShell>
  );
}
