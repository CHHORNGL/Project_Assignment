import React, { useState } from "react";
import { KeyRound, Loader2, ArrowLeft } from "lucide-react";
import type { AppBootstrap, AuthBootstrapData } from "@/types/app";
import { AiPlatformAuthShell } from "@/components/layout/AiPlatformAuthShell";
import { OtpMatrix } from "@/components/ui/OtpMatrix";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/context/ToastContext";

export default function ResetPasswordPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AuthBootstrapData>;
}) {
  const { pushToast } = useToast();
  const data = bootstrap.data;
  const isKhmer = bootstrap.lang === "km";

  const [code, setCode] = useState(data.values?.code || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <AiPlatformAuthShell
      lang={bootstrap.lang}
      enUrl={bootstrap.urls.updateLanguageEn}
      kmUrl={bootstrap.urls.updateLanguageKm}
      homeUrl={bootstrap.urls.home}
      logoLight={bootstrap.urls.logoLight}
      logoDark={bootstrap.urls.logoDark}
      portalLabel={isKhmer ? "កំណត់ពាក្យសម្ងាត់ថ្មី" : "PASSWORD RESET"}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isKhmer ? "បង្កើតពាក្យសម្ងាត់ថ្មី" : "Set your new password"}
          </h2>
          {data.email && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isKhmer ? "សម្រាប់គណនី៖ " : "Resetting account: "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{data.email}</span>
            </p>
          )}
        </div>

        <form
          method="POST"
          action={data.submitUrl}
          className="space-y-4"
          onSubmit={(e) => {
            if (password !== confirmPassword) {
              e.preventDefault();
              pushToast(isKhmer ? "ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ" : "Passwords do not match.", "danger");
              return;
            }
            setSubmitting(true);
          }}
        >
          <input type="hidden" name="csrf_token" value={data.csrfToken} />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {isKhmer ? "លេខកូដ OTP ៦ ខ្ទង់" : "6-Digit OTP Code"}
            </label>
            <OtpMatrix value={code} onChange={setCode} name="code" />
            {data.errors?.code?.[0] && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {data.errors.code[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="reset-password"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "ពាក្យសម្ងាត់ថ្មី" : "New Password"}
            </label>
            <PasswordInput
              id="reset-password"
              name="password"
              autoComplete="new-password"
              required
              showStrength
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="reset-confirm-password"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {isKhmer ? "បញ្ជាក់ពាក្យសម្ងាត់" : "Confirm Password"}
            </label>
            <PasswordInput
              id="reset-confirm-password"
              name="confirm_password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
            />
          </div>

          <button type="submit" disabled={submitting || code.length < 6} className="ai-btn-primary w-full py-3">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            <span>{isKhmer ? "កំណត់ពាក្យសម្ងាត់ថ្មី" : "Reset Password"}</span>
          </button>
        </form>

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
