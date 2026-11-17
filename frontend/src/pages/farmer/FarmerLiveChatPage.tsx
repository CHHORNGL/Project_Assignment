import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  Check,
  CheckCheck,
  FileAudio,
  Headphones,
  Loader2,
  LocateFixed,
  MapPin,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { requestJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import {
  normalizeSupportMessageAttachment,
  resolveLocationDraftCoords,
  validateAttachmentFile,
} from "@/lib/supportChatSecurity";
import {
  buildFarmerSupportQueryUrl,
  formatChatClock,
  formatChatDayGroup,
  formatChatShortDate,
  formatRecordingSeconds,
  mergeSupportMessages,
  playIncomingMessageChime,
  type LiveEnvelopeResponse,
  type LiveSupportMsg,
  type SupportChannelsMap,
  type SupportTarget,
} from "@/lib/liveSupportHelpers";
import { cn } from "@/lib/utils";

interface FarmerLiveChatData {
  currentUserId: number;
  initialTarget: SupportTarget;
  initialRecipientId: number | null;
  channels: SupportChannelsMap;
  aiChatUrl: string;
  endpoints: {
    channels: string;
    messages: string;
    typing: string;
    send: string;
    upload: string;
    location: string;
    locationSearch: string;
  };
}

interface StagedAttachment {
  file: File;
  kind: "image" | "audio";
  previewUrl: string;
}

interface LocationSearchItem {
  name: string;
  latitude: number;
  longitude: number;
}

export default function FarmerLiveChatPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<FarmerLiveChatData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [target, setTarget] = useState<SupportTarget>(
    d.initialTarget === "expert" ? "expert" : "admin",
  );
  const [recipientId, setRecipientId] = useState<number | null>(d.initialRecipientId ?? null);
  const [channels, setChannels] = useState<SupportChannelsMap>(d.channels);
  const [messages, setMessages] = useState<LiveSupportMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [activeRecipientName, setActiveRecipientName] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [hasUnseenBelow, setHasUnseenBelow] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Location picker state
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<LocationSearchItem[]>([]);

  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const lastPersistedIdRef = useRef<number>(0);
  const targetRef = useRef<SupportTarget>(target);
  const recipientIdRef = useRef<number | null>(recipientId);
  const typingEmitRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    recipientIdRef.current = recipientId;
  }, [recipientId]);

  useEffect(() => {
    if (!lightboxUrl) return undefined;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  const activeChannel = channels[target];

  const isNearBottom = useCallback(() => {
    const el = threadScrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setHasUnseenBelow(false);
  }, []);

  const clearStagedAttachment = useCallback(() => {
    setStagedAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const refreshChannels = useCallback(async () => {
    try {
      const resp = await fetch(d.endpoints.channels, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) return;
      const json = (await resp.json()) as { channels?: SupportChannelsMap };
      if (json.channels) {
        setChannels(json.channels);
      }
    } catch {
      // Ignore transient poll error
    }
  }, [d.endpoints.channels]);

  const loadHistory = useCallback(
    async (nextTarget: SupportTarget, nextRecipientId: number | null) => {
      setLoading(true);
      setPartnerTyping(false);
      lastPersistedIdRef.current = 0;
      setMessages([]);
      try {
        const url = buildFarmerSupportQueryUrl(d.endpoints.messages, {
          target: nextTarget,
          recipientId: nextRecipientId,
          envelope: true,
        });
        const resp = await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!resp.ok) throw new Error("Failed to sync chat");
        const json = (await resp.json()) as LiveEnvelopeResponse;
        if (targetRef.current !== nextTarget || recipientIdRef.current !== nextRecipientId) {
          return;
        }
        const incoming = json.messages || [];
        lastPersistedIdRef.current = incoming.length ? incoming[incoming.length - 1].id : 0;
        setMessages(mergeSupportMessages([], incoming, json.read_ids || []));
        setPartnerTyping(Boolean(json.partner_typing));
        setActiveRecipientName(json.active_recipient?.name || "");
        window.requestAnimationFrame(() => scrollToBottom("auto"));
        void refreshChannels();
      } catch (err) {
        pushToast("danger", err instanceof Error ? err.message : "Could not load chat history.");
      } finally {
        setLoading(false);
      }
    },
    [d.endpoints.messages, pushToast, refreshChannels, scrollToBottom],
  );

  const pollDelta = useCallback(async () => {
    const activeT = targetRef.current;
    const activeR = recipientIdRef.current;
    try {
      const url = buildFarmerSupportQueryUrl(d.endpoints.messages, {
        target: activeT,
        recipientId: activeR,
        afterId: lastPersistedIdRef.current,
        envelope: true,
      });
      const resp = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) return;
      const json = (await resp.json()) as LiveEnvelopeResponse;
      if (targetRef.current !== activeT || recipientIdRef.current !== activeR) {
        return;
      }

      const incoming = json.messages || [];
      const readIds = json.read_ids || [];
      setPartnerTyping(Boolean(json.partner_typing));
      if (json.active_recipient?.name) {
        setActiveRecipientName(json.active_recipient.name);
      }

      if (incoming.length > 0 || readIds.length > 0) {
        if (incoming.length > 0) {
          lastPersistedIdRef.current = Math.max(
            lastPersistedIdRef.current,
            incoming[incoming.length - 1].id,
          );
        }
        const hadIncomingFromPartner = incoming.some((m) => m.sender_id !== d.currentUserId);
        const wasNearBottom = isNearBottom();

        setMessages((prev) => mergeSupportMessages(prev, incoming, readIds));

        if (hadIncomingFromPartner && soundOn) {
          playIncomingMessageChime();
        }
        if (incoming.length > 0) {
          if (wasNearBottom || !hadIncomingFromPartner) {
            window.requestAnimationFrame(() => scrollToBottom("smooth"));
          } else {
            setHasUnseenBelow(true);
          }
        }
      }
      void refreshChannels();
    } catch {
      // Silent retry on next poll
    }
  }, [d.currentUserId, d.endpoints.messages, isNearBottom, refreshChannels, scrollToBottom, soundOn]);

  useEffect(() => {
    void loadHistory(target, recipientId);
  }, [loadHistory, recipientId, target]);

  useEffect(() => {
    const onVisibility = () => {
      const vis = document.visibilityState === "visible";
      setTabVisible(vis);
      if (vis) void pollDelta();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void pollDelta();
      }
    }, 2200);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [pollDelta]);

  const handleSelectChannel = (nextTarget: SupportTarget, nextRecipientId: number | null = null) => {
    if (nextTarget === target && nextRecipientId === recipientId) return;
    setTarget(nextTarget);
    setRecipientId(nextRecipientId);
    setActiveRecipientName("");
    setLocationOpen(false);
    clearStagedAttachment();

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("target", nextTarget);
      if (nextRecipientId && nextRecipientId > 0) {
        url.searchParams.set("recipient_id", String(nextRecipientId));
      } else {
        url.searchParams.delete("recipient_id");
      }
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore history errors
    }
  };

  const emitTyping = () => {
    const now = Date.now();
    if (now - typingEmitRef.current < 2500) return;
    typingEmitRef.current = now;
    void fetch(d.endpoints.typing, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": bootstrap.csrfToken,
      },
      body: JSON.stringify({
        target,
        recipient_id: recipientId,
      }),
    }).catch(() => {});
  };

  const sendMessagePayload = async (payload: {
    message?: string;
    attachment_url?: string;
    attachment_type?: string;
  }) => {
    if (sending) return;
    const tempId = -Date.now();
    const optimistic: LiveSupportMsg = {
      id: tempId,
      sender_id: d.currentUserId,
      message: payload.message || "",
      attachment_url: payload.attachment_url,
      attachment_type: payload.attachment_type,
      is_read: false,
      created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      optimistic: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    window.requestAnimationFrame(() => scrollToBottom("smooth"));

    try {
      const res = await requestJson<{ success?: boolean; message?: LiveSupportMsg }>(
        d.endpoints.send,
        "POST",
        bootstrap.csrfToken,
        {
          ...payload,
          target,
          recipient_id: recipientId,
        },
      );
      const saved = res.data?.message;
      setMessages((prev) => {
        const withoutOpt = prev.filter((item) => item.id !== tempId);
        return saved ? mergeSupportMessages(withoutOpt, [saved]) : withoutOpt;
      });
      if (saved) {
        lastPersistedIdRef.current = Math.max(lastPersistedIdRef.current, saved.id);
      }
      void refreshChannels();
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== tempId));
      pushToast("danger", err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleComposerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const text = draft.trim();
    if (!text && !stagedAttachment) return;

    if (stagedAttachment) {
      const att = stagedAttachment;
      const fd = new FormData();
      fd.append("file", att.file);
      setSending(true);
      try {
        const resp = await fetch(d.endpoints.upload, {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRFToken": bootstrap.csrfToken },
          body: fd,
        });
        const json = (await resp.json()) as { url?: string; error?: string };
        if (!resp.ok || !json.url) {
          throw new Error(json.error || "Upload failed");
        }
        clearStagedAttachment();
        setDraft("");
        await sendMessagePayload({
          message: text,
          attachment_url: json.url,
          attachment_type: att.kind === "audio" ? "audio" : "image",
        });
      } catch (err) {
        pushToast("danger", err instanceof Error ? err.message : "Upload failed");
        setSending(false);
      }
      return;
    }

    setDraft("");
    await sendMessagePayload({ message: text });
  };

  const handleFilePick = (file: File) => {
    const err = validateAttachmentFile(file, "image");
    if (err) {
      pushToast("warning", err);
      return;
    }
    clearStagedAttachment();
    setStagedAttachment({
      file,
      kind: "image",
      previewUrl: URL.createObjectURL(file),
    });
  };

  const toggleRecording = async () => {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      pushToast(
        "warning",
        isKhmer
          ? "កម្មវិធីរុករកមិនគាំទ្រការថតសំឡេងទេ។"
          : "Voice recording is not supported in this browser.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setRecordSeconds(0);
      setRecording(true);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);

        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size > 0) {
          const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
          clearStagedAttachment();
          setStagedAttachment({
            file,
            kind: "audio",
            previewUrl: URL.createObjectURL(file),
          });
        }
      };

      recorder.start();
    } catch {
      pushToast(
        "warning",
        isKhmer ? "មិនអាចបើកមីក្រូហ្វូនបានទេ។" : "Microphone permission denied or unavailable.",
      );
    }
  };

  const handleShareGpsLocation = async () => {
    if (sending || locationBusy) return;
    setLocationBusy(true);
    try {
      const resolved = await resolveLocationDraftCoords({
        geolocation: typeof navigator !== "undefined" ? navigator.geolocation : null,
        fetchServerLocation: async () => {
          const resp = await fetch(d.endpoints.location, {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (!resp.ok) return null;
          return (await resp.json()) as {
            latitude?: number;
            longitude?: number;
            display_name?: string;
          };
        },
      });
      setLocationOpen(false);
      await sendMessagePayload({
        message: resolved.label ? `📍 Location: ${resolved.label}` : "",
        attachment_url: resolved.coordString,
        attachment_type: "location",
      });
    } finally {
      setLocationBusy(false);
    }
  };

  useEffect(() => {
    if (!locationOpen) return;
    const trimmed = locationQuery.trim();
    const timer = window.setTimeout(async () => {
      try {
        const resp = await fetch(
          `${d.endpoints.locationSearch}?q=${encodeURIComponent(trimmed || "Phnom")}`,
          { credentials: "include", headers: { Accept: "application/json" } },
        );
        if (!resp.ok) return;
        const rows = (await resp.json()) as LocationSearchItem[];
        setLocationResults(Array.isArray(rows) ? rows.slice(0, 6) : []);
      } catch {
        setLocationResults([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [d.endpoints.locationSearch, locationOpen, locationQuery]);

  const quickPrompts = useMemo(() => {
    if (target === "expert") {
      return isKhmer
        ? [
            "ស្លឹកស្រូវឡើងលឿង តើគួរព្យាបាលយ៉ាងណា?",
            "ចែករំលែករូបភាពស្លឹកដំណាំ និងទីតាំងចម្ការ",
            "សូមណែនាំអំពីកាលវិភាគបាញ់ថ្នាំ និងដាក់ជី",
          ]
        : [
            "Crop leaves are yellowing — please advise",
            "Let me share a field photo and location",
            "Fertilizer and spray schedule question",
          ];
    }
    return isKhmer
      ? [
          "សួរអំពីគណនី និងកាតសមាជិក",
          "ត្រូវការជំនួយបច្ចេកទេសលើផ្ទាំងគ្រប់គ្រង",
          "សំណួរអំពីការដំឡើងកម្រិតសេវាកម្ម",
        ]
      : [
          "Help with my account or membership",
          "Technical issue on my dashboard",
          "Billing or upgrade question",
        ];
  }, [isKhmer, target]);

  const selectedRecipientObj = useMemo(() => {
    if (!activeChannel?.recipients?.length) return null;
    if (recipientId) {
      return activeChannel.recipients.find((r) => r.id === recipientId) || null;
    }
    return (
      activeChannel.recipients.find((r) => r.id === activeChannel.defaultRecipientId) ||
      activeChannel.recipients[0] ||
      null
    );
  }, [activeChannel, recipientId]);

  const displayPartnerTitle =
    target === "expert"
      ? isKhmer
        ? "អ្នកជំនាញកសិកម្ម"
        : "Agricultural Expert"
      : isKhmer
        ? "អ្នកគ្រប់គ្រងប្រព័ន្ធ"
        : "Platform Admin";

  const displayPartnerSub =
    activeRecipientName ||
    selectedRecipientObj?.name ||
    (target === "expert"
      ? isKhmer
        ? "ក្រុមអ្នកជំនាញដំណាំ"
        : "Agronomy specialist desk"
      : isKhmer
        ? "ក្រុមគាំទ្រប្រព័ន្ធ"
        : "Support operations desk");

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a
          href={d.aiChatUrl}
          aria-label={isKhmer ? "សួរ AI ភ្លាមៗ" : "Ask AI Assistant"}
          title={isKhmer ? "សួរ AI ភ្លាមៗ" : "Ask AI Assistant"}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e3e6ed] bg-white px-2.5 text-xs font-semibold text-[#141824] shadow-sm transition hover:bg-[#f5f7fa] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6] dark:hover:bg-[#1c2233] sm:px-3.5"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          <span className="hidden sm:inline">{isKhmer ? "សួរ AI ភ្លាមៗ" : "Ask AI Assistant"}</span>
        </a>
      }
    >
      <div className="space-y-4">
        {/* Recipient Role Selector: Message Admin vs Message Expert */}
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          {(
            [
              {
                key: "admin" as const,
                Icon: ShieldCheck,
                title: isKhmer ? "ផ្ញើសារទៅអ្នកគ្រប់គ្រង (Admin)" : "Message to Admin",
                desc: isKhmer
                  ? "ជំនួយគណនី ការទូទាត់ និងបញ្ហាបច្ចេកទេស"
                  : "Account access, billing & platform support",
                accentActive:
                  "border-indigo-500/80 bg-indigo-50/80 ring-2 ring-indigo-500/15 dark:border-indigo-400/70 dark:bg-indigo-950/35",
                iconActive: "bg-indigo-600 text-white shadow-sm",
                iconIdle:
                  "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
                badgeBg: "bg-indigo-600 text-white",
              },
              {
                key: "expert" as const,
                Icon: Stethoscope,
                title: isKhmer ? "ផ្ញើសារទៅអ្នកជំនាញ (Expert)" : "Message to Expert",
                desc: isKhmer
                  ? "រោគវិនិច្ឆ័យដំណាំ សត្វល្អិត និងការថែទាំចម្ការ"
                  : "Crop diseases, pests & field care guidance",
                accentActive:
                  "border-emerald-500/80 bg-emerald-50/80 ring-2 ring-emerald-500/15 dark:border-emerald-400/70 dark:bg-emerald-950/35",
                iconActive: "bg-emerald-600 text-white shadow-sm",
                iconIdle:
                  "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
                badgeBg: "bg-emerald-600 text-white",
              },
            ] as const
          ).map((card) => {
            const summary = channels[card.key];
            const isSelected = target === card.key;
            const CardIcon = card.Icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => handleSelectChannel(card.key, null)}
                aria-pressed={isSelected}
                className={cn(
                  "group relative flex min-w-0 items-center gap-2 rounded-2xl border p-2.5 text-left transition-all sm:items-start sm:gap-3.5 sm:p-4",
                  isSelected
                    ? card.accentActive
                    : "border-[#e3e6ed] bg-white hover:border-[#cbd0dd] hover:bg-[#fafbfc] dark:border-[#2b3245] dark:bg-[#141824] dark:hover:border-[#3b445e] dark:hover:bg-[#181d2b]",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-11 sm:w-11",
                    isSelected ? card.iconActive : card.iconIdle,
                  )}
                >
                  <CardIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5 sm:items-center sm:gap-2">
                    <span className="line-clamp-2 text-[11.5px] font-bold leading-snug text-[#141824] dark:text-[#eff2f6] sm:line-clamp-none sm:text-sm">
                      {card.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                      {(summary?.unreadCount || 0) > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums sm:px-2 sm:text-[10px]",
                            card.badgeBg,
                          )}
                        >
                          {summary.unreadCount} {isKhmer ? "ថ្មី" : "new"}
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 hidden text-xs text-[#6e7891] dark:text-[#8a94ad] sm:block">
                    {card.desc}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-1.5 text-[10.5px] text-[#525b75] dark:text-[#9fa6bc] sm:mt-2 sm:gap-2 sm:text-[11px]">
                    <span className="truncate">
                      {summary?.lastMessage
                        ? summary.lastMessage
                        : summary?.available
                          ? isKhmer
                            ? `${summary.recipients.length} នាក់រួចរាល់សម្រាប់ជជែក`
                            : `${summary.recipients.length} staff online`
                          : isKhmer
                            ? "មិនទាន់មានសមាជិកសកម្មទេ"
                            : "No staff available"}
                    </span>
                    {summary?.lastTime && (
                      <span className="hidden shrink-0 text-[10px] text-[#8a94ad] sm:inline">
                        {formatChatShortDate(summary.lastTime)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Chat Workspace Card */}
        <section className="ai-surface flex h-[calc(100dvh-18.5rem-env(safe-area-inset-bottom))] min-h-[300px] max-h-[700px] min-w-0 flex-col overflow-hidden sm:h-[calc(100dvh-20.5rem)] sm:min-h-[480px]">
          {/* Active Thread Header + Optional Named Recipient Selector */}
          <div className="border-b border-[#e3e6ed] px-3.5 py-2.5 dark:border-[#2b3245] sm:px-5 sm:py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div
                  className={cn(
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    target === "expert"
                      ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
                  )}
                >
                  {target === "expert" ? (
                    <Stethoscope className="h-5 w-5" />
                  ) : (
                    <Headphones className="h-5 w-5" />
                  )}
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#141824]",
                      activeChannel?.available ? "bg-emerald-500" : "bg-amber-400",
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                      {displayPartnerTitle}
                    </h2>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        target === "expert"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300",
                      )}
                    >
                      {target === "expert" ? (isKhmer ? "អ្នកជំនាញ" : "Expert") : "Admin"}
                    </span>
                  </div>
                  <p className="truncate text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                    {partnerTyping
                      ? isKhmer
                        ? `${displayPartnerTitle} កំពុងវាយអក្សរ...`
                        : `${displayPartnerTitle} is typing...`
                      : `${displayPartnerSub} · ${tabVisible ? (isKhmer ? "តភ្ជាប់ផ្ទាល់" : "Live sync active") : isKhmer ? "ផ្អាក" : "Paused"}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSoundOn((prev) => !prev)}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                    soundOn
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300"
                      : "border-[#cbd0dd] bg-[#f5f7fa] text-[#8a94ad] dark:border-[#373e53] dark:bg-[#181d2b]",
                  )}
                  title={
                    soundOn
                      ? isKhmer
                        ? "បិទសំឡេងជូនដំណឹង"
                        : "Mute sound"
                      : isKhmer
                        ? "បើកសំឡេងជូនដំណឹង"
                        : "Unmute sound"
                  }
                  aria-label="Toggle notification sound"
                >
                  {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void loadHistory(target, recipientId)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] text-[#525b75] transition hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc]"
                  title={isKhmer ? "ផ្ទុកសារឡើងវិញ" : "Refresh messages"}
                  aria-label="Refresh messages"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Specific Staff Member Selector Pills */}
            {activeChannel?.recipients && activeChannel.recipients.length > 0 && (
              <div className="mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>{isKhmer ? "ផ្ញើទៅ៖" : "Recipient:"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectChannel(target, null)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                    recipientId === null
                      ? target === "expert"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-indigo-600 text-white shadow-sm"
                      : "border border-[#e3e6ed] bg-[#f5f7fa] text-[#525b75] hover:bg-[#eff2f6] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#9fa6bc]",
                  )}
                >
                  {target === "expert"
                    ? isKhmer
                      ? "អ្នកជំនាញណាមួយដែលទំនេរ"
                      : "Any Available Expert"
                    : isKhmer
                      ? "អ្នកគ្រប់គ្រងណាមួយ"
                      : "Any Admin"}
                </button>
                {activeChannel.recipients.map((person) => {
                  const activePerson = recipientId === person.id;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectChannel(target, person.id)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                        activePerson
                          ? target === "expert"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-indigo-600 text-white shadow-sm"
                          : "border border-[#e3e6ed] bg-white text-[#525b75] hover:bg-[#f5f7fa] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#9fa6bc]",
                      )}
                    >
                      {person.avatarUrl && (
                        <img
                          src={person.avatarUrl}
                          alt={person.name}
                          className="h-4 w-4 rounded-full object-cover"
                        />
                      )}
                      <span>{person.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Messages Viewport */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={threadScrollRef}
              onScroll={() => {
                if (isNearBottom()) setHasUnseenBelow(false);
              }}
              className="phoenix-scroll flex-1 space-y-3 overflow-y-auto bg-[#f5f7fa]/55 p-4 dark:bg-[#0f111a]/45 sm:p-5"
            >
              {loading ? (
                <div className="flex h-full items-center justify-center gap-2 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  <span>{isKhmer ? "កំពុងភ្ជាប់សារផ្ទាល់..." : "Loading conversation..."}</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl",
                      target === "expert"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
                    )}
                  >
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                    {target === "expert"
                      ? isKhmer
                        ? "ចាប់ផ្តើមជជែកជាមួយអ្នកជំនាញកសិកម្ម"
                        : "Start chatting with an Agricultural Expert"
                      : isKhmer
                        ? "ចាប់ផ្តើមជជែកជាមួយអ្នកគ្រប់គ្រងប្រព័ន្ធ"
                        : "Start chatting with Platform Admin"}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#6e7891] dark:text-[#8a94ad]">
                    {target === "expert"
                      ? isKhmer
                        ? "ផ្ញើសារ រូបភាពដំណាំ សំឡេង ឬទីតាំង GPS ចម្ការរបស់អ្នក។"
                        : "Send text, crop photos, voice notes, or your farm GPS location."
                      : isKhmer
                        ? "សួរអំពីគណនី កាតសមាជិក ការទូទាត់ ឬជំនួយបច្ចេកទេស។"
                        : "Ask about your account, member card, billing, or technical issues."}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessagePayload({ message: prompt })}
                        className="rounded-full border border-[#e3e6ed] bg-white px-3 py-1.5 text-xs font-medium text-[#31374a] shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6] dark:hover:border-emerald-700"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const mine = m.sender_id === d.currentUserId;
                  const safe = normalizeSupportMessageAttachment(m);
                  const dayLabel = formatChatDayGroup(m.created_at, isKhmer);
                  const prevDayLabel =
                    idx > 0 ? formatChatDayGroup(messages[idx - 1].created_at, isKhmer) : null;
                  const showDivider = idx === 0 || dayLabel !== prevDayLabel;

                  return (
                    <React.Fragment key={m.id}>
                      {showDivider && (
                        <div className="flex items-center justify-center py-1.5">
                          <span className="rounded-full border border-[#e3e6ed] bg-white px-3 py-0.5 text-[10.5px] font-semibold text-[#6e7891] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#8a94ad]">
                            {dayLabel}
                          </span>
                        </div>
                      )}

                      <div className={cn("flex min-w-0 flex-col", mine ? "items-end" : "items-start")}>
                        <div
                          className={cn(
                            "max-w-[88%] min-w-0 break-words whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm sm:max-w-[82%] sm:px-4",
                            mine
                              ? target === "expert"
                                ? "rounded-br-md bg-emerald-600 text-white"
                                : "rounded-br-md bg-indigo-600 text-white"
                              : "rounded-bl-md border border-[#e3e6ed] bg-white text-[#141824] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6]",
                            m.optimistic && "opacity-75",
                          )}
                        >
                          {safe.kind === "image" && safe.url && (
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(safe.url!)}
                              className="mb-2 block max-w-full overflow-hidden rounded-lg focus:outline-none"
                            >
                              <img
                                src={safe.url}
                                alt="Chat attachment"
                                className="max-h-56 w-full rounded-lg object-cover transition hover:opacity-95"
                              />
                            </button>
                          )}

                          {safe.kind === "audio" && safe.url && (
                            <audio controls src={safe.url} className="mb-1.5 h-8 w-56 max-w-full" />
                          )}

                          {safe.kind === "location" && safe.location && (
                            <a
                              href={safe.location.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium underline underline-offset-2",
                                mine
                                  ? "bg-white/15 text-white hover:bg-white/25"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300",
                              )}
                            >
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 break-words">{safe.location.label}</span>
                            </a>
                          )}

                          {safe.text && <p className="break-words">{safe.text}</p>}
                        </div>

                        <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-[#8a94ad]">
                          <span>{formatChatClock(m.created_at)}</span>
                          {mine &&
                            (m.is_read ? (
                              <CheckCheck className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Check className="h-3 w-3 opacity-70" />
                            ))}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {partnerTyping && (
                <div className="flex items-center gap-2 px-1">
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
                  </span>
                  <span className="text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer
                      ? `${displayPartnerTitle} កំពុងវាយអក្សរ...`
                      : `${displayPartnerTitle} is typing...`}
                  </span>
                </div>
              )}
            </div>

            {hasUnseenBelow && (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#141824] px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#22283a] dark:bg-white dark:text-[#141824]"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សារថ្មីខាងក្រោម" : "New messages below"}</span>
              </button>
            )}
          </div>

          {/* Location Picker Drawer */}
          {locationOpen && (
            <div className="border-t border-[#e3e6ed] bg-[#f9fafc] px-3.5 py-2.5 dark:border-[#2b3245] dark:bg-[#111521] sm:px-4 sm:py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[200px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="search"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder={
                      isKhmer ? "ស្វែងរកខេត្ត ឬទីតាំង..." : "Search Cambodia province or commune..."
                    }
                    className="ai-input h-8 w-full pl-10 pr-3 text-xs"
                  />
                </div>
                <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto sm:justify-start">
                  <button
                    type="button"
                    disabled={locationBusy || sending}
                    onClick={() => void handleShareGpsLocation()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {locationBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="h-3.5 w-3.5" />
                    )}
                    <span>{isKhmer ? "ផ្ញើ GPS ឥឡូវ" : "Send My GPS"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e6ed] bg-white text-[#6e7891] dark:border-[#2b3245] dark:bg-[#141824]"
                    aria-label="Close location picker"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {locationResults.length > 0 && (
                <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {locationResults.map((item) => (
                    <button
                      key={`${item.name}-${item.latitude}-${item.longitude}`}
                      type="button"
                      onClick={() => {
                        setLocationOpen(false);
                        void sendMessagePayload({
                          message: `📍 Location: ${item.name}`,
                          attachment_url: `${item.latitude.toFixed(6)},${item.longitude.toFixed(6)}`,
                          attachment_type: "location",
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[#e3e6ed] bg-white px-2.5 py-1 text-[11px] font-medium text-[#31374a] transition hover:border-emerald-400 hover:text-emerald-700 dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6]"
                    >
                      <MapPin className="h-3 w-3 text-emerald-500" />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Staged Attachment Preview */}
          {stagedAttachment && (
            <div className="flex items-center justify-between gap-3 border-t border-[#e3e6ed] bg-[#f9fafc] px-4 py-2.5 dark:border-[#2b3245] dark:bg-[#111521]">
              <div className="flex min-w-0 items-center gap-2.5">
                {stagedAttachment.kind === "image" ? (
                  <img
                    src={stagedAttachment.previewUrl}
                    alt="Preview"
                    className="h-11 w-11 rounded-lg object-cover ring-1 ring-black/10"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                    <FileAudio className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#141824] dark:text-[#eff2f6]">
                    {stagedAttachment.file.name}
                  </p>
                  <p className="text-[11px] text-[#6e7891]">
                    {stagedAttachment.kind === "audio"
                      ? isKhmer
                        ? "សំឡេងត្រៀមផ្ញើ"
                        : "Voice message ready"
                      : isKhmer
                        ? "រូបភាពត្រៀមផ្ញើ"
                        : "Image ready to send"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearStagedAttachment}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#6e7891] hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={handleComposerSubmit}
            className="flex flex-wrap items-center gap-2 border-t border-[#e3e6ed] bg-white px-3 py-2.5 dark:border-[#2b3245] dark:bg-[#141824] sm:flex-nowrap sm:px-4 sm:py-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleFilePick(file);
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || recording}
              title={isKhmer ? "ភ្ជាប់រូបភាព" : "Attach photo"}
              aria-label="Attach photo"
              className="order-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] text-[#525b75] transition hover:bg-[#eff2f6] disabled:opacity-50 dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#9fa6bc] sm:order-none"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => void toggleRecording()}
              disabled={sending}
              title={recording ? (isKhmer ? "បញ្ឈប់ការថត" : "Stop recording") : isKhmer ? "ថតសំឡេង" : "Voice message"}
              aria-label={recording ? "Stop recording" : "Record voice message"}
              className={cn(
                "order-2 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition disabled:opacity-50 sm:order-none",
                recording
                  ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  : "border-[#e3e6ed] bg-[#f5f7fa] text-[#525b75] hover:bg-[#eff2f6] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#9fa6bc]",
              )}
            >
              {recording ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span className="tabular-nums">{formatRecordingSeconds(recordSeconds)}</span>
                </>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setLocationOpen((prev) => !prev)}
              disabled={sending || recording}
              title={isKhmer ? "ចែករំលែកទីតាំង" : "Share location"}
              aria-label="Share location"
              className={cn(
                "order-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50 sm:order-none",
                locationOpen
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-[#e3e6ed] bg-[#f5f7fa] text-[#525b75] hover:bg-[#eff2f6] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#9fa6bc]",
              )}
            >
              <MapPin className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value.trim()) emitTyping();
              }}
              placeholder={
                target === "expert"
                  ? isKhmer
                    ? "សរសេរសារទៅអ្នកជំនាញ..."
                    : "Write a message to Agricultural Expert..."
                  : isKhmer
                    ? "សរសេរសារទៅអ្នកគ្រប់គ្រង..."
                    : "Write a message to Platform Admin..."
              }
              className="ai-input order-1 h-9 w-full min-w-0 flex-none px-3 text-sm sm:order-none sm:w-auto sm:flex-1 sm:px-3.5"
            />

            <button
              type="submit"
              disabled={sending || (!draft.trim() && !stagedAttachment)}
              aria-label="Send message"
              className={cn(
                "order-2 ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50 sm:order-none sm:ml-0 sm:px-4",
                target === "expert"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700",
              )}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{isKhmer ? "ផ្ញើ" : "Send"}</span>
            </button>
          </form>
        </section>
      </div>

      {/* Portal Image Lightbox */}
      {lightboxUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              aria-label="Close preview"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Full chat attachment"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </WorkspaceShell>
  );
}
