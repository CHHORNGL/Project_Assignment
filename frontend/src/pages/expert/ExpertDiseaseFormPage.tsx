import React, { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, ImagePlus, Save } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface DiseaseFormData {
  editMode: boolean;
  formAction: string;
  backUrl: string;
  currentImageUrl?: string | null;
  minimalMode?: boolean;
  options: {
    crops: Array<{ id: number; name: string }>;
    categories: Array<{ id: string; label: string }>;
    subCategoryMap: Record<string, string[]>;
    referenceScopes: Array<{ id: string; label: string }>;
    severityLevels: Array<{ id: string; label: string }>;
  };
  formValues: {
    cropId: string;
    name: string;
    nameKh: string;
    severityLevel: string;
    agricultureCategory: string;
    agricultureSubCategory: string;
    referenceScope: string;
    visualInputNotes: string;
    causeExplanation: string;
    description: string;
    descriptionKh: string;
    treatment: string;
    treatmentKh: string;
    preventionTips: string;
    referenceLinks: string;
  };
}

export default function ExpertDiseaseFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<DiseaseFormData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};
  const v = d.formValues;

  const [category, setCategory] = useState(v.agricultureCategory || "");
  const [subCategory, setSubCategory] = useState(v.agricultureSubCategory || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(d.currentImageUrl || null);

  const subCategories = useMemo(() => {
    const list = d.options.subCategoryMap[category] || [];
    if (subCategory && !list.includes(subCategory)) {
      return [subCategory, ...list];
    }
    return list;
  }, [category, subCategory, d.options.subCategoryMap]);

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    const list = d.options.subCategoryMap[next] || [];
    setSubCategory(list[0] || "");
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <form
        method="POST"
        action={d.formAction}
        encType="multipart/form-data"
        className="mx-auto max-w-5xl space-y-6"
      >
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

        <AdminSectionCard
          delayIndex={0}
          title={sections.form || "Diagnosis Knowledge"}
          subtitle={sections.formSubtitle}
          icon={<BookOpen className="h-4 w-4" />}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.crop || "Crop"}
                </label>
                <select name="crop_id" required defaultValue={v.cropId} className="ai-input text-xs">
                  <option value="">{labels.selectCrop || "Select crop"}</option>
                  {d.options.crops.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.diagnosisName || "Diagnosis Name"}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={v.name}
                  placeholder={labels.diagnosisPlaceholder}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.diseaseNameKh || "Name (Khmer)"}
                </label>
                <input type="text" name="name_kh" defaultValue={v.nameKh} className="ai-input text-xs" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.severityLevel || "Severity Level"}
                </label>
                <select
                  name="severity_level"
                  defaultValue={v.severityLevel || "Low"}
                  className="ai-input text-xs"
                >
                  {d.options.severityLevels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.agricultureCategory || "Category"}
                </label>
                {d.options.categories.length > 0 ? (
                  <select
                    name="agriculture_category"
                    required={!d.minimalMode}
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="ai-input text-xs"
                  >
                    <option value="">
                      {labels.agricultureCategoryExample || "Select category"}
                    </option>
                    {d.options.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="agriculture_category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={labels.agricultureCategoryExample}
                    className="ai-input text-xs"
                  />
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.subCategory || "Sub-category"}
                </label>
                {subCategories.length > 0 ? (
                  <select
                    name="agriculture_sub_category"
                    required={!d.minimalMode}
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
                    required={!d.minimalMode}
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    placeholder={labels.subCategoryExample}
                    className="ai-input text-xs"
                  />
                )}
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.cropReferenceScope || "Reference Scope"}
                </label>
                <select
                  name="reference_scope"
                  required={!d.minimalMode}
                  defaultValue={v.referenceScope}
                  className="ai-input text-xs"
                >
                  <option value="">{labels.selectScope || "Select scope"}</option>
                  {d.options.referenceScopes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.causeExplanation || "Cause Explanation"}
                </label>
                <textarea
                  name="cause_explanation"
                  rows={4}
                  required={!d.minimalMode}
                  defaultValue={v.causeExplanation}
                  placeholder={labels.causeExplanationPlaceholder}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.visualInputNotes || "Visual Input Notes"}
                </label>
                <textarea
                  name="visual_input_notes"
                  rows={4}
                  defaultValue={v.visualInputNotes}
                  placeholder={labels.visualInputNotesPlaceholder}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.symptomsDescription || "Symptoms Description"}
                </label>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={v.description}
                  placeholder={labels.descriptionPlaceholder}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.symptomsDescriptionKh || "Symptoms Description (Khmer)"}
                </label>
                <textarea
                  name="description_kh"
                  rows={4}
                  defaultValue={v.descriptionKh}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.stepByStepTreatment || "Step-by-step Treatment"}
                </label>
                <textarea
                  name="treatment"
                  rows={4}
                  required={!d.minimalMode}
                  defaultValue={v.treatment}
                  placeholder={labels.treatmentPlaceholder}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.treatmentKh || "Treatment (Khmer)"}
                </label>
                <textarea
                  name="treatment_kh"
                  rows={4}
                  defaultValue={v.treatmentKh}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.preventionTips || "Prevention Tips"}
                </label>
                <textarea
                  name="prevention_tips"
                  rows={4}
                  required={!d.minimalMode}
                  defaultValue={v.preventionTips}
                  placeholder={labels.preventionPlaceholder}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.references || "References"}
                </label>
                <textarea
                  name="reference_links"
                  rows={4}
                  defaultValue={v.referenceLinks}
                  placeholder={labels.referencesPlaceholder}
                  className="ai-input text-xs"
                />
              </div>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          title={sections.media || "Reference Image"}
          subtitle={sections.mediaSubtitle}
          icon={<ImagePlus className="h-4 w-4" />}
        >
          <div className="flex flex-wrap items-center gap-5">
            {previewUrl && (
              <img
                src={previewUrl}
                alt={labels.diagnosisKnowledgeImageAlt || "Disease reference"}
                className="h-28 w-28 rounded-xl border border-[#cbd0dd] object-cover dark:border-[#373e53]"
              />
            )}
            <div className="space-y-2">
              <label className="ai-btn-secondary inline-flex cursor-pointer items-center gap-2 text-xs">
                <ImagePlus className="h-4 w-4" />
                {labels.uploadImage || "Upload Image"}
                <input
                  type="file"
                  name="knowledge_image_file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPreviewUrl(URL.createObjectURL(file));
                  }}
                />
              </label>
              {d.currentImageUrl && (
                <label className="flex items-center gap-2 text-xs text-[#b81800] dark:text-[#ff9c8c]">
                  <input type="checkbox" name="remove_knowledge_image" value="1" />
                  {labels.removeExistingImage || "Remove existing image"}
                </label>
              )}
            </div>
          </div>
        </AdminSectionCard>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href={d.backUrl} className="ai-btn-secondary gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            {labels.cancel || labels.back || "Cancel"}
          </a>
          <button type="submit" className="ai-btn-primary gap-1.5 px-6 text-xs">
            <Save className="h-3.5 w-3.5" />
            {d.editMode ? labels.updateKnowledge || "Update" : labels.saveKnowledge || "Save Knowledge"}
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}
