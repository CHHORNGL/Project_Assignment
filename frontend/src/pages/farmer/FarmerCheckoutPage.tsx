import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  Tag,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import { postJson, requestJson } from "@/lib/api";

interface BakongInfo {
  md5?: string;
  qr_image?: string;
  qr_string?: string;
  bill_number?: string;
  deeplink?: string;
  amount?: number | string;
  currency?: string;
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

export default function FarmerCheckoutPage({ bootstrap }: { bootstrap: AppBootstrap<CheckoutData> }) {
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [billing, setBilling] = useState<"monthly" | "yearly">(d.isYearly ? "yearly" : "monthly");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [finalPrice, setFinalPrice] = useState(d.premiumPrice);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [bakong, setBakong] = useState<BakongInfo | null>(d.initialBakong);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paidMessage, setPaidMessage] = useState("");

  const refreshQr = async (nextBilling: "monthly" | "yearly", code: string) => {
    setGeneratingQr(true);
    try {
      const res = await postJson<BakongInfo>(
        d.generateQrUrl,
        { billing_interval: nextBilling, coupon_code: code },
        bootstrap.csrfToken,
      );
      if (res.ok) {
        setBakong(res.data);
      }
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await postJson<{ success?: boolean; code?: string; final_price?: string; message?: string }>(
        d.validateCouponUrl,
        { code: couponCode.trim(), billing_interval: billing },
        bootstrap.csrfToken,
      );
      if (res.ok && res.data.success && res.data.final_price) {
        setAppliedCoupon(res.data.code || couponCode.trim().toUpperCase());
        setFinalPrice(res.data.final_price);
        pushToast("success", res.data.message || "Coupon applied.");
        await refreshQr(billing, res.data.code || couponCode.trim());
      } else {
        pushToast("danger", res.data.message || "Invalid coupon.");
      }
    } finally {
      setValidatingCoupon(false);
    }
  };

  const checkStatus = async () => {
    if (!bakong?.md5 || checkingStatus || paidMessage) return;
    setCheckingStatus(true);
    try {
      const res = await requestJson<{ status?: string; redirect_url?: string }>(
        `${d.checkStatusPrefix}${bakong.md5}`,
        "GET",
      );
      if (res.ok && res.data.status === "PAID") {
        setPaidMessage("Payment confirmed! Activating your Pro membership...");
        pushToast("success", "Bakong KHQR payment confirmed!");
        window.setTimeout(() => {
          window.location.href = res.data.redirect_url || "/farmer/dashboard";
        }, 1200);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!bakong?.md5 || paidMessage) return;
    const id = window.setInterval(() => {
      void checkStatus();
    }, 5000);
    return () => window.clearInterval(id);
  }, [bakong?.md5, paidMessage]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-12">
        {/* Summary + Coupon */}
        <div className="space-y-5 lg:col-span-5">
          <div className="ai-surface space-y-4 p-6">
            <h2 className="font-display text-base font-bold">Order Summary</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBilling("monthly");
                  void refreshQr("monthly", appliedCoupon);
                }}
                className={billing === "monthly" ? "ai-btn-primary h-8 flex-1 text-xs" : "ai-btn-secondary h-8 flex-1 text-xs"}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => {
                  setBilling("yearly");
                  void refreshQr("yearly", appliedCoupon);
                }}
                className={billing === "yearly" ? "ai-btn-primary h-8 flex-1 text-xs" : "ai-btn-secondary h-8 flex-1 text-xs"}
              >
                Yearly (-{d.yearlyDiscountPercent}%)
              </button>
            </div>

            <div className="flex items-baseline justify-between border-t border-slate-200/70 pt-4 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500">Total Due</span>
              <span className="font-display text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                ${finalPrice}
              </span>
            </div>

            {d.couponEnabled && (
              <form onSubmit={handleApplyCoupon} className="space-y-2 border-t border-slate-200/70 pt-4 dark:border-slate-800">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Tag className="h-3.5 w-3.5" /> Promo Coupon
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="ENTER CODE"
                    className="ai-input py-2 text-xs uppercase"
                  />
                  <button type="submit" disabled={validatingCoupon} className="ai-btn-secondary h-9 shrink-0 px-3 text-xs">
                    {validatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                  </button>
                </div>
              </form>
            )}

            <form method="post" action={d.submitUrl} className="border-t border-slate-200/70 pt-4 dark:border-slate-800">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="applied_coupon_code" value={appliedCoupon} />
              <input type="hidden" name="billing_interval" value={billing} />
              <button type="submit" className="ai-btn-secondary w-full text-xs">
                <CreditCard className="h-4 w-4" /> Complete Card / PayPal Checkout
              </button>
            </form>
          </div>
        </div>

        {/* Bakong KHQR */}
        <div className="ai-surface flex flex-col items-center justify-center p-6 text-center lg:col-span-7">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <QrCode className="h-4 w-4" /> Bakong KHQR Instant Payment
          </div>

          {paidMessage ? (
            <div className="flex flex-col items-center py-8 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mb-3 h-12 w-12" />
              <p className="font-display text-lg font-bold">{paidMessage}</p>
            </div>
          ) : bakong?.qr_image ? (
            <>
              <div className="rounded-2xl border-2 border-rose-500/25 bg-white p-4 shadow-md">
                <img id="bakong_qr_image" src={bakong.qr_image} alt="Bakong KHQR" className="h-60 w-60 object-contain" />
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {d.bakongMerchantName} · Ref: <span id="khqr_bill_number" className="font-mono">{bakong.bill_number || "BILL-REF"}</span>
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {bakong.deeplink && (
                  <a href={bakong.deeplink} target="_blank" rel="noreferrer" className="ai-btn-primary h-9 px-4 text-xs">
                    Open in Bakong App <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button type="button" onClick={checkStatus} disabled={checkingStatus} className="ai-btn-secondary h-9 px-4 text-xs">
                  {checkingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Verify Payment
                </button>
              </div>
            </>
          ) : (
            <div className="py-6 text-xs text-slate-500">
              <p>KHQR preview unavailable right now.</p>
              <button
                type="button"
                disabled={generatingQr}
                onClick={() => refreshQr(billing, appliedCoupon)}
                className="ai-btn-primary mt-3 h-9 px-4 text-xs"
              >
                {generatingQr && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Generate KHQR
              </button>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
