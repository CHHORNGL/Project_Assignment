export type AuditCategory = "all" | "alerts" | "auth" | "rbac" | "operations";

export type AuditTone = "indigo" | "emerald" | "amber" | "rose" | "sky" | "slate";

export interface AuditClassification {
  category: Exclude<AuditCategory, "all">;
  tone: AuditTone;
  categoryEn: string;
  categoryKm: string;
}

export interface AuditDetailField {
  key: string;
  label: string;
  value: string;
}

export interface ParsedAuditDetail {
  summary: string;
  ip?: string;
  rid?: string;
  status?: string;
  browser?: string;
  os?: string;
  device?: string;
  loginRoute?: string;
  fields: AuditDetailField[];
}

const KNOWN_FIELD_LABELS: Record<string, string> = {
  ip: "IP Address",
  rid: "Request ID",
  status: "Status",
  device: "Device",
  browser: "Browser",
  os: "Operating System",
  login_route: "Login Route",
  route: "Route",
  activity_id: "Activity ID",
  sid: "Session ID",
  format: "Format",
  scope: "Scope",
  count: "Count",
  q: "Search Query",
  action: "Action Filter",
  bulk: "Bulk Operation",
  reason: "Reason",
};

export function formatAuditActionLabel(action: string): string {
  return action
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function classifyAuditAction(action: string, detail = ""): AuditClassification {
  const act = (action || "").toUpperCase();
  const det = (detail || "").toUpperCase();

  if (
    act.includes("FAILURE") ||
    act.includes("ERROR") ||
    act === "BAN_USER" ||
    act === "AUTH_SESSION_EXPIRED" ||
    det.includes("STATUS=FAILURE")
  ) {
    return {
      category: "alerts",
      tone: act === "AUTH_SESSION_EXPIRED" ? "amber" : "rose",
      categoryEn: "Security Alert",
      categoryKm: "ការព្រមានសុវត្ថិភាព",
    };
  }

  if (
    act.includes("LOGIN") ||
    act.includes("LOGOUT") ||
    act.includes("SESSION") ||
    act.includes("PASSKEY") ||
    act.includes("VERIFY")
  ) {
    return {
      category: "auth",
      tone: act.includes("LOGOUT") ? "sky" : "emerald",
      categoryEn: "Auth & Session",
      categoryKm: "ការផ្ទៀងផ្ទាត់ចូលប្រើ",
    };
  }

  if (
    act.includes("ROLE") ||
    act.includes("PERMISSION") ||
    act.includes("USER") ||
    act.includes("PREMIUM") ||
    act.includes("CREDIT") ||
    act.includes("PASSWORD") ||
    act.includes("EMAIL")
  ) {
    return {
      category: "rbac",
      tone: act.includes("DELETE") || act.includes("RESET") ? "amber" : "indigo",
      categoryEn: "Users & RBAC",
      categoryKm: "អ្នកប្រើ និងសិទ្ធិ",
    };
  }

  return {
    category: "operations",
    tone: act.includes("POST") || act.includes("EXPORT") ? "sky" : "slate",
    categoryEn: "Operations",
    categoryKm: "ប្រតិបត្តិការប្រព័ន្ធ",
  };
}

export function parseAuditDetail(raw: string): ParsedAuditDetail {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return { summary: "", fields: [] };
  }

  const tokens = trimmed.split(/\s+/);
  const fields: AuditDetailField[] = [];
  const textParts: string[] = [];

  for (const token of tokens) {
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      const key = token.slice(0, eqIndex);
      const value = token.slice(eqIndex + 1);
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) && value.length > 0) {
        fields.push({
          key,
          label: KNOWN_FIELD_LABELS[key] || formatAuditActionLabel(key),
          value,
        });
        continue;
      }
    }
    textParts.push(token);
  }

  const byKey = new Map(fields.map((f) => [f.key, f.value]));
  const summary = textParts.join(" ").trim();

  return {
    summary,
    ip: byKey.get("ip"),
    rid: byKey.get("rid"),
    status: byKey.get("status"),
    browser: byKey.get("browser"),
    os: byKey.get("os"),
    device: byKey.get("device"),
    loginRoute: byKey.get("login_route") || byKey.get("route"),
    fields,
  };
}
