export interface LiveSupportMsg {
  id: number;
  sender_id: number;
  receiver_id?: number | null;
  message?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  is_read?: boolean;
  created_at: string;
  optimistic?: boolean;
}

export type SupportTarget = "admin" | "expert";

export interface SupportRecipientOption {
  id: number;
  name: string;
  username: string;
  role: string;
  avatarUrl?: string;
}

export interface SupportChannelSummary {
  available: boolean;
  unreadCount: number;
  defaultRecipientId: number | null;
  recipients: SupportRecipientOption[];
  lastMessage: string;
  lastTime: string | null;
}

export type SupportChannelsMap = Record<SupportTarget, SupportChannelSummary>;

export interface LiveEnvelopeResponse {
  messages?: LiveSupportMsg[];
  read_ids?: number[];
  partner_typing?: boolean;
  target?: SupportTarget;
  active_recipient?: {
    id: number;
    name: string;
    role: SupportTarget;
  } | null;
}

export function buildFarmerSupportQueryUrl(
  baseUrl: string,
  params: {
    target: SupportTarget;
    recipientId?: number | null;
    afterId?: number | null;
    envelope?: boolean;
  },
): string {
  const qs = new URLSearchParams();
  if (params.envelope) qs.set("envelope", "1");
  qs.set("target", params.target);
  if (params.recipientId && params.recipientId > 0) {
    qs.set("recipient_id", String(params.recipientId));
  }
  if (params.afterId && params.afterId > 0) {
    qs.set("after_id", String(params.afterId));
  }
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}${qs.toString()}`;
}

/**
 * Merge incremental delta messages cleanly without duplicating IDs, and apply read-receipt watermarks.
 */
export function mergeSupportMessages(
  prev: LiveSupportMsg[],
  incoming: LiveSupportMsg[],
  readIds: number[] = [],
): LiveSupportMsg[] {
  const readSet = new Set(readIds);
  const byId = new Map<number, LiveSupportMsg>();

  for (const item of prev) {
    if (item.optimistic) continue;
    byId.set(item.id, readSet.has(item.id) ? { ...item, is_read: true } : item);
  }

  for (const item of incoming) {
    byId.set(item.id, readSet.has(item.id) ? { ...item, is_read: true } : item);
  }

  const merged = Array.from(byId.values()).sort((a, b) => a.id - b.id);
  const stillPending = prev.filter((item) => item.optimistic);
  return [...merged, ...stillPending];
}

export function formatChatClock(raw?: string | null): string {
  if (!raw) return "";
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) {
    return raw.slice(11, 16) || raw;
  }
  return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatChatShortDate(raw?: string | null): string {
  if (!raw) return "";
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);
  const today = new Date();
  if (dt.toDateString() === today.toDateString()) {
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatChatDayGroup(raw: string, isKhmer = false): string {
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (dt.toDateString() === now.toDateString()) {
    return isKhmer ? "ថ្ងៃនេះ" : "Today";
  }
  if (dt.toDateString() === yesterday.toDateString()) {
    return isKhmer ? "ម្សិលមិញ" : "Yesterday";
  }
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatRecordingSeconds(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
}

export function playIncomingMessageChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
    window.setTimeout(() => void ctx.close(), 250);
  } catch {
    // Ignore autoplay restriction or unsupported AudioContext
  }
}
