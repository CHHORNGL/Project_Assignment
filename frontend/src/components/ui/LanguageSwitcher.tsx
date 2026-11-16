import type { LanguageCode } from "@/types/app";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  lang,
  enUrl = "/user/language/en",
  kmUrl = "/user/language/km",
  variant = "default",
  className = "",
}: {
  lang: LanguageCode;
  enUrl?: string;
  kmUrl?: string;
  variant?: "default" | "phoenix";
  className?: string;
}) {
  const isPhoenix = variant === "phoenix";

  const options: Array<{ code: LanguageCode; label: string; href: string; flagClass: string }> = [
    { code: "en", label: "EN", href: enUrl, flagClass: "fi-us" },
    { code: "km", label: "KH", href: kmUrl, flagClass: "fi-kh" },
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center",
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
  );
}
