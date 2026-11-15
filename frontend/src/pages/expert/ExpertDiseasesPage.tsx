import React, { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Image as ImageIcon, Link2, Pencil, Search, Trash2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
  PhoenixSummaryStrip,
} from "@/components/admin/AdminPrimitives";
import { useToast } from "@/context/ToastContext";

interface DiseasesData {
  metrics: { totalCount: number; knowledgeReadyCount: number };
  links: { knowledgeUrl: string; createUrl: string; bulkActionUrl: string };
  diseases: Array<{
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
  }>;
}

export default function ExpertDiseasesPage({ bootstrap }: { bootstrap: AppBootstrap<DiseasesData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const metrics = ui.metrics || {};
  const { pushToast } = useToast();

  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return d.diseases;
    return d.diseases.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.cropName.toLowerCase().includes(q) ||
        item.agricultureCategory.toLowerCase().includes(q) ||
        item.causeExplanation.toLowerCase().includes(q),
    );
  }, [d.diseases, query]);

  const allSelected = filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((row) => row.id));
    }
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
      pushToast("warning", labels.selectAtLeastOne || "Select at least one entry.");
      return;
    }
    const confirmMsg =
      scope === "all"
        ? labels.bulkDeleteAllConfirm || "Delete all listed entries?"
        : labels.bulkDeleteConfirm || "Delete selected entries?";
    if (!window.confirm(confirmMsg)) {
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
      <div className="space-y-5">
        <PhoenixSummaryStrip
          items={[
            {
              label: metrics.total || "Total Entries",
              value: d.metrics.totalCount,
              icon: <BookOpen className="h-5 w-5" />,
              tone: "indigo",
            },
            {
              label: metrics.ready || "Knowledge Ready",
              value: d.metrics.knowledgeReadyCount,
              icon: <CheckCircle2 className="h-5 w-5" />,
              tone: "emerald",
            },
          ]}
        />

        <AdminSectionCard delayIndex={1}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94ad]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isKhmer ? "ស្វែងរកជំងឺ ឬដំណាំ..." : "Search diagnosis or crop..."}
                className="ai-input py-2 pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="ai-input h-9 w-auto py-1 text-xs"
              >
                <option value="">{labels.bulkAction || "Bulk action"}</option>
                <option value="delete">{labels.deleteSelected || "Delete selected"}</option>
              </select>

              <form
                method="POST"
                action={d.links.bulkActionUrl}
                onSubmit={(e) => handleBulkSubmit("selected", e)}
                className="inline-flex"
              >
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value={bulkAction} />
                <input type="hidden" name="scope" value="selected" />
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="disease_ids" value={String(id)} />
                ))}
                <button type="submit" className="ai-btn-secondary h-9 px-3 text-xs">
                  {labels.apply || "Apply"} ({selectedIds.length})
                </button>
              </form>

              <form
                method="POST"
                action={d.links.bulkActionUrl}
                onSubmit={(e) => handleBulkSubmit("all", e)}
                className="inline-flex"
              >
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value={bulkAction} />
                <input type="hidden" name="scope" value="all" />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg border border-[#f48270] bg-white px-3 text-xs font-semibold text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/40 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
                >
                  {labels.applyToListedEntries || "Apply to all"}
                </button>
              </form>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={2} noPadding>
          {filtered.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title={labels.noEntries || "No diagnosis knowledge entries found."}
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
                        />
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#31374a] dark:text-[#eff2f6]">
                        {item.cropName}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#141824] dark:text-[#eff2f6]">
                          {item.name}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {item.severityLabel && (
                            <AdminStatusBadge tone="amber">{item.severityLabel}</AdminStatusBadge>
                          )}
                          {item.agricultureCategory && (
                            <AdminStatusBadge tone="indigo">
                              {item.agricultureCategory}
                            </AdminStatusBadge>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3.5 text-[#525b75] dark:text-[#9fa6bc]">
                        <p className="line-clamp-2">{item.causeExplanation || labels.notSet || "-"}</p>
                      </td>
                      <td className="max-w-xs px-4 py-3.5 text-[#525b75] dark:text-[#9fa6bc]">
                        <p className="line-clamp-2">
                          {item.treatment || item.preventionTips || labels.notSet || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-[#525b75] dark:text-[#9fa6bc]">
                          <span className="inline-flex items-center gap-1 rounded border border-[#cbd0dd] bg-[#f5f7fa] px-1.5 py-0.5 dark:border-[#373e53] dark:bg-[#0f111a]">
                            <Link2 className="h-3 w-3" />
                            {item.hasReferences ? labels.references || "Refs" : labels.noReferences || "No refs"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded border border-[#cbd0dd] bg-[#f5f7fa] px-1.5 py-0.5 dark:border-[#373e53] dark:bg-[#0f111a]">
                            <ImageIcon className="h-3 w-3" />
                            {item.hasImage ? labels.image || "Image" : labels.noImage || "No img"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <a href={item.editUrl} className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs">
                            <Pencil className="h-3 w-3" />
                            {labels.manage || "Edit"}
                          </a>
                          <form
                            method="POST"
                            action={item.deleteAction}
                            onSubmit={(e) => {
                              if (!window.confirm(labels.deleteConfirm || "Delete this entry?")) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center rounded-lg border border-[#f48270] bg-white px-2.5 text-xs text-[#b81800] transition-colors hover:bg-[#ffe0db]/60 dark:border-[#fa3b1d]/40 dark:bg-[#181d2b] dark:text-[#ff9c8c] dark:hover:bg-[#492226]"
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
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
