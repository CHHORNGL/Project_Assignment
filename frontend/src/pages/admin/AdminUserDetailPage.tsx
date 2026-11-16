import React from "react";
import {
  ArrowLeft,
  Calendar,
  Coins,
  Crown,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
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
  const isKhmer = bootstrap.lang === "km";
  const { user, roles, actions } = bootstrap.data;
  const initial = (user.fullName || user.username || "U").slice(0, 1).toUpperCase();
  const isProtectedAdmin = user.roles.includes("admin") || user.primaryRole === "admin";

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={actions.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isKhmer ? "ត្រឡប់ក្រោយ" : "Back to Users"}</span>
        </a>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "តួនាទីចម្បង" : "Primary Role"}
            value={user.primaryRole || "member"}
            tone="indigo"
            icon={<UserCheck className="h-5 w-5" />}
            hint={`@${user.username}`}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "សមតុល្យក្រេឌីត AI" : "AI Credits Balance"}
            value={user.aiCredits.toLocaleString()}
            tone="sky"
            icon={<Coins className="h-5 w-5" />}
            hint={isKhmer ? "កូតាវិភាគ និងសន្ទនា" : "Available scan & chat quota"}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "គម្រោងសមាជិក" : "Membership Tier"}
            value={user.isPremium ? "PRO" : "Standard"}
            tone={user.isPremium ? "amber" : "slate"}
            icon={<Crown className="h-5 w-5" />}
            hint={
              user.premiumExpiresAt
                ? `${isKhmer ? "ផុតកំណត់" : "Expires"} ${user.premiumExpiresAt.slice(0, 10)}`
                : isKhmer
                  ? "គ្មានកាលបរិច្ឆេទផុតកំណត់"
                  : "No expiration date set"
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminSectionCard
            delayIndex={3}
            title={
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e5edff] font-display text-xs font-extrabold text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                  {initial}
                </span>
                <span>@{user.username}</span>
              </span>
            }
            subtitle={user.email || (isKhmer ? "គ្មានអាសយដ្ឋានអ៊ីមែល" : "No email set")}
            action={
              <div className="flex items-center gap-2">
                <AdminStatusBadge tone={user.isActive ? "emerald" : "rose"} pulse={user.isActive}>
                  {user.isActive
                    ? isKhmer
                      ? "សកម្ម"
                      : "Active"
                    : isKhmer
                      ? "បានផ្អាក"
                      : "Suspended"}
                </AdminStatusBadge>
                {user.isPremium && <AdminStatusBadge tone="amber">PRO</AdminStatusBadge>}
              </div>
            }
          >
            <div className="space-y-5">
              {user.createdAt && (
                <div className="flex items-center gap-2 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 px-3.5 py-2.5 text-xs text-[#525b75] dark:border-[#2b3245] dark:bg-[#0f111a]/65 dark:text-[#9fa6bc]">
                  <Calendar className="h-3.5 w-3.5 text-[#3874ff]" />
                  <span>
                    {isKhmer ? "បានចុះឈ្មោះនៅថ្ងៃទី" : "Member since"}{" "}
                    <strong className="text-[#141824] dark:text-[#eff2f6]">
                      {formatAccountTimestamp(user.createdAt)}
                    </strong>
                  </span>
                </div>
              )}

              <form method="POST" action={actions.updateEmailAction} className="space-y-1.5">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  <Mail className="h-3.5 w-3.5 text-[#3874ff]" />
                  <span>{isKhmer ? "អាសយដ្ឋានអ៊ីមែល" : "Email Address"}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    name="email"
                    defaultValue={user.email}
                    className="ai-input flex-1 text-xs"
                  />
                  <button type="submit" className="ai-btn-secondary h-9 px-4 text-xs">
                    {isKhmer ? "រក្សាទុក" : "Save"}
                  </button>
                </div>
              </form>

              <form method="POST" action={actions.changeRoleAction} className="space-y-1.5">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  <UserCheck className="h-3.5 w-3.5 text-[#3874ff]" />
                  <span>{isKhmer ? "ការកំណត់តួនាទី" : "Role Assignment"}</span>
                </label>
                <div className="flex gap-2">
                  <select
                    name="role"
                    defaultValue={user.primaryRole}
                    className="ai-input flex-1 text-xs capitalize"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="ai-btn-secondary h-9 px-4 text-xs">
                    {isKhmer ? "កែប្រែ" : "Update"}
                  </button>
                </div>
              </form>

              <div className="border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                {isProtectedAdmin ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] py-2.5 text-xs font-semibold text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#9fa6bc]">
                    <Lock className="h-3.5 w-3.5" />
                    <span>
                      {isKhmer
                        ? "គណនីអ្នកគ្រប់គ្រងមិនអាចត្រូវបានផ្អាកឡើយ"
                        : "Admin accounts cannot be suspended from this screen"}
                    </span>
                  </div>
                ) : (
                  <form method="POST" action={actions.toggleStatusAction}>
                    <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                    <button
                      type="submit"
                      className={
                        user.isActive
                          ? "flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#f48270] bg-[#ffe0db]/70 text-xs font-semibold text-[#b81800] transition hover:bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#492226] dark:text-[#ff9c8c]"
                          : "ai-btn-primary h-9 w-full justify-center gap-1.5 text-xs"
                      }
                    >
                      {user.isActive ? (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      ) : (
                        <Shield className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {user.isActive
                          ? isKhmer
                            ? "ផ្អាកគណនី"
                            : "Suspend Account"
                          : isKhmer
                            ? "បើកគណនីឡើងវិញ"
                            : "Reactivate Account"}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={4}
            title={isKhmer ? "ការជាវ និងកូតា AI" : "Subscription & AI Quotas"}
            subtitle={
              isKhmer
                ? "កែតម្រូវចំនួនក្រេឌីត AI និងរយៈពេលសមាជិក Pro"
                : "Adjust inference credit allowances and Pro subscription term"
            }
            icon={<Crown className="h-4 w-4" />}
          >
            <div className="space-y-5">
              <form method="POST" action={actions.updateCreditsAction} className="space-y-1.5">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  <Coins className="h-3.5 w-3.5 text-[#3874ff]" />
                  <span>{isKhmer ? "សមតុល្យក្រេឌីត AI" : "AI Credits Balance"}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="ai_credits"
                    min="0"
                    defaultValue={String(user.aiCredits)}
                    className="ai-input flex-1 font-mono text-xs"
                  />
                  <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                    {isKhmer ? "រក្សាទុកក្រេឌីត" : "Update Credits"}
                  </button>
                </div>
              </form>

              <form method="POST" action={actions.addPremiumTimeAction} className="space-y-1.5">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  <Crown className="h-3.5 w-3.5 text-[#e5780b]" />
                  <span>{isKhmer ? "បន្ថែមរយៈពេល Pro" : "Extend Pro Membership"}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="amount"
                    min="1"
                    defaultValue="30"
                    className="ai-input w-24 font-mono text-xs"
                  />
                  <select name="unit" defaultValue="days" className="ai-input flex-1 text-xs">
                    <option value="days">{isKhmer ? "ថ្ងៃ" : "Days"}</option>
                    <option value="months">{isKhmer ? "ខែ" : "Months"}</option>
                    <option value="years">{isKhmer ? "ឆ្នាំ" : "Years"}</option>
                  </select>
                  <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                    {isKhmer ? "បន្ថែម" : "Add Time"}
                  </button>
                </div>
                {user.premiumExpiresAt && (
                  <p className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer ? "ផុតកំណត់៖" : "Expires:"} {user.premiumExpiresAt.slice(0, 10)}
                  </p>
                )}
              </form>

              <form
                method="POST"
                action={actions.togglePremiumAction}
                className="border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]"
              >
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <button type="submit" className="ai-btn-secondary h-9 w-full justify-center gap-1.5 text-xs">
                  <Crown className="h-3.5 w-3.5 text-[#e5780b]" />
                  <span>
                    {user.isPremium
                      ? isKhmer
                        ? "ដកសិទ្ធិ Pro"
                        : "Revoke Pro Status"
                      : isKhmer
                        ? "ផ្តល់សិទ្ធិ Pro អចិន្ត្រៃយ៍"
                        : "Grant Lifetime Pro"}
                  </span>
                </button>
              </form>
            </div>
          </AdminSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
