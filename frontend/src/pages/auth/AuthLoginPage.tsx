import React, { useState } from "react";
import { ArrowRight, Fingerprint, Loader2, Mail, ShieldAlert } from "lucide-react";
import type { AppBootstrap, AuthBootstrapData } from "@/types/app";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BTN_CLASS,
  AUTH_SECONDARY_BTN_CLASS,
  AiPlatformAuthShell,
} from "@/components/layout/AiPlatformAuthShell";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { performPasskeyLogin } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

export default function AuthLoginPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AuthBootstrapData>;
}) {
  const { pushToast } = useToast();
  const data = bootstrap.data;
  const isStaff = data.mode === "staff-login";
  const isKhmer = bootstrap.lang === "km";

  const [email, setEmail] = useState(data.values?.email || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const emailErrors = data.errors?.email || [];
  const passwordErrors = data.errors?.password || [];

  const handlePasskey = async () => {
    if (!data.passkeyOptionsUrl || !data.passkeyVerifyUrl || passkeyBusy) return;
    setPasskeyBusy(true);
    try {
      const redirectUrl = await performPasskeyLogin({
        optionsUrl: data.passkeyOptionsUrl,
        verifyUrl: data.passkeyVerifyUrl,
        fallbackRedirect: data.homeUrl || "/",
        csrfToken: data.csrfToken,
      });
      window.location.href = redirectUrl;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) {
        const message = error instanceof Error ? error.message : "Passkey login failed.";
        pushToast(message, "danger");
      }
      setPasskeyBusy(false);
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
      portalLabel={
        isStaff
          ? isKhmer
            ? "ច្រកអ្នកជំនាញ និងអ្នកគ្រប់គ្រង"
            : "Expert & Admin Portal"
          : isKhmer
            ? "គណនីកសិករ AI"
            : "Farmer Workspace"
      }
    >
      <div className="space-y-6">
        {/* Card Header */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            <span
              className={
                isStaff
                  ? "h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white"
                  : "h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
              }
            />
            {isStaff
              ? isKhmer
                ? "ច្រកសុវត្ថិភាពបុគ្គលិក"
                : "Staff Security Access"
              : isKhmer
                ? "គណនីកសិករ"
                : "Farmer Sign In"}
          </span>

          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {isStaff
              ? isKhmer
                ? "ចូលប្រព័ន្ធអ្នកគ្រប់គ្រង និងអ្នកជំនាញ"
                : "Sign in to Command Portal"
              : isKhmer
                ? "សូមស្វាគមន៍ការត្រឡប់មកវិញ"
                : "Welcome back"}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {isStaff
              ? isKhmer
                ? "ផ្ទៀងផ្ទាត់អត្តសញ្ញាណដើម្បីចូលទៅកាន់ផ្ទាំងពិនិត្យ និងការគ្រប់គ្រង"
                : "Authenticate to access review queues, diagnostics rules, and telemetry."
              : isKhmer
                ? "បញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់ដើម្បីចូលប្រើប្រាស់ប្រព័ន្ធកសិកម្ម"
                : "Enter your credentials to access your crop diagnostics workspace."}
          </p>
        </div>

        {/* Credentials Form */}
        <form
          method="POST"
          action={data.submitUrl}
          className="space-y-4"
          onSubmit={() => setSubmitting(true)}
        >
          <input type="hidden" name="csrf_token" value={data.csrfToken} />

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              {isKhmer ? "អ៊ីមែល" : "Email address"}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
              <input
                id="email"
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
            {emailErrors.map((err) => (
              <p key={err} className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {err}
              </p>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                {isKhmer ? "ពាក្យសម្ងាត់" : "Password"}
              </label>
              {data.forgotPasswordUrl && (
                <a
                  href={data.forgotPasswordUrl}
                  className="text-xs font-medium text-neutral-600 underline underline-offset-4 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                >
                  {isKhmer ? "ភ្លេចពាក្យសម្ងាត់?" : "Forgot password?"}
                </a>
              )}
            </div>
            <PasswordInput
              id="login-password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isKhmer ? "បញ្ចូលពាក្យសម្ងាត់របស់អ្នក" : "Enter your password"}
            />
            {passwordErrors.map((err) => (
              <p key={err} className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {err}
              </p>
            ))}
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
                  ? "កំពុងផ្ទៀងផ្ទាត់..."
                  : "Signing in..."
                : isKhmer
                  ? "ចូលប្រព័ន្ធ"
                  : "Sign in"}
            </span>
          </button>
        </form>

        {/* Divider + Alternate Sign-In */}
        {((!isStaff && data.googleLoginUrl) ||
          (data.passkeyOptionsUrl && data.passkeyVerifyUrl)) && (
          <>
            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
              <span className="mx-3 shrink-0 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {isKhmer ? "ឬបន្តជាមួយ" : "or continue with"}
              </span>
              <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
            </div>

            <div className="grid gap-2.5">
              {!isStaff && data.googleLoginUrl && (
                <a href={data.googleLoginUrl} className={AUTH_SECONDARY_BTN_CLASS}>
                  <GoogleIcon />
                  <span>{isKhmer ? "បន្តជាមួយ Google" : "Continue with Google"}</span>
                </a>
              )}

              {data.passkeyOptionsUrl && data.passkeyVerifyUrl && (
                <button
                  type="button"
                  id={isStaff ? "btn-staff-login-passkey" : "btn-login-passkey"}
                  onClick={handlePasskey}
                  disabled={passkeyBusy}
                  className={AUTH_SECONDARY_BTN_CLASS}
                >
                  {passkeyBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Fingerprint className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                  )}
                  <span>
                    {passkeyBusy
                      ? isKhmer
                        ? "កំពុងរង់ចាំ Passkey..."
                        : "Waiting for Passkey..."
                      : isKhmer
                        ? "ចូលដោយប្រើ Passkey"
                        : "Sign in with Passkey"}
                  </span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Footer links */}
        {isStaff ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {isKhmer
                ? "ការចូលប្រើទាំងអស់ត្រូវបានកត់ត្រាសម្រាប់សុវត្ថិភាពប្រព័ន្ធ។"
                : "All privileged sign-in events are logged to the security audit trail."}
            </span>
          </div>
        ) : (
          <p className="border-t border-neutral-200 pt-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {isKhmer ? "មិនទាន់មានគណនីមែនទេ? " : "Don't have an account? "}
            {data.registerUrl && (
              <a
                href={data.registerUrl}
                className="font-semibold text-neutral-900 underline underline-offset-4 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
              >
                {isKhmer ? "បង្កើតគណនីឥឡូវនេះ" : "Create an account"}
              </a>
            )}
          </p>
        )}
      </div>
    </AiPlatformAuthShell>
  );
}
