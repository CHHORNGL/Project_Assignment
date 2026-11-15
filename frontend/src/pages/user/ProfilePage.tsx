import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
  UserCircle,
} from "lucide-react";
import type { AppBootstrap, PasskeyItem } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AccountHeaderTabs, formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import { AccountSectionCard, AccountSwitch } from "@/components/user/AccountPrimitives";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/context/ToastContext";
import { performPasskeyRegistration, postJson, requestJson } from "@/lib/api";
import { buildNavSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface ProfileData {
  submitUrl: string;
  toggle2faUrl: string;
  passkeysListUrl: string;
  passkeyDeletePrefix: string;
  passkeyRegisterOptionsUrl: string;
  passkeyRegisterVerifyUrl: string;
  settingsUrl: string;
  loginActivityUrl: string;
  repLabel?: string | null;
  memberCardUrl?: string | null;
  twoFactorEnabled: boolean;
  isPremium: boolean;
  authProvider: string;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function ProfilePage({ bootstrap }: { bootstrap: AppBootstrap<ProfileData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const initialAvatar = bootstrap.user.avatar_url || "/static/img/avatar.png";
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar);
  const [selectedAvatarName, setSelectedAvatarName] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [twoFactor, setTwoFactor] = useState(d.twoFactorEnabled);
  const [toggling2fa, setToggling2fa] = useState(false);

  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [passkeyName, setPasskeyName] = useState("");
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const revokePreviewUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => revokePreviewUrl();
  }, []);

  const loadPasskeys = async () => {
    setLoadingPasskeys(true);
    try {
      const res = await requestJson<{ passkeys?: PasskeyItem[] }>(d.passkeysListUrl, "GET");
      if (res.ok && Array.isArray(res.data.passkeys)) {
        setPasskeys(res.data.passkeys);
      }
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    void loadPasskeys();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      pushToast(
        "warning",
        isKhmer ? "រូបភាពមានទំហំធំពេក (អតិបរមា 2 MB)។" : "Avatar file exceeds the 2 MB limit.",
      );
      e.target.value = "";
      return;
    }
    revokePreviewUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setAvatarPreview(url);
    setSelectedAvatarName(file.name);
  };

  const handleResetAvatar = () => {
    revokePreviewUrl();
    setAvatarPreview(initialAvatar);
    setSelectedAvatarName(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!newPassword && !confirmPassword) return;
    if (!currentPassword) {
      e.preventDefault();
      pushToast(
        "danger",
        isKhmer ? "សូមបញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្នជាមុនសិន។" : "Current password is required to set a new password.",
      );
      return;
    }
    if (newPassword.length < 6) {
      e.preventDefault();
      pushToast(
        "danger",
        isKhmer ? "ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។" : "New password must be at least 6 characters.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      e.preventDefault();
      pushToast(
        "danger",
        isKhmer ? "ពាក្យសម្ងាត់ថ្មីមិនដូចគ្នាទេ។" : "New password and confirmation do not match.",
      );
    }
  };

  const handleToggle2fa = async () => {
    const next = !twoFactor;
    setToggling2fa(true);
    try {
      const res = await postJson<{ status?: string; two_factor_enabled?: boolean }>(
        d.toggle2faUrl,
        { enabled: next },
        bootstrap.csrfToken,
      );
      if (res.ok) {
        setTwoFactor(Boolean(res.data.two_factor_enabled));
        pushToast(
          "success",
          next
            ? isKhmer
              ? "បានបើកការផ្ទៀងផ្ទាត់ ២ ជាន់។"
              : "Two-factor verification enabled."
            : isKhmer
              ? "បានបិទការផ្ទៀងផ្ទាត់ ២ ជាន់។"
              : "Two-factor verification disabled.",
        );
      } else {
        pushToast("danger", isKhmer ? "មិនអាចកែប្រែ 2FA បានទេ។" : "Failed to update 2FA preference.");
      }
    } finally {
      setToggling2fa(false);
    }
  };

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisteringPasskey(true);
    try {
      await performPasskeyRegistration({
        optionsUrl: d.passkeyRegisterOptionsUrl,
        verifyUrl: d.passkeyRegisterVerifyUrl,
        name: passkeyName.trim() || "My Passkey",
        csrfToken: bootstrap.csrfToken,
      });
      setPasskeyName("");
      pushToast("success", isKhmer ? "បានចុះឈ្មោះ Passkey ដោយជោគជ័យ!" : "Passkey registered successfully.");
      await loadPasskeys();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Passkey registration failed.";
      pushToast("danger", msg);
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await requestJson<{ status?: string }>(
        `${d.passkeyDeletePrefix}${id}`,
        "DELETE",
        bootstrap.csrfToken,
      );
      if (res.ok) {
        setPasskeys((prev) => prev.filter((item) => item.id !== id));
        pushToast("success", isKhmer ? "បានលុប Passkey រួចរាល់។" : "Passkey removed.");
      } else {
        pushToast("danger", isKhmer ? "មិនអាចលុប Passkey បានទេ។" : "Could not delete passkey.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const passwordsEntered = Boolean(newPassword || confirmPassword);
  const passwordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.settingsUrl} className="ai-btn-secondary h-9 px-3 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{isKhmer ? "ការកំណត់គណនី" : "Preferences"}</span>
        </a>
      }
    >
      <AccountHeaderTabs
        active="profile"
        lang={bootstrap.lang}
        profileUrl={bootstrap.urls.profile || "/users/profile"}
        settingsUrl={d.settingsUrl}
        loginActivityUrl={d.loginActivityUrl}
        twoFactorEnabled={twoFactor}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        {/* Left Column: Identity & Password Form */}
        <form
          method="post"
          action={d.submitUrl}
          encType="multipart/form-data"
          onSubmit={handleProfileSubmit}
          className="space-y-6 xl:col-span-8"
        >
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

          {/* Identity & Account Information Card */}
          <AccountSectionCard
            delayIndex={1}
            tone="blue"
            icon={<UserCircle className="h-4 w-4" />}
            title={isKhmer ? "ព័ត៌មានគណនី និងរូបភាពតំណាង" : "Identity & Account Profile"}
            subtitle={
              isKhmer
                ? "គ្រប់គ្រងឈ្មោះបង្ហាញ រូបភាពតំណាង និងអ៊ីមែលសុវត្ថិភាពរបស់អ្នក។"
                : "Update your public profile photo, username handle, and recovery email."
            }
            action={
              d.memberCardUrl &&
              d.repLabel && (
                <a
                  href={d.memberCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#adc5ff] bg-[#e5edff]/70 px-2.5 py-1 text-xs font-semibold text-[#004dff] transition hover:bg-[#e5edff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                >
                  <span>{isKhmer ? "ប័ណ្ណសម្គាល់" : "Member Card"}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )
            }
          >
            {/* Avatar & Identity Header Strip */}
            <div className="mb-6 flex flex-col justify-between gap-4 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="group relative shrink-0">
                  <img
                    src={avatarPreview}
                    alt={bootstrap.user.full_name || bootstrap.user.username}
                    onError={(e) => {
                      e.currentTarget.src = "/static/img/avatar.png";
                    }}
                    className="h-20 w-20 rounded-2xl border border-[#cbd0dd] object-cover shadow-sm dark:border-[#373e53]"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-white bg-[#3874ff] text-white shadow-md transition hover:bg-[#004dff] dark:border-[#141824]"
                    title={isKhmer ? "ផ្លាស់ប្តូររូបភាព" : "Upload avatar"}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <input
                      ref={avatarInputRef}
                      id="avatar-upload"
                      type="file"
                      name="avatar"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]">
                      {bootstrap.user.full_name || bootstrap.user.username}
                    </h3>
                    {d.isPremium && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#ffcc85] bg-[#ffefca] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#bc3803] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]">
                        <BadgeCheck className="h-3 w-3" />
                        PRO
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {(bootstrap.user.roles.length ? bootstrap.user.roles : ["member"]).map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center rounded-md border border-[#cbd0dd] bg-white px-2 py-0.5 text-[11px] font-semibold capitalize text-[#31374a] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6]"
                      >
                        {role}
                      </span>
                    ))}
                    <span className="inline-flex items-center rounded-md border border-[#cbd0dd] bg-white px-2 py-0.5 text-[11px] font-medium text-[#6e7891] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc]">
                      Auth: <span className="ml-1 font-semibold capitalize">{d.authProvider}</span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {selectedAvatarName
                      ? isKhmer
                        ? `បានជ្រើសរើស៖ ${selectedAvatarName} (ចុចរក្សាទុកដើម្បីបញ្ជាក់)`
                        : `Ready to upload: ${selectedAvatarName}`
                      : isKhmer
                        ? "គាំទ្រ JPG, PNG ឬ WEBP · ទំហំអតិបរមា 2 MB"
                        : "Supports JPG, PNG, or WEBP · Max 2 MB"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <label
                  htmlFor="avatar-upload"
                  className="ai-btn-secondary h-8 cursor-pointer px-3 text-xs"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "ជ្រើសរូបភាព" : "Change Photo"}</span>
                </label>
                {selectedAvatarName && (
                  <button
                    type="button"
                    onClick={handleResetAvatar}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cbd0dd] px-2.5 text-xs font-semibold text-[#525b75] transition hover:bg-[#eff2f6] dark:border-[#373e53] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{isKhmer ? "បោះបង់" : "Reset"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Profile Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-username"
                  className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                >
                  {isKhmer ? "ឈ្មោះអ្នកប្រើប្រាស់" : "Username"}
                </label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    id="profile-username"
                    type="text"
                    name="username"
                    defaultValue={bootstrap.user.username}
                    required
                    className="ai-input pl-9"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "ប្រើសម្រាប់សម្គាល់គណនីនៅក្នុងប្រព័ន្ធ។" : "Unique identifier used to access your workspace."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="profile-full-name"
                  className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                >
                  {isKhmer ? "ឈ្មោះពេញ" : "Full Name"}
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    id="profile-full-name"
                    type="text"
                    name="full_name"
                    defaultValue={bootstrap.user.full_name}
                    placeholder={isKhmer ? "បញ្ចូលឈ្មោះពេញ" : "Enter full name"}
                    className="ai-input pl-9"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "ឈ្មោះដែលបង្ហាញជូនក្រុមការងារ និងកសិករ។" : "Displayed across chats, reviews, and workspace headers."}
                </p>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="profile-email"
                  className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                >
                  {isKhmer ? "អាសយដ្ឋានអ៊ីមែល" : "Email Address"}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    id="profile-email"
                    type="email"
                    name="email"
                    defaultValue={bootstrap.user.email}
                    placeholder="name@company.com"
                    className="ai-input pl-9"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer
                    ? "ប្រើសម្រាប់ទទួលកូដ OTP ផ្ទៀងផ្ទាត់ ២ ជាន់ និងការស្តារពាក្យសម្ងាត់។"
                    : "Receives two-factor verification OTP codes, session alerts, and recovery links."}
                </p>
              </div>
            </div>
          </AccountSectionCard>

          {/* Password Update Card */}
          <AccountSectionCard
            delayIndex={2}
            tone="amber"
            icon={<KeyRound className="h-4 w-4" />}
            title={isKhmer ? "ផ្លាស់ប្តូរពាក្យសម្ងាត់" : "Password & Credentials"}
            subtitle={
              isKhmer
                ? "ទុកទទេប្រសិនបើអ្នកមិនចង់ផ្លាស់ប្តូរពាក្យសម្ងាត់បច្ចុប្បន្នទេ។"
                : "Optional — leave blank to keep your existing sign-in password unchanged."
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ពាក្យសម្ងាត់បច្ចុប្បន្ន" : "Current Password"}
                </label>
                <PasswordInput
                  name="current_password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "ពាក្យសម្ងាត់ថ្មី" : "New Password"}
                </label>
                <PasswordInput
                  name="new_password"
                  autoComplete="new-password"
                  placeholder={isKhmer ? "យ៉ាងតិច ៦ តួអក្សរ" : "Minimum 6 characters"}
                  showStrength
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {isKhmer ? "បញ្ជាក់ពាក្យសម្ងាត់ថ្មី" : "Confirm New Password"}
                </label>
                <PasswordInput
                  name="confirm_password"
                  autoComplete="new-password"
                  placeholder={isKhmer ? "វាយបញ្ចូលម្តងទៀត" : "Repeat new password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {passwordsEntered && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <span className="text-[#bc3803] dark:text-[#ffbd6b]">
                    {isKhmer
                      ? "ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។"
                      : "New password must be at least 6 characters."}
                  </span>
                )}
                {confirmPassword.length > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-medium",
                      passwordsMatch
                        ? "text-[#1c6c09] dark:text-[#7ee864]"
                        : "text-[#b81800] dark:text-[#ff8f7d]",
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {passwordsMatch
                      ? isKhmer
                        ? "ពាក្យសម្ងាត់ថ្មីត្រូវគ្នា"
                        : "Passwords match"
                      : isKhmer
                        ? "ពាក្យសម្ងាត់ថ្មីមិនត្រូវគ្នាទេ"
                        : "Passwords do not match"}
                  </span>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer
                  ? "រាល់ការផ្លាស់ប្តូរព័ត៌មានត្រូវរក្សាទុកភ្លាមៗបន្ទាប់ពីបញ្ជូន។"
                  : "Updates apply immediately across your active sessions."}
              </p>
              <div className="flex items-center gap-2.5">
                <a href={d.settingsUrl} className="ai-btn-secondary h-9 px-3.5 text-xs">
                  {isKhmer ? "ការកំណត់គណនី" : "Preferences"}
                </a>
                <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "រក្សាទុកការផ្លាស់ប្តូរ" : "Save Profile"}</span>
                </button>
              </div>
            </div>
          </AccountSectionCard>
        </form>

        {/* Right Column: Security Posture, 2FA & Passkeys */}
        <div className="space-y-6 xl:col-span-4">
          {/* Security Posture Summary */}
          <AccountSectionCard
            delayIndex={2}
            tone="emerald"
            icon={<Shield className="h-4 w-4" />}
            title={isKhmer ? "ស្ថានភាពសុវត្ថិភាពគណនី" : "Security Posture"}
            subtitle={isKhmer ? "ទិដ្ឋភាពសង្ខេបនៃការការពារគណនី" : "Live overview of your protection controls"}
          >
            <dl className="divide-y divide-[#e3e6ed] text-xs dark:divide-[#2b3245]">
              <div className="flex items-center justify-between py-2.5 first:pt-0">
                <dt className="text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "វិធីសាស្ត្រចូល" : "Auth Provider"}
                </dt>
                <dd className="font-semibold capitalize text-[#141824] dark:text-[#eff2f6]">
                  {d.authProvider}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់" : "Two-Factor (2FA)"}
                </dt>
                <dd
                  className={cn(
                    "font-semibold",
                    twoFactor ? "text-[#1c6c09] dark:text-[#7ee864]" : "text-[#6e7891] dark:text-[#9fa6bc]",
                  )}
                >
                  {twoFactor ? (isKhmer ? "សកម្ម" : "Enabled") : isKhmer ? "បានបិទ" : "Disabled"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <dt className="text-[#6e7891] dark:text-[#8a94ad]">
                  {isKhmer ? "Passkeys បានចុះឈ្មោះ" : "Enrolled Passkeys"}
                </dt>
                <dd className="font-semibold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                  {loadingPasskeys ? "…" : passkeys.length}
                </dd>
              </div>
            </dl>
          </AccountSectionCard>

          {/* Two-Factor Authentication Card */}
          <AccountSectionCard
            delayIndex={3}
            tone="emerald"
            icon={<ShieldCheck className="h-4 w-4" />}
            title={isKhmer ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់ (2FA)" : "Two-Factor Verification"}
            subtitle={
              isKhmer ? "ផ្ញើកូដ OTP តាមអ៊ីមែលពេលចូលគណនី" : "Email OTP challenge on unrecognized sign-ins"
            }
          >
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
              <div className="min-w-0">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    twoFactor
                      ? "bg-[#d9fbd0] text-[#1c6c09] dark:bg-[#25b003]/20 dark:text-[#90ee7a]"
                      : "bg-[#e3e6ed] text-[#525b75] dark:bg-[#1e2436] dark:text-[#9fa6bc]",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      twoFactor ? "bg-[#25b003]" : "bg-[#8a94ad]",
                    )}
                  />
                  {twoFactor ? (isKhmer ? "បានបើក" : "Active") : isKhmer ? "បានបិទ" : "Off"}
                </span>
                <p className="mt-1 text-xs font-medium text-[#31374a] dark:text-[#cbd0dd]">
                  {twoFactor
                    ? isKhmer
                      ? "កំពុងការពារតាមរយៈ Email OTP"
                      : "Protected via Email OTP"
                    : isKhmer
                      ? "បើកដើម្បីបង្កើនសុវត្ថិភាពគណនី"
                      : "Enable an extra verification step"}
                </p>
              </div>
              <AccountSwitch
                checked={twoFactor}
                busy={toggling2fa}
                label={isKhmer ? "បិទឬបើក 2FA" : "Toggle Two-Factor Verification"}
                onClick={handleToggle2fa}
              />
            </div>
          </AccountSectionCard>

          {/* Passkeys Management Card */}
          <AccountSectionCard
            delayIndex={4}
            tone="blue"
            icon={<Fingerprint className="h-4 w-4" />}
            title={isKhmer ? "Passkeys និងជីវមាត្រ" : "Passkeys & Biometrics"}
            subtitle="Face ID, Touch ID, Windows Hello"
          >
            <form onSubmit={handleRegisterPasskey} className="mb-4 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  placeholder={isKhmer ? "ឈ្មោះឧបករណ៍ (ឧ. MacBook Pro)" : "Device label (e.g. MacBook Pro)"}
                  className="ai-input py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={registeringPasskey}
                  className="ai-btn-primary h-9 shrink-0 px-3 text-xs"
                >
                  {registeringPasskey ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>{isKhmer ? "បន្ថែម" : "Add"}</span>
                </button>
              </div>
              <p className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer
                  ? "ចុះឈ្មោះឧបករណ៍នេះដើម្បីចូលប្រើដោយមិនចាំបាច់វាយពាក្យសម្ងាត់។"
                  : "Sign in faster without typing passwords using hardware biometrics."}
              </p>
            </form>

            {loadingPasskeys ? (
              <div className="flex items-center justify-center rounded-xl border border-[#e3e6ed] py-5 text-xs text-[#6e7891] dark:border-[#2b3245] dark:text-[#8a94ad]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#3874ff]" />
                <span>{isKhmer ? "កំពុងផ្ទុក Passkeys..." : "Loading passkeys..."}</span>
              </div>
            ) : passkeys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#cbd0dd] bg-[#f5f7fa]/60 px-4 py-5 text-center dark:border-[#373e53] dark:bg-[#0f111a]/50">
                <Fingerprint className="mx-auto mb-1.5 h-5 w-5 text-[#8a94ad]" />
                <p className="text-xs font-medium text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer ? "មិនទាន់មាន Passkey ចុះឈ្មោះនៅឡើយទេ។" : "No passkeys registered yet."}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {passkeys.map((pk) => (
                  <li
                    key={pk.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/60 px-3 py-2.5 text-xs transition hover:border-[#cbd0dd] dark:border-[#2b3245] dark:bg-[#0f111a]/60 dark:hover:border-[#373e53]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                        <Fingerprint className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">{pk.name}</p>
                        {pk.created_at && (
                          <p className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                            {formatAccountTimestamp(pk.created_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === pk.id}
                      onClick={() => handleDeletePasskey(pk.id)}
                      className="shrink-0 rounded-lg p-1.5 text-[#8a94ad] transition hover:bg-[#ffe0db] hover:text-[#b81800] dark:hover:bg-[#492226] dark:hover:text-[#ff8f7d]"
                      title={isKhmer ? "លុប Passkey" : "Remove passkey"}
                    >
                      {deletingId === pk.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <a
              href={d.loginActivityUrl}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-[#cbd0dd] bg-[#f5f7fa] py-2.5 text-xs font-semibold text-[#31374a] transition hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:bg-[#22283a]"
            >
              <Shield className="h-3.5 w-3.5 text-[#3874ff]" />
              <span>{isKhmer ? "ពិនិត្យសកម្មភាពចូលគណនី" : "Inspect Active Sessions"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </AccountSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
