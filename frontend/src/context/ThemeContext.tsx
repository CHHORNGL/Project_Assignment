import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ThemeMode } from "@/types/app";
import { applyThemeClasses, isThemeDark, readStoredTheme } from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (next: ThemeMode) => void;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialTheme = "system",
  children,
}: {
  initialTheme?: ThemeMode;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme(initialTheme));
  const [isDark, setIsDark] = useState<boolean>(() => isThemeDark(readStoredTheme(initialTheme)));

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    const nextDark = applyThemeClasses(next);
    setIsDark(nextDark);

    if (typeof window.setAgriTheme === "function") {
      window.setAgriTheme(next, true);
      return;
    }

    try {
      localStorage.setItem("theme", next);
    } catch {
      // Ignore storage restriction.
    }
    document.cookie = `theme=${encodeURIComponent(next)}; max-age=31536000; path=/; SameSite=Lax`;
    fetch("/users/theme", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }, []);

  const toggleDark = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  useEffect(() => {
    setIsDark(applyThemeClasses(theme));
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const onMediaChange = () => {
      if (theme === "system") {
        setIsDark(applyThemeClasses("system"));
      }
    };
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}
