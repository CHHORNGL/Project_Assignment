import type { LanguageCode } from "@/types/app";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  lang,
  enUrl = "/user/language/en",
  kmUrl = "/user/language/km",
  className = "",
}: {
  lang: LanguageCode;
  enUrl?: string;
  kmUrl?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/85 p-1 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-obsidian-900/85",
        className,
      )}
      role="navigation"
      aria-label="Language selector"
    >
      <a
        href={enUrl}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
          lang === "en"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
        )}
      >
        <span className="fi fi-us rounded-sm" aria-hidden="true" />
        <span>EN</span>
      </a>
      <a
        href={kmUrl}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
          lang === "km"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
        )}
      >
        <span className="fi fi-kh rounded-sm" aria-hidden="true" />
        <span>KH</span>
      </a>
    </div>
  );
}
