import React, { useState } from "react";
import { Mail, Fingerprint, ArrowRight, ShieldAlert, Loader2, ArrowLeftRight } from "lucide-react";
import type { AppBootstrap, AuthBootstrapData } from "@/types/app";
import { AiPlatformAuthShell } from "@/components/layout/AiPlatformAuthShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { performPasskeyLogin } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

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
            : "EXPERT & ADMIN COMMAND"
          : isKhmer
            ? "វេទិកាកសិកម្មឆ្លាតវៃ"
            : "FARMER AI WORKSPACE"
      }
    >
      <div className="space-y-6">
        {/* Card header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-700/80 dark:bg-obsidian-850 dark:text-slate-300">
            <span
              className={
                isStaff
                  ? "h-1.5 w-1.5 rounded-full bg-indigo-500"
                  : "h-1.5 w-1.5 rounded-full bg-emerald-500"
              }
            />
            {isStaff
              ? isKhmer
                ? "សម្រាប់អ្នកជំនាញ និង Admin"
                : "Staff Security Portal"
              : isKhmer
                ? "គណនីកសិករ"
                : "Farmer Access"}
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isStaff
              ? isKhmer
                ? "ចូលប្រព័ន្ធអ្នកគ្រប់គ្រង និងអ្នកជំនាញ"
                : "Sign in to Command Center"
              : isKhmer
                ? "សូមស្វាគមន៍ការត្រឡប់មកវិញ"
                : "Welcome back"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isStaff
              ? isKhmer
                ? "ផ្ទៀងផ្ទាត់អត្តសញ្ញាណដើម្បីចូលទៅកាន់ផ្ទាំងពិនិត្យ និង AI"
                : "Authenticate to access diagnostics review queues, knowledge rules, and telemetry."
              : isKhmer
                ? "បញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់ដើម្បីបន្តប្រើប្រាស់ AI វិភាគដំណាំ"
                : "Enter your credentials to access your crop diagnostics workspace."}
          </p>
        </div>

        {/* Form */}
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
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "អ៊ីមែល" : "Email Address"}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                id="email"
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
                className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                {isKhmer ? "ពាក្យសម្ងាត់" : "Password"}
              </label>
              {data.forgotPasswordUrl && (
                <a
                  href={data.forgotPasswordUrl}
                  className="text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
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

          <button type="submit" disabled={submitting} className="ai-btn-primary w-full py-3">
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

        {/* Divider */}
        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="mx-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {isKhmer ? "ឬបន្តជាមួយ" : "or continue with"}
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        {/* Social & Passkey */}
        <div className="grid gap-2.5">
          {!isStaff && data.googleLoginUrl && (
            <a href={data.googleLoginUrl} className="ai-btn-secondary w-full py-2.5">
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
              className="ai-btn-secondary w-full py-2.5"
            >
              {passkeyBusy ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              ) : (
                <Fingerprint className="h-4 w-4 text-emerald-500" />
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

        {/* Footer links */}
        {isStaff ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                {isKhmer
                  ? "ការចូលប្រើទាំងអស់ត្រូវបានកត់ត្រាសម្រាប់សុវត្ថិភាពប្រព័ន្ធ។"
                  : "All privileged sign-in events are cryptographically logged to the security audit trail."}
              </span>
            </div>
            {data.loginUrl && (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                <a
                  href={data.loginUrl}
                  className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  {isKhmer ? "ត្រឡប់ទៅកាន់ទំព័រកសិករ" : "Switch to Farmer Sign In"}
                </a>
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <div>
              {isKhmer ? "មិនទាន់មានគណនីមែនទេ? " : "Don't have an account? "}
              {data.registerUrl && (
                <a
                  href={data.registerUrl}
                  className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {isKhmer ? "បង្កើតគណនីឥឡូវនេះ" : "Create an account"}
                </a>
              )}
            </div>
            {data.staffLoginUrl && (
              <a
                href={data.staffLoginUrl}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ArrowLeftRight className="h-3 w-3" />
                {isKhmer ? "ចូលប្រព័ន្ធសម្រាប់អ្នកជំនាញ / Admin" : "Expert & Admin Portal"}
              </a>
            )}
          </div>
        )}
      </div>
    </AiPlatformAuthShell>
  );
}
