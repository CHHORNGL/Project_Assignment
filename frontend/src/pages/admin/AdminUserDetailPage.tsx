import React from "react";
import { ArrowLeft, Coins, Crown, Mail, Shield, ShieldAlert, UserCheck } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface UserDetailData {
  user: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    roles: string[];
    primaryRole: string;
    isActive: boolean;
    isPremium: boolean;
    premiumExpiresAt?: string | null;
    aiCredits: number;
    createdAt?: string | null;
  };
  roles: Array<{ id: number; name: string }>;
  actions: {
    backUrl: string;
    toggleStatusAction: string;
    togglePremiumAction: string;
    addPremiumTimeAction: string;
    updateCreditsAction: string;
    changeRoleAction: string;
    updateEmailAction: string;
  };
}

export default function AdminUserDetailPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<UserDetailData>;
}) {
  const { user, roles, actions } = bootstrap.data;
  const initial = (user.fullName || user.username || "U").slice(0, 1).toUpperCase();

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={actions.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </a>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminKpiCard
            delayIndex={0}
            label="Primary Role"
            value={user.primaryRole || "user"}
            tone="indigo"
            icon={<UserCheck className="h-5 w-5" />}
            hint={`@${user.username}`}
          />
          <AdminKpiCard
            delayIndex={1}
            label="AI Credits Balance"
            value={user.aiCredits.toLocaleString()}
            tone="sky"
            icon={<Coins className="h-5 w-5" />}
            hint="Available scan & chat quota"
          />
          <AdminKpiCard
            delayIndex={2}
            label="Membership Tier"
            value={user.isPremium ? "PRO" : "Standard"}
            tone={user.isPremium ? "amber" : "slate"}
            icon={<Crown className="h-5 w-5" />}
            hint={
              user.premiumExpiresAt
                ? `Expires ${user.premiumExpiresAt.slice(0, 10)}`
                : "No expiration date set"
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminSectionCard
            delayIndex={3}
            title={
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 font-display text-xs font-bold text-indigo-700 ring-1 ring-indigo-500/20 dark:text-indigo-300">
                  {initial}
                </span>
                <span>@{user.username}</span>
              </span>
            }
            subtitle={user.email || "No email set"}
            action={
              <div className="flex items-center gap-2">
                <AdminStatusBadge tone={user.isActive ? "emerald" : "rose"} pulse={user.isActive}>
                  {user.isActive ? "Active" : "Banned"}
                </AdminStatusBadge>
                {user.isPremium && <AdminStatusBadge tone="amber">PRO</AdminStatusBadge>}
              </div>
            }
          >
            <div className="space-y-5">
              <form method="POST" action={actions.updateEmailAction} className="space-y-2">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold">
                  <Mail className="h-3.5 w-3.5 text-indigo-500" /> Email Address
                </label>
                <div className="flex gap-2">
                  <input type="email" name="email" defaultValue={user.email} className="ai-input flex-1 text-xs" />
                  <button type="submit" className="ai-btn-secondary h-10 px-4 text-xs">
                    Save
                  </button>
                </div>
              </form>

              <form method="POST" action={actions.changeRoleAction} className="space-y-2">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-500" /> Role Assignment
                </label>
                <div className="flex gap-2">
                  <select name="role" defaultValue={user.primaryRole} className="ai-input flex-1 text-xs">
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="ai-btn-secondary h-10 px-4 text-xs">
                    Update
                  </button>
                </div>
              </form>

              <form
                method="POST"
                action={actions.toggleStatusAction}
                className="border-t border-slate-200/70 pt-4 dark:border-slate-800/80"
              >
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <button
                  type="submit"
                  className={
                    user.isActive
                      ? "ai-btn-secondary w-full justify-center gap-1.5 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      : "ai-btn-primary w-full justify-center gap-1.5 text-xs"
                  }
                >
                  {user.isActive ? <ShieldAlert className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                  {user.isActive ? "Suspend Account" : "Reactivate Account"}
                </button>
              </form>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={4}
            title="Subscription & AI Quotas"
            subtitle="Adjust inference credit allowances and Pro subscription term"
            icon={<Crown className="h-4 w-4" />}
          >
            <div className="space-y-5">
              <form method="POST" action={actions.updateCreditsAction} className="space-y-2">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold">
                  <Coins className="h-3.5 w-3.5 text-indigo-500" /> AI Credits Balance
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="ai_credits"
                    min="0"
                    defaultValue={String(user.aiCredits)}
                    className="ai-input flex-1 font-mono text-xs"
                  />
                  <button type="submit" className="ai-btn-primary h-10 px-4 text-xs">
                    Update Credits
                  </button>
                </div>
              </form>

              <form method="POST" action={actions.addPremiumTimeAction} className="space-y-2">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold">
                  <Crown className="h-3.5 w-3.5 text-amber-500" /> Extend Pro Membership
                </label>
                <div className="flex gap-2">
                  <input type="number" name="amount" min="1" defaultValue="30" className="ai-input w-24 text-xs" />
                  <select name="unit" defaultValue="days" className="ai-input flex-1 text-xs">
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                  <button type="submit" className="ai-btn-primary h-10 px-4 text-xs">
                    Add Time
                  </button>
                </div>
                {user.premiumExpiresAt && (
                  <p className="text-[11px] text-slate-400">Expires: {user.premiumExpiresAt.slice(0, 10)}</p>
                )}
              </form>

              <form
                method="POST"
                action={actions.togglePremiumAction}
                className="border-t border-slate-200/70 pt-4 dark:border-slate-800/80"
              >
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <button type="submit" className="ai-btn-secondary w-full justify-center gap-1.5 text-xs">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  {user.isPremium ? "Revoke Pro Status" : "Grant Lifetime Pro"}
                </button>
              </form>
            </div>
          </AdminSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
