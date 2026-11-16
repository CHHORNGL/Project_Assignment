import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  Eye,
  GitBranch,
  Languages,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Sprout,
  Trash2,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface DiseaseRow {
  id: number;
  name: string;
  nameEn?: string;
  nameKh?: string;
  cropId?: number | null;
  cropName: string;
  severity?: string;
  severityLabel: string;
  description: string;
  descriptionKh?: string;
  causeExplanation?: string;
  causeExplanationKh?: string;
  treatment: string;
  treatmentKh?: string;
  preventionTips?: string;
  preventionTipsKh?: string;
  rulesCount?: number;
  editUrl: string;
  deleteAction: string;
}

interface AdminDiseasesData {
  createUrl: string;
  bulkActionUrl?: string;
  links?: {
    cropsUrl?: string;
  };
  crops?: Array<{ id: number; name: string }>;
  diseases: DiseaseRow[];
}

type SeverityFilter = "ALL" | "Critical" | "High" | "Medium" | "Low";

function severityTone(keyOrLabel: string): AdminTone {
  const s = (keyOrLabel || "").toLowerCase();
  if (s.includes("crit") || s.includes("sev") || s.includes("high")) return "rose";
  if (s.includes("med") || s.includes("mod")) return "amber";
  return "emerald";
}

function normalizedSeverity(item: DiseaseRow): "Critical" | "High" | "Medium" | "Low" {
  const s = (item.severity || item.severityLabel || "").toLowerCase();
  if (s.includes("crit") || s.includes("sev")) return "Critical";
  if (s.includes("high")) return "High";
  if (s.includes("med") || s.includes("mod")) return "Medium";
  return "Low";
}

function isBilingualDiseaseComplete(item: DiseaseRow): boolean {
  return Boolean(
    (item.nameEn || item.name).trim() &&
      (item.nameKh || "").trim() &&
      (item.treatment || "").trim() &&
      (item.treatmentKh || "").trim(),
  );
}

export default function AdminDiseasesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminDiseasesData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [query, setQuery] = useState("");
  const [cropFilter, setCropFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inspectItem, setInspectItem] = useState<DiseaseRow | null>(null);
  const [inspectLang, setInspectLang] = useState<"en" | "km">(isKhmer ? "km" : "en");
  const [pendingDelete, setPendingDelete] = useState<DiseaseRow | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  useEffect(() => {
    if (!inspectItem && !pendingDelete && !confirmBulkDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInspectItem(null);
        setPendingDelete(null);
        setConfirmBulkDelete(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectItem, pendingDelete, confirmBulkDelete]);

  const cropOptions = useMemo(() => {
    if (d.crops && d.crops.length > 0) return d.crops;
    const map = new Map<string, string>();
    for (const dis of d.diseases) {
      if (dis.cropName && dis.cropName !== "-") {
        map.set(dis.cropName, dis.cropName);
      }
    }
    return Array.from(map.keys())
      .sort()
      .map((name, i) => ({ id: i + 1, name }));
  }, [d.crops, d.diseases]);

  const severityCounts = useMemo(() => {
    const counts = { ALL: d.diseases.length, Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const item of d.diseases) {
      counts[normalizedSeverity(item)] += 1;
    }
    return counts;
  }, [d.diseases]);

  const highCriticalCount = severityCounts.Critical + severityCounts.High;
  const bilingualCount = useMemo(
    () => d.diseases.filter((item) => isBilingualDiseaseComplete(item)).length,
    [d.diseases],
  );
  const bilingualPct =
    d.diseases.length > 0 ? Math.round((bilingualCount / d.diseases.length) * 100) : 0;
  const totalRules = useMemo(
    () => d.diseases.reduce((acc, item) => acc + (item.rulesCount || 0), 0),
    [d.diseases],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.diseases.filter((item) => {
      if (cropFilter !== "all") {
        const matchesId = item.cropId !== undefined && item.cropId !== null && String(item.cropId) === cropFilter;
        const matchesName = item.cropName === cropFilter;
        if (!matchesId && !matchesName) return false;
      }
      if (severityFilter !== "ALL" && normalizedSeverity(item) !== severityFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.nameEn || "").toLowerCase().includes(q) ||
        (item.nameKh || "").toLowerCase().includes(q) ||
        item.cropName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.treatment.toLowerCase().includes(q)
      );
    });
  }, [d.diseases, query, cropFilter, severityFilter]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filtered.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((i) => i.id)])));
    }
  };

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const severityTabs: Array<{ key: SeverityFilter; label: string; count: number }> = [
    { key: "ALL", label: isKhmer ? "ទាំងអស់" : "All", count: severityCounts.ALL },
    { key: "Critical", label: isKhmer ? "ធ្ងន់ធ្ងរបំផុត" : "Critical", count: severityCounts.Critical },
    { key: "High", label: isKhmer ? "ខ្ពស់" : "High", count: severityCounts.High },
    { key: "Medium", label: isKhmer ? "មធ្យម" : "Medium", count: severityCounts.Medium },
    { key: "Low", label: isKhmer ? "ទាប" : "Low", count: severityCounts.Low },
  ];

  const bulkActionUrl = d.bulkActionUrl || "/admin/diseases/bulk";
  const hasFilters = query.trim().length > 0 || cropFilter !== "all" || severityFilter !== "ALL";

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.links?.cropsUrl && (
            <a href={d.links.cropsUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <Sprout className="h-3.5 w-3.5" />
              <span>{isKhmer ? "គ្រប់គ្រងដំណាំ" : "Manage Crops"}</span>
            </a>
          )}
          <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>{isKhmer ? "បន្ថែមជំងឺថ្មី" : "Add Disease"}</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Pathology KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "កំណត់ត្រាជំងឺសរុប" : "Disease Profiles"}
            value={d.diseases.length.toLocaleString()}
            hint={
              isKhmer
                ? `${cropOptions.length} ប្រភេទដំណាំគោល`
                : `Across ${cropOptions.length} host crops`
            }
            tone="indigo"
            icon={<Bug className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "កម្រិតខ្ពស់ និងធ្ងន់ធ្ងរ" : "High / Critical Risk"}
            value={highCriticalCount.toLocaleString()}
            hint={isKhmer ? "ករណីជំងឺត្រូវការអន្តរាគមន៍រហ័ស" : "Priority pathogen severity alerts"}
            tone={highCriticalCount > 0 ? "rose" : "slate"}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "ទិន្នន័យពីរភាសា" : "Bilingual Protocols"}
            value={`${bilingualCount} / ${d.diseases.length}`}
            hint={isKhmer ? `${bilingualPct}% មានឈ្មោះ និងការព្យាបាល EN/KM` : `${bilingualPct}% EN & KM treatments complete`}
            progress={bilingualPct}
            tone="emerald"
            icon={<Languages className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "ច្បាប់វិនិច្ឆ័យភ្ជាប់" : "Diagnostic Rules"}
            value={totalRules.toLocaleString()}
            hint={isKhmer ? "ច្បាប់រោគសញ្ញាភ្ជាប់ក្នុងម៉ាស៊ីន AI" : "Knowledge-base inference rules linked"}
            tone="sky"
            icon={<GitBranch className="h-5 w-5" />}
          />
        </div>

        {/* Disease Pathology Catalog */}
        <AdminSectionCard
          delayIndex={2}
          noPadding
          title={isKhmer ? "កាតាឡុកជំងឺរុក្ខជាតិ" : "Disease Pathology Catalog"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filtered.length} នៃ ${d.diseases.length} ប្រភេទជំងឺ`
              : `Showing ${filtered.length.toLocaleString()} of ${d.diseases.length.toLocaleString()} pathology definitions`
          }
          icon={<Bug className="h-4 w-4" />}
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCropFilter("all");
                  setSeverityFilter("ALL");
                }}
                className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សម្អាតតម្រង" : "Clear Filters"}</span>
              </button>
            ) : undefined
          }
        >
          {/* Search, Crop Select & Severity Filter Toolbar */}
          <div className="space-y-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      isKhmer
                        ? "ស្វែងរកជំងឺ (EN/KM) ដំណាំ ឬការព្យាបាល..."
                        : "Search disease (EN/KM), crop, or treatment..."
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
                  value={cropFilter}
                  onChange={(e) => setCropFilter(e.target.value)}
                  aria-label="Filter by host crop"
                  className="ai-input h-9 w-full py-1 text-xs sm:w-44"
                >
                  <option value="all">{isKhmer ? "គ្រប់ដំណាំ" : "All Host Crops"}</option>
                  {cropOptions.map((c) => (
                    <option
                      key={c.id}
                      value={d.diseases.some((x) => x.cropId === c.id) ? String(c.id) : c.name}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                {severityTabs.map((tab) => {
                  const active = severityFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSeverityFilter(tab.key)}
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

            {selectedIds.length > 0 && (
              <div className="animate-slide-down flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f48270]/70 bg-[#ffe0db]/75 px-3.5 py-2.5 dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#b81800] dark:text-[#ff9c8c]">
                  <span>
                    {selectedIds.length} {isKhmer ? "ជំងឺត្រូវបានជ្រើសរើស" : "disease(s) selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="rounded px-1.5 py-0.5 text-[11px] underline hover:no-underline"
                  >
                    {isKhmer ? "បោះបង់" : "Clear"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#fa3b1d] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d92c11]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>
                    {isKhmer
                      ? `លុបដែលបានជ្រើស (${selectedIds.length})`
                      : `Delete Selected (${selectedIds.length})`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Bug className="h-5 w-5" />}
                title={
                  isKhmer
                    ? "មិនមានកំណត់ត្រាជំងឺត្រូវនឹងការត្រងទេ"
                    : "No disease profiles match your filter"
                }
                description={
                  isKhmer
                    ? "សាកល្បងសម្អាតពាក្យស្វែងរក ឬបន្ថែមជំងឺដំណាំថ្មី។"
                    : "Try resetting your crop/severity filters or add a new disease entry."
                }
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCropFilter("all");
                        setSeverityFilter("ALL");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញទាំងអស់" : "Reset Filters"}
                    </button>
                  ) : (
                    <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "បន្ថែមជំងឺថ្មី" : "Add Disease"}</span>
                    </a>
                  )
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="w-10 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible diseases"
                        className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                      />
                    </th>
                    <th className="px-4 py-3">{isKhmer ? "ឈ្មោះជំងឺ" : "Disease Profile"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ដំណាំគោល" : "Host Crop"}</th>
                    <th className="px-4 py-3">{isKhmer ? "កម្រិតធ្ងន់ធ្ងរ" : "Severity"}</th>
                    <th className="px-4 py-3">{isKhmer ? "វិធីព្យាបាល និងច្បាប់" : "Treatment & Rules"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filtered.map((item) => {
                    const sevKey = normalizedSeverity(item);
                    const complete = isBilingualDiseaseComplete(item);
                    const secondaryName = isKhmer ? item.nameEn : item.nameKh;
                    const primarySummary = isKhmer
                      ? item.treatmentKh || item.treatment || item.descriptionKh || item.description
                      : item.treatment || item.description;

                    return (
                      <tr key={item.id} className="ai-table-row">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleOne(item.id)}
                            aria-label={`Select ${item.name}`}
                            className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <a
                                href={item.editUrl}
                                className="font-semibold text-[#141824] transition-colors hover:text-[#3874ff] dark:text-[#eff2f6] dark:hover:text-[#85a9ff]"
                              >
                                {item.name}
                              </a>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase",
                                  complete
                                    ? "bg-[#d9fbd0] text-[#1c6c09] dark:bg-[#25b003]/15 dark:text-[#90ee7a]"
                                    : "bg-[#ffefca] text-[#bc3803] dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]",
                                )}
                              >
                                {complete ? "EN+KM" : "Partial"}
                              </span>
                            </div>
                            {secondaryName && secondaryName !== item.name && (
                              <div className="mt-0.5 truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                                {secondaryName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone="slate">{item.cropName}</AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone={severityTone(sevKey)}>
                            {item.severityLabel || sevKey}
                          </AdminStatusBadge>
                        </td>
                        <td className="max-w-md px-4 py-3.5">
                          <p className="line-clamp-2 text-[#31374a] dark:text-[#cbd0dd]">
                            {primarySummary || "—"}
                          </p>
                          {(item.rulesCount ?? 0) > 0 && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded border border-[#e3e6ed] bg-[#f5f7fa] px-1.5 py-0.5 font-mono text-[10px] text-[#525b75] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#9fa6bc]">
                              <GitBranch className="h-2.5 w-2.5 text-[#3874ff]" />
                              {item.rulesCount} rule{item.rulesCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setInspectLang(isKhmer ? "km" : "en");
                                setInspectItem(item);
                              }}
                              title={isKhmer ? "មើលព័ត៌មានលម្អិត" : "Quick read"}
                              aria-label={`Inspect ${item.name}`}
                              className="ai-btn-secondary h-8 w-8 justify-center px-0 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={item.editUrl}
                              className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>{isKhmer ? "កែប្រែ" : "Edit"}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(item)}
                              aria-label={`Delete ${item.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#f48270]/60 bg-[#ffe0db]/50 text-[#b81800] transition hover:bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/10 dark:text-[#ff9c8c] dark:hover:bg-[#fa3b1d]/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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

      {/* Clinical Reader Modal */}
      {inspectItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disease-inspect-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setInspectItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white shadow-2xl dark:border-[#2b3245] dark:bg-[#141824]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/85 px-6 py-4 dark:border-[#2b3245] dark:bg-[#0f111a]/85">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone="slate">{inspectItem.cropName}</AdminStatusBadge>
                  <AdminStatusBadge tone={severityTone(normalizedSeverity(inspectItem))}>
                    {inspectItem.severityLabel || normalizedSeverity(inspectItem)}
                  </AdminStatusBadge>
                </div>
                <h3
                  id="disease-inspect-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {inspectLang === "km"
                    ? inspectItem.nameKh || inspectItem.nameEn || inspectItem.name
                    : inspectItem.nameEn || inspectItem.name}
                </h3>
                {(inspectLang === "km" ? inspectItem.nameEn : inspectItem.nameKh) && (
                  <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {inspectLang === "km" ? inspectItem.nameEn : inspectItem.nameKh}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#cbd0dd] bg-white p-0.5 text-[10px] font-bold dark:border-[#373e53] dark:bg-[#141824]">
                  <button
                    type="button"
                    onClick={() => setInspectLang("en")}
                    className={cn(
                      "rounded px-2 py-0.5",
                      inspectLang === "en"
                        ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                        : "text-[#6e7891] dark:text-[#8a94ad]",
                    )}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectLang("km")}
                    className={cn(
                      "rounded px-2 py-0.5",
                      inspectLang === "km"
                        ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                        : "text-[#6e7891] dark:text-[#8a94ad]",
                    )}
                  >
                    KM
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectItem(null)}
                  aria-label="Close detail"
                  className="rounded-lg p-1.5 text-[#6e7891] transition hover:bg-[#e3e6ed] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] space-y-3.5 overflow-y-auto p-6 text-xs">
              {[
                {
                  label: isKhmer ? "ការពិពណ៌នា" : "Overview",
                  text:
                    inspectLang === "km"
                      ? inspectItem.descriptionKh || inspectItem.description
                      : inspectItem.description,
                },
                {
                  label: isKhmer ? "មូលហេតុបង្ក" : "Root Cause",
                  text:
                    inspectLang === "km"
                      ? inspectItem.causeExplanationKh || inspectItem.causeExplanation
                      : inspectItem.causeExplanation,
                },
                {
                  label: isKhmer ? "វិធីព្យាបាល" : "Treatment Protocol",
                  text:
                    inspectLang === "km"
                      ? inspectItem.treatmentKh || inspectItem.treatment
                      : inspectItem.treatment,
                },
                {
                  label: isKhmer ? "វិធីការពារ" : "Prevention Tips",
                  text:
                    inspectLang === "km"
                      ? inspectItem.preventionTipsKh || inspectItem.preventionTips
                      : inspectItem.preventionTips,
                },
              ].map((sec) => (
                <div
                  key={sec.label}
                  className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/60 p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                    {sec.label}
                  </div>
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                    {sec.text || "—"}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#e3e6ed] bg-[#f5f7fa]/60 px-6 py-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/60">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="ai-btn-secondary h-8 px-3.5 text-xs"
              >
                {isKhmer ? "បិទ" : "Close"}
              </button>
              <a href={inspectItem.editUrl} className="ai-btn-primary h-8 gap-1.5 px-4 text-xs">
                <Pencil className="h-3.5 w-3.5" />
                <span>{isKhmer ? "កែប្រែជំងឺ" : "Edit Disease"}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Single Disease Delete Modal */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-disease-title"
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
                  id="delete-disease-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការលុបជំងឺ" : "Delete Disease Profile"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      តើអ្នកប្រាកដជាចង់លុប{" "}
                      <strong className="text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.name}
                      </strong>{" "}
                      ឬ? ច្បាប់វិនិច្ឆ័យដែលភ្ជាប់ជាមួយជំងឺនេះនឹងត្រូវដកចេញ។
                    </>
                  ) : (
                    <>
                      Delete{" "}
                      <strong className="text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.name}
                      </strong>{" "}
                      from the catalog? Historical farmer diagnoses will stay intact.
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
                  <span>{isKhmer ? "លុបជំងឺ" : "Delete"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {confirmBulkDelete && selectedIds.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-diseases-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setConfirmBulkDelete(false)}
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
                  id="bulk-delete-diseases-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer
                    ? `លុបជំងឺចំនួន ${selectedIds.length} ឬ?`
                    : `Delete ${selectedIds.length} Selected Disease(s)?`}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer
                    ? "សកម្មភាពនេះនឹងលុបទិន្នន័យជំងឺដែលបានជ្រើសរើស ប៉ុន្តែរក្សាទុកប្រវត្តិវិនិច្ឆ័យកសិករ។"
                    : "Selected disease profiles and their rule mappings will be removed while historical diagnosis logs stay intact."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <form method="POST" action={bulkActionUrl}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="scope" value="selected" />
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="disease_ids" value={String(id)} />
                ))}
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#fa3b1d] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d92c11]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "លុបទាំងអស់" : "Confirm Delete"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
