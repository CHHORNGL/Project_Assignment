import type { LanguageCode } from "@/types/app";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  lang,
  enUrl = "/user/language/en",
  kmUrl = "/user/language/km",
  variant = "default",
  alwaysFull = false,
  className = "",
}: {
  lang: LanguageCode;
  enUrl?: string;
  kmUrl?: string;
  variant?: "default" | "phoenix";
  alwaysFull?: boolean;
  className?: string;
}) {
  const isPhoenix = variant === "phoenix";

  const options: Array<{ code: LanguageCode; label: string; href: string; flagClass: string }> = [
    { code: "en", label: "EN", href: enUrl, flagClass: "fi-us" },
    { code: "km", label: "KH", href: kmUrl, flagClass: "fi-kh" },
  ];

  const activeOption = options.find((opt) => opt.code === lang) || options[0];
  const nextOption = options.find((opt) => opt.code !== activeOption.code) || options[1];

  return (
    <>
      {/* Compact single-pill toggle on narrow phones (< 640px) */}
      {!alwaysFull && (
        <a
          href={nextOption.href}
          aria-label={`Switch language to ${nextOption.label}`}
          title={`Switch to ${nextOption.label}`}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 text-xs font-semibold transition-all duration-150 sm:hidden",
            isPhoenix
              ? "rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] px-2.5 text-[#31374a] hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:bg-[#22283a]"
              : "rounded-full border border-slate-200/80 bg-white/85 px-2.5 text-slate-700 shadow-sm backdrop-blur-md hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-900/85 dark:text-slate-200 dark:hover:border-indigo-500/60 dark:hover:text-indigo-300",
            className,
          )}
        >
          <span className={`fi ${nextOption.flagClass} rounded-sm`} aria-hidden="true" />
          <span>{nextOption.label}</span>
        </a>
      )}

      {/* Dual segmented switcher on sm+ (or always when alwaysFull is set) */}
      <div
        className={cn(
          alwaysFull ? "inline-flex items-center" : "hidden items-center sm:inline-flex",
          isPhoenix
            ? "h-9 gap-0.5 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 dark:border-[#373e53] dark:bg-[#0f111a]"
            : "gap-1 rounded-full border border-slate-200/80 bg-white/85 p-1 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-obsidian-900/85",
          className,
        )}
        role="navigation"
        aria-label="Language selector"
      >
        {options.map((opt) => {
          const active = lang === opt.code;
          return (
            <a
              key={opt.code}
              href={opt.href}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold transition-all duration-150",
                alwaysFull && "flex-1 justify-center",
                isPhoenix ? "h-7 rounded-md px-2.5" : "h-7 rounded-full px-3",
                active
                  ? isPhoenix
                    ? "bg-white text-[#141824] shadow-sm ring-1 ring-[#cbd0dd]/60 dark:bg-[#1e2436] dark:text-[#eff2f6] dark:ring-[#373e53]"
                    : "bg-indigo-600 text-white shadow-sm"
                  : isPhoenix
                    ? "text-[#6e7891] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:text-[#eff2f6]"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
              )}
            >
              <span className={`fi ${opt.flagClass} rounded-sm`} aria-hidden="true" />
              <span>{opt.label}</span>
            </a>
          );
        })}
      </div>
    </>
  );
}
