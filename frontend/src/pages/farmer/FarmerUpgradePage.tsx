import React, { useState } from "react";
import { ArrowRight, Check, Crown, Sparkles, Tag } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";

interface UpgradeData {
  checkoutUrl: string;
  dashboardUrl: string;
  premiumPrice: string;
  originalPrice: string;
  discountPercent: number;
  yearlyDiscountPercent: number;
  discountBanner: string;
  savings: number;
}

export default function FarmerUpgradePage({ bootstrap }: { bootstrap: AppBootstrap<UpgradeData> }) {
  const d = bootstrap.data;
  const [yearly, setYearly] = useState(true);

  const monthlyNum = Number(d.premiumPrice || 20);
  const yearlyMonthly = (monthlyNum * (1 - (d.yearlyDiscountPercent || 20) / 100)).toFixed(2);
  const displayPrice = yearly ? yearlyMonthly : monthlyNum.toFixed(2);
  const checkoutTarget = `${d.checkoutUrl}?billing=${yearly ? "yearly" : "monthly"}`;

  const features = [
    "Unlimited AI Crop Leaf Image Scans & Instant Diagnosis",
    "Unlimited Bilingual AI Agronomist Chat Consultations",
    "Priority Escalation to Human Experts",
    "Advanced Weekly Rain, Pest & Wind Risk Advisories",
    "Audio Khmer & English Diagnosis Narration",
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {d.discountBanner && (
          <div className="ai-surface flex items-center gap-2 border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300">
            <Tag className="h-4 w-4 shrink-0" />
            {d.discountBanner}
          </div>
        )}

        <div className="ai-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 pb-6 dark:border-slate-800/70">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-extrabold">AGRI SYSTEM Pro</h2>
                <p className="text-xs text-slate-500">Everything needed for full-season crop protection.</p>
              </div>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 p-1 text-xs dark:border-slate-800">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={!yearly ? "rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white" : "px-3 py-1.5 font-semibold text-slate-500"}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={yearly ? "rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white" : "px-3 py-1.5 font-semibold text-slate-500"}
              >
                Yearly (-{d.yearlyDiscountPercent}%)
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Included Capabilities</p>
              <ul className="mt-3 space-y-2.5 text-sm">
                {features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.04] p-6">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                  <Sparkles className="h-3 w-3" /> {yearly ? "Annual Plan" : "Flexible Monthly"}
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold">${displayPrice}</span>
                  <span className="text-sm text-slate-500">/ month</span>
                </div>
                {d.discountPercent > 0 && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Standard price ${d.originalPrice}/mo ({d.discountPercent}% campaign off)
                  </p>
                )}
              </div>

              <a href={checkoutTarget} className="ai-btn-primary mt-6 w-full py-3">
                Continue to Checkout
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
