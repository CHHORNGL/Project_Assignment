import React, { useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Crown,
  DollarSign,
  Loader2,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Tag,
  Trash2,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { requestJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface PremiumSettingsData {
  formAction: string;
  testBakongUrl: string;
  pricing: {
    currentPrice: string;
    yearlyDiscountPercent: string;
    yearlyFinalMonthlyRate: string;
    yearlyTotalAmount: string;
    discountPercent: string;
    discountBanner: string;
    couponEnabled: boolean;
    simpleUserDailyTokens: string;
    finalPrice: string;
    premiumCount: number;
  };
  bakong: {
    accountId: string;
    merchantName: string;
    merchantCity: string;
    currency: string;
    storeLabel: string;
    tokenConfigured: boolean;
  };
  coupons: Array<{
    id: number;
    code: string;
    discountType: string;
    discountValue: number;
    maxUses: number;
    currentUses: number;
    isActive: boolean;
    expiresAt?: string | null;
  }>;
  transactions: Array<{
    id: number;
    userId?: number | null;
    amount: number;
    currency: string;
    status: string;
    md5: string;
    createdAt?: string | null;
    checkAction: string;
    approveAction: string;
  }>;
}

export default function AdminPremiumSettingsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<PremiumSettingsData>;
}) {
  const d = bootstrap.data;
  const { pushToast } = useToast();
  const [testingBakong, setTestingBakong] = useState(false);

  const handleTestBakong = async () => {
    setTestingBakong(true);
    try {
      const { data: res } = await requestJson<{ success: boolean; message?: string }>(
        d.testBakongUrl,
        "POST",
        bootstrap.csrfToken,
      );
      pushToast(res.success ? "success" : "warning", res.message || "Bakong tested.");
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Bakong connection failed.");
    } finally {
      setTestingBakong(false);
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminKpiCard
            delayIndex={0}
            label="Effective Monthly Rate"
            value={`$${d.pricing.finalPrice}`}
            tone="indigo"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label="Effective Yearly Rate"
            value={`$${d.pricing.yearlyTotalAmount}/yr`}
            hint={`$${d.pricing.yearlyFinalMonthlyRate}/mo effective`}
            tone="sky"
            icon={<CreditCard className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label="Pro Subscribers"
            value={d.pricing.premiumCount.toLocaleString()}
            tone="amber"
            icon={<Crown className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminSectionCard
            delayIndex={3}
            title="Pricing & Daily AI Quotas"
            subtitle="Configure Pro subscription rates and daily token allowances"
            icon={<CreditCard className="h-4 w-4" />}
          >
            <form method="POST" action={d.formAction} className="space-y-4">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="action" value="save_pricing" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Base Monthly Price ($)</label>
                  <input type="text" name="premium_price" defaultValue={d.pricing.currentPrice} className="ai-input text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Yearly Discount (%)</label>
                  <input type="text" name="yearly_discount_percent" defaultValue={d.pricing.yearlyDiscountPercent} className="ai-input text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Promo Discount (%)</label>
                  <input type="text" name="discount_percent" defaultValue={d.pricing.discountPercent} className="ai-input text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Free User Daily Tokens</label>
                  <input type="text" name="simple_user_daily_tokens" defaultValue={d.pricing.simpleUserDailyTokens} className="ai-input text-xs" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold">Promo Banner Text</label>
                  <input type="text" name="discount_banner" defaultValue={d.pricing.discountBanner} className="ai-input text-xs" />
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold dark:border-slate-800 dark:bg-obsidian-950/60 sm:col-span-2">
                  <input type="checkbox" name="coupon_enabled" defaultChecked={d.pricing.couponEnabled} />
                  Enable Coupon Codes at Checkout
                </label>
              </div>
              <button type="submit" className="ai-btn-primary text-xs">
                Save Pricing & Quotas
              </button>
            </form>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={4}
            title="Bakong NBC KHQR"
            subtitle="Merchant settlement credentials & live verification"
            icon={<QrCode className="h-4 w-4" />}
            action={
              <div className="flex items-center gap-2">
                {d.bakong.tokenConfigured && (
                  <AdminStatusBadge tone="emerald">Token Set</AdminStatusBadge>
                )}
                <button
                  type="button"
                  onClick={handleTestBakong}
                  disabled={testingBakong}
                  className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                >
                  {testingBakong ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Test KHQR
                </button>
              </div>
            }
          >
            <form method="POST" action={d.formAction} className="space-y-4">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="action" value="save_bakong" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold">
                    Bakong API Token {d.bakong.tokenConfigured ? "(Configured — leave blank to keep)" : ""}
                  </label>
                  <input type="password" name="bakong_token" placeholder="Paste JWT token..." className="ai-input text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Bakong Account ID</label>
                  <input type="text" name="bakong_account_id" defaultValue={d.bakong.accountId} placeholder="user@bank" className="ai-input text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Merchant Name</label>
                  <input type="text" name="bakong_merchant_name" defaultValue={d.bakong.merchantName} className="ai-input text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">City</label>
                  <input type="text" name="bakong_merchant_city" defaultValue={d.bakong.merchantCity} className="ai-input text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Currency</label>
                  <select name="bakong_currency" defaultValue={d.bakong.currency || "USD"} className="ai-input text-xs">
                    <option value="USD">USD</option>
                    <option value="KHR">KHR</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold">Store Label</label>
                  <input type="text" name="bakong_store_label" defaultValue={d.bakong.storeLabel} className="ai-input text-xs" />
                </div>
              </div>
              <button type="submit" className="ai-btn-primary text-xs">
                Save Bakong Config
              </button>
            </form>
          </AdminSectionCard>
        </div>

        <AdminSectionCard
          delayIndex={5}
          title="Discount Coupons"
          subtitle="Create promotional voucher codes and track redemptions"
          icon={<Tag className="h-4 w-4" />}
        >
          <div className="space-y-4">
            <form method="POST" action={d.formAction} className="grid items-end gap-3 sm:grid-cols-5">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="action" value="create_coupon" />
              <input type="text" name="code" required placeholder="CODE20" className="ai-input text-xs uppercase font-mono" />
              <select name="discount_type" className="ai-input text-xs">
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
              <input type="number" step="0.01" name="discount_value" defaultValue="10" className="ai-input text-xs" />
              <input type="number" name="max_uses" defaultValue="100" className="ai-input text-xs" />
              <button type="submit" className="ai-btn-primary h-10 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Coupon
              </button>
            </form>

            {d.coupons.length === 0 ? (
              <AdminEmptyState icon={<Tag className="h-5 w-5" />} title="No coupons configured" />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800/80">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-obsidian-950/60">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Code</th>
                      <th className="px-4 py-2.5 font-semibold">Discount</th>
                      <th className="px-4 py-2.5 font-semibold">Usage</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {d.coupons.map((cp) => (
                      <tr key={cp.id} className="ai-table-row">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{cp.code}</td>
                        <td className="px-4 py-3">
                          {cp.discountType === "percent" ? `${cp.discountValue}%` : `$${cp.discountValue}`}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {cp.currentUses} / {cp.maxUses}
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusBadge tone={cp.isActive ? "emerald" : "slate"} pulse={cp.isActive}>
                            {cp.isActive ? "Active" : "Paused"}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <form method="POST" action={d.formAction}>
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <input type="hidden" name="action" value="toggle_coupon" />
                              <input type="hidden" name="coupon_id" value={String(cp.id)} />
                              <button type="submit" className="ai-btn-secondary h-7 px-2.5 text-[11px]">
                                {cp.isActive ? "Pause" : "Activate"}
                              </button>
                            </form>
                            <form method="POST" action={d.formAction}>
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <input type="hidden" name="action" value="delete_coupon" />
                              <input type="hidden" name="coupon_id" value={String(cp.id)} />
                              <button type="submit" className="ai-btn-secondary h-7 px-2 text-[11px] text-rose-600 dark:text-rose-400">
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
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={6}
          noPadding
          title="Recent KHQR Payment Transactions"
          subtitle="Verify NBC settlement status or manually approve pending transactions"
          icon={<Receipt className="h-4 w-4" />}
        >
          {d.transactions.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState icon={<Receipt className="h-5 w-5" />} title="No KHQR transactions recorded yet" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-obsidian-950/60">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">ID</th>
                    <th className="px-4 py-2.5 font-semibold">Amount</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">MD5</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {d.transactions.map((tx) => {
                    const tone =
                      tx.status === "PAID" ? "emerald" : tx.status === "PENDING" ? "amber" : "slate";
                    return (
                      <tr key={tx.id} className="ai-table-row">
                        <td className="px-5 py-3 font-mono font-semibold">#{tx.id}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums">
                          {tx.amount} {tx.currency}
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusBadge tone={tone} pulse={tx.status === "PENDING"}>
                            {tx.status}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {tx.md5.slice(0, 12)}...
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <form method="POST" action={tx.checkAction}>
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <button type="submit" className="ai-btn-secondary h-7 px-2.5 text-[11px]">
                                Verify NBC
                              </button>
                            </form>
                            {tx.status !== "PAID" && (
                              <form method="POST" action={tx.approveAction}>
                                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                                <button
                                  type="submit"
                                  className="inline-flex h-7 items-center gap-1 rounded-xl bg-emerald-600 px-2.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Approve
                                </button>
                              </form>
                            )}
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
    </WorkspaceShell>
  );
}
