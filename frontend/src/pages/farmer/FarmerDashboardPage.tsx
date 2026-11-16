import React from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Crown,
  MessageSquare,
  Newspaper,
  Sparkles,
  Sprout,
  Stethoscope,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AnnouncementMarquee,
  type MarqueeBannerItem,
} from "@/components/farmer/AnnouncementMarquee";
import { WeatherIntelligenceCard } from "@/components/farmer/WeatherIntelligenceCard";
import { cn } from "@/lib/utils";

interface FarmerDashboardData {
  totalDiagnoses: number;
  averageConfidence: number;
  diagnoses: Array<{
    id: number;
    cropName: string;
    diseaseName: string;
    status: string;
    statusLabel: string;
    confidence: number;
    createdAt?: string | null;
    resultUrl: string;
  }>;
  aiQuestions: Array<{
    id: number;
    message: string;
    createdAt?: string | null;
    chatUrl: string;
    title: string;
  }>;
  crops: Array<{ id: number; name: string; diagnoseUrl: string }>;
  marquees: MarqueeBannerItem[];
  isPremium: boolean;
  aiCredits: number;
  upgradeUrl: string;
  historyUrl: string;
  diseasesUrl: string;
  newsUrl?: string;
  diagnoseClassicUrl?: string;
  weather: {
    endpoint: string;
    lang: "en" | "km";
    fallbackLat: number;
    fallbackLon: number;
  };
}

function statusPillClass(status?: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") {
    return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (s === "REJECTED") {
    return "border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (s === "PENDING") {
    return "border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
}

function normalizePct(val: number): number {
  const pct = val <= 1 ? val * 100 : val;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function formatDateLabel(raw?: string | null): string {
  if (!raw) return "";
  return raw.slice(0, 16).replace("T", " ");
}

export default function FarmerDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<FarmerDashboardData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const table = ui.table || {};

  const entryCards = (ui.entryCards || []) as Array<{
    title: string;
    description: string;
    href: string;
    primary?: boolean;
  }>;

  const firstName = (
    bootstrap.user?.full_name ||
    bootstrap.user?.username ||
    (isKhmer ? "កសិករ" : "Farmer")
  )
    .trim()
    .split(/\s+/)[0];

  const primaryAction = entryCards[0] || {
    title: isKhmer ? "ចាប់ផ្តើមវិនិច្ឆ័យ" : "Guided Diagnosis",
    href: "/farmer/diagnose/rule-based",
  };

  const avgConfPct = normalizePct(d.averageConfidence || 0);

  const stats = [
    {
      label: metrics.diagnoses || (isKhmer ? "វិនិច្ឆ័យសរុប" : "Total Diagnoses"),
      meta: metrics.diagnosesMeta || (isKhmer ? "កំណត់ត្រាកសិដ្ឋាន" : "Recorded field scans"),
      value: d.totalDiagnoses,
      href: d.historyUrl,
      icon: Activity,
      color: "text-indigo-600 bg-indigo-500/10 ring-1 ring-indigo-500/20 dark:text-indigo-300",
    },
    {
      label: metrics.crops || (isKhmer ? "ដំណាំគាំទ្រ" : "Tracked Crops"),
      meta: metrics.cropsMeta || (isKhmer ? "ដំណាំត្រៀមវិនិច្ឆ័យ" : "Ready in catalog"),
      value: d.crops.length,
      href: primaryAction.href,
      icon: Sprout,
      color: "text-emerald-600 bg-emerald-500/10 ring-1 ring-emerald-500/20 dark:text-emerald-300",
    },
    {
      label: metrics.questions || (isKhmer ? "សំណួរ AI" : "AI Questions"),
      meta: metrics.questionsMeta || (isKhmer ? "សន្ទនាជាមួយអ្នកជំនាញ" : "Recent copilot threads"),
      value: d.aiQuestions.length,
      href: "/farmer/chat",
      icon: Bot,
      color: "text-sky-600 bg-sky-500/10 ring-1 ring-sky-500/20 dark:text-sky-300",
    },
    {
      label: metrics.confidence || (isKhmer ? "ភាពជឿជាក់មធ្យម" : "Avg Confidence"),
      meta: metrics.confidenceMeta || (isKhmer ? "សញ្ញាភាពត្រឹមត្រូវ" : "Engine signal strength"),
      value: `${avgConfPct}%`,
      progress: avgConfPct,
      icon: CheckCircle2,
      color: "text-amber-600 bg-amber-500/10 ring-1 ring-amber-500/20 dark:text-amber-300",
    },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        !d.isPremium ? (
          <a
            href={d.upgradeUrl}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/12 px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>
              {d.aiCredits} {isKhmer ? "ក្រេឌីត AI · ដំឡើង Pro" : "AI Credits · Upgrade"}
            </span>
          </a>
        ) : (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <Crown className="h-3.5 w-3.5" />
            <span>{isKhmer ? "គណនី Pro សកម្ម" : "Pro Active"}</span>
          </span>
        )
      }
    >
      <div className="space-y-6">
        {/* Announcement Marquee */}
        <AnnouncementMarquee
          marquees={d.marquees}
          isKhmer={isKhmer}
          badgeLabel={isKhmer ? "ព័ត៌មានថ្មី" : "Update"}
        />

        {/* Executive Welcome Hero + Action Launchpad */}
        <section className="grid gap-5 lg:grid-cols-12">
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-indigo-500/20 lg:col-span-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-indigo-50 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isKhmer ? "មជ្ឈមណ្ឌលកសិកម្មឆ្លាតវៃ" : "Smart Farm Command"}</span>
              </div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-[1.65rem]">
                {isKhmer ? `សួស្តី, ${firstName}!` : `Welcome back, ${firstName}`}
              </h2>
              <p className="max-w-md text-xs leading-relaxed text-indigo-100/95 sm:text-[13px]">
                {isKhmer
                  ? "ពិនិត្យរោគសញ្ញាដំណាំ តាមដានអាកាសធាតុ ពិនិត្យប្រវត្តិវិនិច្ឆ័យ និងពិគ្រោះជាមួយជំនួយការ AI ភ្លាមៗ។"
                  : "Evaluate crop symptoms, monitor local weather advisories, track history, and consult AGRI AI in seconds."}
              </p>
            </div>

            <div className="relative mt-6 flex flex-wrap items-center gap-2.5">
              <a
                href={primaryAction.href}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
              >
                <Stethoscope className="h-4 w-4" />
                <span>{primaryAction.title}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="/farmer/chat"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សួរ AI" : "Ask AI"}</span>
              </a>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
            {entryCards.map((card, i) => {
              const Icon = i === 0 ? Stethoscope : i === 1 ? ClipboardList : MessageSquare;
              const badgeTone =
                i === 0
                  ? "bg-indigo-500/12 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-300"
                  : i === 1
                    ? "bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-300"
                    : "bg-sky-500/12 text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-300";
              return (
                <a
                  key={card.href}
                  href={card.href}
                  className="ai-surface ai-card-hover group flex flex-col justify-between p-5"
                >
                  <div>
                    <div className={cn("mb-3.5 flex h-11 w-11 items-center justify-center rounded-2xl", badgeTone)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-sm font-bold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-300">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {card.description}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <span>{isKhmer ? "ចាប់ផ្តើម" : "Open tool"}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        {/* KPI Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((st) => {
            const Icon = st.icon;
            const inner = (
              <div className="ai-surface ai-card-hover flex h-full flex-col justify-between p-4.5 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {st.label}
                    </p>
                    <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
                      {st.value}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {st.meta}
                    </p>
                  </div>
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", st.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                {typeof st.progress === "number" && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-obsidian-800">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        st.progress >= 80
                          ? "bg-emerald-500"
                          : st.progress >= 50
                            ? "bg-amber-500"
                            : "bg-indigo-500",
                      )}
                      style={{ width: `${st.progress}%` }}
                    />
                  </div>
                )}
              </div>
            );

            return st.href ? (
              <a key={st.label} href={st.href} className="block focus:outline-none">
                {inner}
              </a>
            ) : (
              <div key={st.label}>{inner}</div>
            );
          })}
        </section>

        {/* Weather Intelligence */}
        <WeatherIntelligenceCard
          endpoint={d.weather.endpoint}
          lang={d.weather.lang}
          fallbackLat={d.weather.fallbackLat}
          fallbackLon={d.weather.fallbackLon}
          labels={bootstrap.ui.weather || {}}
        />

        {/* Recent Diagnoses & AI Questions */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="ai-surface overflow-hidden lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/75 px-5 py-4 dark:border-slate-800/80">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  {sections.diagnosisHistory || "Recent Diagnoses"}
                </h2>
                {sections.diagnosisHistorySubtitle && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {sections.diagnosisHistorySubtitle}
                  </p>
                )}
              </div>
              <a
                href={d.historyUrl}
                className="ai-btn-secondary h-8 gap-1 px-3 text-xs"
              >
                <span>{isKhmer ? "មើលទាំងអស់" : "View all"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {d.diagnoses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {table.emptyTitle || (isKhmer ? "មិនទាន់មានប្រវត្តិវិនិច្ឆ័យ" : "No diagnosis history")}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {table.emptyText || "Start your first guided diagnosis to see field results here."}
                </p>
                <a href={primaryAction.href} className="ai-btn-primary mt-4 h-9 gap-1.5 px-4 text-xs">
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "ចាប់ផ្តើមវិនិច្ឆ័យដំបូង" : "Start diagnosis"}</span>
                </a>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200/75 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-obsidian-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-bold">{table.crop || (isKhmer ? "ដំណាំ" : "Crop")}</th>
                      <th className="px-4 py-3 font-bold">{isKhmer ? "លទ្ធផលវិនិច្ឆ័យ" : "Diagnosis"}</th>
                      <th className="px-4 py-3 font-bold">{table.status || (isKhmer ? "ស្ថានភាព" : "Status")}</th>
                      <th className="px-4 py-3 font-bold">{table.confidence || (isKhmer ? "ភាពជឿជាក់" : "Confidence")}</th>
                      <th className="px-5 py-3 text-right font-bold">{table.open || (isKhmer ? "សកម្មភាព" : "Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                    {d.diagnoses.map((row) => {
                      const pct = normalizePct(row.confidence || 0);
                      return (
                        <tr key={row.id} className="ai-table-row">
                          <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                            {row.cropName}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {row.diseaseName}
                            </div>
                            {row.createdAt && (
                              <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10.5px] text-slate-400">
                                <Calendar className="h-3 w-3" />
                                {formatDateLabel(row.createdAt)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
                                statusPillClass(row.status),
                              )}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200 dark:bg-obsidian-800">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    pct >= 80
                                      ? "bg-emerald-500"
                                      : pct >= 50
                                        ? "bg-amber-500"
                                        : "bg-rose-500",
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <a
                              href={row.resultUrl}
                              className="ai-btn-secondary h-7 gap-1 px-2.5 text-[11px]"
                            >
                              <span>{table.viewResult || (isKhmer ? "បើក" : "View")}</span>
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="ai-surface p-5">
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  {sections.aiQuestions || "Recent AI Questions"}
                </h2>
                <a
                  href="/farmer/chat"
                  className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {isKhmer ? "សន្ទនាថ្មី" : "New chat"}
                </a>
              </div>

              {d.aiQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200/80 p-4 text-center text-xs dark:border-slate-800">
                  <p className="text-slate-500 dark:text-slate-400">
                    {sections.noAiQuestions || "No AI questions yet."}
                  </p>
                  <a href="/farmer/chat" className="ai-btn-secondary mt-3 h-8 gap-1.5 px-3 text-xs">
                    <Bot className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "សួរ AI ឥឡូវនេះ" : "Ask AGRI AI"}</span>
                  </a>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {d.aiQuestions.map((q) => (
                    <li key={q.id}>
                      <a
                        href={q.chatUrl}
                        className="group block rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs transition hover:border-indigo-500/45 hover:bg-white dark:border-slate-800 dark:bg-obsidian-950/40 dark:hover:bg-obsidian-850"
                      >
                        <p className="line-clamp-2 font-medium leading-relaxed text-slate-800 dark:text-slate-100">
                          {q.message}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="h-3 w-3" />
                            <span className="truncate max-w-[140px]">
                              {q.title || (isKhmer ? "បន្តការសន្ទនា" : "Continue thread")}
                            </span>
                          </span>
                          {q.createdAt && (
                            <span className="font-mono text-[10px] text-slate-400">
                              {formatDateLabel(q.createdAt)}
                            </span>
                          )}
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="ai-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  {sections.crops || "Quick Crop Launch"}
                </h2>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  {d.newsUrl && (
                    <a
                      href={d.newsUrl}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
                    >
                      <Newspaper className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "ព័ត៌មាន" : "News"}</span>
                    </a>
                  )}
                </div>
              </div>
              {d.crops.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {sections.noCrops || "No crops available yet."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {d.crops.map((crop) => (
                    <a
                      key={crop.id}
                      href={crop.diagnoseUrl}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-500 hover:bg-indigo-50/40 hover:text-indigo-600 dark:border-slate-800 dark:bg-obsidian-950/60 dark:text-slate-200 dark:hover:border-indigo-500/60 dark:hover:text-indigo-300"
                    >
                      <Sprout className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{crop.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
