import React, { useState } from "react";
import { Crown, Download, Search, Shield, UserCheck, UserPlus, Users, X } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import {
  AdminCollapsePanel,
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface AdminUsersData {
  q: string;
  users: Array<{
    id: number;
    username: string;
    fullName: string;
    email: string;
    roles: string[];
    primaryRole: string;
    isActive: boolean;
    isPremium: boolean;
    aiCredits: number;
    createdAt?: string | null;
    detailUrl: string;
    toggleStatusAction: string;
    togglePremiumAction: string;
    changeRoleAction: string;
    updateCreditsAction: string;
  }>;
  roles: Array<{ id: number; name: string; routeType: string }>;
  links: {
    usersUrl: string;
    createUserAction: string;
    bulkActionUrl: string;
    exportCsvUrl: string;
    exportJsonUrl: string;
  };
}

export default function AdminUsersPage({ bootstrap }: { bootstrap: AppBootstrap<AdminUsersData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const allSelected = d.users.length > 0 && d.users.every((u) => selectedIds.includes(u.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : d.users.map((u) => u.id));
  const toggleOne = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const activeCount = d.users.filter((u) => u.isActive).length;
  const premiumCount = d.users.filter((u) => u.isPremium).length;

  const validateBulk = (scope: "selected" | "all", e: React.FormEvent<HTMLFormElement>) => {
    if (!bulkAction) {
      e.preventDefault();
      pushToast("warning", "Select a bulk action first.");
      return;
    }
    if (scope === "selected" && selectedIds.length === 0) {
      e.preventDefault();
      pushToast("warning", "Select at least one user.");
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs"
        >
          {showCreate ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          {showCreate ? (isKhmer ? "បិទ" : "Close") : isKhmer ? "បង្កើតគណនី" : "Create User"}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "គណនីសរុប" : "Visible Accounts"}
            value={d.users.length.toLocaleString()}
            tone="indigo"
            icon={<Users className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "កំពុងសកម្ម" : "Active Users"}
            value={activeCount.toLocaleString()}
            tone="emerald"
            icon={<UserCheck className="h-5 w-5" />}
            progress={d.users.length ? Math.round((activeCount / d.users.length) * 100) : 0}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "សមាជិក Pro" : "Pro Plan Users"}
            value={premiumCount.toLocaleString()}
            tone="amber"
            icon={<Crown className="h-5 w-5" />}
          />
        </div>

        <AdminCollapsePanel open={showCreate}>
          <AdminSectionCard
            title={isKhmer ? "បង្កើតគណនីថ្មី" : "Provision New Account"}
            subtitle={isKhmer ? "បន្ថែមអ្នកប្រើប្រាស់ និងកំណត់តួនាទី" : "Assign credentials and initial workspace role"}
            icon={<UserPlus className="h-4 w-4" />}
          >
            <form method="POST" action={d.links.createUserAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="text" name="username" required placeholder="Username" className="ai-input text-xs" />
              <input type="password" name="password" required placeholder="Password" className="ai-input text-xs" />
              <input type="text" name="full_name" placeholder="Full Name" className="ai-input text-xs" />
              <input type="email" name="email" placeholder="Email (optional)" className="ai-input text-xs" />
              <select name="role" required className="ai-input text-xs">
                {d.roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="ai-btn-primary h-10 text-xs">
                {isKhmer ? "រក្សាទុក" : "Save User"}
              </button>
            </form>
          </AdminSectionCard>
        </AdminCollapsePanel>

        <AdminSectionCard delayIndex={3}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form method="GET" action={d.links.usersUrl} className="flex flex-wrap items-center gap-2">
              <div className="relative w-64 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={d.q}
                  placeholder="Search username, email, name..."
                  className="ai-input h-9 py-1 pl-8 text-xs"
                />
              </div>
              <button type="submit" className="ai-btn-primary h-9 px-3.5 text-xs">
                Search
              </button>
              {d.q && (
                <a href={d.links.usersUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                  Clear
                </a>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="ai-input h-9 w-40 py-1 text-xs"
              >
                <option value="">Bulk action</option>
                <option value="ban">Ban</option>
                <option value="unban">Unban</option>
                <option value="export_csv">Export CSV</option>
                <option value="export_json">Export JSON</option>
              </select>
              <form method="POST" action={d.links.bulkActionUrl} onSubmit={(e) => validateBulk("selected", e)}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value={bulkAction} />
                <input type="hidden" name="scope" value="selected" />
                <input type="hidden" name="q" value={d.q} />
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="user_ids" value={String(id)} />
                ))}
                <button type="submit" className="ai-btn-secondary h-9 px-3 text-xs">
                  Apply ({selectedIds.length})
                </button>
              </form>
              <a href={d.links.exportCsvUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                <Download className="h-3.5 w-3.5" /> CSV
              </a>
              <a href={d.links.exportJsonUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                <Download className="h-3.5 w-3.5" /> JSON
              </a>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={4} noPadding>
          {d.users.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Users className="h-5 w-5" />}
                title="No users match this filter"
                description="Try clearing your search query or create a new user account."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-obsidian-950/60 dark:text-slate-400">
                  <tr>
                    <th className="w-10 px-5 py-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Plan & Tokens</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {d.users.map((u) => {
                    const initial = (u.fullName || u.username || "U").slice(0, 1).toUpperCase();
                    return (
                      <tr key={u.id} className="ai-table-row">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleOne(u.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-blue-500/15 font-display text-xs font-bold text-indigo-700 ring-1 ring-indigo-500/20 dark:text-indigo-300">
                              {initial}
                            </span>
                            <div className="min-w-0">
                              <a
                                href={u.detailUrl}
                                className="font-semibold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                              >
                                {u.fullName || u.username}
                              </a>
                              <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                @{u.username} · {u.email || "No email"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <form method="POST" action={u.changeRoleAction} className="inline-flex items-center">
                            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                            <select
                              name="role"
                              defaultValue={u.primaryRole}
                              onChange={(e) => e.currentTarget.form?.submit()}
                              className="ai-input h-8 w-32 py-0.5 text-xs"
                            >
                              {d.roles.map((r) => (
                                <option key={r.id} value={r.name}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </form>
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone={u.isActive ? "emerald" : "rose"} pulse={u.isActive}>
                            {u.isActive ? "Active" : "Suspended"}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {u.isPremium && (
                              <AdminStatusBadge tone="amber">PRO</AdminStatusBadge>
                            )}
                            <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-obsidian-800 dark:text-slate-200">
                              {u.aiCredits.toLocaleString()} cr
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <form method="POST" action={u.toggleStatusAction}>
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <button type="submit" className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs">
                                <Shield className="h-3 w-3" />
                                {u.isActive ? "Ban" : "Unban"}
                              </button>
                            </form>
                            <a href={u.detailUrl} className="ai-btn-primary h-8 px-3 text-xs">
                              Manage
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
