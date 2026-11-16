import React from "react";
import { MonitorSmartphone, ShieldCheck, SlidersHorizontal, UserCircle } from "lucide-react";
import type { LanguageCode } from "@/types/app";
import { cn } from "@/lib/utils";

export type AccountTabKey = "profile" | "settings" | "activity";

interface AccountHeaderTabsProps {
  active: AccountTabKey;
  lang: LanguageCode;
  profileUrl: string;
  settingsUrl: string;
  loginActivityUrl: string;
  twoFactorEnabled?: boolean;
}

/**
 * Mobile-platform segmented navigation bar linking Profile & Security,
 * Preferences, and Devices & Sessions.
 */
export function AccountHeaderTabs({
  active,
  lang,
  profileUrl,
  settingsUrl,
  loginActivityUrl,
  twoFactorEnabled,
}: AccountHeaderTabsProps) {
  const isKhmer = lang === "km";

  const tabs: Array<{
    key: AccountTabKey;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: "profile",
      label: isKhmer ? "ប្រវត្តិរូប" : "Profile",
      href: profileUrl,
      icon: UserCircle,
    },
    {
      key: "settings",
      label: isKhmer ? "ការកំណត់" : "Preferences",
      href: settingsUrl,
      icon: SlidersHorizontal,
    },
    {
      key: "activity",
      label: isKhmer ? "ឧបករណ៍" : "Devices",
      href: loginActivityUrl,
      icon: MonitorSmartphone,
    },
  ];

  return (
    <div
      style={{ ["--stagger" as string]: 0 }}
      className="ai-stagger mx-auto mb-5 flex w-full max-w-2xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <nav
        aria-label={isKhmer ? "ការរុករកគណនី" : "Account sections"}
        className="grid flex-1 grid-cols-3 gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-sm dark:border-slate-800 dark:bg-obsidian-900"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <a
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all duration-150",
                isActive
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </a>
          );
        })}
      </nav>

      {typeof twoFactorEnabled === "boolean" && (
        <div
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-[11px] font-bold sm:self-auto",
            twoFactorEnabled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span>
            {twoFactorEnabled
              ? isKhmer
                ? "2FA សកម្ម"
                : "2FA Active"
              : isKhmer
                ? "2FA បានបិទ"
                : "2FA Off"}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Formats an ISO or RFC timestamp safely into a readable local date/time label.
 */
export function formatAccountTimestamp(raw?: string | null): string {
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
