import React, { useState } from "react";
import {
  Laptop,
  Loader2,
  LogOut,
  MapPin,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import type { AppBootstrap, LoginActivityEntry } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AccountHeaderTabs, formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import { ACCOUNT_TONE_CLASSES, MobileSectionLabel } from "@/components/user/AccountPrimitives";
import { buildNavSections } from "@/lib/navigation";
import { LoginActivitySkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import { postJson, requestJson } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LoginActivityData {
  activities: LoginActivityEntry[];
  dataUrl: string;
  revokeUrl: string;
  revokeOthersUrl: string;
  settingsUrl: string;
  loginUrl: string;
}

function formatLoginMethod(route: string | undefined, isKhmer: boolean): string {
  const clean = (route || "").toLowerCase();
  if (clean.includes("google")) return isKhmer ? "ចូលតាម Google" : "Google Sign-In";
  if (clean.includes("passkey")) return "Passkey";
  if (clean.includes("telegram")) return isKhmer ? "ចូលតាម Telegram" : "Telegram Sign-In";
  if (clean.includes("verify")) return isKhmer ? "ផ្ទៀងផ្ទាត់ OTP" : "Email OTP";
  if (clean.includes("staff/login")) return isKhmer ? "គណនីបុគ្គលិក" : "Staff Sign-In";
  if (clean.includes("api/login")) return isKhmer ? "កម្មវិធីទូរស័ព្ទ" : "Mobile App";
  if (clean.includes("login")) return isKhmer ? "អ៊ីមែល និងពាក្យសម្ងាត់" : "Email & Password";
  return isKhmer ? "សម័យគេហទំព័រ" : "Web Session";
}

export default function LoginActivityPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<LoginActivityData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [activities, setActivities] = useState<LoginActivityEntry[]>(d.activities || []);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const reload = async () => {
    setRefreshing(true);
    try {
      const res = await requestJson<{ ok?: boolean; activities?: LoginActivityEntry[] }>(
        d.dataUrl,
        "GET",
      );
      if (res.ok && Array.isArray(res.data.activities)) {
        setActivities(res.data.activities);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleRevoke = async (activityId: string) => {
    setBusyId(activityId);
    try {
      const res = await postJson<{
        ok?: boolean;
        logged_out_self?: boolean;
        message?: string;
        error?: string;
      }>(d.revokeUrl, { activity_id: activityId }, bootstrap.csrfToken);
      if (res.ok && res.data.ok) {
        if (res.data.logged_out_self) {
          window.location.href = d.loginUrl;
          return;
        }
        pushToast(
          "success",
          res.data.message || (isKhmer ? "បានបញ្ឈប់សម័យឧបករណ៍។" : "Device signed out."),
        );
        await reload();
      } else {
        pushToast("danger", res.data.error || "Could not revoke session.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const res = await postJson<{ ok?: boolean; count?: number; message?: string }>(
        d.revokeOthersUrl,
        {},
        bootstrap.csrfToken,
      );
      if (res.ok && res.data.ok) {
        pushToast("success", res.data.message || "All other devices signed out.");
        await reload();
      } else {
        pushToast("danger", "Failed to sign out other devices.");
      }
    } finally {
      setRevokingOthers(false);
    }
  };

  const activeCount = activities.filter((a) => !a.revoked_at && !a.revoked).length;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <button
          type="button"
          onClick={reload}
          disabled={refreshing}
          className="ai-btn-secondary h-9 px-3 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>{isKhmer ? "ផ្ទុកឡើងវិញ" : "Refresh"}</span>
        </button>
      }
    >
      <AccountHeaderTabs
        active="activity"
        lang={bootstrap.lang}
        profileUrl={bootstrap.urls.profile || "/users/profile"}
        settingsUrl={d.settingsUrl}
        loginActivityUrl={bootstrap.urls.loginActivity || "/users/login-activity"}
      />

      <div className="login-activity-container mx-auto w-full max-w-2xl space-y-5 pb-4">
        {/* Mobile Platform Security Alert Banner */}
        <div className="rounded-3xl border border-slate-200/85 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-obsidian-900 sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                  ACCOUNT_TONE_CLASSES.amber,
                )}
              >
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {isKhmer ? "ឧបករណ៍កំពុងតភ្ជាប់" : "Active Sessions Overview"}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {isKhmer
                    ? "បើអ្នកសង្ស័យថាមានឧបករណ៍មិនស្គាល់ សូមចុចចាកចេញឧបករណ៍ផ្សេងទាំងអស់។"
                    : "Review signed-in devices and immediately sign out any unrecognized session."}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={revokingOthers}
              onClick={handleRevokeOthers}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
            >
              {revokingOthers ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span>{isKhmer ? "ចាកចេញពីឧបករណ៍ផ្សេង" : "Sign Out Other Devices"}</span>
            </button>
          </div>
        </div>

        {/* Grouped Devices List */}
        <div>
          <MobileSectionLabel
            right={
              <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                {activeCount} {isKhmer ? "សកម្ម" : "active"}
              </span>
            }
          >
            {isKhmer ? "បញ្ជីឧបករណ៍" : "Signed-In Devices"}
          </MobileSectionLabel>

          {refreshing ? (
            <LoginActivitySkeleton
              count={Math.max(2, Math.min(activities.length || 3, 4))}
              label={isKhmer ? "កំពុងផ្ទុកបញ្ជីឧបករណ៍..." : "Refreshing signed-in devices..."}
            />
          ) : activities.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-obsidian-900 dark:text-slate-400">
              {isKhmer ? "មិនទាន់មានទិន្នន័យសម័យចូលទេ។" : "No login activity recorded yet."}
            </div>
          ) : (
            <div className="divide-y divide-slate-200/75 overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-obsidian-900">
              {activities.map((act) => {
                const isMobile = (act.device_type || "").toLowerCase().includes("mobile");
                const DeviceIcon = isMobile
                  ? Smartphone
                  : act.device_type
                    ? Laptop
                    : MonitorSmartphone;
                const isCurrent = Boolean(act.is_current ?? act.current);
                const isRevoked = Boolean(act.revoked_at || act.revoked);
                const deviceName = act.device_name || act.device_type || "Unknown Device";
                const osName = act.os || act.platform || "Unknown OS";
                const routeLabel = formatLoginMethod(act.login_route || act.route, isKhmer);
                const locationLabel =
                  act.location || (isKhmer ? "មិនស្គាល់ទីតាំង" : "Unknown Location");
                const timeLabel = isRevoked
                  ? isKhmer
                    ? "បានបញ្ឈប់"
                    : "Revoked"
                  : formatAccountTimestamp(act.last_seen_at || act.created_at);

                return (
                  <div
                    key={act.activity_id}
                    className="login-activity-card flex flex-col justify-between gap-3 p-4 transition hover:bg-slate-50/70 dark:hover:bg-obsidian-850 sm:flex-row sm:items-center sm:p-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                          isCurrent
                            ? ACCOUNT_TONE_CLASSES.emerald
                            : isRevoked
                              ? ACCOUNT_TONE_CLASSES.slate
                              : ACCOUNT_TONE_CLASSES.blue,
                        )}
                      >
                        <DeviceIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-display text-sm font-bold text-slate-900 dark:text-white">
                            {deviceName}
                          </h3>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {isKhmer ? "ឧបករណ៍នេះ" : "This Device"}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {act.browser || "Unknown Browser"} · {osName}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                            <span>{locationLabel}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {routeLabel}
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {timeLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2">
                      {!isRevoked ? (
                        <button
                          type="button"
                          disabled={busyId === act.activity_id}
                          onClick={() => handleRevoke(act.activity_id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-60 dark:text-rose-300"
                        >
                          {busyId === act.activity_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LogOut className="h-3.5 w-3.5" />
                          )}
                          <span>{isKhmer ? "បញ្ឈប់" : "Revoke"}</span>
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-obsidian-800 dark:text-slate-400">
                          {isKhmer ? "បានបិទ" : "Signed out"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
