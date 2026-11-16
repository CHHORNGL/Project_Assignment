import { useState } from "react";
import { AlertTriangle, Ban, Home, ArrowLeft, RotateCw, Copy, Check } from "lucide-react";
import type { AppBootstrap, ErrorBootstrapData } from "@/types/app";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function ErrorPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<ErrorBootstrapData>;
}) {
  const data = bootstrap.data;
  const isKhmer = bootstrap.lang === "km";
  const [copied, setCopied] = useState(false);

  const is404 = data.errorCode === 404;
  const is405 = data.errorCode === 405;

  const badgeGradient = is404
    ? "from-indigo-500 to-blue-500"
    : is405
      ? "from-amber-500 to-orange-500"
      : "from-rose-500 to-pink-600";

  const copyRequestId = async () => {
    try {
      await navigator.clipboard.writeText(data.requestId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted frames.
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 p-4 text-slate-900 dark:bg-obsidian-950 dark:text-slate-100 sm:p-6">
      <div className="pointer-events-none fixed inset-0 ai-grid-pattern opacity-80" aria-hidden="true" />
      <div className="fixed right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <div className="ai-surface relative z-10 w-full max-w-4xl overflow-hidden p-6 sm:p-10 animate-fade-in-up">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-5 lg:col-span-7">
            <div className="inline-flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${badgeGradient} text-white shadow-lg`}
              >
                {is405 ? <Ban className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <span className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                {data.errorCode}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {data.errorTitle}
              </h1>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
                {data.errorMessage}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <a href={data.homeUrl || "/"} className="ai-btn-primary">
                <Home className="h-4 w-4" />
                <span>{isKhmer ? "ទៅកាន់ផ្ទាំងដើម" : "Go to Dashboard"}</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  if (data.referrer) {
                    window.location.href = data.referrer;
                  } else if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = data.homeUrl || "/";
                  }
                }}
                className="ai-btn-secondary"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{isKhmer ? "ត្រឡប់ក្រោយ" : "Go Back"}</span>
              </button>
              {!is404 && !is405 && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="ai-btn-secondary"
                >
                  <RotateCw className="h-4 w-4" />
                  <span>{isKhmer ? "សាកល្បងម្តងទៀត" : "Retry"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-100/80 p-5 dark:border-slate-800 dark:bg-obsidian-950/90 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Request Telemetry
              </span>
              <button
                type="button"
                onClick={copyRequestId}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied" : "Copy ID"}</span>
              </button>
            </div>

            <dl className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Path</dt>
                <dd className="truncate font-mono font-medium text-slate-800 dark:text-slate-200">
                  {data.requestPath}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Method</dt>
                <dd className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  {data.requestMethod}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">User</dt>
                <dd className="truncate font-medium text-slate-800 dark:text-slate-200">
                  {data.userLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Request ID</dt>
                <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {data.requestId}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Time (UTC)</dt>
                <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {data.timestamp}
                </dd>
              </div>
            </dl>

            {Array.isArray(data.validMethods) && data.validMethods.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Allowed Methods
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.validMethods.map((method) => (
                    <span
                      key={method}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-obsidian-900 dark:text-slate-300"
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
