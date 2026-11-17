import { Check } from "lucide-react";

export interface StepItem {
  id: string;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  title: string;
  stepProgressText: string;
  hint: string;
  onStepSelect?: (stepNumber: number) => void;
}

function stepState(stepNumber: number, currentStep: number): "complete" | "current" | "upcoming" {
  if (stepNumber < currentStep) return "complete";
  if (stepNumber === currentStep) return "current";
  return "upcoming";
}

export default function Stepper({
  steps,
  currentStep,
  title,
  stepProgressText,
  hint,
  onStepSelect,
}: StepperProps) {
  const progressPct = steps.length > 0 ? Math.round((currentStep / steps.length) * 100) : 0;

  return (
    <div className="diag-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/75 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-obsidian-950/60 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
            {title}
          </span>
          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {stepProgressText}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</span>
      </div>

      {/* Continuous progress bar */}
      <div className="h-1 w-full bg-slate-100 dark:bg-obsidian-950">
        <div
          className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-2.5 sm:px-6 sm:py-4">
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 lg:grid-cols-4">
          {steps.map((step, index) => {
            const number = index + 1;
            const state = stepState(number, currentStep);
            const complete = state === "complete";
            const current = state === "current";
            const clickable = complete && typeof onStepSelect === "function";

            return (
              <button
                key={step.id}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable) onStepSelect(number);
                }}
                aria-current={current ? "step" : undefined}
                className={[
                  "flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-150 disabled:cursor-default disabled:opacity-100 sm:gap-3 sm:px-3.5 sm:py-2.5",
                  current
                    ? "border-indigo-500 bg-indigo-50/80 ring-1 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-500/15"
                    : complete
                      ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                      : "border-slate-200/80 bg-white/70 opacity-75 dark:border-slate-800/80 dark:bg-obsidian-950/40",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-colors sm:h-8 sm:w-8 sm:text-xs",
                    complete
                      ? "bg-emerald-600 text-white"
                      : current
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-500 dark:bg-obsidian-800 dark:text-slate-400",
                  ].join(" ")}
                >
                  {complete ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" /> : number}
                </span>
                <div className="min-w-0">
                  <p
                    className={[
                      "truncate text-[11.5px] font-bold sm:text-xs",
                      current
                        ? "text-indigo-700 dark:text-indigo-200"
                        : complete
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-slate-600 dark:text-slate-300",
                    ].join(" ")}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="mt-0.5 hidden truncate text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
