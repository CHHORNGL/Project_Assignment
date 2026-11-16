import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Ban,
  Coins,
  Crown,
  Download,
  Lock,
  Mail,
  Search,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import { useToast } from "@/context/ToastContext";
import {
  AdminCollapsePanel,
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  email: string;
  roles: string[];
  primaryRole: string;
  isActive: boolean;
  isPremium: boolean;
  aiCredits: number;
  avatarUrl?: string;
  createdAt?: string | null;
  detailUrl: string;
  toggleStatusAction: string;
  togglePremiumAction: string;
  changeRoleAction: string;
  updateCreditsAction: string;
}

interface AdminUsersData {
  q: string;
  users: UserRow[];
  roles: Array<{ id: number; name: string; routeType: string }>;
  links: {
    usersUrl: string;
    rolesUrl?: string;
    createUserAction: string;
    bulkActionUrl: string;
    exportCsvUrl: string;
    exportJsonUrl: string;
  };
}

type SegmentFilter = "all" | "active" | "suspended" | "pro";

export default function AdminUsersPage({ bootstrap }: { bootstrap: AppBootstrap<AdminUsersData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [newPassword, setNewPassword] = useState("");

  const activeCount = useMemo(() => d.users.filter((u) => u.isActive).length, [d.users]);
  const suspendedCount = d.users.length - activeCount;
  const premiumCount = useMemo(() => d.users.filter((u) => u.isPremium).length, [d.users]);

  const filteredUsers = useMemo(() => {
    return d.users.filter((u) => {
      if (segment === "active" && !u.isActive) return false;
      if (segment === "suspended" && u.isActive) return false;
      if (segment === "pro" && !u.isPremium) return false;
      if (roleFilter !== "all" && !u.roles.includes(roleFilter) && u.primaryRole !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [d.users, segment, roleFilter]);

  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.includes(u.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredUsers.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredUsers.map((u) => u.id)])));
    }
  };

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const validateBulk = (scope: "selected" | "all", e: React.FormEvent<HTMLFormElement>) => {
    if (!bulkAction) {
      e.preventDefault();
      pushToast(
        "warning",
        isKhmer ? "សូមជ្រើសរើសសកម្មភាពជាមុនសិន។" : "Select a bulk action first.",
      );
      return;
    }
    if (scope === "selected" && selectedIds.length === 0) {
      e.preventDefault();
      pushToast(
        "warning",
        isKhmer ? "សូមជ្រើសរើសគណនីយ៉ាងតិច ១។" : "Select at least one user account.",
      );
    }
  };

  const segmentTabs: Array<{ key: SegmentFilter; label: string; count: number }> = [
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All", count: d.users.length },
    { key: "active", label: isKhmer ? "សកម្ម" : "Active", count: activeCount },
    { key: "suspended", label: isKhmer ? "ផ្អាក" : "Suspended", count: suspendedCount },
    { key: "pro", label: "PRO", count: premiumCount },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.links.rolesUrl && (
            <a href={d.links.rolesUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <Shield className="h-3.5 w-3.5" />
              <span>{isKhmer ? "តួនាទី និងសិទ្ធិ" : "Roles & Permissions"}</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs"
          >
            {showCreate ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            <span>
              {showCreate
                ? isKhmer
                  ? "បិទ"
                  : "Close"
                : isKhmer
                  ? "បង្កើតគណនីថ្មី"
                  : "Create User"}
            </span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top User Directory KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "គណនីសរុប" : "Visible Accounts"}
            value={d.users.length.toLocaleString()}
            hint={d.q ? `${isKhmer ? "ស្វែងរក៖" : "Matching"} "${d.q}"` : isKhmer ? "សមាជិកប្រព័ន្ធទាំងអស់" : "Registered platform members"}
            tone="indigo"
            icon={<Users className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "កំពុងសកម្ម" : "Active Users"}
            value={activeCount.toLocaleString()}
            hint={`${d.users.length ? Math.round((activeCount / d.users.length) * 100) : 0}% ${isKhmer ? "សកម្ម" : "enabled"}`}
            tone="emerald"
            icon={<UserCheck className="h-5 w-5" />}
            progress={d.users.length ? Math.round((activeCount / d.users.length) * 100) : 0}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "សមាជិក Pro" : "Pro Plan Members"}
            value={premiumCount.toLocaleString()}
            hint={isKhmer ? "មានសិទ្ធិប្រើប្រាស់ AI ឥតកំណត់" : "Active Pro tier accounts"}
            tone="amber"
            icon={<Crown className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "បានផ្អាក" : "Suspended"}
            value={suspendedCount.toLocaleString()}
            hint={isKhmer ? "គណនីត្រូវបានរឹតបន្តឹងការចូល" : "Restricted sign-in access"}
            tone={suspendedCount > 0 ? "rose" : "slate"}
            icon={<ShieldAlert className="h-5 w-5" />}
          />
        </div>

        {/* Collapsible Account Provisioning Panel */}
        <AdminCollapsePanel open={showCreate}>
          <AdminSectionCard
            title={isKhmer ? "បង្កើតគណនីថ្មី" : "Provision New Account"}
            subtitle={
              isKhmer
                ? "បន្ថែមអ្នកប្រើប្រាស់ កំណត់ពាក្យសម្ងាត់ និងតួនាទីដំបូង"
                : "Create credentials and assign the initial workspace role"
            }
            icon={<UserPlus className="h-4 w-4" />}
          >
            <form method="POST" action={d.links.createUserAction} className="space-y-4">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ឈ្មោះអ្នកប្រើប្រាស់ *" : "Username *"}
                  </label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                    <input
                      type="text"
                      name="username"
                      required
                      placeholder="sokha_farmer"
                      className="ai-input pl-9 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ពាក្យសម្ងាត់ *" : "Initial Password *"}
                  </label>
                  <PasswordInput
                    name="password"
                    required
                    showStrength
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={isKhmer ? "យ៉ាងតិច ៦ តួអក្សរ" : "Min 6 characters"}
                    className="py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "តួនាទី *" : "Role *"}
                  </label>
                  <select name="role" required className="ai-input text-xs">
                    {d.roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ឈ្មោះពេញ" : "Full Name"}
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                    <input
                      type="text"
                      name="full_name"
                      placeholder={isKhmer ? "ឈ្មោះពេញ (ជាជម្រើស)" : "Optional display name"}
                      className="ai-input pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "អ៊ីមែល (ជាជម្រើស)" : "Email Address (Optional)"}
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                    <input
                      type="email"
                      name="email"
                      placeholder="member@agrisystem.org"
                      className="ai-input pl-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                <p className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer
                    ? "គណនីថ្មីនឹងសកម្មភ្លាមៗបន្ទាប់ពីបង្កើត។"
                    : "New accounts are enabled immediately with role permissions."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="ai-btn-secondary h-9 px-3.5 text-xs"
                  >
                    {isKhmer ? "បោះបង់" : "Cancel"}
                  </button>
                  <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "បង្កើតគណនី" : "Save User"}</span>
                  </button>
                </div>
              </div>
            </form>
          </AdminSectionCard>
        </AdminCollapsePanel>

        {/* Directory Search, Role Filters, Bulk Bar & User Table */}
        <AdminSectionCard
          delayIndex={3}
          noPadding
          title={isKhmer ? "បញ្ជីអ្នកប្រើប្រាស់" : "Member Directory"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filteredUsers.length} នៃ ${d.users.length} គណនី`
              : `Showing ${filteredUsers.length} of ${d.users.length} loaded accounts`
          }
          icon={<Users className="h-4 w-4" />}
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <a href={d.links.exportCsvUrl} className="ai-btn-secondary h-8 gap-1.5 px-2.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </a>
              <a href={d.links.exportJsonUrl} className="ai-btn-secondary h-8 gap-1.5 px-2.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                <span>JSON</span>
              </a>
            </div>
          }
        >
          {/* Filter & Search Toolbar */}
          <div className="space-y-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Server Search */}
              <form method="GET" action={d.links.usersUrl} className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={d.q}
                    placeholder={
                      isKhmer ? "ស្វែងរកឈ្មោះ @username ឬអ៊ីមែល..." : "Search username, email, or name..."
                    }
                    className="ai-input h-9 py-1 pl-9 text-xs"
                  />
                </div>
                <button type="submit" className="ai-btn-primary h-9 px-3.5 text-xs">
                  {isKhmer ? "ស្វែងរក" : "Search"}
                </button>
                {d.q && (
                  <a href={d.links.usersUrl} className="ai-btn-secondary h-9 gap-1 px-3 text-xs">
                    <X className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "សម្អាត" : "Clear"}</span>
                  </a>
                )}
              </form>

              {/* Status Tabs & Role Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                  {segmentTabs.map((tab) => {
                    const active = segment === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSegment(tab.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                          active
                            ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                            : "text-[#525b75] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#eff2f6]",
                        )}
                      >
                        <span>{tab.label}</span>
                        <span className="font-mono text-[10px] opacity-80">{tab.count}</span>
                      </button>
                    );
                  })}
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                  className="ai-input h-9 w-full py-1 text-xs sm:w-36"
                >
                  <option value="all">{isKhmer ? "គ្រប់តួនាទី" : "All Roles"}</option>
                  {d.roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contextual Bulk Action Bar (appears when rows selected or user picks bulk) */}
            {selectedIds.length > 0 && (
              <div className="animate-slide-down flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#adc5ff] bg-[#e5edff]/70 px-3.5 py-2.5 dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#004dff] dark:text-[#85a9ff]">
                  <span>
                    {selectedIds.length}{" "}
                    {isKhmer ? "គណនីត្រូវបានជ្រើសរើស" : "account(s) selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="rounded px-1.5 py-0.5 text-[11px] underline hover:no-underline"
                  >
                    {isKhmer ? "បោះបង់ការជ្រើសរើស" : "Clear"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    className="ai-input h-8 w-40 py-0.5 text-xs"
                  >
                    <option value="">{isKhmer ? "ជ្រើសរើសសកម្មភាព..." : "Bulk action..."}</option>
                    <option value="ban">{isKhmer ? "ផ្អាកគណនី (Ban)" : "Ban Selected"}</option>
                    <option value="unban">{isKhmer ? "បើកគណនីឡើងវិញ" : "Unban Selected"}</option>
                    <option value="export_csv">Export CSV</option>
                    <option value="export_json">Export JSON</option>
                  </select>
                  <form
                    method="POST"
                    action={d.links.bulkActionUrl}
                    onSubmit={(e) => validateBulk("selected", e)}
                  >
                    <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                    <input type="hidden" name="action" value={bulkAction} />
                    <input type="hidden" name="scope" value="selected" />
                    <input type="hidden" name="q" value={d.q} />
                    {selectedIds.map((id) => (
                      <input key={id} type="hidden" name="user_ids" value={String(id)} />
                    ))}
                    <button type="submit" className="ai-btn-primary h-8 px-3 text-xs">
                      {isKhmer ? "អនុវត្ត" : "Apply"} ({selectedIds.length})
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Users Table */}
          {filteredUsers.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Users className="h-5 w-5" />}
                title={isKhmer ? "មិនមានអ្នកប្រើប្រាស់ត្រូវនឹងការត្រងទេ" : "No users match this filter"}
                description={
                  isKhmer
                    ? "សាកល្បងសម្អាតពាក្យស្វែងរក ឬបង្កើតគណនីថ្មី។"
                    : "Try clearing your search or switching status/role filters."
                }
                action={
                  segment !== "all" || roleFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSegment("all");
                        setRoleFilter("all");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញទាំងអស់" : "Reset Filters"}
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Mobile Member Cards */}
              <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245] sm:hidden">
                {filteredUsers.map((u) => {
                  const initial = (u.fullName || u.username || "U").slice(0, 1).toUpperCase();
                  const isProtectedAdmin =
                    u.roles.includes("admin") || u.primaryRole === "admin";
                  return (
                    <div key={u.id} className="space-y-3 p-4 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleOne(u.id)}
                            aria-label={`Select ${u.username}`}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#3874ff]"
                          />
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName || u.username}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                              className="h-9 w-9 shrink-0 rounded-xl border border-[#cbd0dd] object-cover dark:border-[#373e53]"
                            />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e5edff] font-display text-xs font-extrabold text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                              {initial}
                            </span>
                          )}
                          <div className="min-w-0">
                            <a
                              href={u.detailUrl}
                              className="block truncate font-semibold text-[#141824] hover:text-[#3874ff] dark:text-[#eff2f6]"
                            >
                              {u.fullName || u.username}
                            </a>
                            <p className="truncate font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                              @{u.username}
                            </p>
                          </div>
                        </div>
                        <AdminStatusBadge
                          tone={u.isActive ? "emerald" : "rose"}
                          pulse={u.isActive}
                        >
                          {u.isActive
                            ? isKhmer
                              ? "សកម្ម"
                              : "Active"
                            : isKhmer
                              ? "បានផ្អាក"
                              : "Suspended"}
                        </AdminStatusBadge>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        <span className="min-w-0 break-all">
                          {u.email || (isKhmer ? "គ្មានអ៊ីមែល" : "No email")}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.isPremium && <AdminStatusBadge tone="amber">PRO</AdminStatusBadge>}
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#e3e6ed] bg-[#f5f7fa] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#cbd0dd]">
                            <Coins className="h-3 w-3 text-[#3874ff]" />
                            {u.aiCredits.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <form
                          method="POST"
                          action={u.changeRoleAction}
                          className="min-w-0 flex-1"
                        >
                          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                          <select
                            name="role"
                            defaultValue={u.primaryRole}
                            onChange={(e) => e.currentTarget.form?.submit()}
                            aria-label={`Change role for ${u.username}`}
                            className="ai-input h-8 w-full py-0.5 text-xs capitalize"
                          >
                            {d.roles.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </form>
                        {isProtectedAdmin ? (
                          <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#e3e6ed] bg-[#f5f7fa] px-2.5 text-[11px] font-semibold text-[#8a94ad] dark:border-[#2b3245] dark:bg-[#0f111a]">
                            <Lock className="h-3 w-3" />
                            <span>{isKhmer ? "ការពារ" : "Protected"}</span>
                          </span>
                        ) : (
                          <form method="POST" action={u.toggleStatusAction}>
                            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                            <button
                              type="submit"
                              className={cn(
                                "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                                u.isActive
                                  ? "border-[#cbd0dd] bg-white text-[#b81800] hover:border-[#f48270] hover:bg-[#ffe0db]/60 dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
                                  : "border-[#90d67f] bg-[#d9fbd0]/70 text-[#1c6c09] hover:bg-[#d9fbd0] dark:border-[#25b003]/40 dark:bg-[#25b003]/20 dark:text-[#90ee7a]",
                              )}
                            >
                              <Ban className="h-3 w-3" />
                              <span>
                                {u.isActive
                                  ? isKhmer
                                    ? "ផ្អាក"
                                    : "Ban"
                                  : isKhmer
                                    ? "បើកវិញ"
                                    : "Unban"}
                              </span>
                            </button>
                          </form>
                        )}
                        <a href={u.detailUrl} className="ai-btn-primary h-8 gap-1 px-3 text-xs">
                          <span>{isKhmer ? "គ្រប់គ្រង" : "Manage"}</span>
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Member Table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="w-10 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible accounts"
                        className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                      />
                    </th>
                    <th className="px-4 py-3">{isKhmer ? "អ្នកប្រើប្រាស់" : "Member"}</th>
                    <th className="px-4 py-3">{isKhmer ? "តួនាទី" : "Role"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                    <th className="px-4 py-3">{isKhmer ? "គម្រោង និងក្រេឌីត" : "Plan & Quota"}</th>
                    <th className="hidden px-4 py-3 xl:table-cell">
                      {isKhmer ? "បានចូលរួម" : "Joined"}
                    </th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filteredUsers.map((u) => {
                    const initial = (u.fullName || u.username || "U").slice(0, 1).toUpperCase();
                    const isProtectedAdmin =
                      u.roles.includes("admin") || u.primaryRole === "admin";
                    return (
                      <tr key={u.id} className="ai-table-row">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleOne(u.id)}
                            aria-label={`Select ${u.username}`}
                            className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.fullName || u.username}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                                className="h-9 w-9 shrink-0 rounded-xl border border-[#cbd0dd] object-cover dark:border-[#373e53]"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e5edff] font-display text-xs font-extrabold text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                                {initial}
                              </span>
                            )}
                            <div className="min-w-0">
                              <a
                                href={u.detailUrl}
                                className="font-semibold text-[#141824] transition-colors hover:text-[#3874ff] dark:text-[#eff2f6] dark:hover:text-[#85a9ff]"
                              >
                                {u.fullName || u.username}
                              </a>
                              <div className="truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                                <span className="font-mono">@{u.username}</span>
                                {" · "}
                                {u.email || (isKhmer ? "គ្មានអ៊ីមែល" : "No email")}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <form
                            method="POST"
                            action={u.changeRoleAction}
                            className="inline-flex items-center"
                          >
                            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                            <select
                              name="role"
                              defaultValue={u.primaryRole}
                              onChange={(e) => e.currentTarget.form?.submit()}
                              aria-label={`Change role for ${u.username}`}
                              className="ai-input h-8 w-auto min-w-[8rem] py-0.5 text-xs capitalize"
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
                          <AdminStatusBadge
                            tone={u.isActive ? "emerald" : "rose"}
                            pulse={u.isActive}
                          >
                            {u.isActive
                              ? isKhmer
                                ? "សកម្ម"
                                : "Active"
                              : isKhmer
                                ? "បានផ្អាក"
                                : "Suspended"}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.isPremium && <AdminStatusBadge tone="amber">PRO</AdminStatusBadge>}
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#e3e6ed] bg-[#f5f7fa] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#cbd0dd]">
                              <Coins className="h-3 w-3 text-[#3874ff]" />
                              {u.aiCredits.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td
                          className="hidden whitespace-nowrap px-4 py-3.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad] xl:table-cell"
                          title={u.createdAt || undefined}
                        >
                          {formatAccountTimestamp(u.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {isProtectedAdmin ? (
                              <span
                                title={
                                  isKhmer
                                    ? "គណនីអ្នកគ្រប់គ្រងត្រូវបានការពារ"
                                    : "Admin account status is protected"
                                }
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e3e6ed] bg-[#f5f7fa] px-2.5 text-[11px] font-semibold text-[#8a94ad] dark:border-[#2b3245] dark:bg-[#0f111a]"
                              >
                                <Lock className="h-3 w-3" />
                                <span>{isKhmer ? "ការពារ" : "Protected"}</span>
                              </span>
                            ) : (
                              <form method="POST" action={u.toggleStatusAction}>
                                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                                <button
                                  type="submit"
                                  className={cn(
                                    "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                                    u.isActive
                                      ? "border-[#cbd0dd] bg-white text-[#b81800] hover:border-[#f48270] hover:bg-[#ffe0db]/60 dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
                                      : "border-[#90d67f] bg-[#d9fbd0]/70 text-[#1c6c09] hover:bg-[#d9fbd0] dark:border-[#25b003]/40 dark:bg-[#25b003]/20 dark:text-[#90ee7a]",
                                  )}
                                >
                                  <Ban className="h-3 w-3" />
                                  <span>
                                    {u.isActive
                                      ? isKhmer
                                        ? "ផ្អាក"
                                        : "Ban"
                                      : isKhmer
                                        ? "បើកវិញ"
                                        : "Unban"}
                                  </span>
                                </button>
                              </form>
                            )}

                            <a href={u.detailUrl} className="ai-btn-primary h-8 gap-1 px-3 text-xs">
                              <span>{isKhmer ? "គ្រប់គ្រង" : "Manage"}</span>
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
