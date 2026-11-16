import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Cpu,
  Globe2,
  Laptop,
  MonitorSmartphone,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Smartphone,
  Sun,
  UserCircle,
} from "lucide-react";
import type { AppBootstrap, LoginActivityEntry, ThemeMode } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AccountHeaderTabs, formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import {
  ACCOUNT_TONE_CLASSES,
  AccountSectionCard,
  AccountSwitch,
  MobileSectionLabel,
} from "@/components/user/AccountPrimitives";
import { useTheme } from "@/context/ThemeContext";
import { buildNavSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface SettingsData {
  submitUrl: string;
  loginActivityUrl: string;
  profileUrl: string;
  theme: ThemeMode;
  twoFactorEnabled: boolean;
  recentActivities: LoginActivityEntry[];
}

function ThemeMiniPreview({ mode }: { mode: ThemeMode }) {
  if (mode === "light") {
    return (
      <div
        aria-hidden="true"
        className="flex h-16 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      >
        <div className="w-6 border-r border-slate-200 bg-white p-1.5">
          <div className="mb-1.5 h-1.5 w-3 rounded-full bg-indigo-500" />
          <div className="space-y-1">
            <div className="h-1 w-full rounded bg-slate-300" />
            <div className="h-1 w-3/4 rounded bg-slate-200" />
          </div>
        </div>
        <div className="flex-1 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="h-1.5 w-8 rounded-full bg-slate-300" />
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-6 rounded border border-slate-200 bg-white" />
            <div className="h-6 rounded border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "dark") {
    return (
      <div
        aria-hidden="true"
        className="flex h-16 w-full overflow-hidden rounded-xl border border-slate-800 bg-obsidian-950"
      >
        <div className="w-6 border-r border-slate-800 bg-obsidian-900 p-1.5">
          <div className="mb-1.5 h-1.5 w-3 rounded-full bg-indigo-500" />
          <div className="space-y-1">
            <div className="h-1 w-full rounded bg-slate-700" />
            <div className="h-1 w-3/4 rounded bg-slate-800" />
          </div>
        </div>
        <div className="flex-1 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="h-1.5 w-8 rounded-full bg-slate-700" />
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-6 rounded border border-slate-800 bg-obsidian-900" />
            <div className="h-6 rounded border border-slate-800 bg-obsidian-900" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="grid h-16 w-full grid-cols-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
    >
      <div className="border-r border-slate-200 bg-slate-50 p-2 dark:border-slate-700">
        <div className="mb-1.5 h-1.5 w-5 rounded-full bg-indigo-500" />
        <div className="h-6 rounded border border-slate-200 bg-white" />
      </div>
      <div className="bg-obsidian-950 p-2">
        <div className="mb-1.5 flex justify-end">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
        </div>
        <div className="h-6 rounded border border-slate-800 bg-obsidian-900" />
      </div>
    </div>
  );
}

export default function SettingsPage({ bootstrap }: { bootstrap: AppBootstrap<SettingsData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(d.theme || "system");
  const [twoFactor, setTwoFactor] = useState(d.twoFactorEnabled);

  const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      value: "light",
      label: isKhmer ? "ពន្លឺ (Light)" : "Light",
      icon: Sun,
    },
    {
      value: "dark",
      label: isKhmer ? "ងងឹត (Dark)" : "Dark",
      icon: Moon,
    },
    {
      value: "system",
      label: isKhmer ? "ស្វ័យប្រវត្តិ" : "System",
      icon: Laptop,
    },
  ];

  const languageOptions = [
    {
      code: "en" as const,
      name: "English (US)",
      subtitle: isKhmer ? "ភាសាអន្តរជាតិស្តង់ដារ" : "Standard platform interface",
      flagClass: "fi-us",
      href: bootstrap.urls.updateLanguageEn || "#",
    },
    {
      code: "km" as const,
      name: "ភាសាខ្មែរ (Khmer)",
      subtitle: isKhmer ? "ចំណុចប្រទាក់ជាភាសាខ្មែរពេញលេញ" : "Full Khmer localization",
      flagClass: "fi-kh",
      href: bootstrap.urls.updateLanguageKm || "#",
    },
  ];

  const activeThemeLabel =
    themeOptions.find((t) => t.value === selectedTheme)?.label || selectedTheme;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.profileUrl} className="ai-btn-secondary h-9 px-3 text-xs">
          <UserCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isKhmer ? "ប្រវត្តិរូប" : "Profile"}</span>
        </a>
      }
    >
      <AccountHeaderTabs
        active="settings"
        lang={bootstrap.lang}
        profileUrl={d.profileUrl}
        settingsUrl={bootstrap.urls.settings || "/users/settings"}
        loginActivityUrl={d.loginActivityUrl}
        twoFactorEnabled={twoFactor}
      />

      <div className="mx-auto w-full max-w-2xl space-y-6 pb-4">
        <form method="post" action={d.submitUrl} className="space-y-5">
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

          {/* Appearance Picker */}
          <div>
            <MobileSectionLabel>
              {isKhmer ? "រចនាប័ទ្មបង្ហាញ" : "Appearance"}
            </MobileSectionLabel>
            <AccountSectionCard
              delayIndex={1}
              tone="blue"
              icon={<Palette className="h-4 w-4" />}
              title={isKhmer ? "រចនាប័ទ្មពណ៌ (Theme)" : "Interface Theme"}
              subtitle={
                isKhmer
                  ? "ប្តូរភ្លាមៗ និងរក្សាទុកឆ្លងឧបករណ៍"
                  : "Live preview across your signed-in devices"
              }
              action={
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-obsidian-800 dark:text-slate-200">
                  {activeThemeLabel}
                </span>
              }
            >
              <div className="grid grid-cols-3 gap-2.5">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = selectedTheme === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer flex-col gap-2.5 rounded-2xl border p-2.5 transition-all",
                        active
                          ? "border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20"
                          : "border-slate-200/80 bg-slate-50/40 hover:border-indigo-300 dark:border-slate-800 dark:bg-obsidian-950/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={opt.value}
                        checked={active}
                        onChange={() => {
                          setSelectedTheme(opt.value);
                          void setTheme(opt.value);
                        }}
                        className="sr-only"
                      />
                      <ThemeMiniPreview mode={opt.value} />
                      <div className="flex items-center justify-between gap-1 px-0.5">
                        <span className="inline-flex items-center gap-1.5 truncate text-xs font-bold text-slate-900 dark:text-white">
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              active ? "text-indigo-500" : "text-slate-400",
                            )}
                          />
                          <span className="truncate">{opt.label}</span>
                        </span>
                        {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            </AccountSectionCard>
          </div>

          {/* Language Picker */}
          <div>
            <MobileSectionLabel>
              {isKhmer ? "ភាសាប្រព័ន្ធ" : "Display Language"}
            </MobileSectionLabel>
            <div className="divide-y divide-slate-200/75 overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-obsidian-900">
              {languageOptions.map((item) => {
                const isSelected = bootstrap.lang === item.code;
                return (
                  <a
                    key={item.code}
                    href={item.href}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50/75 dark:hover:bg-obsidian-850 sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                          isSelected ? ACCOUNT_TONE_CLASSES.blue : ACCOUNT_TONE_CLASSES.slate,
                        )}
                      >
                        <Globe2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`fi ${item.flagClass} h-4 w-5 shrink-0 rounded-sm border border-slate-200/60`}
                            aria-hidden="true"
                          />
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-700" />
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Two-Factor Toggle */}
          <div>
            <MobileSectionLabel>
              {isKhmer ? "សុវត្ថិភាពពេលចូលគណនី" : "Sign-In Protection"}
            </MobileSectionLabel>
            <div className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:border-slate-800 dark:bg-obsidian-900">
              <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                      twoFactor ? ACCOUNT_TONE_CLASSES.emerald : ACCOUNT_TONE_CLASSES.slate,
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {isKhmer ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់ (2FA Email OTP)" : "Two-Factor Email OTP"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {isKhmer
                        ? "ទាមទារកូដ OTP តាមអ៊ីមែលនៅពេលចូលពីឧបករណ៍ថ្មី"
                        : "Require a one-time email verification code on new sign-ins"}
                    </p>
                  </div>
                </div>
                <AccountSwitch
                  name="two_factor_enabled"
                  value="y"
                  checked={twoFactor}
                  label={isKhmer ? "បើក ឬបិទ 2FA OTP" : "Toggle Two-Factor Email Verification"}
                  onChange={setTwoFactor}
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="ai-btn-primary h-11 w-full rounded-2xl text-sm font-bold shadow-sm"
          >
            <Save className="h-4 w-4" />
            <span>{isKhmer ? "រក្សាទុកការកំណត់" : "Save Preferences"}</span>
          </button>
        </form>

        {/* Runtime Summary & Recent Login Devices */}
        <div>
          <MobileSectionLabel>
            {isKhmer ? "ទិដ្ឋភាពទូទៅ និងឧបករណ៍" : "Configuration & Devices"}
          </MobileSectionLabel>
          <div className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:border-slate-800 dark:bg-obsidian-900">
            <dl className="divide-y divide-slate-200/75 px-4 text-xs dark:divide-slate-800 sm:px-5">
              <div className="flex items-center justify-between py-3">
                <dt className="text-slate-500 dark:text-slate-400">
                  {isKhmer ? "រចនាប័ទ្ម" : "Active Theme"}
                </dt>
                <dd className="font-bold text-slate-900 dark:text-white">{activeThemeLabel}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-slate-500 dark:text-slate-400">
                  {isKhmer ? "ភាសា" : "Interface Language"}
                </dt>
                <dd className="font-bold text-slate-900 dark:text-white">
                  {isKhmer ? "ភាសាខ្មែរ" : "English (US)"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{isKhmer ? "ប្រព័ន្ធ AI" : "AI Engine"}</span>
                </dt>
                <dd className="font-bold text-indigo-600 dark:text-indigo-300">Agri-System AI</dd>
              </div>
            </dl>

            <div className="border-t border-slate-200/75 p-4 dark:border-slate-800 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isKhmer ? "ឧបករណ៍ចូលថ្មីៗ" : "Recent Logins"}
                </p>
                <a
                  href={d.loginActivityUrl}
                  className="inline-flex items-center gap-0.5 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300"
                >
                  <span>{isKhmer ? "មើលទាំងអស់" : "Manage all"}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>

              {d.recentActivities.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400 dark:border-slate-800">
                  {isKhmer ? "មិនទាន់មានទិន្នន័យសម័យចូលទេ។" : "No login sessions recorded yet."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {d.recentActivities.map((act) => {
                    const isMobile = (act.device_type || "").toLowerCase().includes("mobile");
                    const DeviceIcon = isMobile
                      ? Smartphone
                      : act.device_type
                        ? Laptop
                        : MonitorSmartphone;
                    return (
                      <li
                        key={act.activity_id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/75 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-obsidian-950/60"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-obsidian-900 dark:text-indigo-300">
                            <DeviceIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900 dark:text-white">
                              {act.browser || "Browser"} · {act.os || "OS"}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono">{act.ip_address || "—"}</span>
                              {(act.last_seen_at || act.created_at) &&
                                ` · ${formatAccountTimestamp(act.last_seen_at || act.created_at)}`}
                            </p>
                          </div>
                        </div>
                        {act.is_current && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {isKhmer ? "បច្ចុប្បន្ន" : "Current"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
