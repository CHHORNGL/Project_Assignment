import React, { useMemo, useRef, useState } from "react";
import { BookOpen, ImagePlus, Languages, Microscope, X } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertFieldLabel,
  ExpertFormFooter,
  ExpertHeaderActions,
} from "@/components/expert/ExpertShared";
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
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};
  const v = d.formValues;

  const [category, setCategory] = useState(v.agricultureCategory || "");
  const [subCategory, setSubCategory] = useState(v.agricultureSubCategory || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(d.currentImageUrl || null);
  const [hasNewUpload, setHasNewUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const clearSelectedUpload = () => {
    if (fileRef.current) fileRef.current.value = "";
    setHasNewUpload(false);
    setPreviewUrl(d.currentImageUrl || null);
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

        {/* 1. Core Identity & Taxonomy */}
        <AdminSectionCard
          delayIndex={0}
          title={sections.form || (isKhmer ? "ចំណាត់ថ្នាក់ និងអត្តសញ្ញាណជំងឺ" : "Classification & Identity")}
          subtitle={
            sections.formSubtitle ||
            (isKhmer ? "កំណត់ដំណាំ កម្រិតធ្ងន់ធ្ងរ និងវិសាលភាពឯកសារយោង" : "Assign crop, severity level, and taxonomy scope")
          }
          icon={<BookOpen className="h-4 w-4" />}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <ExpertFieldLabel label={labels.crop || "Crop"} required />
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
              <ExpertFieldLabel label={labels.diagnosisName || "Diagnosis Name"} required langTag="EN" />
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
              <ExpertFieldLabel label={labels.diseaseNameKh || "Name (Khmer)"} langTag="KM" />
              <input type="text" name="name_kh" defaultValue={v.nameKh} className="ai-input text-xs" />
            </div>

            <div>
              <ExpertFieldLabel label={labels.severityLevel || "Severity Level"} />
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
              <ExpertFieldLabel
                label={labels.agricultureCategory || "Category"}
                required={!d.minimalMode}
              />
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
              <ExpertFieldLabel
                label={labels.subCategory || "Sub-category"}
                required={!d.minimalMode}
              />
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
              <ExpertFieldLabel
                label={labels.cropReferenceScope || "Reference Scope"}
                required={!d.minimalMode}
              />
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
        </AdminSectionCard>

        {/* 2. Clinical Pathology & Guidance */}
        <AdminSectionCard
          delayIndex={1}
          title={isKhmer ? "រោគវិទ្យា និងការណែនាំព្យាបាល" : "Pathology & Bilingual Clinical Guidance"}
          subtitle={
            isKhmer
              ? "បំពេញមូលហេតុ រោគសញ្ញា វិធីព្យាបាល និងវិធីការពារជាភាសាអង់គ្លេស និងខ្មែរ"
              : "Document root causes, visual symptoms, treatment steps, and citations"
          }
          icon={<Microscope className="h-4 w-4" />}
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <ExpertFieldLabel
                  label={labels.causeExplanation || "Cause Explanation"}
                  required={!d.minimalMode}
                />
                <textarea
                  name="cause_explanation"
                  rows={4}
                  required={!d.minimalMode}
                  defaultValue={v.causeExplanation}
                  placeholder={labels.causeExplanationPlaceholder}
                  className="ai-input text-xs leading-relaxed"
                />
              </div>

              <div>
                <ExpertFieldLabel label={labels.visualInputNotes || "Visual Input Notes"} />
                <textarea
                  name="visual_input_notes"
                  rows={4}
                  defaultValue={v.visualInputNotes}
                  placeholder={labels.visualInputNotesPlaceholder}
                  className="ai-input text-xs leading-relaxed"
                />
              </div>
            </div>

            <div className="border-t border-[#e3e6ed] pt-5 dark:border-[#2b3245]">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#141824] dark:text-[#eff2f6]">
                <Languages className="h-4 w-4 text-[#3874ff]" />
                <span>{isKhmer ? "សេចក្តីពិពណ៌នា និងការព្យាបាលពីរភាសា" : "Bilingual Farmer Guidance"}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <ExpertFieldLabel
                    label={labels.symptomsDescription || "Symptoms Description"}
                    langTag="EN"
                  />
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={v.description}
                    placeholder={labels.descriptionPlaceholder}
                    className="ai-input text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <ExpertFieldLabel
                    label={labels.symptomsDescriptionKh || "Symptoms Description (Khmer)"}
                    langTag="KM"
                  />
                  <textarea
                    name="description_kh"
                    rows={4}
                    defaultValue={v.descriptionKh}
                    className="ai-input text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <ExpertFieldLabel
                    label={labels.stepByStepTreatment || "Step-by-step Treatment"}
                    required={!d.minimalMode}
                    langTag="EN"
                  />
                  <textarea
                    name="treatment"
                    rows={4}
                    required={!d.minimalMode}
                    defaultValue={v.treatment}
                    placeholder={labels.treatmentPlaceholder}
                    className="ai-input text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <ExpertFieldLabel label={labels.treatmentKh || "Treatment (Khmer)"} langTag="KM" />
                  <textarea
                    name="treatment_kh"
                    rows={4}
                    defaultValue={v.treatmentKh}
                    className="ai-input text-xs leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-[#e3e6ed] pt-5 dark:border-[#2b3245] md:grid-cols-2">
              <div>
                <ExpertFieldLabel
                  label={labels.preventionTips || "Prevention Tips"}
                  required={!d.minimalMode}
                />
                <textarea
                  name="prevention_tips"
                  rows={4}
                  required={!d.minimalMode}
                  defaultValue={v.preventionTips}
                  placeholder={labels.preventionPlaceholder}
                  className="ai-input text-xs leading-relaxed"
                />
              </div>

              <div>
                <ExpertFieldLabel label={labels.references || "References"} />
                <textarea
                  name="reference_links"
                  rows={4}
                  defaultValue={v.referenceLinks}
                  placeholder={labels.referencesPlaceholder}
                  className="ai-input text-xs leading-relaxed"
                />
              </div>
            </div>
          </div>
        </AdminSectionCard>

        {/* 3. Visual Reference Media */}
        <AdminSectionCard
          delayIndex={2}
          title={sections.media || "Reference Image"}
          subtitle={sections.mediaSubtitle || (isKhmer ? "បង្ហោះរូបភាពគំរូសម្រាប់ការផ្ទៀងផ្ទាត់រោគសញ្ញា" : "Upload a clear reference specimen photo")}
          icon={<ImagePlus className="h-4 w-4" />}
        >
          <div className="flex flex-wrap items-center gap-5">
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt={labels.diagnosisKnowledgeImageAlt || "Disease reference"}
                  className="h-28 w-28 rounded-xl border border-[#cbd0dd] object-cover shadow-xs dark:border-[#373e53]"
                />
                {hasNewUpload && (
                  <button
                    type="button"
                    onClick={clearSelectedUpload}
                    title={isKhmer ? "ដករូបភាពដែលទើបជ្រើសចេញ" : "Clear selected image"}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#cbd0dd] bg-white text-[#525b75] shadow-sm hover:text-[#b81800] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#cbd0dd]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd0dd] bg-[#f5f7fa] text-[11px] text-[#8a94ad] dark:border-[#373e53] dark:bg-[#0f111a]">
                <ImagePlus className="mb-1 h-5 w-5" />
                <span>{isKhmer ? "គ្មានរូបភាព" : "No preview"}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <label className="ai-btn-secondary inline-flex h-9 cursor-pointer items-center gap-2 px-3.5 text-xs">
                <ImagePlus className="h-4 w-4" />
                <span>{labels.uploadImage || "Upload Image"}</span>
                <input
                  ref={fileRef}
                  type="file"
                  name="knowledge_image_file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPreviewUrl(URL.createObjectURL(file));
                      setHasNewUpload(true);
                    }
                  }}
                />
              </label>
              {d.currentImageUrl && (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#f48270]/60 bg-[#ffe0db]/35 px-3 py-1.5 text-xs font-medium text-[#b81800] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/10 dark:text-[#ff9c8c]">
                  <input type="checkbox" name="remove_knowledge_image" value="1" />
                  <span>{labels.removeExistingImage || "Remove existing image"}</span>
                </label>
              )}
            </div>
          </div>
        </AdminSectionCard>

        <ExpertFormFooter
          backUrl={d.backUrl}
          cancelLabel={labels.cancel || labels.back || "Cancel"}
          submitLabel={
            d.editMode ? labels.updateKnowledge || "Update" : labels.saveKnowledge || "Save Knowledge"
          }
          hint={
            isKhmer
              ? "ទិន្នន័យនេះនឹងជួយដល់ការវិនិច្ឆ័យស្វ័យប្រវត្តិ"
              : "Changes immediately strengthen the clinical knowledge base."
          }
        />
      </form>
    </WorkspaceShell>
  );
}
