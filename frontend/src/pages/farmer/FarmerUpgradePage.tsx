import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Crown,
  Globe,
  QrCode,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  Zap,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";

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

export default function FarmerUpgradePage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<UpgradeData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const [yearly, setYearly] = useState(true);

  const pricing = useMemo(() => {
    const monthlyBase = Math.max(0, Number(d.premiumPrice || 20));
    const originalMonthly = Math.max(monthlyBase, Number(d.originalPrice || monthlyBase));
    const yearlyDiscountPct = Math.max(0, Number(d.yearlyDiscountPercent || 0));

    // Match backend `premium_checkout()` annual rate rounding (`round(base * (1 - pct/100) * 12, 2)`).
    const yearlyTotal =
      Math.round(monthlyBase * (1 - yearlyDiscountPct / 100) * 12 * 100) / 100;
    const yearlyPerMonth = yearlyTotal / 12;
    const annualStandardTotal = originalMonthly * 12;
    const annualSavings = Math.max(0, annualStandardTotal - yearlyTotal);

    const effectivePerMonth = yearly ? yearlyPerMonth : monthlyBase;
    const comparePerMonth =
      yearly || d.discountPercent > 0 ? originalMonthly : null;

    return {
      monthlyBase,
      originalMonthly,
      yearlyDiscountPct,
      yearlyTotal,
      annualSavings,
      effectivePerMonthStr: effectivePerMonth.toFixed(2),
      comparePerMonthStr: comparePerMonth ? comparePerMonth.toFixed(2) : null,
      billedNowStr: (yearly ? yearlyTotal : monthlyBase).toFixed(2),
    };
  }, [d.discountPercent, d.originalPrice, d.premiumPrice, d.yearlyDiscountPercent, yearly]);

  const checkoutTarget = `${d.checkoutUrl}?billing=${yearly ? "yearly" : "monthly"}`;

  const starterItems = isKhmer
    ? [
        "ការវិនិច្ឆ័យរោគសញ្ញាដំណាំតាមច្បាប់មូលដ្ឋាន",
        "ការសាកល្បងជជែកជាមួយជំនួយការ AI មានដែនកំណត់",
        "ជជែកផ្ទាល់ជាមួយ Admin ឬអ្នកជំនាញកសិកម្ម",
        "ព័ត៌មានកសិកម្ម និងការជូនដំណឹងសហគមន៍",
      ]
    : [
        "Rule-based symptom crop diagnosis",
        "Starter allowance for AI Copilot consultations",
        "Live chat access to Platform Admin & Experts",
        "Curated agricultural news & platform alerts",
      ];

  const proItems = isKhmer
    ? [
        "វិនិច្ឆ័យរោគសញ្ញាដំណាំតាមច្បាប់ និង AI គ្មានដែនកំណត់",
        "ពិគ្រោះជាមួយអ្នកជំនាញ AI កសិកម្មជាភាសាខ្មែរ និងអង់គ្លេសគ្មានដែនកំណត់",
        "បញ្ជូនបន្តអាទិភាពទៅអ្នកជំនាញកសិកម្មផ្ទាល់",
        "ការព្រមានអាកាសធាតុ ភ្លៀង ខ្យល់ និងហានិភ័យសត្វល្អិតកម្រិតខ្ពស់",
        "សំឡេងអានលទ្ធផលវិនិច្ឆ័យជាភាសាខ្មែរ និងអង់គ្លេស",
      ]
    : [
        "Unlimited rule-based symptom & AI crop diagnosis",
        "Unlimited bilingual AI Agricultural Expert consultations",
        "Priority escalation & review by human specialists",
        "Advanced weekly rain, wind & pest risk advisories",
        "Spoken Khmer & English audio diagnosis narration",
      ];

  const pillars = [
    {
      Icon: Zap,
      title: isKhmer ? "បើកប្រើភ្លាមៗ" : "Instant Activation",
      desc: isKhmer
        ? "ទូទាត់តាម Bakong KHQR ឬ Card ហើយដំណើរការភ្លាមៗដោយស្វ័យប្រវត្តិ។"
        : "Automatic account upgrade seconds after Bakong KHQR or card verification.",
      tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      Icon: Stethoscope,
      title: isKhmer ? "អាទិភាពអ្នកជំនាញ" : "Expert Priority",
      desc: isKhmer
        ? "សំណួរចម្ការរបស់អ្នកត្រូវបានដាក់ជួរមុខសម្រាប់អ្នកជំនាញកសិកម្ម។"
        : "Field cases and urgent symptom diagnoses move straight to the specialist queue.",
      tone: "text-sky-600 bg-sky-500/10 dark:text-sky-400",
    },
    {
      Icon: Globe,
      title: isKhmer ? "ខ្មែរ & អង់គ្លេស" : "Khmer & English",
      desc: isKhmer
        ? "ការណែនាំ និងសំឡេងពន្យល់ពេញលេញជាភាសាខ្មែរ និងអង់គ្លេស។"
        : "Full localized text guidance and spoken audio readouts in both languages.",
      tone: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400",
    },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a
          href={d.dashboardUrl}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e3e6ed] bg-white px-3.5 text-xs font-semibold text-[#141824] shadow-sm transition hover:bg-[#f5f7fa] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6] dark:hover:bg-[#1c2233]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isKhmer ? "ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង" : "Back to Dashboard"}</span>
        </a>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Optional Campaign Banner */}
        {d.discountBanner && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-xs font-semibold text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Tag className="h-3.5 w-3.5" />
              </span>
              <span>{d.discountBanner}</span>
            </div>
            {d.discountPercent > 0 && (
              <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                -{Math.round(d.discountPercent)}% OFF
              </span>
            )}
          </div>
        )}

        {/* Executive Overview & Billing Switcher */}
        <section className="ai-surface rounded-3xl p-5 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300">
                <Crown className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សមាជិកភាព PRO" : "Pro Membership"}</span>
              </div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#141824] dark:text-[#eff2f6] sm:text-3xl">
                {isKhmer
                  ? "ដំឡើងសមត្ថភាពការពារដំណាំពេញមួយរដូវកាល"
                  : "Full-season AI crop intelligence & specialist support"}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                {isKhmer
                  ? "ទទួលបានការវិនិច្ឆ័យរោគសញ្ញាដំណាំគ្មានដែនកំណត់ ការប្រឹក្សា AI កសិកម្មពីរភាសា និងអាទិភាពពិនិត្យពីអ្នកជំនាញ។"
                  : "Unlock unlimited symptom-based crop diagnostics, bilingual AI agronomy consultations, and priority review from our field specialists."}
              </p>
            </div>

            {/* Segmented Monthly / Yearly Toggle */}
            <div className="w-full shrink-0 sm:w-auto">
              <div
                role="group"
                aria-label={isKhmer ? "ជម្រើសការទូទាត់" : "Billing cycle"}
                className="grid w-full grid-cols-2 rounded-2xl border border-[#e3e6ed] bg-[#f5f7fa] p-1 dark:border-[#2b3245] dark:bg-[#0f111a] sm:inline-flex sm:w-auto"
              >
                <button
                  type="button"
                  onClick={() => setYearly(false)}
                  aria-pressed={!yearly}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:px-4",
                    !yearly
                      ? "bg-white text-[#141824] shadow-sm dark:bg-[#1c2233] dark:text-white"
                      : "text-[#525b75] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-white",
                  )}
                >
                  {isKhmer ? "ប្រចាំខែ" : "Monthly"}
                </button>
                <button
                  type="button"
                  onClick={() => setYearly(true)}
                  aria-pressed={yearly}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-4",
                    yearly
                      ? "bg-white text-[#141824] shadow-sm dark:bg-[#1c2233] dark:text-white"
                      : "text-[#525b75] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-white",
                  )}
                >
                  <span>{isKhmer ? "ប្រចាំឆ្នាំ" : "Yearly"}</span>
                  {pricing.yearlyDiscountPct > 0 && (
                    <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white sm:px-2">
                      {isKhmer
                        ? `សន្សំ ${Math.round(pricing.yearlyDiscountPct)}%`
                        : `Save ${Math.round(pricing.yearlyDiscountPct)}%`}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Tier Comparison Grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Standard Plan */}
          <section className="order-2 flex min-w-0 flex-col justify-between rounded-3xl border border-[#e3e6ed] bg-white p-5 dark:border-[#2b3245] dark:bg-[#141824] sm:p-6 lg:order-1 lg:col-span-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-[#141824] dark:text-[#eff2f6]">
                  {isKhmer ? "គណនីស្តង់ដារ" : "Standard Farmer"}
                </h3>
                <span className="rounded-full border border-[#e3e6ed] bg-[#f5f7fa] px-2.5 py-0.5 text-[11px] font-semibold text-[#525b75] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#9fa6bc]">
                  {isKhmer ? "កំពុងប្រើបច្ចុប្បន្ន" : "Current Plan"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer
                  ? "ឧបករណ៍មូលដ្ឋានសម្រាប់ការចាប់ផ្តើមថែទាំដំណាំ"
                  : "Essential field tools included with every account"}
              </p>

              <div className="mt-5 flex items-baseline gap-1.5 border-b border-[#e3e6ed] pb-5 dark:border-[#2b3245]">
                <span className="font-display text-3xl font-extrabold tabular-nums text-[#141824] dark:text-white">
                  $0
                </span>
                <span className="text-xs font-medium text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "/ ឥតគិតថ្លៃ" : "/ free"}
                </span>
              </div>

              <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "អ្វីដែលមានរួច" : "Included now"}
              </p>
              <ul className="mt-3 space-y-3 text-sm">
                {starterItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f5f7fa] text-[#6e7891] dark:bg-[#1c2233] dark:text-[#9fa6bc]">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-[13px] leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-2xl border border-[#e3e6ed] bg-[#f9fafc] px-4 py-3 text-xs text-[#6e7891] dark:border-[#2b3245] dark:bg-[#111521] dark:text-[#8a94ad]">
              {isKhmer
                ? "គណនីរបស់អ្នកអាចដំឡើងទៅ Pro គ្រប់ពេលដោយមិនបាត់បង់ប្រវត្តិវិភាគឡើយ។"
                : "Your saved diagnoses and farm history stay intact when you upgrade."}
            </div>
          </section>

          {/* Pro Plan */}
          <section className="order-1 relative flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border-2 border-emerald-500/70 bg-white p-5 shadow-sm ring-4 ring-emerald-500/[0.06] dark:border-emerald-500/60 dark:bg-[#141824] sm:p-7 lg:order-2 lg:col-span-7">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-extrabold text-[#141824] dark:text-white">
                        AGRI SYSTEM Pro
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <Sparkles className="h-3 w-3" />
                        {isKhmer ? "ណែនាំ" : "Recommended"}
                      </span>
                    </div>
                    <p className="text-xs text-[#525b75] dark:text-[#9fa6bc]">
                      {isKhmer
                        ? "សម្រាប់ការការពារដំណាំកម្រិតអាជីព"
                        : "Built for active growers and commercial plots"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Display */}
              <div className="mt-5 rounded-2xl border border-[#e3e6ed] bg-[#f9fafc] p-5 dark:border-[#2b3245] dark:bg-[#101420]">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="font-display text-4xl font-extrabold tracking-tight tabular-nums text-[#141824] dark:text-white sm:text-5xl">
                    ${pricing.effectivePerMonthStr}
                  </span>
                  <span className="text-sm font-medium text-[#525b75] dark:text-[#9fa6bc]">
                    {isKhmer ? "/ ខែ" : "/ month"}
                  </span>
                  {pricing.comparePerMonthStr && (
                    <span className="ml-1 text-sm font-semibold text-[#8a94ad] line-through tabular-nums">
                      ${pricing.comparePerMonthStr}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {yearly
                      ? isKhmer
                        ? `ទូទាត់ប្រចាំឆ្នាំ $${pricing.billedNowStr} (៣៦៥ ថ្ងៃ)`
                        : `Billed $${pricing.billedNowStr} yearly (365 days)`
                      : isKhmer
                        ? `ទូទាត់ប្រចាំខែ $${pricing.billedNowStr} (៣០ ថ្ងៃ)`
                        : `Billed $${pricing.billedNowStr} monthly (30 days)`}
                  </span>
                  {yearly && pricing.annualSavings > 0 && (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      {isKhmer
                        ? `សន្សំបាន $${pricing.annualSavings.toFixed(2)}/ឆ្នាំ`
                        : `Save $${pricing.annualSavings.toFixed(2)}/yr`}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "អត្ថប្រយោជន៍ទាំងអស់ក្នុង PRO" : "Everything in Pro"}
              </p>
              <ul className="mt-3 space-y-3">
                {proItems.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA & Payment Trust Row */}
            <div className="mt-7 space-y-4 border-t border-[#e3e6ed] pt-5 dark:border-[#2b3245]">
              <a
                href={checkoutTarget}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <span>
                  {isKhmer
                    ? `បន្តទៅការទូទាត់ ($${pricing.billedNowStr})`
                    : `Continue to Checkout ($${pricing.billedNowStr})`}
                </span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                <span className="inline-flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Bakong KHQR</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span>PayPal / Card</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{isKhmer ? "ប្រើប្រាស់កូដបញ្ចុះតម្លៃបាន" : "Promo codes supported"}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{isKhmer ? "ផ្ទៀងផ្ទាត់ដោយសុវត្ថិភាព" : "Verified checkout"}</span>
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* 3 Value Pillars */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {pillars.map(({ Icon, title, desc, tone }) => (
            <div
              key={title}
              className="rounded-2xl border border-[#e3e6ed] bg-white p-5 dark:border-[#2b3245] dark:bg-[#141824]"
            >
              <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-[#141824] dark:text-[#eff2f6]">{title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#6e7891] dark:text-[#8a94ad]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}
