import type { ReactNode } from "react";

export interface StepCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}

export default function StepCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  aside,
}: StepCardProps) {
  return (
    <section className="diag-step-card">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800/80 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>

      <div className="mt-5">{children}</div>

      {footer ? (
        <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800/80">{footer}</div>
      ) : null}
    </section>
  );
}
