import React from "react";
import { KeyRound, Lock, Plus, Shield, Trash2, Users } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { AdminSectionCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";

interface RolesData {
  createRoleAction: string;
  roles: Array<{
    id: number;
    name: string;
    routeType: string;
    isCore: boolean;
    userCount: number;
    permissionsCount: number;
    permissionsUrl: string;
    deleteAction: string;
  }>;
}

export default function AdminRolesPage({ bootstrap }: { bootstrap: AppBootstrap<RolesData> }) {
  const d = bootstrap.data;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        <AdminSectionCard
          delayIndex={0}
          title="Create Custom Role"
          subtitle="Define a new RBAC role and choose its base workspace portal"
          icon={<Shield className="h-4 w-4" />}
        >
          <form method="POST" action={d.createRoleAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-xs font-semibold">New Role Identifier</label>
              <input
                type="text"
                name="role_name"
                required
                placeholder="e.g. field_agronomist"
                className="ai-input text-xs"
              />
            </div>
            <div className="w-52">
              <label className="mb-1.5 block text-xs font-semibold">Base Workspace</label>
              <select name="route_type" defaultValue="farmer" className="ai-input text-xs">
                <option value="farmer">Farmer Workspace</option>
                <option value="expert">Expert Workspace</option>
                <option value="admin">Admin Workspace</option>
              </select>
            </div>
            <button type="submit" className="ai-btn-primary h-10 gap-1.5 px-5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Create Role
            </button>
          </form>
        </AdminSectionCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.roles.map((role, idx) => (
            <div
              key={role.id}
              style={{ ["--stagger" as string]: idx + 1 }}
              className="ai-surface ai-card-hover ai-stagger flex flex-col justify-between p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-300">
                      {role.isCore ? <Lock className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    </span>
                    <span className="font-display text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                      {role.name}
                    </span>
                  </div>
                  <AdminStatusBadge tone="indigo">{role.routeType}</AdminStatusBadge>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2.5 py-1 font-medium dark:bg-obsidian-850">
                    <Users className="h-3 w-3 text-indigo-500" />
                    <strong className="tabular-nums text-slate-800 dark:text-slate-100">{role.userCount}</strong> users
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2.5 py-1 font-medium dark:bg-obsidian-850">
                    <KeyRound className="h-3 w-3 text-emerald-500" />
                    <strong className="tabular-nums text-slate-800 dark:text-slate-100">
                      {role.permissionsCount}
                    </strong>{" "}
                    permissions
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3.5 dark:border-slate-800/80">
                <a href={role.permissionsUrl} className="ai-btn-secondary h-8 flex-1 justify-center gap-1.5 text-xs">
                  <KeyRound className="h-3.5 w-3.5" /> Permissions
                </a>
                {!role.isCore && (
                  <form
                    method="POST"
                    action={role.deleteAction}
                    onSubmit={(e) => {
                      if (!window.confirm(`Delete role "${role.name}"?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                    <button
                      type="submit"
                      className="ai-btn-secondary h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}
