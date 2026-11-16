import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  Globe,
  Monitor,
  ScrollText,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import {
  classifyAuditAction,
  formatAuditActionLabel,
  parseAuditDetail,
  type AuditCategory,
} from "@/lib/auditLogHelpers";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: number;
  action: string;
  targetUser: string;
  detail: string;
  actorName: string;
  actorEmail?: string;
  createdAt?: string | null;
}

interface AuditLogsData {
  q?: string;
  actionFilter?: string;
  actions?: string[];
  stats?: {
    totalCount: number;
    last24hCount: number;
    failureCount: number;
    uniqueActors: number;
  };
  links?: {
    auditUrl: string;
    exportCsvUrl: string;
    exportJsonUrl: string;
  };
  logs: AuditLogEntry[];
}

export default function AdminAuditLogsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AuditLogsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [query, setQuery] = useState(d.q || "");
  const [category, setCategory] = useState<AuditCategory>("all");
  const [actionFilter, setActionFilter] = useState(d.actionFilter || "");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedLog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedLog(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLog]);

  const enrichedLogs = useMemo(
    () =>
      d.logs.map((log) => ({
        log,
        meta: classifyAuditAction(log.action, log.detail),
        parsed: parseAuditDetail(log.detail),
      })),
    [d.logs],
  );

  const categoryCounts = useMemo(() => {
    const counts = {
      all: enrichedLogs.length,
      alerts: 0,
      auth: 0,
      rbac: 0,
      operations: 0,
    };
    for (const item of enrichedLogs) {
      counts[item.meta.category] += 1;
    }
    return counts;
  }, [enrichedLogs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedLogs.filter(({ log, meta }) => {
      if (category !== "all" && meta.category !== category) return false;
      if (actionFilter && log.action !== actionFilter) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.targetUser.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        String(log.id).includes(q)
      );
    });
  }, [enrichedLogs, category, actionFilter, query]);

  const availableActions = useMemo(() => {
    if (d.actions && d.actions.length > 0) return d.actions;
    return Array.from(new Set(d.logs.map((l) => l.action).filter(Boolean))).sort();
  }, [d.actions, d.logs]);

  const stats = d.stats ?? {
    totalCount: d.logs.length,
    last24hCount: d.logs.length,
    failureCount: categoryCounts.alerts,
    uniqueActors: new Set(
      d.logs.map((l) => l.actorName).filter((name) => name && name !== "System"),
    ).size,
  };

  const links = d.links ?? {
    auditUrl: "/admin/audit-logs",
    exportCsvUrl: "/admin/audit-logs/export?format=csv",
    exportJsonUrl: "/admin/audit-logs/export?format=json",
  };

  const buildExportHref = (baseHref: string, format: "csv" | "json") => {
    const basePath = baseHref.split("?")[0] || "/admin/audit-logs/export";
    const params = new URLSearchParams({ format });
    if (query.trim()) params.set("q", query.trim());
    if (actionFilter) params.set("action", actionFilter);
    return `${basePath}?${params.toString()}`;
  };

  const categoryTabs: Array<{ key: AuditCategory; label: string; count: number }> = [
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All Events", count: categoryCounts.all },
    { key: "alerts", label: isKhmer ? "ការព្រមាន" : "Security Alerts", count: categoryCounts.alerts },
    { key: "auth", label: isKhmer ? "ការចូលប្រើ" : "Auth & Sessions", count: categoryCounts.auth },
    { key: "rbac", label: isKhmer ? "អ្នកប្រើ និងសិទ្ធិ" : "Users & RBAC", count: categoryCounts.rbac },
    { key: "operations", label: isKhmer ? "ប្រតិបត្តិការ" : "Operations", count: categoryCounts.operations },
  ];

  const hasClientFilters =
    query.trim().length > 0 || category !== "all" || actionFilter.length > 0;
  const hasServerFilters = Boolean((d.q || "").trim() || (d.actionFilter || "").trim());

  const handleCopyJson = async (entry: AuditLogEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      setCopiedId(entry.id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === entry.id ? null : prev));
      }, 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts
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
          <a
            href={buildExportHref(links.exportCsvUrl, "csv")}
            className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </a>
          <a
            href={buildExportHref(links.exportJsonUrl, "json")}
            className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Audit Telemetry KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "កំណត់ហេតុសរុប" : "Total Audit Events"}
            value={stats.totalCount.toLocaleString()}
            hint={
              isKhmer
                ? `ផ្ទុក ${d.logs.length} កំណត់ត្រាចុងក្រោយ`
                : `Showing ${d.logs.length.toLocaleString()} latest entries`
            }
            tone="indigo"
            icon={<ScrollText className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "ក្នុងរយៈពេល ២៤ ម៉ោង" : "Events (24h)"}
            value={stats.last24hCount.toLocaleString()}
            hint={isKhmer ? "សកម្មភាពថ្មីៗក្នុង ២៤ ម៉ោង" : "Recorded within rolling 24 hours"}
            tone="sky"
            icon={<Clock className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "ការព្រមានសុវត្ថិភាព" : "Security Alerts"}
            value={stats.failureCount.toLocaleString()}
            hint={
              isKhmer
                ? "ការបរាជ័យការចូល ការផ្អាក និងកំហុស"
                : "Failed logins, bans & session expiries"
            }
            tone={stats.failureCount > 0 ? "rose" : "emerald"}
            icon={<ShieldAlert className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "អ្នកប្រតិបត្តិសកម្ម" : "Unique Actors"}
            value={stats.uniqueActors.toLocaleString()}
            hint={
              isKhmer
                ? `${availableActions.length} ប្រភេទសកម្មភាព`
                : `${availableActions.length} distinct action types`
            }
            tone="emerald"
            icon={<Users className="h-5 w-5" />}
          />
        </div>

        {/* Unified Audit Trail Card */}
        <AdminSectionCard
          delayIndex={2}
          noPadding
          title={isKhmer ? "កំណត់ហេតុសកម្មភាពប្រព័ន្ធ" : "Security & Activity Trail"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filtered.length} នៃ ${d.logs.length} កំណត់ត្រា`
              : `Displaying ${filtered.length.toLocaleString()} of ${d.logs.length.toLocaleString()} loaded records`
          }
          icon={<ScrollText className="h-4 w-4" />}
          action={
            hasServerFilters ? (
              <a href={links.auditUrl} className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs">
                <X className="h-3.5 w-3.5" />
                <span>{isKhmer ? "បង្ហាញបណ្ណសារទាំងអស់" : "Clear Archive Query"}</span>
              </a>
            ) : hasClientFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setActionFilter("");
                }}
                className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សម្អាតតម្រង" : "Clear Filters"}</span>
              </button>
            ) : undefined
          }
        >
          {/* Search, Action Filter & Category Tabs */}
          <div className="space-y-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form
                method="GET"
                action={links.auditUrl}
                className="flex flex-wrap items-center gap-2"
              >
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    name="q"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      isKhmer
                        ? "ស្វែងរកសកម្មភាព អ្នកប្រើ IP ឬព័ត៌មាន..."
                        : "Filter by action, actor, target, IP, or detail..."
                    }
                    className="ai-input h-9 py-1 pl-9 pr-8 text-xs"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  name="action"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  aria-label="Filter by audit action"
                  className="ai-input h-9 w-full py-1 text-xs sm:w-52"
                >
                  <option value="">{isKhmer ? "គ្រប់ប្រភេទសកម្មភាព" : "All Action Types"}</option>
                  {availableActions.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>

                <button type="submit" className="ai-btn-primary h-9 px-3.5 text-xs">
                  {isKhmer ? "ស្វែងរកបណ្ណសារ" : "Search Archive"}
                </button>
              </form>

              {/* Category Tabs */}
              <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                {categoryTabs.map((tab) => {
                  const active = category === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCategory(tab.key)}
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
          </div>

          {/* Audit Table */}
          {filtered.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<ScrollText className="h-5 w-5" />}
                title={isKhmer ? "មិនមានកំណត់ហេតុត្រូវនឹងការត្រងទេ" : "No matching audit entries"}
                description={
                  isKhmer
                    ? "សាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬប្រភេទសកម្មភាព។"
                    : "Try adjusting your search keywords, action filter, or category tab."
                }
                action={
                  hasClientFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCategory("all");
                        setActionFilter("");
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="px-5 py-3">{isKhmer ? "ព្រឹត្តិការណ៍" : "Event"}</th>
                    <th className="px-4 py-3">{isKhmer ? "អ្នកប្រតិបត្តិ" : "Actor"}</th>
                    <th className="px-4 py-3">{isKhmer ? "គោលដៅ" : "Target"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ព័ត៌មានលម្អិត" : "Context"}</th>
                    <th className="whitespace-nowrap px-4 py-3">{isKhmer ? "ពេលវេលា" : "Timestamp"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "ត្រួតពិនិត្យ" : "Inspect"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filtered.map(({ log, meta, parsed }) => {
                    const isSystem = !log.actorName || log.actorName === "System";
                    const actorInitial = (log.actorName || "S").slice(0, 1).toUpperCase();
                    const envLabel = [parsed.browser, parsed.os].filter(Boolean).join(" · ");

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="ai-table-row cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <AdminStatusBadge tone={meta.tone}>
                              {log.action}
                            </AdminStatusBadge>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                              <span className="font-mono">#{log.id}</span>
                              <span>·</span>
                              <span>{isKhmer ? meta.categoryKm : meta.categoryEn}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ring-1",
                                isSystem
                                  ? "bg-[#eff2f6] text-[#525b75] ring-[#cbd0dd] dark:bg-[#1e2436] dark:text-[#9fa6bc] dark:ring-[#373e53]"
                                  : "bg-[#e5edff] text-[#004dff] ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]",
                              )}
                            >
                              {actorInitial}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                                {log.actorName}
                              </div>
                              {log.actorEmail && (
                                <div className="truncate text-[10.5px] text-[#6e7891] dark:text-[#8a94ad]">
                                  {log.actorEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {log.targetUser ? (
                            <span className="inline-flex items-center rounded-md border border-[#e3e6ed] bg-[#f5f7fa] px-2 py-0.5 font-mono text-[11px] font-medium text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#cbd0dd]">
                              {log.targetUser}
                            </span>
                          ) : (
                            <span className="text-[#8a94ad]">—</span>
                          )}
                        </td>

                        <td className="max-w-md px-4 py-3.5">
                          <div className="space-y-1">
                            {parsed.summary ? (
                              <p className="line-clamp-2 text-xs text-[#31374a] dark:text-[#cbd0dd]">
                                {parsed.summary}
                              </p>
                            ) : parsed.fields.length === 0 ? (
                              <span className="text-[#8a94ad]">—</span>
                            ) : (
                              <p className="text-xs text-[#525b75] dark:text-[#9fa6bc]">
                                {formatAuditActionLabel(log.action)}
                              </p>
                            )}

                            {(parsed.ip || envLabel || parsed.status) && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {parsed.ip && (
                                  <span className="inline-flex items-center gap-1 rounded border border-[#e3e6ed] bg-[#f5f7fa] px-1.5 py-0.5 font-mono text-[10px] text-[#525b75] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#9fa6bc]">
                                    <Globe className="h-2.5 w-2.5 text-[#3874ff]" />
                                    {parsed.ip}
                                  </span>
                                )}
                                {envLabel && (
                                  <span className="inline-flex items-center gap-1 rounded border border-[#e3e6ed] bg-[#f5f7fa] px-1.5 py-0.5 text-[10px] text-[#525b75] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#9fa6bc]">
                                    <Monitor className="h-2.5 w-2.5 text-[#0097eb]" />
                                    {envLabel}
                                  </span>
                                )}
                                {parsed.status && (
                                  <span className="rounded bg-[#ffe0db] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#b81800] dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]">
                                    {parsed.status}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td
                          className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]"
                          title={log.createdAt || undefined}
                        >
                          {formatAccountTimestamp(log.createdAt)}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            aria-label={`Inspect audit event #${log.id}`}
                            className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{isKhmer ? "មើល" : "Inspect"}</span>
                          </button>
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

      {/* Audit Event Inspector Modal */}
      {selectedLog && (() => {
        const meta = classifyAuditAction(selectedLog.action, selectedLog.detail);
        const parsed = parseAuditDetail(selectedLog.detail);
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-inspector-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            onClick={() => setSelectedLog(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e3e6ed] bg-white shadow-2xl dark:border-[#2b3245] dark:bg-[#141824]"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/80 px-6 py-4 dark:border-[#2b3245] dark:bg-[#0f111a]/80">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge tone={meta.tone}>{selectedLog.action}</AdminStatusBadge>
                    <span className="font-mono text-xs font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      #{selectedLog.id}
                    </span>
                  </div>
                  <h3
                    id="audit-inspector-title"
                    className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                  >
                    {formatAuditActionLabel(selectedLog.action)}
                  </h3>
                  <p className="font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {selectedLog.createdAt || "—"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  aria-label="Close inspector"
                  className="rounded-lg p-1.5 text-[#6e7891] transition hover:bg-[#e3e6ed] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6 text-xs">
                {/* Identity Summary Grid */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/70 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "អ្នកប្រតិបត្តិ" : "Actor"}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 font-semibold text-[#141824] dark:text-[#eff2f6]">
                      <UserCheck className="h-3.5 w-3.5 text-[#3874ff]" />
                      <span className="truncate">{selectedLog.actorName}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/70 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "គោលដៅ" : "Target"}
                    </div>
                    <div className="mt-1 truncate font-mono font-semibold text-[#141824] dark:text-[#eff2f6]">
                      {selectedLog.targetUser || "—"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/70 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "ចំណាត់ថ្នាក់" : "Category"}
                    </div>
                    <div className="mt-1 font-semibold text-[#141824] dark:text-[#eff2f6]">
                      {isKhmer ? meta.categoryKm : meta.categoryEn}
                    </div>
                  </div>
                </div>

                {/* Human Summary */}
                {parsed.summary && (
                  <div className="rounded-xl border border-[#e3e6ed] p-3.5 dark:border-[#2b3245]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "សេចក្តីសង្ខេប" : "Event Summary"}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                      {parsed.summary}
                    </p>
                  </div>
                )}

                {/* Parsed Key-Value Attributes */}
                {parsed.fields.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-[#e3e6ed] dark:border-[#2b3245]">
                    <div className="border-b border-[#e3e6ed] bg-[#f5f7fa]/80 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                      {isKhmer ? "ព័ត៌មានបច្ចេកទេសដែលបានបំបែក" : "Parsed Telemetry Attributes"}
                    </div>
                    <dl className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                      {parsed.fields.map((field, idx) => (
                        <div
                          key={`${field.key}-${idx}`}
                          className="grid grid-cols-3 gap-3 px-4 py-2"
                        >
                          <dt className="font-medium text-[#6e7891] dark:text-[#8a94ad]">
                            {field.label}
                          </dt>
                          <dd className="col-span-2 break-all font-mono text-[11px] font-semibold text-[#141824] dark:text-[#eff2f6]">
                            {field.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {/* Raw Detail Block */}
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer ? "ទិន្នន័យដើម (Raw Detail)" : "Raw Event Payload"}
                  </div>
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3 font-mono text-[11px] text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#cbd0dd]">
                    {selectedLog.detail || "—"}
                  </pre>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between gap-2 border-t border-[#e3e6ed] bg-[#f5f7fa]/60 px-6 py-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/60">
                <button
                  type="button"
                  onClick={() => handleCopyJson(selectedLog)}
                  className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                >
                  {copiedId === selectedLog.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#25b003]" />
                      <span>{isKhmer ? "បានចម្លង JSON" : "Copied JSON"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "ចម្លង JSON" : "Copy Event JSON"}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="ai-btn-primary h-8 px-4 text-xs"
                >
                  {isKhmer ? "បិទ" : "Close"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </WorkspaceShell>
  );
}
