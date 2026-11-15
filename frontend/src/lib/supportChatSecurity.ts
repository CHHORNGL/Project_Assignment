export const MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const DEFAULT_CAMBODIA_COORDS = {
  latitude: 11.5564,
  longitude: 104.9282,
  label: "Phnom Penh, Cambodia",
};

export interface SupportMessageInput {
  message?: string | null;
  attachment_type?: string | null;
  attachment_url?: string | null;
}

export interface SafeLocationDescriptor {
  latitude: number;
  longitude: number;
  href: string;
  label: string;
}

export interface SafeRenderedAttachment {
  text: string;
  kind: "image" | "audio" | "location" | null;
  url: string | null;
  location: SafeLocationDescriptor | null;
}

export type AttachmentDraftType = "image" | "audio" | "location";

export interface AttachmentDraft {
  type: AttachmentDraftType;
  sendUrl: string;
  file?: { name?: string; type?: string; size?: number };
  url?: string;
}

export function extractAttachmentPathname(src: string): string {
  const trimmed = src.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    }
  }
  return trimmed.split("?")[0].split("#")[0];
}

export function isSafeSupportImageUrl(src: unknown): boolean {
  if (!src || typeof src !== "string") return false;
  const trimmed = src.trim();
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:image/")) {
    return true;
  }
  if (/^(?:javascript|vbscript|file):/i.test(trimmed)) return false;
  if (/^\/\//.test(trimmed)) return false;

  const pathname = extractAttachmentPathname(trimmed);
  if (/^\/static\/uploads\/chats\/[0-9a-fA-F]{32}\.[a-zA-Z0-9]{1,10}$/.test(pathname)) {
    return true;
  }
  if (/^\/static\/(?:uploads\/[a-zA-Z0-9_\-/]+|[a-zA-Z0-9_\-/]+)\.(?:jpe?g|png|webp|gif|svg|bmp)$/i.test(pathname)) {
    return true;
  }
  return false;
}

export function isSafeSupportAudioUrl(src: unknown): boolean {
  if (!src || typeof src !== "string") return false;
  const trimmed = src.trim();
  if (/^(?:javascript|vbscript|file):/i.test(trimmed) || /^\/\//.test(trimmed)) {
    return false;
  }
  const pathname = extractAttachmentPathname(trimmed);
  return /^\/static\/uploads\/chats\/[0-9a-fA-F]{32}\.[a-zA-Z0-9]{1,10}$/.test(pathname);
}

export function parseSafeSupportLocation(attachment: unknown): SafeLocationDescriptor | null {
  if (typeof attachment !== "string" || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(attachment.trim())) {
    return null;
  }
  const clean = attachment.trim();
  const [lat, lon] = clean.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return {
    latitude: lat,
    longitude: lon,
    href: `https://maps.google.com/?q=${encodeURIComponent(clean)}`,
    label: `📍 View on Map (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
  };
}

export function normalizeSupportMessageAttachment(message: SupportMessageInput): SafeRenderedAttachment {
  const text = typeof message.message === "string" ? message.message : "";
  const attachment = message.attachment_url;
  if (typeof attachment !== "string" || !attachment) {
    return { text, kind: null, url: null, location: null };
  }

  if (message.attachment_type === "location") {
    const loc = parseSafeSupportLocation(attachment);
    if (!loc) return { text, kind: null, url: null, location: null };
    return { text, kind: "location", url: loc.href, location: loc };
  }

  if (message.attachment_type === "image") {
    if (!isSafeSupportImageUrl(attachment)) {
      return { text, kind: null, url: null, location: null };
    }
    return { text, kind: "image", url: attachment.trim(), location: null };
  }

  if (message.attachment_type === "audio") {
    if (!isSafeSupportAudioUrl(attachment)) {
      return { text, kind: null, url: null, location: null };
    }
    return { text, kind: "audio", url: attachment.trim(), location: null };
  }

  return { text, kind: null, url: null, location: null };
}

export function validateAttachmentFile(
  file: { type?: string; size?: number } | null | undefined,
  kind: "image" | "audio",
): string | null {
  if (!file) return kind === "image" ? "Please choose an image." : "No audio recorded. Try again.";
  if (kind === "image" && file.type && !file.type.startsWith("image/")) {
    return "Please choose an image.";
  }
  if (typeof file.size === "number" && file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
    return kind === "image" ? "Photo is too large (maximum 10 MB)." : "Audio is too large (maximum 10 MB).";
  }
  if (kind === "audio" && typeof file.size === "number" && file.size <= 0) {
    return "The recording is empty. Please record again.";
  }
  return null;
}

export async function resolveLocationDraftCoords(options: {
  geolocation?: {
    getCurrentPosition: (
      success: (pos: { coords: { latitude: number; longitude: number; accuracy?: number } }) => void,
      error: (err: unknown) => void,
      opts?: Record<string, unknown>,
    ) => void;
  } | null;
  fetchServerLocation?: () => Promise<{ latitude?: number; longitude?: number; display_name?: string } | null>;
}): Promise<{ latitude: number; longitude: number; accuracy?: number; label: string; coordString: string; statusMessage: string }> {
  const geo = options.geolocation;
  if (!geo) {
    const coordString = `${DEFAULT_CAMBODIA_COORDS.latitude.toFixed(6)},${DEFAULT_CAMBODIA_COORDS.longitude.toFixed(6)}`;
    return {
      latitude: DEFAULT_CAMBODIA_COORDS.latitude,
      longitude: DEFAULT_CAMBODIA_COORDS.longitude,
      label: DEFAULT_CAMBODIA_COORDS.label,
      coordString,
      statusMessage: "Location is unavailable in this browser. Select your province or search on the map below.",
    };
  }

  const fromGeo = await new Promise<{ latitude: number; longitude: number; accuracy?: number } | null>((resolve) => {
    geo.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => {
        geo.getCurrentPosition(
          (pos2) => resolve(pos2.coords),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  });

  if (fromGeo) {
    const coordString = `${fromGeo.latitude.toFixed(6)},${fromGeo.longitude.toFixed(6)}`;
    return {
      latitude: fromGeo.latitude,
      longitude: fromGeo.longitude,
      accuracy: fromGeo.accuracy,
      label: `${fromGeo.latitude.toFixed(4)}, ${fromGeo.longitude.toFixed(4)}`,
      coordString,
      statusMessage: `Coordinates: ${fromGeo.latitude.toFixed(5)}, ${fromGeo.longitude.toFixed(5)}. Ready to send or adjust above.`,
    };
  }

  if (options.fetchServerLocation) {
    try {
      const serverData = await options.fetchServerLocation();
      if (serverData && typeof serverData.latitude === "number" && typeof serverData.longitude === "number") {
        const coordString = `${serverData.latitude.toFixed(6)},${serverData.longitude.toFixed(6)}`;
        return {
          latitude: serverData.latitude,
          longitude: serverData.longitude,
          label: serverData.display_name || `${serverData.latitude.toFixed(4)}, ${serverData.longitude.toFixed(4)}`,
          coordString,
          statusMessage: serverData.display_name
            ? `Location: ${serverData.display_name}. Ready to send or adjust above.`
            : "GPS signal resolved.",
        };
      }
    } catch {
      // Fallback below
    }
  }

  const coordString = `${DEFAULT_CAMBODIA_COORDS.latitude.toFixed(6)},${DEFAULT_CAMBODIA_COORDS.longitude.toFixed(6)}`;
  return {
    latitude: DEFAULT_CAMBODIA_COORDS.latitude,
    longitude: DEFAULT_CAMBODIA_COORDS.longitude,
    label: DEFAULT_CAMBODIA_COORDS.label,
    coordString,
    statusMessage: "GPS signal unavailable. You can select your province or search above.",
  };
}

export function createAttachmentSendCoordinator(options: {
  uploadFile: (file: { name?: string; type?: string; size?: number }) => Promise<{ url?: string }>;
  sendMessage: (
    sendUrl: string,
    payload: { message: string; attachment_url: string; attachment_type: AttachmentDraftType },
  ) => Promise<{ success?: boolean }>;
}) {
  let busy = false;

  return {
    isBusy: () => busy,
    async submitDraft(draft: AttachmentDraft | null, caption: string): Promise<boolean> {
      if (busy || !draft) return false;
      busy = true;
      try {
        let attachmentUrl = draft.url;
        if (!attachmentUrl) {
          const validationError = validateAttachmentFile(
            draft.file,
            draft.type === "audio" ? "audio" : "image",
          );
          if (validationError) throw new Error(validationError);
          if (!draft.file) throw new Error("No file attached.");
          const uploaded = await options.uploadFile(draft.file);
          if (!uploaded?.url) throw new Error("Upload failed. Please try again.");
          attachmentUrl = uploaded.url;
        }

        const result = await options.sendMessage(draft.sendUrl, {
          message: caption.trim(),
          attachment_url: attachmentUrl,
          attachment_type: draft.type,
        });
        if (!result?.success) {
          throw new Error("Message was not confirmed. Check chat history before trying again.");
        }
        return true;
      } finally {
        busy = false;
      }
    },
  };
}
