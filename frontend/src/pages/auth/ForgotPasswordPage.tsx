import React, { useEffect, useState } from "react";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import type { AppBootstrap, AuthBootstrapData } from "@/types/app";
import { AiPlatformAuthShell } from "@/components/layout/AiPlatformAuthShell";
import { OtpMatrix } from "@/components/ui/OtpMatrix";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { postJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AuthBootstrapData>;
}) {
  const { pushToast } = useToast();
  const data = bootstrap.data;
  const isKhmer = bootstrap.lang === "km";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState(data.values?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const apiUrl = data.resetPasswordApiUrl || "/auth/reset-password-api";

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      pushToast(isKhmer ? "សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ" : "Enter a valid email address.", "warning");
      return;
    }
    setBusy(true);
    try {
      const { ok, data: res } = await postJson<{ success?: boolean; message?: string; code?: string }>(
        apiUrl,
        { action: "send_code", email: cleanEmail },
        data.csrfToken,
      );
      if (ok && res.success) {
        pushToast(res.message || "OTP sent to your email.", res.code ? "warning" : "success");
        setCooldown(60);
        setStep(2);
      } else {
        pushToast(res.message || "Unable to send recovery code.", "danger");
      }
    } catch {
      pushToast("Network error while requesting recovery code.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      pushToast(isKhmer ? "សូមបញ្ចូលលេខកូដ ៦ ខ្ទង់" : "Please enter all 6 digits.", "warning");
      return;
    }
    setBusy(true);
    try {
      const { ok, data: res } = await postJson<{ success?: boolean; message?: string }>(
        apiUrl,
        { action: "verify_code", email: email.trim().toLowerCase(), code },
        data.csrfToken,
      );
      if (ok && res.success) {
        pushToast(isKhmer ? "ផ្ទៀងផ្ទាត់លេខកូដបានជោគជ័យ" : "Code verified. Set a new password.", "success");
        setStep(3);
      } else {
        pushToast(res.message || "Invalid verification code.", "danger");
      }
    } catch {
      pushToast("Network error while verifying code.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      pushToast(isKhmer ? "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ" : "Password must be at least 6 characters.", "warning");
      return;
    }
    if (password !== confirmPassword) {
      pushToast(isKhmer ? "ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ" : "Passwords do not match.", "danger");
      return;
    }
    setBusy(true);
    try {
      const { ok, data: res } = await postJson<{ success?: boolean; message?: string }>(
        apiUrl,
        {
          action: "reset_password",
          email: email.trim().toLowerCase(),
          code,
          password,
        },
        data.csrfToken,
      );
      if (ok && res.success) {
        pushToast(res.message || "Password updated. Redirecting to login...", "success");
        window.setTimeout(() => {
          window.location.href = data.loginUrl || "/auth/login";
        }, 900);
      } else {
        pushToast(res.message || "Failed to update password.", "danger");
      }
    } catch {
      pushToast("Network error while resetting password.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiPlatformAuthShell
      lang={bootstrap.lang}
      enUrl={bootstrap.urls.updateLanguageEn}
      kmUrl={bootstrap.urls.updateLanguageKm}
      homeUrl={bootstrap.urls.home}
      logoLight={bootstrap.urls.logoLight}
      logoDark={bootstrap.urls.logoDark}
      portalLabel={isKhmer ? "ស្តារគណនីឡើងវិញ" : "ACCOUNT RECOVERY"}
    >
      <div className="space-y-6">
        {/* Stepper */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, label: isKhmer ? "អ៊ីមែល" : "Email" },
            { num: 2, label: isKhmer ? "ផ្ទៀងផ្ទាត់" : "Verify" },
            { num: 3, label: isKhmer ? "កំណត់ថ្មី" : "Reset" },
          ].map((item) => {
            const done = step > item.num;
            const current = step === item.num;
            return (
              <div
                key={item.num}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all",
                  current
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200"
                    : done
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-500",
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-[11px] font-bold">
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.num}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {step === 1 && (isKhmer ? "ភ្លេចពាក្យសម្ងាត់?" : "Reset your password")}
            {step === 2 && (isKhmer ? "បញ្ចូលលេខកូដ ៦ ខ្ទង់" : "Check your email")}
            {step === 3 && (isKhmer ? "កំណត់ពាក្យសម្ងាត់ថ្មី" : "Choose a new password")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {step === 1 &&
              (isKhmer
                ? "បញ្ចូលអ៊ីមែលរបស់អ្នកដើម្បីទទួលបានលេខកូដ OTP ផ្ទៀងផ្ទាត់"
                : "Enter the email associated with your account and we'll dispatch a 6-digit code.")}
            {step === 2 &&
              (isKhmer
                ? `យើងបានផ្ញើលេខកូដទៅកាន់ ${email}`
                : `Enter the 6-digit recovery code sent to ${email}`)}
            {step === 3 &&
              (isKhmer
                ? "បញ្ចូលពាក្យសម្ងាត់ថ្មីដែលមានសុវត្ថិភាព"
                : "Set a strong password you don't use elsewhere.")}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="reset-email"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                {isKhmer ? "អ៊ីមែល" : "Account Email"}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@agrisystem.ai"
                  className="ai-input pl-10"
                />
              </div>
            </div>
            <button type="submit" disabled={busy} className="ai-btn-primary w-full py-3">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              <span>{isKhmer ? "ផ្ញើលេខកូដ OTP" : "Send Verification Code"}</span>
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verifyCode} className="space-y-4">
            <OtpMatrix value={code} onChange={setCode} />
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {isKhmer ? "ប្តូរអ៊ីមែល" : "Change email"}
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={() => sendCode()}
                className="font-semibold text-indigo-600 disabled:opacity-50 dark:text-indigo-400"
              >
                {cooldown > 0
                  ? `${isKhmer ? "ផ្ញើម្តងទៀតក្នុង" : "Resend in"} ${cooldown}s`
                  : isKhmer
                    ? "ផ្ញើកូដម្តងទៀត"
                    : "Resend code"}
              </button>
            </div>
            <button type="submit" disabled={busy || code.length < 6} className="ai-btn-primary w-full py-3">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>{isKhmer ? "ផ្ទៀងផ្ទាត់កូដ" : "Verify Code"}</span>
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={resetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {isKhmer ? "ពាក្យសម្ងាត់ថ្មី" : "New Password"}
              </label>
              <PasswordInput
                autoComplete="new-password"
                required
                showStrength
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {isKhmer ? "បញ្ជាក់ពាក្យសម្ងាត់ថ្មី" : "Confirm New Password"}
              </label>
              <PasswordInput
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
            <button type="submit" disabled={busy} className="ai-btn-primary w-full py-3">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              <span>{isKhmer ? "រក្សាទុកពាក្យសម្ងាត់ថ្មី" : "Update Password"}</span>
            </button>
          </form>
        )}

        {data.loginUrl && (
          <p className="border-t border-slate-200/80 pt-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <a
              href={data.loginUrl}
              className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {isKhmer ? "ត្រឡប់ទៅទំព័រចូលប្រព័ន្ធ" : "Back to Sign In"}
            </a>
          </p>
        )}
      </div>
    </AiPlatformAuthShell>
  );
}
