import React, { useState } from "react";
import { Database, Download, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
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

interface MixedSourceRow {
  id: number;
  sourceTitle: string;
  sourceOrg: string;
  publicationYear?: number | null;
  sourceType: string;
  sourceUrl: string;
  accessedAt?: string | null;
  factCount: number;
  editUrl: string;
  addFactUrl: string;
  deleteAction: string;
}

interface MixedAgriSourcesData {
  filters: { q: string; perPage: number };
  pagination: PaginationInfo;
  sources: MixedSourceRow[];
  links: {
    dashboardUrl: string;
    sourcesUrl: string;
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

export default function ExpertMixedAgriSourcesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MixedAgriSourcesData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const { pushToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [confirmConfig, setConfirmConfig] = useState<ExpertConfirmModalConfig | null>(null);

  const allSelected = d.sources.length > 0 && d.sources.every((s) => selectedIds.includes(s.id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : d.sources.map((s) => s.id));
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
      pushToast("warning", labels.selectAtLeastOne || "Select at least one source.");
      return;
    }

    const isDelete = bulkAction === "delete";
    const description = isDelete
      ? scope === "all"
        ? labels.confirmBulkDeleteAll || "Delete all filtered sources?"
        : labels.confirmBulkDeleteSelected || "Delete selected sources?"
      : scope === "all"
        ? labels.confirmBulkExportAll || "Export all filtered sources?"
        : labels.confirmBulkExportSelected || "Export selected sources?";

    setConfirmConfig({
      title: isDelete
        ? isKhmer
          ? "បញ្ជាក់ការលុបប្រភពទិន្នន័យ"
          : "Confirm source deletion"
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
        ...(scope === "selected"
          ? selectedIds.map((id) => ({ name: "source_ids", value: String(id) }))
          : []),
      ],
    });
  };

  const openSingleDelete = (src: MixedSourceRow) => {
    setConfirmConfig({
      title: isKhmer ? `លុប "${src.sourceTitle}"?` : `Delete "${src.sourceTitle}"?`,
      description:
        labels.confirmDeleteSource || "Delete this source and unlink its associated metadata?",
      confirmLabel: labels.delete || (isKhmer ? "លុប" : "Delete"),
      cancelLabel: isKhmer ? "បោះបង់" : "Cancel",
      tone: "rose",
      formAction: src.deleteAction,
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
              <form method="GET" action={d.links.sourcesUrl} className="flex flex-wrap items-center gap-2">
                <ExpertSearchField
                  name="q"
                  defaultValue={d.filters.q}
                  placeholder={labels.searchSourcesPlaceholder || "Search sources..."}
                  className="sm:w-64"
                />
                <select
                  name="per_page"
                  defaultValue={String(d.filters.perPage)}
                  className="ai-input h-9 w-20 py-1 text-xs"
                >
                  {d.options.perPage.map((opt) => (
                    <option key={opt} value={String(opt)}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button type="submit" className="ai-btn-primary h-9 px-3.5 text-xs">
                  {labels.search || "Search"}
                </button>
                {d.filters.q && (
                  <a href={d.links.sourcesUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                    {labels.clear || "Clear"}
                  </a>
                )}
              </form>

              <div className="flex flex-wrap items-center gap-2">
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
          {d.sources.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<Database className="h-5 w-5" />}
                title={labels.noSourcesFound || "No sources found."}
                action={
                  d.filters.q ? (
                    <a href={d.links.sourcesUrl} className="ai-btn-secondary h-8 px-3 text-xs">
                      {labels.clear || "Clear"}
                    </a>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
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
                      <th className="px-4 py-3 font-bold">{labels.title || "Title"}</th>
                      <th className="px-4 py-3 font-bold">{labels.org || "Organization"}</th>
                      <th className="px-4 py-3 font-bold">{labels.year || "Year"}</th>
                      <th className="px-4 py-3 font-bold">{labels.type || "Type"}</th>
                      <th className="px-4 py-3 font-bold">{labels.facts || "Facts"}</th>
                      <th className="px-4 py-3 text-right font-bold">{labels.actions || "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.sources.map((src) => (
                      <tr key={src.id} className="ai-table-row">
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(src.id)}
                            onChange={() => toggleOne(src.id)}
                            aria-label={`Select ${src.sourceTitle}`}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[#141824] dark:text-[#eff2f6]">
                            {src.sourceTitle}
                          </div>
                          {src.sourceUrl && (
                            <a
                              href={src.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex max-w-xs items-center gap-1 truncate text-[11px] text-[#3874ff] hover:text-[#004dff] hover:underline dark:text-[#85a9ff]"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{src.sourceUrl}</span>
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-[#525b75] dark:text-[#9fa6bc]">
                          {src.sourceOrg}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[#6e7891] dark:text-[#8a94ad]">
                          {src.publicationYear ?? "-"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex rounded border border-[#cbd0dd] bg-[#f5f7fa] px-2 py-0.5 text-[11px] font-medium text-[#525b75] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#9fa6bc]">
                            {src.sourceType || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <AdminStatusBadge tone="indigo">{src.factCount}</AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={src.addFactUrl}
                              className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
                              title={labels.addFact || "Add fact"}
                              aria-label={`Add fact to ${src.sourceTitle}`}
                            >
                              <Plus className="h-3 w-3" />
                            </a>
                            <a
                              href={src.editUrl}
                              className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
                              title={labels.edit || "Edit"}
                              aria-label={`Edit ${src.sourceTitle}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => openSingleDelete(src)}
                              aria-label={`Delete ${src.sourceTitle}`}
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

              <div className="px-5 pb-4">
                <PaginationBar
                  pagination={d.pagination}
                  showingRange={labels.showingRange}
                  pageOf={labels.pageOf}
                  prevLabel={labels.prev}
                  nextLabel={labels.next}
                  baseUrl={d.links.sourcesUrl}
                  extraParams={{ q: d.filters.q || undefined }}
                />
              </div>
            </>
          )}
        </AdminSectionCard>
      </div>

      <ExpertConfirmModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </WorkspaceShell>
  );
}
