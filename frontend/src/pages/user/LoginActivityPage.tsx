import React, { useState } from "react";
import { Laptop, Loader2, LogOut, MonitorSmartphone, RefreshCw, ShieldAlert, Smartphone } from "lucide-react";
import type { AppBootstrap, LoginActivityEntry } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import { postJson, requestJson } from "@/lib/api";

interface LoginActivityData {
  activities: LoginActivityEntry[];
  dataUrl: string;
  revokeUrl: string;
  revokeOthersUrl: string;
  settingsUrl: string;
  loginUrl: string;
}

export default function LoginActivityPage({ bootstrap }: { bootstrap: AppBootstrap<LoginActivityData> }) {
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
      const res = await requestJson<{ ok?: boolean; activities?: LoginActivityEntry[] }>(d.dataUrl, "GET");
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
      const res = await postJson<{ ok?: boolean; logged_out_self?: boolean; message?: string; error?: string }>(
        d.revokeUrl,
        { activity_id: activityId },
        bootstrap.csrfToken,
      );
      if (res.ok && res.data.ok) {
        if (res.data.logged_out_self) {
          window.location.href = d.loginUrl;
          return;
        }
        pushToast("success", res.data.message || (isKhmer ? "បានបញ្ឈប់សម័យឧបករណ៍។" : "Device signed out."));
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

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <button type="button" onClick={reload} disabled={refreshing} className="ai-btn-secondary h-9 px-3 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {isKhmer ? "ផ្ទុកឡើងវិញ" : "Refresh"}
        </button>
      }
    >
      <div className="login-activity-container space-y-5">
        <div className="ai-surface flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold">
                {isKhmer ? "ឧបករណ៍កំពុងតភ្ជាប់" : "Active Sessions Overview"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isKhmer
                  ? "បើអ្នកសង្ស័យថាមានឧបករណ៍មិនស្គាល់ សូមចុចចាកចេញឧបករណ៍ផ្សេងទាំងអស់។"
                  : "Sign out any device you do not recognize immediately."}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={revokingOthers}
            onClick={handleRevokeOthers}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
          >
            {revokingOthers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            {isKhmer ? "ចាកចេញពីឧបករណ៍ផ្សេងទាំងអស់" : "Sign Out Other Devices"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {activities.map((act) => {
            const isMobile = (act.device_type || "").toLowerCase().includes("mobile");
            const DeviceIcon = isMobile ? Smartphone : act.device_type ? Laptop : MonitorSmartphone;
            return (
              <div key={act.activity_id} className="login-activity-card ai-surface flex flex-col justify-between p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <DeviceIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-sm font-bold">
                          {act.browser || "Unknown Browser"} · {act.os || "Unknown OS"}
                        </h3>
                        {act.is_current && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                            {isKhmer ? "ឧបករណ៍នេះ" : "This Device"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        IP: <span className="font-mono">{act.ip_address || "-"}</span> · Route:{" "}
                        <span className="font-mono">{act.login_route || "-"}</span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">ID: {act.activity_id}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 text-xs dark:border-slate-800/70">
                  <span className="text-slate-400">
                    {act.revoked_at
                      ? isKhmer
                        ? "បានបញ្ឈប់"
                        : "Revoked"
                      : act.last_seen_at || act.created_at || "Active"}
                  </span>
                  {!act.revoked_at && (
                    <button
                      type="button"
                      disabled={busyId === act.activity_id}
                      onClick={() => handleRevoke(act.activity_id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-300"
                    >
                      {busyId === act.activity_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" />
                      )}
                      {isKhmer ? "បញ្ឈប់សម័យ" : "Revoke"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WorkspaceShell>
  );
}
