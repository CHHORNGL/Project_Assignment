import React, { useState } from "react";
import { Globe, Loader2, Megaphone, Newspaper, RefreshCw, Volume2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { requestJson } from "@/lib/api";

interface NewsData {
  generateUrl: string;
  ttsUrl: string;
  marquees: Array<{ id: number; text: string; text_kh?: string; created_at?: string }>;
  initialNews: {
    headline?: string;
    summary?: string;
    articles?: Array<{ title?: string; summary?: string; category?: string; impact?: string }>;
    [key: string]: unknown;
  };
}

export default function FarmerNewsPage({ bootstrap }: { bootstrap: AppBootstrap<NewsData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [region, setRegion] = useState("cambodia");
  const [news, setNews] = useState(d.initialNews || {});
  const [marquees, setMarquees] = useState(d.marquees || []);
  const [loading, setLoading] = useState(false);

  const refreshNews = async (force = true) => {
    setLoading(true);
    try {
      const sep = d.generateUrl.includes("?") ? "&" : "?";
      const res = await requestJson<{ news?: any; marquees?: any[] }>(
        `${d.generateUrl}${sep}region=${encodeURIComponent(region)}&lang=${bootstrap.lang}&force=${force}`,
        "GET",
      );
      if (res.ok) {
        if (res.data.news) setNews(res.data.news);
        if (res.data.marquees) setMarquees(res.data.marquees);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = (text: string) => {
    const audio = new Audio(`${d.ttsUrl}?lang=${bootstrap.lang}&text=${encodeURIComponent(text.slice(0, 400))}`);
    void audio.play();
  };

  const articles = Array.isArray(news?.articles) ? news.articles : [];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="ai-input h-9 w-36 py-1 text-xs"
          >
            <option value="cambodia">Cambodia</option>
            <option value="asean">ASEAN</option>
            <option value="global">Global</option>
          </select>
          <button type="button" disabled={loading} onClick={() => refreshNews(true)} className="ai-btn-primary h-9 px-3 text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh AI Briefing
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {marquees.length > 0 && (
          <div className="ai-surface space-y-2 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Megaphone className="h-3.5 w-3.5" /> Official Announcements
            </p>
            <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
              {marquees.map((m) => (
                <li key={m.id}>• {isKhmer && m.text_kh ? m.text_kh : m.text}</li>
              ))}
            </ul>
          </div>
        )}

        {(news?.headline || news?.summary) && (
          <div className="ai-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                  <Globe className="h-3 w-3" /> {region.toUpperCase()} BRIEFING
                </span>
                {news.headline && <h2 className="mt-2 font-display text-xl font-bold">{news.headline}</h2>}
                {news.summary && <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{news.summary}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleSpeak(`${news.headline || ""}. ${news.summary || ""}`)}
                className="ai-btn-secondary h-9 px-3 text-xs shrink-0"
              >
                <Volume2 className="h-3.5 w-3.5" /> Listen
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((art, i) => (
            <div key={i} className="ai-surface flex flex-col justify-between p-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <Newspaper className="h-3.5 w-3.5" /> {art.category || "Agronomy"}
                  </span>
                  <button type="button" onClick={() => handleSpeak(`${art.title || ""}. ${art.summary || ""}`)} className="text-slate-400 hover:text-indigo-500">
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="font-display text-base font-bold">{art.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{art.summary}</p>
              </div>
              {art.impact && (
                <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-medium text-slate-600 dark:bg-obsidian-800 dark:text-slate-300">
                  Impact: {art.impact}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}
