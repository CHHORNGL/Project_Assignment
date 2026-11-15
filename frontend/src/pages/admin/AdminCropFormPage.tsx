import React from "react";
import { ArrowLeft, Save, Sprout } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface CropFormData {
  isEdit: boolean;
  formAction: string;
  backUrl: string;
  formValues: {
    name: string;
    nameKh: string;
    emoji: string;
    description: string;
    descriptionKh: string;
  };
}

export default function AdminCropFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<CropFormData>;
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
      <div className="mx-auto max-w-3xl">
        <AdminSectionCard
          delayIndex={0}
          title={d.isEdit ? "Update Crop Profile" : "Register Crop Variety"}
          subtitle="Provide localized English and Khmer catalog labels and agronomy notes"
          icon={<Sprout className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold">Crop Name (English)</label>
                <input type="text" name="name" required defaultValue={v.name} className="ai-input text-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Emoji Icon</label>
                <input
                  type="text"
                  name="emoji"
                  maxLength={8}
                  defaultValue={v.emoji}
                  placeholder="🌾"
                  className="ai-input text-center text-base"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold">Crop Name (Khmer)</label>
                <input type="text" name="name_kh" defaultValue={v.nameKh} className="ai-input text-xs" />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold">Description (English)</label>
                <textarea name="description" rows={3} defaultValue={v.description} className="ai-input text-xs" />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold">Description (Khmer)</label>
                <textarea name="description_kh" rows={3} defaultValue={v.descriptionKh} className="ai-input text-xs" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/70 pt-4 dark:border-slate-800/80">
              <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </a>
              <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
                <Save className="h-3.5 w-3.5" /> {d.isEdit ? "Update Crop" : "Add Crop"}
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
