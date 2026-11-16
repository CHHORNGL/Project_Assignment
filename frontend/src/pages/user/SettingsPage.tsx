import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Laptop,
  Link2,
  MonitorSmartphone,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  UserCircle,
  Volume2,
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
  googleConnected?: boolean;
  googleEmail?: string | null;
  googleOAuthConfigured?: boolean;
  googleConnectUrl?: string;
  googleDisconnectUrl?: string;
  geminiTtsConfigured?: boolean;
  geminiTtsKeyMasked?: string | null;
  geminiTtsModel?: string;
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
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [clearGeminiKey, setClearGeminiKey] = useState(false);

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

          {/* Google Account & Personal Gemini 3.8 Flash TTS */}
          <div>
            <MobileSectionLabel>
              {isKhmer ? "សំឡេង Listen និង Google" : "Voice (Listen) & Google"}
            </MobileSectionLabel>
            <AccountSectionCard
              delayIndex={2}
              tone={d.geminiTtsConfigured ? "emerald" : "blue"}
              icon={<Volume2 className="h-4 w-4" />}
              title={
                isKhmer
                  ? "សំឡេង Gemini 3.8 Flash TTS"
                  : "Google Account & Gemini Voice"
              }
              subtitle={
                isKhmer
                  ? "ប្រើគណនី Google និង Gemini API Key ផ្ទាល់ខ្លួនសម្រាប់ប៊ូតុង Listen"
                  : "Connect Google and save a personal Gemini API key for natural speech"
              }
              action={
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    d.geminiTtsConfigured
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-obsidian-800 dark:text-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      d.geminiTtsConfigured ? "bg-emerald-500" : "bg-slate-400",
                    )}
                  />
                  {d.geminiTtsConfigured
                    ? d.geminiTtsModel || "gemini-3.8-flash-tts"
                    : isKhmer
                      ? "ស្តង់ដារ"
                      : "Standard TTS"}
                </span>
              }
            >
              <div className="space-y-4">
                {/* Step 1: Google Account Link */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/75 px-3.5 py-3 dark:border-slate-800 dark:bg-obsidian-950/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                        d.googleConnected
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                          : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-obsidian-900 dark:text-slate-300",
                      )}
                    >
                      <Link2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {d.googleConnected
                          ? isKhmer
                            ? "បានភ្ជាប់គណនី Google"
                            : "Google Account Connected"
                          : isKhmer
                            ? "ភ្ជាប់គណនី Google"
                            : "Connect Google Account"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {d.googleConnected
                          ? d.googleEmail ||
                            (isKhmer ? "បានផ្ទៀងផ្ទាត់ជាមួយ Google" : "Verified via Google Sign-In")
                          : d.googleOAuthConfigured
                            ? isKhmer
                              ? "ភ្ជាប់គណនី Google របស់អ្នកសម្រាប់ការចូលប្រើរហ័ស"
                              : "Link your Google account for seamless access"
                            : isKhmer
                              ? "ការភ្ជាប់ Google OAuth មិនទាន់បើកនៅលើម៉ាស៊ីនមេទេ"
                              : "Server Google OAuth is not enabled in .env yet"}
                      </p>
                    </div>
                  </div>

                  {d.googleConnected ? (
                    <button
                      type="submit"
                      form="google-disconnect-form"
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:bg-obsidian-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      {isKhmer ? "ផ្តាច់ការភ្ជាប់" : "Disconnect"}
                    </button>
                  ) : d.googleOAuthConfigured && d.googleConnectUrl ? (
                    <a
                      href={d.googleConnectUrl}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-obsidian-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "ភ្ជាប់ Google" : "Connect Google"}</span>
                    </a>
                  ) : null}
                </div>

                {/* Google AI Pro / Ultra Guidance */}
                <div className="rounded-2xl border border-indigo-200/75 bg-indigo-50/70 p-3.5 text-xs dark:border-indigo-500/20 dark:bg-indigo-950/25">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {isKhmer
                          ? "អ្នកប្រើ Google AI Pro ឬ Ultra?"
                          : "Using Google AI Pro or Ultra?"}
                      </p>
                      <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                        {isKhmer
                          ? "សូមបើក Google AI Studio ដើម្បីទទួលក្រេឌីត និងបង្កើត Gemini API Key ផ្ទាល់ខ្លួន រួចបិទភ្ជាប់ខាងក្រោម។ ប៊ូតុង Listen នឹងអានជាភាសាខ្មែរ/អង់គ្លេសដោយប្រើ gemini-3.8-flash-tts ចំណែកចម្លើយ AI នៅតែប្រើគំរូកសិកម្មរបស់ប្រព័ន្ធ។"
                          : "Claim your developer credits in Google AI Studio to create a Gemini API key and paste it below. Listen will speak Khmer & English answers with gemini-3.8-flash-tts, while chat replies continue using Agri-System AI."}
                      </p>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline dark:text-indigo-300"
                      >
                        <span>
                          {isKhmer ? "បង្កើត API Key ក្នុង Google AI Studio" : "Get API Key in Google AI Studio"}
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Step 2: Personal Gemini API Key */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="gemini_api_key_input"
                      className="text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      {isKhmer ? "Gemini API Key ផ្ទាល់ខ្លួន (សម្រាប់ Listen)" : "Personal Gemini API Key (Listen TTS)"}
                    </label>
                    {d.geminiTtsConfigured && d.geminiTtsKeyMasked && !clearGeminiKey && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {d.geminiTtsKeyMasked}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="gemini_api_key_input"
                      name="gemini_api_key"
                      className="ai-input w-full pl-10 pr-11 font-mono text-xs"
                      type={showGeminiKey ? "text" : "password"}
                      value={geminiApiKey}
                      onChange={(e) => {
                        setGeminiApiKey(e.target.value);
                        if (e.target.value.trim()) {
                          setClearGeminiKey(false);
                        }
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        d.geminiTtsConfigured
                          ? isKhmer
                            ? "បញ្ចូល Key ថ្មីដើម្បីប្តូរ (ទុកទទេដើម្បីរក្សា Key ចាស់)"
                            : "Enter a new key to replace (leave blank to keep saved key)"
                          : "AIza..."
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey((v) => !v)}
                      aria-label={showGeminiKey ? "Hide API key" : "Show API key"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-obsidian-800 dark:hover:text-slate-200"
                    >
                      {showGeminiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {d.geminiTtsConfigured && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200/80 px-3.5 py-2.5 text-xs dark:border-slate-800">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {isKhmer
                          ? "លុប Gemini API Key ដែលបានរក្សាទុក"
                          : "Remove saved Gemini API key"}
                      </span>
                      <AccountSwitch
                        name="clear_gemini_api_key"
                        value="y"
                        checked={clearGeminiKey}
                        label={isKhmer ? "លុប Gemini API Key" : "Remove saved Gemini API key"}
                        onChange={(checked) => {
                          setClearGeminiKey(checked);
                          if (checked) setGeminiApiKey("");
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </AccountSectionCard>
          </div>

          <button
            type="submit"
            className="ai-btn-primary h-11 w-full rounded-2xl text-sm font-bold shadow-sm"
          >
            <Save className="h-4 w-4" />
            <span>{isKhmer ? "រក្សាទុកការកំណត់" : "Save Preferences"}</span>
          </button>
        </form>

        {d.googleConnected && d.googleDisconnectUrl && (
          <form
            id="google-disconnect-form"
            method="post"
            action={d.googleDisconnectUrl}
            className="hidden"
          >
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
          </form>
        )}

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
              <div className="flex items-center justify-between py-3">
                <dt className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{isKhmer ? "សំឡេង (Listen)" : "Voice (Listen)"}</span>
                </dt>
                <dd
                  className={cn(
                    "font-bold",
                    d.geminiTtsConfigured
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-slate-700 dark:text-slate-200",
                  )}
                >
                  {d.geminiTtsConfigured
                    ? `Personal ${d.geminiTtsModel || "gemini-3.8-flash-tts"}`
                    : isKhmer
                      ? "ស្តង់ដារ"
                      : "Standard TTS"}
                </dd>
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
