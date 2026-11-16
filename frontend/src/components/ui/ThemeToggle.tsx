import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  showSystem = false,
  variant = "default",
  className = "",
}: {
  showSystem?: boolean;
  variant?: "default" | "phoenix";
  className?: string;
}) {
  const { theme, isDark, setTheme, toggleDark } = useTheme();
  const isPhoenix = variant === "phoenix";

  if (showSystem) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-obsidian-900/80",
          className,
        )}
        role="group"
        aria-label="Theme mode"
      >
        {(
          [
            { id: "light", label: "Light", icon: Sun },
            { id: "system", label: "System", icon: Monitor },
            { id: "dark", label: "Dark", icon: Moon },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              title={label}
              aria-label={label}
              aria-pressed={active}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all",
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        isPhoenix
          ? "inline-flex h-9 w-9 items-center justify-center gap-2 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] text-xs font-semibold text-[#31374a] transition-colors hover:border-[#b3bac9] hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:border-[#4b546f] dark:hover:bg-[#22283a] xl:w-auto xl:px-2.5"
          : "inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white/85 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-900/85 dark:text-slate-200 dark:hover:border-indigo-500/60 dark:hover:text-indigo-300 xl:w-auto xl:px-3",
        className,
      )}
    >
      {isDark ? (
        <>
          <Sun className={cn("h-3.5 w-3.5", isPhoenix ? "text-[#e5780b]" : "text-amber-400")} />
          <span className="hidden xl:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className={cn("h-3.5 w-3.5", isPhoenix ? "text-[#3874ff]" : "text-indigo-600")} />
          <span className="hidden xl:inline">Dark</span>
        </>
      )}
    </button>
  );
}
