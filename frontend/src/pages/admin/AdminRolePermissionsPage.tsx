import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CheckSquare,
  KeyRound,
  LayoutDashboard,
  Lock,
  MessageSquare,
  RotateCcw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sprout,
  Users,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminNoticeBanner,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface PermissionItem {
  id: number;
  code: string;
  description: string;
}

interface SiblingRole {
  id: number;
  name: string;
  routeType: string;
  isCore: boolean;
  permissionsCount: number;
  permissionsUrl: string;
}

interface RolePermissionsData {
  formAction: string;
  backUrl: string;
  usersUrl?: string;
  role: {
    id: number;
    name: string;
    routeType?: string;
    isCore?: boolean;
    userCount?: number;
  };
  siblingRoles?: SiblingRole[];
  totalPermissions?: number;
  lockedCodes?: string[];
  assignedPermissionIds: number[];
  groups: Array<{
    group: string;
    permissions: PermissionItem[];
  }>;
}

type StatusFilter = "all" | "enabled" | "disabled";

function formatCodeTitle(code: string): string {
  return code
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workspaceTone(routeType?: string): AdminTone {
  switch ((routeType || "").toLowerCase()) {
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

function workspaceLabel(routeType: string | undefined, isKhmer: boolean): string {
  switch ((routeType || "").toLowerCase()) {
    case "admin":
      return isKhmer ? "ប្រព័ន្ធគ្រប់គ្រង" : "Admin Portal";
    case "expert":
      return isKhmer ? "ផ្នែកអ្នកជំនាញ" : "Expert Portal";
    case "farmer":
      return isKhmer ? "ផ្នែកកសិករ" : "Farmer Portal";
    default:
      return routeType || "Portal";
  }
}

function groupIcon(groupName: string): React.ReactNode {
  const g = groupName.toLowerCase();
  if (g.includes("dashboard")) return <LayoutDashboard className="h-3.5 w-3.5" />;
  if (g.includes("user")) return <Users className="h-3.5 w-3.5" />;
  if (g.includes("role") || g.includes("access")) return <Shield className="h-3.5 w-3.5" />;
  if (g.includes("crop") || g.includes("agriculture") || g.includes("disease"))
    return <Sprout className="h-3.5 w-3.5" />;
  if (g.includes("diagnos")) return <Activity className="h-3.5 w-3.5" />;
  if (g.includes("chat") || g.includes("comm")) return <MessageSquare className="h-3.5 w-3.5" />;
  if (g.includes("report") || g.includes("analytic")) return <BarChart3 className="h-3.5 w-3.5" />;
  if (g.includes("setting") || g.includes("system")) return <Settings className="h-3.5 w-3.5" />;
  return <KeyRound className="h-3.5 w-3.5" />;
}

interface CapabilityMeta {
  scope: string;
  tierLabel: string;
  tierTone: AdminTone;
}

const KNOWN_CAPABILITIES: Record<string, { en: string; km: string; tier: "admin" | "write" | "read" | "chat" }> = {
  view_dashboard: {
    en: "Access administrative overview metrics, health signals, and activity feeds.",
    km: "ចូលមើលទិន្នន័យសង្ខេប សុខភាពប្រព័ន្ធ និងកំណត់ហេតុសកម្មភាព។",
    tier: "admin",
  },
  manage_users: {
    en: "Create accounts, inspect member profiles, adjust quotas, and suspend access.",
    km: "បង្កើតគណនី មើលព័ត៌មានសមាជិក កែក្រេឌីត AI និងផ្អាកការចូលប្រើ។",
    tier: "admin",
  },
  manage_roles: {
    en: "Author custom RBAC roles and modify permission policies across portals.",
    km: "បង្កើតតួនាទីផ្ទាល់ខ្លួន និងកែប្រែគោលការណ៍សិទ្ធិប្រើប្រាស់។",
    tier: "admin",
  },
  manage_crops: {
    en: "Create, edit, and maintain crop reference catalogs and agronomic metadata.",
    km: "បន្ថែម កែសម្រួល និងគ្រប់គ្រងបញ្ជីដំណាំក្នុងប្រព័ន្ធ។",
    tier: "write",
  },
  manage_diseases: {
    en: "Maintain disease diagnostic rules, symptoms, and treatment recommendations.",
    km: "គ្រប់គ្រងព័ត៌មានជំងឺរុក្ខជាតិ រោគសញ្ញា និងវិធីព្យាបាល។",
    tier: "write",
  },
  submit_diagnosis: {
    en: "Submit crop photos and symptom assessments for automated or expert diagnosis.",
    km: "ដាក់ស្នើរូបភាពដំណាំ និងរោគសញ្ញាដើម្បីធ្វើរោគវិនិច្ឆ័យ។",
    tier: "write",
  },
  view_own_diagnosis: {
    en: "Inspect personal diagnosis history, confidence results, and treatment plans.",
    km: "មើលប្រវត្តិរោគវិនិច្ឆ័យផ្ទាល់ខ្លួន និងលទ្ធផលណែនាំ។",
    tier: "read",
  },
  review_diagnosis: {
    en: "Review pending farmer diagnoses, validate predictions, and publish clinical guidance.",
    km: "ពិនិត្យ និងផ្ទៀងផ្ទាត់ករណីរោគវិនិច្ឆ័យពីកសិករ។",
    tier: "write",
  },
  chat_expert: {
    en: "Open support requests and exchange real-time messages with agricultural experts.",
    km: "បើកសំណើជំនួយ និងសន្ទនាផ្ទាល់ជាមួយអ្នកជំនាញកសិកម្ម។",
    tier: "chat",
  },
  reply_chat: {
    en: "Respond to live farmer consultations and resolve assigned support tickets.",
    km: "ឆ្លើយតបការសន្ទនាជំនួយផ្ទាល់ និងដោះស្រាយសំណើកសិករ។",
    tier: "chat",
  },
  view_reports: {
    en: "Access aggregated operational statistics, case trends, and diagnostic reports.",
    km: "ចូលមើលរបាយការណ៍ស្ថិតិប្រតិបត្តិការ និងនិន្នាការករណី។",
    tier: "read",
  },
};

function describeCapability(code: string, isKhmer: boolean): CapabilityMeta {
  const normalized = code.toLowerCase();
  const known = KNOWN_CAPABILITIES[normalized];
  let tier: "admin" | "write" | "read" | "chat" = known?.tier || "read";

  if (!known) {
    if (normalized.includes("role") || normalized.includes("admin") || normalized.includes("setting")) {
      tier = "admin";
    } else if (
      normalized.startsWith("manage") ||
      normalized.startsWith("create") ||
      normalized.startsWith("edit") ||
      normalized.startsWith("delete") ||
      normalized.startsWith("review") ||
      normalized.startsWith("submit")
    ) {
      tier = "write";
    } else if (normalized.includes("chat") || normalized.includes("reply")) {
      tier = "chat";
    }
  }

  const tierMap: Record<typeof tier, { label: string; km: string; tone: AdminTone }> = {
    admin: { label: "Privileged", km: "សិទ្ធិខ្ពស់", tone: "indigo" },
    write: { label: "Write", km: "កែប្រែ", tone: "amber" },
    chat: { label: "Messaging", km: "សន្ទនា", tone: "sky" },
    read: { label: "Read", km: "អាន", tone: "emerald" },
  };

  const scope = known
    ? isKhmer
      ? known.km
      : known.en
    : isKhmer
      ? `អនុញ្ញាតឱ្យតួនាទីនេះប្រើប្រាស់មុខងារ "${formatCodeTitle(code)}"។`
      : `Authorizes members with this role to perform "${formatCodeTitle(code)}" operations.`;

  return {
    scope,
    tierLabel: isKhmer ? tierMap[tier].km : tierMap[tier].label,
    tierTone: tierMap[tier].tone,
  };
}

export default function AdminRolePermissionsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<RolePermissionsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const lockedCodeSet = useMemo(
    () => new Set((d.lockedCodes || []).map((c) => c.toLowerCase())),
    [d.lockedCodes],
  );

  const permissionById = useMemo(() => {
    const map = new Map<number, PermissionItem>();
    for (const grp of d.groups) {
      for (const perm of grp.permissions) {
        map.set(perm.id, perm);
      }
    }
    return map;
  }, [d.groups]);

  const lockedPermissionIds = useMemo(() => {
    const ids = new Set<number>();
    for (const [id, perm] of permissionById.entries()) {
      if (lockedCodeSet.has(perm.code.toLowerCase())) {
        ids.add(id);
      }
    }
    return ids;
  }, [permissionById, lockedCodeSet]);

  const initialSelected = useMemo(
    () => Array.from(new Set([...(d.assignedPermissionIds || []), ...lockedPermissionIds])),
    [d.assignedPermissionIds, lockedPermissionIds],
  );

  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pendingSwitchRole, setPendingSwitchRole] = useState<SiblingRole | null>(null);

  useEffect(() => {
    if (!pendingSwitchRole) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingSwitchRole(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingSwitchRole]);

  const submittedPermissionIds = useMemo(
    () => Array.from(new Set([...selected, ...lockedPermissionIds])),
    [selected, lockedPermissionIds],
  );

  const totalPermissionsCount = useMemo(
    () => d.totalPermissions ?? permissionById.size,
    [d.totalPermissions, permissionById.size],
  );

  const initialSet = useMemo(() => new Set(initialSelected), [initialSelected]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const diffStats = useMemo(() => {
    const added: PermissionItem[] = [];
    const removed: PermissionItem[] = [];
    for (const id of selectedSet) {
      if (!initialSet.has(id)) {
        const item = permissionById.get(id);
        if (item) added.push(item);
      }
    }
    for (const id of initialSet) {
      if (!selectedSet.has(id)) {
        const item = permissionById.get(id);
        if (item) removed.push(item);
      }
    }
    return {
      added,
      removed,
      changed: added.length > 0 || removed.length > 0,
    };
  }, [initialSet, selectedSet, permissionById]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return d.groups
      .map((grp) => {
        const groupMatchesQuery = q.length > 0 && grp.group.toLowerCase().includes(q);
        const matchingPerms = grp.permissions.filter((perm) => {
          const isChecked = lockedPermissionIds.has(perm.id) || selectedSet.has(perm.id);
          if (statusFilter === "enabled" && !isChecked) return false;
          if (statusFilter === "disabled" && isChecked) return false;
          if (!q || groupMatchesQuery) return true;
          const cap = describeCapability(perm.code, isKhmer);
          return (
            perm.code.toLowerCase().includes(q) ||
            perm.description.toLowerCase().includes(q) ||
            cap.scope.toLowerCase().includes(q)
          );
        });
        return { ...grp, permissions: matchingPerms };
      })
      .filter((grp) => grp.permissions.length > 0);
  }, [d.groups, search, statusFilter, lockedPermissionIds, selectedSet, isKhmer]);

  const toggle = (id: number) => {
    if (lockedPermissionIds.has(id)) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const setGroupState = (ids: number[], enable: boolean) => {
    const editableIds = ids.filter((id) => !lockedPermissionIds.has(id));
    if (editableIds.length === 0) return;
    if (enable) {
      setSelected((prev) => Array.from(new Set([...prev, ...editableIds])));
    } else {
      setSelected((prev) => prev.filter((id) => !editableIds.includes(id)));
    }
  };

  const allEditableIds = useMemo(
    () =>
      Array.from(permissionById.keys()).filter((id) => !lockedPermissionIds.has(id)),
    [permissionById, lockedPermissionIds],
  );

  const visiblePermissionIds = useMemo(
    () => filteredGroups.flatMap((g) => g.permissions.map((p) => p.id)),
    [filteredGroups],
  );

  const allVisibleEditableChecked = useMemo(() => {
    const editable = visiblePermissionIds.filter((id) => !lockedPermissionIds.has(id));
    return editable.length > 0 && editable.every((id) => selectedSet.has(id));
  }, [visiblePermissionIds, lockedPermissionIds, selectedSet]);

  const disabledCount = Math.max(0, totalPermissionsCount - selected.length);
  const coveragePct =
    totalPermissionsCount > 0
      ? Math.round((selected.length / totalPermissionsCount) * 100)
      : 0;

  const roleTone = workspaceTone(d.role.routeType);
  const siblingRoles = d.siblingRoles || [];

  const statusTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All", count: totalPermissionsCount },
    { key: "enabled", label: isKhmer ? "បានបើក" : "Granted", count: selected.length },
    { key: "disabled", label: isKhmer ? "បិទ" : "Restricted", count: disabledCount },
  ];

  const handleSiblingClick = (e: React.MouseEvent<HTMLAnchorElement>, role: SiblingRole) => {
    if (role.id === d.role.id) {
      e.preventDefault();
      return;
    }
    if (diffStats.changed) {
      e.preventDefault();
      setPendingSwitchRole(role);
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isKhmer ? "បញ្ជីតួនាទី" : "All Roles"}</span>
          </a>
          <AdminStatusBadge tone={roleTone}>
            {selected.length}/{totalPermissionsCount}{" "}
            {isKhmer ? "សិទ្ធិបានបើក" : "capabilities"}
          </AdminStatusBadge>
        </div>
      }
    >
      <form method="POST" action={d.formAction} className="space-y-6">
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
        {submittedPermissionIds.map((permId) => (
          <input key={permId} type="hidden" name="permissions" value={String(permId)} />
        ))}

        {/* Core Admin Safeguard Notice */}
        {lockedCodeSet.size > 0 && (
          <AdminNoticeBanner
            tone="indigo"
            message={
              isKhmer
                ? `សិទ្ធិស្នូល (${Array.from(lockedCodeSet).join(", ")}) ត្រូវបានចាក់សោការពារដោយស្វ័យប្រវត្តិសម្រាប់តួនាទី admin ដើម្បីធានាសុវត្ថិភាពការចូលប្រព័ន្ធ។`
                : `Required admin safeguards (${Array.from(lockedCodeSet).join(", ")}) remain enforced on save so dashboard and RBAC governance cannot be locked out.`
            }
          />
        )}

        {/* Dual-Column Enterprise Policy Layout */}
        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* Left Sticky Policy Summary & Diff Inspector */}
          <aside className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:col-span-4">
            <AdminSectionCard
              delayIndex={0}
              title={formatCodeTitle(d.role.name)}
              subtitle={d.role.name}
              icon={<Shield className="h-4 w-4" />}
              action={
                <AdminStatusBadge tone={roleTone}>
                  {workspaceLabel(d.role.routeType, isKhmer)}
                </AdminStatusBadge>
              }
            >
              <div className="space-y-4">
                {/* Role Stats Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3.5 py-2.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "ចំណាត់ថ្នាក់" : "Policy Type"}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#141824] dark:text-[#eff2f6]">
                      {d.role.isCore ? (
                        <>
                          <Lock className="h-3.5 w-3.5 text-[#3874ff]" />
                          <span>{isKhmer ? "តួនាទីស្នូល" : "System Core"}</span>
                        </>
                      ) : (
                        <>
                          <Shield className="h-3.5 w-3.5 text-[#e5780b]" />
                          <span>{isKhmer ? "តួនាទីបន្ថែម" : "Custom Role"}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3.5 py-2.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "សមាជិកប្រើប្រាស់" : "Assigned Users"}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                        {(d.role.userCount ?? 0).toLocaleString()}
                      </span>
                      {d.usersUrl && (
                        <a
                          href={d.usersUrl}
                          className="text-[11px] font-semibold text-[#3874ff] hover:underline dark:text-[#85a9ff]"
                        >
                          {isKhmer ? "មើល" : "View"}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Coverage Meter */}
                <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/60 p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/70">
                  <AdminProgressBar
                    value={selected.length}
                    max={Math.max(totalPermissionsCount, 1)}
                    tone={roleTone}
                    label={isKhmer ? "វិសាលភាពសិទ្ធិ" : "Access Scope"}
                    valueLabel={`${selected.length}/${totalPermissionsCount} (${coveragePct}%)`}
                  />
                </div>

                {/* Live Pending Diff Inspector */}
                <div className="rounded-xl border border-[#e3e6ed] bg-white p-3.5 dark:border-[#2b3245] dark:bg-[#141824]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "ការផ្លាស់ប្តូរគោលការណ៍" : "Policy Changes"}
                    </span>
                    {diffStats.changed ? (
                      <span className="rounded bg-[#ffefca] px-1.5 py-0.5 text-[10px] font-bold text-[#bc3803] dark:bg-[#e5780b]/20 dark:text-[#ffbd6b]">
                        {diffStats.added.length + diffStats.removed.length}{" "}
                        {isKhmer ? "កំពុងរង់ចាំ" : "pending"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1c6c09] dark:text-[#90ee7a]">
                        <Check className="h-3 w-3" />
                        {isKhmer ? "ស៊ីគ្នា" : "Synced"}
                      </span>
                    )}
                  </div>

                  {!diffStats.changed ? (
                    <p className="mt-2 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer
                        ? "មិនមានការកែប្រែមិនទាន់រក្សាទុកទេ។ បិទ/បើកសិទ្ធិខាងស្តាំដើម្បីកែសម្រួល។"
                        : "No pending edits. Toggle capabilities on the right to preview policy changes."}
                    </p>
                  ) : (
                    <div className="mt-2.5 space-y-2">
                      {diffStats.added.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[#1c6c09] dark:text-[#90ee7a]">
                            + {isKhmer ? "បន្ថែមសិទ្ធិ" : "Granting"} ({diffStats.added.length})
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {diffStats.added.map((p) => (
                              <span
                                key={p.id}
                                className="rounded border border-[#90d67f] bg-[#d9fbd0]/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#90ee7a]"
                              >
                                +{p.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {diffStats.removed.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[#b81800] dark:text-[#ff9c8c]">
                            - {isKhmer ? "ដកសិទ្ធិ" : "Revoking"} ({diffStats.removed.length})
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {diffStats.removed.map((p) => (
                              <span
                                key={p.id}
                                className="rounded border border-[#f48270] bg-[#ffe0db]/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#b81800] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]"
                              >
                                -{p.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sidebar Action Controls */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="submit"
                    className="ai-btn-primary h-9 flex-1 justify-center gap-1.5 text-xs"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "រក្សាទុកគោលការណ៍" : "Save Policy"}</span>
                  </button>
                  {diffStats.changed && (
                    <button
                      type="button"
                      onClick={() => setSelected(initialSelected)}
                      title={isKhmer ? "បោះបង់ការផ្លាស់ប្តូរ" : "Discard changes"}
                      className="ai-btn-secondary h-9 gap-1 px-3 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "កំណត់ឡើងវិញ" : "Reset"}</span>
                    </button>
                  )}
                </div>
              </div>
            </AdminSectionCard>

            {/* Quick Role Switcher Card */}
            {siblingRoles.length > 1 && (
              <AdminSectionCard
                delayIndex={1}
                noPadding
                title={isKhmer ? "ប្តូរតួនាទីរហ័ស" : "Role Switcher"}
                subtitle={
                  isKhmer
                    ? "កែប្រែគោលការណ៍តួនាទីផ្សេងទៀត"
                    : "Jump between role permission policies"
                }
                icon={<Users className="h-4 w-4" />}
              >
                <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {siblingRoles.map((r) => {
                    const isCurrent = r.id === d.role.id;
                    const tone = workspaceTone(r.routeType);
                    return (
                      <a
                        key={r.id}
                        href={r.permissionsUrl}
                        onClick={(e) => handleSiblingClick(e, r)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-4 py-2.5 text-xs transition-colors",
                          isCurrent
                            ? "bg-[#e5edff]/65 font-semibold text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                            : "text-[#31374a] hover:bg-[#f5f7fa] dark:text-[#cbd0dd] dark:hover:bg-[#0f111a]",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              tone === "indigo" && "bg-[#3874ff]",
                              tone === "sky" && "bg-[#0097eb]",
                              tone === "emerald" && "bg-[#25b003]",
                              tone === "slate" && "bg-[#8a94ad]",
                            )}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-semibold">
                              {formatCodeTitle(r.name)}
                            </div>
                            <div className="truncate font-mono text-[10px] opacity-75">
                              {r.name}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded border border-[#e3e6ed] bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-[#525b75] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#9fa6bc]">
                          {isCurrent ? selected.length : r.permissionsCount}/{totalPermissionsCount}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </AdminSectionCard>
            )}
          </aside>

          {/* Right Column: Unified Access Capabilities Matrix */}
          <div className="min-w-0 lg:col-span-8">
            <AdminSectionCard
              delayIndex={1}
              noPadding
              title={isKhmer ? "តារាងកំណត់សិទ្ធិប្រើប្រាស់" : "Access Capabilities Matrix"}
              subtitle={
                isKhmer
                  ? `បង្ហាញ ${visiblePermissionIds.length} នៃ ${totalPermissionsCount} សិទ្ធិ`
                  : `Showing ${visiblePermissionIds.length} of ${totalPermissionsCount} platform capabilities`
              }
              icon={<KeyRound className="h-4 w-4" />}
              action={
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGroupState(visiblePermissionIds, !allVisibleEditableChecked)}
                    className="ai-btn-secondary h-8 gap-1.5 px-2.5 text-xs"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>
                      {allVisibleEditableChecked
                        ? isKhmer
                          ? "បិទដែលបង្ហាញ"
                          : "Revoke Visible"
                        : isKhmer
                          ? "បើកដែលបង្ហាញ"
                          : "Grant Visible"}
                    </span>
                  </button>
                  {allEditableIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGroupState(
                          allEditableIds,
                          !allEditableIds.every((id) => selectedSet.has(id)),
                        )
                      }
                      className="ai-btn-secondary hidden h-8 gap-1.5 px-2.5 text-xs sm:inline-flex"
                    >
                      <span>
                        {allEditableIds.every((id) => selectedSet.has(id))
                          ? isKhmer
                            ? "បិទសិទ្ធិទូទៅ"
                            : "Clear Optional"
                          : isKhmer
                            ? "ផ្តល់សិទ្ធិពេញលេញ"
                            : "Grant Full Access"}
                      </span>
                    </button>
                  )}
                </div>
              }
            >
              {/* Search & Status Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      isKhmer
                        ? "ស្វែងរកសិទ្ធិ ឬផ្នែក..."
                        : "Filter by capability, code, or domain..."
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

                <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                  {statusTabs.map((tab) => {
                    const active = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatusFilter(tab.key)}
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
              </div>

              {/* Grouped Policy Rows */}
              {filteredGroups.length === 0 ? (
                <div className="p-6">
                  <AdminEmptyState
                    icon={<KeyRound className="h-5 w-5" />}
                    title={
                      isKhmer ? "មិនមានសិទ្ធិត្រូវនឹងការត្រងទេ" : "No capabilities match this filter"
                    }
                    description={
                      isKhmer
                        ? "សាកល្បងសម្អាតពាក្យស្វែងរក ឬប្តូរស្ថានភាពតម្រង។"
                        : "Clear your search query or switch back to all capabilities."
                    }
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("all");
                        }}
                        className="ai-btn-secondary h-8 px-3 text-xs"
                      >
                        {isKhmer ? "បង្ហាញទាំងអស់" : "Reset Filters"}
                      </button>
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filteredGroups.map((grp) => {
                    const ids = grp.permissions.map((p) => p.id);
                    const editableIds = ids.filter((id) => !lockedPermissionIds.has(id));
                    const activeInGroup = ids.filter(
                      (id) => lockedPermissionIds.has(id) || selectedSet.has(id),
                    ).length;
                    const allGroupEditableChecked =
                      editableIds.length > 0 && editableIds.every((id) => selectedSet.has(id));
                    const isFull = activeInGroup === ids.length && ids.length > 0;

                    return (
                      <section key={grp.group}>
                        {/* Domain Band Sub-header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f5f7fa]/85 px-5 py-2.5 dark:bg-[#0f111a]/75">
                          <div className="flex items-center gap-2 text-[#141824] dark:text-[#eff2f6]">
                            <span className="text-[#3874ff] dark:text-[#85a9ff]">
                              {groupIcon(grp.group)}
                            </span>
                            <h3 className="font-display text-xs font-bold uppercase tracking-[0.06em]">
                              {grp.group}
                            </h3>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums",
                                isFull
                                  ? "bg-[#d9fbd0] text-[#1c6c09] dark:bg-[#25b003]/15 dark:text-[#90ee7a]"
                                  : activeInGroup > 0
                                    ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                                    : "bg-[#e3e6ed] text-[#525b75] dark:bg-[#1e2436] dark:text-[#9fa6bc]",
                              )}
                            >
                              {activeInGroup}/{ids.length}
                            </span>

                            {editableIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setGroupState(ids, !allGroupEditableChecked)}
                                className="text-[11px] font-semibold text-[#3874ff] transition hover:underline dark:text-[#85a9ff]"
                              >
                                {allGroupEditableChecked
                                  ? isKhmer
                                    ? "បិទក្រុម"
                                    : "Clear"
                                  : isKhmer
                                    ? "បើកទាំងអស់"
                                    : "Grant all"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Individual Capability Rows */}
                        <div className="divide-y divide-[#e3e6ed]/70 dark:divide-[#2b3245]/70">
                          {grp.permissions.map((perm) => {
                            const isLocked = lockedPermissionIds.has(perm.id);
                            const checked = isLocked || selectedSet.has(perm.id);
                            const wasInitiallyAssigned = initialSet.has(perm.id);
                            const isAdded = checked && !wasInitiallyAssigned;
                            const isRemoved = !checked && wasInitiallyAssigned;
                            const displayLabel =
                              perm.description && perm.description !== perm.code
                                ? perm.description
                                : formatCodeTitle(perm.code);
                            const meta = describeCapability(perm.code, isKhmer);

                            return (
                              <label
                                key={perm.id}
                                className={cn(
                                  "group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors",
                                  isLocked ? "cursor-not-allowed" : "cursor-pointer",
                                  checked
                                    ? "bg-[#e5edff]/20 hover:bg-[#e5edff]/35 dark:bg-[#3874ff]/[0.04] dark:hover:bg-[#3874ff]/[0.08]"
                                    : "hover:bg-[#f5f7fa]/80 dark:hover:bg-[#0f111a]/60",
                                )}
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[13px] font-semibold text-[#141824] dark:text-[#eff2f6]">
                                      {displayLabel}
                                    </span>

                                    <AdminStatusBadge tone={meta.tierTone}>
                                      {meta.tierLabel}
                                    </AdminStatusBadge>

                                    {isLocked && (
                                      <span className="inline-flex items-center gap-1 rounded border border-[#adc5ff] bg-[#e5edff] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                                        <Lock className="h-2.5 w-2.5" />
                                        {isKhmer ? "ចាំបាច់" : "Required"}
                                      </span>
                                    )}

                                    {isAdded && (
                                      <span className="rounded bg-[#d9fbd0] px-1.5 py-0.5 text-[10px] font-bold text-[#1c6c09] dark:bg-[#25b003]/20 dark:text-[#90ee7a]">
                                        + {isKhmer ? "នឹងបន្ថែម" : "Granting"}
                                      </span>
                                    )}

                                    {isRemoved && (
                                      <span className="rounded bg-[#ffe0db] px-1.5 py-0.5 text-[10px] font-bold text-[#b81800] dark:bg-[#fa3b1d]/20 dark:text-[#ff9c8c]">
                                        - {isKhmer ? "នឹងដកចេញ" : "Revoking"}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                                    {meta.scope}
                                  </p>

                                  <div className="font-mono text-[10.5px] text-[#8a94ad]">
                                    {perm.code}
                                  </div>
                                </div>

                                {/* Accessible Switch Control backed by form checkbox */}
                                <div className="flex shrink-0 items-center gap-2.5">
                                  <span
                                    className={cn(
                                      "hidden w-14 text-right text-[11px] font-semibold sm:inline",
                                      checked
                                        ? "text-[#004dff] dark:text-[#85a9ff]"
                                        : "text-[#8a94ad]",
                                    )}
                                  >
                                    {isLocked
                                      ? isKhmer
                                        ? "ចាក់សោ"
                                        : "Locked"
                                      : checked
                                        ? isKhmer
                                          ? "អនុញ្ញាត"
                                          : "Granted"
                                        : isKhmer
                                          ? "បិទ"
                                          : "Off"}
                                  </span>

                                  <span className="relative inline-flex shrink-0 items-center">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggle(perm.id)}
                                      aria-label={displayLabel}
                                      className="peer sr-only"
                                    />
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#3874ff]/45",
                                        checked
                                          ? isLocked
                                            ? "bg-[#3874ff]/65"
                                            : "bg-[#3874ff]"
                                          : "bg-[#cbd0dd] dark:bg-[#373e53]",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-150",
                                          checked ? "translate-x-4" : "translate-x-0",
                                        )}
                                      />
                                    </span>
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {/* Policy Card Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] bg-[#f5f7fa]/70 px-5 py-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/70">
                <div className="flex items-center gap-3">
                  <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "ត្រឡប់ក្រោយ" : "Back to Roles"}</span>
                  </a>
                  <span className="hidden text-[11px] text-[#6e7891] dark:text-[#8a94ad] sm:inline">
                    {isKhmer
                      ? "ការផ្លាស់ប្តូរនឹងត្រូវកត់ត្រាក្នុងកំណត់ហេតុប្រព័ន្ធ។"
                      : "Policy changes take effect immediately and are audit-logged."}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {diffStats.changed && (
                    <button
                      type="button"
                      onClick={() => setSelected(initialSelected)}
                      className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "បោះបង់" : "Reset"}</span>
                    </button>
                  )}
                  <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "រក្សាទុកសិទ្ធិ" : "Save Permissions"}</span>
                  </button>
                </div>
              </div>
            </AdminSectionCard>
          </div>
        </div>
      </form>

      {/* Unsaved Changes Guard Modal when switching sibling roles */}
      {pendingSwitchRole && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-role-warning-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingSwitchRole(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-xl dark:border-[#2b3245] dark:bg-[#141824] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffefca] text-[#bc3803] ring-1 ring-[#e5780b]/25 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="switch-role-warning-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "មានការកែប្រែមិនទាន់រក្សាទុក" : "Unsaved Policy Changes"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      អ្នកមានការផ្លាស់ប្តូរចំនួន{" "}
                      <strong>{diffStats.added.length + diffStats.removed.length}</strong>{" "}
                      សម្រាប់តួនាទី{" "}
                      <span className="font-mono font-semibold">{d.role.name}</span>។
                      ប្តូរទៅតួនាទី{" "}
                      <span className="font-mono font-semibold">{pendingSwitchRole.name}</span>{" "}
                      ដោយមិនរក្សាទុកឬ?
                    </>
                  ) : (
                    <>
                      You have{" "}
                      <strong>{diffStats.added.length + diffStats.removed.length}</strong>{" "}
                      unsaved change(s) on{" "}
                      <span className="font-mono font-semibold">{d.role.name}</span>.
                      Switch to{" "}
                      <span className="font-mono font-semibold">{pendingSwitchRole.name}</span>{" "}
                      without saving?
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setPendingSwitchRole(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "នៅទំព័រនេះបន្ត" : "Stay & Review"}
              </button>
              <a
                href={pendingSwitchRole.permissionsUrl}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#e5780b] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#c86606]"
              >
                {isKhmer ? "បោះបង់ និងប្តូរតួនាទី" : "Discard & Switch"}
              </a>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
