import React, { useState } from "react";
import { Database, Download, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, PaginationBar, type PaginationInfo } from "@/components/expert/ExpertShared";
import { AdminEmptyState, AdminSectionCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useToast } from "@/context/ToastContext";

interface MixedAgriSourcesData {
  filters: { q: string; perPage: number };
  pagination: PaginationInfo;
  sources: Array<{
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
  }>;
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
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const { pushToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");

  const allSelected = d.sources.length > 0 && d.sources.every((s) => selectedIds.includes(s.id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : d.sources.map((s) => s.id));
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkSubmit = (scope: "selected" | "all", e: React.FormEvent<HTMLFormElement>) => {
    if (!bulkAction) {
      e.preventDefault();
      pushToast("warning", labels.bulkActionRequired || "Select a bulk action first.");
      return;
    }
    if (scope === "selected" && selectedIds.length === 0) {
      e.preventDefault();
      pushToast("warning", labels.selectAtLeastOne || "Select at least one source.");
      return;
    }
    const confirmMsg =
      bulkAction === "delete"
        ? scope === "all"
          ? labels.confirmBulkDeleteAll
          : labels.confirmBulkDeleteSelected
        : scope === "all"
          ? labels.confirmBulkExportAll
          : labels.confirmBulkExportSelected;
    if (confirmMsg && !window.confirm(confirmMsg)) {
      e.preventDefault();
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-4">
        <AdminSectionCard delayIndex={0}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form method="GET" action={d.links.sourcesUrl} className="flex flex-wrap items-center gap-2">
              <div className="relative w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                <input
                  type="text"
                  name="q"
                  defaultValue={d.filters.q}
                  placeholder={labels.searchSourcesPlaceholder || "Search sources..."}
                  className="ai-input h-9 py-1 pl-8 text-xs"
                />
              </div>
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
              <button type="submit" className="ai-btn-primary h-9 px-3 text-xs">
                {labels.search || "Search"}
              </button>
              <a href={d.links.sourcesUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                {labels.clear || "Clear"}
              </a>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <a href={d.links.exportCsvUrl} className="ai-btn-secondary h-9 gap-1 px-3 text-xs">
                <Download className="h-3.5 w-3.5" />
                {labels.exportCsv || "CSV"}
              </a>
              <a href={d.links.exportJsonUrl} className="ai-btn-secondary h-9 gap-1 px-3 text-xs">
                <Download className="h-3.5 w-3.5" />
                {labels.exportJson || "JSON"}
              </a>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={1}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="ai-input h-9 w-48 py-1 text-xs"
            >
              <option value="">{labels.bulkAction || "Bulk action"}</option>
              {d.options.bulkActions.map((act) => (
                <option key={act.id} value={act.id}>
                  {act.label}
                </option>
              ))}
            </select>
            <form
              method="POST"
              action={d.links.bulkActionUrl}
              onSubmit={(e) => handleBulkSubmit("selected", e)}
            >
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="action" value={bulkAction} />
              <input type="hidden" name="scope" value="selected" />
              <input type="hidden" name="q" value={d.filters.q} />
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="source_ids" value={String(id)} />
              ))}
              <button type="submit" className="ai-btn-secondary h-9 px-3 text-xs">
                {labels.apply || "Apply"} ({selectedIds.length})
              </button>
            </form>
            <form
              method="POST"
              action={d.links.bulkActionUrl}
              onSubmit={(e) => handleBulkSubmit("all", e)}
            >
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="action" value={bulkAction} />
              <input type="hidden" name="scope" value="all" />
              <input type="hidden" name="q" value={d.filters.q} />
              <button type="submit" className="ai-btn-secondary h-9 px-3 text-xs">
                {labels.applyAllFiltered || "Apply to filtered"}
              </button>
            </form>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={2}>
          <div className="space-y-4">
            {d.sources.length === 0 ? (
              <AdminEmptyState
                icon={<Database className="h-5 w-5" />}
                title={labels.noSourcesFound || "No sources found."}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                    <tr>
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                      </th>
                      <th className="px-3 py-3 font-bold">{labels.title || "Title"}</th>
                      <th className="px-3 py-3 font-bold">{labels.org || "Organization"}</th>
                      <th className="px-3 py-3 font-bold">{labels.year || "Year"}</th>
                      <th className="px-3 py-3 font-bold">{labels.type || "Type"}</th>
                      <th className="px-3 py-3 font-bold">{labels.facts || "Facts"}</th>
                      <th className="px-3 py-3 text-right font-bold">{labels.actions || "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                    {d.sources.map((src) => (
                      <tr key={src.id} className="ai-table-row">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(src.id)}
                            onChange={() => toggleOne(src.id)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-[#141824] dark:text-[#eff2f6]">
                            {src.sourceTitle}
                          </div>
                          {src.sourceUrl && (
                            <a
                              href={src.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#3874ff] hover:text-[#004dff] hover:underline dark:text-[#85a9ff]"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {src.sourceUrl}
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[#525b75] dark:text-[#9fa6bc]">
                          {src.sourceOrg}
                        </td>
                        <td className="px-3 py-3 font-mono text-[#6e7891] dark:text-[#8a94ad]">
                          {src.publicationYear ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-[#6e7891] dark:text-[#8a94ad]">
                          {src.sourceType}
                        </td>
                        <td className="px-3 py-3">
                          <AdminStatusBadge tone="indigo">{src.factCount}</AdminStatusBadge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={src.addFactUrl}
                              className="ai-btn-secondary h-8 gap-1 px-2 text-xs"
                              title={labels.addFact}
                            >
                              <Plus className="h-3 w-3" />
                            </a>
                            <a
                              href={src.editUrl}
                              className="ai-btn-secondary h-8 gap-1 px-2 text-xs"
                              title={labels.edit}
                            >
                              <Pencil className="h-3 w-3" />
                            </a>
                            <form
                              method="POST"
                              action={src.deleteAction}
                              onSubmit={(e) => {
                                if (!window.confirm(labels.confirmDeleteSource || "Delete this source?")) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center rounded-lg border border-[#f48270] bg-white px-2 text-xs text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/40 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
