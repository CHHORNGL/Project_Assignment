import React from "react";
import { ArrowLeft, Bug, Save } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface AdminDiseaseFormData {
  editMode: boolean;
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
    treatment: string;
    treatmentKh: string;
  };
}

export default function AdminDiseaseFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminDiseaseFormData>;
}) {
  const d = bootstrap.data;
  const v = d.formValues;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="mx-auto max-w-4xl">
        <AdminSectionCard
          delayIndex={0}
          title={d.editMode ? "Edit Disease & Treatment Guide" : "Add New Crop Disease"}
          subtitle="Link affected host crop, severity rating, and bilingual treatment steps"
          icon={<Bug className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Crop</label>
                <select name="crop_id" required defaultValue={v.cropId} className="ai-input text-xs">
                  <option value="">Select crop</option>
                  {d.crops.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Severity Level</label>
                <select name="severity_level" defaultValue={v.severityLevel || "Low"} className="ai-input text-xs">
                  {d.severityLevels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Disease Name (English)</label>
                <input type="text" name="name" required defaultValue={v.name} className="ai-input text-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Disease Name (Khmer)</label>
                <input type="text" name="name_kh" defaultValue={v.nameKh} className="ai-input text-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Description (English)</label>
                <textarea name="description" rows={3} defaultValue={v.description} className="ai-input text-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Description (Khmer)</label>
                <textarea name="description_kh" rows={3} defaultValue={v.descriptionKh} className="ai-input text-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Treatment (English)</label>
                <textarea name="treatment" rows={3} defaultValue={v.treatment} className="ai-input text-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Treatment (Khmer)</label>
                <textarea name="treatment_kh" rows={3} defaultValue={v.treatmentKh} className="ai-input text-xs" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/70 pt-4 dark:border-slate-800/80">
              <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </a>
              <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
                <Save className="h-3.5 w-3.5" /> {d.editMode ? "Update Disease" : "Save Disease"}
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
