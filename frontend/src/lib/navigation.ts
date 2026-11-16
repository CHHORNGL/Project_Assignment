import type { AppBootstrap } from "@/types/app";
import type { ShellNavSection } from "@/components/layout/WorkspaceShell";

function normalizeNavPath(rawPath: string): string {
  const pathOnly = (rawPath || "/").split("?")[0].split("#")[0];
  if (pathOnly.length > 1) {
    return pathOnly.replace(/\/+$/, "") || "/";
  }
  return pathOnly || "/";
}

export function isNavHrefActive(currentPath: string, href: string): boolean {
  const current = normalizeNavPath(currentPath);
  const target = normalizeNavPath(href);
  if (current === target) return true;
  if (target.length > 1 && current.startsWith(`${target}/`)) {
    return true;
  }
  return false;
}

export function buildNavSections(bootstrap: AppBootstrap<any>): ShellNavSection[] {
  const rawSections = (bootstrap.ui?.navigation?.sections || []) as Array<{
    title: string;
    items: Array<{ label: string; href: string; badge?: string | number }>;
  }>;
  const currentPath = typeof window !== "undefined" ? window.location.pathname : bootstrap.path;

  return rawSections.map((sec) => ({
    title: sec.title,
    items: (sec.items || []).map((item) => ({
      label: item.label,
      href: item.href,
      badge: item.badge,
      active: isNavHrefActive(currentPath, item.href),
    })),
  }));
}

export type FarmerBottomNavId = "home" | "diagnose" | "ask-ai" | "history" | "profile";

export interface FarmerBottomNavItem {
  id: FarmerBottomNavId;
  label: string;
  href: string;
  active: boolean;
}

export function buildFarmerBottomNav(bootstrap: AppBootstrap<any>): FarmerBottomNavItem[] {
  const isKhmer = bootstrap.lang === "km";
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : bootstrap.path || "/";
  const path = normalizeNavPath(currentPath);
  const isAuthenticated = Boolean(bootstrap.user?.id);

  const homeHref = "/farmer/dashboard";
  const diagnoseHref = "/farmer/diagnose/rule-based";
  const askAiHref = "/farmer/chat";
  const historyHref = "/farmer/diagnoses/history";
  const profileHref = isAuthenticated
    ? bootstrap.urls?.profile || "/users/profile"
    : "/auth/login";

  return [
    {
      id: "home",
      label: isKhmer ? "ទំព័រដើម" : "Home",
      href: homeHref,
      active: path === "/farmer/dashboard" || path === "/users",
    },
    {
      id: "diagnose",
      label: isKhmer ? "វិនិច្ឆ័យ" : "Diagnose",
      href: diagnoseHref,
      active: path === "/farmer/diagnose" || path.startsWith("/farmer/diagnose/"),
    },
    {
      id: "ask-ai",
      label: isKhmer ? "សួរ AI" : "Ask AI",
      href: askAiHref,
      active: path === "/farmer/chat" || path.startsWith("/farmer/chat/"),
    },
    {
      id: "history",
      label: isKhmer ? "ប្រវត្តិ" : "History",
      href: historyHref,
      active:
        path.startsWith("/farmer/diagnoses") ||
        path.startsWith("/farmer/history") ||
        path.startsWith("/farmer/result"),
    },
    {
      id: "profile",
      label: isKhmer ? "គណនី" : "Profile",
      href: profileHref,
      active:
        path.startsWith("/users/profile") ||
        path.startsWith("/users/settings") ||
        path.startsWith("/users/login-activity") ||
        path.startsWith("/users/member-card") ||
        path.startsWith("/users/notifications"),
    },
  ];
}
