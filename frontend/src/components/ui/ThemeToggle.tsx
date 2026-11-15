import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  showSystem = false,
  className = "",
}: {
  showSystem?: boolean;
  className?: string;
}) {
  const { theme, isDark, setTheme, toggleDark } = useTheme();

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
        "inline-flex h-9 items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-900/85 dark:text-slate-200 dark:hover:border-indigo-500/60 dark:hover:text-indigo-300",
        className,
      )}
    >
      {isDark ? (
        <>
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  );
}
