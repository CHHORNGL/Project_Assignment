import React from "react";
import { ArrowLeft, Megaphone, Save } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";

interface MarqueeFormData {
  isEdit: boolean;
  formAction: string;
  backUrl: string;
  formValues: {
    text: string;
    textKh: string;
    sortOrder: number;
    isActive: boolean;
  };
}

export default function AdminMarqueeFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MarqueeFormData>;
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
      <div className="mx-auto max-w-2xl">
        <AdminSectionCard
          delayIndex={0}
          title={d.isEdit ? "Update Announcement Marquee" : "Publish Announcement Marquee"}
          subtitle="Configure scrolling platform announcement content in English and Khmer"
          icon={<Megaphone className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div>
              <label className="mb-1.5 block text-xs font-semibold">Announcement Text (English)</label>
              <input type="text" name="text" required defaultValue={v.text} className="ai-input text-xs" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold">Announcement Text (Khmer)</label>
              <input type="text" name="text_kh" defaultValue={v.textKh} className="ai-input text-xs" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Sort Order</label>
                <input
                  type="number"
                  name="sort_order"
                  defaultValue={String(v.sortOrder)}
                  className="ai-input font-mono text-xs"
                />
              </div>
              <label className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-obsidian-950/60">
                <input type="checkbox" name="is_active" defaultChecked={v.isActive} className="rounded" />
                Active banner
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/70 pt-4 dark:border-slate-800/80">
              <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </a>
              <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
                <Save className="h-3.5 w-3.5" /> {d.isEdit ? "Update" : "Publish"}
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
