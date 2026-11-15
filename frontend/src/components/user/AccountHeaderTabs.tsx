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
 * Shared sub-navigation bar linking Profile & Security, Workspace Preferences, and Device Sessions.
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
      label: isKhmer ? "ប្រវត្តិរូប និងសុវត្ថិភាព" : "Profile & Security",
      href: profileUrl,
      icon: UserCircle,
    },
    {
      key: "settings",
      label: isKhmer ? "ការកំណត់គណនី" : "Workspace Preferences",
      href: settingsUrl,
      icon: SlidersHorizontal,
    },
    {
      key: "activity",
      label: isKhmer ? "ឧបករណ៍ និងសម័យចូល" : "Devices & Sessions",
      href: loginActivityUrl,
      icon: MonitorSmartphone,
    },
  ];

  return (
    <div
      style={{ ["--stagger" as string]: 0 }}
      className="ai-stagger mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] pb-4 dark:border-[#2b3245]"
    >
      <nav
        aria-label={isKhmer ? "ការរុករកគណនី" : "Account sections"}
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#cbd0dd]/80 bg-white/80 p-1 shadow-sm dark:border-[#2b3245] dark:bg-[#141824]/90"
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
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-[#3874ff] text-white shadow-sm"
                  : "text-[#525b75] hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </a>
          );
        })}
      </nav>

      {typeof twoFactorEnabled === "boolean" && (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold",
            twoFactorEnabled
              ? "border-[#90d67f] bg-[#d9fbd0]/75 text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#90ee7a]"
              : "border-[#cbd0dd] bg-[#eff2f6] text-[#525b75] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc]",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            {twoFactorEnabled
              ? isKhmer
                ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់៖ បើក"
                : "2FA Protection Active"
              : isKhmer
                ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់៖ បិទ"
                : "2FA Not Enabled"}
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
