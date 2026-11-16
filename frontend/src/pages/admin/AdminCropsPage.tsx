import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bug,
  Languages,
  LayoutGrid,
  List,
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
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface CropRow {
  id: number;
  name: string;
  nameKh: string;
  emoji: string;
  description: string;
  descriptionKh: string;
  diseaseCount?: number;
  diagnosisCount?: number;
  editUrl: string;
  deleteAction: string;
}

interface CropsData {
  createUrl: string;
  bulkActionUrl?: string;
  links?: {
    diseasesUrl?: string;
  };
  crops: CropRow[];
}

type CatalogFilter = "all" | "complete" | "incomplete";
type ViewMode = "cards" | "table";

function resolveCropEmoji(crop: { name: string; emoji?: string }): string {
  if (crop.emoji && crop.emoji.trim()) return crop.emoji.trim();
  const n = crop.name.toLowerCase();
  if (n.includes("rice")) return "🌾";
  if (n.includes("potato")) return "🥔";
  if (n.includes("tomato")) return "🍅";
  if (n.includes("cucumber")) return "🥒";
  if (n.includes("chili") || n.includes("pepper")) return "🌶️";
  if (n.includes("banana")) return "🍌";
  if (n.includes("corn") || n.includes("maize")) return "🌽";
  if (n.includes("cassava")) return "🥔";
  return "🌱";
}

function isBilingualComplete(crop: CropRow): boolean {
  return Boolean(
    crop.name.trim() &&
      crop.nameKh.trim() &&
      crop.description.trim() &&
      crop.descriptionKh.trim(),
  );
}

export default function AdminCropsPage({ bootstrap }: { bootstrap: AppBootstrap<CropsData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<CatalogFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDelete, setPendingDelete] = useState<CropRow | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  useEffect(() => {
    if (!pendingDelete && !confirmBulkDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingDelete(null);
        setConfirmBulkDelete(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDelete, confirmBulkDelete]);

  const totalDiseases = useMemo(
    () => d.crops.reduce((acc, c) => acc + (c.diseaseCount || 0), 0),
    [d.crops],
  );
  const totalDiagnoses = useMemo(
    () => d.crops.reduce((acc, c) => acc + (c.diagnosisCount || 0), 0),
    [d.crops],
  );
  const completeCount = useMemo(
    () => d.crops.filter((c) => isBilingualComplete(c)).length,
    [d.crops],
  );
  const incompleteCount = d.crops.length - completeCount;
  const bilingualPct = d.crops.length > 0 ? Math.round((completeCount / d.crops.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.crops.filter((crop) => {
      const complete = isBilingualComplete(crop);
      if (filterMode === "complete" && !complete) return false;
      if (filterMode === "incomplete" && complete) return false;
      if (!q) return true;
      return (
        crop.name.toLowerCase().includes(q) ||
        crop.nameKh.toLowerCase().includes(q) ||
        crop.description.toLowerCase().includes(q) ||
        crop.descriptionKh.toLowerCase().includes(q)
      );
    });
  }, [d.crops, query, filterMode]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.includes(c.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filtered.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((c) => c.id)])));
    }
  };

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectedCascadeDiseases = useMemo(() => {
    const idSet = new Set(selectedIds);
    return d.crops
      .filter((c) => idSet.has(c.id))
      .reduce((acc, c) => acc + (c.diseaseCount || 0), 0);
  }, [d.crops, selectedIds]);

  const filterTabs: Array<{ key: CatalogFilter; label: string; count: number }> = [
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All Crops", count: d.crops.length },
    { key: "complete", label: isKhmer ? "ពេញលេញ EN/KM" : "Bilingual Ready", count: completeCount },
    { key: "incomplete", label: isKhmer ? "ខ្វះព័ត៌មាន" : "Needs Info", count: incompleteCount },
  ];

  const bulkActionUrl = d.bulkActionUrl || "/admin/crops/bulk";

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.links?.diseasesUrl && (
            <a href={d.links.diseasesUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <Bug className="h-3.5 w-3.5" />
              <span>{isKhmer ? "គ្រប់គ្រងជំងឺ" : "Manage Diseases"}</span>
            </a>
          )}
          <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>{isKhmer ? "បន្ថែមដំណាំ" : "Add Crop"}</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Catalog KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "ប្រភេទដំណាំសរុប" : "Registered Crops"}
            value={d.crops.length.toLocaleString()}
            hint={
              isKhmer
                ? `${totalDiagnoses.toLocaleString()} កំណត់ត្រាវិនិច្ឆ័យ`
                : `${totalDiagnoses.toLocaleString()} linked farmer diagnoses`
            }
            tone="emerald"
            icon={<Sprout className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "ជំងឺភ្ជាប់ជាមួយដំណាំ" : "Linked Diseases"}
            value={totalDiseases.toLocaleString()}
            hint={isKhmer ? "ទិន្នន័យជំងឺក្នុងកាតាឡុក" : "Disease profiles mapped to crops"}
            tone="indigo"
            icon={<Bug className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "ទិន្នន័យពីរភាសា" : "Bilingual Ready"}
            value={`${completeCount} / ${d.crops.length}`}
            hint={isKhmer ? `${bilingualPct}% មានឈ្មោះ និងសេចក្តីពណ៌នា` : `${bilingualPct}% EN & KM metadata complete`}
            progress={bilingualPct}
            tone="sky"
            icon={<Languages className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "ខ្វះទិន្នន័យ" : "Missing Details"}
            value={incompleteCount.toLocaleString()}
            hint={
              incompleteCount === 0
                ? isKhmer
                  ? "គ្រប់ដំណាំមានទិន្នន័យពេញលេញ"
                  : "All crops fully documented"
                : isKhmer
                  ? "ត្រូវបំពេញភាសាខ្មែរ ឬការពិពណ៌នា"
                  : "Crops missing translation or notes"
            }
            tone={incompleteCount > 0 ? "amber" : "slate"}
            icon={<AlertCircle className="h-5 w-5" />}
          />
        </div>

        {/* Crop Catalog Directory Card */}
        <AdminSectionCard
          delayIndex={2}
          noPadding
          title={isKhmer ? "បញ្ជីដំណាំក្នុងប្រព័ន្ធ" : "Crop Catalog"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filtered.length} នៃ ${d.crops.length} ដំណាំ`
              : `Showing ${filtered.length} of ${d.crops.length} supported crop varieties`
          }
          icon={<Sprout className="h-4 w-4" />}
          action={
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 dark:border-[#373e53] dark:bg-[#0f111a]">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Card view"
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
          {/* Search, Filter Tabs & Bulk Selection Toolbar */}
          <div className="space-y-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    isKhmer
                      ? "ស្វែងរកឈ្មោះដំណាំ (EN/KM) ឬការពិពណ៌នា..."
                      : "Search crop name (EN/KM) or description..."
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

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                  {filterTabs.map((tab) => {
                    const active = filterMode === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setFilterMode(tab.key)}
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

            {selectedIds.length > 0 && (
              <div className="animate-slide-down flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f48270]/70 bg-[#ffe0db]/75 px-3.5 py-2.5 dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#b81800] dark:text-[#ff9c8c]">
                  <span>
                    {selectedIds.length} {isKhmer ? "ដំណាំត្រូវបានជ្រើសរើស" : "crop(s) selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="rounded px-1.5 py-0.5 text-[11px] underline hover:no-underline"
                  >
                    {isKhmer ? "បោះបង់ការជ្រើសរើស" : "Clear"}
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

          {/* Empty State vs Cards / Table Content */}
          {filtered.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Sprout className="h-5 w-5" />}
                title={isKhmer ? "រកមិនឃើញដំណាំទេ" : "No crops match your filter"}
                description={
                  isKhmer
                    ? "សាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬបន្ថែមប្រភេទដំណាំថ្មី។"
                    : "Adjust your search filter or add a new crop variety."
                }
                action={
                  query.trim().length > 0 || filterMode !== "all" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setFilterMode("all");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញទាំងអស់" : "Reset Filters"}
                    </button>
                  ) : (
                    <a href={d.createUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "បន្ថែមដំណាំ" : "Add Crop"}</span>
                    </a>
                  )
                }
              />
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((crop, idx) => {
                const complete = isBilingualComplete(crop);
                const checked = selectedIds.includes(crop.id);
                const icon = resolveCropEmoji(crop);
                const summary = isKhmer
                  ? crop.descriptionKh || crop.description
                  : crop.description || crop.descriptionKh;

                return (
                  <article
                    key={crop.id}
                    style={{ ["--stagger" as string]: Math.min(idx, 10) }}
                    className={cn(
                      "ai-card-hover ai-stagger flex flex-col justify-between rounded-xl border bg-white p-5 transition-colors dark:bg-[#141824]",
                      checked
                        ? "border-[#3874ff] ring-1 ring-[#3874ff]/25 dark:border-[#85a9ff]"
                        : "border-[#e3e6ed] dark:border-[#2b3245]",
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#90d67f]/60 bg-[#d9fbd0]/65 text-2xl dark:border-[#25b003]/35 dark:bg-[#25b003]/15">
                            {icon}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate font-display text-[15px] font-bold tracking-tight text-[#141824] dark:text-[#eff2f6]">
                              {crop.name}
                            </h3>
                            <p className="truncate text-xs font-medium text-[#525b75] dark:text-[#9fa6bc]">
                              {crop.nameKh || (isKhmer ? "គ្មានឈ្មោះខ្មែរ" : "No Khmer label")}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <AdminStatusBadge tone={complete ? "emerald" : "amber"}>
                            {complete
                              ? "EN + KM"
                              : isKhmer
                                ? "មិនពេញលេញ"
                                : "Partial"}
                          </AdminStatusBadge>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(crop.id)}
                            aria-label={`Select ${crop.name}`}
                            className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                          />
                        </div>
                      </div>

                      <p
                        className={cn(
                          "mt-3.5 min-h-[3.375rem] line-clamp-3 text-xs leading-relaxed",
                          summary
                            ? "text-[#31374a] dark:text-[#cbd0dd]"
                            : "italic text-[#8a94ad]",
                        )}
                      >
                        {summary ||
                          (isKhmer
                            ? "មិនទាន់មានសេចក្តីពិពណ៌នាអំពីដំណាំនៅឡើយទេ។"
                            : "No agronomy summary added yet.")}
                      </p>

                      {/* Linked Metrics Strip */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3 py-1.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
                          <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#6e7891] dark:text-[#8a94ad]">
                            {isKhmer ? "ជំងឺ" : "Diseases"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 font-display text-sm font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                            <Bug className="h-3 w-3 text-[#3874ff]" />
                            <span>{(crop.diseaseCount ?? 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-[#e3e6ed] bg-[#f5f7fa]/80 px-3 py-1.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
                          <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#6e7891] dark:text-[#8a94ad]">
                            {isKhmer ? "ការស្កេន" : "Diagnoses"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 font-display text-sm font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                            <Activity className="h-3 w-3 text-[#25b003]" />
                            <span>{(crop.diagnosisCount ?? 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                      <a
                        href={crop.editUrl}
                        className="ai-btn-secondary h-8 flex-1 justify-center gap-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>{isKhmer ? "កែប្រែដំណាំ" : "Edit Profile"}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(crop)}
                        aria-label={`Delete ${crop.name}`}
                        title={isKhmer ? "លុបដំណាំ" : "Delete crop"}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#f48270]/60 bg-[#ffe0db]/50 text-[#b81800] transition hover:bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/10 dark:text-[#ff9c8c] dark:hover:bg-[#fa3b1d]/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                    <th className="w-10 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible crops"
                        className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                      />
                    </th>
                    <th className="px-4 py-3">{isKhmer ? "ដំណាំ" : "Crop Variety"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ការពិពណ៌នា" : "Summary"}</th>
                    <th className="px-4 py-3 text-right">{isKhmer ? "ជំងឺ" : "Diseases"}</th>
                    <th className="px-4 py-3 text-right">{isKhmer ? "ការស្កេន" : "Scans"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ស្ថានភាពភាសា" : "Localization"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filtered.map((crop) => {
                    const complete = isBilingualComplete(crop);
                    const icon = resolveCropEmoji(crop);
                    const summary = isKhmer
                      ? crop.descriptionKh || crop.description
                      : crop.description || crop.descriptionKh;
                    return (
                      <tr key={crop.id} className="ai-table-row">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(crop.id)}
                            onChange={() => toggleOne(crop.id)}
                            aria-label={`Select ${crop.name}`}
                            className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#90d67f]/50 bg-[#d9fbd0]/60 text-lg dark:border-[#25b003]/30 dark:bg-[#25b003]/15">
                              {icon}
                            </span>
                            <div>
                              <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                                {crop.name}
                              </div>
                              <div className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                                {crop.nameKh || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-xs px-4 py-3.5">
                          <p className="line-clamp-2 text-[#525b75] dark:text-[#9fa6bc]">
                            {summary || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          {(crop.diseaseCount ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          {(crop.diagnosisCount ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone={complete ? "emerald" : "amber"}>
                            {complete ? "EN + KM" : isKhmer ? "មិនពេញលេញ" : "Partial"}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={crop.editUrl}
                              className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>{isKhmer ? "កែប្រែ" : "Edit"}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(crop)}
                              aria-label={`Delete ${crop.name}`}
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

      {/* Single Crop Delete Confirmation Modal */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-crop-title"
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
                  id="delete-crop-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការលុបដំណាំ" : "Delete Crop Variety"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      តើអ្នកប្រាកដជាចង់លុប{" "}
                      <strong className="text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.name}
                      </strong>{" "}
                      ឬ?
                      {(pendingDelete.diseaseCount ?? 0) > 0 &&
                        ` ព័ត៌មានជំងឺចំនួន ${pendingDelete.diseaseCount} ដែលភ្ជាប់ជាមួយដំណាំនេះនឹងត្រូវលុបផងដែរ (ប្រវត្តិរោគវិនិច្ឆ័យកសិករនៅតែរក្សាទុក)។`}
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete{" "}
                      <strong className="text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.name}
                      </strong>
                      ?
                      {(pendingDelete.diseaseCount ?? 0) > 0
                        ? ` This will cascade-delete ${pendingDelete.diseaseCount} linked disease record(s) while preserving historical diagnosis logs.`
                        : " Historical diagnosis logs will remain preserved."}
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
                  <span>{isKhmer ? "លុបដំណាំ" : "Delete Crop"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Crop Delete Confirmation Modal */}
      {confirmBulkDelete && selectedIds.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-crops-title"
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
                  id="bulk-delete-crops-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer
                    ? `លុបដំណាំចំនួន ${selectedIds.length} ឬ?`
                    : `Delete ${selectedIds.length} Selected Crop(s)?`}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer
                    ? `សកម្មភាពនេះនឹងលុបដំណាំដែលបានជ្រើស${selectedCascadeDiseases > 0 ? ` និងជំងឺពាក់ព័ន្ធចំនួន ${selectedCascadeDiseases}` : ""} ប៉ុន្តែរក្សាទុកប្រវត្តិវិនិច្ឆ័យ។`
                    : `This removes the selected crop entries${selectedCascadeDiseases > 0 ? ` and ${selectedCascadeDiseases} linked disease profile(s)` : ""} while keeping farmer diagnosis history intact.`}
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
                  <input key={id} type="hidden" name="crop_ids" value={String(id)} />
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
