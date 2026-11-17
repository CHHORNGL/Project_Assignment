import React, { useEffect, useRef, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crop,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MonitorSmartphone,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
} from "lucide-react";
import type { AppBootstrap, PasskeyItem } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AccountHeaderTabs, formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import { AvatarCropModal } from "@/components/user/AvatarCropModal";
import {
  ACCOUNT_TONE_CLASSES,
  AccountSwitch,
  MobileSectionLabel,
} from "@/components/user/AccountPrimitives";
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
const MAX_RAW_AVATAR_BYTES = 15 * 1024 * 1024;

export default function ProfilePage({ bootstrap }: { bootstrap: AppBootstrap<ProfileData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const initialAvatar = bootstrap.user.avatar_url || "/static/img/avatar.png";
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar);
  const [selectedAvatarName, setSelectedAvatarName] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<{ url: string; name: string } | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
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
    if (file.size > MAX_RAW_AVATAR_BYTES) {
      pushToast(
        "warning",
        isKhmer ? "រូបភាពដើមធំពេក (អតិបរមា 15 MB)។" : "Image file is too large to process (max 15 MB).",
      );
      e.target.value = "";
      return;
    }
    revokePreviewUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setCropSource({ url, name: file.name });
    setCropModalOpen(true);
    e.target.value = "";
  };

  const handleApplyCrop = (croppedFile: File, previewDataUrl: string) => {
    if (croppedFile.size > MAX_AVATAR_BYTES) {
      pushToast(
        "warning",
        isKhmer ? "រូបភាពដែលបានកាត់ធំជាង 2 MB។" : "Cropped image exceeds the 2 MB limit.",
      );
      return;
    }
    if (avatarInputRef.current && typeof DataTransfer !== "undefined") {
      const dt = new DataTransfer();
      dt.items.add(croppedFile);
      avatarInputRef.current.files = dt.files;
    }
    setAvatarPreview(previewDataUrl);
    setSelectedAvatarName(croppedFile.name);
    setCropModalOpen(false);
  };

  const handleCancelCropModal = () => {
    setCropModalOpen(false);
    if (!selectedAvatarName) {
      revokePreviewUrl();
      setCropSource(null);
    }
  };

  const handleResetAvatar = () => {
    revokePreviewUrl();
    setCropSource(null);
    setCropModalOpen(false);
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
      setPasswordOpen(true);
      pushToast(
        "danger",
        isKhmer
          ? "សូមបញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្នជាមុនសិន។"
          : "Current password is required to set a new password.",
      );
      return;
    }
    if (newPassword.length < 6) {
      e.preventDefault();
      setPasswordOpen(true);
      pushToast(
        "danger",
        isKhmer
          ? "ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។"
          : "New password must be at least 6 characters.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      e.preventDefault();
      setPasswordOpen(true);
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
      pushToast(
        "success",
        isKhmer ? "បានចុះឈ្មោះ Passkey ដោយជោគជ័យ!" : "Passkey registered successfully.",
      );
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

  const passwordsEntered = Boolean(currentPassword || newPassword || confirmPassword);
  const passwordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);
  const logoutHref = bootstrap.urls.logout || "/auth/logout";
  const roles = bootstrap.user.roles.length ? bootstrap.user.roles : ["member"];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.settingsUrl} className="ai-btn-secondary h-9 px-3 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isKhmer ? "ការកំណត់" : "Preferences"}</span>
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

      <div className="mx-auto w-full max-w-2xl space-y-6 pb-4">
        {/* Main Profile & Password Form */}
        <form
          method="post"
          action={d.submitUrl}
          encType="multipart/form-data"
          onSubmit={handleProfileSubmit}
          className="space-y-5"
        >
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

          {/* Mobile App Profile Hero Card */}
          <section className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:border-slate-800 dark:bg-obsidian-900">
            <div className="relative h-20 bg-gradient-to-r from-indigo-600/15 via-sky-500/10 to-emerald-500/15 dark:from-indigo-500/20 dark:via-sky-500/10 dark:to-emerald-500/15">
              {d.memberCardUrl && d.repLabel && (
                <a
                  href={d.memberCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute right-4 top-3.5 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-bold text-indigo-600 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-obsidian-900/90 dark:text-indigo-300"
                >
                  <span>{isKhmer ? "ប័ណ្ណសម្គាល់" : "Member Card"}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="-mt-12 px-5 pb-5 text-center">
              <div className="relative mx-auto inline-block">
                <img
                  src={avatarPreview}
                  alt={bootstrap.user.full_name || bootstrap.user.username}
                  onError={(e) => {
                    e.currentTarget.src = "/static/img/avatar.png";
                  }}
                  className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md dark:border-obsidian-900"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-md transition hover:bg-indigo-500 dark:border-obsidian-900"
                  title={isKhmer ? "ផ្លាស់ប្តូររូបភាព" : "Change photo"}
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

              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {bootstrap.user.full_name || bootstrap.user.username}
                </h2>
                {d.isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    <BadgeCheck className="h-3 w-3" />
                    PRO
                  </span>
                )}
              </div>

              <p className="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-400">
                @{bootstrap.user.username}
                {bootstrap.user.email ? ` · ${bootstrap.user.email}` : ""}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold capitalize text-slate-700 dark:border-slate-700 dark:bg-obsidian-850 dark:text-slate-200"
                  >
                    {role}
                  </span>
                ))}
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate-500 dark:border-slate-700 dark:bg-obsidian-850 dark:text-slate-400">
                  {d.authProvider}
                </span>
              </div>

              {selectedAvatarName ? (
                <div className="mt-3.5 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  <span className="max-w-[160px] truncate">
                    {isKhmer ? `ត្រៀមផ្ទុក៖ ${selectedAvatarName}` : `Ready: ${selectedAvatarName}`}
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10.5px] font-bold text-white shadow-sm hover:bg-indigo-500"
                  >
                    <Save className="h-3 w-3" />
                    <span>{isKhmer ? "រក្សាទុក" : "Save Photo"}</span>
                  </button>
                  {cropSource && (
                    <button
                      type="button"
                      onClick={() => setCropModalOpen(true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/85 px-2 py-1 text-[10.5px] font-bold text-indigo-700 hover:bg-white dark:bg-obsidian-800 dark:text-indigo-300"
                    >
                      <Crop className="h-3 w-3" />
                      <span>{isKhmer ? "កាត់ម្តងទៀត" : "Adjust"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetAvatar}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-white dark:bg-obsidian-800 dark:text-slate-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{isKhmer ? "បោះបង់" : "Cancel"}</span>
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                  {isKhmer
                    ? "ប៉ះរូបកាមេរ៉ាដើម្បីជ្រើសរើស និងកាត់រូបភាព (JPG, PNG, WEBP)"
                    : "Tap the camera badge to choose & crop your photo (JPG, PNG, WEBP)"}
                </p>
              )}
            </div>
          </section>

          {/* 3-Tile Mobile Security Glance */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-slate-200/85 bg-white p-3 text-center shadow-sm dark:border-slate-800 dark:bg-obsidian-900">
              <div
                className={cn(
                  "mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl border",
                  twoFactor ? ACCOUNT_TONE_CLASSES.emerald : ACCOUNT_TONE_CLASSES.amber,
                )}
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {isKhmer ? "2FA" : "Two-Factor"}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs font-extrabold",
                  twoFactor
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-amber-600 dark:text-amber-300",
                )}
              >
                {twoFactor ? (isKhmer ? "សកម្ម" : "Active") : isKhmer ? "បានបិទ" : "Off"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/85 bg-white p-3 text-center shadow-sm dark:border-slate-800 dark:bg-obsidian-900">
              <div
                className={cn(
                  "mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl border",
                  ACCOUNT_TONE_CLASSES.blue,
                )}
              >
                <Fingerprint className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Passkeys
              </p>
              <p className="mt-0.5 text-xs font-extrabold tabular-nums text-slate-900 dark:text-white">
                {loadingPasskeys
                  ? "…"
                  : `${passkeys.length} ${isKhmer ? "ឧបករណ៍" : "Added"}`}
              </p>
            </div>

            <a
              href={d.loginActivityUrl}
              className="group rounded-2xl border border-slate-200/85 bg-white p-3 text-center shadow-sm transition hover:border-indigo-400/50 dark:border-slate-800 dark:bg-obsidian-900"
            >
              <div
                className={cn(
                  "mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl border",
                  ACCOUNT_TONE_CLASSES.slate,
                )}
              >
                <MonitorSmartphone className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {isKhmer ? "សម័យចូល" : "Sessions"}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-extrabold text-indigo-600 group-hover:underline dark:text-indigo-300">
                <span>{isKhmer ? "ពិនិត្យ" : "Manage"}</span>
                <ChevronRight className="h-3 w-3" />
              </p>
            </a>
          </div>

          {/* Grouped Identity Fields */}
          <div>
            <MobileSectionLabel>
              {isKhmer ? "ព័ត៌មានគណនី" : "Account Details"}
            </MobileSectionLabel>
            <div className="space-y-4 rounded-3xl border border-slate-200/85 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-obsidian-900 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="profile-username"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {isKhmer ? "ឈ្មោះអ្នកប្រើប្រាស់" : "Username"}
                  </label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-username"
                      type="text"
                      name="username"
                      defaultValue={bootstrap.user.username}
                      required
                      className="ai-input h-10 rounded-xl pl-10 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="profile-full-name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {isKhmer ? "ឈ្មោះពេញ" : "Full Name"}
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-full-name"
                      type="text"
                      name="full_name"
                      defaultValue={bootstrap.user.full_name}
                      placeholder={isKhmer ? "បញ្ចូលឈ្មោះពេញ" : "Enter full name"}
                      className="ai-input h-10 rounded-xl pl-10 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-email"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {isKhmer ? "អាសយដ្ឋានអ៊ីមែល" : "Recovery Email"}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="profile-email"
                    type="email"
                    name="email"
                    defaultValue={bootstrap.user.email}
                    placeholder="name@company.com"
                    className="ai-input h-10 rounded-xl pl-10 text-sm"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {isKhmer
                    ? "ប្រើសម្រាប់ទទួលកូដ OTP ផ្ទៀងផ្ទាត់ ២ ជាន់ និងស្តារពាក្យសម្ងាត់។"
                    : "Used for Email OTP verification codes and password recovery."}
                </p>
              </div>
            </div>
          </div>

          {/* Collapsible Mobile Password Drawer */}
          <div>
            <MobileSectionLabel>
              {isKhmer ? "ពាក្យសម្ងាត់" : "Password & Sign-In"}
            </MobileSectionLabel>
            <div className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:border-slate-800 dark:bg-obsidian-900">
              <button
                type="button"
                onClick={() => setPasswordOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/75 dark:hover:bg-obsidian-850 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                      ACCOUNT_TONE_CLASSES.amber,
                    )}
                  >
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {isKhmer ? "ផ្លាស់ប្តូរពាក្យសម្ងាត់" : "Change Password"}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {passwordsEntered
                        ? isKhmer
                          ? "កំពុងកែប្រែពាក្យសម្ងាត់ថ្មី"
                          : "Editing new password fields"
                        : isKhmer
                          ? "ប៉ះដើម្បីបង្ហាញប្រអប់កែប្រែពាក្យសម្ងាត់"
                          : "Tap to update your login password"}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                    (passwordOpen || passwordsEntered) && "rotate-180",
                  )}
                />
              </button>

              {(passwordOpen || passwordsEntered) && (
                <div className="space-y-3.5 border-t border-slate-200/75 p-4 dark:border-slate-800 sm:p-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isKhmer ? "បញ្ជាក់ពាក្យសម្ងាត់ថ្មី" : "Confirm Password"}
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

                  {(newPassword.length > 0 || confirmPassword.length > 0) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {newPassword.length > 0 && newPassword.length < 6 && (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {isKhmer
                            ? "ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។"
                            : "Must be at least 6 characters."}
                        </span>
                      )}
                      {confirmPassword.length > 0 && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            passwordsMatch
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {passwordsMatch
                            ? isKhmer
                              ? "ពាក្យសម្ងាត់ត្រូវគ្នា"
                              : "Passwords match"
                            : isKhmer
                              ? "ពាក្យសម្ងាត់មិនត្រូវគ្នា"
                              : "Passwords do not match"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="ai-btn-primary h-11 w-full rounded-2xl text-sm font-bold shadow-sm"
          >
            <Save className="h-4 w-4" />
            <span>
              {selectedAvatarName
                ? isKhmer
                  ? "រក្សាទុកប្រវត្តិរូប និងរូបភាពថ្មី"
                  : "Save Profile & New Photo"
                : isKhmer
                  ? "រក្សាទុកការផ្លាស់ប្តូរ"
                  : "Save Profile Changes"}
            </span>
          </button>
        </form>

        {/* Grouped Security Controls List */}
        <div>
          <MobileSectionLabel>
            {isKhmer ? "ការការពារសុវត្ថិភាព" : "Security Controls"}
          </MobileSectionLabel>
          <div className="divide-y divide-slate-200/75 overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-obsidian-900">
            {/* Two-Factor Switch Row */}
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
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
                    {isKhmer ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់ (2FA)" : "Two-Factor Verification"}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {twoFactor
                      ? isKhmer
                        ? "កំពុងការពារតាម Email OTP"
                        : "Protected via Email OTP"
                      : isKhmer
                        ? "បើកដើម្បីស្នើ OTP ពេលចូលគណនី"
                        : "Email OTP check on new logins"}
                  </p>
                </div>
              </div>
              <AccountSwitch
                checked={twoFactor}
                busy={toggling2fa}
                label={isKhmer ? "បិទឬបើក 2FA" : "Toggle Two-Factor Verification"}
                onClick={handleToggle2fa}
              />
            </div>

            {/* Active Sessions Row */}
            <a
              href={d.loginActivityUrl}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50/75 dark:hover:bg-obsidian-850 sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                    ACCOUNT_TONE_CLASSES.blue,
                  )}
                >
                  <MonitorSmartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {isKhmer ? "ឧបករណ៍ និងសម័យចូល" : "Devices & Active Sessions"}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {isKhmer
                      ? "ពិនិត្យ ឬបញ្ឈប់ឧបករណ៍ដែលកំពុងចូលប្រើ"
                      : "Inspect active logins or sign out devices"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </a>

            {/* Preferences Row */}
            <a
              href={d.settingsUrl}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50/75 dark:hover:bg-obsidian-850 sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                    ACCOUNT_TONE_CLASSES.slate,
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {isKhmer ? "រចនាប័ទ្ម និងភាសា" : "Appearance & Language"}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {isKhmer ? "ប្តូរពន្លឺ ងងឹត និងភាសាខ្មែរ/អង់គ្លេស" : "Theme mode and display language"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Passkeys & Biometrics Card */}
        <div>
          <MobileSectionLabel>
            {isKhmer ? "Passkeys និងជីវមាត្រ" : "Passkeys & Biometrics"}
          </MobileSectionLabel>
          <div className="rounded-3xl border border-slate-200/85 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-obsidian-900 sm:p-5">
            <div className="mb-3.5 flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                  ACCOUNT_TONE_CLASSES.blue,
                )}
              >
                <Fingerprint className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Face ID, Touch ID & Security Keys
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isKhmer
                    ? "ចូលប្រើលឿនដោយប្រើស្នាមម្រាមដៃ ឬស្កេនមុខ"
                    : "Sign in faster without passwords using device biometrics"}
                </p>
              </div>
            </div>

            <form onSubmit={handleRegisterPasskey} className="mb-4 flex gap-2">
              <input
                type="text"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder={isKhmer ? "ឈ្មោះឧបករណ៍ (ឧ. iPhone)" : "Device label (e.g. iPhone 15)"}
                className="ai-input h-10 rounded-xl px-3.5 text-xs"
              />
              <button
                type="submit"
                disabled={registeringPasskey}
                className="ai-btn-primary h-10 shrink-0 rounded-xl px-3.5 text-xs"
              >
                {registeringPasskey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>{isKhmer ? "បន្ថែម" : "Add"}</span>
              </button>
            </form>

            {loadingPasskeys ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200/75 py-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-500" />
                <span>{isKhmer ? "កំពុងផ្ទុក Passkeys..." : "Loading passkeys..."}</span>
              </div>
            ) : passkeys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-5 text-center dark:border-slate-700 dark:bg-obsidian-950/50">
                <Fingerprint className="mx-auto mb-1.5 h-5 w-5 text-slate-400" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isKhmer ? "មិនទាន់មាន Passkey ចុះឈ្មោះនៅឡើយទេ។" : "No passkeys enrolled yet."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/75 overflow-hidden rounded-2xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
                {passkeys.map((pk) => (
                  <li
                    key={pk.id}
                    className="flex items-center justify-between gap-3 bg-slate-50/50 px-3.5 py-2.5 text-xs dark:bg-obsidian-950/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        <Fingerprint className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          {pk.name}
                        </p>
                        {pk.created_at && (
                          <p className="text-[11px] text-slate-400">
                            {formatAccountTimestamp(pk.created_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === pk.id}
                      onClick={() => handleDeletePasskey(pk.id)}
                      className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
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
          </div>
        </div>

        {/* Sign Out Action Row */}
        <div>
          <MobileSectionLabel>{isKhmer ? "គណនី" : "Session"}</MobileSectionLabel>
          <a
            href={logoutHref}
            className="flex items-center justify-between gap-3 rounded-3xl border border-rose-200/80 bg-white px-4 py-3.5 shadow-sm transition hover:bg-rose-50/60 dark:border-rose-900/40 dark:bg-obsidian-900 dark:hover:bg-rose-950/25 sm:px-5"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                  ACCOUNT_TONE_CLASSES.rose,
                )}
              >
                <LogOut className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  {isKhmer ? "ចាកចេញពីគណនី" : "Sign Out"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isKhmer ? "បញ្ឈប់ការចូលប្រើនៅលើឧបករណ៍នេះ" : "End active session on this device"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-rose-400" />
          </a>
        </div>
      </div>

      <AvatarCropModal
        open={cropModalOpen}
        imageUrl={cropSource?.url || null}
        fileName={cropSource?.name}
        isKhmer={isKhmer}
        onCancel={handleCancelCropModal}
        onConfirm={handleApplyCrop}
      />
    </WorkspaceShell>
  );
}
