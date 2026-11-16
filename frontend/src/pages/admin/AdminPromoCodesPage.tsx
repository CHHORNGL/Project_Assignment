import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Ticket,
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

interface PromoCodeRow {
  id: number;
  code: string;
  tokensReward: number;
  isRedeemed: boolean;
  redeemedBy?: string;
  redeemedAt?: string | null;
  createdAt?: string | null;
  deleteAction: string;
}

interface PromoCodesData {
  createAction: string;
  bulkActionUrl?: string;
  links?: {
    premiumSettingsUrl?: string;
  };
  codes: PromoCodeRow[];
}

type VoucherFilter = "all" | "available" | "redeemed";

const TOKEN_PRESETS = [500, 1000, 5000, 10000, 50000];

export default function AdminPromoCodesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<PromoCodesData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [tokensInput, setTokensInput] = useState("1000");
  const [quantity, setQuantity] = useState("1");
  const [customCode, setCustomCode] = useState("");
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<VoucherFilter>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PromoCodeRow | null>(null);
  const [pendingBulkAction, setPendingBulkAction] = useState<"delete_selected" | "clear_redeemed" | null>(
    null,
  );

  useEffect(() => {
    if (!pendingDelete && !pendingBulkAction) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingDelete(null);
        setPendingBulkAction(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDelete, pendingBulkAction]);

  const redeemedCount = useMemo(
    () => d.codes.filter((c) => c.isRedeemed).length,
    [d.codes],
  );
  const availableCount = d.codes.length - redeemedCount;
  const totalCredits = useMemo(
    () => d.codes.reduce((acc, c) => acc + (c.tokensReward || 0), 0),
    [d.codes],
  );
  const availableCredits = useMemo(
    () => d.codes.filter((c) => !c.isRedeemed).reduce((acc, c) => acc + (c.tokensReward || 0), 0),
    [d.codes],
  );
  const claimedCredits = totalCredits - availableCredits;
  const claimRate = d.codes.length > 0 ? Math.round((redeemedCount / d.codes.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.codes.filter((c) => {
      if (filterMode === "available" && c.isRedeemed) return false;
      if (filterMode === "redeemed" && !c.isRedeemed) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        (c.redeemedBy || "").toLowerCase().includes(q) ||
        String(c.tokensReward).includes(q)
      );
    });
  }, [d.codes, query, filterMode]);

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

  const handleCopyCode = async (item: PromoCodeRow) => {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopiedId(item.id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === item.id ? null : prev));
      }, 1600);
    } catch {
      // Clipboard may be restricted in non-HTTPS frames
    }
  };

  const filterTabs: Array<{ key: VoucherFilter; label: string; count: number }> = [
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All Vouchers", count: d.codes.length },
    { key: "available", label: isKhmer ? "អាចប្រើបាន" : "Available", count: availableCount },
    { key: "redeemed", label: isKhmer ? "បានប្រើរួច" : "Redeemed", count: redeemedCount },
  ];

  const batchQty = Number.parseInt(quantity, 10) || 1;
  const bulkActionUrl = d.bulkActionUrl || "/admin/promo-codes/bulk";

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        d.links?.premiumSettingsUrl && (
          <a href={d.links.premiumSettingsUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
            <CreditCard className="h-3.5 w-3.5" />
            <span>{isKhmer ? "ការកំណត់ Pro & KHQR" : "Premium & KHQR"}</span>
          </a>
        )
      }
    >
      <div className="space-y-6">
        {/* Top Voucher Metrics Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "កូដរង្វាន់សរុប" : "Issued Vouchers"}
            value={d.codes.length.toLocaleString()}
            hint={isKhmer ? "កូដប្រើបានតែម្តងគត់" : "Single-use AI credit vouchers"}
            tone="indigo"
            icon={<Ticket className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "កូដនៅសល់" : "Available Codes"}
            value={availableCount.toLocaleString()}
            hint={`${availableCredits.toLocaleString()} ${isKhmer ? "ក្រេឌីតរង់ចាំការប្រើ" : "credits ready to claim"}`}
            tone="emerald"
            icon={<Sparkles className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "បានប្រើរួចហើយ" : "Redeemed"}
            value={redeemedCount.toLocaleString()}
            hint={`${claimRate}% ${isKhmer ? "អត្រាការប្រើ" : "claim rate"} · ${claimedCredits.toLocaleString()} credits`}
            progress={claimRate}
            tone="sky"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "តម្លៃក្រេឌីតសរុប" : "Total Minted Credits"}
            value={totalCredits.toLocaleString()}
            hint={isKhmer ? "ក្រេឌីត AI ដែលបានបង្កើតសរុប" : "Cumulative AI quota provisioned"}
            tone="amber"
            icon={<Coins className="h-5 w-5" />}
          />
        </div>

        {/* Mint AI Credit Voucher Card */}
        <AdminSectionCard
          delayIndex={1}
          title={isKhmer ? "បង្កើតកូដក្រេឌីត AI ថ្មី" : "Mint AI Credit Vouchers"}
          subtitle={
            isKhmer
              ? "បង្កើតកូដរង្វាន់ ១ ឬច្រើនក្នុងពេលតែមួយ ដើម្បីផ្តល់ជូនកសិករ"
              : "Generate single-use voucher codes redeemable for instant farmer AI credits"
          }
          icon={<Sparkles className="h-4 w-4" />}
        >
          <form method="POST" action={d.createAction} className="space-y-4">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            {/* Quick Token Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "ចំនួនរហ័ស៖" : "Quick credit amount:"}
              </span>
              {TOKEN_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTokensInput(String(preset))}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition",
                    Number(tokensInput) === preset
                      ? "border-[#3874ff] bg-[#e5edff] text-[#004dff] dark:border-[#85a9ff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                      : "border-[#e3e6ed] bg-[#f5f7fa] text-[#525b75] hover:border-[#cbd0dd] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#9fa6bc]",
                  )}
                >
                  +{preset.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-4">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ចំនួនក្រេឌីត AI *" : "Credit Reward Amount *"}
                </label>
                <div className="relative">
                  <Coins className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="number"
                    name="tokens"
                    min="1"
                    required
                    value={tokensInput}
                    onChange={(e) => setTokensInput(e.target.value)}
                    className="ai-input pl-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="min-w-0 lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ចំនួនកូដ (១–២០)" : "Quantity (1–20)"}
                </label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  max="20"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="ai-input font-mono text-xs"
                />
              </div>

              <div className="min-w-0 lg:col-span-4">
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "កូដផ្ទាល់ខ្លួន (ជាជម្រើស)" : "Custom Code (Optional)"}
                </label>
                <input
                  type="text"
                  name="custom_code"
                  maxLength={32}
                  disabled={batchQty > 1}
                  value={batchQty > 1 ? "" : customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder={
                    batchQty > 1
                      ? isKhmer
                        ? "បង្កើតកូដស្វ័យប្រវត្តិសម្រាប់កញ្ចប់"
                        : "Auto-generated for batches"
                      : "e.g. HARVEST2026 (blank = random)"
                  }
                  className="ai-input font-mono text-xs uppercase disabled:opacity-60"
                />
              </div>

              <div className="min-w-0 lg:col-span-2">
                <button type="submit" className="ai-btn-primary h-10 w-full justify-center gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {batchQty > 1
                      ? isKhmer
                        ? `បង្កើត ${batchQty}`
                        : `Mint ${batchQty}`
                      : isKhmer
                        ? "បង្កើតកូដ"
                        : "Mint Code"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </AdminSectionCard>

        {/* Issued Reward Codes Table */}
        <AdminSectionCard
          delayIndex={2}
          noPadding
          title={isKhmer ? "បញ្ជីកូដរង្វាន់ដែលបានបង្កើត" : "Issued Reward Vouchers"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filtered.length} នៃ ${d.codes.length} កូដ`
              : `Showing ${filtered.length} of ${d.codes.length} minted vouchers`
          }
          icon={<Ticket className="h-4 w-4" />}
          action={
            redeemedCount > 0 ? (
              <button
                type="button"
                onClick={() => setPendingBulkAction("clear_redeemed")}
                className="ai-btn-secondary h-8 gap-1.5 px-2.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#fa3b1d]" />
                <span>{isKhmer ? `សម្អាតកូដប្រើរួច (${redeemedCount})` : `Clear Redeemed (${redeemedCount})`}</span>
              </button>
            ) : undefined
          }
        >
          {/* Filter, Search & Contextual Selection Bar */}
          <div className="space-y-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    isKhmer ? "ស្វែងរកកូដ ឬឈ្មោះអ្នកប្រើ..." : "Search voucher code or member..."
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

            {selectedIds.length > 0 && (
              <div className="animate-slide-down flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f48270]/70 bg-[#ffe0db]/75 px-3.5 py-2.5 dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#b81800] dark:text-[#ff9c8c]">
                  <span>
                    {selectedIds.length} {isKhmer ? "កូដត្រូវបានជ្រើសរើស" : "voucher(s) selected"}
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
                  onClick={() => setPendingBulkAction("delete_selected")}
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
                icon={<Ticket className="h-5 w-5" />}
                title={
                  isKhmer
                    ? "មិនមានកូដរង្វាន់ត្រូវនឹងការត្រងទេ"
                    : "No reward vouchers match this filter"
                }
                description={
                  d.codes.length === 0
                    ? isKhmer
                      ? "ប្រើប្រអប់ខាងលើដើម្បីបង្កើតកូដក្រេឌីត AI ដំបូងរបស់អ្នក។"
                      : "Use the generator above to mint your first AI credit voucher."
                    : isKhmer
                      ? "សាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬតម្រងស្ថានភាព។"
                      : "Reset your search or status filter to see all vouchers."
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
                        aria-label="Select all visible vouchers"
                        className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                      />
                    </th>
                    <th className="px-4 py-3">{isKhmer ? "លេខកូដ" : "Voucher Code"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ក្រេឌីតរង្វាន់" : "Credit Reward"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ព័ត៌មានការប្រើ" : "Redemption"}</th>
                    <th className="hidden px-4 py-3 xl:table-cell">{isKhmer ? "បានបង្កើត" : "Created"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filtered.map((c) => (
                    <tr key={c.id} className="ai-table-row">
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleOne(c.id)}
                          aria-label={`Select voucher ${c.code}`}
                          className="h-3.5 w-3.5 rounded accent-[#3874ff]"
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex rounded-md border border-[#adc5ff] bg-[#e5edff] px-2.5 py-1 font-mono font-bold tracking-wider text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                            {c.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c)}
                            aria-label={`Copy voucher code ${c.code}`}
                            title={isKhmer ? "ចម្លងកូដ" : "Copy code"}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e3e6ed] bg-white text-[#525b75] transition hover:border-[#adc5ff] hover:text-[#004dff] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#85a9ff]"
                          >
                            {copiedId === c.id ? (
                              <Check className="h-3.5 w-3.5 text-[#25b003]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 font-mono font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          <Coins className="h-3.5 w-3.5 text-[#3874ff]" />
                          {c.tokensReward.toLocaleString()} credits
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <AdminStatusBadge tone={c.isRedeemed ? "slate" : "emerald"} pulse={!c.isRedeemed}>
                          {c.isRedeemed
                            ? isKhmer
                              ? "បានប្រើរួច"
                              : "Redeemed"
                            : isKhmer
                              ? "អាចប្រើបាន"
                              : "Available"}
                        </AdminStatusBadge>
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        {c.isRedeemed ? (
                          <div>
                            <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {c.redeemedBy ? `@${c.redeemedBy}` : isKhmer ? "បានប្រើ" : "Claimed"}
                            </div>
                            {c.redeemedAt && (
                              <div className="font-mono text-[10.5px] text-[#6e7891] dark:text-[#8a94ad]">
                                {formatAccountTimestamp(c.redeemedAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#8a94ad]">
                            {isKhmer ? "មិនទាន់មានអ្នកប្រើ" : "Unclaimed"}
                          </span>
                        )}
                      </td>

                      <td
                        className="hidden whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad] xl:table-cell"
                        title={c.createdAt || undefined}
                      >
                        {formatAccountTimestamp(c.createdAt)}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setPendingDelete(c)}
                          aria-label={`Delete voucher ${c.code}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#f48270]/60 bg-[#ffe0db]/50 text-[#b81800] transition hover:bg-[#ffe0db] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/10 dark:text-[#ff9c8c] dark:hover:bg-[#fa3b1d]/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSectionCard>
      </div>

      {/* Single Voucher Delete Modal */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-promo-title"
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
              <div>
                <h3
                  id="delete-promo-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការលុបកូដរង្វាន់" : "Delete Reward Code"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      លុបលេខកូដ{" "}
                      <span className="font-mono font-bold text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.code}
                      </span>{" "}
                      ({pendingDelete.tokensReward.toLocaleString()} credits) ឬ?
                    </>
                  ) : (
                    <>
                      Remove voucher{" "}
                      <span className="font-mono font-bold text-[#141824] dark:text-[#eff2f6]">
                        {pendingDelete.code}
                      </span>{" "}
                      ({pendingDelete.tokensReward.toLocaleString()} credits)?
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
                  <span>{isKhmer ? "លុបកូដ" : "Delete"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete / Clear Redeemed Modal */}
      {pendingBulkAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-promo-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingBulkAction(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-xl dark:border-[#2b3245] dark:bg-[#141824] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe0db] text-[#b81800] ring-1 ring-[#fa3b1d]/25 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="bulk-promo-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {pendingBulkAction === "clear_redeemed"
                    ? isKhmer
                      ? `សម្អាតកូដដែលបានប្រើរួច (${redeemedCount}) ឬ?`
                      : `Clear ${redeemedCount} Redeemed Voucher(s)?`
                    : isKhmer
                      ? `លុបកូដដែលបានជ្រើស (${selectedIds.length}) ឬ?`
                      : `Delete ${selectedIds.length} Selected Voucher(s)?`}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer
                    ? "សកម្មភាពនេះនឹងលុបកូដរង្វាន់ដែលបានកំណត់ជាអចិន្ត្រៃយ៍ (ក្រេឌីតដែលអ្នកប្រើបានទទួលរួចមិនប៉ះពាល់ទេ)។"
                    : "This permanently removes the selected voucher records. Previously credited user balances are unaffected."}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setPendingBulkAction(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <form method="POST" action={bulkActionUrl}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value={pendingBulkAction} />
                {pendingBulkAction === "delete_selected" &&
                  selectedIds.map((id) => (
                    <input key={id} type="hidden" name="code_ids" value={String(id)} />
                  ))}
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#fa3b1d] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d92c11]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "បញ្ជាក់ការលុប" : "Confirm Remove"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
