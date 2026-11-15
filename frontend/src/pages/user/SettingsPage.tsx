import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
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
import { AccountSectionCard, AccountSwitch } from "@/components/user/AccountPrimitives";
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
        className="flex h-20 w-full overflow-hidden rounded-lg border border-[#cbd0dd] bg-[#f5f7fa]"
      >
        <div className="w-8 border-r border-[#e3e6ed] bg-white p-1.5">
          <div className="mb-1.5 h-1.5 w-4 rounded-full bg-[#3874ff]" />
          <div className="space-y-1">
            <div className="h-1 w-full rounded bg-[#cbd0dd]" />
            <div className="h-1 w-3/4 rounded bg-[#e3e6ed]" />
          </div>
        </div>
        <div className="flex-1 p-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="h-1.5 w-10 rounded-full bg-[#31374a]/25" />
            <div className="h-2 w-2 rounded-full bg-[#3874ff]" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-7 rounded border border-[#e3e6ed] bg-white" />
            <div className="h-7 rounded border border-[#e3e6ed] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "dark") {
    return (
      <div
        aria-hidden="true"
        className="flex h-20 w-full overflow-hidden rounded-lg border border-[#2b3245] bg-[#0f111a]"
      >
        <div className="w-8 border-r border-[#2b3245] bg-[#141824] p-1.5">
          <div className="mb-1.5 h-1.5 w-4 rounded-full bg-[#3874ff]" />
          <div className="space-y-1">
            <div className="h-1 w-full rounded bg-[#373e53]" />
            <div className="h-1 w-3/4 rounded bg-[#2b3245]" />
          </div>
        </div>
        <div className="flex-1 p-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="h-1.5 w-10 rounded-full bg-[#9fa6bc]/30" />
            <div className="h-2 w-2 rounded-full bg-[#3874ff]" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-7 rounded border border-[#2b3245] bg-[#141824]" />
            <div className="h-7 rounded border border-[#2b3245] bg-[#141824]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="grid h-20 w-full grid-cols-2 overflow-hidden rounded-lg border border-[#cbd0dd] dark:border-[#373e53]"
    >
      <div className="border-r border-[#cbd0dd] bg-[#f5f7fa] p-2 dark:border-[#373e53]">
        <div className="mb-1.5 h-1.5 w-6 rounded-full bg-[#3874ff]" />
        <div className="h-8 rounded border border-[#e3e6ed] bg-white" />
      </div>
      <div className="bg-[#0f111a] p-2">
        <div className="mb-1.5 flex justify-end">
          <div className="h-2 w-2 rounded-full bg-[#3874ff]" />
        </div>
        <div className="h-8 rounded border border-[#2b3245] bg-[#141824]" />
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
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      value: "light",
      label: isKhmer ? "ពន្លឺ (Light)" : "Light Mode",
      desc: isKhmer ? "ផ្ទៃភ្លឺច្បាស់សម្រាប់ពេលថ្ងៃ" : "Clean daylight slate workspace",
      icon: Sun,
    },
    {
      value: "dark",
      label: isKhmer ? "ងងឹត (Dark)" : "Dark Mode",
      desc: isKhmer ? "ផ្ទៃងងឹតស្រទន់កាត់បន្ថយពន្លឺភ្នែក" : "Low-glare nocturnal palette",
      icon: Moon,
    },
    {
      value: "system",
      label: isKhmer ? "តាមប្រព័ន្ធ (System)" : "System Auto",
      desc: isKhmer ? "ប្តូរដោយស្វ័យប្រវត្តិតាមឧបករណ៍" : "Matches your OS appearance",
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

  const activeThemeLabel = themeOptions.find((t) => t.value === selectedTheme)?.label || selectedTheme;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.profileUrl} className="ai-btn-secondary h-9 px-3 text-xs">
          <UserCircle className="h-3.5 w-3.5" />
          <span>{isKhmer ? "កែសម្រួលប្រវត្តិរូប" : "Edit Profile"}</span>
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

      <div className="grid gap-6 xl:grid-cols-12">
        {/* Main Preferences Form */}
        <form method="post" action={d.submitUrl} className="space-y-6 xl:col-span-8">
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

          {/* Appearance Theme Card */}
          <AccountSectionCard
            delayIndex={1}
            tone="blue"
            icon={<Palette className="h-4 w-4" />}
            title={isKhmer ? "រចនាប័ទ្មបង្ហាញ (Theme)" : "Interface Appearance"}
            subtitle={
              isKhmer
                ? "រក្សាទុកជាប់លាប់រវាងឧបករណ៍ និងកម្មវិធីរុករកទាំងអស់។"
                : "Changes preview instantly and sync across your signed-in sessions."
            }
            action={
              <span className="inline-flex items-center rounded-md border border-[#cbd0dd] bg-[#f5f7fa] px-2.5 py-1 text-[11px] font-semibold text-[#31374a] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6]">
                {activeThemeLabel}
              </span>
            }
          >
            <div className="grid gap-3.5 sm:grid-cols-3">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = selectedTheme === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "group flex cursor-pointer flex-col gap-3 rounded-xl border p-3.5 transition-all duration-150",
                      active
                        ? "border-[#3874ff] bg-[#e5edff]/35 ring-2 ring-[#3874ff]/20 dark:bg-[#3874ff]/10"
                        : "border-[#cbd0dd] bg-white hover:border-[#85a9ff] dark:border-[#2b3245] dark:bg-[#0f111a]/50 dark:hover:border-[#373e53]",
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

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              active ? "text-[#3874ff]" : "text-[#6e7891] dark:text-[#8a94ad]",
                            )}
                          />
                          <p className="truncate text-xs font-bold text-[#141824] dark:text-[#eff2f6]">
                            {opt.label}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-[#6e7891] dark:text-[#8a94ad]">
                          {opt.desc}
                        </p>
                      </div>
                      <CheckCircle2
                        className={cn(
                          "h-4 w-4 shrink-0 transition-opacity",
                          active ? "text-[#3874ff] opacity-100" : "opacity-0",
                        )}
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </AccountSectionCard>

          {/* Language Preference Card */}
          <AccountSectionCard
            delayIndex={2}
            tone="blue"
            icon={<Globe2 className="h-4 w-4" />}
            title={isKhmer ? "ភាសាប្រព័ន្ធ (Language)" : "Display Language & Locale"}
            subtitle={
              isKhmer
                ? "ជ្រើសរើសភាសាសម្រាប់ម៉ឺនុយ របាយការណ៍ និងការជូនដំណឹង។"
                : "Select the default language used for navigation, AI output, and alerts."
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {languageOptions.map((item) => {
                const isSelected = bootstrap.lang === item.code;
                return (
                  <a
                    key={item.code}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-all duration-150",
                      isSelected
                        ? "border-[#3874ff] bg-[#e5edff]/35 ring-2 ring-[#3874ff]/15 dark:bg-[#3874ff]/10"
                        : "border-[#cbd0dd] bg-[#f5f7fa]/60 hover:border-[#85a9ff] hover:bg-white dark:border-[#2b3245] dark:bg-[#0f111a]/50 dark:hover:border-[#373e53] dark:hover:bg-[#181d2b]",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`fi ${item.flagClass} h-5 w-6 shrink-0 rounded-sm border border-[#cbd0dd]/60`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                          {item.name}
                        </p>
                        <p className="truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3874ff]" />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-[#cbd0dd] dark:border-[#373e53]" />
                    )}
                  </a>
                );
              })}
            </div>
          </AccountSectionCard>

          {/* Two-Factor Policy & Save Footer Card */}
          <AccountSectionCard
            delayIndex={3}
            tone="emerald"
            icon={<ShieldCheck className="h-4 w-4" />}
            title={isKhmer ? "សុវត្ថិភាពពេលចូលគណនី" : "Sign-In Protection"}
            subtitle={
              isKhmer
                ? "គ្រប់គ្រងការផ្ទៀងផ្ទាត់ ២ ជាន់សម្រាប់ការចូលប្រើប្រាស់គណនី។"
                : "Configure secondary verification requirements when logging into your workspace."
            }
          >
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 transition hover:border-[#cbd0dd] dark:border-[#2b3245] dark:bg-[#0f111a]/65 dark:hover:border-[#373e53]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                    {isKhmer ? "ការផ្ទៀងផ្ទាត់ពីរជាន់ (2FA Email OTP)" : "Two-Factor Email Verification (2FA)"}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      twoFactor
                        ? "bg-[#d9fbd0] text-[#1c6c09] dark:bg-[#25b003]/20 dark:text-[#90ee7a]"
                        : "bg-[#e3e6ed] text-[#525b75] dark:bg-[#1e2436] dark:text-[#9fa6bc]",
                    )}
                  >
                    {twoFactor ? (isKhmer ? "បានបើក" : "Enabled") : isKhmer ? "បានបិទ" : "Disabled"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer
                    ? "ទាមទារកូដ OTP តាមអ៊ីមែលនៅពេលចូលពីឧបករណ៍ថ្មី"
                    : "Require a one-time email verification code during account sign-in."}
                </p>
              </div>
              <AccountSwitch
                name="two_factor_enabled"
                value="y"
                checked={twoFactor}
                label={isKhmer ? "បើក ឬបិទ 2FA OTP" : "Toggle Two-Factor Email Verification"}
                onChange={setTwoFactor}
              />
            </label>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer
                  ? "ចុចរក្សាទុកដើម្បីបញ្ជាក់ការផ្លាស់ប្តូរការកំណត់គណនី។"
                  : "Save preferences to persist theme and 2FA settings to your account."}
              </p>
              <div className="flex items-center gap-2.5">
                <a href={d.profileUrl} className="ai-btn-secondary h-9 px-3.5 text-xs">
                  {isKhmer ? "ប្រវត្តិរូប" : "Edit Profile"}
                </a>
                <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "រក្សាទុកការកំណត់" : "Save Settings"}</span>
                </button>
              </div>
            </div>
          </AccountSectionCard>
        </form>

        {/* Right Column: Workspace Summary & Recent Login Devices */}
        <div className="space-y-6 xl:col-span-4">
          <AccountSectionCard
            delayIndex={2}
            tone="slate"
            icon={<Cpu className="h-4 w-4" />}
            title={isKhmer ? "សង្ខេបការកំណត់បច្ចុប្បន្ន" : "Workspace Summary"}
            subtitle={isKhmer ? "ការកំណត់សកម្មសម្រាប់គណនីនេះ" : "Active runtime configuration"}
          >
            <dl className="divide-y divide-[#e3e6ed] text-xs dark:divide-[#2b3245]">
              <div className="flex items-center justify-between py-2.5 first:pt-0">
                <dt className="text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "រចនាប័ទ្ម" : "Active Theme"}
                </dt>
                <dd className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                  {activeThemeLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "ភាសា" : "Interface Language"}
                </dt>
                <dd className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                  {isKhmer ? "ភាសាខ្មែរ" : "English (US)"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់" : "Two-Factor Auth"}
                </dt>
                <dd
                  className={cn(
                    "font-semibold",
                    twoFactor ? "text-[#1c6c09] dark:text-[#7ee864]" : "text-[#6e7891] dark:text-[#9fa6bc]",
                  )}
                >
                  {twoFactor ? (isKhmer ? "បានបើក" : "Enabled") : isKhmer ? "បានបិទ" : "Disabled"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <dt className="text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "ម៉ូដែល AI" : "AI Engine"}
                </dt>
                <dd className="font-semibold text-[#3874ff]">Agri-System AI</dd>
              </div>
            </dl>
          </AccountSectionCard>

          <AccountSectionCard
            delayIndex={3}
            tone="blue"
            icon={<MonitorSmartphone className="h-4 w-4" />}
            title={isKhmer ? "សម័យចូលគណនីថ្មីៗ" : "Recent Login Devices"}
            subtitle={isKhmer ? "ឧបករណ៍ចំនួន ៥ ចុងក្រោយ" : "Latest 5 device sign-ins"}
          >
            {d.recentActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#cbd0dd] bg-[#f5f7fa]/60 px-4 py-6 text-center text-xs text-[#6e7891] dark:border-[#373e53] dark:bg-[#0f111a]/50 dark:text-[#8a94ad]">
                {isKhmer ? "មិនទាន់មានទិន្នន័យសម័យចូលទេ។" : "No login sessions recorded yet."}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {d.recentActivities.map((act) => {
                  const isMobile = (act.device_type || "").toLowerCase().includes("mobile");
                  const DeviceIcon = isMobile ? Smartphone : act.device_type ? Laptop : MonitorSmartphone;
                  return (
                    <li
                      key={act.activity_id}
                      className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/65 p-3 text-xs transition hover:border-[#cbd0dd] dark:border-[#2b3245] dark:bg-[#0f111a]/60 dark:hover:border-[#373e53]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#cbd0dd]/80 bg-white text-[#3874ff] dark:border-[#373e53] dark:bg-[#141824]">
                            <DeviceIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {act.browser || "Browser"} · {act.os || "OS"}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                              {act.ip_address || "—"} · {act.login_route || "/auth/login"}
                            </p>
                          </div>
                        </div>

                        {act.is_current && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#d9fbd0] px-2 py-0.5 text-[10px] font-bold text-[#1c6c09] dark:bg-[#25b003]/20 dark:text-[#90ee7a]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#25b003]" />
                            {isKhmer ? "បច្ចុប្បន្ន" : "Current"}
                          </span>
                        )}
                      </div>
                      {(act.last_seen_at || act.created_at) && (
                        <p className="mt-2 pl-10 text-[11px] text-[#8a94ad]">
                          {formatAccountTimestamp(act.last_seen_at || act.created_at)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <a
              href={d.loginActivityUrl}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-[#cbd0dd] bg-[#f5f7fa] py-2.5 text-xs font-semibold text-[#31374a] transition hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:bg-[#22283a]"
            >
              <span>{isKhmer ? "គ្រប់គ្រងឧបករណ៍ទាំងអស់" : "Manage All Devices"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </AccountSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
