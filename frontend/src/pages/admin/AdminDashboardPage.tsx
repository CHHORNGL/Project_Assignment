import React, { useState } from "react";
import {
  Activity,
  Clock,
  ExternalLink,
  LocateFixed,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
  PhoenixSummaryStrip,
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
  map: { lat: number; lng: number; cesiumToken?: string };
}

export default function AdminDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminDashboardData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const mapUi = ui.map || {};
  const table = ui.table || {};

  const [lat, setLat] = useState(String(d.map.lat || 11.5564));
  const [lng, setLng] = useState(String(d.map.lng || 104.9282));

  const kpis = [
    {
      label: metrics.users || "Users",
      meta: metrics.usersMeta,
      value: d.totalUsers.toLocaleString(),
      icon: <Users className="h-5 w-5" />,
      tone: "indigo" as const,
    },
    {
      label: metrics.diagnoses || "Diagnoses",
      meta: metrics.diagnosesMeta,
      value: d.totalDiagnoses.toLocaleString(),
      icon: <Activity className="h-5 w-5" />,
      tone: "sky" as const,
      progress: d.completionPercent,
    },
    {
      label: metrics.pending || "Pending",
      meta: metrics.pendingMeta,
      value: d.pendingDiagnoses.toLocaleString(),
      icon: <Clock className="h-5 w-5" />,
      tone: "amber" as const,
    },
    {
      label: metrics.chats || "Active Chats",
      meta: metrics.chatsMeta,
      value: d.totalChats.toLocaleString(),
      icon: <MessageSquare className="h-5 w-5" />,
      tone: "emerald" as const,
    },
  ];

  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        <PhoenixSummaryStrip items={kpis} />

        <div className="grid gap-6 lg:grid-cols-5">
          <AdminSectionCard
            className="lg:col-span-2"
            delayIndex={2}
            title={sections.systemHealth || "System Health"}
            subtitle={sections.processingRate}
            icon={<ShieldCheck className="h-4 w-4" />}
            action={
              <AdminStatusBadge tone="emerald" pulse>
                Operational
              </AdminStatusBadge>
            }
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <AdminProgressBar
                  label={sections.completion || "Completion"}
                  value={d.completionPercent}
                  valueLabel={`${d.completionPercent}%`}
                  tone="indigo"
                />
                <p className="mt-2.5 text-[11px] leading-relaxed text-[#6e7891] dark:text-[#8a94ad]">
                  {d.processedSummary}
                </p>
              </div>

              <div className="space-y-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#141824] dark:text-[#eff2f6]">
                    <MapPin className="h-4 w-4 text-[#3874ff]" />
                    <span>{sections.map || "Location Monitor"}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#8a94ad]">
                    {lat}, {lng}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder={mapUi.lat || "Latitude"}
                    className="ai-input py-2 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder={mapUi.lng || "Longitude"}
                    className="ai-input py-2 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {mapUi.open || "Open in Maps"}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) return;
                      navigator.geolocation.getCurrentPosition((pos) => {
                        setLat(pos.coords.latitude.toFixed(5));
                        setLng(pos.coords.longitude.toFixed(5));
                      });
                    }}
                    className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    {mapUi.locate || "Use My Location"}
                  </button>
                </div>
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            className="lg:col-span-3"
            delayIndex={3}
            noPadding
            title={sections.recentAuditEvents || "Recent Audit Events"}
            subtitle={sections.recentAuditHelp}
            icon={<Activity className="h-4 w-4" />}
          >
            {d.recentLogs.length === 0 ? (
              <div className="p-5">
                <AdminEmptyState
                  icon={<Activity className="h-5 w-5" />}
                  title={table.emptyText || "No recent activity."}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                    <tr>
                      <th className="px-5 py-3 font-bold">{table.action || "Action"}</th>
                      <th className="px-5 py-3 font-bold">{table.detail || "Detail"}</th>
                      <th className="px-5 py-3 font-bold">{table.time || "Time"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.recentLogs.map((log) => (
                      <tr key={log.id} className="ai-table-row">
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center rounded border border-[#adc5ff] bg-[#e5edff] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#525b75] dark:text-[#9fa6bc]">
                          {log.targetUser ? (
                            <span className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {log.targetUser} —{" "}
                            </span>
                          ) : null}
                          {log.detail || log.actorName}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-[#8a94ad]">
                          {log.createdAt ? log.createdAt.slice(0, 16).replace("T", " ") : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
