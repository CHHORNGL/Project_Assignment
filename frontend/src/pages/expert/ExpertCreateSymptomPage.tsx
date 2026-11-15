import React from "react";
import { ArrowLeft, CheckCircle2, Save, Stethoscope } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface CreateSymptomData {
  formAction: string;
  backUrl: string;
}

export default function ExpertCreateSymptomPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<CreateSymptomData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <AdminSectionCard
          className="lg:col-span-2"
          delayIndex={0}
          title={sections.form || "Add Symptom"}
          subtitle={sections.formSubtitle}
          icon={<Stethoscope className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-4">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.symptomName || "Symptom Name"}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder={labels.symptomNamePlaceholder}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.symptomNameKh || "Symptom Name (Khmer)"}
                </label>
                <input
                  type="text"
                  name="name_kh"
                  placeholder={labels.symptomNameKhPlaceholder}
                  className="ai-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                {labels.description || "Description"}
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder={labels.descriptionPlaceholder}
                className="ai-input text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                {labels.symptomDescriptionKh || "Description (Khmer)"}
              </label>
              <textarea
                name="description_kh"
                rows={3}
                placeholder={labels.descriptionKhPlaceholder}
                className="ai-input text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a href={d.backUrl} className="ai-btn-secondary gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                {labels.cancel || labels.back || "Cancel"}
              </a>
              <button type="submit" className="ai-btn-primary gap-1.5 px-5 text-xs">
                <Save className="h-3.5 w-3.5" />
                {labels.saveSymptom || "Save Symptom"}
              </button>
            </div>
          </form>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          title={sections.guidance || "Authoring Guidance"}
          subtitle={sections.guidanceSubtitle}
        >
          <ul className="space-y-3 text-xs text-[#525b75] dark:text-[#9fa6bc]">
            {[labels.guidanceOne, labels.guidanceTwo, labels.guidanceThree]
              .filter(Boolean)
              .map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#25b003]" />
                  <span>{item}</span>
                </li>
              ))}
          </ul>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
