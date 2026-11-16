import React, { useState } from "react";
import { CheckCircle2, Circle, Languages, Stethoscope } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertFieldLabel,
  ExpertFormFooter,
  ExpertHeaderActions,
} from "@/components/expert/ExpertShared";
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
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};

  const [name, setName] = useState("");
  const [nameKh, setNameKh] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionKh, setDescriptionKh] = useState("");

  const checklist = [
    { done: name.trim().length > 0, label: labels.symptomName || "English symptom name" },
    { done: nameKh.trim().length > 0, label: labels.symptomNameKh || "Khmer translation" },
    {
      done: description.trim().length > 0 || descriptionKh.trim().length > 0,
      label: labels.description || "Clinical description",
    },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <form method="POST" action={d.formAction} className="min-w-0 space-y-5 lg:col-span-2">
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

          <AdminSectionCard
            delayIndex={0}
            title={sections.form || "Add Symptom"}
            subtitle={sections.formSubtitle}
            icon={<Stethoscope className="h-4 w-4" />}
          >
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <ExpertFieldLabel
                    label={labels.symptomName || "Symptom Name"}
                    required
                    langTag="EN"
                  />
                  <input
                    type="text"
                    name="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={labels.symptomNamePlaceholder}
                    className="ai-input text-xs"
                  />
                </div>
                <div>
                  <ExpertFieldLabel
                    label={labels.symptomNameKh || "Symptom Name (Khmer)"}
                    langTag="KM"
                  />
                  <input
                    type="text"
                    name="name_kh"
                    value={nameKh}
                    onChange={(e) => setNameKh(e.target.value)}
                    placeholder={labels.symptomNameKhPlaceholder}
                    className="ai-input text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#141824] dark:text-[#eff2f6]">
                  <Languages className="h-4 w-4 text-[#3874ff]" />
                  <span>{isKhmer ? "សេចក្តីពិពណ៌នារោគសញ្ញា" : "Symptom Descriptions"}</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <ExpertFieldLabel
                      label={labels.description || "Description"}
                      langTag="EN"
                    />
                    <textarea
                      name="description"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={labels.descriptionPlaceholder}
                      className="ai-input text-xs leading-relaxed"
                    />
                  </div>
                  <div>
                    <ExpertFieldLabel
                      label={labels.symptomDescriptionKh || "Description (Khmer)"}
                      langTag="KM"
                    />
                    <textarea
                      name="description_kh"
                      rows={3}
                      value={descriptionKh}
                      onChange={(e) => setDescriptionKh(e.target.value)}
                      placeholder={labels.descriptionKhPlaceholder}
                      className="ai-input text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AdminSectionCard>

          <ExpertFormFooter
            backUrl={d.backUrl}
            cancelLabel={labels.cancel || labels.back || "Cancel"}
            submitLabel={labels.saveSymptom || "Save Symptom"}
          />
        </form>

        <AdminSectionCard
          className="min-w-0"
          delayIndex={1}
          title={sections.guidance || "Authoring Guidance"}
          subtitle={sections.guidanceSubtitle}
          icon={<CheckCircle2 className="h-4 w-4" />}
        >
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "ស្ថានភាពបំពេញ" : "Entry Readiness"}
              </div>
              {checklist.map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  {row.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#25b003]" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-[#cbd0dd] dark:text-[#373e53]" />
                  )}
                  <span
                    className={
                      row.done
                        ? "font-semibold text-[#141824] dark:text-[#eff2f6]"
                        : "text-[#6e7891] dark:text-[#8a94ad]"
                    }
                  >
                    {row.label}
                  </span>
                </div>
              ))}
            </div>

            <ul className="space-y-2.5 text-xs text-[#525b75] dark:text-[#9fa6bc]">
              {[labels.guidanceOne, labels.guidanceTwo, labels.guidanceThree]
                .filter(Boolean)
                .map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3874ff]" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
            </ul>
          </div>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
