import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
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
import { QrCodeSkeleton } from "@/components/ui/Skeleton";

const KHQR_DEFAULT_EXPIRY_SECONDS = 180;

interface BakongInfo {
  provider?: string;
  md5?: string;
  qr_image?: string;
  qr_svg_url?: string;
  qr_png_url?: string;
  qr_string?: string;
  bill_number?: string;
  deeplink?: string;
  checkout_url?: string;
  merchant_name?: string;
  amount?: number | string;
  currency?: string;
  requested_amount?: string | null;
  requested_currency?: string | null;
  settlement_amount?: string | null;
  settlement_currency?: string | null;
  conversion_rate?: number | null;
  khqrpay_status?: string;
  expires_in_seconds?: number;
  remaining_seconds?: number;
  expires_at?: string;
  status?: string;
  already_paid?: boolean;
  redirect_url?: string;
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

function formatMoneyDisplay(amount: number | string | null | undefined, currency?: string | null): string {
  const curr = (currency || "USD").toUpperCase();
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) {
    return curr === "KHR" ? "0 ៛" : "$0.00";
  }
  if (curr === "KHR") {
    return `${Math.round(num).toLocaleString("en-US")} ៛`;
  }
  return `$${num.toFixed(2)}`;
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
  const [qrScanned, setQrScanned] = useState(d.initialBakong?.khqrpay_status === "scanned");
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
  const pendingForceCheckRef = useRef(false);
  const expiredSyncMd5Ref = useRef<string | null>(null);

  const handlePaymentConfirmed = useCallback(
    (redirectUrl?: string) => {
      setStatusNotice(null);
      setExpiredOnServer(false);
      setQrScanned(false);
      setPaidMessage(
        isKhmer
          ? "ការទូទាត់បានជោគជ័យ! កំពុងបើកដំណើរការសមាជិកភាព Pro..."
          : "Payment confirmed! Activating your Pro membership...",
      );
      pushToast(
        "success",
        isKhmer ? "ការទូទាត់ KHQR បានជោគជ័យ!" : "KHQR payment confirmed!",
      );
      window.setTimeout(() => {
        window.location.href = redirectUrl || "/farmer/dashboard";
      }, 1200);
    },
    [isKhmer, pushToast],
  );

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Reset local countdown deadline whenever a new QR session arrives.
  useEffect(() => {
    if (!bakong?.md5) {
      deadlineMsRef.current = 0;
      setRemainingSeconds(0);
      setExpiredOnServer(false);
      setQrScanned(false);
      return undefined;
    }

    const initialLeft =
      typeof bakong.remaining_seconds === "number"
        ? Math.max(0, bakong.remaining_seconds)
        : Number(bakong.expires_in_seconds || KHQR_DEFAULT_EXPIRY_SECONDS);
    deadlineMsRef.current = Date.now() + initialLeft * 1000;
    setRemainingSeconds(initialLeft);
    setExpiredOnServer(initialLeft <= 0);
    setQrScanned(bakong.khqrpay_status === "scanned");
    setStatusNotice(null);

    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineMsRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    bakong?.md5,
    bakong?.bill_number,
    bakong?.remaining_seconds,
    bakong?.expires_in_seconds,
    bakong?.khqrpay_status,
  ]);

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
      setQrScanned(false);
      expiredSyncMd5Ref.current = null;
      try {
        const res = await postJson<BakongInfo>(
          d.generateQrUrl,
          { billing_interval: nextBilling, coupon_code: code },
          bootstrap.csrfToken,
        );
        if (res.ok) {
          if (res.data?.status === "PAID" || res.data?.already_paid) {
            handlePaymentConfirmed(res.data.redirect_url);
            return;
          }
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
    [bootstrap.csrfToken, d.generateQrUrl, handlePaymentConfirmed],
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
      if (!activeMd5 || paidMessage) return;
      if (checkingRef.current) {
        if (manual) {
          pendingForceCheckRef.current = true;
        }
        return;
      }
      if (!manual && expiredOnServer) return;

      checkingRef.current = true;
      setCheckingStatus(true);
      try {
        const suffix = manual ? "?force=1" : "";
        const res = await requestJson<{
          status?: string;
          khqrpay_status?: string;
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
          handlePaymentConfirmed(res.data.redirect_url);
          return;
        }

        if (res.data.khqrpay_status === "scanned") {
          setQrScanned(true);
          setExpiredOnServer(false);
          setStatusNotice(null);
          return;
        }

        if (res.data.status === "EXPIRED") {
          setExpiredOnServer(true);
          setQrScanned(false);
          setRemainingSeconds(0);
          setStatusNotice(
            isKhmer
              ? "កូដ KHQR នេះផុតកំណត់ហើយ។ សូមបង្កើតកូដថ្មី ឬចុចផ្ទៀងផ្ទាត់ប្រសិនបើបានបង់រួច។"
              : "This KHQR code has expired. Generate a fresh code or verify if you already paid.",
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
        if (pendingForceCheckRef.current && !paidMessage) {
          pendingForceCheckRef.current = false;
          void checkStatus(true);
        }
      }
    },
    [bakong?.md5, d.checkStatusPrefix, expiredOnServer, handlePaymentConfirmed, isKhmer, paidMessage],
  );

  // Automatic verification every 4s + immediate burst check when returning from mobile banking app.
  useEffect(() => {
    if (!bakong?.md5 || paidMessage) return undefined;

    const retryTimers: number[] = [];
    const clearRetryTimers = () => {
      while (retryTimers.length > 0) {
        const id = retryTimers.pop();
        if (id !== undefined) window.clearTimeout(id);
      }
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !isExpired) {
        void checkStatus(false);
      }
    }, 4000);

    const onReturnFromBankApp = () => {
      if (document.visibilityState !== "visible") return;
      clearRetryTimers();
      void checkStatus(true);
      retryTimers.push(window.setTimeout(() => void checkStatus(true), 1600));
      retryTimers.push(window.setTimeout(() => void checkStatus(true), 3800));
    };

    window.addEventListener("focus", onReturnFromBankApp);
    window.addEventListener("pageshow", onReturnFromBankApp);
    document.addEventListener("visibilitychange", onReturnFromBankApp);

    return () => {
      window.clearInterval(timer);
      clearRetryTimers();
      window.removeEventListener("focus", onReturnFromBankApp);
      window.removeEventListener("pageshow", onReturnFromBankApp);
      document.removeEventListener("visibilitychange", onReturnFromBankApp);
    };
  }, [bakong?.md5, checkStatus, isExpired, paidMessage]);

  // Perform a forced verification when the countdown reaches 00:00 before locking expired state.
  useEffect(() => {
    const activeMd5 = bakong?.md5;
    if (!activeMd5 || paidMessage || expiredOnServer || remainingSeconds > 0) return;
    if (expiredSyncMd5Ref.current === activeMd5) return;
    expiredSyncMd5Ref.current = activeMd5;
    void checkStatus(true);
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

  const settlementCurrency = (
    bakong?.settlement_currency ||
    bakong?.currency ||
    "USD"
  ).toUpperCase();
  const settlementAmount =
    bakong?.settlement_amount ?? bakong?.amount ?? finalPrice ?? 0;
  const requestedCurrency = (
    bakong?.requested_currency ||
    bakong?.currency ||
    "USD"
  ).toUpperCase();
  const requestedAmount = bakong?.requested_amount ?? finalPrice ?? 0;
  const hasConversion =
    Boolean(bakong?.conversion_rate) && settlementCurrency !== requestedCurrency;
  const merchantLabel = bakong?.merchant_name || d.bakongMerchantName || "AGRI SYSTEM";
  const checkoutLink = bakong?.checkout_url || bakong?.deeplink || "";
  const qrDownloadHref = bakong?.qr_png_url || bakong?.qr_image || "";
  const isHostedKhqrpay = checkoutLink.includes("khqrpay.dev");

  const supportedBanks = ["ABA Mobile", "ACLEDA", "Wing", "Bakong", "Canadia"];

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
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Clean Order Summary, Billing Switcher & Coupon */}
        <div className="min-w-0 space-y-5 lg:col-span-5">
          <section className="ai-surface rounded-3xl p-5 sm:p-6">
            {/* Plan Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#e3e6ed] pb-4 dark:border-[#2b3245]">
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

              <div className="flex items-baseline justify-between border-t border-dashed border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
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
                    className="ai-input h-9 min-w-0 flex-1 px-3 font-mono text-xs uppercase tracking-wide"
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

            {/* PayPal / Card Alternative */}
            <form
              method="post"
              action={d.submitUrl}
              className="mt-5 space-y-2.5 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]"
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
              <p className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {isKhmer
                    ? "ការទូទាត់មានសុវត្ថិភាព និងបើកដំណើរការភ្លាមៗ"
                    : "Direct bank-to-bank settlement · Instant activation"}
                </span>
              </p>
            </form>
          </section>
        </div>

        {/* Right Column: Clean Fintech KHQR Payment Card */}
        <section className="ai-surface flex min-w-0 flex-col justify-between rounded-3xl p-5 sm:p-7 lg:col-span-7">
          <div className="min-w-0">
            {/* Minimal Header + Status & Timer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1232E]/10 text-[#E1232E] dark:bg-[#E1232E]/20 dark:text-rose-400">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold tracking-tight text-[#141824] dark:text-[#eff2f6]">
                    {isKhmer ? "ទូទាត់តាម KHQR" : "Scan to Pay with KHQR"}
                  </h2>
                  <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer
                      ? "គាំទ្រ ABA Mobile, Bakong និងគ្រប់ធនាគារកម្ពុជា"
                      : "Works with ABA Mobile, Bakong & all Cambodian bank apps"}
                  </p>
                </div>
              </div>

              {!paidMessage && bakong?.md5 && (
                <div className="flex items-center gap-2">
                  {/* Live Status Indicator */}
                  {!isExpired && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        qrScanned
                          ? "border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/40 dark:text-sky-300"
                          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300",
                      )}
                    >
                      {checkingStatus ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className="relative flex h-2 w-2">
                          <span
                            className={cn(
                              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                              qrScanned ? "bg-sky-500" : "bg-emerald-500",
                            )}
                          />
                          <span
                            className={cn(
                              "relative inline-flex h-2 w-2 rounded-full",
                              qrScanned ? "bg-sky-600" : "bg-emerald-600",
                            )}
                          />
                        </span>
                      )}
                      <span>
                        {qrScanned
                          ? isKhmer
                            ? "បានស្កេន · រង់ចាំបញ្ជាក់"
                            : "Scanned · Confirm in app"
                          : isKhmer
                            ? "រង់ចាំការបង់ប្រាក់"
                            : "Awaiting payment"}
                      </span>
                    </span>
                  )}

                  {/* Countdown Pill */}
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

            {/* Hairline Countdown Progress Track */}
            {!paidMessage && bakong?.md5 && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#eff2f6] dark:bg-[#1e2436]">
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
            )}

            {paidMessage ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
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
                {/* Signature KHQR Payment Card */}
                <div className="w-full max-w-[308px] overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_14px_38px_-12px_rgba(15,23,42,0.12)] dark:border-slate-700/70 dark:shadow-[0_18px_42px_-12px_rgba(0,0,0,0.55)]">
                  {/* Official KHQR Red Header */}
                  <div className="relative flex items-center justify-between bg-[#E1232E] px-5 py-3.5 text-white">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[17px] font-black tracking-[0.14em]">
                        KHQR
                      </span>
                    </div>
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/95 backdrop-blur-sm">
                      {settlementCurrency}
                    </span>
                    {/* Subtle authentic corner triangle fold */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-2.5 right-0 h-5 w-5 rotate-45 bg-white"
                    />
                  </div>

                  {/* Merchant & Amount Tear-Off Header */}
                  <div className="border-b border-dashed border-slate-200 bg-white px-5 pb-3.5 pt-4 text-left">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {merchantLabel}
                    </p>
                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="font-display text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">
                        {formatMoneyDisplay(settlementAmount, settlementCurrency)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {settlementCurrency}
                      </span>
                    </div>
                    {hasConversion && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatMoneyDisplay(requestedAmount, requestedCurrency)} {requestedCurrency} · 1 USD ={" "}
                        {Number(bakong.conversion_rate).toLocaleString("en-US")} KHR
                      </p>
                    )}
                  </div>

                  {/* Centered High-Contrast QR Code Stage */}
                  <div className="relative flex items-center justify-center bg-white px-5 py-5">
                    <img
                      id="bakong_qr_image"
                      src={bakong.qr_image}
                      alt="KHQR Payment Code"
                      className={cn(
                        "h-48 w-48 max-w-full object-contain transition-all duration-300 sm:h-56 sm:w-56",
                        (generatingQr || isExpired) && "scale-[0.97] opacity-20 blur-[3px]",
                      )}
                    />

                    {generatingQr ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/95">
                        <QrCodeSkeleton label={isKhmer ? "កំពុងបង្កើត QR ថ្មី..." : "Generating QR..."} />
                      </div>
                    ) : isExpired && checkingStatus ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/95">
                        <QrCodeSkeleton label={isKhmer ? "កំពុងផ្ទៀងផ្ទាត់ការទូទាត់..." : "Checking payment..."} />
                      </div>
                    ) : (
                      isExpired && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/92 px-5 text-center backdrop-blur-[2px]">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/12 text-rose-600">
                            <Clock className="h-5 w-5" />
                          </div>
                          <p className="mt-2.5 text-sm font-bold text-slate-900">
                            {isKhmer ? "កូដ KHQR ផុតកំណត់ហើយ" : "QR Code Expired"}
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-slate-500">
                            {isKhmer
                              ? "បើអ្នកបានបង់រួច សូមចុចផ្ទៀងផ្ទាត់ ឬបង្កើតកូដថ្មី។"
                              : "Already paid? Verify now, or generate a fresh QR."}
                          </p>
                          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              disabled={checkingStatus}
                              onClick={() => void checkStatus(true)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>{isKhmer ? "ផ្ទៀងផ្ទាត់" : "Verify"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void refreshQr(billing, appliedCoupon)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
                            >
                              <QrCode className="h-3 w-3" />
                              <span>{isKhmer ? "បង្កើតថ្មី" : "New QR"}</span>
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Minimal Reference & Save Strip */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyBill()}
                      className="inline-flex min-w-0 items-center gap-1.5 text-left font-mono text-[11px] text-slate-600 transition hover:text-slate-900"
                      title={isKhmer ? "ចម្លងលេខយោង" : "Copy reference ID"}
                    >
                      <span className="shrink-0 text-slate-400">Ref</span>
                      <span
                        id="khqr_bill_number"
                        className="truncate font-semibold text-slate-800"
                      >
                        {bakong.bill_number || "BILL-REF"}
                      </span>
                      {copiedBill ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3 shrink-0 text-slate-400" />
                      )}
                    </button>

                    {qrDownloadHref && !isExpired && (
                      <a
                        href={qrDownloadHref}
                        download={`${bakong.bill_number || "khqr"}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                        title={isKhmer ? "រក្សាទុករូប QR" : "Save QR image"}
                      >
                        <Download className="h-3 w-3" />
                        <span>{isKhmer ? "រក្សាទុក" : "Save QR"}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Scanned or Rate-Limit Notice */}
                {statusNotice && (
                  <p className="mt-4 max-w-md rounded-xl border border-amber-300/70 bg-amber-50/80 px-3.5 py-2 text-center text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-200">
                    {statusNotice}
                  </p>
                )}

                {/* Clean Action Row */}
                <div className="mt-5 flex w-full max-w-md flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
                  {checkoutLink && !isExpired && (
                    <a
                      href={checkoutLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#E1232E] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#c81d27] sm:w-auto"
                    >
                      <Smartphone className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {isHostedKhqrpay
                          ? isKhmer
                            ? "បើកទំព័រទូទាត់ KHQRPay"
                            : "Open KHQRPay Checkout"
                          : isKhmer
                            ? "បើកក្នុងកម្មវិធីធនាគារ"
                            : "Open Bank App"}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-85" />
                    </a>
                  )}

                  {!isExpired && (
                    <button
                      type="button"
                      onClick={() => void checkStatus(true)}
                      disabled={checkingStatus}
                      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
                    >
                      {checkingStatus ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{isKhmer ? "ផ្ទៀងផ្ទាត់ឥឡូវ" : "Verify Payment"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={generatingQr}
                    onClick={() => void refreshQr(billing, appliedCoupon)}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#e3e6ed] bg-white px-3.5 text-xs font-semibold text-[#525b75] transition hover:bg-[#f5f7fa] disabled:opacity-50 dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#9fa6bc] sm:w-auto"
                  >
                    <QrCode className="h-3.5 w-3.5 shrink-0" />
                    <span>{isKhmer ? "QR ថ្មី" : "New QR"}</span>
                  </button>
                </div>
              </div>
            ) : generatingQr ? (
              <div className="mt-8 flex flex-col items-center">
                <div className="overflow-hidden rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-sm">
                  <QrCodeSkeleton label={isKhmer ? "កំពុងបង្កើត KHQR..." : "Generating KHQR..."} />
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
                    : "Ready to generate your KHQR code"}
                </p>
                <p className="mt-1 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer
                    ? "ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតកូដស្កេនភ្លាមៗ។"
                    : "Click below to generate a fresh scannable KHQR code."}
                </p>
                <button
                  type="button"
                  disabled={generatingQr}
                  onClick={() => void refreshQr(billing, appliedCoupon)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#E1232E] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#c81d27] disabled:opacity-50"
                >
                  {generatingQr && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isKhmer ? "បង្កើត KHQR" : "Generate KHQR"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Clean Supported Banks & Verification Footer */}
          <div className="mt-6 flex flex-col items-center justify-between gap-2.5 border-t border-[#e3e6ed] pt-4 text-[11px] text-[#6e7891] dark:border-[#2b3245] dark:text-[#8a94ad] sm:flex-row">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                {isKhmer
                  ? "ផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិក្រោយស្កេន"
                  : "Auto-verifies seconds after scan"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {supportedBanks.map((bank) => (
                <span
                  key={bank}
                  className="rounded-md border border-[#e3e6ed] bg-[#f9fafc] px-2 py-0.5 text-[10px] font-medium text-[#525b75] dark:border-[#2b3245] dark:bg-[#101420] dark:text-[#9fa6bc]"
                >
                  {bank}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
