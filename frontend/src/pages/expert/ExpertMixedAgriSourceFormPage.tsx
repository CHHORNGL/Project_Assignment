import React from "react";
import { Database, Link2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertFieldLabel,
  ExpertFormFooter,
  ExpertHeaderActions,
} from "@/components/expert/ExpertShared";
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
  const isKhmer = bootstrap.lang === "km";
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
      <form method="POST" action={d.formAction} className="mx-auto max-w-3xl space-y-6">
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

        <AdminSectionCard
          delayIndex={0}
          title={sections.form || (isKhmer ? "ព័ត៌មានប្រភពឯកសារ" : "Publication Identity")}
          subtitle={sections.formSubtitle}
          icon={<Database className="h-4 w-4" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ExpertFieldLabel label={labels.sourceTitle || "Source Title"} required />
              <input
                type="text"
                name="source_title"
                required
                defaultValue={v.sourceTitle}
                className="ai-input text-xs"
              />
            </div>

            <div>
              <ExpertFieldLabel label={labels.organization || "Organization"} required />
              <input
                type="text"
                name="source_org"
                required
                defaultValue={v.sourceOrg}
                className="ai-input text-xs"
              />
            </div>

            <div>
              <ExpertFieldLabel label={labels.publicationYear || "Publication Year"} />
              <input
                type="number"
                name="publication_year"
                defaultValue={v.publicationYear}
                className="ai-input text-xs"
              />
            </div>

            <div>
              <ExpertFieldLabel label={labels.sourceType || "Source Type"} />
              <input
                type="text"
                name="source_type"
                defaultValue={v.sourceType}
                className="ai-input text-xs"
              />
            </div>

            <div>
              <ExpertFieldLabel label={labels.accessedDate || "Accessed Date"} required />
              <input
                type="date"
                name="accessed_at"
                required
                defaultValue={v.accessedAt ? v.accessedAt.slice(0, 10) : ""}
                className="ai-input text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <ExpertFieldLabel label={labels.sourceUrl || "Source URL"} />
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                <input
                  type="url"
                  name="source_url"
                  defaultValue={v.sourceUrl}
                  placeholder={labels.urlPlaceholder || "https://..."}
                  className="ai-input pl-10 text-xs"
                />
              </div>
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
