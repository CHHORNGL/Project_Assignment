import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Coins,
  CreditCard,
  Crown,
  DollarSign,
  Loader2,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { requestJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminNoticeBanner,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface CouponRow {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  expiresAt?: string | null;
}

interface TransactionRow {
  id: number;
  userId?: number | null;
  username?: string;
  billNumber?: string;
  billingInterval?: string;
  couponCode?: string;
  amount: number;
  currency: string;
  status: string;
  md5: string;
  createdAt?: string | null;
  paidAt?: string | null;
  checkAction: string;
  approveAction: string;
}

interface PremiumSettingsData {
  formAction: string;
  testBakongUrl: string;
  links?: {
    promoCodesUrl?: string;
  };
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
  txStats?: {
    paidCount: number;
    pendingCount: number;
    totalRevenueUsd: number;
  };
  coupons: CouponRow[];
  transactions: TransactionRow[];
}

type TxFilter = "ALL" | "PAID" | "PENDING" | "OTHER";

function txStatusTone(status: string): AdminTone {
  const s = (status || "").toUpperCase();
  if (s === "PAID") return "emerald";
  if (s === "PENDING") return "amber";
  if (s === "EXPIRED" || s === "CANCELLED" || s === "FAILED") return "rose";
  return "slate";
}

export default function AdminPremiumSettingsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<PremiumSettingsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  // Controlled Pricing Calculator Inputs
  const [basePrice, setBasePrice] = useState(d.pricing.currentPrice || "20.00");
  const [yearlyDisc, setYearlyDisc] = useState(d.pricing.yearlyDiscountPercent || "20");
  const [promoDisc, setPromoDisc] = useState(d.pricing.discountPercent || "0");
  const [dailyTokens, setDailyTokens] = useState(d.pricing.simpleUserDailyTokens || "13000");
  const [bannerText, setBannerText] = useState(d.pricing.discountBanner || "");
  const [couponEnabled, setCouponEnabled] = useState(Boolean(d.pricing.couponEnabled));

  // Bakong Testing State
  const [testingBakong, setTestingBakong] = useState(false);
  const [bakongStatusBanner, setBakongStatusBanner] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Ledger Filtering & Confirmation Modals
  const [txFilter, setTxFilter] = useState<TxFilter>("ALL");
  const [txSearch, setTxSearch] = useState("");
  const [pendingDeleteCoupon, setPendingDeleteCoupon] = useState<CouponRow | null>(null);
  const [pendingApproveTx, setPendingApproveTx] = useState<TransactionRow | null>(null);

  useEffect(() => {
    if (!pendingDeleteCoupon && !pendingApproveTx) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingDeleteCoupon(null);
        setPendingApproveTx(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDeleteCoupon, pendingApproveTx]);

  const computedPricing = useMemo(() => {
    const base = Number.parseFloat(basePrice);
    const pDisc = Number.parseFloat(promoDisc);
    const yDisc = Number.parseFloat(yearlyDisc);
    const safeBase = Number.isFinite(base) ? Math.max(0, base) : 0;
    const safePromo = Number.isFinite(pDisc) ? Math.min(100, Math.max(0, pDisc)) : 0;
    const safeYearly = Number.isFinite(yDisc) ? Math.min(100, Math.max(0, yDisc)) : 0;

    const monthly = Math.max(0, safeBase * (1 - safePromo / 100));
    const yearlyMonthly = Math.max(0, monthly * (1 - safeYearly / 100));
    const yearlyTotal = yearlyMonthly * 12;
    return {
      monthlyStr: monthly.toFixed(2),
      yearlyMonthlyStr: yearlyMonthly.toFixed(2),
      yearlyTotalStr: yearlyTotal.toFixed(2),
      safePromo,
      safeYearly,
    };
  }, [basePrice, promoDisc, yearlyDisc]);

  const txStats = d.txStats ?? {
    paidCount: d.transactions.filter((t) => t.status.toUpperCase() === "PAID").length,
    pendingCount: d.transactions.filter((t) => t.status.toUpperCase() === "PENDING").length,
    totalRevenueUsd: d.transactions
      .filter((t) => t.status.toUpperCase() === "PAID" && t.currency === "USD")
      .reduce((acc, t) => acc + (t.amount || 0), 0),
  };

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return d.transactions.filter((tx) => {
      const s = tx.status.toUpperCase();
      if (txFilter === "PAID" && s !== "PAID") return false;
      if (txFilter === "PENDING" && s !== "PENDING") return false;
      if (txFilter === "OTHER" && (s === "PAID" || s === "PENDING")) return false;
      if (!q) return true;
      return (
        String(tx.id).includes(q) ||
        (tx.billNumber || "").toLowerCase().includes(q) ||
        (tx.username || "").toLowerCase().includes(q) ||
        (tx.couponCode || "").toLowerCase().includes(q) ||
        tx.md5.toLowerCase().includes(q)
      );
    });
  }, [d.transactions, txFilter, txSearch]);

  const txTabs: Array<{ key: TxFilter; label: string; count: number }> = [
    { key: "ALL", label: isKhmer ? "ទាំងអស់" : "All", count: d.transactions.length },
    {
      key: "PAID",
      label: "PAID",
      count: d.transactions.filter((t) => t.status.toUpperCase() === "PAID").length,
    },
    {
      key: "PENDING",
      label: "PENDING",
      count: d.transactions.filter((t) => t.status.toUpperCase() === "PENDING").length,
    },
    {
      key: "OTHER",
      label: isKhmer ? "ផ្សេងទៀត" : "Other",
      count: d.transactions.filter((t) => !["PAID", "PENDING"].includes(t.status.toUpperCase())).length,
    },
  ];

  const handleTestBakong = async () => {
    setTestingBakong(true);
    try {
      const { data: res } = await requestJson<{ success: boolean; message?: string }>(
        d.testBakongUrl,
        "POST",
        bootstrap.csrfToken,
      );
      const msg = res.message || "Bakong KHQR connection verified.";
      setBakongStatusBanner({ ok: Boolean(res.success), message: msg });
      pushToast(res.success ? "success" : "warning", msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bakong connection failed.";
      setBakongStatusBanner({ ok: false, message: msg });
      pushToast("danger", msg);
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
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.links?.promoCodesUrl && (
            <a href={d.links.promoCodesUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <Tag className="h-3.5 w-3.5" />
              <span>{isKhmer ? "កូដរង្វាន់" : "Promo Codes"}</span>
            </a>
          )}
          <AdminStatusBadge tone={d.bakong.tokenConfigured ? "emerald" : "amber"}>
            {d.bakong.tokenConfigured
              ? isKhmer
                ? "បានភ្ជាប់ Token KHQR"
                : "Bakong Token Set"
              : isKhmer
                ? "ខ្វះ Token KHQR"
                : "Token Required"}
          </AdminStatusBadge>
          <button
            type="button"
            onClick={handleTestBakong}
            disabled={testingBakong}
            className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs"
          >
            {testingBakong ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{isKhmer ? "តេស្ត KHQR" : "Test KHQR"}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Billing & Settlement KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "តម្លៃប្រចាំខែបច្ចុប្បន្ន" : "Effective Monthly"}
            value={`$${computedPricing.monthlyStr}`}
            hint={
              computedPricing.safePromo > 0
                ? `${isKhmer ? "មូលដ្ឋាន" : "Base"} $${basePrice} · ${computedPricing.safePromo}% ${isKhmer ? "បញ្ចុះតម្លៃ" : "promo"}`
                : isKhmer
                  ? "អត្រាគិតថ្លៃប្រចាំខែស្តង់ដារ"
                  : "Standard monthly checkout rate"
            }
            tone="indigo"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "គម្រោងប្រចាំឆ្នាំ" : "Annual Billing Plan"}
            value={`$${computedPricing.yearlyTotalStr}/yr`}
            hint={`$${computedPricing.yearlyMonthlyStr}/mo · ${computedPricing.safeYearly}% ${isKhmer ? "ចំណេញ" : "annual savings"}`}
            tone="sky"
            icon={<CreditCard className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "សមាជិក Pro" : "Pro Subscribers"}
            value={d.pricing.premiumCount.toLocaleString()}
            hint={isKhmer ? "គណនីគម្រោង Pro កំពុងសកម្ម" : "Active VIP subscription accounts"}
            tone="amber"
            icon={<Crown className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "ចំណូល KHQR (USD)" : "KHQR Settlement"}
            value={`$${txStats.totalRevenueUsd.toFixed(2)}`}
            hint={
              isKhmer
                ? `${txStats.paidCount} បានបង់ · ${txStats.pendingCount} កំពុងរង់ចាំ`
                : `${txStats.paidCount} settled · ${txStats.pendingCount} pending check`
            }
            tone={txStats.pendingCount > 0 ? "amber" : "emerald"}
            icon={<Receipt className="h-5 w-5" />}
          />
        </div>

        {/* Inline Bakong Connection Verification Result */}
        {bakongStatusBanner && (
          <AdminNoticeBanner
            tone={bakongStatusBanner.ok ? "emerald" : "rose"}
            message={bakongStatusBanner.message}
            onDismiss={() => setBakongStatusBanner(null)}
          />
        )}

        {/* Row 1: Pricing/Quotas + Bakong NBC KHQR Config */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Pricing & AI Quotas Card */}
          <div className="min-w-0 lg:col-span-6">
            <AdminSectionCard
              delayIndex={1}
              title={isKhmer ? "តម្លៃគម្រោង និងកូតា AI" : "Subscription Pricing & AI Quotas"}
              subtitle={
                isKhmer
                  ? "កំណត់តម្លៃគម្រោង Pro ការបញ្ចុះតម្លៃ និងកូតាប្រចាំថ្ងៃសម្រាប់អ្នកប្រើធម្មតា"
                  : "Configure Pro billing rates, promotional discounts, and free-tier token limits"
              }
              icon={<CreditCard className="h-4 w-4" />}
            >
              <form method="POST" action={d.formAction} className="space-y-4">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value="save_pricing" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "តម្លៃប្រចាំខែមូលដ្ឋាន ($)" : "Base Monthly Price ($)"}
                    </label>
                    <input
                      type="text"
                      name="premium_price"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="ai-input font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "ការបញ្ចុះតម្លៃប្រចាំឆ្នាំ (%)" : "Yearly Billing Discount (%)"}
                    </label>
                    <input
                      type="text"
                      name="yearly_discount_percent"
                      value={yearlyDisc}
                      onChange={(e) => setYearlyDisc(e.target.value)}
                      className="ai-input font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "បញ្ចុះតម្លៃផ្សព្វផ្សាយ (%)" : "Sitewide Promo Discount (%)"}
                    </label>
                    <input
                      type="text"
                      name="discount_percent"
                      value={promoDisc}
                      onChange={(e) => setPromoDisc(e.target.value)}
                      className="ai-input font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "ក្រេឌីតប្រចាំថ្ងៃ (គណនីឥតគិតថ្លៃ)" : "Free Tier Daily AI Tokens"}
                    </label>
                    <div className="relative">
                      <Coins className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                      <input
                        type="text"
                        name="simple_user_daily_tokens"
                        value={dailyTokens}
                        onChange={(e) => setDailyTokens(e.target.value)}
                        className="ai-input pl-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "សារជូនដំណឹងបញ្ចុះតម្លៃ" : "Checkout Promo Banner"}
                    </label>
                    <input
                      type="text"
                      name="discount_banner"
                      value={bannerText}
                      onChange={(e) => setBannerText(e.target.value)}
                      placeholder="e.g. Planting season offer — save 20% on annual Pro!"
                      className="ai-input text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#cbd0dd] bg-[#f5f7fa]/80 px-3.5 py-2.5 text-xs transition hover:border-[#adc5ff] dark:border-[#373e53] dark:bg-[#0f111a]">
                      <div>
                        <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                          {isKhmer ? "អនុញ្ញាតកូដបញ្ចុះតម្លៃពេលទូទាត់" : "Enable Coupon Codes at Checkout"}
                        </div>
                        <div className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          {isKhmer
                            ? "អនុញ្ញាតឱ្យកសិករបញ្ចូលលេខកូដបញ្ចុះតម្លៃមុនពេលបង្កើត KHQR។"
                            : "Allow promotional voucher entry before generating KHQR invoices."}
                        </div>
                      </div>

                      <span className="relative inline-flex shrink-0 items-center">
                        <input
                          type="checkbox"
                          name="coupon_enabled"
                          checked={couponEnabled}
                          onChange={(e) => setCouponEnabled(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#3874ff]/45",
                            couponEnabled ? "bg-[#3874ff]" : "bg-[#cbd0dd] dark:bg-[#373e53]",
                          )}
                        >
                          <span
                            className={cn(
                              "h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-150",
                              couponEnabled ? "translate-x-4" : "translate-x-0",
                            )}
                          />
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Live Checkout Rate Preview Strip */}
                <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[#adc5ff]/70 bg-[#e5edff]/45 p-3 text-xs dark:border-[#3874ff]/35 dark:bg-[#3874ff]/10">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#004dff] dark:text-[#85a9ff]">
                      {isKhmer ? "តម្លៃប្រចាំខែក្រោយគណនា" : "Preview Monthly"}
                    </div>
                    <div className="mt-0.5 font-display text-base font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      ${computedPricing.monthlyStr}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#004dff] dark:text-[#85a9ff]">
                      {isKhmer ? "តម្លៃប្រចាំឆ្នាំក្រោយគណនា" : "Preview Yearly"}
                    </div>
                    <div className="mt-0.5 font-display text-base font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      ${computedPricing.yearlyTotalStr}
                      <span className="ml-1 text-[11px] font-medium text-[#525b75] dark:text-[#9fa6bc]">
                        (${computedPricing.yearlyMonthlyStr}/mo)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                  <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-5 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "រក្សាទុកតម្លៃ និងកូតា" : "Save Pricing & Quotas"}</span>
                  </button>
                </div>
              </form>
            </AdminSectionCard>
          </div>

          {/* Bakong NBC KHQR Config Card */}
          <div className="min-w-0 lg:col-span-6">
            <AdminSectionCard
              delayIndex={2}
              title={isKhmer ? "ការកំណត់ Bakong NBC KHQR" : "Bakong NBC KHQR Gateway"}
              subtitle={
                isKhmer
                  ? "គណនីទទួលប្រាក់ និងសោ JWT API សម្រាប់ផ្ទៀងផ្ទាត់ KHQR ស្វ័យប្រវត្តិ"
                  : "Merchant settlement credentials and NBC OpenAPI verification token"
              }
              icon={<QrCode className="h-4 w-4" />}
              action={
                <button
                  type="button"
                  onClick={handleTestBakong}
                  disabled={testingBakong}
                  className="ai-btn-secondary h-8 gap-1.5 px-2.5 text-xs"
                >
                  {testingBakong ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>{isKhmer ? "ផ្ទៀងផ្ទាត់" : "Verify Live"}</span>
                </button>
              }
            >
              <form method="POST" action={d.formAction} className="space-y-4">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value="save_bakong" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                        {isKhmer ? "Bakong API JWT Token" : "Bakong API JWT Token"}
                      </label>
                      {d.bakong.tokenConfigured && (
                        <span className="rounded bg-[#d9fbd0] px-1.5 py-0.5 text-[10px] font-bold text-[#1c6c09] dark:bg-[#25b003]/15 dark:text-[#90ee7a]">
                          {isKhmer ? "បានកំណត់រួច" : "Configured"}
                        </span>
                      )}
                    </div>
                    <PasswordInput
                      name="bakong_token"
                      placeholder={
                        d.bakong.tokenConfigured
                          ? isKhmer
                            ? "ទុកទទេដើម្បីរក្សា Token បច្ចុប្បន្ន..."
                            : "Leave blank to retain current JWT token..."
                          : "Paste Bakong OpenAPI JWT token..."
                      }
                      className="py-2 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "គណនី Bakong ID" : "Bakong Account ID"}
                    </label>
                    <input
                      type="text"
                      name="bakong_account_id"
                      defaultValue={d.bakong.accountId}
                      placeholder="merchant@bkrt"
                      className="ai-input font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "ឈ្មោះអាជីវករ (Merchant)" : "Merchant Name"}
                    </label>
                    <input
                      type="text"
                      name="bakong_merchant_name"
                      defaultValue={d.bakong.merchantName}
                      className="ai-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "ទីក្រុង (Merchant City)" : "Merchant City"}
                    </label>
                    <input
                      type="text"
                      name="bakong_merchant_city"
                      defaultValue={d.bakong.merchantCity}
                      placeholder="Phnom Penh"
                      className="ai-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "រូបិយប័ណ្ណ" : "Settlement Currency"}
                    </label>
                    <select
                      name="bakong_currency"
                      defaultValue={d.bakong.currency || "USD"}
                      className="ai-input text-xs"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="KHR">KHR (៛)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "ស្លាកហាង (Store Label)" : "Store Terminal Label"}
                    </label>
                    <input
                      type="text"
                      name="bakong_store_label"
                      defaultValue={d.bakong.storeLabel}
                      placeholder="AgriSystem Pro"
                      className="ai-input text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
                  <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-5 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "រក្សាទុក Bakong" : "Save Bakong Config"}</span>
                  </button>
                </div>
              </form>
            </AdminSectionCard>
          </div>
        </div>

        {/* Row 2: Promotional Coupons Manager */}
        <AdminSectionCard
          delayIndex={3}
          noPadding
          title={isKhmer ? "ប័ណ្ណបញ្ចុះតម្លៃ (Discount Coupons)" : "Promotional Discount Coupons"}
          subtitle={
            isKhmer
              ? `បង្កើត និងគ្រប់គ្រងលេខកូដបញ្ចុះតម្លៃ (${d.coupons.length} កូដ)`
              : `Create time-bound vouchers and monitor checkout redemptions (${d.coupons.length} codes)`
          }
          icon={<Tag className="h-4 w-4" />}
        >
          {/* Labeled Create Coupon Form Bar */}
          <div className="border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <form method="POST" action={d.formAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="action" value="create_coupon" />

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "លេខកូដ *" : "Coupon Code *"}
                </label>
                <input
                  type="text"
                  name="code"
                  required
                  placeholder="HARVEST20"
                  className="ai-input h-9 font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ប្រភេទ" : "Type"}
                </label>
                <select name="discount_type" className="ai-input h-9 py-1 text-xs">
                  <option value="percent">{isKhmer ? "ភាគរយ (%)" : "Percent (%)"}</option>
                  <option value="fixed">{isKhmer ? "ទឹកប្រាក់ ($)" : "Fixed ($)"}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "តម្លៃបញ្ចុះ" : "Discount Value"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="discount_value"
                  defaultValue="10"
                  className="ai-input h-9 font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ចំនួនប្រើអតិបរមា" : "Max Uses"}
                </label>
                <input
                  type="number"
                  min="1"
                  name="max_uses"
                  defaultValue="100"
                  className="ai-input h-9 font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ថ្ងៃផុតកំណត់" : "Expires On"}
                </label>
                <input type="date" name="expires_at" className="ai-input h-9 font-mono text-xs" />
              </div>

              <button type="submit" className="ai-btn-primary h-9 justify-center gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                <span>{isKhmer ? "បង្កើតកូដ" : "Add Coupon"}</span>
              </button>
            </form>
          </div>

          {d.coupons.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Tag className="h-5 w-5" />}
                title={isKhmer ? "មិនទាន់មានកូដបញ្ចុះតម្លៃទេ" : "No discount coupons configured"}
                description={
                  isKhmer
                    ? "បង្កើតកូដខាងលើដើម្បីផ្តល់ការបញ្ចុះតម្លៃនៅពេលទូទាត់ KHQR។"
                    : "Create a voucher code above to enable promo redemptions at checkout."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="px-5 py-3">{isKhmer ? "លេខកូដ" : "Code"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ការបញ្ចុះតម្លៃ" : "Discount"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ការប្រើប្រាស់" : "Redemptions"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ផុតកំណត់" : "Expiration"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {d.coupons.map((cp) => (
                    <tr key={cp.id} className="ai-table-row">
                      <td className="px-5 py-3.5">
                        <span className="rounded-md border border-[#cbd0dd] bg-[#f5f7fa] px-2 py-0.5 font-mono font-bold text-[#141824] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#eff2f6]">
                          {cp.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#141824] dark:text-[#eff2f6]">
                        {cp.discountType === "percent"
                          ? `${cp.discountValue}% off`
                          : `$${cp.discountValue.toFixed(2)} off`}
                      </td>
                      <td className="min-w-[150px] px-4 py-3.5">
                        <AdminProgressBar
                          value={cp.currentUses}
                          max={Math.max(cp.maxUses, 1)}
                          tone="indigo"
                          height="sm"
                          valueLabel={`${cp.currentUses} / ${cp.maxUses}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        {cp.expiresAt ? formatAccountTimestamp(cp.expiresAt) : isKhmer ? "គ្មានកំណត់" : "No expiry"}
                      </td>
                      <td className="px-4 py-3.5">
                        <AdminStatusBadge tone={cp.isActive ? "emerald" : "slate"} pulse={cp.isActive}>
                          {cp.isActive ? (isKhmer ? "សកម្ម" : "Active") : isKhmer ? "ផ្អាក" : "Paused"}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <form method="POST" action={d.formAction}>
                            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                            <input type="hidden" name="action" value="toggle_coupon" />
                            <input type="hidden" name="coupon_id" value={String(cp.id)} />
                            <button type="submit" className="ai-btn-secondary h-8 px-2.5 text-[11px]">
                              {cp.isActive ? (isKhmer ? "ផ្អាក" : "Pause") : isKhmer ? "បើក" : "Activate"}
                            </button>
                          </form>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteCoupon(cp)}
                            aria-label={`Delete coupon ${cp.code}`}
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

        {/* Row 3: KHQR Payment Ledger */}
        <AdminSectionCard
          delayIndex={4}
          noPadding
          title={isKhmer ? "កំណត់ត្រាការទូទាត់ Bakong KHQR" : "KHQR Payment Settlement Ledger"}
          subtitle={
            isKhmer
              ? `បង្ហាញ ${filteredTransactions.length} នៃ ${d.transactions.length} ប្រតិបត្តិការថ្មីៗ`
              : `Showing ${filteredTransactions.length} of ${d.transactions.length} recent KHQR transactions`
          }
          icon={<Receipt className="h-4 w-4" />}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder={
                  isKhmer
                    ? "ស្វែងរកវិក្កយបត្រ ឈ្មោះអ្នកប្រើ ឬ MD5..."
                    : "Search bill #, member, coupon, or MD5..."
                }
                className="ai-input h-9 py-1 pl-9 pr-8 text-xs"
              />
              {txSearch && (
                <button
                  type="button"
                  onClick={() => setTxSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
              {txTabs.map((tab) => {
                const active = txFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTxFilter(tab.key)}
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

          {filteredTransactions.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Receipt className="h-5 w-5" />}
                title={isKhmer ? "មិនមានប្រតិបត្តិការ KHQR ទេ" : "No KHQR transactions recorded"}
                description={
                  d.transactions.length === 0
                    ? isKhmer
                      ? "ប្រតិបត្តិការទូទាត់គម្រោង Pro ដោយ Bakong KHQR នឹងបង្ហាញនៅទីនេះ។"
                      : "Farmer Pro upgrade invoices generated via Bakong KHQR will appear here."
                    : isKhmer
                      ? "សាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬតម្រងស្ថានភាព។"
                      : "Try clearing your search or status filter."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="px-5 py-3">{isKhmer ? "វិក្កយបត្រ និងអ្នកប្រើ" : "Invoice & Member"}</th>
                    <th className="px-4 py-3">{isKhmer ? "គម្រោង" : "Billing"}</th>
                    <th className="px-4 py-3 text-right">{isKhmer ? "ទឹកប្រាក់" : "Amount"}</th>
                    <th className="px-4 py-3">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                    <th className="px-4 py-3">MD5</th>
                    <th className="px-4 py-3">{isKhmer ? "ពេលវេលា" : "Timestamp"}</th>
                    <th className="px-5 py-3 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="ai-table-row">
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-semibold text-[#141824] dark:text-[#eff2f6]">
                          {tx.billNumber || `#${tx.id}`}
                        </div>
                        <div className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          {tx.username ? `@${tx.username}` : tx.userId ? `User #${tx.userId}` : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="capitalize font-medium text-[#31374a] dark:text-[#cbd0dd]">
                            {tx.billingInterval || "monthly"}
                          </span>
                          {tx.couponCode && (
                            <span className="rounded bg-[#e5edff] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                              {tx.couponCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                        {tx.amount.toFixed(2)} {tx.currency}
                      </td>
                      <td className="px-4 py-3.5">
                        <AdminStatusBadge
                          tone={txStatusTone(tx.status)}
                          pulse={tx.status.toUpperCase() === "PENDING"}
                        >
                          {tx.status}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        {tx.md5 ? `${tx.md5.slice(0, 12)}…` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        {formatAccountTimestamp(tx.paidAt || tx.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <form method="POST" action={tx.checkAction}>
                            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                            <button type="submit" className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]">
                              <RefreshCw className="h-3 w-3" />
                              <span>{isKhmer ? "ផ្ទៀងផ្ទាត់ NBC" : "Verify NBC"}</span>
                            </button>
                          </form>
                          {tx.status.toUpperCase() !== "PAID" && (
                            <button
                              type="button"
                              onClick={() => setPendingApproveTx(tx)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#25b003] px-2.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-[#1e9302]"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{isKhmer ? "អនុម័ត" : "Approve"}</span>
                            </button>
                          )}
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

      {/* Delete Coupon Confirmation Modal */}
      {pendingDeleteCoupon && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-coupon-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingDeleteCoupon(null)}
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
                  id="delete-coupon-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការលុបកូដបញ្ចុះតម្លៃ" : "Delete Discount Coupon"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      លុបលេខកូដ{" "}
                      <span className="font-mono font-bold text-[#141824] dark:text-[#eff2f6]">
                        {pendingDeleteCoupon.code}
                      </span>{" "}
                      ចេញពីប្រព័ន្ធឬ? អ្នកប្រើប្រាស់នឹងមិនអាចប្រើលេខកូដនេះទៀតទេ។
                    </>
                  ) : (
                    <>
                      Remove voucher{" "}
                      <span className="font-mono font-bold text-[#141824] dark:text-[#eff2f6]">
                        {pendingDeleteCoupon.code}
                      </span>
                      ? It will immediately stop working at checkout.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setPendingDeleteCoupon(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <form method="POST" action={d.formAction}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="action" value="delete_coupon" />
                <input type="hidden" name="coupon_id" value={String(pendingDeleteCoupon.id)} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#fa3b1d] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d92c11]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "លុបកូដ" : "Delete Coupon"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Approval Confirmation Modal */}
      {pendingApproveTx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-tx-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingApproveTx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-xl dark:border-[#2b3245] dark:bg-[#141824] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d9fbd0] text-[#1c6c09] ring-1 ring-[#25b003]/25 dark:bg-[#25b003]/15 dark:text-[#90ee7a]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="approve-tx-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "បញ្ជាក់ការអនុម័តការទូទាត់" : "Confirm Manual Payment Approval"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? (
                    <>
                      សម្គាល់វិក្កយបត្រ{" "}
                      <span className="font-mono font-bold text-[#141824] dark:text-[#eff2f6]">
                        {pendingApproveTx.billNumber || `#${pendingApproveTx.id}`}
                      </span>{" "}
                      ({pendingApproveTx.amount.toFixed(2)} {pendingApproveTx.currency}) ជា{" "}
                      <strong>PAID</strong> ហើយដំឡើងគណនីទៅ Pro VIP ឬ?
                    </>
                  ) : (
                    <>
                      Mark{" "}
                      <span className="font-mono font-bold text-[#141824] dark:text-[#eff2f6]">
                        {pendingApproveTx.billNumber || `#${pendingApproveTx.id}`}
                      </span>{" "}
                      ({pendingApproveTx.amount.toFixed(2)} {pendingApproveTx.currency}) as{" "}
                      <strong>PAID</strong> and activate the member&apos;s Pro subscription?
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setPendingApproveTx(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <form method="POST" action={pendingApproveTx.approveAction}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25b003] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1e9302]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "អនុម័តការទូទាត់" : "Confirm & Activate Pro"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
