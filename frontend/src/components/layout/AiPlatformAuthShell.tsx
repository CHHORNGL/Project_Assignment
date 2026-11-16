import React from "react";
import { Activity, ArrowLeft, Cpu, Globe2, ShieldCheck } from "lucide-react";
import type { LanguageCode } from "@/types/app";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export const AUTH_INPUT_CLASS =
  "w-full rounded-xl border border-neutral-200 bg-white py-2.5 pr-3.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-neutral-300 dark:focus:ring-white/10";

export const AUTH_PRIMARY_BTN_CLASS =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200";

export const AUTH_SECONDARY_BTN_CLASS =
  "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 text-xs sm:text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800";

export interface AiPlatformAuthShellProps {
  lang: LanguageCode;
  enUrl?: string;
  kmUrl?: string;
  homeUrl?: string;
  logoLight?: string;
  logoDark?: string;
  portalLabel?: string;
  headline?: string;
  subheadline?: string;
  children: React.ReactNode;
}

export function AiPlatformAuthShell({
  lang,
  enUrl,
  kmUrl,
  homeUrl = "/",
  logoLight = "/static/img/newlogo.svg",
  logoDark = "/static/img/newlogo-dark.svg",
  portalLabel = "AGRI SYSTEM WORKSPACE",
  headline,
  subheadline,
  children,
}: AiPlatformAuthShellProps) {
  const isKhmer = lang === "km";

  const resolvedHeadline =
    headline ||
    (isKhmer
      ? "វេទិកាកសិកម្មឆ្លាតវៃ និងការវិនិច្ឆ័យច្បាស់លាស់"
      : "Precision Crop Diagnostics & Agronomy Workspace");
  const resolvedSubheadline =
    subheadline ||
    (isKhmer
      ? "វិភាគជំងឺដំណាំ ការព្យាករណ៍អាកាសធាតុ និងការពិគ្រោះជាមួយអ្នកជំនាញកសិកម្ម ក្នុងប្រព័ន្ធតែមួយ។"
      : "Rule-verified plant pathology, conversational AI guidance, and direct specialist review unified in one workspace.");

  const capabilities = isKhmer
    ? [
        {
          icon: Cpu,
          title: "ប្រព័ន្ធវិភាគ AI និងក្បួនច្បាប់",
          desc: "ផ្ទៀងផ្ទាត់រោគសញ្ញាដំណាំ និងរូបភាពដោយស្វ័យប្រវត្តិ។",
        },
        {
          icon: Activity,
          title: "ព័ត៌មានអាកាសធាតុផ្ទាល់",
          desc: "តាមដានហានិភ័យជំងឺតាមតំបន់ និងការព្រមានទាន់ពេល។",
        },
        {
          icon: ShieldCheck,
          title: "សុវត្ថិភាព Passkey & OAuth",
          desc: "ការពារគណនីជាមួយការផ្ទៀងផ្ទាត់ ២ ជាន់ និងជីវមាត្រ។",
        },
      ]
    : [
        {
          icon: Cpu,
          title: "Rule + AI Inference Engine",
          desc: "Cross-checks field observations against verified crop pathology rules.",
        },
        {
          icon: Activity,
          title: "Live Agro-Weather Telemetry",
          desc: "Localized forecast insights and resilient risk advisories.",
        },
        {
          icon: ShieldCheck,
          title: "Passkey, 2FA & Google Auth",
          desc: "Hardware-backed WebAuthn sign-in and audited sessions.",
        },
      ];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-50">
      {/* Subtle monochrome top radial wash matching landing page */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[440px] bg-[radial-gradient(ellipse_at_top,_rgba(23,23,23,0.045),_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.05),_transparent_70%)]"
        aria-hidden="true"
      />

      {/* Minimal sticky auth utility header */}
      <header className="relative z-20 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href={homeUrl}
            className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-85"
          >
            <img src={logoLight} alt="AGRI SYSTEM" className="h-7 w-7 dark:hidden" />
            <img src={logoDark} alt="AGRI SYSTEM" className="hidden h-7 w-7 dark:block" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
                AGRI SYSTEM
              </span>
              <span className="hidden h-3.5 w-px bg-neutral-200 dark:bg-neutral-800 sm:inline-block" />
              <span className="hidden text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:inline-block">
                {portalLabel}
              </span>
            </div>
          </a>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <a
              href={homeUrl}
              className="hidden h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{isKhmer ? "ទំព័រដើម" : "Home"}</span>
            </a>
            <LanguageSwitcher lang={lang} enUrl={enUrl} kmUrl={kmUrl} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main split platform grid */}
      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-8 lg:py-14">
        {/* Left narrative + capability showcase */}
        <section className="hidden space-y-7 lg:col-span-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span>{isKhmer ? "ប្រព័ន្ធកសិកម្មកំពុងដំណើរការ" : "Precision Agronomy Platform"}</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-900 dark:text-white xl:text-4xl">
              {resolvedHeadline}
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-base">
              {resolvedSubheadline}
            </p>
          </div>

          <div className="grid gap-3">
            {capabilities.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3.5 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 pt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5" />
              {isKhmer ? "ភាសាខ្មែរ (Kantumruy Pro) & English" : "Khmer & English Native"}
            </span>
            <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-800" />
            <span>{isKhmer ? "ការពារដោយ Audit & CSRF" : "Audited RBAC & CSRF Security"}</span>
          </div>
        </section>

        {/* Right interactive form card */}
        <section className="mx-auto w-full max-w-[440px] lg:col-span-6 lg:max-w-[460px]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/[0.04] dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-black/40 sm:p-8">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
