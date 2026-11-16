import React, { useEffect, useState } from "react";
import { ArrowRight, Loader2, Mail, Send, ShieldCheck, User } from "lucide-react";
import type { AppBootstrap, AuthBootstrapData } from "@/types/app";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BTN_CLASS,
  AUTH_SECONDARY_BTN_CLASS,
  AiPlatformAuthShell,
} from "@/components/layout/AiPlatformAuthShell";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
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
      const { ok, data: res } = await postJson<{
        success?: boolean;
        message?: string;
        code?: string;
      }>(data.sendOtpUrl, { email: cleanEmail }, data.csrfToken);
      if (ok && res.success) {
        setCooldown(60);
        setOtpNote(res.message || "Verification code sent.");
        pushToast(
          res.message || "Verification code sent to your email.",
          res.code ? "warning" : "success",
        );
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
      portalLabel={isKhmer ? "បង្កើតគណនីកសិករ" : "Farmer Onboarding"}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
            {isKhmer ? "ចុះឈ្មោះឥតគិតថ្លៃ" : "Free Starter Plan"}
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {isKhmer ? "បង្កើតគណនីរបស់អ្នក" : "Create your account"}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
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
              pushToast(
                isKhmer ? "ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ" : "Passwords do not match.",
                "danger",
              );
              return;
            }
            setSubmitting(true);
          }}
        >
          <input type="hidden" name="csrf_token" value={data.csrfToken} />

          <div className="space-y-1">
            <label
              htmlFor="full_name"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              {isKhmer ? "ឈ្មោះពេញ" : "Full name"}
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isKhmer ? "ឧ. សុខ ចាន់" : "e.g. Sok Chan"}
                className={`${AUTH_INPUT_CLASS} pl-10`}
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
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              {isKhmer ? "អ៊ីមែល" : "Email address"}
            </label>
            <div className="flex flex-col gap-2 min-[380px]:flex-row">
              <div className="relative min-w-0 flex-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={`${AUTH_INPUT_CLASS} pl-10`}
                />
              </div>
              <button
                type="button"
                id="btn-send-otp"
                onClick={handleSendOtp}
                disabled={sendingOtp || cooldown > 0}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-xs font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {sendingOtp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
                )}
                <span>
                  {cooldown > 0 ? `${cooldown}s` : isKhmer ? "ផ្ញើកូដ" : "Send OTP"}
                </span>
              </button>
            </div>
            {otpNote && (
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{otpNote}</p>
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
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              {isKhmer ? "លេខកូដផ្ទៀងផ្ទាត់ (៦ ខ្ទង់)" : "6-digit verification code"}
            </label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
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
                className={`${AUTH_INPUT_CLASS} pl-10 font-mono tracking-[0.25em]`}
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
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
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
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              {isKhmer ? "បញ្ជាក់ពាក្យសម្ងាត់" : "Confirm password"}
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

          <button type="submit" disabled={submitting} className={AUTH_PRIMARY_BTN_CLASS}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            <span>
              {submitting
                ? isKhmer
                  ? "កំពុងបង្កើតគណនី..."
                  : "Creating account..."
                : isKhmer
                  ? "បង្កើតគណនី"
                  : "Create account"}
            </span>
          </button>
        </form>

        {data.googleLoginUrl && (
          <>
            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
              <span className="mx-3 shrink-0 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {isKhmer ? "ឬ" : "or"}
              </span>
              <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
            </div>

            <a href={data.googleLoginUrl} className={AUTH_SECONDARY_BTN_CLASS}>
              <GoogleIcon />
              <span>{isKhmer ? "បន្តជាមួយ Google" : "Continue with Google"}</span>
            </a>
          </>
        )}

        {data.loginUrl && (
          <p className="border-t border-neutral-200 pt-3.5 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {isKhmer ? "មានគណនីរួចហើយមែនទេ? " : "Already have an account? "}
            <a
              href={data.loginUrl}
              className="font-semibold text-neutral-900 underline underline-offset-4 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
            >
              {isKhmer ? "ចូលប្រព័ន្ធ" : "Sign in"}
            </a>
          </p>
        )}
      </div>
    </AiPlatformAuthShell>
  );
}
