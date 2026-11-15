import React from "react";
import { ArrowLeft, Database, Save } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface MixedAgriSourceFormData {
  isEdit: boolean;
  formAction: string;
  backUrl: string;
  formValues: {
    sourceTitle: string;
    sourceOrg: string;
    publicationYear: string;
    sourceType: string;
    accessedAt: string;
    sourceUrl: string;
  };
}

export default function ExpertMixedAgriSourceFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MixedAgriSourceFormData>;
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
          icon={<Database className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.sourceTitle || "Source Title"}
                </label>
                <input
                  type="text"
                  name="source_title"
                  required
                  defaultValue={v.sourceTitle}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.organization || "Organization"}
                </label>
                <input
                  type="text"
                  name="source_org"
                  required
                  defaultValue={v.sourceOrg}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.publicationYear || "Publication Year"}
                </label>
                <input
                  type="number"
                  name="publication_year"
                  defaultValue={v.publicationYear}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.sourceType || "Source Type"}
                </label>
                <input
                  type="text"
                  name="source_type"
                  defaultValue={v.sourceType}
                  className="ai-input text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.accessedDate || "Accessed Date"}
                </label>
                <input
                  type="date"
                  name="accessed_at"
                  required
                  defaultValue={v.accessedAt ? v.accessedAt.slice(0, 10) : ""}
                  className="ai-input text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.sourceUrl || "Source URL"}
                </label>
                <input
                  type="url"
                  name="source_url"
                  defaultValue={v.sourceUrl}
                  placeholder={labels.urlPlaceholder}
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
