import React from "react";
import { Sparkles, ShieldCheck, Cpu, Globe2, Activity } from "lucide-react";
import type { LanguageCode } from "@/types/app";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

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
  portalLabel = "AGRI AI PLATFORM",
  headline,
  subheadline,
  children,
}: AiPlatformAuthShellProps) {
  const isKhmer = lang === "km";

  const resolvedHeadline =
    headline ||
    (isKhmer
      ? "វេទិកាបញ្ញាសិប្បនិម្មិត សម្រាប់កសិកម្មឆ្លាតវៃ"
      : "Autonomous Crop Intelligence & Precision Diagnosis");
  const resolvedSubheadline =
    subheadline ||
    (isKhmer
      ? "វិភាគជំងឺដំណាំ ការព្យាករណ៍អាកាសធាតុ និងការពិគ្រោះជាមួយអ្នកជំនាញកសិកម្ម ក្នុងប្រព័ន្ធតែមួយ។"
      : "Real-time pathogen inference, localized agronomic rules, and instant specialist escalation unified on one AI platform.");

  const capabilities = isKhmer
    ? [
        {
          icon: Cpu,
          title: "ប្រព័ន្ធវិភាគ AI និងក្បួនខ្នាត",
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
          title: "Hybrid Neural + Rule Engine",
          desc: "Cross-checks field imagery against verified crop pathology rules.",
        },
        {
          icon: Activity,
          title: "Live Agro-Weather Telemetry",
          desc: "Region-aware risk alerts and multi-provider weather resilience.",
        },
        {
          icon: ShieldCheck,
          title: "Enterprise Passkey & 2FA Security",
          desc: "Hardware-backed WebAuthn authentication and audited sessions.",
        },
      ];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-obsidian-950 dark:text-slate-100">
      {/* Ambient neural mesh background */}
      <div className="pointer-events-none fixed inset-0 ai-grid-pattern opacity-80" aria-hidden="true" />
      <div
        className="pointer-events-none fixed -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-indigo-500/15 blur-[120px] dark:bg-indigo-600/20"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-32 right-1/5 h-[28rem] w-[28rem] rounded-full bg-emerald-500/12 blur-[110px] dark:bg-emerald-500/15"
        aria-hidden="true"
      />

      {/* Top utility header */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a
          href={homeUrl}
          className="group inline-flex items-center gap-3 rounded-2xl px-2 py-1 transition-opacity hover:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-white shadow-sm dark:border-indigo-400/20 dark:bg-obsidian-900">
            <img src={logoLight} alt="Agri System" className="h-6 w-6 dark:hidden" />
            <img src={logoDark} alt="Agri System" className="hidden h-6 w-6 dark:block" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                AGRI SYSTEM
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                <Sparkles className="h-2.5 w-2.5" />
                AI 2.0
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {portalLabel}
            </p>
          </div>
        </a>

        <div className="flex items-center gap-2.5">
          <LanguageSwitcher lang={lang} enUrl={enUrl} kmUrl={kmUrl} />
          <ThemeToggle />
        </div>
      </header>

      {/* Main split platform grid */}
      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-2 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-8">
        {/* Left AI narrative + telemetry showcase */}
        <section className="hidden space-y-7 lg:col-span-6 lg:block animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>{isKhmer ? "ម៉ាស៊ីនវិភាគ AI កំពុងដំណើរការ" : "Inference Engine Online"}</span>
          </div>

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight text-slate-900 dark:text-white xl:text-[2.75rem]">
              {resolvedHeadline}
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {resolvedSubheadline}
            </p>
          </div>

          <div className="grid gap-3.5">
            {capabilities.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-md transition-all hover:border-indigo-300/70 dark:border-slate-800/80 dark:bg-obsidian-900/65 dark:hover:border-indigo-500/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-emerald-500/15 text-indigo-600 dark:text-indigo-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-5 pt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5 text-indigo-500" />
              {isKhmer ? "ភាសាខ្មែរ & English" : "Khmer & English Native"}
            </span>
            <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
            <span>SOC-aligned Audit &amp; CSRF Protection</span>
          </div>
        </section>

        {/* Right interactive card */}
        <section className="mx-auto w-full max-w-[460px] lg:col-span-6 lg:max-w-[480px] animate-fade-in-up">
          <div className="ai-surface p-6 sm:p-8">{children}</div>
        </section>
      </main>
    </div>
  );
}
