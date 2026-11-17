import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Gauge,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Sprout,
  Stethoscope,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { isCompactMobileViewport } from "@/utils/pwa";

interface HistoryItem {
  id: number;
  cropName: string;
  diseaseName: string;
  status: string;
  statusLabel: string;
  confidence: number;
  confidenceLevel?: string;
  category?: string;
  categoryLabel?: string;
  symptoms: string;
  feedbackRating?: string;
  createdAt?: string | null;
  resultUrl: string;
}

interface HistoryData {
  mode: string;
  diagnoseUrl: string;
  historyAllUrl?: string;
  ruleHistoryUrl?: string;
  chatUrl?: string;
  diagnoses: HistoryItem[];
}

type StatusFilterKey = "ALL" | "AUTO" | "PENDING" | "APPROVED" | "REJECTED";
type SortOrder = "newest" | "oldest" | "confidence";
type ViewMode = "table" | "cards";

function normalizePct(val?: number | null): number {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const pct = num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

function parseSymptoms(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatRecordDate(raw?: string | null): { date: string; time: string } {
  if (!raw) return { date: "—", time: "" };
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) {
    return { date: raw.slice(0, 10) || "—", time: "" };
  }
  return {
    date: dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: dt.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function parseTimestamp(raw?: string | null): number {
  if (!raw) return 0;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function getStatusMeta(status: string, statusLabel: string, isKhmer: boolean) {
  const upper = String(status || "").toUpperCase();
  if (upper === "APPROVED") {
    return {
      Icon: CheckCircle2,
      text: statusLabel || (isKhmer ? "អនុម័តរួច" : "Approved"),
      pillClass:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (upper === "PENDING") {
    return {
      Icon: Clock3,
      text: statusLabel || (isKhmer ? "រង់ចាំពិនិត្យ" : "Pending"),
      pillClass:
        "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (upper === "REJECTED") {
    return {
      Icon: AlertCircle,
      text: statusLabel || (isKhmer ? "បដិសេធ" : "Rejected"),
      pillClass:
        "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    };
  }
  return {
    Icon: Sparkles,
    text: statusLabel || (isKhmer ? "ស្វ័យប្រវត្តិ" : "Auto Scored"),
    pillClass:
      "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  };
}

function StatusBadge({
  status,
  label,
  isKhmer,
}: {
  status: string;
  label: string;
  isKhmer: boolean;
}) {
  const meta = getStatusMeta(status, label, isKhmer);
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap",
        meta.pillClass,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{meta.text}</span>
    </span>
  );
}

function ConfidenceMeter({
  confidence,
  compact = false,
}: {
  confidence: number;
  compact?: boolean;
}) {
  const pct = normalizePct(confidence);
  const barColor =
    pct >= 75
      ? "bg-emerald-500"
      : pct >= 45
        ? "bg-amber-500"
        : "bg-rose-500";
  const textColor =
    pct >= 75
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 45
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <div className={cn("flex items-center gap-2", compact ? "w-28" : "w-full")}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-obsidian-800">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("font-mono text-xs font-bold tabular-nums", textColor)}>
        {pct}%
      </span>
    </div>
  );
}

function HistoryRecordCard({
  item,
  isKhmer,
}: {
  item: HistoryItem;
  isKhmer: boolean;
}) {
  const symptoms = parseSymptoms(item.symptoms);
  const visibleSymptoms = symptoms.slice(0, 3);
  const extraCount = Math.max(0, symptoms.length - visibleSymptoms.length);
  const { date, time } = formatRecordDate(item.createdAt);

  return (
    <article className="ai-surface group flex min-w-0 flex-col justify-between p-4 transition hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-md dark:hover:border-indigo-500/40 sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <Sprout className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.cropName}</span>
            </span>
            {item.categoryLabel && (
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-obsidian-800 dark:text-slate-300">
                {item.categoryLabel}
              </span>
            )}
            <span className="font-mono text-[11px] font-semibold text-slate-400">
              #{item.id}
            </span>
          </div>
          <StatusBadge status={item.status} label={item.statusLabel} isKhmer={isKhmer} />
        </div>

        <h3 className="mt-3 break-words font-display text-base font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
          {item.diseaseName}
        </h3>

        {visibleSymptoms.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {visibleSymptoms.map((sym, idx) => (
              <span
                key={`${item.id}-sym-${idx}`}
                className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300"
              >
                {sym}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                +{extraCount}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {isKhmer ? "មិនមានកំណត់ត្រារោគសញ្ញាលម្អិត" : "No individual symptoms listed"}
          </p>
        )}

        <div className="mt-4 rounded-xl bg-slate-50/90 px-3 py-2.5 dark:bg-obsidian-950/70">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>{isKhmer ? "កម្រិតភាពជឿជាក់" : "Match Confidence"}</span>
            {item.confidenceLevel && (
              <span className="uppercase tracking-wider text-slate-400">
                {item.confidenceLevel}
              </span>
            )}
          </div>
          <ConfidenceMeter confidence={item.confidence} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200/75 pt-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>{date}</span>
            {time && <span className="text-slate-400">· {time}</span>}
          </span>
          {item.feedbackRating === "helpful" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
              <ThumbsUp className="h-2.5 w-2.5" />
              <span>{isKhmer ? "មានប្រយោជន៍" : "Helpful"}</span>
            </span>
          )}
          {item.feedbackRating === "not_helpful" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
              <ThumbsDown className="h-2.5 w-2.5" />
              <span>{isKhmer ? "បានវាយតម្លៃ" : "Reviewed"}</span>
            </span>
          )}
        </div>

        <a
          href={item.resultUrl}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
        >
          <span>{isKhmer ? "មើលរបាយការណ៍" : "Report"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

export default function FarmerHistoryPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<HistoryData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const allRecords = d.diagnoses || [];

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("ALL");
  const [cropFilter, setCropFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    isCompactMobileViewport() ? "cards" : "table",
  );

  const isRuleMode = d.mode === "rule-inference";
  const chatHref = d.chatUrl || "/farmer/chat";
  const allHistoryHref = d.historyAllUrl || "/farmer/diagnoses/history";
  const ruleHistoryHref = d.ruleHistoryUrl || "/farmer/history/rule-inference";

  const metrics = useMemo(() => {
    const counts = {
      ALL: allRecords.length,
      AUTO: 0,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    let confidenceSum = 0;

    for (const item of allRecords) {
      const st = String(item.status || "").toUpperCase();
      if (st === "AUTO") counts.AUTO += 1;
      else if (st === "PENDING") counts.PENDING += 1;
      else if (st === "APPROVED") counts.APPROVED += 1;
      else if (st === "REJECTED") counts.REJECTED += 1;
      confidenceSum += normalizePct(item.confidence);
    }

    const avgConfidence =
      allRecords.length > 0 ? Math.round(confidenceSum / allRecords.length) : 0;

    return {
      counts,
      verifiedOrAuto: counts.APPROVED + counts.AUTO,
      avgConfidence,
    };
  }, [allRecords]);

  const cropOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of allRecords) {
      if (item.cropName?.trim()) set.add(item.cropName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRecords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allRecords.filter((item) => {
      if (statusFilter !== "ALL" && item.status.toUpperCase() !== statusFilter) {
        return false;
      }
      if (cropFilter !== "ALL" && item.cropName.trim() !== cropFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.cropName.toLowerCase().includes(q) ||
        item.diseaseName.toLowerCase().includes(q) ||
        item.symptoms.toLowerCase().includes(q) ||
        (item.categoryLabel || "").toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    });

    const sorted = [...list];
    if (sortOrder === "oldest") {
      sorted.sort((a, b) => parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt));
    } else if (sortOrder === "confidence") {
      sorted.sort((a, b) => normalizePct(b.confidence) - normalizePct(a.confidence));
    } else {
      sorted.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
    }
    return sorted;
  }, [allRecords, query, statusFilter, cropFilter, sortOrder]);

  const hasActiveFilters =
    query.trim().length > 0 || statusFilter !== "ALL" || cropFilter !== "ALL";

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
    setCropFilter("ALL");
  };

  const statusTabs: Array<{ key: StatusFilterKey; label: string; count: number }> = [
    { key: "ALL", label: isKhmer ? "ទាំងអស់" : "All", count: metrics.counts.ALL },
    { key: "AUTO", label: isKhmer ? "ស្វ័យប្រវត្តិ" : "Auto Scored", count: metrics.counts.AUTO },
    { key: "PENDING", label: isKhmer ? "រង់ចាំពិនិត្យ" : "Pending", count: metrics.counts.PENDING },
    { key: "APPROVED", label: isKhmer ? "អនុម័តរួច" : "Approved", count: metrics.counts.APPROVED },
  ];
  if (metrics.counts.REJECTED > 0) {
    statusTabs.push({
      key: "REJECTED",
      label: isKhmer ? "បដិសេធ" : "Rejected",
      count: metrics.counts.REJECTED,
    });
  }

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <a href={chatHref} className="ai-btn-secondary hidden h-9 gap-1.5 px-3 text-xs sm:inline-flex">
            <Bot className="h-3.5 w-3.5 text-indigo-500" />
            <span>{isKhmer ? "សួរ AI" : "Ask AI"}</span>
          </a>
          <a href={d.diagnoseUrl} className="ai-btn-primary h-9 gap-1.5 px-3 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>{isKhmer ? "វិនិច្ឆ័យថ្មី" : "New Diagnosis"}</span>
          </a>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-obsidian-900 sm:flex-wrap">
            <a
              href={allHistoryHref}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition sm:px-3.5",
                !isRuleMode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-obsidian-800",
              )}
            >
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              <span>{isKhmer ? "ប្រវត្តិទាំងអស់" : "All Diagnoses"}</span>
            </a>
            <a
              href={ruleHistoryHref}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition sm:px-3.5",
                isRuleMode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-obsidian-800",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>{isKhmer ? "ប្រវត្តិវិភាគតាមច្បាប់" : "Rule Engine Logs"}</span>
            </a>
            <a
              href={chatHref}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-obsidian-800 sm:px-3.5"
            >
              <Bot className="h-3.5 w-3.5 shrink-0" />
              <span>{isKhmer ? "ប្រវត្តិសួរ AI" : "AI Chats"}</span>
            </a>
          </div>
        </div>

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "ai-surface min-w-0 p-3.5 text-left transition hover:border-indigo-400/50 sm:p-4",
              statusFilter === "ALL" && "ring-2 ring-indigo-500/20",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isKhmer ? "កំណត់ត្រាសរុប" : "Total Records"}
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                <Activity className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {metrics.counts.ALL}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {isKhmer ? "កំណត់ត្រាវិនិច្ឆ័យ" : "Recorded field assessments"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("APPROVED")}
            className={cn(
              "ai-surface min-w-0 p-3.5 text-left transition hover:border-emerald-400/50 sm:p-4",
              statusFilter === "APPROVED" && "ring-2 ring-emerald-500/25",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isKhmer ? "បានបញ្ជាក់" : "Verified & Auto"}
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {metrics.verifiedOrAuto}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {metrics.counts.APPROVED}{" "}
              {isKhmer ? "អនុម័ត" : "expert"} · {metrics.counts.AUTO}{" "}
              {isKhmer ? "ស្វ័យប្រវត្តិ" : "auto"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={cn(
              "ai-surface min-w-0 p-3.5 text-left transition hover:border-amber-400/50 sm:p-4",
              statusFilter === "PENDING" && "ring-2 ring-amber-500/25",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isKhmer ? "រង់ចាំពិនិត្យ" : "Pending Review"}
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <Clock3 className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {metrics.counts.PENDING}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {isKhmer ? "កំពុងរង់ចាំអ្នកជំនាញ" : "Awaiting specialist check"}
            </p>
          </button>

          <div className="ai-surface min-w-0 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isKhmer ? "ភាពជឿជាក់មធ្យម" : "Avg Confidence"}
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <Gauge className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {metrics.avgConfidence}%
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-obsidian-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${metrics.avgConfidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="ai-surface space-y-3.5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isKhmer
                    ? "ស្វែងរកដំណាំ ជំងឺ រោគសញ្ញា ឬ #ID..."
                    : "Search crop, disease, symptom, or #ID..."
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

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2.5">
              <select
                value={cropFilter}
                onChange={(e) => setCropFilter(e.target.value)}
                aria-label={isKhmer ? "តម្រងតាមដំណាំ" : "Filter by crop"}
                className="ai-input h-9 w-full min-w-0 py-1 text-xs sm:w-44"
              >
                <option value="ALL">{isKhmer ? "ដំណាំទាំងអស់" : "All Crops"}</option>
                {cropOptions.map((crop) => (
                  <option key={crop} value={crop}>
                    {crop}
                  </option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                aria-label={isKhmer ? "តម្រៀបតាម" : "Sort records"}
                className="ai-input h-9 w-full min-w-0 py-1 text-xs sm:w-44"
              >
                <option value="newest">{isKhmer ? "ថ្មីបំផុតមុន" : "Newest first"}</option>
                <option value="oldest">{isKhmer ? "ចាស់បំផុតមុន" : "Oldest first"}</option>
                <option value="confidence">
                  {isKhmer ? "ភាពជឿជាក់ខ្ពស់បំផុត" : "Highest confidence"}
                </option>
              </select>

              <div className="hidden items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-obsidian-950 md:inline-flex">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
                    viewMode === "table"
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-obsidian-900 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
                  )}
                  title={isKhmer ? "ទម្រង់តារាង" : "Table view"}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "តារាង" : "Table"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
                    viewMode === "cards"
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-obsidian-900 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
                  )}
                  title={isKhmer ? "ទម្រង់កាត" : "Card grid"}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "កាត" : "Cards"}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {statusTabs.map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-bold transition",
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500 dark:bg-obsidian-800 dark:text-slate-400",
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">
                {isKhmer
                  ? `បង្ហាញ ${filtered.length} នៃ ${allRecords.length}`
                  : `Showing ${filtered.length} of ${allRecords.length}`}
              </span>
              {hasActiveFilters && (
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

        {/* Empty States or Records */}
        {allRecords.length === 0 ? (
          <div className="ai-surface px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-300">
              <Stethoscope className="h-7 w-7" />
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {isKhmer ? "មិនទាន់មានប្រវត្តិវិនិច្ឆ័យនៅឡើយទេ" : "No diagnosis history yet"}
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
              {isKhmer
                ? "ចាប់ផ្តើមការវិនិច្ឆ័យដំបូងរបស់អ្នក ដើម្បីរក្សាទុកលទ្ធផល ភាពជឿជាក់ និងវិធីព្យាបាលនៅទីនេះ។"
                : "Run your first guided crop diagnosis to track detected diseases, confidence scores, and treatment steps here."}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <a href={d.diagnoseUrl} className="ai-btn-primary h-10 gap-2 px-4 text-xs">
                <Stethoscope className="h-4 w-4" />
                <span>{isKhmer ? "ចាប់ផ្តើមវិនិច្ឆ័យ" : "Start Guided Diagnosis"}</span>
              </a>
              <a href={chatHref} className="ai-btn-secondary h-10 gap-2 px-4 text-xs">
                <Bot className="h-4 w-4" />
                <span>{isKhmer ? "សួរ AI កសិកម្ម" : "Ask AI Assistant"}</span>
              </a>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ai-surface px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-obsidian-800 dark:text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {isKhmer ? "រកមិនឃើញកំណត់ត្រាដែលត្រូវគ្នាទេ" : "No matching diagnosis records"}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              {isKhmer
                ? "សូមសាកល្បងកែប្រែពាក្យស្វែងរក ឬតម្រងស្ថានភាពខាងលើ។"
                : "Try adjusting your search query, crop filter, or status filter."}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="ai-btn-secondary mt-4 h-9 gap-1.5 px-4 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isKhmer ? "សម្អាតតម្រង" : "Reset filters"}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards (always shown below md) OR Desktop Cards when viewMode === "cards" */}
            <div
              className={cn(
                "grid gap-4 md:grid-cols-2",
                viewMode === "table" && "md:hidden",
              )}
            >
              {filtered.map((item) => (
                <HistoryRecordCard key={item.id} item={item} isKhmer={isKhmer} />
              ))}
            </div>

            {/* Desktop Table View (shown md+ when viewMode === "table") */}
            {viewMode === "table" && (
              <div className="ai-surface hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/75 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-obsidian-900 dark:text-slate-400">
                        <th className="px-4 py-3.5">{isKhmer ? "ដំណាំ" : "Crop"}</th>
                        <th className="px-4 py-3.5">
                          {isKhmer ? "រោគវិនិច្ឆ័យ និងរោគសញ្ញា" : "Diagnosis & Symptoms"}
                        </th>
                        <th className="px-4 py-3.5">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                        <th className="px-4 py-3.5">{isKhmer ? "ភាពជឿជាក់" : "Confidence"}</th>
                        <th className="px-4 py-3.5">{isKhmer ? "កាលបរិច្ឆេទ" : "Recorded"}</th>
                        <th className="px-4 py-3.5 text-right">{isKhmer ? "សកម្មភាព" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/65 dark:divide-slate-800/65">
                      {filtered.map((item) => {
                        const symptoms = parseSymptoms(item.symptoms);
                        const { date, time } = formatRecordDate(item.createdAt);
                        return (
                          <tr
                            key={item.id}
                            className="group transition hover:bg-slate-50/80 dark:hover:bg-obsidian-900/50"
                          >
                            <td className="px-4 py-3.5 align-top">
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex w-fit items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                  <Sprout className="h-3 w-3 shrink-0" />
                                  <span>{item.cropName}</span>
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">
                                  #{item.id}
                                  {item.categoryLabel ? ` · ${item.categoryLabel}` : ""}
                                </span>
                              </div>
                            </td>

                            <td className="max-w-xs px-4 py-3.5 align-top">
                              <a
                                href={item.resultUrl}
                                className="font-display text-[13px] font-bold text-slate-900 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300"
                              >
                                {item.diseaseName}
                              </a>
                              {symptoms.length > 0 && (
                                <p className="mt-1 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  {symptoms.join(" · ")}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-3.5 align-top">
                              <div className="flex flex-col items-start gap-1">
                                <StatusBadge
                                  status={item.status}
                                  label={item.statusLabel}
                                  isKhmer={isKhmer}
                                />
                                {item.feedbackRating === "helpful" && (
                                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <ThumbsUp className="h-2.5 w-2.5" />
                                    <span>{isKhmer ? "មានប្រយោជន៍" : "Helpful"}</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3.5 align-top">
                              <ConfidenceMeter confidence={item.confidence} compact />
                            </td>

                            <td className="px-4 py-3.5 align-top whitespace-nowrap">
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                {date}
                              </div>
                              {time && (
                                <div className="font-mono text-[10.5px] text-slate-400">
                                  {time}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3.5 align-top text-right">
                              <a
                                href={item.resultUrl}
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                              >
                                <span>{isKhmer ? "របាយការណ៍" : "Report"}</span>
                                <ArrowRight className="h-3 w-3" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}
