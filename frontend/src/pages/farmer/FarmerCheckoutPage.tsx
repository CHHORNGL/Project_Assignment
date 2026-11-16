import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import { postJson, requestJson } from "@/lib/api";
import { cn } from "@/lib/utils";

const KHQR_DEFAULT_EXPIRY_SECONDS = 180;

interface BakongInfo {
  md5?: string;
  qr_image?: string;
  qr_string?: string;
  bill_number?: string;
  deeplink?: string;
  amount?: number | string;
  currency?: string;
  expires_in_seconds?: number;
  remaining_seconds?: number;
  expires_at?: string;
}

interface CheckoutData {
  submitUrl: string;
  generateQrUrl: string;
  checkStatusPrefix: string;
  validateCouponUrl: string;
  upgradeUrl: string;
  paypalClientId: string;
  bakongConfigured: boolean;
  bakongMerchantName: string;
  initialBakong: BakongInfo | null;
  premiumPrice: string;
  originalPrice: string;
  discountPercent: number;
  yearlyDiscountPercent: number;
  savings: number;
  couponEnabled: boolean;
  billingInterval: string;
  isYearly: boolean;
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = String(Math.floor(clamped / 60)).padStart(2, "0");
  const secs = String(clamped % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function FarmerCheckoutPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<CheckoutData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [billing, setBilling] = useState<"monthly" | "yearly">(
    d.isYearly ? "yearly" : "monthly",
  );
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [finalPrice, setFinalPrice] = useState(d.premiumPrice);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [bakong, setBakong] = useState<BakongInfo | null>(d.initialBakong);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paidMessage, setPaidMessage] = useState("");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [expiredOnServer, setExpiredOnServer] = useState(false);

  const totalExpirySeconds = Math.max(
    1,
    Number(bakong?.expires_in_seconds || KHQR_DEFAULT_EXPIRY_SECONDS),
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!d.initialBakong?.md5) return 0;
    if (typeof d.initialBakong.remaining_seconds === "number") {
      return Math.max(0, d.initialBakong.remaining_seconds);
    }
    return KHQR_DEFAULT_EXPIRY_SECONDS;
  });

  const [copiedBill, setCopiedBill] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const deadlineMsRef = useRef<number>(0);
  const checkingRef = useRef(false);
  const expiredSyncMd5Ref = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Reset the local countdown deadline whenever a new QR session arrives.
  useEffect(() => {
    if (!bakong?.md5) {
      deadlineMsRef.current = 0;
      setRemainingSeconds(0);
      setExpiredOnServer(false);
      return undefined;
    }

    const initialLeft =
      typeof bakong.remaining_seconds === "number"
        ? Math.max(0, bakong.remaining_seconds)
        : Number(bakong.expires_in_seconds || KHQR_DEFAULT_EXPIRY_SECONDS);
    deadlineMsRef.current = Date.now() + initialLeft * 1000;
    setRemainingSeconds(initialLeft);
    setExpiredOnServer(initialLeft <= 0);
    setStatusNotice(null);

    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineMsRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [bakong?.md5, bakong?.bill_number, bakong?.remaining_seconds, bakong?.expires_in_seconds]);

  const isExpired = Boolean(bakong?.md5) && (expiredOnServer || remainingSeconds <= 0);

  const pricing = useMemo(() => {
    const origNum = Math.max(0, Number(d.originalPrice || 20));
    const origMonthly = d.isYearly ? origNum / 12 : origNum;
    const baseMonthly = Math.max(0, origMonthly - Number(d.savings || 0));
    const yearlyDiscountPct = Math.max(0, Number(d.yearlyDiscountPercent || 0));

    const yearlyBase =
      Math.round(baseMonthly * (1 - yearlyDiscountPct / 100) * 12 * 100) / 100;
    const standardSelected = billing === "yearly" ? origMonthly * 12 : origMonthly;
    const planSubtotal = billing === "yearly" ? yearlyBase : baseMonthly;
    const dueNum = Number(finalPrice || planSubtotal);
    const couponSavings = Math.max(0, planSubtotal - dueNum);
    const totalSaved = Math.max(0, standardSelected - dueNum);

    return {
      standardSelected,
      planSubtotal,
      dueNum,
      couponSavings,
      totalSaved,
      yearlyDiscountPct,
    };
  }, [billing, d.isYearly, d.originalPrice, d.savings, d.yearlyDiscountPercent, finalPrice]);

  const refreshQr = useCallback(
    async (nextBilling: "monthly" | "yearly", code: string) => {
      setGeneratingQr(true);
      setStatusNotice(null);
      try {
        const res = await postJson<BakongInfo>(
          d.generateQrUrl,
          { billing_interval: nextBilling, coupon_code: code },
          bootstrap.csrfToken,
        );
        if (res.ok) {
          setBakong(res.data);
          setExpiredOnServer(false);
          if (res.data?.amount !== undefined && res.data?.amount !== null) {
            const amt = Number(res.data.amount);
            if (Number.isFinite(amt)) {
              setFinalPrice(amt.toFixed(2));
            }
          }
        }
      } finally {
        setGeneratingQr(false);
      }
    },
    [bootstrap.csrfToken, d.generateQrUrl],
  );

  const handleBillingChange = async (nextBilling: "monthly" | "yearly") => {
    if (nextBilling === billing) return;
    setBilling(nextBilling);

    const origNum = Math.max(0, Number(d.originalPrice || 20));
    const origMonthly = d.isYearly ? origNum / 12 : origNum;
    const baseMonthly = Math.max(0, origMonthly - Number(d.savings || 0));
    const yearlyPct = Math.max(0, Number(d.yearlyDiscountPercent || 0));
    const nextBase =
      nextBilling === "yearly"
        ? Math.round(baseMonthly * (1 - yearlyPct / 100) * 12 * 100) / 100
        : baseMonthly;
    setFinalPrice(nextBase.toFixed(2));

    if (appliedCoupon) {
      setValidatingCoupon(true);
      try {
        const res = await postJson<{
          success?: boolean;
          code?: string;
          final_price?: string;
        }>(
          d.validateCouponUrl,
          { code: appliedCoupon, billing_interval: nextBilling },
          bootstrap.csrfToken,
        );
        if (res.ok && res.data.success && res.data.final_price) {
          setFinalPrice(res.data.final_price);
          await refreshQr(nextBilling, res.data.code || appliedCoupon);
          return;
        }
        setAppliedCoupon("");
      } finally {
        setValidatingCoupon(false);
      }
    }

    await refreshQr(nextBilling, "");
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || validatingCoupon) return;
    setValidatingCoupon(true);
    try {
      const res = await postJson<{
        success?: boolean;
        code?: string;
        final_price?: string;
        message?: string;
      }>(
        d.validateCouponUrl,
        { code: couponCode.trim(), billing_interval: billing },
        bootstrap.csrfToken,
      );
      if (res.ok && res.data.success && res.data.final_price) {
        const cleanCode = res.data.code || couponCode.trim().toUpperCase();
        setAppliedCoupon(cleanCode);
        setFinalPrice(res.data.final_price);
        pushToast(
          "success",
          res.data.message || (isKhmer ? "បានប្រើកូដបញ្ចុះតម្លៃរួចរាល់។" : "Coupon applied."),
        );
        await refreshQr(billing, cleanCode);
      } else {
        pushToast(
          "danger",
          res.data.message || (isKhmer ? "កូដបញ្ចុះតម្លៃមិនត្រឹមត្រូវទេ។" : "Invalid coupon code."),
        );
      }
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setAppliedCoupon("");
    setCouponCode("");
    setFinalPrice(pricing.planSubtotal.toFixed(2));
    await refreshQr(billing, "");
  };

  const checkStatus = useCallback(
    async (manual = false) => {
      const activeMd5 = bakong?.md5;
      if (!activeMd5 || checkingRef.current || paidMessage) return;
      if (!manual && expiredOnServer) return;

      checkingRef.current = true;
      setCheckingStatus(true);
      try {
        const suffix = manual ? "?force=1" : "";
        const res = await requestJson<{
          status?: string;
          message?: string;
          remaining_seconds?: number;
          redirect_url?: string;
        }>(`${d.checkStatusPrefix}${activeMd5}${suffix}`, "GET");

        if (!res.ok) return;

        if (typeof res.data.remaining_seconds === "number") {
          deadlineMsRef.current = Date.now() + res.data.remaining_seconds * 1000;
          setRemainingSeconds(res.data.remaining_seconds);
        }

        if (res.data.status === "PAID") {
          setStatusNotice(null);
          setPaidMessage(
            isKhmer
              ? "ការទូទាត់បានជោគជ័យ! កំពុងបើកដំណើរការសមាជិកភាព Pro..."
              : "Payment confirmed! Activating your Pro membership...",
          );
          pushToast(
            "success",
            isKhmer ? "ការទូទាត់ Bakong KHQR បានជោគជ័យ!" : "Bakong KHQR payment confirmed!",
          );
          window.setTimeout(() => {
            window.location.href = res.data.redirect_url || "/farmer/dashboard";
          }, 1200);
          return;
        }

        if (res.data.status === "EXPIRED") {
          setExpiredOnServer(true);
          setRemainingSeconds(0);
          setStatusNotice(
            isKhmer
              ? "កូដ KHQR នេះផុតកំណត់ ៣ នាទីហើយ។ សូមបង្កើតកូដថ្មីដើម្បីបង់ប្រាក់។"
              : "This KHQR code expired after 3 minutes. Generate a new QR code to continue.",
          );
          return;
        }

        if (res.data.status === "RATE_LIMITED") {
          setStatusNotice(res.data.message || null);
        } else {
          setStatusNotice(null);
        }
      } finally {
        checkingRef.current = false;
        setCheckingStatus(false);
      }
    },
    [bakong?.md5, d.checkStatusPrefix, expiredOnServer, isKhmer, paidMessage, pushToast],
  );

  // Automatic verification every 4s + immediate check when returning from banking app.
  useEffect(() => {
    if (!bakong?.md5 || paidMessage || isExpired) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkStatus(false);
      }
    }, 4000);

    const onReturnFocus = () => {
      if (document.visibilityState === "visible") {
        void checkStatus(true);
      }
    };
    window.addEventListener("focus", onReturnFocus);
    document.addEventListener("visibilitychange", onReturnFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onReturnFocus);
      document.removeEventListener("visibilitychange", onReturnFocus);
    };
  }, [bakong?.md5, checkStatus, isExpired, paidMessage]);

  // Sync terminal EXPIRED status to backend once when the 3-minute timer hits 00:00.
  useEffect(() => {
    const activeMd5 = bakong?.md5;
    if (!activeMd5 || paidMessage || expiredOnServer || remainingSeconds > 0) return;
    if (expiredSyncMd5Ref.current === activeMd5) return;
    expiredSyncMd5Ref.current = activeMd5;
    void checkStatus(false);
  }, [bakong?.md5, checkStatus, expiredOnServer, paidMessage, remainingSeconds]);

  const handleCopyBill = async () => {
    if (!bakong?.bill_number) return;
    try {
      await navigator.clipboard.writeText(bakong.bill_number);
      setCopiedBill(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedBill(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const progressPercent = Math.max(
    0,
    Math.min(100, (remainingSeconds / totalExpirySeconds) * 100),
  );
  const timerUrgencyTone = isExpired
    ? "rose"
    : remainingSeconds <= 30
      ? "rose"
      : remainingSeconds <= 60
        ? "amber"
        : "emerald";

  const scanSteps = isKhmer
    ? [
        "បើកកម្មវិធី Bakong ឬធនាគារ (ABA, ACLEDA, Wing...)",
        "ស្កេនកូដ QR ក្នុងរយៈពេល ៣ នាទីមុនផុតកំណត់",
        "ប្រព័ន្ធនឹងផ្ទៀងផ្ទាត់ និងបើក Pro ដោយស្វ័យប្រវត្តិ",
      ]
    : [
        "Open Bakong or any Cambodian bank app (ABA, ACLEDA, Wing)",
        "Scan the KHQR within the 3-minute countdown window",
        "Auto-verification activates Pro immediately after payment",
      ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a
          href={d.upgradeUrl}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e3e6ed] bg-white px-3.5 text-xs font-semibold text-[#141824] shadow-sm transition hover:bg-[#f5f7fa] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6] dark:hover:bg-[#1c2233]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isKhmer ? "ត្រឡប់ទៅជម្រើសគម្រោង" : "Back to Plans"}</span>
        </a>
      }
    >
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Order Summary, Coupon & Card Checkout */}
        <div className="space-y-5 lg:col-span-5">
          <section className="ai-surface rounded-3xl p-6">
            {/* Plan Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ed] pb-4 dark:border-[#2b3245]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]">
                    {isKhmer ? "សង្ខេបការបញ្ជាទិញ" : "Order Summary"}
                  </h2>
                  <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    AGRI SYSTEM Pro ·{" "}
                    {billing === "yearly"
                      ? isKhmer
                        ? "៣៦៥ ថ្ងៃ"
                        : "365-day access"
                      : isKhmer
                        ? "៣០ ថ្ងៃ"
                        : "30-day access"}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Sparkles className="h-3 w-3" />
                Pro
              </span>
            </div>

            {/* Segmented Billing Cycle Selector */}
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "រយៈពេលគម្រោង" : "Billing Cycle"}
              </p>
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#e3e6ed] bg-[#f5f7fa] p-1 dark:border-[#2b3245] dark:bg-[#0f111a]">
                <button
                  type="button"
                  onClick={() => void handleBillingChange("monthly")}
                  aria-pressed={billing === "monthly"}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                    billing === "monthly"
                      ? "bg-white text-[#141824] shadow-sm dark:bg-[#1c2233] dark:text-white"
                      : "text-[#525b75] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-white",
                  )}
                >
                  {isKhmer ? "ប្រចាំខែ" : "Monthly"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleBillingChange("yearly")}
                  aria-pressed={billing === "yearly"}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                    billing === "yearly"
                      ? "bg-white text-[#141824] shadow-sm dark:bg-[#1c2233] dark:text-white"
                      : "text-[#525b75] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-white",
                  )}
                >
                  <span>{isKhmer ? "ប្រចាំឆ្នាំ" : "Yearly"}</span>
                  {pricing.yearlyDiscountPct > 0 && (
                    <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      -{Math.round(pricing.yearlyDiscountPct)}%
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="mt-5 space-y-2.5 border-t border-[#e3e6ed] pt-4 text-xs dark:border-[#2b3245]">
              <div className="flex items-center justify-between text-[#525b75] dark:text-[#9fa6bc]">
                <span>
                  {billing === "yearly"
                    ? isKhmer
                      ? "តម្លៃស្តង់ដារ (១២ ខែ)"
                      : "Standard rate (12 months)"
                    : isKhmer
                      ? "តម្លៃស្តង់ដារប្រចាំខែ"
                      : "Standard monthly rate"}
                </span>
                <span className="font-semibold tabular-nums">
                  ${pricing.standardSelected.toFixed(2)}
                </span>
              </div>

              {pricing.standardSelected - pricing.planSubtotal > 0.009 && (
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <span>
                    {billing === "yearly"
                      ? isKhmer
                        ? "បញ្ចុះតម្លៃគម្រោងប្រចាំឆ្នាំ"
                        : "Annual & campaign savings"
                      : isKhmer
                        ? "ការបញ្ចុះតម្លៃយុទ្ធនាការ"
                        : "Campaign discount"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    -${(pricing.standardSelected - pricing.planSubtotal).toFixed(2)}
                  </span>
                </div>
              )}

              {appliedCoupon && (
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    <span>
                      {isKhmer ? "កូដ" : "Promo"} ({appliedCoupon})
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveCoupon()}
                      title={isKhmer ? "ដកកូដបញ្ចុះតម្លៃ" : "Remove coupon"}
                      aria-label="Remove coupon"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-rose-500/15 hover:text-rose-600 dark:text-emerald-300"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                  <span className="font-semibold tabular-nums">
                    -${pricing.couponSavings.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-baseline justify-between border-t border-dashed border-[#e3e6ed] pt-3 dark:border-[#2b3245]">
                <div>
                  <span className="text-xs font-bold text-[#141824] dark:text-[#eff2f6]">
                    {isKhmer ? "ទឹកប្រាក់ត្រូវបង់សរុប" : "Total Due Now"}
                  </span>
                  {pricing.totalSaved > 0.009 && (
                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {isKhmer
                        ? `អ្នកសន្សំបាន $${pricing.totalSaved.toFixed(2)}`
                        : `You save $${pricing.totalSaved.toFixed(2)}`}
                    </p>
                  )}
                </div>
                <span className="font-display text-3xl font-extrabold tracking-tight tabular-nums text-[#141824] dark:text-white">
                  ${Number(finalPrice || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Promo Code Form */}
            {d.couponEnabled && (
              <form
                onSubmit={handleApplyCoupon}
                className="mt-5 space-y-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]"
              >
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                  <Tag className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "កូដបញ្ចុះតម្លៃ" : "Promo Code"}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder={isKhmer ? "បញ្ចូលកូដ" : "ENTER CODE"}
                    className="ai-input h-9 flex-1 px-3 font-mono text-xs uppercase tracking-wide"
                  />
                  <button
                    type="submit"
                    disabled={validatingCoupon || !couponCode.trim()}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] px-4 text-xs font-semibold text-[#141824] transition hover:bg-[#eff2f6] disabled:opacity-50 dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:bg-[#22283a]"
                  >
                    {validatingCoupon ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isKhmer ? (
                      "ប្រើកូដ"
                    ) : (
                      "Apply"
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* PayPal / Card Fallback Form */}
            <form
              method="post"
              action={d.submitUrl}
              className="mt-5 space-y-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]"
            >
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="applied_coupon_code" value={appliedCoupon} />
              <input type="hidden" name="billing_interval" value={billing} />
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "វិធីទូទាត់ផ្សេងទៀត" : "Alternative Payment"}
              </p>
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e3e6ed] bg-white px-4 text-xs font-semibold text-[#141824] shadow-sm transition hover:bg-[#f5f7fa] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:bg-[#22283a]"
              >
                <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span>
                  {isKhmer
                    ? "បង់ប្រាក់តាម Card / PayPal"
                    : "Complete Card / PayPal Checkout"}
                </span>
              </button>
              <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {isKhmer
                    ? "សមាជិកភាពបើកដំណើរការដោយសុវត្ថិភាព"
                    : "Encrypted verification & instant activation"}
                </span>
              </p>
            </form>
          </section>
        </div>

        {/* Right Column: Bakong KHQR Instant Payment with 3-Minute Countdown */}
        <section className="ai-surface flex flex-col justify-between rounded-3xl p-6 sm:p-8 lg:col-span-7">
          <div>
            {/* KHQR Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] pb-4 dark:border-[#2b3245]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                  <QrCode className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]">
                    {isKhmer ? "ទូទាត់ភ្លាមៗតាម Bakong KHQR" : "Bakong KHQR Instant Payment"}
                  </h2>
                  <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {d.bakongMerchantName} · USD
                  </p>
                </div>
              </div>

              {!paidMessage && bakong?.md5 && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Live Auto-Verify Badge */}
                  {!isExpired && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {checkingStatus ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                        </span>
                      )}
                      <span>
                        {checkingStatus
                          ? isKhmer
                            ? "កំពុងផ្ទៀងផ្ទាត់..."
                            : "Checking..."
                          : isKhmer
                            ? "ផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ"
                            : "Auto-verifying"}
                      </span>
                    </span>
                  )}

                  {/* 3-Minute Countdown Badge */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold tabular-nums",
                      timerUrgencyTone === "rose"
                        ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-950/40 dark:text-rose-300"
                        : timerUrgencyTone === "amber"
                          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-[#e3e6ed] bg-[#f5f7fa] text-[#141824] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#eff2f6]",
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatCountdown(remainingSeconds)}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Subtle Countdown Progress Bar */}
            {!paidMessage && bakong?.md5 && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      timerUrgencyTone === "rose"
                        ? "bg-rose-500"
                        : timerUrgencyTone === "amber"
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {paidMessage ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <p className="mt-4 font-display text-lg font-bold text-[#141824] dark:text-white">
                  {paidMessage}
                </p>
                <p className="mt-1 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer
                    ? "កំពុងនាំអ្នកត្រឡប់ទៅផ្ទាំងគ្រប់គ្រងកសិករ..."
                    : "Redirecting to your Farmer Dashboard..."}
                </p>
              </div>
            ) : bakong?.qr_image ? (
              <div className="mt-6 flex flex-col items-center">
                {/* Clean White Scannable QR Card + Expiry / Loading Overlay */}
                <div className="relative overflow-hidden rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-sm">
                  <img
                    id="bakong_qr_image"
                    src={bakong.qr_image}
                    alt="Bakong KHQR"
                    className={cn(
                      "h-60 w-60 object-contain transition-all duration-300",
                      (generatingQr || isExpired) && "scale-[0.98] opacity-25 blur-[2px]",
                    )}
                  />

                  {generatingQr ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-xs font-semibold text-[#141824]">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                      <span>{isKhmer ? "កំពុងបង្កើត QR ថ្មី..." : "Updating QR..."}</span>
                    </div>
                  ) : (
                    isExpired && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 px-5 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
                          <Clock className="h-5 w-5" />
                        </div>
                        <p className="mt-2.5 text-sm font-bold text-[#141824]">
                          {isKhmer ? "កូដ KHQR ផុតកំណត់ហើយ" : "KHQR Expired (3:00)"}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-[#525b75]">
                          {isKhmer
                            ? "សូមចុចបង្កើតកូដ QR ថ្មីដើម្បីបន្តបង់ប្រាក់។"
                            : "Generate a fresh QR code to complete payment."}
                        </p>
                        <button
                          type="button"
                          onClick={() => void refreshQr(billing, appliedCoupon)}
                          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>{isKhmer ? "បង្កើត QR ថ្មី" : "Generate New KHQR"}</span>
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* Amount + Reference Pill */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="rounded-full border border-[#e3e6ed] bg-[#f5f7fa] px-3 py-1 font-bold tabular-nums text-[#141824] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-white">
                    ${Number(bakong.amount ?? finalPrice ?? 0).toFixed(2)}{" "}
                    {bakong.currency || "USD"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyBill()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#e3e6ed] bg-white px-3 py-1 font-mono text-[11px] font-medium text-[#525b75] transition hover:bg-[#f5f7fa] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#9fa6bc]"
                    title={isKhmer ? "ចម្លងលេខយោង" : "Copy reference number"}
                  >
                    <span>Ref:</span>
                    <span
                      id="khqr_bill_number"
                      className="font-semibold text-[#141824] dark:text-white"
                    >
                      {bakong.bill_number || "BILL-REF"}
                    </span>
                    {copiedBill ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-70" />
                    )}
                  </button>
                </div>

                {statusNotice && (
                  <p className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50/80 px-3.5 py-2 text-center text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-200">
                    {statusNotice}
                  </p>
                )}

                {/* Action Controls */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  {bakong.deeplink && !isExpired && (
                    <a
                      href={bakong.deeplink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
                    >
                      <span>{isKhmer ? "បើកក្នុងកម្មវិធី Bakong" : "Open in Bakong App"}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {!isExpired && (
                    <button
                      type="button"
                      onClick={() => void checkStatus(true)}
                      disabled={checkingStatus}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {checkingStatus ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span>{isKhmer ? "ផ្ទៀងផ្ទាត់ឥឡូវ" : "Verify Now"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={generatingQr}
                    onClick={() => void refreshQr(billing, appliedCoupon)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#e3e6ed] bg-white px-3.5 text-xs font-semibold text-[#525b75] transition hover:bg-[#f5f7fa] disabled:opacity-50 dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#9fa6bc]"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "បង្កើត QR ថ្មី" : "New QR"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f7fa] text-[#6e7891] dark:bg-[#181d2b] dark:text-[#8a94ad]">
                  <QrCode className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#141824] dark:text-[#eff2f6]">
                  {isKhmer
                    ? "មិនទាន់មានកូដ KHQR នៅឡើយទេ"
                    : "KHQR preview unavailable right now."}
                </p>
                <p className="mt-1 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer
                    ? "ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតកូដស្កេនថ្មី ឬប្រើ Card / PayPal។"
                    : "Click below to generate a fresh QR code or complete via Card / PayPal."}
                </p>
                <button
                  type="button"
                  disabled={generatingQr}
                  onClick={() => void refreshQr(billing, appliedCoupon)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {generatingQr && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isKhmer ? "បង្កើត KHQR" : "Generate KHQR"}</span>
                </button>
              </div>
            )}
          </div>

          {/* 3-Step Payment Guide */}
          <div className="mt-6 grid grid-cols-1 gap-2.5 border-t border-[#e3e6ed] pt-5 sm:grid-cols-3 dark:border-[#2b3245]">
            {scanSteps.map((stepText, idx) => (
              <div
                key={stepText}
                className="flex items-start gap-2.5 rounded-2xl border border-[#e3e6ed] bg-[#f9fafc] p-3 text-left dark:border-[#2b3245] dark:bg-[#101420]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  {idx + 1}
                </span>
                <span className="text-[11px] leading-snug text-[#525b75] dark:text-[#9fa6bc]">
                  {stepText}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
