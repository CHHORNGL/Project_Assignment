import React from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  Crown,
  Megaphone,
  MessageSquare,
  ScanLine,
  Sparkles,
  Sprout,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
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
  marquees: Array<{ id: number; text: string }>;
  isPremium: boolean;
  aiCredits: number;
  upgradeUrl: string;
  historyUrl: string;
  diseasesUrl: string;
  weather: {
    endpoint: string;
    lang: "en" | "km";
    fallbackLat: number;
    fallbackLon: number;
  };
}

export default function FarmerDashboardPage({ bootstrap }: { bootstrap: AppBootstrap<FarmerDashboardData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const entryCards = (bootstrap.ui.entryCards || []) as Array<{
    title: string;
    description: string;
    href: string;
    primary?: boolean;
  }>;

  const stats = [
    { label: bootstrap.ui.metrics?.diagnoses || "Total Diagnoses", value: d.totalDiagnoses, icon: Activity, color: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-300" },
    { label: bootstrap.ui.metrics?.crops || "Tracked Crops", value: d.crops.length, icon: Sprout, color: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300" },
    { label: bootstrap.ui.metrics?.questions || "AI Questions", value: d.aiQuestions.length, icon: Bot, color: "text-blue-600 bg-blue-500/10 dark:text-blue-300" },
    { label: bootstrap.ui.metrics?.confidence || "Avg Confidence", value: `${d.averageConfidence}%`, icon: CheckCircle2, color: "text-amber-600 bg-amber-500/10 dark:text-amber-300" },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        !d.isPremium ? (
          <a href={d.upgradeUrl} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 text-xs font-bold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            {d.aiCredits} AI Credits · Upgrade
          </a>
        ) : (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <Crown className="h-3.5 w-3.5" /> Pro Active
          </span>
        )
      }
    >
      <div className="space-y-6">
        {/* Announcement Marquee */}
        {d.marquees && d.marquees.length > 0 && (
          <div className="ai-surface flex items-center gap-3 px-4 py-2.5 text-xs">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 font-bold text-white">
              <Megaphone className="h-3 w-3" /> Update
            </span>
            <p className="truncate font-medium text-slate-700 dark:text-slate-200">
              {d.marquees.map((m) => m.text).join("  ·  ")}
            </p>
          </div>
        )}

        {/* Quick Action Hero Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {entryCards.map((card, i) => {
            const Icon = i === 0 ? ScanLine : i === 1 ? Camera : MessageSquare;
            return (
              <a
                key={card.href}
                href={card.href}
                className={cn(
                  "group flex flex-col justify-between rounded-2xl p-5 transition-all hover:-translate-y-0.5",
                  card.primary
                    ? "bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/25"
                    : "ai-surface hover:border-indigo-500/40",
                )}
              >
                <div>
                  <div
                    className={cn(
                      "mb-3 flex h-10 w-10 items-center justify-center rounded-xl",
                      card.primary ? "bg-white/15 text-white" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-base font-bold">{card.title}</h2>
                  <p className={cn("mt-1 text-xs leading-relaxed", card.primary ? "text-indigo-100" : "text-slate-500 dark:text-slate-400")}>
                    {card.description}
                  </p>
                </div>
                <span className={cn("mt-4 inline-flex items-center gap-1 text-xs font-bold", card.primary ? "text-white" : "text-indigo-600 dark:text-indigo-400")}>
                  {isKhmer ? "ចាប់ផ្តើម" : "Open"}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </a>
            );
          })}
        </div>

        {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((st) => {
            const Icon = st.icon;
            return (
              <div key={st.label} className="ai-surface flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{st.label}</p>
                  <p className="mt-1 font-display text-2xl font-extrabold">{st.value}</p>
                </div>
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", st.color)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Weather Intelligence */}
        <WeatherIntelligenceCard
          endpoint={d.weather.endpoint}
          lang={d.weather.lang}
          fallbackLat={d.weather.fallbackLat}
          fallbackLon={d.weather.fallbackLon}
          labels={bootstrap.ui.weather || {}}
        />

        {/* Recent Diagnoses & AI Questions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="ai-surface p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">
                {bootstrap.ui.sections?.diagnosisHistory || "Recent Diagnoses"}
              </h2>
              <a href={d.historyUrl} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                {isKhmer ? "មើលទាំងអស់" : "View all"} →
              </a>
            </div>
            {d.diagnoses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
                {bootstrap.ui.table?.emptyText || "No diagnosis history yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/70 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                      <th className="py-2 pr-3">Crop</th>
                      <th className="py-2 pr-3">Diagnosis</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Confidence</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {d.diagnoses.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2.5 pr-3 font-semibold">{row.cropName}</td>
                        <td className="py-2.5 pr-3">{row.diseaseName}</td>
                        <td className="py-2.5 pr-3">
                          <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono">
                          {row.confidence <= 1 ? `${(row.confidence * 100).toFixed(0)}%` : `${row.confidence.toFixed(0)}%`}
                        </td>
                        <td className="py-2.5 text-right">
                          <a href={row.resultUrl} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                            Open
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="ai-surface p-5">
              <h2 className="mb-3 font-display text-base font-bold">
                {bootstrap.ui.sections?.aiQuestions || "Recent AI Questions"}
              </h2>
              {d.aiQuestions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {bootstrap.ui.sections?.noAiQuestions || "No AI questions yet."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {d.aiQuestions.map((q) => (
                    <li key={q.id}>
                      <a
                        href={q.chatUrl}
                        className="block rounded-xl border border-slate-200/80 p-3 text-xs transition hover:border-indigo-500/40 dark:border-slate-800"
                      >
                        <p className="line-clamp-2 font-medium">{q.message}</p>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                          <Sparkles className="h-3 w-3" /> {q.title || "Continue thread"}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="ai-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold">{bootstrap.ui.sections?.crops || "Quick Crop Launch"}</h2>
                <a href={d.diseasesUrl} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Atlas</a>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.crops.map((crop) => (
                  <a
                    key={crop.id}
                    href={crop.diagnoseUrl}
                    className="rounded-xl border border-slate-200/80 px-3 py-1.5 text-xs font-semibold transition hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-800 dark:hover:text-indigo-300"
                  >
                    {crop.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
