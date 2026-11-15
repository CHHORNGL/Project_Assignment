import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { cn } from "@/lib/utils";

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  pages: number;
  start: number;
  end: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function statusBadgeClass(status?: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") {
    return "border border-[#90d67f] bg-[#d9fbd0] text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#90ee7a]";
  }
  if (s === "REJECTED") {
    return "border border-[#f48270] bg-[#ffe0db] text-[#b81800] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]";
  }
  if (s === "PENDING") {
    return "border border-[#ffcc85] bg-[#ffefca] text-[#bc3803] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]";
  }
  if (s === "AUTO") {
    return "border border-[#adc5ff] bg-[#e5edff] text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]";
  }
  return "border border-[#cbd0dd] bg-[#eff2f6] text-[#525b75] dark:border-[#373e53] dark:bg-[#1e2436] dark:text-[#9fa6bc]";
}

export function statusTone(status?: string): "emerald" | "rose" | "amber" | "indigo" | "slate" {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "emerald";
  if (s === "REJECTED") return "rose";
  if (s === "PENDING") return "amber";
  if (s === "AUTO") return "indigo";
  return "slate";
}

export function ExpertHeaderActions({ bootstrap }: { bootstrap: AppBootstrap<any> }) {
  const actions = Object.values((bootstrap.ui.actions || {}) as Record<string, { label: string; href: string }>);
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((act, idx) => (
        <a
          key={`${act.href}-${idx}`}
          href={act.href}
          className={idx === actions.length - 1 ? "ai-btn-primary h-9 px-3.5 text-xs" : "ai-btn-secondary h-9 px-3.5 text-xs"}
        >
          {act.label}
        </a>
      ))}
    </div>
  );
}

export function buildPageUrl(baseUrl: string, params: Record<string, string | number | undefined | null>): string {
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  Object.entries(params).forEach(([key, val]) => {
    if (val === undefined || val === null || val === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(val));
    }
  });
  return `${url.pathname}${url.search}`;
}

export function PaginationBar({
  pagination,
  showingRange,
  pageOf,
  prevLabel,
  nextLabel,
  baseUrl,
  extraParams,
}: {
  pagination: PaginationInfo;
  showingRange?: string;
  pageOf?: string;
  prevLabel?: string;
  nextLabel?: string;
  baseUrl: string;
  extraParams?: Record<string, string | number | undefined | null>;
}) {
  if (!pagination || pagination.pages <= 1) {
    return showingRange ? (
      <div className="flex items-center justify-between pt-3 text-xs text-[#6e7891] dark:text-[#8a94ad]">
        <span>{showingRange}</span>
        {pageOf && <span>{pageOf}</span>}
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 text-xs dark:border-[#2b3245]">
      <div className="text-[#6e7891] dark:text-[#8a94ad]">
        {showingRange}
        {pageOf ? <span className="ml-2 font-semibold text-[#141824] dark:text-[#eff2f6]">({pageOf})</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={
            pagination.hasPrev
              ? buildPageUrl(baseUrl, { ...extraParams, page: pagination.page - 1, per_page: pagination.perPage })
              : "#"
          }
          aria-disabled={!pagination.hasPrev}
          onClick={(e) => {
            if (!pagination.hasPrev) e.preventDefault();
          }}
          className={cn(
            "ai-btn-secondary h-8 gap-1 px-2.5 text-xs",
            !pagination.hasPrev && "pointer-events-none opacity-45",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {prevLabel || "Prev"}
        </a>
        <a
          href={
            pagination.hasNext
              ? buildPageUrl(baseUrl, { ...extraParams, page: pagination.page + 1, per_page: pagination.perPage })
              : "#"
          }
          aria-disabled={!pagination.hasNext}
          onClick={(e) => {
            if (!pagination.hasNext) e.preventDefault();
          }}
          className={cn(
            "ai-btn-secondary h-8 gap-1 px-2.5 text-xs",
            !pagination.hasNext && "pointer-events-none opacity-45",
          )}
        >
          {nextLabel || "Next"}
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
