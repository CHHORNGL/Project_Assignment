import React, { useEffect, useState } from "react";
import { User, Mail, ShieldCheck, ArrowRight, Loader2, Send } from "lucide-react";
import type { AppBootstrap, AuthBootstrapData } from "@/types/app";
import { AiPlatformAuthShell } from "@/components/layout/AiPlatformAuthShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { postJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

export default function AuthRegisterPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AuthBootstrapData>;
}) {
  const { pushToast } = useToast();
  const data = bootstrap.data;
  const isKhmer = bootstrap.lang === "km";

  const [fullName, setFullName] = useState(data.values?.full_name || "");
  const [email, setEmail] = useState(data.values?.email || "");
  const [verificationCode, setVerificationCode] = useState(data.values?.verification_code || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [otpNote, setOtpNote] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      pushToast(
        isKhmer ? "សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវជាមុន" : "Please enter a valid email address first.",
        "warning",
      );
      return;
    }
    if (!data.sendOtpUrl || sendingOtp || cooldown > 0) return;

    setSendingOtp(true);
    try {
      const { ok, data: res } = await postJson<{ success?: boolean; message?: string; code?: string }>(
        data.sendOtpUrl,
        { email: cleanEmail },
        data.csrfToken,
      );
      if (ok && res.success) {
        setCooldown(60);
        setOtpNote(res.message || "Verification code sent.");
        pushToast(res.message || "Verification code sent to your email.", res.code ? "warning" : "success");
      } else {
        pushToast(res.message || "Could not send verification code.", "danger");
      }
    } catch {
      pushToast("Network error while sending verification code.", "danger");
    } finally {
      setSendingOtp(false);
    }
  };

  const fieldError = (name: string) => data.errors?.[name]?.[0];
  const passwordMismatch = Boolean(confirmPassword && password !== confirmPassword);

  return (
    <AiPlatformAuthShell
      lang={bootstrap.lang}
      enUrl={bootstrap.urls.updateLanguageEn}
      kmUrl={bootstrap.urls.updateLanguageKm}
      homeUrl={bootstrap.urls.home}
      logoLight={bootstrap.urls.logoLight}
      logoDark={bootstrap.urls.logoDark}
      portalLabel={isKhmer ? "បង្កើតគណនីកសិករ AI" : "FARMER ONBOARDING"}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {isKhmer ? "ចុះឈ្មោះឥតគិតថ្លៃ" : "Free Starter Plan"}
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isKhmer ? "បង្កើតគណនីរបស់អ្នក" : "Create your account"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isKhmer
              ? "ចូលប្រើ AI វិភាគជំងឺដំណាំ និងការពិគ្រោះជាមួយអ្នកជំនាញ"
              : "Start diagnosing crop symptoms and consulting agronomists in seconds."}
          </p>
        </div>

        <form
          method="POST"
          action={data.submitUrl}
          className="space-y-3.5"
          onSubmit={(e) => {
            if (passwordMismatch) {
              e.preventDefault();
              pushToast(isKhmer ? "ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ" : "Passwords do not match.", "danger");
              return;
            }
            setSubmitting(true);
          }}
        >
          <input type="hidden" name="csrf_token" value={data.csrfToken} />

          <div className="space-y-1">
            <label
              htmlFor="full_name"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "ឈ្មោះពេញ" : "Full Name"}
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isKhmer ? "ឧ. សុខ ចាន់" : "e.g. Sok Chan"}
                className="ai-input pl-10"
              />
            </div>
            {fieldError("full_name") && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {fieldError("full_name")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="register-email"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "អ៊ីមែល" : "Email Address"}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@agrisystem.ai"
                  className="ai-input pl-10"
                />
              </div>
              <button
                type="button"
                id="btn-send-otp"
                onClick={handleSendOtp}
                disabled={sendingOtp || cooldown > 0}
                className="ai-btn-secondary shrink-0 px-3.5 text-xs"
              >
                {sendingOtp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-indigo-500" />
                )}
                <span>
                  {cooldown > 0
                    ? `${cooldown}s`
                    : isKhmer
                      ? "ផ្ញើកូដ"
                      : "Send OTP"}
                </span>
              </button>
            </div>
            {otpNote && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{otpNote}</p>
            )}
            {fieldError("email") && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {fieldError("email")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="verification_code"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "លេខកូដផ្ទៀងផ្ទាត់ (៦ ខ្ទង់)" : "6-Digit Verification Code"}
            </label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="verification_code"
                name="verification_code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="ai-input pl-10 font-mono tracking-[0.25em]"
              />
            </div>
            {fieldError("verification_code") && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {fieldError("verification_code")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "ពាក្យសម្ងាត់" : "Password"}
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              showStrength
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isKhmer ? "យ៉ាងតិច ៦ តួអក្សរ" : "At least 6 characters"}
            />
            {fieldError("password") && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {fieldError("password")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirm_password"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "បញ្ជាក់ពាក្យសម្ងាត់" : "Confirm Password"}
            </label>
            <PasswordInput
              id="confirm_password"
              name="confirm_password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={isKhmer ? "បញ្ចូលពាក្យសម្ងាត់ម្តងទៀត" : "Repeat your password"}
            />
            {passwordMismatch && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {isKhmer ? "ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ" : "Passwords do not match."}
              </p>
            )}
            {fieldError("confirm_password") && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {fieldError("confirm_password")}
              </p>
            )}
          </div>

          <button type="submit" disabled={submitting} className="ai-btn-primary w-full py-3">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            <span>
              {submitting
                ? isKhmer
                  ? "កំពុងបង្កើតគណនី..."
                  : "Creating Account..."
                : isKhmer
                  ? "បង្កើតគណនី"
                  : "Create Account"}
            </span>
          </button>
        </form>

        {data.googleLoginUrl && (
          <>
            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="mx-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {isKhmer ? "ឬ" : "or"}
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <a href={data.googleLoginUrl} className="ai-btn-secondary w-full py-2.5">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isKhmer ? "បន្តជាមួយ Google" : "Continue with Google"}</span>
            </a>
          </>
        )}

        {data.loginUrl && (
          <p className="border-t border-slate-200/80 pt-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {isKhmer ? "មានគណនីរួចហើយមែនទេ? " : "Already have an account? "}
            <a
              href={data.loginUrl}
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              {isKhmer ? "ចូលប្រព័ន្ធ" : "Sign in"}
            </a>
          </p>
        )}
      </div>
    </AiPlatformAuthShell>
  );
}
