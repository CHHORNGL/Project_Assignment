import React, { useMemo, useState } from "react";
import { Microscope, Sliders } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertFieldLabel,
  ExpertFormFooter,
  ExpertHeaderActions,
} from "@/components/expert/ExpertShared";
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
  const isKhmer = bootstrap.lang === "km";
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
      <form method="POST" action={d.formAction} className="mx-auto max-w-4xl space-y-6">
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

        <AdminSectionCard
          delayIndex={0}
          title={sections.form || (isKhmer ? "ព័ត៌មានចំណាត់ថ្នាក់ដំណាំ" : "Crop & Pathology Classification")}
          subtitle={sections.formSubtitle}
          icon={<Sliders className="h-4 w-4" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <ExpertFieldLabel label={labels.cropName || "Crop Name"} required />
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
              <ExpertFieldLabel label={labels.diseaseName || "Disease Name"} required />
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
              <ExpertFieldLabel label={labels.agricultureCategory || "Category"} required />
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
              <ExpertFieldLabel label={labels.subCategory || "Sub-category"} required />
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
              <ExpertFieldLabel label={labels.cropReferenceScope || "Reference Scope"} required />
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
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          title={isKhmer ? "រោគសញ្ញា និងដំណោះស្រាយជំនាញ" : "Observed Symptoms & Clinical Solution"}
          subtitle={
            isKhmer
              ? "បន្ថែមកំណត់ចំណាំរូបភាព និងវិធានការដោះស្រាយសម្រាប់កសិករ"
              : "Specify symptom indicators, visual inspection notes, and recommended action"
          }
          icon={<Microscope className="h-4 w-4" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ExpertFieldLabel label={labels.symptoms || "Symptoms"} required />
              <textarea
                name="symptoms"
                rows={3}
                required
                defaultValue={v.symptoms}
                placeholder={labels.symptomsPlaceholder}
                className="ai-input text-xs leading-relaxed"
              />
            </div>

            <div>
              <ExpertFieldLabel label={labels.visualInputNotes || "Visual Notes"} />
              <textarea
                name="visual_input_notes"
                rows={4}
                defaultValue={v.visualInputNotes}
                placeholder={labels.visualInputNotesPlaceholder}
                className="ai-input text-xs leading-relaxed"
              />
            </div>

            <div>
              <ExpertFieldLabel label={labels.treatment || "Solution"} />
              <textarea
                name="solution"
                rows={4}
                defaultValue={v.solution}
                placeholder={labels.solutionPlaceholder}
                className="ai-input text-xs leading-relaxed"
              />
            </div>
          </div>
        </AdminSectionCard>

        <ExpertFormFooter
          backUrl={d.backUrl}
          cancelLabel={labels.cancel || "Cancel"}
          submitLabel={labels.saveKnowledge || "Save Knowledge"}
        />
      </form>
    </WorkspaceShell>
  );
}
