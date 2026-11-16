import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Image as ImageIcon,
  Link2,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertBulkToolbar,
  ExpertConfirmModal,
  type ExpertConfirmModalConfig,
  ExpertHeaderActions,
  ExpertSearchField,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { useToast } from "@/context/ToastContext";

interface DiseaseRow {
  id: number;
  cropName: string;
  name: string;
  severityLabel: string;
  agricultureCategory: string;
  agricultureSubCategory: string;
  referenceScopeLabel: string;
  causeExplanation: string;
  treatment: string;
  preventionTips: string;
  hasReferences: boolean;
  hasImage: boolean;
  hasVisualNotes: boolean;
  editUrl: string;
  deleteAction: string;
}

interface DiseasesData {
  metrics: { totalCount: number; knowledgeReadyCount: number };
  links: { knowledgeUrl: string; createUrl: string; bulkActionUrl: string };
  diseases: DiseaseRow[];
}

type ReadinessFilter = "all" | "ready" | "missing_refs" | "missing_image";

function severityTone(label: string): AdminTone {
  const s = (label || "").toLowerCase();
  if (s.includes("crit") || s.includes("sev") || s.includes("high")) return "rose";
  if (s.includes("med") || s.includes("mod")) return "amber";
  return "emerald";
}

export default function ExpertDiseasesPage({ bootstrap }: { bootstrap: AppBootstrap<DiseasesData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const metrics = ui.metrics || {};
  const { pushToast } = useToast();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readiness, setReadiness] = useState<ReadinessFilter>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [inspectItem, setInspectItem] = useState<DiseaseRow | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ExpertConfirmModalConfig | null>(null);

  useEffect(() => {
    if (!inspectItem) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectItem]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const item of d.diseases) {
      if (item.agricultureCategory) unique.add(item.agricultureCategory);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [d.diseases]);

  const refCount = useMemo(
    () => d.diseases.filter((item) => item.hasReferences).length,
    [d.diseases],
  );
  const imgCount = useMemo(
    () => d.diseases.filter((item) => item.hasImage).length,
    [d.diseases],
  );
  const readyPct =
    d.metrics.totalCount > 0
      ? Math.round((d.metrics.knowledgeReadyCount / d.metrics.totalCount) * 100)
      : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.diseases.filter((item) => {
      if (categoryFilter !== "all" && item.agricultureCategory !== categoryFilter) {
        return false;
      }
      if (readiness === "ready" && !(item.hasReferences || item.hasVisualNotes || item.treatment)) {
        return false;
      }
      if (readiness === "missing_refs" && item.hasReferences) return false;
      if (readiness === "missing_image" && item.hasImage) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.cropName.toLowerCase().includes(q) ||
        item.agricultureCategory.toLowerCase().includes(q) ||
        item.causeExplanation.toLowerCase().includes(q)
      );
    });
  }, [d.diseases, query, categoryFilter, readiness]);

  const allSelected = filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id));
  const hasFilters = query.trim().length > 0 || categoryFilter !== "all" || readiness !== "all";

  const toggleAll = () => {
    if (allSelected) {
      const visibleSet = new Set(filtered.map((row) => row.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((row) => row.id)])));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openBulkConfirm = (scope: "selected" | "all") => {
    if (!bulkAction) {
      pushToast("warning", labels.bulkActionRequired || "Select a bulk action first.");
      return;
    }
    if (scope === "selected" && selectedIds.length === 0) {
      pushToast("warning", labels.selectAtLeastOne || "Select at least one entry.");
      return;
    }
    const hiddenFields = [
      { name: "action", value: bulkAction },
      { name: "scope", value: scope },
      ...(scope === "selected"
        ? selectedIds.map((id) => ({ name: "disease_ids", value: String(id) }))
        : []),
    ];
    setConfirmConfig({
      title:
        scope === "all"
          ? isKhmer
            ? "លុបទិន្នន័យជំងឺទាំងអស់?"
            : "Delete all listed entries?"
          : isKhmer
            ? `លុបទិន្នន័យជំងឺចំនួន ${selectedIds.length}?`
            : `Delete ${selectedIds.length} selected entries?`,
      description:
        scope === "all"
          ? labels.bulkDeleteAllConfirm || "Delete all listed diagnosis knowledge entries?"
          : labels.bulkDeleteConfirm || "Delete the selected diagnosis knowledge entries?",
      confirmLabel: labels.delete || (isKhmer ? "លុបទិន្នន័យ" : "Delete"),
      cancelLabel: isKhmer ? "បោះបង់" : "Cancel",
      tone: "rose",
      formAction: d.links.bulkActionUrl,
      csrfToken: bootstrap.csrfToken,
      hiddenFields,
    });
  };

  const openSingleDeleteConfirm = (item: DiseaseRow) => {
    setConfirmConfig({
      title: isKhmer ? `លុប "${item.name}"?` : `Delete "${item.name}"?`,
      description:
        labels.deleteConfirm || "Are you sure you want to delete this diagnosis knowledge entry?",
      confirmLabel: labels.delete || (isKhmer ? "លុប" : "Delete"),
      cancelLabel: isKhmer ? "បោះបង់" : "Cancel",
      tone: "rose",
      formAction: item.deleteAction,
      csrfToken: bootstrap.csrfToken,
    });
  };

  const readinessTabs: Array<{ id: ReadinessFilter; label: string }> = [
    { id: "all", label: isKhmer ? "ទាំងអស់" : "All" },
    { id: "ready", label: isKhmer ? "រួចរាល់" : "Ready" },
    { id: "missing_refs", label: isKhmer ? "ខ្វះឯកសារ" : "Missing refs" },
    { id: "missing_image", label: isKhmer ? "ខ្វះរូបភាព" : "Missing image" },
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={metrics.total || "Total Entries"}
            value={d.metrics.totalCount}
            hint={metrics.totalMeta || "Knowledge records"}
            icon={<BookOpen className="h-5 w-5" />}
            tone="indigo"
          />
          <AdminKpiCard
            delayIndex={1}
            label={metrics.ready || "Knowledge Ready"}
            value={d.metrics.knowledgeReadyCount}
            hint={`${readyPct}% ${isKhmer ? "ពេញលេញ" : "completeness"}`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="emerald"
            progress={readyPct}
          />
          <AdminKpiCard
            delayIndex={2}
            label={labels.references || "With References"}
            value={refCount}
            hint={isKhmer ? "មានប្រភពយោងវិទ្យាសាស្ត្រ" : "Scientific citations linked"}
            icon={<Link2 className="h-5 w-5" />}
            tone="sky"
          />
          <AdminKpiCard
            delayIndex={3}
            label={labels.image || "With Images"}
            value={imgCount}
            hint={isKhmer ? "មានរូបភាពផ្ទៀងផ្ទាត់" : "Visual reference samples"}
            icon={<ImageIcon className="h-5 w-5" />}
            tone="amber"
          />
        </div>

        <AdminSectionCard delayIndex={1}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <ExpertSearchField
                  value={query}
                  onChange={setQuery}
                  placeholder={isKhmer ? "ស្វែងរកជំងឺ ដំណាំ ឬមូលហេតុ..." : "Search diagnosis, crop, or cause..."}
                />
                {categories.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label={labels.category || "Category"}
                    className="ai-input h-9 w-auto min-w-[140px] py-1 text-xs"
                  >
                    <option value="all">{isKhmer ? "ប្រភេទទាំងអស់" : "All categories"}</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#cbd0dd] bg-[#eff2f6] p-1 dark:border-[#373e53] dark:bg-[#0f111a]">
                {readinessTabs.map((tab) => {
                  const active = readiness === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setReadiness(tab.id)}
                      className={
                        active
                          ? "rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                          : "rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#525b75] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#eff2f6]"
                      }
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <ExpertBulkToolbar
              selectedCount={selectedIds.length}
              selectedLabel={labels.selected}
              bulkAction={bulkAction}
              onBulkActionChange={setBulkAction}
              options={[{ id: "delete", label: labels.deleteSelected || "Delete selected" }]}
              actionPlaceholder={labels.bulkAction || "Bulk action"}
              applySelectedLabel={labels.apply || "Apply"}
              applyAllLabel={labels.applyToListedEntries || "Apply to all"}
              onRequestSelected={() => openBulkConfirm("selected")}
              onRequestAll={() => openBulkConfirm("all")}
            />
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={2} noPadding>
          {filtered.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title={
                  hasFilters
                    ? isKhmer
                      ? "មិនមានទិន្នន័យត្រូវនឹងការច្រោះទេ"
                      : "No matching entries found"
                    : labels.noEntries || "No diagnosis knowledge entries found."
                }
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCategoryFilter("all");
                        setReadiness("all");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញទាំងអស់" : "Reset filters"}
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label={labels.selectAll || "Select all"}
                      />
                    </th>
                    <th className="px-4 py-3 font-bold">{labels.crop || "Crop"}</th>
                    <th className="px-4 py-3 font-bold">{labels.diagnosis || "Diagnosis"}</th>
                    <th className="px-4 py-3 font-bold">{labels.cause || "Cause"}</th>
                    <th className="px-4 py-3 font-bold">{labels.treatmentPrevention || "Treatment"}</th>
                    <th className="px-4 py-3 font-bold">{labels.referencesImage || "Evidence"}</th>
                    <th className="px-4 py-3 text-right font-bold">{labels.actions || "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filtered.map((item) => (
                    <tr key={item.id} className="ai-table-row align-top">
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleOne(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-md border border-[#cbd0dd] bg-[#f5f7fa] px-2 py-0.5 text-[11px] font-semibold text-[#31374a] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#eff2f6]">
                          {item.cropName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#141824] dark:text-[#eff2f6]">
                          {item.name}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.severityLabel && (
                            <AdminStatusBadge tone={severityTone(item.severityLabel)}>
                              {item.severityLabel}
                            </AdminStatusBadge>
                          )}
                          {item.agricultureCategory && (
                            <AdminStatusBadge tone="indigo">
                              {item.agricultureCategory}
                            </AdminStatusBadge>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3.5 text-[#525b75] dark:text-[#9fa6bc]">
                        <p className="line-clamp-2 leading-relaxed">
                          {item.causeExplanation || labels.notSet || "-"}
                        </p>
                      </td>
                      <td className="max-w-xs px-4 py-3.5 text-[#525b75] dark:text-[#9fa6bc]">
                        <p className="line-clamp-2 leading-relaxed">
                          {item.treatment || item.preventionTips || labels.notSet || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <span
                            className={
                              item.hasReferences
                                ? "inline-flex items-center gap-1 rounded border border-[#90d67f] bg-[#d9fbd0]/70 px-1.5 py-0.5 font-medium text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#90ee7a]"
                                : "inline-flex items-center gap-1 rounded border border-[#cbd0dd] bg-[#f5f7fa] px-1.5 py-0.5 text-[#6e7891] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#8a94ad]"
                            }
                          >
                            <Link2 className="h-3 w-3" />
                            {item.hasReferences ? labels.references || "Refs" : labels.noReferences || "No refs"}
                          </span>
                          <span
                            className={
                              item.hasImage
                                ? "inline-flex items-center gap-1 rounded border border-[#adc5ff] bg-[#e5edff]/80 px-1.5 py-0.5 font-medium text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                                : "inline-flex items-center gap-1 rounded border border-[#cbd0dd] bg-[#f5f7fa] px-1.5 py-0.5 text-[#6e7891] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#8a94ad]"
                            }
                          >
                            <ImageIcon className="h-3 w-3" />
                            {item.hasImage ? labels.image || "Image" : labels.noImage || "No img"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectItem(item)}
                            className="ai-btn-secondary h-8 px-2.5 text-xs"
                            title={isKhmer ? "មើលលម្អិត" : "Quick inspect"}
                            aria-label={`Inspect ${item.name}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <a href={item.editUrl} className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs">
                            <Pencil className="h-3 w-3" />
                            <span>{labels.manage || "Edit"}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => openSingleDeleteConfirm(item)}
                            aria-label={`Delete ${item.name}`}
                            className="inline-flex h-8 items-center rounded-lg border border-[#f48270] bg-white px-2.5 text-xs text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/40 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSectionCard>
      </div>

      {/* Quick Knowledge Inspector Modal */}
      {inspectItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f111a]/55 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectItem(null);
          }}
        >
          <div className="ai-surface animate-fade-in-up flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#cbd0dd] bg-white shadow-2xl dark:border-[#373e53] dark:bg-[#141824]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ed] px-5 py-4 dark:border-[#2b3245]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone="indigo">{inspectItem.cropName}</AdminStatusBadge>
                  {inspectItem.severityLabel && (
                    <AdminStatusBadge tone={severityTone(inspectItem.severityLabel)}>
                      {inspectItem.severityLabel}
                    </AdminStatusBadge>
                  )}
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-[#141824] dark:text-[#eff2f6]">
                  {inspectItem.name}
                </h3>
                {(inspectItem.agricultureCategory || inspectItem.referenceScopeLabel) && (
                  <p className="mt-0.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {[
                      inspectItem.agricultureCategory,
                      inspectItem.agricultureSubCategory,
                      inspectItem.referenceScopeLabel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8a94ad] hover:bg-[#eff2f6] hover:text-[#141824] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="phoenix-scroll flex-1 space-y-4 overflow-y-auto p-5 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
                  <div className="flex items-center gap-1.5 font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    <Link2 className="h-3.5 w-3.5" />
                    {labels.references || "References"}
                  </div>
                  <p className="mt-1 font-bold text-[#141824] dark:text-[#eff2f6]">
                    {inspectItem.hasReferences
                      ? isKhmer
                        ? "មានភ្ជាប់"
                        : "Linked"
                      : isKhmer
                        ? "មិនទាន់មាន"
                        : "None"}
                  </p>
                </div>
                <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
                  <div className="flex items-center gap-1.5 font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {labels.image || "Reference Image"}
                  </div>
                  <p className="mt-1 font-bold text-[#141824] dark:text-[#eff2f6]">
                    {inspectItem.hasImage
                      ? isKhmer
                        ? "មានរូបភាព"
                        : "Uploaded"
                      : isKhmer
                        ? "មិនទាន់មាន"
                        : "Missing"}
                  </p>
                </div>
                <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
                  <div className="flex items-center gap-1.5 font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {labels.visualInputNotes || "Visual Notes"}
                  </div>
                  <p className="mt-1 font-bold text-[#141824] dark:text-[#eff2f6]">
                    {inspectItem.hasVisualNotes
                      ? isKhmer
                        ? "មានកំណត់ចំណាំ"
                        : "Documented"
                      : isKhmer
                        ? "មិនទាន់មាន"
                        : "None"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
                <p className="mb-1.5 flex items-center gap-1.5 font-bold text-[#141824] dark:text-[#eff2f6]">
                  <FileText className="h-3.5 w-3.5 text-[#3874ff]" />
                  {labels.cause || "Cause Explanation"}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed text-[#31374a] dark:text-[#cbd0dd]">
                  {inspectItem.causeExplanation || labels.notSet || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
                <p className="mb-1.5 font-bold text-[#141824] dark:text-[#eff2f6]">
                  {labels.treatment || "Step-by-step Treatment"}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed text-[#31374a] dark:text-[#cbd0dd]">
                  {inspectItem.treatment || labels.notSet || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
                <p className="mb-1.5 font-bold text-[#141824] dark:text-[#eff2f6]">
                  {labels.preventionTips || "Prevention Tips"}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed text-[#31374a] dark:text-[#cbd0dd]">
                  {inspectItem.preventionTips || labels.notSet || "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[#e3e6ed] bg-[#f5f7fa] px-5 py-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="ai-btn-secondary h-9 px-3.5 text-xs"
              >
                {isKhmer ? "បិទ" : "Close"}
              </button>
              <a href={inspectItem.editUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                <Pencil className="h-3.5 w-3.5" />
                <span>{labels.manage || "Edit"}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      <ExpertConfirmModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </WorkspaceShell>
  );
}
