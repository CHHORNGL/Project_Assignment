export interface InspectShortcutEvent {
  key?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

const BLOCKED_DEVTOOLS_SHIFT_KEYS = new Set(["i", "j", "c"]);
const BLOCKED_MAC_OPT_KEYS = new Set(["i", "j", "c", "u"]);
const BLOCKED_SOURCE_KEYS = new Set(["u", "s"]);
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Return true for browser DevTools, View Source, and Save-Page shortcuts. */
export function isInspectShortcut(event: InspectShortcutEvent): boolean {
  const key = String(event.key || "").toLowerCase();
  if (!key) return false;
  if (key === "f12") return true;

  const hasPrimaryModifier = Boolean(event.ctrlKey || event.metaKey);
  if (hasPrimaryModifier && event.shiftKey && BLOCKED_DEVTOOLS_SHIFT_KEYS.has(key)) {
    return true;
  }
  if (event.metaKey && event.altKey && BLOCKED_MAC_OPT_KEYS.has(key)) {
    return true;
  }
  if (hasPrimaryModifier && !event.shiftKey && !event.altKey && BLOCKED_SOURCE_KEYS.has(key)) {
    return true;
  }
  return false;
}

/** Preserve native context menus inside editable inputs, textareas, and rich editors. */
export function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const candidate = target as TargetLike;
  const tag = String(candidate.tagName || "").toUpperCase();
  if (EDITABLE_TAGS.has(tag)) return true;
  return Boolean(candidate.isContentEditable);
}

/** Clear inline bootstrap JSON globals and script nodes once React reads them at startup. */
export function scrubBootstrapData(
  elementIds: string[] = ["app-bootstrap", "diagnosis-wizard-data"],
): void {
  if (typeof window !== "undefined") {
    try {
      delete (window as unknown as Record<string, unknown>).__APP_BOOTSTRAP__;
    } catch {
      (window as unknown as Record<string, unknown>).__APP_BOOTSTRAP__ = undefined;
    }
  }
  if (typeof document === "undefined") return;
  for (const id of elementIds) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.textContent = "";
    node.remove();
  }
}

/** Deter casual browser DevTools / View-Source / Right-Click inspection outside form fields. */
export function initInspectGuard(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }

  const onContextMenu = (event: MouseEvent) => {
    if (!isEditableTarget(event.target)) {
      event.preventDefault();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isInspectShortcut(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("keydown", onKeyDown, true);
  };
}
