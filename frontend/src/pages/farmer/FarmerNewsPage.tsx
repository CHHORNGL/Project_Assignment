import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Clock,
  CloudRain,
  Cpu,
  ExternalLink,
  Globe,
  Lightbulb,
  Loader2,
  MapPin,
  Megaphone,
  Newspaper,
  RefreshCw,
  RotateCcw,
  Search,
  Sprout,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import { useSpeechPlayback } from "@/hooks/useSpeechPlayback";
import { requestJson } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NewsArticle {
  id?: number | string;
  title?: string;
  summary?: string;
  full_text?: string;
  paragraphs?: string[];
  is_live?: boolean;
  category?: string;
  impact?: string;
  image?: string;
  date?: string;
  read_time?: string;
  tip?: string;
  source?: string;
  link?: string;
}

function getArticleParagraphs(art: NewsArticle): string[] {
  if (Array.isArray(art.paragraphs) && art.paragraphs.length > 0) {
    return art.paragraphs.map((p) => String(p || "").trim()).filter(Boolean);
  }
  if (art.full_text && art.full_text.trim()) {
    return art.full_text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return art.summary ? [art.summary.trim()] : [];
}

interface MarqueeItem {
  id: number;
  text: string;
  text_kh?: string;
  created_at?: string;
}

interface NewsPayloadObject {
  headline?: string;
  summary?: string;
  articles?: NewsArticle[];
  [key: string]: unknown;
}

interface NewsData {
  generateUrl: string;
  ttsUrl: string;
  marquees: MarqueeItem[];
  initialNews: NewsArticle[] | NewsPayloadObject;
}

type RegionKey = "cambodia" | "global";

function extractArticles(raw: NewsArticle[] | NewsPayloadObject | null | undefined): NewsArticle[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.articles)) return raw.articles;
  return [];
}

function isSafeHttpUrl(raw?: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function getCategoryMeta(rawCategory: string | undefined, isKhmer: boolean) {
  const key = String(rawCategory || "Crops").trim().toLowerCase();
  if (key.includes("pest") || key.includes("disease")) {
    return {
      key: "Pests",
      label: isKhmer ? "សត្វល្អិត និងជំងឺ" : "Pests & Disease",
      Icon: Bug,
      badgeClass:
        "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    };
  }
  if (key.includes("weather") || key.includes("climate")) {
    return {
      key: "Weather",
      label: isKhmer ? "អាកាសធាតុ" : "Weather",
      Icon: CloudRain,
      badgeClass:
        "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    };
  }
  if (key.includes("market") || key.includes("price") || key.includes("trade")) {
    return {
      key: "Market",
      label: isKhmer ? "ទីផ្សារ" : "Market",
      Icon: TrendingUp,
      badgeClass:
        "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (key.includes("tech") || key.includes("ai") || key.includes("smart")) {
    return {
      key: "Tech",
      label: isKhmer ? "បច្ចេកវិទ្យា" : "AgriTech",
      Icon: Cpu,
      badgeClass:
        "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    };
  }
  return {
    key: "Crops",
    label: isKhmer ? "ដំណាំ" : rawCategory || "Crops",
    Icon: Sprout,
    badgeClass:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
}

function getImpactMeta(rawImpact: string | undefined, isKhmer: boolean) {
  const lower = String(rawImpact || "").trim().toLowerCase();
  if (lower === "high") {
    return {
      isHigh: true,
      label: isKhmer ? "សំខាន់ខ្លាំង" : "High Alert",
      badgeClass:
        "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    };
  }
  if (lower === "advisory") {
    return {
      isHigh: false,
      label: isKhmer ? "ការណែនាំ" : "Advisory",
      badgeClass:
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    isHigh: false,
    label: isKhmer ? "មធ្យម" : rawImpact || "Update",
    badgeClass:
      "border-slate-300/70 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-obsidian-800 dark:text-slate-300",
  };
}

function ArticleCover({
  src,
  alt,
  category,
  featured = false,
  modal = false,
}: {
  src?: string;
  alt: string;
  category?: string;
  featured?: boolean;
  modal?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const { Icon } = getCategoryMeta(category, false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const heightClass = modal ? "h-44 sm:h-60" : featured ? "h-56 lg:h-full" : "h-44";

  if (!src || failed || !isSafeHttpUrl(src)) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center bg-gradient-to-br from-indigo-600/15 via-sky-500/10 to-emerald-500/15 dark:from-indigo-500/20 dark:via-sky-500/10 dark:to-emerald-500/15",
          heightClass,
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-indigo-600 shadow-sm dark:bg-obsidian-900/80 dark:text-indigo-300">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("w-full object-cover", heightClass)}
    />
  );
}

export default function FarmerNewsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<NewsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [region, setRegion] = useState<RegionKey>("cambodia");
  const [newsPayload, setNewsPayload] = useState<NewsArticle[] | NewsPayloadObject>(
    d.initialNews || [],
  );
  const [marquees, setMarquees] = useState<MarqueeItem[]>(d.marquees || []);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [highOnly, setHighOnly] = useState(false);
  const {
    activeKey: speakingKey,
    toggleSpeak: handleSpeak,
    stop: stopAudio,
  } = useSpeechPlayback<string>(d.ttsUrl, bootstrap.lang, (msg) =>
    pushToast("warning", msg),
  );
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    if (!activeArticle) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveArticle(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeArticle]);

  const fetchRegionNews = async (targetRegion: RegionKey, force = false) => {
    setLoading(true);
    try {
      const sep = d.generateUrl.includes("?") ? "&" : "?";
      const res = await requestJson<{
        news?: NewsArticle[] | NewsPayloadObject;
        marquees?: MarqueeItem[];
      }>(
        `${d.generateUrl}${sep}region=${encodeURIComponent(targetRegion)}&lang=${bootstrap.lang}&force=${force}`,
        "GET",
      );
      if (!res.ok) {
        pushToast(
          "danger",
          isKhmer ? "មិនអាចផ្ទុកព័ត៌មានថ្មីបានទេ។" : "Unable to load updated briefings.",
        );
        return;
      }
      if (res.data.news !== undefined) {
        setNewsPayload(res.data.news);
      }
      if (Array.isArray(res.data.marquees)) {
        setMarquees(res.data.marquees);
      }
      if (force) {
        pushToast(
          "success",
          isKhmer ? "បានធ្វើបច្ចុប្បន្នភាពព័ត៌មានកសិកម្មរួចរាល់។" : "Agricultural briefing refreshed.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (nextRegion: RegionKey) => {
    if (nextRegion === region && !loading) return;
    setRegion(nextRegion);
    setCategoryFilter("ALL");
    stopAudio();
    void fetchRegionNews(targetRegionOrFallback(nextRegion), false);
  };

  function targetRegionOrFallback(r: RegionKey): RegionKey {
    return r === "global" ? "global" : "cambodia";
  }

  const allArticles = useMemo(() => extractArticles(newsPayload), [newsPayload]);
  const optionalHeader =
    !Array.isArray(newsPayload) && (newsPayload?.headline || newsPayload?.summary)
      ? { headline: newsPayload.headline, summary: newsPayload.summary }
      : null;

  const categoryCounts = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const art of allArticles) {
      const meta = getCategoryMeta(art.category, isKhmer);
      const prev = map.get(meta.key);
      map.set(meta.key, {
        label: meta.label,
        count: (prev?.count || 0) + 1,
      });
    }
    return Array.from(map.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      count: val.count,
    }));
  }, [allArticles, isKhmer]);

  const highAlertCount = useMemo(
    () => allArticles.filter((a) => getImpactMeta(a.impact, isKhmer).isHigh).length,
    [allArticles, isKhmer],
  );

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allArticles.filter((art) => {
      const catKey = getCategoryMeta(art.category, isKhmer).key;
      if (categoryFilter !== "ALL" && catKey !== categoryFilter) return false;
      if (highOnly && !getImpactMeta(art.impact, isKhmer).isHigh) return false;
      if (!q) return true;
      return (
        String(art.title || "").toLowerCase().includes(q) ||
        String(art.summary || "").toLowerCase().includes(q) ||
        String(art.full_text || "").toLowerCase().includes(q) ||
        String(art.tip || "").toLowerCase().includes(q) ||
        String(art.source || "").toLowerCase().includes(q)
      );
    });
  }, [allArticles, query, categoryFilter, highOnly, isKhmer]);

  const hasFilters = query.trim().length > 0 || categoryFilter !== "ALL" || highOnly;
  const featuredArticle = !hasFilters && filteredArticles.length > 0 ? filteredArticles[0] : null;
  const gridArticles = featuredArticle ? filteredArticles.slice(1) : filteredArticles;

  const resetFilters = () => {
    setQuery("");
    setCategoryFilter("ALL");
    setHighOnly(false);
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-slate-200/90 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-obsidian-900">
            <button
              type="button"
              onClick={() => handleRegionChange("cambodia")}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold transition",
                region === "cambodia"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300",
              )}
            >
              <MapPin className="h-3 w-3" />
              <span>{isKhmer ? "កម្ពុជា" : "Cambodia"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleRegionChange("global")}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold transition",
                region === "global"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300",
              )}
            >
              <Globe className="h-3 w-3" />
              <span>{isKhmer ? "ពិភពលោក" : "Global"}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchRegionNews(region, true)}
            className="ai-btn-primary h-9 gap-1.5 px-3 text-xs"
            title={isKhmer ? "ធ្វើបច្ចុប្បន្នភាព" : "Refresh briefing"}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{isKhmer ? "ផ្ទុកថ្មី" : "Refresh"}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Official Advisories Banner */}
        {marquees.length > 0 && (
          <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 shadow-sm sm:p-5">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {isKhmer ? "សេចក្តីជូនដំណឹងផ្លូវការ" : "Official Advisories & Field Alerts"}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isKhmer ? "ការជូនដំណឹងបច្ចុប្បន្នពីប្រព័ន្ធកសិកម្ម" : "Active seasonal announcements from agronomy administrators"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleSpeak(
                    "marquees",
                    marquees.map((m) => (isKhmer && m.text_kh ? m.text_kh : m.text)).join(". "),
                  )
                }
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition",
                  speakingKey === "marquees"
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "border-slate-200/80 bg-white/80 text-slate-700 hover:border-amber-400 dark:border-slate-800 dark:bg-obsidian-900 dark:text-slate-200",
                )}
              >
                {speakingKey === "marquees" ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
                <span>
                  {speakingKey === "marquees"
                    ? isKhmer
                      ? "បញ្ឈប់"
                      : "Stop"
                    : isKhmer
                      ? "ស្តាប់ការជូនដំណឹង"
                      : "Listen"}
                </span>
              </button>
            </div>

            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
              {marquees.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-white/75 px-3 py-2 dark:bg-obsidian-900/65"
                >
                  <span className="font-medium">
                    • {isKhmer && m.text_kh ? m.text_kh : m.text}
                  </span>
                  {m.created_at && (
                    <span className="font-mono text-[10.5px] text-slate-400">
                      {m.created_at}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Optional Executive Summary Header if backend provides object summary */}
        {optionalHeader && (
          <div className="ai-surface flex items-start justify-between gap-4 p-5">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                <Globe className="h-3 w-3" /> {region.toUpperCase()} BRIEFING
              </span>
              {optionalHeader.headline && (
                <h2 className="mt-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                  {optionalHeader.headline}
                </h2>
              )}
              {optionalHeader.summary && (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {optionalHeader.summary}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                handleSpeak(
                  "headline-summary",
                  `${optionalHeader.headline || ""}. ${optionalHeader.summary || ""}`,
                )
              }
              className="ai-btn-secondary h-9 shrink-0 px-3 text-xs"
            >
              {speakingKey === "headline-summary" ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span>{speakingKey === "headline-summary" ? (isKhmer ? "បញ្ឈប់" : "Stop") : isKhmer ? "ស្តាប់" : "Listen"}</span>
            </button>
          </div>
        )}

        {/* Search & Category Filter Toolbar */}
        <div className="ai-surface space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isKhmer
                    ? "ស្វែងរកព័ត៌មាន តម្លៃដំណាំ ឬប្រភព..."
                    : "Search crops, weather alerts, market news, or sources..."
                }
                className="ai-input h-9 py-1.5 pl-10 pr-8 text-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {highAlertCount > 0 && (
              <button
                type="button"
                onClick={() => setHighOnly((prev) => !prev)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition",
                  highOnly
                    ? "border-rose-500 bg-rose-600 text-white shadow-sm"
                    : "border-rose-500/25 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-300",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សំខាន់ខ្លាំង" : "High Alerts"}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums",
                    highOnly ? "bg-white/20 text-white" : "bg-rose-500/15",
                  )}
                >
                  {highAlertCount}
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter("ALL")}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition",
                  categoryFilter === "ALL"
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300",
                )}
              >
                <span>{isKhmer ? "ទាំងអស់" : "All"}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    categoryFilter === "ALL"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-obsidian-800 dark:text-slate-400",
                  )}
                >
                  {allArticles.length}
                </span>
              </button>

              {categoryCounts.map((cat) => {
                const active = categoryFilter === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategoryFilter(cat.key)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition",
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300",
                    )}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500 dark:bg-obsidian-800 dark:text-slate-400",
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">
                {isKhmer
                  ? `បង្ហាញ ${filteredArticles.length} នៃ ${allArticles.length}`
                  : `Showing ${filteredArticles.length} of ${allArticles.length}`}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{isKhmer ? "កំណត់ឡើងវិញ" : "Reset"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Feed Loading State on Cold Feed */}
        {loading && allArticles.length === 0 ? (
          <div className="ai-surface flex flex-col items-center justify-center py-14 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
              {isKhmer ? "កំពុងប្រមូលព័ត៌មានកសិកម្មថ្មីៗ..." : "Loading latest agronomy briefings..."}
            </p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="ai-surface px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-obsidian-800">
              <Newspaper className="h-6 w-6" />
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {isKhmer ? "មិនមានព័ត៌មានត្រូវនឹងតម្រងទេ" : "No matching agricultural briefings"}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              {isKhmer
                ? "សាកល្បងសម្អាតតម្រង ឬប្តូរតំបន់ដើម្បីមើលព័ត៌មានបន្ថែម។"
                : "Try clearing the search query or switching category filters."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="ai-btn-secondary mt-4 h-9 gap-1.5 px-4 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សម្អាតតម្រង" : "Reset filters"}</span>
              </button>
            )}
          </div>
        ) : (
          <div className={cn("space-y-5 transition-opacity", loading && "opacity-70")}>
            {/* Featured Top Dispatch */}
            {featuredArticle && (() => {
              const artKey = `featured-${featuredArticle.id ?? 0}`;
              const catMeta = getCategoryMeta(featuredArticle.category, isKhmer);
              const impactMeta = getImpactMeta(featuredArticle.impact, isKhmer);
              const CatIcon = catMeta.Icon;
              const speaking = speakingKey === artKey;
              return (
                <article className="ai-surface grid overflow-hidden lg:grid-cols-12">
                  <div className="relative lg:col-span-5">
                    <ArticleCover
                      src={featuredArticle.image}
                      alt={featuredArticle.title || "Featured dispatch"}
                      category={featuredArticle.category}
                      featured
                    />
                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-indigo-600/95 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                        {isKhmer ? "ព័ត៌មានសំខាន់" : "Featured"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border bg-white/95 px-2.5 py-0.5 text-[10.5px] font-bold shadow-sm backdrop-blur dark:bg-obsidian-900/90",
                          catMeta.badgeClass,
                        )}
                      >
                        <CatIcon className="h-3 w-3" />
                        <span>{catMeta.label}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between p-5 sm:p-6 lg:col-span-7">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex flex-wrap items-center gap-2">
                          {featuredArticle.is_live && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                              {isKhmer ? "ព័ត៌មានផ្ទាល់" : "LIVE"}
                            </span>
                          )}
                          {featuredArticle.source && (
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                              {featuredArticle.source}
                            </span>
                          )}
                          {featuredArticle.date && <span>· {featuredArticle.date}</span>}
                          {featuredArticle.read_time && (
                            <span className="inline-flex items-center gap-1">
                              · <Clock className="h-3 w-3" /> {featuredArticle.read_time}
                            </span>
                          )}
                        </div>
                        {featuredArticle.impact && (
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold",
                              impactMeta.badgeClass,
                            )}
                          >
                            {impactMeta.label}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2.5 font-display text-lg font-extrabold leading-snug text-slate-900 dark:text-white sm:text-xl">
                        <button
                          type="button"
                          onClick={() => setActiveArticle(featuredArticle)}
                          className="text-left transition hover:text-indigo-600 dark:hover:text-indigo-300"
                        >
                          {featuredArticle.title}
                        </button>
                      </h2>

                      {featuredArticle.summary && (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[13px]">
                          {featuredArticle.summary}
                        </p>
                      )}

                      {featuredArticle.tip && (
                        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              {isKhmer ? "ដំបូន្មានកសិកម្ម៖ " : "Field Action Tip: "}
                            </span>
                            <span>{featuredArticle.tip}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/75 pt-3 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveArticle(featuredArticle)}
                          className="ai-btn-primary h-8 gap-1.5 rounded-xl px-3 text-xs"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>{isKhmer ? "អានអត្ថបទពេញ" : "Read full article"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSpeak(
                              artKey,
                              `${featuredArticle.title || ""}. ${featuredArticle.full_text || featuredArticle.summary || ""}`,
                            )
                          }
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition",
                            speaking
                              ? "border-indigo-500/40 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300",
                          )}
                        >
                          {speaking ? (
                            <VolumeX className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                          <span>{speaking ? (isKhmer ? "បញ្ឈប់" : "Stop") : isKhmer ? "ស្តាប់" : "Listen"}</span>
                        </button>
                      </div>

                      {isSafeHttpUrl(featuredArticle.link) && (
                        <a
                          href={featuredArticle.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300"
                        >
                          <span>{isKhmer ? "ប្រភពដើម" : "Source"}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })()}

            {/* Article Cards Grid */}
            {gridArticles.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {gridArticles.map((art, i) => {
                  const artKey = `art-${art.id ?? i}`;
                  const catMeta = getCategoryMeta(art.category, isKhmer);
                  const impactMeta = getImpactMeta(art.impact, isKhmer);
                  const CatIcon = catMeta.Icon;
                  const speaking = speakingKey === artKey;

                  return (
                    <article
                      key={artKey}
                      className="ai-surface group flex flex-col justify-between overflow-hidden transition hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-md dark:hover:border-indigo-500/40"
                    >
                      <div>
                        <div className="relative overflow-hidden">
                          <ArticleCover
                            src={art.image}
                            alt={art.title || "Agricultural update"}
                            category={art.category}
                          />
                          <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border bg-white/95 px-2.5 py-0.5 text-[10.5px] font-bold shadow-sm backdrop-blur dark:bg-obsidian-900/90",
                                catMeta.badgeClass,
                              )}
                            >
                              <CatIcon className="h-3 w-3" />
                              <span>{catMeta.label}</span>
                            </span>
                            {art.impact && (
                              <span
                                className={cn(
                                  "rounded-full border bg-white/95 px-2.5 py-0.5 text-[10.5px] font-bold shadow-sm backdrop-blur dark:bg-obsidian-900/90",
                                  impactMeta.badgeClass,
                                )}
                              >
                                {impactMeta.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                            {art.is_live && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {isKhmer ? "ផ្ទាល់" : "LIVE"}
                              </span>
                            )}
                            {art.source && (
                              <span className="truncate font-semibold text-slate-600 dark:text-slate-300">
                                {art.source}
                              </span>
                            )}
                            {art.date && <span>· {art.date}</span>}
                            {art.read_time && <span>· {art.read_time}</span>}
                          </div>

                          <h3 className="mt-2 font-display text-base font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                            <button
                              type="button"
                              onClick={() => setActiveArticle(art)}
                              className="text-left"
                            >
                              {art.title}
                            </button>
                          </h3>

                          {art.summary && (
                            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                              {art.summary}
                            </p>
                          )}

                          {art.tip && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-[11.5px] text-slate-600 dark:border-slate-800 dark:bg-obsidian-950/60 dark:text-slate-300">
                              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              <span className="line-clamp-2">{art.tip}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-200/75 px-4 py-3 dark:border-slate-800 sm:px-5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveArticle(art)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>{isKhmer ? "អានពេញ" : "Read full"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleSpeak(artKey, `${art.title || ""}. ${art.full_text || art.summary || ""}`)
                            }
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition",
                              speaking
                                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                                : "text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-obsidian-800 dark:hover:text-indigo-300",
                            )}
                          >
                            {speaking ? (
                              <VolumeX className="h-3.5 w-3.5" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                            <span>{speaking ? (isKhmer ? "បញ្ឈប់" : "Stop") : isKhmer ? "ស្តាប់" : "Listen"}</span>
                          </button>
                        </div>

                        {isSafeHttpUrl(art.link) && (
                          <a
                            href={art.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300"
                          >
                            <span>{isKhmer ? "ប្រភព" : "Source"}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Text Article Reader Modal (Portaled outside scroll/transform containers) */}
      {activeArticle &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const paragraphs = getArticleParagraphs(activeArticle);
            const catMeta = getCategoryMeta(activeArticle.category, isKhmer);
            const impactMeta = getImpactMeta(activeArticle.impact, isKhmer);
            const CatIcon = catMeta.Icon;
            const modalKey = `modal-${activeArticle.id ?? activeArticle.title ?? "art"}`;
            const speaking = speakingKey === modalKey;
            const speakText = `${activeArticle.title || ""}. ${paragraphs.join(" ")}`;

            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="news-reader-title"
                className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:items-center sm:p-6"
                onClick={() => setActiveArticle(null)}
              >
                <div
                  className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-obsidian-900 sm:max-h-[88vh] sm:max-w-3xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Fixed Modal Top Bar */}
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/75 px-4 py-3 dark:border-slate-800 sm:px-6">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeArticle.is_live && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                          {isKhmer ? "ព័ត៌មានផ្ទាល់" : "LIVE FEED"}
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold",
                          catMeta.badgeClass,
                        )}
                      >
                        <CatIcon className="h-3 w-3" />
                        <span>{catMeta.label}</span>
                      </span>
                      {activeArticle.impact && (
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold",
                            impactMeta.badgeClass,
                          )}
                        >
                          {impactMeta.label}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveArticle(null)}
                      aria-label="Close reader"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-obsidian-800 dark:hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Scrollable Article Content */}
                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
                    <div className="overflow-hidden rounded-2xl">
                      <ArticleCover
                        src={activeArticle.image}
                        alt={activeArticle.title || "Article image"}
                        category={activeArticle.category}
                        modal
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {activeArticle.source && (
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {activeArticle.source}
                        </span>
                      )}
                      {activeArticle.date && <span>· {activeArticle.date}</span>}
                      {activeArticle.read_time && (
                        <span className="inline-flex items-center gap-1">
                          · <Clock className="h-3.5 w-3.5" /> {activeArticle.read_time}
                        </span>
                      )}
                    </div>

                    <h2
                      id="news-reader-title"
                      className="font-display text-lg font-extrabold leading-snug text-slate-900 dark:text-white sm:text-2xl"
                    >
                      {activeArticle.title}
                    </h2>

                    {paragraphs.length > 0 ? (
                      <div className="space-y-4 text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-[15px]">
                        {paragraphs.map((para, idx) => (
                          <p key={idx}>{para}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isKhmer
                          ? "អត្ថបទពេញមិនអាចផ្ទុកបានទេ សូមបើកប្រភពដើមខាងក្រោម។"
                          : "Full publisher text is unavailable for this stub. Open the original source link below."}
                      </p>
                    )}

                    {activeArticle.tip && (
                      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="font-bold text-emerald-700 dark:text-emerald-300">
                            {isKhmer ? "ដំបូន្មានកសិកម្ម" : "Agronomist Field Tip"}
                          </p>
                          <p className="mt-0.5">{activeArticle.tip}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fixed Reader Footer */}
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200/75 bg-slate-50/90 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-obsidian-950/85 sm:px-6 sm:pb-3">
                    <button
                      type="button"
                      onClick={() => handleSpeak(modalKey, speakText)}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold transition",
                        speaking
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400 dark:border-slate-700 dark:bg-obsidian-900 dark:text-slate-200",
                      )}
                    >
                      {speaking ? (
                        <VolumeX className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {speaking
                          ? isKhmer
                            ? "បញ្ឈប់សំឡេង"
                            : "Stop"
                          : isKhmer
                            ? "ស្តាប់អត្ថបទ"
                            : "Listen"}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      {isSafeHttpUrl(activeArticle.link) && (
                        <a
                          href={activeArticle.link}
                          target="_blank"
                          rel="noreferrer"
                          className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs"
                        >
                          <span>{isKhmer ? "ប្រភពដើម" : "Source"}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveArticle(null)}
                        className="ai-btn-primary h-9 px-4 text-xs"
                      >
                        {isKhmer ? "បិទ" : "Close"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body,
        )}
    </WorkspaceShell>
  );
}
