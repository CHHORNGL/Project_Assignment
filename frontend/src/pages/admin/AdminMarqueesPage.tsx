import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Languages,
  Megaphone,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface MarqueeRow {
  id: number;
  text: string;
  textKh: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string | null;
  toggleAction?: string;
  editUrl: string;
  deleteAction: string;
}

interface MarqueesData {
  addUrl: string;
  marquees: MarqueeRow[];
}

type StatusFilter = "all" | "active" | "paused";

export default function AdminMarqueesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MarqueesData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [previewLang, setPreviewLang] = useState<"en" | "km">(isKhmer ? "km" : "en");
  const [inspectItem, setInspectItem] = useState<MarqueeRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MarqueeRow | null>(null);

  useEffect(() => {
    if (!inspectItem && !pendingDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInspectItem(null);
        setPendingDelete(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectItem, pendingDelete]);

  const activeBanners = useMemo(() => d.marquees.filter((m) => m.isActive), [d.marquees]);
  const pausedCount = d.marquees.length - activeBanners.length;
  const bilingualCount = useMemo(
    () => d.marquees.filter((m) => m.text.trim() && m.textKh.trim()).length,
    [d.marquees],
  );
  const activePct = d.marquees.length > 0 ? Math.round((activeBanners.length / d.marquees.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.marquees.filter((m) => {
      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "paused" && m.isActive) return false;
      if (!q) return true;
      return (
        m.text.toLowerCase().includes(q) ||
        m.textKh.toLowerCase().includes(q) ||
        String(m.sortOrder).includes(q)
      );
    });
  }, [d.marquees, query, statusFilter]);

  const filterTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All", count: d.marquees.length },
    { key: "active", label: isKhmer ? "កំពុងផ្សាយ" : "Active", count: activeBanners.length },
    { key: "paused", label: isKhmer ? "ផ្អាក" : "Paused", count: pausedCount },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.addUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          <span>{isKhmer ? "បន្ថែមសារជូនដំណឹង" : "Add Marquee"}</span>
        </a>
      }
    >
      <div className="space-y-6">
        {/* Top Broadcast KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "សារជូនដំណឹងសរុប" : "Total Banners"}
            value={d.marquees.length.toLocaleString()}
            hint={isKhmer ? "សារទាំងអស់ក្នុងប្រព័ន្ធ" : "Configured notice ticker items"}
            tone="indigo"
            icon={<Megaphone className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "កំពុងផ្សាយផ្ទាល់" : "Live Active"}
            value={activeBanners.length.toLocaleString()}
            hint={isKhmer ? `${activePct}% កំពុងបង្ហាញលើផ្ទាំងកសិករ` : `${activePct}% broadcasting in farmer portal`}
            progress={activePct}
            tone="emerald"
            icon={<Radio className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "បានផ្អាក" : "Paused / Draft"}
            value={pausedCount.toLocaleString()}
            hint={isKhmer ? "សារដែលមិនទាន់បង្ហាញ" : "Hidden from public workspace feed"}
            tone={pausedCount > 0 ? "amber" : "slate"}
            icon={<PauseCircle className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "ពេញលេញពីរភាសា" : "Bilingual Copy"}
            value={`${bilingualCount} / ${d.marquees.length}`}
            hint={isKhmer ? "មានទាំងភាសាអង់គ្លេស និងខ្មែរ" : "Both English & Khmer text configured"}
            tone="sky"
            icon={<Languages className="h-5 w-5" />}
          />
        </div>

        {/* Live Ticker Preview Strip */}
        <AdminSectionCard
          delayIndex={1}
          title={isKhmer ? "មើលជាមុនការផ្សាយបច្ចុប្បន្ន" : "Live Farmer Broadcast Strip"}
          subtitle={
            isKhmer
              ? "របៀបដែលសារសកម្មត្រូវបានបង្ហាញតាមលំដាប់អាទិភាព"
              : "Active notices rendered in priority order for workspace users"
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
          action={
            <div className="inline-flex rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 text-[10px] font-bold dark:border-[#373e53] dark:bg-[#0f111a]">
              <button
                type="button"
                onClick={() => setPreviewLang("en")}
                className={cn(
                  "rounded px-2 py-0.5",
                  previewLang === "en"
                    ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                    : "text-[#6e7891] dark:text-[#8a94ad]",
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setPreviewLang("km")}
                className={cn(
                  "rounded px-2 py-0.5",
                  previewLang === "km"
                    ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                    : "text-[#6e7891] dark:text-[#8a94ad]",
                )}
              >
                KM
              </button>
            </div>
          }
        >
          {activeBanners.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#cbd0dd] bg-[#f5f7fa]/70 px-4 py-3 text-xs text-[#6e7891] dark:border-[#373e53] dark:bg-[#0f111a]">
              <PauseCircle className="h-4 w-4 shrink-0" />
              <span>
                {isKhmer
                  ? "មិនមានសារជូនដំណឹងណាមួយកំពុងផ្សាយទេ។ ចុច បើកផ្សាយ ឬបន្ថែមសារថ្មី។"
                  : "No active announcements are currently live. Activate or publish a banner below."}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {activeBanners.map((banner, idx) => {
                const copy =
                  previewLang === "km" ? banner.textKh || banner.text : banner.text;
                return (
                  <div
                    key={banner.id}
                    className="flex items-start gap-3 rounded-xl border border-[#adc5ff] bg-[#e5edff]/45 px-4 py-2.5 text-xs dark:border-[#3874ff]/35 dark:bg-[#3874ff]/10"
                  >
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-[#3874ff] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      #{idx + 1}
                    </span>
                    <p className="line-clamp-2 flex-1 leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                      {copy}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </AdminSectionCard>

        {/* Main Marquee Directory Table */}
        <AdminSectionCard
          delayIndex={2}
          noPadding
          title={isKhmer ? "បញ្ជីសារជូនដំណឹង" : "Announcement Ticker Banners"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filtered.length} នៃ ${d.marquees.length} សារជូនដំណឹង`
              : `Showing ${filtered.length} of ${d.marquees.length} configured notice strips`
          }
          icon={<Megaphone className="h-4 w-4" />}
        >
          {/* Search & Status Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isKhmer ? "ស្វែងរកសារអង់គ្លេស ឬខ្មែរ..." : "Filter by English or Khmer copy..."
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

            <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
              {filterTabs.map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
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

          {filtered.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Megaphone className="h-5 w-5" />}
                title={
                  isKhmer
                    ? "មិនមានសារជូនដំណឹងត្រូវនឹងការត្រងទេ"
                    : "No announcement marquees match this filter"
                }
                description={
                  isKhmer
                    ? "បន្ថែមសារជូនដំណឹងថ្មី ឬសម្អាតតម្រងស្វែងរក។"
                    : "Reset your search/status filter or create a new announcement banner."
                }
                action={
                  query.trim() || statusFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setStatusFilter("all");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញទាំងអស់" : "Reset Filters"}
                    </button>
                  ) : (
                    <a href={d.addUrl} className="ai-btn-primary h-9 gap-1.5 px-4 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "បន្ថែមសារ" : "Add Marquee"}</span>
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
                    <th className="px-5 py-3">{isKhmer ? "លំដាប់" : "Priority"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ខ្លឹមសារ (អង់គ្លេស និងខ្មែរ)" : "Bilingual Copy"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                    <th className="hidden px-4 py-3 xl:table-cell">{isKhmer ? "បង្កើតនៅ" : "Created"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filtered.map((m) => (
                    <tr key={m.id} className="ai-table-row">
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="inline-flex items-center rounded-md border border-[#e3e6ed] bg-[#f5f7fa] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#cbd0dd]">
                          #{m.sortOrder.toLocaleString()}
                        </span>
                      </td>

                      <td className="max-w-xl px-4 py-3.5">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 rounded bg-[#e5edff] px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]">
                              EN
                            </span>
                            <p className="line-clamp-2 font-medium leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                              {m.text}
                            </p>
                          </div>

                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold",
                                m.textKh.trim()
                                  ? "bg-[#d9fbd0] text-[#1c6c09] dark:bg-[#25b003]/20 dark:text-[#90ee7a]"
                                  : "bg-[#ffefca] text-[#bc3803] dark:bg-[#e5780b]/20 dark:text-[#ffbd6b]",
                              )}
                            >
                              KM
                            </span>
                            <p className="line-clamp-2 leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                              {m.textKh.trim() ||
                                (isKhmer ? "មិនទាន់មានអត្ថបទភាសាខ្មែរទេ" : "Missing Khmer translation")}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <AdminStatusBadge tone={m.isActive ? "emerald" : "slate"} pulse={m.isActive}>
                          {m.isActive
                            ? isKhmer
                              ? "កំពុងផ្សាយ"
                              : "Active"
                            : isKhmer
                              ? "ផ្អាក"
                              : "Paused"}
                        </AdminStatusBadge>
                      </td>

                      <td
                        className="hidden whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad] xl:table-cell"
                        title={m.createdAt || undefined}
                      >
                        {formatAccountTimestamp(m.createdAt)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectItem(m)}
                            aria-label={`Read full banner #${m.id}`}
                            title={isKhmer ? "អានពេញលេញ" : "Read full message"}
                            className="ai-btn-secondary h-8 w-8 justify-center px-0 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {m.toggleAction && (
                            <form method="POST" action={m.toggleAction} className="inline">
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <button
                                type="submit"
                                title={
                                  m.isActive
                                    ? isKhmer
                                      ? "ផ្អាកសារ"
                                      : "Pause banner"
                                    : isKhmer
                                      ? "បើកផ្សាយ"
                                      : "Activate banner"
                                }
                                className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]"
                              >
                                {m.isActive ? (
                                  <>
                                    <Pause className="h-3 w-3" />
                                    <span className="hidden sm:inline">
                                      {isKhmer ? "ផ្អាក" : "Pause"}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-3 w-3 text-[#25b003]" />
                                    <span className="hidden sm:inline">
                                      {isKhmer ? "បើក" : "Publish"}
                                    </span>
                                  </>
                                )}
                              </button>
                            </form>
                          )}

                          <a
                            href={m.editUrl}
                            aria-label={`Edit banner #${m.id}`}
                            className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>{isKhmer ? "កែប្រែ" : "Edit"}</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => setPendingDelete(m)}
                            aria-label={`Delete banner #${m.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#f48270]/60 bg-[#ffe0db]/50 text-[#b81800] transition hover:bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/10 dark:text-[#ff9c8c] dark:hover:bg-[#fa3b1d]/20"
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

      {/* Full Message Inspector Modal */}
      {inspectItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="marquee-inspect-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setInspectItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e3e6ed] bg-white shadow-2xl dark:border-[#2b3245] dark:bg-[#141824]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/85 px-6 py-4 dark:border-[#2b3245] dark:bg-[#0f111a]/85">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AdminStatusBadge tone={inspectItem.isActive ? "emerald" : "slate"} pulse={inspectItem.isActive}>
                    {inspectItem.isActive ? "Active" : "Paused"}
                  </AdminStatusBadge>
                  <span className="font-mono text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    Priority #{inspectItem.sortOrder.toLocaleString()}
                  </span>
                </div>
                <h3
                  id="marquee-inspect-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? `ព័ត៌មានសារជូនដំណឹង #${inspectItem.id}` : `Announcement Banner #${inspectItem.id}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="rounded-lg p-1.5 text-[#6e7891] hover:bg-[#e3e6ed] dark:hover:bg-[#1e2436]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6 text-xs">
              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/60 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#004dff] dark:text-[#85a9ff]">
                  English Copy
                </div>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                  {inspectItem.text}
                </p>
              </div>

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/60 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#1c6c09] dark:text-[#90ee7a]">
                  Khmer Copy (ភាសាខ្មែរ)
                </div>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                  {inspectItem.textKh || "—"}
                </p>
              </div>
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
                <span>{isKhmer ? "កែប្រែសារ" : "Edit Banner"}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-marquee-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#e3e6ed] bg-white p-6 shadow-xl dark:border-[#2b3245] dark:bg-[#141824]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe0db] text-[#b81800] ring-1 ring-[#fa3b1d]/25 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="delete-marquee-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការលុបសារជូនដំណឹង" : "Delete Announcement Marquee"}
                </h3>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer
                    ? `តើអ្នកប្រាកដជាចង់លុបសារ #${pendingDelete.id} ("${pendingDelete.text}") ឬ?`
                    : `Remove banner #${pendingDelete.id} ("${pendingDelete.text}")?`}
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
                  <span>{isKhmer ? "លុបសារ" : "Delete"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
