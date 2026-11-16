import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminCollapsePanel,
  AdminEmptyState,
  AdminKpiCard,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface RoleRow {
  id: number;
  name: string;
  routeType: string;
  isCore: boolean;
  userCount: number;
  permissionsCount: number;
  permissionsPreview?: string[];
  permissionsUrl: string;
  deleteAction: string;
}

interface RolesData {
  createRoleAction: string;
  usersUrl?: string;
  totalPermissions?: number;
  roles: RoleRow[];
}

type ClassificationFilter = "all" | "core" | "custom";
type ViewMode = "cards" | "table";

function normalizeRoleSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function formatRoleTitle(name: string): string {
  return name
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workspaceTone(routeType: string): AdminTone {
  switch (routeType.toLowerCase()) {
    case "admin":
      return "indigo";
    case "expert":
      return "sky";
    case "farmer":
      return "emerald";
    default:
      return "slate";
  }
}

function workspaceLabel(routeType: string, isKhmer: boolean): string {
  switch (routeType.toLowerCase()) {
    case "admin":
      return isKhmer ? "ប្រព័ន្ធគ្រប់គ្រង" : "Admin Portal";
    case "expert":
      return isKhmer ? "ផ្នែកអ្នកជំនាញ" : "Expert Portal";
    case "farmer":
      return isKhmer ? "ផ្នែកកសិករ" : "Farmer Portal";
    default:
      return routeType;
  }
}

export default function AdminRolesPage({ bootstrap }: { bootstrap: AppBootstrap<RolesData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [showCreate, setShowCreate] = useState(false);
  const [roleNameInput, setRoleNameInput] = useState("");
  const [selectedRouteType, setSelectedRouteType] = useState("farmer");
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState<ClassificationFilter>("all");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingDelete(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDelete]);

  const normalizedSlug = useMemo(() => normalizeRoleSlug(roleNameInput), [roleNameInput]);

  const coreCount = useMemo(() => d.roles.filter((r) => r.isCore).length, [d.roles]);
  const customCount = d.roles.length - coreCount;
  const totalUsers = useMemo(
    () => d.roles.reduce((acc, r) => acc + (r.userCount || 0), 0),
    [d.roles],
  );
  const totalPermissions = useMemo(() => {
    const maxAssigned = d.roles.reduce((m, r) => Math.max(m, r.permissionsCount || 0), 0);
    return Math.max(d.totalPermissions ?? 0, maxAssigned);
  }, [d.roles, d.totalPermissions]);
  const avgPermissions = useMemo(() => {
    if (!d.roles.length) return 0;
    const sum = d.roles.reduce((acc, r) => acc + (r.permissionsCount || 0), 0);
    return Math.round(sum / d.roles.length);
  }, [d.roles]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return d.roles.filter((role) => {
      if (classification === "core" && !role.isCore) return false;
      if (classification === "custom" && role.isCore) return false;
      if (workspaceFilter !== "all" && role.routeType.toLowerCase() !== workspaceFilter) {
        return false;
      }
      if (!q) return true;
      const previewMatch = (role.permissionsPreview || []).some((code) =>
        code.toLowerCase().includes(q),
      );
      return (
        role.name.toLowerCase().includes(q) ||
        formatRoleTitle(role.name).toLowerCase().includes(q) ||
        role.routeType.toLowerCase().includes(q) ||
        previewMatch
      );
    });
  }, [d.roles, search, classification, workspaceFilter]);

  const filterTabs: Array<{ key: ClassificationFilter; label: string; count: number }> = [
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All Roles", count: d.roles.length },
    { key: "core", label: isKhmer ? "តួនាទីស្នូល" : "Core", count: coreCount },
    { key: "custom", label: isKhmer ? "តួនាទីបន្ថែម" : "Custom", count: customCount },
  ];

  const hasActiveFilters =
    search.trim().length > 0 || classification !== "all" || workspaceFilter !== "all";

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.usersUrl && (
            <a href={d.usersUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <Users className="h-3.5 w-3.5" />
              <span>{isKhmer ? "គ្រប់គ្រងអ្នកប្រើ" : "Manage Users"}</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs"
          >
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>
              {showCreate
                ? isKhmer
                  ? "បិទ"
                  : "Close"
                : isKhmer
                  ? "បង្កើតតួនាទីថ្មី"
                  : "Create Role"}
            </span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top RBAC Overview Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "តួនាទីសរុប" : "Configured Roles"}
            value={d.roles.length.toLocaleString()}
            hint={
              isKhmer
                ? `${coreCount} ស្នូល · ${customCount} បន្ថែម`
                : `${coreCount} system core · ${customCount} custom`
            }
            tone="indigo"
            icon={<Shield className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "សមាជិកបានចាត់តាំង" : "Assigned Members"}
            value={totalUsers.toLocaleString()}
            hint={isKhmer ? "ការភ្ជាប់គណនីទៅកាន់តួនាទី" : "Active role-to-member mappings"}
            tone="emerald"
            icon={<Users className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "កាតាឡុកសិទ្ធិ" : "Permission Catalog"}
            value={totalPermissions.toLocaleString()}
            hint={
              isKhmer
                ? `មធ្យម ${avgPermissions} សិទ្ធិ/តួនាទី`
                : `Avg ${avgPermissions} permissions per role`
            }
            tone="sky"
            icon={<KeyRound className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "តួនាទីបន្ថែម" : "Custom Roles"}
            value={customCount.toLocaleString()}
            hint={
              isKhmer
                ? "គោលការណ៍សិទ្ធិបង្កើតដោយអ្នកគ្រប់គ្រង"
                : "Tailored non-core access policies"
            }
            tone={customCount > 0 ? "amber" : "slate"}
            icon={<Layers className="h-5 w-5" />}
          />
        </div>

        {/* Collapsible Create Custom Role Panel */}
        <AdminCollapsePanel open={showCreate}>
          <AdminSectionCard
            title={isKhmer ? "បង្កើតតួនាទី RBAC ថ្មី" : "Create Custom Role"}
            subtitle={
              isKhmer
                ? "កំណត់ឈ្មោះតួនាទី និងចម្លងសិទ្ធិមូលដ្ឋានពីតួនាទីស្នូល"
                : "Define an access identifier and inherit starter permissions from a core workspace"
            }
            icon={<Shield className="h-4 w-4" />}
          >
            <form method="POST" action={d.createRoleAction} className="space-y-4">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

              <div className="grid gap-4 md:grid-cols-12">
                <div className="min-w-0 md:col-span-7">
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ឈ្មោះសម្គាល់តួនាទី *" : "Role Identifier *"}
                  </label>
                  <input
                    type="text"
                    name="role_name"
                    required
                    maxLength={50}
                    value={roleNameInput}
                    onChange={(e) => setRoleNameInput(e.target.value)}
                    placeholder="e.g. field_agronomist"
                    className="ai-input font-mono text-xs"
                  />
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    <span>
                      {isKhmer
                        ? "ប្រើអក្សរឡាតាំងតូច លេខ និង _ (អតិបរមា ៥០ តួ)"
                        : "Lowercase alphanumeric and underscores only (max 50 chars)."}
                    </span>
                    {roleNameInput.trim().length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded border border-[#adc5ff] bg-[#e5edff] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                        {isKhmer ? "លទ្ធផល៖" : "Saved as:"} {normalizedSlug || "—"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-w-0 md:col-span-5">
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ប្រព័ន្ធការងារមូលដ្ឋាន *" : "Base Workspace Portal *"}
                  </label>
                  <select
                    name="route_type"
                    value={selectedRouteType}
                    onChange={(e) => setSelectedRouteType(e.target.value)}
                    className="ai-input text-xs"
                  >
                    <option value="farmer">
                      {isKhmer ? "Farmer Workspace (កសិករ)" : "Farmer Workspace"}
                    </option>
                    <option value="expert">
                      {isKhmer ? "Expert Workspace (អ្នកជំនាញ)" : "Expert Workspace"}
                    </option>
                    <option value="admin">
                      {isKhmer ? "Admin Workspace (អ្នកគ្រប់គ្រង)" : "Admin Workspace"}
                    </option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer
                      ? `សិទ្ធិដំបូងនឹងត្រូវចម្លងពីតួនាទី "${selectedRouteType}" ដោយស្វ័យប្រវត្តិ។`
                      : `Starter permissions are automatically cloned from the core "${selectedRouteType}" role.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                <span className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer
                    ? "អ្នកអាចកែប្រែសិទ្ធិលម្អិតបានភ្លាមៗបន្ទាប់ពីបង្កើត។"
                    : "Fine-grained permissions can be customized right after creation."}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="ai-btn-secondary h-9 px-3.5 text-xs"
                  >
                    {isKhmer ? "បោះបង់" : "Cancel"}
                  </button>
                  <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "បង្កើតតួនាទី" : "Create Role"}</span>
                  </button>
                </div>
              </div>
            </form>
          </AdminSectionCard>
        </AdminCollapsePanel>

        {/* Role Directory & Permission Matrix Container */}
        <AdminSectionCard
          delayIndex={2}
          noPadding
          title={isKhmer ? "បញ្ជីតួនាទី និងសិទ្ធិ" : "Role Directory"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filteredRoles.length} នៃ ${d.roles.length} តួនាទី`
              : `Showing ${filteredRoles.length} of ${d.roles.length} access roles`
          }
          icon={<Shield className="h-4 w-4" />}
          action={
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 dark:border-[#373e53] dark:bg-[#0f111a]">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Card view"
                title={isKhmer ? "ទម្រង់កាត" : "Card view"}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  viewMode === "cards"
                    ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                    : "text-[#6e7891] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-[#eff2f6]",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isKhmer ? "កាត" : "Cards"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Table view"
                title={isKhmer ? "ទម្រង់តារាង" : "Table view"}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  viewMode === "table"
                    ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                    : "text-[#6e7891] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-[#eff2f6]",
                )}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isKhmer ? "តារាង" : "Table"}</span>
              </button>
            </div>
          }
        >
          {/* Filter & Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isKhmer
                    ? "ស្វែងរកឈ្មោះតួនាទី ឬកូដសិទ្ធិ..."
                    : "Filter roles by name or permission..."
                }
                className="ai-input h-9 py-1 pl-9 pr-8 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                {filterTabs.map((tab) => {
                  const active = classification === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setClassification(tab.key)}
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
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                aria-label="Filter by workspace"
                className="ai-input h-9 w-full py-1 text-xs sm:w-44"
              >
                <option value="all">{isKhmer ? "គ្រប់ប្រព័ន្ធ" : "All Workspaces"}</option>
                <option value="admin">{isKhmer ? "Admin Portal" : "Admin Portal"}</option>
                <option value="expert">{isKhmer ? "Expert Portal" : "Expert Portal"}</option>
                <option value="farmer">{isKhmer ? "Farmer Portal" : "Farmer Portal"}</option>
              </select>
            </div>
          </div>

          {/* Role Content Area */}
          {filteredRoles.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Shield className="h-5 w-5" />}
                title={isKhmer ? "រកមិនឃើញតួនាទីទេ" : "No roles match your filters"}
                description={
                  isKhmer
                    ? "សាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬបង្កើតតួនាទីថ្មី។"
                    : "Try adjusting your search query or workspace filter."
                }
                action={
                  hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setClassification("all");
                        setWorkspaceFilter("all");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញទាំងអស់" : "Reset Filters"}
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredRoles.map((role, idx) => {
                const tone = workspaceTone(role.routeType);
                const preview = role.permissionsPreview || [];
                const extraPerms = Math.max(0, role.permissionsCount - preview.length);
                const coveragePct =
                  totalPermissions > 0
                    ? Math.round((role.permissionsCount / totalPermissions) * 100)
                    : 0;
                const canDelete = !role.isCore && role.userCount === 0;

                return (
                  <article
                    key={role.id}
                    style={{ ["--stagger" as string]: idx }}
                    className="ai-card-hover ai-stagger flex flex-col justify-between rounded-xl border border-[#e3e6ed] bg-white p-5 dark:border-[#2b3245] dark:bg-[#141824]"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                              tone === "indigo" &&
                                "bg-[#e5edff] text-[#004dff] ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff] dark:ring-[#3874ff]/30",
                              tone === "sky" &&
                                "bg-[#dcf4ff] text-[#005585] ring-[#0097eb]/25 dark:bg-[#0097eb]/15 dark:text-[#6fd0ff] dark:ring-[#0097eb]/30",
                              tone === "emerald" &&
                                "bg-[#d9fbd0] text-[#1c6c09] ring-[#25b003]/20 dark:bg-[#25b003]/15 dark:text-[#7ee864] dark:ring-[#25b003]/30",
                              tone === "slate" &&
                                "bg-[#eff2f6] text-[#525b75] ring-[#cbd0dd] dark:bg-[#1e2436] dark:text-[#9fa6bc] dark:ring-[#373e53]",
                            )}
                          >
                            {role.isCore ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate font-display text-[15px] font-bold tracking-tight text-[#141824] dark:text-[#eff2f6]">
                              {formatRoleTitle(role.name)}
                            </h3>
                            <p className="truncate font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                              {role.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <AdminStatusBadge tone={tone}>
                            {workspaceLabel(role.routeType, isKhmer)}
                          </AdminStatusBadge>
                          {role.isCore && (
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                              <Lock className="h-2.5 w-2.5" />
                              {isKhmer ? "ស្នូលប្រព័ន្ធ" : "Core"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metric Tiles */}
                      <div className="mt-4 grid grid-cols-2 gap-2.5">
                        <div className="rounded-lg border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3 py-2 dark:border-[#2b3245] dark:bg-[#0f111a]">
                          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                            {isKhmer ? "សមាជិក" : "Members"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 font-display text-base font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                            <Users className="h-3.5 w-3.5 text-[#3874ff]" />
                            <span>{role.userCount.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3 py-2 dark:border-[#2b3245] dark:bg-[#0f111a]">
                          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                            {isKhmer ? "សិទ្ធិប្រើប្រាស់" : "Permissions"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 font-display text-base font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                            <KeyRound className="h-3.5 w-3.5 text-[#25b003]" />
                            <span>{role.permissionsCount.toLocaleString()}</span>
                            {totalPermissions > 0 && (
                              <span className="text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                                / {totalPermissions}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Permission Coverage Bar */}
                      <div className="mt-3.5">
                        <AdminProgressBar
                          value={role.permissionsCount}
                          max={Math.max(totalPermissions, 1)}
                          tone={tone}
                          height="sm"
                          label={isKhmer ? "វិសាលភាពសិទ្ធិ" : "Access coverage"}
                          valueLabel={`${coveragePct}%`}
                        />
                      </div>

                      {/* Permission Code Preview Chips */}
                      <div className="mt-3.5 flex min-h-[26px] flex-wrap items-center gap-1.5">
                        {preview.length > 0 ? (
                          <>
                            {preview.slice(0, 3).map((code) => (
                              <span
                                key={code}
                                className="rounded border border-[#e3e6ed] bg-[#f5f7fa] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#cbd0dd]"
                              >
                                {code}
                              </span>
                            ))}
                            {(extraPerms > 0 || preview.length > 3) && (
                              <span className="rounded border border-dashed border-[#cbd0dd] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#6e7891] dark:border-[#373e53] dark:text-[#8a94ad]">
                                +{role.permissionsCount - Math.min(preview.length, 3)}{" "}
                                {isKhmer ? "ទៀត" : "more"}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] italic text-[#8a94ad]">
                            {isKhmer ? "មិនទាន់មានសិទ្ធិនៅឡើយទេ" : "No permissions assigned yet"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                      <a
                        href={role.permissionsUrl}
                        className="ai-btn-secondary h-8 flex-1 justify-center gap-1.5 text-xs"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>{isKhmer ? "កំណត់សិទ្ធិ" : "Configure Permissions"}</span>
                        <ArrowRight className="h-3 w-3 opacity-60" />
                      </a>

                      {role.isCore ? (
                        <span
                          title={
                            isKhmer
                              ? "តួនាទីស្នូលប្រព័ន្ធមិនអាចលុបបានទេ"
                              : "Core system roles are protected"
                          }
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e3e6ed] bg-[#f5f7fa] text-[#8a94ad] dark:border-[#2b3245] dark:bg-[#0f111a]"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : canDelete ? (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(role)}
                          title={isKhmer ? "លុបតួនាទី" : "Delete role"}
                          aria-label={`Delete role ${role.name}`}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#f48270]/60 bg-[#ffe0db]/50 text-[#b81800] transition hover:bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/10 dark:text-[#ff9c8c] dark:hover:bg-[#fa3b1d]/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span
                          title={
                            isKhmer
                              ? `ត្រូវដកសមាជិក ${role.userCount} នាក់ចេញជាមុនសិន`
                              : `Unassign ${role.userCount} member(s) before deleting`
                          }
                          className="inline-flex h-8 w-8 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-[#e3e6ed] bg-[#f5f7fa] text-[#cbd0dd] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#525b75]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="px-5 py-3">{isKhmer ? "តួនាទី" : "Role"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ប្រព័ន្ធការងារ" : "Workspace"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ប្រភេទ" : "Type"}</th>
                    <th className="px-4 py-3 text-right">{isKhmer ? "សមាជិក" : "Members"}</th>
                    <th className="px-4 py-3">{isKhmer ? "វិសាលភាពសិទ្ធិ" : "Permissions"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filteredRoles.map((role) => {
                    const tone = workspaceTone(role.routeType);
                    const pct =
                      totalPermissions > 0
                        ? Math.round((role.permissionsCount / totalPermissions) * 100)
                        : 0;
                    const canDelete = !role.isCore && role.userCount === 0;
                    return (
                      <tr key={role.id} className="ai-table-row">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                            {formatRoleTitle(role.name)}
                          </div>
                          <div className="font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                            {role.name}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone={tone}>
                            {workspaceLabel(role.routeType, isKhmer)}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone={role.isCore ? "slate" : "amber"}>
                            {role.isCore
                              ? isKhmer
                                ? "ស្នូល"
                                : "Core"
                              : isKhmer
                                ? "បន្ថែម"
                                : "Custom"}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          {role.userCount.toLocaleString()}
                        </td>
                        <td className="min-w-[190px] px-4 py-3.5">
                          <AdminProgressBar
                            value={role.permissionsCount}
                            max={Math.max(totalPermissions, 1)}
                            tone={tone}
                            height="sm"
                            valueLabel={`${role.permissionsCount}/${totalPermissions} (${pct}%)`}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={role.permissionsUrl}
                              className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>{isKhmer ? "សិទ្ធិ" : "Permissions"}</span>
                            </a>
                            {role.isCore ? (
                              <span
                                title={
                                  isKhmer
                                    ? "តួនាទីស្នូលប្រព័ន្ធមិនអាចលុបបានទេ"
                                    : "Core system roles are protected"
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e6ed] bg-[#f5f7fa] text-[#8a94ad] dark:border-[#2b3245] dark:bg-[#0f111a]"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </span>
                            ) : canDelete ? (
                              <button
                                type="button"
                                onClick={() => setPendingDelete(role)}
                                aria-label={`Delete role ${role.name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#f48270]/60 bg-[#ffe0db]/50 text-[#b81800] transition hover:bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/10 dark:text-[#ff9c8c] dark:hover:bg-[#fa3b1d]/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span
                                title={
                                  isKhmer
                                    ? `ត្រូវដកសមាជិក ${role.userCount} នាក់ចេញជាមុនសិន`
                                    : `Unassign ${role.userCount} member(s) before deleting`
                                }
                                className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border border-[#e3e6ed] bg-[#f5f7fa] text-[#cbd0dd] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#525b75]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </span>
                            )}
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

      {/* Delete Role Confirmation Modal */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-role-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-xl dark:border-[#2b3245] dark:bg-[#141824] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe0db] text-[#b81800] ring-1 ring-[#fa3b1d]/25 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="delete-role-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការលុបតួនាទី" : "Delete Custom Role"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      តើអ្នកប្រាកដជាចង់លុបតួនាទី{" "}
                      <span className="font-mono font-semibold text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.name}
                      </span>{" "}
                      ឬ? សកម្មភាពនេះនឹងត្រូវកត់ត្រាក្នុងកំណត់ហេតុប្រព័ន្ធ។
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete role{" "}
                      <span className="font-mono font-semibold text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.name}
                      </span>
                      ? This permanently removes the role policy and is recorded in the audit log.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <form method="POST" action={pendingDelete.deleteAction}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#fa3b1d] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d92c11]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "លុបតួនាទី" : "Delete Role"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
