import type { NotificationItem } from "@/types/app";

export type NotificationCategory = "diagnosis" | "messages" | "billing" | "system";
export type NotificationLevel = "info" | "success" | "warning" | "danger";
export type NotificationDateGroup = "today" | "yesterday" | "earlier";

export function getNotificationMessage(item: Pick<NotificationItem, "message" | "subtitle">): string {
  return String(item.message || item.subtitle || "").trim();
}

export function getNotificationHref(item: Pick<NotificationItem, "link" | "url">): string | null {
  const raw = String(item.link || item.url || "").trim();
  if (!raw || raw === "#") return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return null;
  }
  return raw;
}

export function isNotificationRead(item: Pick<NotificationItem, "is_read" | "unread">): boolean {
  if (typeof item.is_read === "boolean") return item.is_read;
  if (typeof item.unread === "boolean") return !item.unread;
  return false;
}

export function getNotificationLevel(item: Pick<NotificationItem, "level" | "kind">): NotificationLevel {
  const lvl = String(item.level || "").trim().toLowerCase();
  if (lvl === "success" || lvl === "warning" || lvl === "danger" || lvl === "info") {
    return lvl;
  }
  const kind = String(item.kind || "").trim().toLowerCase();
  if (kind.includes("rejected")) return "danger";
  if (kind.includes("approved") || kind.includes("upgrade")) return "success";
  return "info";
}

export function getNotificationCategory(
  item: Pick<NotificationItem, "kind" | "url" | "link">,
): NotificationCategory {
  const kind = String(item.kind || "").trim().toLowerCase();
  const href = String(item.link || item.url || "").trim().toLowerCase();

  if (kind.startsWith("diagnosis") || href.includes("/diagnos") || href.includes("/result")) {
    return "diagnosis";
  }
  if (
    kind.includes("support") ||
    kind.includes("chat") ||
    kind.includes("message") ||
    href.includes("/chat") ||
    href.includes("/support")
  ) {
    return "messages";
  }
  if (kind.includes("premium") || kind.includes("bakong") || href.includes("/premium")) {
    return "billing";
  }
  return "system";
}

export function parseNotificationDate(createdAt?: string | null): Date | null {
  if (!createdAt) return null;
  const raw = String(createdAt).trim();
  if (!raw) return null;
  const hasZone = raw.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = hasZone ? raw : `${raw.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getNotificationDateGroup(
  item: Pick<NotificationItem, "created_at" | "time">,
  now: Date = new Date(),
): NotificationDateGroup {
  const dt = parseNotificationDate(item.created_at);
  if (dt) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;
    const itemDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    if (itemDay >= startOfToday) return "today";
    if (itemDay >= startOfYesterday) return "yesterday";
    return "earlier";
  }

  const label = String(item.time || "").trim().toLowerCase();
  if (label === "just now" || label.endsWith("m ago") || label.endsWith("h ago")) {
    return "today";
  }
  if (label === "yesterday") {
    return "yesterday";
  }
  return "earlier";
}

export function getNotificationTimeLabel(
  item: Pick<NotificationItem, "created_at" | "time">,
  isKhmer: boolean,
  now: Date = new Date(),
): string {
  const dt = parseNotificationDate(item.created_at);
  if (dt) {
    const diffMs = Math.max(0, now.getTime() - dt.getTime());
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return isKhmer ? "អម្បាញ់មិញ" : "Just now";
    if (mins < 60) return isKhmer ? `${mins} នាទីមុន` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24 && dt.getDate() === now.getDate() && dt.getMonth() === now.getMonth()) {
      return isKhmer ? `${hours} ម៉ោងមុន` : `${hours}h ago`;
    }
    const group = getNotificationDateGroup(item, now);
    const timeStr = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (group === "yesterday") {
      return isKhmer ? `ម្សិលមិញ · ${timeStr}` : `Yesterday · ${timeStr}`;
    }
    const dateStr = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${dateStr} · ${timeStr}`;
  }

  return String(item.time || "").trim();
}
