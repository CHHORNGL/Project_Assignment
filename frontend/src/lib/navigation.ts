import type { AppBootstrap } from "@/types/app";
import type { ShellNavSection } from "@/components/layout/WorkspaceShell";

export function buildNavSections(bootstrap: AppBootstrap<any>): ShellNavSection[] {
  const rawSections = (bootstrap.ui?.navigation?.sections || []) as Array<{
    title: string;
    items: Array<{ label: string; href: string; badge?: string | number }>;
  }>;
  const currentPath = typeof window !== "undefined" ? window.location.pathname : bootstrap.path;

  return rawSections.map((sec) => ({
    title: sec.title,
    items: (sec.items || []).map((item) => {
      const itemPath = item.href.split("?")[0];
      const active = currentPath === itemPath || (itemPath.length > 1 && currentPath.startsWith(`${itemPath}/`));
      return {
        label: item.label,
        href: item.href,
        badge: item.badge,
        active,
      };
    }),
  }));
}
