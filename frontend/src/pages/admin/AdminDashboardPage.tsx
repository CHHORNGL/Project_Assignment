import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  Bug,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  LocateFixed,
  MapPin,
  MessageSquare,
  Settings,
  Shield,
  ShieldCheck,
  Sprout,
  Users,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import { useToast } from "@/context/ToastContext";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface AdminDashboardData {
  totalUsers: number;
  totalDiagnoses: number;
  pendingDiagnoses: number;
  totalChats: number;
  processedCount: number;
  completionPercent: number;
  processedSummary: string;
  recentLogs: Array<{
    id: number;
    action: string;
    targetUser: string;
    detail: string;
    actorName: string;
    createdAt?: string | null;
  }>;
  map: {
    locationName?: string;
    lat: number;
    lng: number;
    cesiumToken?: string;
  };
  links?: {
    users?: string;
    roles?: string;
    auditLogs?: string;
    expertStats?: string;
    supportRequests?: string;
    supportChats?: string;
    crops?: string;
    diseases?: string;
    worldMap?: string;
    settings?: string;
  };
}

function getAuditBadgeClasses(action: string): string {
  const upper = (action || "").toUpperCase();
  if (/(DELETE|REVOKE|REMOVE|FAIL|BLOCK|DISABLE)/.test(upper)) {
    return "border-[#f48270] bg-[#ffe0db] text-[#b81800] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]";
  }
  if (/(CREATE|ADD|APPROVE|ENABLE|VERIFY|LOGIN|PASSKEY)/.test(upper)) {
    return "border-[#90d67f] bg-[#d9fbd0] text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#90ee7a]";
  }
  if (/(UPDATE|EDIT|SET|CHANGE|RESET)/.test(upper)) {
    return "border-[#ffcc85] bg-[#ffefca] text-[#bc3803] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]";
  }
  return "border-[#adc5ff] bg-[#e5edff] text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]";
}

export default function AdminDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminDashboardData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const mapUi = ui.map || {};
  const table = ui.table || {};
  const links = d.links || {};
  const { pushToast } = useToast();

  const [lat, setLat] = useState(String(d.map.lat || 11.5564));
  const [lng, setLng] = useState(String(d.map.lng || 104.9282));
  const [locating, setLocating] = useState(false);

  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      pushToast(
        "warning",
        isKhmer ? "កម្មវិធីរុករកមិនគាំទ្រទីតាំង GPS ទេ។" : "Browser geolocation is not available.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        setLocating(false);
        pushToast("success", isKhmer ? "បានធ្វើបច្ចុប្បន្នភាពកូអរដោនេ។" : "Coordinates updated.");
      },
      () => {
        setLocating(false);
        pushToast(
          "warning",
          isKhmer ? "មិនអាចទទួលបានទីតាំងបច្ចុប្បន្នទេ។" : "Unable to read current browser location.",
        );
      },
    );
  };

  const quickModules = [
    {
      label: isKhmer ? "អ្នកប្រើប្រាស់" : "Users & Accounts",
      desc: isKhmer ? "គ្រប់គ្រងគណនី និងសិទ្ធិ" : "Accounts & role access",
      href: links.users || "/admin/users",
      icon: Users,
    },
    {
      label: isKhmer ? "តួនាទី និងសិទ្ធិ" : "Roles & Security",
      desc: isKhmer ? "កំណត់គោលការណ៍សិទ្ធិ" : "RBAC permission matrix",
      href: links.roles || "/admin/roles",
      icon: Shield,
    },
    {
      label: isKhmer ? "ស្ថិតិអ្នកជំនាញ" : "Expert Statistics",
      desc: isKhmer ? "ពិនិត្យល្បឿនដំណើរការ" : "Throughput & review SLA",
      href: links.expertStats || "/admin/expert-statistics",
      icon: Award,
    },
    {
      label: isKhmer ? "ដំណាំ" : "Crop Catalog",
      desc: isKhmer ? "ប្រភេទដំណាំក្នុងប្រព័ន្ធ" : "Managed crop taxonomy",
      href: links.crops || "/admin/crops/",
      icon: Sprout,
    },
    {
      label: isKhmer ? "ជំងឺដំណាំ" : "Disease Library",
      desc: isKhmer ? "វិធីព្យាបាល និងរោគសញ្ញា" : "Diagnostics knowledge",
      href: links.diseases || "/admin/diseases",
      icon: Bug,
    },
    {
      label: isKhmer ? "ការកំណត់ប្រព័ន្ធ" : "System Settings",
      desc: isKhmer ? "ទីតាំង និងម៉ូដែល AI" : "Geo config & AI runtime",
      href: links.settings || "/admin/settings",
      icon: Settings,
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
      <div className="space-y-6">
        {/* Top Executive KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={metrics.users || "Total Users"}
            hint={metrics.usersMeta}
            value={d.totalUsers.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
            tone="indigo"
            badge={metrics.usersAccent || "Live"}
            href={links.users}
          />
          <AdminKpiCard
            delayIndex={1}
            label={metrics.diagnoses || "Total Diagnoses"}
            hint={metrics.diagnosesMeta}
            value={d.totalDiagnoses.toLocaleString()}
            icon={<Activity className="h-5 w-5" />}
            tone="sky"
            badge={`${d.completionPercent}%`}
            progress={d.completionPercent}
            href={links.expertStats}
          />
          <AdminKpiCard
            delayIndex={2}
            label={metrics.pending || "Pending Review"}
            hint={metrics.pendingMeta}
            value={d.pendingDiagnoses.toLocaleString()}
            icon={<Clock className="h-5 w-5" />}
            tone="amber"
            badge={metrics.pendingAccent || "Queue"}
            href={links.expertStats}
          />
          <AdminKpiCard
            delayIndex={3}
            label={metrics.chats || "Active Chats"}
            hint={metrics.chatsMeta}
            value={d.totalChats.toLocaleString()}
            icon={<MessageSquare className="h-5 w-5" />}
            tone="emerald"
            badge={metrics.chatsAccent || "Support"}
            href={links.supportChats}
          />
        </div>

        {/* Control Center Main Grid */}
        <div className="grid gap-6 xl:grid-cols-12">
          {/* Left Column: System Health + Location Monitor */}
          <div className="min-w-0 space-y-6 xl:col-span-5">
            <AdminSectionCard
              delayIndex={2}
              title={sections.systemHealth || "System Health"}
              subtitle={sections.processingRate}
              icon={<ShieldCheck className="h-4 w-4" />}
              action={
                <AdminStatusBadge tone="emerald" pulse>
                  {isKhmer ? "ដំណើរការល្អ" : "Operational"}
                </AdminStatusBadge>
              }
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/85 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
                  <AdminProgressBar
                    label={sections.completion || "Completion"}
                    value={d.completionPercent}
                    valueLabel={`${d.completionPercent}%`}
                    tone="indigo"
                  />
                  <p className="mt-2.5 text-xs leading-relaxed text-[#6e7891] dark:text-[#8a94ad]">
                    {d.processedSummary}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-[#e3e6ed] bg-white p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/60">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#25b003]" />
                      <span className="truncate">{isKhmer ? "បានបញ្ចប់" : "Processed"}</span>
                    </div>
                    <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {d.processedCount.toLocaleString()}
                    </p>
                  </div>

                  <a
                    href={links.expertStats || "/admin/expert-statistics"}
                    className="rounded-xl border border-[#e3e6ed] bg-white p-3 transition hover:border-[#e5780b]/45 dark:border-[#2b3245] dark:bg-[#0f111a]/60 dark:hover:border-[#e5780b]/50"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#e5780b]" />
                      <span className="truncate">{isKhmer ? "កំពុងរង់ចាំ" : "Pending"}</span>
                    </div>
                    <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {d.pendingDiagnoses.toLocaleString()}
                    </p>
                  </a>

                  <a
                    href={links.supportChats || "/admin/support_chats"}
                    className="rounded-xl border border-[#e3e6ed] bg-white p-3 transition hover:border-[#3874ff]/45 dark:border-[#2b3245] dark:bg-[#0f111a]/60 dark:hover:border-[#3874ff]/50"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#3874ff]" />
                      <span className="truncate">{isKhmer ? "សារជំនួយ" : "Chats"}</span>
                    </div>
                    <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {d.totalChats.toLocaleString()}
                    </p>
                  </a>
                </div>
              </div>
            </AdminSectionCard>

            <AdminSectionCard
              delayIndex={3}
              title={sections.map || "Location Monitor"}
              subtitle={d.map.locationName || "Phnom Penh, Cambodia"}
              icon={<MapPin className="h-4 w-4" />}
              action={
                <a
                  href={links.worldMap || "/admin/world"}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] px-2.5 py-1 text-xs font-semibold text-[#31374a] transition hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:bg-[#22283a]"
                >
                  <Globe className="h-3.5 w-3.5 text-[#3874ff]" />
                  <span>{isKhmer ? "ផែនទី 3D" : "World Map"}</span>
                </a>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="admin-lat"
                      className="mb-1 block text-[11px] font-semibold text-[#525b75] dark:text-[#9fa6bc]"
                    >
                      {mapUi.lat || "Latitude"}
                    </label>
                    <input
                      id="admin-lat"
                      type="text"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder={mapUi.lat || "Latitude"}
                      className="ai-input py-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-lng"
                      className="mb-1 block text-[11px] font-semibold text-[#525b75] dark:text-[#9fa6bc]"
                    >
                      {mapUi.lng || "Longitude"}
                    </label>
                    <input
                      id="admin-lng"
                      type="text"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder={mapUi.lng || "Longitude"}
                      className="ai-input py-2 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={locating}
                      onClick={handleUseMyLocation}
                      className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs"
                    >
                      <LocateFixed className={`h-3.5 w-3.5 ${locating ? "animate-pulse" : ""}`} />
                      <span>{mapUi.locate || "Use My Location"}</span>
                    </button>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{mapUi.open || "Open in Maps"}</span>
                    </a>
                  </div>

                  <a
                    href={links.settings || "/admin/settings"}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#3874ff] hover:text-[#004dff]"
                    title={isKhmer ? "កំណត់ទីតាំងគោល" : "Configure default coordinates"}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "កែសម្រួល" : "Defaults"}</span>
                  </a>
                </div>
              </div>
            </AdminSectionCard>
          </div>

          {/* Right Column: Recent Audit Events + Quick Directory */}
          <div className="min-w-0 space-y-6 xl:col-span-7">
            <AdminSectionCard
              delayIndex={3}
              noPadding
              title={sections.recentAuditEvents || "Recent Audit Events"}
              subtitle={sections.recentAuditHelp}
              icon={<FileText className="h-4 w-4" />}
              action={
                <a
                  href={links.auditLogs || "/admin/audit-logs"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] px-2.5 py-1 text-xs font-semibold text-[#31374a] transition hover:border-[#3874ff]/45 hover:text-[#004dff] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:text-[#85a9ff]"
                >
                  <span>{isKhmer ? "មើលកំណត់ហេតុទាំងអស់" : "View Audit Logs"}</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              }
            >
              {d.recentLogs.length === 0 ? (
                <div className="p-5">
                  <AdminEmptyState
                    icon={<Activity className="h-5 w-5" />}
                    title={table.emptyTitle || "No recent activity"}
                    description={table.emptyText || "Administrative and governance events will appear here."}
                  />
                </div>
              ) : (
                <>
                  {/* Mobile Audit Event Cards */}
                  <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245] sm:hidden">
                    {d.recentLogs.map((log) => (
                      <div key={log.id} className="min-w-0 space-y-1.5 px-4 py-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex max-w-full items-center break-all rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${getAuditBadgeClasses(
                              log.action,
                            )}`}
                          >
                            {log.action}
                          </span>
                          <span
                            className="font-mono text-[11px] text-[#8a94ad]"
                            title={log.createdAt || undefined}
                          >
                            {formatAccountTimestamp(log.createdAt)}
                          </span>
                        </div>
                        <p className="[overflow-wrap:anywhere] leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                          {log.targetUser ? (
                            <span className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {log.targetUser}
                              {log.detail || log.actorName ? " · " : ""}
                            </span>
                          ) : null}
                          <span>{log.detail || log.actorName || "—"}</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Audit Event Table */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                        <tr>
                          <th className="px-5 py-3">{table.action || "Action"}</th>
                          <th className="px-5 py-3">{table.detail || "Detail"}</th>
                          <th className="px-5 py-3 text-right">{table.time || "Time"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                        {d.recentLogs.map((log) => (
                          <tr key={log.id} className="ai-table-row">
                            <td className="whitespace-nowrap px-5 py-3">
                              <span
                                className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${getAuditBadgeClasses(
                                  log.action,
                                )}`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-[#525b75] dark:text-[#9fa6bc]">
                              <div className="line-clamp-2 leading-relaxed">
                                {log.targetUser ? (
                                  <span className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                                    {log.targetUser}
                                    {log.detail || log.actorName ? " · " : ""}
                                  </span>
                                ) : null}
                                <span>{log.detail || log.actorName || "—"}</span>
                              </div>
                            </td>
                            <td
                              className="whitespace-nowrap px-5 py-3 text-right font-mono text-[11px] text-[#8a94ad]"
                              title={log.createdAt || undefined}
                            >
                              {formatAccountTimestamp(log.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </AdminSectionCard>

            <AdminSectionCard
              delayIndex={4}
              title={isKhmer ? "ម៉ូឌុលគ្រប់គ្រងរហ័ស" : "Control Plane Directory"}
              subtitle={
                isKhmer
                  ? "ចូលប្រើប្រាស់មុខងារគ្រប់គ្រងសំខាន់ៗដោយផ្ទាល់"
                  : "Direct access to governance, catalog, and operational workspaces"
              }
              icon={<Activity className="h-4 w-4" />}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quickModules.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <a
                      key={mod.href}
                      href={mod.href}
                      className="group flex items-center justify-between gap-2.5 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/70 p-3 transition-all duration-150 hover:border-[#3874ff]/45 hover:bg-white dark:border-[#2b3245] dark:bg-[#0f111a]/60 dark:hover:border-[#3874ff]/45 dark:hover:bg-[#181d2b]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#cbd0dd]/80 bg-white text-[#3874ff] transition-colors group-hover:border-[#3874ff]/30 group-hover:bg-[#e5edff] dark:border-[#373e53] dark:bg-[#141824] dark:text-[#85a9ff] dark:group-hover:bg-[#3874ff]/15">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#141824] dark:text-[#eff2f6]">
                            {mod.label}
                          </p>
                          <p className="truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                            {mod.desc}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#8a94ad] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#3874ff]" />
                    </a>
                  );
                })}
              </div>
            </AdminSectionCard>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
