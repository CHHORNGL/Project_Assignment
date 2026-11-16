import React, { useEffect, useState } from "react";
import { Download, Eye, FileText, Pencil, Trash2, X } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertBulkToolbar,
  ExpertConfirmModal,
  type ExpertConfirmModalConfig,
  ExpertHeaderActions,
  ExpertSearchField,
  PaginationBar,
  type PaginationInfo,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { useToast } from "@/context/ToastContext";

interface MixedFactRow {
  id: number;
  sourceTitle: string;
  topic: string;
  region: string;
  metricValue: string;
  metricUnit: string;
  metricYear?: number | null;
  factText: string;
  editUrl: string;
  deleteAction: string;
}

interface MixedAgriFactsData {
  filters: { q: string; sourceId: string; perPage: number };
  pagination: PaginationInfo;
  facts: MixedFactRow[];
  sources: Array<{ id: number; title: string }>;
  links: {
    dashboardUrl: string;
    factsUrl: string;
    createUrl: string;
    bulkActionUrl: string;
    exportCsvUrl: string;
    exportJsonUrl: string;
  };
  options: {
    perPage: number[];
    bulkActions: Array<{ id: string; label: string }>;
  };
}

export default function ExpertMixedAgriFactsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MixedAgriFactsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const { pushToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [inspectFact, setInspectFact] = useState<MixedFactRow | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ExpertConfirmModalConfig | null>(null);

  useEffect(() => {
    if (!inspectFact) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectFact(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectFact]);

  const allSelected = d.facts.length > 0 && d.facts.every((f) => selectedIds.includes(f.id));
  const hasFilters = Boolean(d.filters.q || d.filters.sourceId);

  const toggleAll = () => setSelectedIds(allSelected ? [] : d.facts.map((f) => f.id));
  const toggleOne = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const openBulkConfirm = (scope: "selected" | "all") => {
    if (!bulkAction) {
      pushToast("warning", labels.bulkActionRequired || "Select a bulk action first.");
      return;
    }
    if (scope === "selected" && selectedIds.length === 0) {
      pushToast("warning", labels.selectAtLeastOne || "Select at least one fact.");
      return;
    }

    const isDelete = bulkAction === "delete";
    const description = isDelete
      ? scope === "all"
        ? labels.confirmBulkDeleteAll || "Delete all filtered facts?"
        : labels.confirmBulkDeleteSelected || "Delete selected facts?"
      : scope === "all"
        ? labels.confirmBulkExportAll || "Export all filtered facts?"
        : labels.confirmBulkExportSelected || "Export selected facts?";

    setConfirmConfig({
      title: isDelete
        ? isKhmer
          ? "បញ្ជាក់ការលុបទិន្នន័យ"
          : "Confirm fact deletion"
        : isKhmer
          ? "បញ្ជាក់សកម្មភាពជាក្រុម"
          : "Confirm bulk action",
      description,
      confirmLabel: isDelete ? labels.delete || "Delete" : labels.apply || "Apply",
      cancelLabel: isKhmer ? "បោះបង់" : "Cancel",
      tone: isDelete ? "rose" : "indigo",
      formAction: d.links.bulkActionUrl,
      csrfToken: bootstrap.csrfToken,
      hiddenFields: [
        { name: "action", value: bulkAction },
        { name: "scope", value: scope },
        { name: "q", value: d.filters.q },
        { name: "source_id", value: d.filters.sourceId },
        ...(scope === "selected"
          ? selectedIds.map((id) => ({ name: "fact_ids", value: String(id) }))
          : []),
      ],
    });
  };

  const openSingleDelete = (fact: MixedFactRow) => {
    setConfirmConfig({
      title: isKhmer ? `លុបទិន្នន័យ #${fact.id}?` : `Delete fact #${fact.id}?`,
      description: labels.confirmDeleteFact || "Delete this mixed agriculture fact?",
      confirmLabel: labels.delete || (isKhmer ? "លុប" : "Delete"),
      cancelLabel: isKhmer ? "បោះបង់" : "Cancel",
      tone: "rose",
      formAction: fact.deleteAction,
      csrfToken: bootstrap.csrfToken,
    });
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-5">
        <AdminSectionCard delayIndex={0}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form method="GET" action={d.links.factsUrl} className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto">
                <ExpertSearchField
                  name="q"
                  defaultValue={d.filters.q}
                  placeholder={labels.searchFactsPlaceholder || "Search facts..."}
                  className="min-w-0 sm:w-56"
                />
                <select
                  name="source_id"
                  defaultValue={d.filters.sourceId}
                  className="ai-input h-9 w-full min-w-0 py-1 text-xs sm:w-48"
                >
                  <option value="">{labels.allSources || "All Sources"}</option>
                  {d.sources.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <select
                  name="per_page"
                  defaultValue={String(d.filters.perPage)}
                  className="ai-input h-9 w-full min-w-0 py-1 text-xs min-[360px]:w-20"
                >
                  {d.options.perPage.map((opt) => (
                    <option key={opt} value={String(opt)}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button type="submit" className="ai-btn-primary h-9 px-3.5 text-xs">
                  {labels.filter || "Filter"}
                </button>
                {hasFilters && (
                  <a href={d.links.factsUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                    {labels.clear || "Clear"}
                  </a>
                )}
              </form>

              <div className="flex items-center gap-2">
                <a href={d.links.exportCsvUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  <span>{labels.exportCsv || "CSV"}</span>
                </a>
                <a href={d.links.exportJsonUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  <span>{labels.exportJson || "JSON"}</span>
                </a>
              </div>
            </div>

            <ExpertBulkToolbar
              selectedCount={selectedIds.length}
              selectedLabel={labels.selected}
              bulkAction={bulkAction}
              onBulkActionChange={setBulkAction}
              options={d.options.bulkActions}
              actionPlaceholder={labels.bulkAction || "Bulk action"}
              applySelectedLabel={labels.apply || "Apply"}
              applyAllLabel={labels.applyAllFiltered || "Apply to filtered"}
              onRequestSelected={() => openBulkConfirm("selected")}
              onRequestAll={() => openBulkConfirm("all")}
            />
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={1} noPadding>
          {d.facts.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<FileText className="h-5 w-5" />}
                title={labels.noFactsFound || "No facts found."}
                action={
                  hasFilters ? (
                    <a href={d.links.factsUrl} className="ai-btn-secondary h-8 px-3 text-xs">
                      {labels.clear || "Clear"}
                    </a>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Mobile Facts Cards */}
              <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245] sm:hidden">
                {d.facts.map((fact) => (
                  <div key={fact.id} className="space-y-2.5 p-4 text-xs">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(fact.id)}
                        onChange={() => toggleOne(fact.id)}
                        aria-label={`Select fact #${fact.id}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded accent-[#3874ff]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AdminStatusBadge tone="indigo">{fact.topic}</AdminStatusBadge>
                          {fact.metricValue && (
                            <AdminStatusBadge tone="emerald">
                              {fact.metricValue} {fact.metricUnit}
                              {fact.metricYear ? ` (${fact.metricYear})` : ""}
                            </AdminStatusBadge>
                          )}
                        </div>
                        <div className="mt-1 font-semibold [overflow-wrap:anywhere] text-[#141824] dark:text-[#eff2f6]">
                          {fact.sourceTitle}
                        </div>
                        {fact.region && (
                          <div className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                            {fact.region}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="line-clamp-3 [overflow-wrap:anywhere] leading-relaxed text-[#31374a] dark:text-[#eff2f6]">
                      {fact.factText}
                    </p>

                    <div className="flex justify-end">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectFact(fact)}
                          className="ai-btn-secondary h-8 px-2.5 text-xs"
                          title={isKhmer ? "មើលលម្អិត" : "Quick view"}
                          aria-label={`Inspect fact #${fact.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={fact.editUrl}
                          className="ai-btn-secondary h-8 px-2.5 text-xs"
                          title={labels.edit || "Edit"}
                          aria-label={`Edit fact #${fact.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => openSingleDelete(fact)}
                          aria-label={`Delete fact #${fact.id}`}
                          className="inline-flex h-8 items-center rounded-lg border border-[#f48270] bg-white px-2.5 text-xs text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/40 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Facts Table */}
              <div className="hidden overflow-x-auto sm:block">
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
                      <th className="px-4 py-3 font-bold">{labels.source || "Source"}</th>
                      <th className="px-4 py-3 font-bold">{labels.topic || "Topic"}</th>
                      <th className="px-4 py-3 font-bold">{labels.region || "Region"}</th>
                      <th className="px-4 py-3 font-bold">{labels.metric || "Metric"}</th>
                      <th className="px-4 py-3 font-bold">{labels.fact || "Fact"}</th>
                      <th className="px-4 py-3 text-right font-bold">{labels.actions || "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.facts.map((fact) => (
                      <tr key={fact.id} className="ai-table-row align-top">
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(fact.id)}
                            onChange={() => toggleOne(fact.id)}
                            aria-label={`Select fact #${fact.id}`}
                          />
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-[#141824] dark:text-[#eff2f6]">
                          {fact.sourceTitle}
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone="indigo">{fact.topic}</AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5 text-[#6e7891] dark:text-[#8a94ad]">
                          {fact.region || "-"}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[#525b75] dark:text-[#9fa6bc]">
                          {fact.metricValue
                            ? `${fact.metricValue} ${fact.metricUnit}${fact.metricYear ? ` (${fact.metricYear})` : ""}`
                            : "-"}
                        </td>
                        <td className="max-w-md px-4 py-3.5 text-[#31374a] dark:text-[#eff2f6]">
                          <p className="line-clamp-2 leading-relaxed">{fact.factText}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectFact(fact)}
                              className="ai-btn-secondary h-8 px-2.5 text-xs"
                              title={isKhmer ? "មើលលម្អិត" : "Quick view"}
                              aria-label={`Inspect fact #${fact.id}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={fact.editUrl}
                              className="ai-btn-secondary h-8 px-2.5 text-xs"
                              title={labels.edit || "Edit"}
                              aria-label={`Edit fact #${fact.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => openSingleDelete(fact)}
                              aria-label={`Delete fact #${fact.id}`}
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

              <div className="px-4 pb-4 sm:px-5">
                <PaginationBar
                  pagination={d.pagination}
                  showingRange={labels.showingRange}
                  pageOf={labels.pageOf}
                  prevLabel={labels.prev}
                  nextLabel={labels.next}
                  baseUrl={d.links.factsUrl}
                  extraParams={{
                    q: d.filters.q || undefined,
                    source_id: d.filters.sourceId || undefined,
                  }}
                />
              </div>
            </>
          )}
        </AdminSectionCard>
      </div>

      {inspectFact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f111a]/55 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectFact(null);
          }}
        >
          <div className="ai-surface animate-fade-in-up flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#cbd0dd] bg-white shadow-2xl dark:border-[#373e53] dark:bg-[#141824]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ed] px-4 py-3.5 dark:border-[#2b3245] sm:px-5 sm:py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone="indigo">{inspectFact.topic}</AdminStatusBadge>
                  {inspectFact.metricValue && (
                    <AdminStatusBadge tone="emerald">
                      {inspectFact.metricValue} {inspectFact.metricUnit}
                      {inspectFact.metricYear ? ` · ${inspectFact.metricYear}` : ""}
                    </AdminStatusBadge>
                  )}
                </div>
                <h3 className="mt-2 font-display text-sm font-bold [overflow-wrap:anywhere] text-[#141824] dark:text-[#eff2f6]">
                  {inspectFact.sourceTitle}
                </h3>
                {inspectFact.region && (
                  <p className="mt-0.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {inspectFact.region}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectFact(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a94ad] hover:bg-[#eff2f6] hover:text-[#141824] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="phoenix-scroll flex-1 overflow-y-auto p-4 sm:p-5">
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-xs leading-relaxed text-[#31374a] dark:text-[#cbd0dd]">
                {inspectFact.factText}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#e3e6ed] bg-[#f5f7fa] px-5 py-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <button
                type="button"
                onClick={() => setInspectFact(null)}
                className="ai-btn-secondary h-8 px-3 text-xs"
              >
                {isKhmer ? "បិទ" : "Close"}
              </button>
              <a href={inspectFact.editUrl} className="ai-btn-primary h-8 gap-1.5 px-3.5 text-xs">
                <Pencil className="h-3 w-3" />
                <span>{labels.edit || "Edit"}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      <ExpertConfirmModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </WorkspaceShell>
  );
}
