import type { ThemeMode } from "@/types/app";

declare global {
  interface Window {
    setAgriTheme?: (theme: ThemeMode, saveToServer?: boolean) => void;
    syncAgriThemeUI?: () => void;
    showToast?: (message: string, category?: string) => void;
  }
}

export function resolveSystemDark(): boolean {
  return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function readStoredTheme(fallback: ThemeMode = "system"): ThemeMode {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {
    // Ignore storage restriction errors.
  }

  const match = document.cookie.match(/(?:^|;\s*)theme=([^;]+)/);
  if (match) {
    const cookieVal = decodeURIComponent(match[1]);
    if (cookieVal === "dark" || cookieVal === "light" || cookieVal === "system") {
      return cookieVal;
    }
  }

  if (fallback === "dark" || fallback === "light" || fallback === "system") {
    return fallback;
  }
  return "system";
}

export function isThemeDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return resolveSystemDark();
}

export function applyThemeClasses(theme: ThemeMode): boolean {
  const dark = isThemeDark(theme);
  const root = document.documentElement;
  const body = document.body;

  if (dark) {
    root.classList.add("dark-mode");
    root.classList.add("auth-panel-dark");
    body?.classList.add("dark-mode");
    body?.classList.add("auth-panel-dark");
  } else {
    root.classList.remove("dark-mode");
    root.classList.remove("auth-panel-dark");
    body?.classList.remove("dark-mode");
    body?.classList.remove("auth-panel-dark");
  }
  return dark;
}
