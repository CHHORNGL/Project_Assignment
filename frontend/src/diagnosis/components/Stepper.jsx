import { Fragment } from "react";

function stepState(stepNumber, currentStep) {
  if (stepNumber < currentStep) return "complete";
  if (stepNumber === currentStep) return "current";
  return "upcoming";
}

export default function Stepper({ steps, currentStep, title, stepProgressText, hint }) {
  return (
    <div className="diag-panel overflow-hidden">
      <div className="border-b border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950/90 px-5 py-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400">
              {title}
            </p>
            <p className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              {stepProgressText}
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {hint}
          </div>
        </div>
      </div>

      <div className="px-5 pb-6 pt-5 md:px-6">
        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-start md:gap-4">
          {steps.map((step, index) => {
              const number = index + 1;
              const state = stepState(number, currentStep);
              const complete = state === "complete";
              const current = state === "current";

              return (
                <Fragment key={step.id}>
                  <div className="flex flex-col items-start gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-all duration-200",
                        complete
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : current
                            ? "border-emerald-600 bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 shadow-sm"
                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500",
                      ].join(" ")}
                    >
                      {complete ? <i className="fas fa-check text-xs" aria-hidden="true" /> : number}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 dark:text-slate-500">{step.description}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 ? (
                    <div className="mt-5 h-1 w-16 rounded-full bg-slate-200 dark:bg-slate-800/40">
                      <div
                        className={[
                          "h-1 rounded-full",
                          number < currentStep ? "w-full bg-emerald-500" : "w-0 bg-transparent",
                        ].join(" ")}
                      />
                    </div>
                  ) : null}
                </Fragment>
              );
          })}
        </div>

        <div className="grid gap-3 md:hidden">
          {steps.map((step, index) => {
            const number = index + 1;
            const state = stepState(number, currentStep);
            const complete = state === "complete";
            const current = state === "current";

            return (
              <div
                key={step.id}
                className={[
                  "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-200",
                  current
                    ? "border-emerald-400 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/20"
                    : complete
                      ? "border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-slate-950"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                    complete
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : current
                        ? "border-emerald-600 bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500",
                  ].join(" ")}
                >
                  {complete ? <i className="fas fa-check text-xs" aria-hidden="true" /> : number}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 dark:text-slate-500">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
