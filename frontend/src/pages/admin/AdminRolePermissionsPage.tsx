import React, { useState } from "react";
import { ArrowLeft, KeyRound, Save } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { AdminSectionCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";

interface RolePermissionsData {
  formAction: string;
  backUrl: string;
  role: { id: number; name: string };
  assignedPermissionIds: number[];
  groups: Array<{
    group: string;
    permissions: Array<{ id: number; code: string; description: string }>;
  }>;
}

export default function AdminRolePermissionsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<RolePermissionsData>;
}) {
  const d = bootstrap.data;
  const [selected, setSelected] = useState<number[]>(d.assignedPermissionIds || []);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleGroup = (ids: number[]) => {
    const allChecked = ids.every((id) => selected.includes(id));
    if (allChecked) {
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <AdminStatusBadge tone="indigo">
          {selected.length} permissions active
        </AdminStatusBadge>
      }
    >
      <form method="POST" action={d.formAction} className="space-y-6">
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

        <div className="grid gap-5 md:grid-cols-2">
          {d.groups.map((grp, idx) => {
            const ids = grp.permissions.map((p) => p.id);
            const activeInGroup = ids.filter((id) => selected.includes(id)).length;
            const allChecked = ids.length > 0 && activeInGroup === ids.length;
            return (
              <AdminSectionCard
                key={grp.group}
                delayIndex={idx}
                title={grp.group}
                icon={<KeyRound className="h-4 w-4" />}
                action={
                  <button
                    type="button"
                    onClick={() => toggleGroup(ids)}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600 dark:bg-obsidian-800 dark:text-slate-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300"
                  >
                    {allChecked ? "Clear Group" : `Select All (${activeInGroup}/${ids.length})`}
                  </button>
                }
              >
                <div className="space-y-2">
                  {grp.permissions.map((perm) => {
                    const checked = selected.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 text-xs transition-all duration-150 ${
                          checked
                            ? "border-indigo-300/70 bg-indigo-50/50 dark:border-indigo-500/35 dark:bg-indigo-500/10"
                            : "border-transparent hover:border-slate-200/80 hover:bg-slate-50/80 dark:hover:border-slate-800 dark:hover:bg-obsidian-850"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="permissions"
                          value={String(perm.id)}
                          checked={checked}
                          onChange={() => toggle(perm.id)}
                          className="mt-0.5 rounded"
                        />
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                            {perm.code}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {perm.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </AdminSectionCard>
            );
          })}
        </div>

        <div className="ai-surface flex items-center justify-between px-5 py-3.5">
          <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </a>
          <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
            <Save className="h-3.5 w-3.5" /> Save Permissions
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}
