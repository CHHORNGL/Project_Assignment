import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bug,
  Check,
  FileText,
  GitBranch,
  HeartPulse,
  Languages,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface AdminDiseaseFormData {
  editMode: boolean;
  diseaseId?: number | null;
  rulesCount?: number;
  formAction: string;
  backUrl: string;
  crops: Array<{ id: number; name: string }>;
  severityLevels: Array<{ id: string; label: string }>;
  formValues: {
    cropId: string;
    name: string;
    nameKh: string;
    severityLevel: string;
    description: string;
    descriptionKh: string;
    causeExplanation?: string;
    causeExplanationKh?: string;
    treatment: string;
    treatmentKh: string;
    preventionTips?: string;
    preventionTipsKh?: string;
  };
}

function severityTone(level: string): AdminTone {
  const s = (level || "").toLowerCase();
  if (s === "critical" || s === "high") return "rose";
  if (s === "medium") return "amber";
  return "emerald";
}

export default function AdminDiseaseFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminDiseaseFormData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const v = d.formValues;

  const [cropId, setCropId] = useState(v.cropId || "");
  const [severityLevel, setSeverityLevel] = useState(v.severityLevel || "Low");
  const [name, setName] = useState(v.name || "");
  const [nameKh, setNameKh] = useState(v.nameKh || "");
  const [description, setDescription] = useState(v.description || "");
  const [descriptionKh, setDescriptionKh] = useState(v.descriptionKh || "");
  const [causeExplanation, setCauseExplanation] = useState(v.causeExplanation || "");
  const [causeExplanationKh, setCauseExplanationKh] = useState(v.causeExplanationKh || "");
  const [treatment, setTreatment] = useState(v.treatment || "");
  const [treatmentKh, setTreatmentKh] = useState(v.treatmentKh || "");
  const [preventionTips, setPreventionTips] = useState(v.preventionTips || "");
  const [preventionTipsKh, setPreventionTipsKh] = useState(v.preventionTipsKh || "");
  const [previewLang, setPreviewLang] = useState<"en" | "km">(isKhmer ? "km" : "en");

  const selectedCropName = useMemo(() => {
    const match = d.crops.find((c) => String(c.id) === cropId);
    return match?.name || (isKhmer ? "មិនទាន់ជ្រើសដំណាំ" : "No host crop selected");
  }, [d.crops, cropId, isKhmer]);

  const selectedSeverityLabel = useMemo(() => {
    const match = d.severityLevels.find(
      (s) => s.id.toLowerCase() === severityLevel.toLowerCase(),
    );
    return match?.label || severityLevel;
  }, [d.severityLevels, severityLevel]);

  const checklist = [
    { label: isKhmer ? "ដំណាំគោល" : "Host Crop", done: cropId.trim().length > 0 },
    { label: isKhmer ? "ឈ្មោះ (EN & KM)" : "EN & KM Titles", done: Boolean(name.trim() && nameKh.trim()) },
    { label: isKhmer ? "ការពិពណ៌នា (EN & KM)" : "Overview (EN & KM)", done: Boolean(description.trim() && descriptionKh.trim()) },
    { label: isKhmer ? "មូលហេតុបង្ក" : "Root Cause", done: Boolean(causeExplanation.trim() || causeExplanationKh.trim()) },
    { label: isKhmer ? "វិធីព្យាបាល (EN & KM)" : "Treatment (EN & KM)", done: Boolean(treatment.trim() && treatmentKh.trim()) },
    { label: isKhmer ? "វិធីការពារ" : "Prevention Tips", done: Boolean(preventionTips.trim() || preventionTipsKh.trim()) },
  ];
  const readyCount = checklist.filter((item) => item.done).length;
  const readyPct = Math.round((readyCount / checklist.length) * 100);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.editMode && d.diseaseId && (
            <AdminStatusBadge tone={severityTone(severityLevel)}>
              #{d.diseaseId} · {selectedSeverityLabel}
            </AdminStatusBadge>
          )}
          <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isKhmer ? "ត្រឡប់ទៅបញ្ជីជំងឺ" : "Back to Diseases"}</span>
          </a>
        </div>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Main Clinical Form */}
        <form method="POST" action={d.formAction} className="min-w-0 space-y-6 lg:col-span-8">
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
          <input type="hidden" name="severity_level" value={severityLevel} />

          {/* Section 1: Pathology Identity & Severity */}
          <AdminSectionCard
            delayIndex={0}
            title={isKhmer ? "១. អត្តសញ្ញាណជំងឺ និងកម្រិតធ្ងន់ធ្ងរ" : "1. Pathology Identity & Risk"}
            subtitle={
              isKhmer
                ? "ភ្ជាប់ដំណាំគោល កម្រិតគ្រោះថ្នាក់ និងឈ្មោះជំងឺពីរភាសា"
                : "Assign host crop, triage severity rating, and bilingual disease names"
            }
            icon={<Bug className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ដំណាំគោល *" : "Host Crop *"}
                </label>
                <select
                  name="crop_id"
                  required
                  value={cropId}
                  onChange={(e) => setCropId(e.target.value)}
                  className="ai-input text-xs"
                >
                  <option value="">{isKhmer ? "ជ្រើសរើសដំណាំ..." : "Select host crop..."}</option>
                  {d.crops.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "កម្រិតធ្ងន់ធ្ងរ *" : "Severity Rating *"}
                </label>
                <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-[#cbd0dd] bg-[#f5f7fa] p-1 dark:border-[#373e53] dark:bg-[#0f111a]">
                  {d.severityLevels.map((lvl) => {
                    const active = severityLevel.toLowerCase() === lvl.id.toLowerCase();
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setSeverityLevel(lvl.id)}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all",
                          active && lvl.id === "Low" &&
                            "bg-[#d9fbd0] text-[#1c6c09] shadow-xs ring-1 ring-[#90d67f] dark:bg-[#25b003]/25 dark:text-[#90ee7a]",
                          active && lvl.id === "Medium" &&
                            "bg-[#ffefca] text-[#bc3803] shadow-xs ring-1 ring-[#ffcc85] dark:bg-[#e5780b]/25 dark:text-[#ffbd6b]",
                          active && (lvl.id === "High" || lvl.id === "Critical") &&
                            "bg-[#ffe0db] text-[#b81800] shadow-xs ring-1 ring-[#f48270] dark:bg-[#fa3b1d]/25 dark:text-[#ff9c8c]",
                          !active &&
                            "text-[#525b75] hover:bg-white/70 hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#181d2b] dark:hover:text-[#eff2f6]",
                        )}
                      >
                        {lvl.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ឈ្មោះជំងឺ (អង់គ្លេស) *" : "Disease Name (English) *"}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bacterial Leaf Blight"
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ឈ្មោះជំងឺ (ខ្មែរ)" : "Disease Name (Khmer)"}
                </label>
                <input
                  type="text"
                  name="name_kh"
                  value={nameKh}
                  onChange={(e) => setNameKh(e.target.value)}
                  placeholder="ឧ. ជំងឺរលួយស្លឹកបាក់តេរី"
                  className="ai-input text-xs"
                />
              </div>
            </div>
          </AdminSectionCard>

          {/* Section 2: Clinical Description & Root Cause */}
          <AdminSectionCard
            delayIndex={1}
            title={isKhmer ? "២. ការពិពណ៌នា និងមូលហេតុបង្ក" : "2. Pathology Overview & Root Cause"}
            subtitle={
              isKhmer
                ? "រោគសញ្ញាសម្គាល់ និងភ្នាក់ងារបង្កជំងឺ (ផ្សិត បាក់តេរី វីរុស ឬកង្វះសារធាតុចិញ្ចឹម)"
                : "Visual indicators and underlying causal factors for diagnostic accuracy"
            }
            icon={<FileText className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ការពិពណ៌នា (អង់គ្លេស)" : "Overview (English)"}
                </label>
                <textarea
                  name="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe visible leaf/stem symptoms and disease progression..."
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ការពិពណ៌នា (ខ្មែរ)" : "Overview (Khmer)"}
                </label>
                <textarea
                  name="description_kh"
                  rows={3}
                  value={descriptionKh}
                  onChange={(e) => setDescriptionKh(e.target.value)}
                  placeholder="ពិពណ៌នាអំពីរោគសញ្ញាដែលសង្កេតឃើញលើស្លឹក ឬដើម..."
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "មូលហេតុបង្ក (អង់គ្លេស)" : "Cause Explanation (English)"}
                </label>
                <textarea
                  name="cause_explanation"
                  rows={2}
                  value={causeExplanation}
                  onChange={(e) => setCauseExplanation(e.target.value)}
                  placeholder="Pathogen species, vector conditions, or environmental triggers..."
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "មូលហេតុបង្ក (ខ្មែរ)" : "Cause Explanation (Khmer)"}
                </label>
                <textarea
                  name="cause_explanation_kh"
                  rows={2}
                  value={causeExplanationKh}
                  onChange={(e) => setCauseExplanationKh(e.target.value)}
                  placeholder="កត្តាបង្កជំងឺ សត្វល្អិតចម្លង ឬលក្ខខណ្ឌអាកាសធាតុ..."
                  className="ai-input text-xs"
                />
              </div>
            </div>
          </AdminSectionCard>

          {/* Section 3: Treatment Protocol & Prevention */}
          <AdminSectionCard
            delayIndex={2}
            title={isKhmer ? "៣. វិធីព្យាបាល និងការបង្ការ" : "3. Treatment Protocol & Prevention"}
            subtitle={
              isKhmer
                ? "ជំហានណែនាំជាក់ស្តែងសម្រាប់កសិករអនុវត្ត និងវិធានការទប់ស្កាត់"
                : "Actionable remediation guidance and preventive field practices"
            }
            icon={<HeartPulse className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "វិធីព្យាបាល (អង់គ្លេស)" : "Treatment Steps (English)"}
                  </label>
                  <textarea
                    name="treatment"
                    rows={3}
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                    placeholder="Recommended organic, cultural, or targeted chemical controls..."
                    className="ai-input text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "វិធីព្យាបាល (ខ្មែរ)" : "Treatment Steps (Khmer)"}
                  </label>
                  <textarea
                    name="treatment_kh"
                    rows={3}
                    value={treatmentKh}
                    onChange={(e) => setTreatmentKh(e.target.value)}
                    placeholder="វិធីសាស្ត្រព្យាបាល និងការគ្រប់គ្រងជាក់ស្តែង..."
                    className="ai-input text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "វិធានការបង្ការ (អង់គ្លេស)" : "Prevention Tips (English)"}
                  </label>
                  <textarea
                    name="prevention_tips"
                    rows={2}
                    value={preventionTips}
                    onChange={(e) => setPreventionTips(e.target.value)}
                    placeholder="Resistant varieties, sanitation, spacing, or irrigation practices..."
                    className="ai-input text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "វិធានការបង្ការ (ខ្មែរ)" : "Prevention Tips (Khmer)"}
                  </label>
                  <textarea
                    name="prevention_tips_kh"
                    rows={2}
                    value={preventionTipsKh}
                    onChange={(e) => setPreventionTipsKh(e.target.value)}
                    placeholder="ការជ្រើសរើសពូជធន់ អនាម័យចម្ការ និងការការពារជាមុន..."
                    className="ai-input text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "បោះបង់" : "Cancel"}</span>
                </a>
                <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {d.editMode
                      ? isKhmer
                        ? "រក្សាទុកការកែប្រែ"
                        : "Update Disease"
                      : isKhmer
                        ? "បង្កើតជំងឺ"
                        : "Save Disease"}
                  </span>
                </button>
              </div>
            </div>
          </AdminSectionCard>
        </form>

        {/* Right Sticky Advisory Preview & Completeness Sidebar */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:col-span-4">
          <AdminSectionCard
            delayIndex={1}
            title={isKhmer ? "មើលជាមុន" : "Advisory Preview"}
            subtitle={isKhmer ? "ទម្រង់ណែនាំសម្រាប់កសិករ" : "Live clinical output preview"}
            icon={<Languages className="h-4 w-4" />}
            action={
              <div className="inline-flex rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 text-[10px] font-bold dark:border-[#373e53] dark:bg-[#0f111a]">
                <button
                  type="button"
                  onClick={() => setPreviewLang("en")}
                  className={cn(
                    "rounded px-2 py-0.5",
                    previewLang === "en"
                      ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                      : "text-[#6e7891] dark:text-[#8a94ad]",
                  )}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLang("km")}
                  className={cn(
                    "rounded px-2 py-0.5",
                    previewLang === "km"
                      ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                      : "text-[#6e7891] dark:text-[#8a94ad]",
                  )}
                >
                  KM
                </button>
              </div>
            }
          >
            <div className="space-y-3 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AdminStatusBadge tone="slate">{selectedCropName}</AdminStatusBadge>
                <AdminStatusBadge tone={severityTone(severityLevel)}>
                  {selectedSeverityLabel}
                </AdminStatusBadge>
              </div>

              <div>
                <h4 className="font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {previewLang === "km"
                    ? nameKh.trim() || name.trim() || "Untitled Disease"
                    : name.trim() || "Untitled Disease"}
                </h4>
                <p className="mt-0.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                  {previewLang === "km"
                    ? name.trim() || "—"
                    : nameKh.trim() || "No Khmer title"}
                </p>
              </div>

              <div className="space-y-2 border-t border-[#e3e6ed] pt-2.5 text-xs dark:border-[#2b3245]">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer ? "សេចក្តីពណ៌នា" : "Overview"}
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-[#31374a] dark:text-[#cbd0dd]">
                    {(previewLang === "km" ? descriptionKh || description : description) || "—"}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer ? "វិធីព្យាបាល" : "Treatment"}
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-[#31374a] dark:text-[#cbd0dd]">
                    {(previewLang === "km" ? treatmentKh || treatment : treatment) || "—"}
                  </p>
                </div>
                {(preventionTips.trim() || preventionTipsKh.trim()) && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "ការការពារ" : "Prevention"}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[#31374a] dark:text-[#cbd0dd]">
                      {(previewLang === "km" ? preventionTipsKh || preventionTips : preventionTips) || "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={2}
            title={isKhmer ? "ភាពពេញលេញព័ត៌មាន" : "Clinical Readiness"}
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <div className="space-y-3.5">
              <AdminProgressBar
                value={readyCount}
                max={checklist.length}
                tone={readyPct >= 80 ? "emerald" : "indigo"}
                height="sm"
                label={isKhmer ? "កម្រិតពេញលេញ" : "Documentation score"}
                valueLabel={`${readyCount}/${checklist.length} (${readyPct}%)`}
              />

              <div className="space-y-1.5 border-t border-[#e3e6ed] pt-3 dark:border-[#2b3245]">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-[#525b75] dark:text-[#9fa6bc]">{item.label}</span>
                    <span
                      className={cn(
                        "font-semibold",
                        item.done
                          ? "text-[#1c6c09] dark:text-[#90ee7a]"
                          : "text-[#8a94ad]",
                      )}
                    >
                      {item.done ? <Check className="h-3.5 w-3.5" /> : "—"}
                    </span>
                  </div>
                ))}
              </div>

              {d.editMode && (
                <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3 py-2 text-xs dark:border-[#2b3245] dark:bg-[#0f111a]">
                  <span className="flex items-center gap-1.5 text-[#525b75] dark:text-[#9fa6bc]">
                    <GitBranch className="h-3.5 w-3.5 text-[#3874ff]" />
                    {isKhmer ? "ច្បាប់វិនិច្ឆ័យភ្ជាប់" : "Linked inference rules"}
                  </span>
                  <span className="font-mono font-bold text-[#141824] dark:text-[#eff2f6]">
                    {(d.rulesCount ?? 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </AdminSectionCard>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
