export default function StepCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  aside,
}) {
  return (
    <section className="diag-step-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white md:text-[2rem]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400 dark:text-slate-500 md:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>

      <div className="mt-6">{children}</div>

      {footer ? <div className="mt-6 border-t border-slate-100 dark:border-slate-900 pt-5">{footer}</div> : null}
    </section>
  );
}
