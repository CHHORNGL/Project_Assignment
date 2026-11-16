import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  ChevronRight,
  Megaphone,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarqueeBannerItem {
  id: number;
  text: string;
  textEn?: string;
  textKm?: string;
  createdAt?: string | null;
}

const TARGET_SPEED_PX_PER_SEC = 28;

function resolveMarqueeText(item: MarqueeBannerItem, isKhmer: boolean): string {
  if (isKhmer && item.textKm) return item.textKm;
  if (!isKhmer && item.textEn) return item.textEn;
  return item.text;
}

function formatAdvisoryDate(raw?: string | null): string {
  if (!raw) return "";
  const hasZone = raw.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = hasZone
    ? raw
    : `${raw.includes("T") ? raw : raw.replace(" ", "T")}Z`;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AnnouncementMarquee({
  marquees,
  isKhmer,
  badgeLabel,
}: {
  marquees?: MarqueeBannerItem[] | null;
  isKhmer: boolean;
  badgeLabel?: string;
}) {
  const [paused, setPaused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [repeatCount, setRepeatCount] = useState(1);

  const items = useMemo(
    () =>
      (marquees || []).filter((item) =>
        Boolean(resolveMarqueeText(item, isKhmer).trim()),
      ),
    [marquees, isKhmer],
  );

  // Estimate comfortable uncapped initial duration from total character count before DOM measurement
  const initialDuration = useMemo(() => {
    const chars = items.reduce(
      (acc, it) => acc + resolveMarqueeText(it, isKhmer).length + 10,
      0,
    );
    return Math.max(24, Math.round((chars * 7.2) / TARGET_SPEED_PX_PER_SEC));
  }, [items, isKhmer]);

  const [durationSeconds, setDurationSeconds] = useState<number>(initialDuration);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const firstUnitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDurationSeconds(initialDuration);
  }, [initialDuration]);

  useEffect(() => {
    if (items.length === 0) return undefined;

    const recalcLayout = () => {
      const viewport = viewportRef.current;
      const unit = firstUnitRef.current;
      if (!viewport || !unit) return;

      const viewportWidth = viewport.clientWidth || 360;
      const unitWidth = unit.scrollWidth || 0;
      if (unitWidth <= 0) return;

      // Only duplicate a single copy enough times to exceed the visible viewport cleanly
      const neededRepeats = Math.max(
        1,
        Math.min(8, Math.ceil((viewportWidth + 64) / unitWidth)),
      );
      const halfTrackWidth = unitWidth * neededRepeats;
      const nextDuration = Math.max(
        20,
        Math.round(halfTrackWidth / TARGET_SPEED_PX_PER_SEC),
      );

      setRepeatCount((prev) => (prev === neededRepeats ? prev : neededRepeats));
      setDurationSeconds((prev) => (prev === nextDuration ? prev : nextDuration));
    };

    recalcLayout();
    const rafId = window.requestAnimationFrame(recalcLayout);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(recalcLayout);
      if (viewportRef.current) ro.observe(viewportRef.current);
      if (firstUnitRef.current) ro.observe(firstUnitRef.current);
    }
    window.addEventListener("resize", recalcLayout);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener("resize", recalcLayout);
    };
  }, [items, isKhmer]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen]);

  const repeatIndices = useMemo(
    () => Array.from({ length: repeatCount }, (_, i) => i),
    [repeatCount],
  );

  if (items.length === 0) return null;

  const pillText = badgeLabel || (isKhmer ? "សេចក្តីជូនដំណឹង" : "Live Notice");

  const openModal = (itemId?: number) => {
    setSelectedId(itemId ?? items[0]?.id ?? null);
    setModalOpen(true);
  };

  return (
    <>
      <div
        role="region"
        aria-label={isKhmer ? "សេចក្តីជូនដំណឹងរត់" : "Scrolling field advisories"}
        className="ai-marquee-shell group relative flex items-center gap-2.5 rounded-full border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-white/95 to-emerald-50/70 p-1.5 pl-2 shadow-[0_8px_24px_-12px_rgba(79,70,229,0.25)] backdrop-blur-xl transition-colors dark:border-indigo-500/25 dark:from-indigo-950/60 dark:via-obsidian-900/95 dark:to-emerald-950/35 sm:gap-3 sm:px-2.5 sm:py-1.5"
      >
        {/* Live Pulsing Pill Badge */}
        <button
          type="button"
          onClick={() => openModal(items[0]?.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm shadow-indigo-500/25 transition hover:brightness-110"
        >
          <span className="ai-beacon-dot h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <Megaphone className="h-3 w-3" />
          <span>{pillText}</span>
        </button>

        {/* Seamless 2-Pass Scrolling Track with Constant ~28px/s Speed */}
        <div ref={viewportRef} className="ai-marquee-viewport">
          <div
            style={{ ["--marquee-duration" as string]: `${durationSeconds}s` }}
            className={cn("ai-marquee-track py-0.5", paused && "is-paused")}
          >
            {[0, 1].map((passIdx) => (
              <div
                key={passIdx}
                aria-hidden={passIdx === 1}
                className="inline-flex shrink-0 items-center"
              >
                {repeatIndices.map((repIdx) => (
                  <div
                    key={`${passIdx}-${repIdx}`}
                    ref={passIdx === 0 && repIdx === 0 ? firstUnitRef : undefined}
                    className="inline-flex shrink-0 items-center"
                  >
                    {items.map((item) => {
                      const text = resolveMarqueeText(item, isKhmer);
                      return (
                        <button
                          key={`${passIdx}-${repIdx}-${item.id}`}
                          type="button"
                          tabIndex={passIdx === 0 && repIdx === 0 ? 0 : -1}
                          onClick={() => openModal(item.id)}
                          className="inline-flex shrink-0 items-center gap-2 px-4 text-xs font-medium text-slate-700 transition-colors hover:text-indigo-600 focus:outline-none dark:text-slate-200 dark:hover:text-indigo-300"
                        >
                          <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />
                          <span>{text}</span>
                          <span
                            aria-hidden="true"
                            className="ml-2 h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"
                          />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Pause / Play + View All Controls */}
        <div className="flex shrink-0 items-center gap-1 pr-0.5">
          <button
            type="button"
            onClick={() => setPaused((prev) => !prev)}
            aria-label={
              paused
                ? isKhmer
                  ? "បន្តសាររត់"
                  : "Resume scrolling"
                : isKhmer
                  ? "ផ្អាកសាររត់"
                  : "Pause scrolling"
            }
            title={paused ? (isKhmer ? "បន្ត" : "Resume") : isKhmer ? "ផ្អាក" : "Pause"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-950/90 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>

          <button
            type="button"
            onClick={() => openModal(items[0]?.id)}
            title={isKhmer ? "មើលសេចក្តីជូនដំណឹងទាំងអស់" : "View all notices"}
            className="hidden items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-950/90 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300 sm:inline-flex"
          >
            <span>{items.length}</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Advisory Reader Modal Portaled to document.body */}
      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isKhmer ? "សេចក្តីជូនដំណឹងផ្លូវការ" : "Official Announcements"}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:items-center sm:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-2xl dark:border-slate-800 dark:bg-obsidian-900">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {isKhmer ? "សេចក្តីជូនដំណឹងផ្លូវការ" : "Official Advisories & Notices"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {items.length} {isKhmer ? "សេចក្តីជូនដំណឹងសកម្ម" : "active announcements"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label={isKhmer ? "បិទ" : "Close"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:text-slate-800 dark:border-slate-700 dark:bg-obsidian-950 dark:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-4 sm:p-5">
                {items.map((item) => {
                  const text = resolveMarqueeText(item, isKhmer);
                  const dateLabel = formatAdvisoryDate(item.createdAt);
                  const highlighted = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-2xl border p-4 transition",
                        highlighted
                          ? "border-indigo-400/60 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-500/[0.08]"
                          : "border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-obsidian-950/70",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-relaxed font-medium text-slate-800 dark:text-slate-100 sm:text-sm">
                            {text}
                          </p>
                          {dateLabel && (
                            <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <Calendar className="h-3 w-3" />
                              <span>{dateLabel}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex shrink-0 justify-end border-t border-slate-200/80 bg-slate-50/70 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-obsidian-950/60">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="ai-btn-secondary h-9 px-4 text-xs"
                >
                  {isKhmer ? "បិទ" : "Close"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
