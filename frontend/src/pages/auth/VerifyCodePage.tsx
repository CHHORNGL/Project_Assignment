import React, { useState } from "react";
import { ShieldCheck, RefreshCw, LogOut, Loader2 } from "lucide-react";
import type { AppBootstrap, AuthBootstrapData } from "@/types/app";
import { AiPlatformAuthShell } from "@/components/layout/AiPlatformAuthShell";
import { OtpMatrix } from "@/components/ui/OtpMatrix";

export default function VerifyCodePage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AuthBootstrapData>;
}) {
  const data = bootstrap.data;
  const isKhmer = bootstrap.lang === "km";
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = data.purpose === "register";

  return (
    <AiPlatformAuthShell
      lang={bootstrap.lang}
      enUrl={bootstrap.urls.updateLanguageEn}
      kmUrl={bootstrap.urls.updateLanguageKm}
      homeUrl={bootstrap.urls.home}
      logoLight={bootstrap.urls.logoLight}
      logoDark={bootstrap.urls.logoDark}
      portalLabel={isKhmer ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់" : "TWO-STEP VERIFICATION"}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isRegister
              ? isKhmer
                ? "ផ្ទៀងផ្ទាត់អ៊ីមែលរបស់អ្នក"
                : "Verify your email"
              : isKhmer
                ? "ការផ្ទៀងផ្ទាត់ ២ ជាន់"
                : "Two-step security check"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isKhmer ? "បញ្ចូលលេខកូដ ៦ ខ្ទង់ដែលបានផ្ញើទៅកាន់ " : "Enter the 6-digit verification code sent to "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{data.email}</span>
          </p>
        </div>

        <form
          method="POST"
          action={data.submitUrl}
          className="space-y-4"
          onSubmit={() => setSubmitting(true)}
        >
          <input type="hidden" name="csrf_token" value={data.csrfToken} />
          <OtpMatrix value={code} onChange={setCode} name="code" />

          <button
            type="submit"
            disabled={submitting || code.length < 6}
            className="ai-btn-primary w-full py-3"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <span>
              {submitting
                ? isKhmer
                  ? "កំពុងផ្ទៀងផ្ទាត់..."
                  : "Verifying..."
                : isKhmer
                  ? "ផ្ទៀងផ្ទាត់ និងបន្ត"
                  : "Verify & Continue"}
            </span>
          </button>
        </form>

        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 text-xs dark:border-slate-800">
          {data.resendCodeUrl && (
            <form method="POST" action={data.resendCodeUrl}>
              <input type="hidden" name="csrf_token" value={data.csrfToken} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isKhmer ? "ផ្ញើកូដម្តងទៀត" : "Resend code"}
              </button>
            </form>
          )}
          {data.logoutUrl && (
            <a
              href={data.logoutUrl}
              className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isKhmer ? "ប្រើគណនីផ្សេង" : "Use another account"}
            </a>
          )}
        </div>
      </div>
    </AiPlatformAuthShell>
  );
}
