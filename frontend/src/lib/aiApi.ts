export interface AskAgriExpertOptions {
  signal?: AbortSignal;
  endpoint?: string;
  csrfToken?: string;
}

/**
 * Shared web client for the Flask agricultural assistant endpoint.
 *
 * Keep this call same-origin so the browser sends the Flask session cookie;
 * server-side credentials are never exposed to the frontend.
 */
export async function askAgriExpert(
  message: string,
  { signal, endpoint = "/api/chat/ask", csrfToken }: AskAgriExpertOptions = {},
): Promise<string> {
  const text = String(message || "").trim();
  if (!text) throw new Error("Message is required");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ message: text }),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    reply?: unknown;
    error?: string;
  };
  if (!response.ok || typeof payload.reply !== "string") {
    throw new Error(payload.error || "The agricultural assistant is unavailable");
  }
  return payload.reply;
}
