import React, { useMemo, useState } from "react";
import { ArrowLeft, Save, Sliders } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface OptionalFormData {
  formAction: string;
  backUrl: string;
  options: {
    categories: Array<{ id: string; label: string }>;
    subCategoryMap: Record<string, string[]>;
    referenceScopes: Array<{ id: string; label: string }>;
  };
  formValues: {
    cropName: string;
    diseaseName: string;
    agricultureCategory: string;
    agricultureSubCategory: string;
    referenceScope: string;
    symptoms: string;
    visualInputNotes: string;
    solution: string;
  };
}

export default function ExpertOptionalFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<OptionalFormData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};
  const v = d.formValues;

  const [category, setCategory] = useState(v.agricultureCategory || "");
  const [subCategory, setSubCategory] = useState(v.agricultureSubCategory || "");

  const subCategories = useMemo(() => {
    const list = d.options.subCategoryMap[category] || [];
    if (subCategory && !list.includes(subCategory)) return [subCategory, ...list];
    return list;
  }, [category, subCategory, d.options.subCategoryMap]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="mx-auto max-w-4xl">
        <AdminSectionCard
          delayIndex={0}
          title={sections.form || "Expert Form"}
          subtitle={sections.formSubtitle}
          icon={<Sliders className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.cropName || "Crop Name"}
                </label>
                <input
                  type="text"
                  name="crop_name"
                  required
                  defaultValue={v.cropName}
                  placeholder={labels.cropExample}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.diseaseName || "Disease Name"}
                </label>
                <input
                  type="text"
                  name="disease_name"
                  required
                  defaultValue={v.diseaseName}
                  placeholder={labels.diseaseExample}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.agricultureCategory || "Category"}
                </label>
                <select
                  name="agriculture_category"
                  required
                  value={category}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCategory(next);
                    setSubCategory((d.options.subCategoryMap[next] || [])[0] || "");
                  }}
                  className="ai-input text-xs"
                >
                  <option value="">{labels.agricultureCategoryExample || "Select category"}</option>
                  {d.options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.subCategory || "Sub-category"}
                </label>
                {subCategories.length > 0 ? (
                  <select
                    name="agriculture_sub_category"
                    required
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="ai-input text-xs"
                  >
                    <option value="">{labels.subCategoryExample || "Select sub-category"}</option>
                    {subCategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="agriculture_sub_category"
                    required
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="ai-input text-xs"
                  />
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.cropReferenceScope || "Reference Scope"}
                </label>
                <select
                  name="reference_scope"
                  required
                  defaultValue={v.referenceScope}
                  className="ai-input text-xs"
                >
                  <option value="">{labels.selectScope || "Select scope"}</option>
                  {d.options.referenceScopes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.symptoms || "Symptoms"}
                </label>
                <textarea
                  name="symptoms"
                  rows={3}
                  required
                  defaultValue={v.symptoms}
                  placeholder={labels.symptomsPlaceholder}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.visualInputNotes || "Visual Notes"}
                </label>
                <textarea
                  name="visual_input_notes"
                  rows={3}
                  defaultValue={v.visualInputNotes}
                  placeholder={labels.visualInputNotesPlaceholder}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.treatment || "Solution"}
                </label>
                <textarea
                  name="solution"
                  rows={3}
                  defaultValue={v.solution}
                  placeholder={labels.solutionPlaceholder}
                  className="ai-input text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a href={d.backUrl} className="ai-btn-secondary gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                {labels.cancel || "Cancel"}
              </a>
              <button type="submit" className="ai-btn-primary gap-1.5 px-6 text-xs">
                <Save className="h-3.5 w-3.5" />
                {labels.saveKnowledge || "Save Knowledge"}
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
