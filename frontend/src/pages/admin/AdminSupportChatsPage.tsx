import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCheck,
  FileAudio,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { requestJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import {
  normalizeSupportMessageAttachment,
  resolveLocationDraftCoords,
  validateAttachmentFile,
} from "@/lib/supportChatSecurity";
import {
  formatChatClock,
  formatChatDayGroup,
  formatChatShortDate,
  formatRecordingSeconds,
  mergeSupportMessages,
  playIncomingMessageChime,
  type LiveEnvelopeResponse,
  type LiveSupportMsg,
} from "@/lib/liveSupportHelpers";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminStatusBadge } from "@/components/admin/AdminPrimitives";

interface SupportUser {
  id: number;
  name: string;
  username: string;
  role?: string;
  avatarUrl?: string;
  unreadCount: number;
  lastMessage?: string;
  lastTime?: string | null;
  isTyping?: boolean;
}

interface AdminSupportChatsData {
  currentUserId: number;
  endpoints: {
    conversations: string;
    messagesPrefix: string;
    upload: string;
    location: string;
  };
  users: SupportUser[];
}

interface ConversationsApiItem {
  id: number;
  name: string;
  username: string;
  role?: string;
  avatar_url?: string;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
  is_typing?: boolean;
}

interface StagedAttachment {
  file: File;
  kind: "image" | "audio";
  previewUrl: string;
}

function getRoleBadgeClasses(role?: string): string {
  const r = (role || "").toLowerCase();
  if (r === "farmer") {
    return "border-[#90d67f]/80 bg-[#d9fbd0]/75 text-[#1c6c09] dark:border-[#25b003]/35 dark:bg-[#25b003]/15 dark:text-[#90ee7a]";
  }
  if (r === "expert") {
    return "border-[#adc5ff]/80 bg-[#e5edff] text-[#004dff] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]";
  }
  return "border-[#cbd0dd] bg-[#eff2f6] text-[#525b75] dark:border-[#373e53] dark:bg-[#1e2436] dark:text-[#9fa6bc]";
}

export default function AdminSupportChatsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminSupportChatsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [users, setUsers] = useState<SupportUser[]>(d.users || []);
  const [activeId, setActiveId] = useState<number | null>(d.users[0]?.id ?? null);
  const [mobileShowThread, setMobileShowThread] = useState<boolean>(false);
  const [inboxQuery, setInboxQuery] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread">("all");

  const [messages, setMessages] = useState<LiveSupportMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tabVisible, setTabVisible] = useState<boolean>(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true,
  );
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [hasUnseenBelow, setHasUnseenBelow] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);
  const lastPersistedIdRef = useRef<number>(0);
  const prevTotalUnreadRef = useRef<number>(
    (d.users || []).reduce((acc, u) => acc + (u.unreadCount || 0), 0),
  );
  const activeIdRef = useRef<number | null>(activeId);
  activeIdRef.current = activeId;

  const isNearBottom = () => {
    const el = threadScrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    threadEndRef.current?.scrollIntoView({ behavior });
    setHasUnseenBelow(false);
  };

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

  useEffect(() => {
    const onVisibility = () => {
      setTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const resp = await fetch(d.endpoints.conversations, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!resp.ok) return;
      const json = (await resp.json()) as {
        conversations?: ConversationsApiItem[];
        total_unread?: number;
      };
      const items = json.conversations || [];
      const nextUnread = Number(json.total_unread || 0);
      if (soundEnabled && nextUnread > prevTotalUnreadRef.current) {
        playIncomingMessageChime();
      }
      prevTotalUnreadRef.current = nextUnread;

      setUsers(
        items.map((item) => ({
          id: item.id,
          name: item.name,
          username: item.username,
          role: item.role,
          avatarUrl: item.avatar_url,
          unreadCount: item.unread_count,
          lastMessage: item.last_message,
          lastTime: item.last_message_time,
          isTyping: item.is_typing,
        })),
      );
    } catch {
      // Ignore transient network errors during background inbox sync
    }
  }, [d.endpoints.conversations, soundEnabled]);

  const loadFullThread = useCallback(
    async (partnerId: number) => {
      setLoading(true);
      setPartnerTyping(false);
      lastPersistedIdRef.current = 0;
      try {
        const resp = await fetch(
          `${d.endpoints.messagesPrefix}${partnerId}/messages?envelope=1`,
          { headers: { Accept: "application/json" }, credentials: "include" },
        );
        if (!resp.ok) return;
        const json = (await resp.json()) as LiveEnvelopeResponse;
        if (activeIdRef.current !== partnerId) return;
        const list = json.messages || [];
        const merged = mergeSupportMessages([], list, json.read_ids || []);
        setMessages(merged);
        setPartnerTyping(Boolean(json.partner_typing));
        lastPersistedIdRef.current = list.length ? list[list.length - 1].id : 0;
        setUsers((prev) => prev.map((u) => (u.id === partnerId ? { ...u, unreadCount: 0 } : u)));
        window.requestAnimationFrame(() => scrollToBottom("auto"));
      } catch {
        pushToast("danger", isKhmer ? "មិនអាចផ្ទុកសារបានទេ។" : "Could not load conversation messages.");
      } finally {
        if (activeIdRef.current === partnerId) {
          setLoading(false);
        }
      }
    },
    [d.endpoints.messagesPrefix, isKhmer, pushToast],
  );

  const pollDeltaMessages = useCallback(
    async (partnerId: number) => {
      try {
        const after = lastPersistedIdRef.current;
        const resp = await fetch(
          `${d.endpoints.messagesPrefix}${partnerId}/messages?envelope=1&after_id=${after}`,
          { headers: { Accept: "application/json" }, credentials: "include" },
        );
        if (!resp.ok) return;
        const json = (await resp.json()) as LiveEnvelopeResponse;
        if (activeIdRef.current !== partnerId) return;

        const incoming = json.messages || [];
        const readIds = json.read_ids || [];
        setPartnerTyping(Boolean(json.partner_typing));

        if (incoming.length > 0 || readIds.length > 0) {
          const nearBottom = isNearBottom();
          const hasPartnerMsg = incoming.some((m) => m.sender_id !== d.currentUserId);
          if (hasPartnerMsg && soundEnabled) {
            playIncomingMessageChime();
          }
          if (incoming.length > 0) {
            lastPersistedIdRef.current = Math.max(
              lastPersistedIdRef.current,
              incoming[incoming.length - 1].id,
            );
          }
          setMessages((prev) => mergeSupportMessages(prev, incoming, readIds));
          if (incoming.length > 0) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === partnerId
                  ? {
                      ...u,
                      unreadCount: 0,
                      lastMessage: incoming[incoming.length - 1].message || "[attachment]",
                      lastTime: incoming[incoming.length - 1].created_at,
                    }
                  : u,
              ),
            );
            if (nearBottom) {
              window.requestAnimationFrame(() => scrollToBottom("smooth"));
            } else if (hasPartnerMsg) {
              setHasUnseenBelow(true);
            }
          }
        }
      } catch {
        // Ignore transient sync error
      }
    },
    [d.currentUserId, d.endpoints.messagesPrefix, soundEnabled],
  );

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeId) {
      clearStagedAttachment();
      void loadFullThread(activeId);
    } else {
      setMessages([]);
    }
  }, [activeId, loadFullThread, clearStagedAttachment]);

  useEffect(() => {
    if (!tabVisible) return undefined;
    const convTimer = window.setInterval(() => {
      void fetchConversations();
    }, 4000);
    const threadTimer = window.setInterval(() => {
      if (activeIdRef.current) {
        void pollDeltaMessages(activeIdRef.current);
      }
    }, 2000);
    return () => {
      window.clearInterval(convTimer);
      window.clearInterval(threadTimer);
    };
  }, [tabVisible, fetchConversations, pollDeltaMessages]);

  const emitTypingHeartbeat = () => {
    if (!activeId) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 2500) return;
    lastTypingSentAtRef.current = now;
    void fetch(`${d.endpoints.messagesPrefix}${activeId}/typing`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRFToken": bootstrap.csrfToken },
    }).catch(() => {});
  };

  const sendMessagePayload = async (payload: {
    message?: string;
    attachment_url?: string;
    attachment_type?: string;
  }) => {
    if (!activeId) return;
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
        `${d.endpoints.messagesPrefix}${activeId}/send`,
        "POST",
        bootstrap.csrfToken,
        payload,
      );
      const saved = res.data?.message;
      setMessages((prev) => {
        const withoutOpt = prev.filter((item) => item.id !== tempId);
        return saved ? mergeSupportMessages(withoutOpt, [saved]) : withoutOpt;
      });
      if (saved) {
        lastPersistedIdRef.current = Math.max(lastPersistedIdRef.current, saved.id);
      }
      void fetchConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== tempId));
      pushToast("danger", err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleComposerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || sending) return;
    const text = draft.trim();
    if (!text && !stagedAttachment) return;

    if (stagedAttachment) {
      const att = stagedAttachment;
      const formData = new FormData();
      formData.append("file", att.file);
      setSending(true);
      try {
        const resp = await fetch(d.endpoints.upload, {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRFToken": bootstrap.csrfToken },
          body: formData,
        });
        const json = (await resp.json()) as { url?: string; mime_type?: string; error?: string };
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
      pushToast("warning", isKhmer ? "កម្មវិធីរុករកមិនគាំទ្រការថតសំឡេងទេ។" : "Voice recording is not supported in this browser.");
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
      pushToast("warning", isKhmer ? "មិនអាចបើកមីក្រូហ្វូនបានទេ។" : "Microphone permission denied or unavailable.");
    }
  };

  const handleShareLocation = async () => {
    if (!activeId || sending) return;
    const resolved = await resolveLocationDraftCoords({
      geolocation: typeof navigator !== "undefined" ? navigator.geolocation : null,
    });
    await sendMessagePayload({
      message: resolved.label ? `📍 Location: ${resolved.label}` : "",
      attachment_url: resolved.coordString,
      attachment_type: "location",
    });
  };

  const totalUnread = useMemo(
    () => users.reduce((sum, u) => sum + (u.unreadCount || 0), 0),
    [users],
  );

  const visibleUsers = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (inboxFilter === "unread" && !(u.unreadCount > 0)) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.lastMessage || "").toLowerCase().includes(q)
      );
    });
  }, [users, inboxQuery, inboxFilter]);

  const activeUser = users.find((u) => u.id === activeId);

  const quickReplies = isKhmer
    ? [
        "កំពុងពិនិត្យជូនអ្នកឥឡូវនេះ...",
        "សូមផ្ញើរូបភាពស្លឹកដំណាំឱ្យច្បាស់បន្តិច",
        "បញ្ហាត្រូវបានដោះស្រាយរួចរាល់!",
      ]
    : [
        "Checking on this for you now.",
        "Could you share a clear photo of the leaf?",
        "This issue has been resolved.",
      ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid h-[calc(100vh-13.5rem)] min-h-[560px] max-h-[780px] gap-5 lg:grid-cols-12">
        {/* Left Column: Live Conversations Sidebar */}
        <section
          className={cn(
            "ai-surface flex flex-col overflow-hidden lg:col-span-4",
            mobileShowThread ? "hidden lg:flex" : "flex",
          )}
        >
          {/* Sidebar Header */}
          <div className="border-b border-[#e3e6ed] p-4 dark:border-[#2b3245]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {isKhmer ? "ប្រអប់សារ" : "Conversations"}
                </h2>
                {totalUnread > 0 && (
                  <span className="rounded-full bg-[#3874ff] px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
                    {totalUnread}
                  </span>
                )}
              </div>
              <AdminStatusBadge tone={tabVisible ? "emerald" : "amber"} pulse={tabVisible}>
                {tabVisible ? (isKhmer ? "ផ្ទាល់" : "Live Sync") : isKhmer ? "ផ្អាក" : "Paused"}
              </AdminStatusBadge>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
              <input
                type="search"
                value={inboxQuery}
                onChange={(e) => setInboxQuery(e.target.value)}
                placeholder={isKhmer ? "ស្វែងរកឈ្មោះ ឬសារ..." : "Search member or message..."}
                className="ai-input h-8 py-1 pl-9 pr-8 text-xs [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              />
              {inboxQuery && (
                <button
                  type="button"
                  onClick={() => setInboxQuery("")}
                  aria-label="Clear chat search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              {(["all", "unread"] as const).map((tab) => {
                const active = inboxFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInboxFilter(tab)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-[#e5edff] text-[#004dff] ring-1 ring-[#3874ff]/25 dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                        : "text-[#6e7891] hover:bg-[#eff2f6] dark:text-[#8a94ad] dark:hover:bg-[#1e2436]",
                    )}
                  >
                    {tab === "all"
                      ? isKhmer
                        ? `ទាំងអស់ (${users.length})`
                        : `All (${users.length})`
                      : isKhmer
                        ? `មិនទាន់អាន (${totalUnread})`
                        : `Unread (${totalUnread})`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversations List */}
          <div className="phoenix-scroll flex-1 divide-y divide-[#e3e6ed]/80 overflow-y-auto dark:divide-[#2b3245]">
            {visibleUsers.length === 0 ? (
              <div className="p-5">
                <AdminEmptyState
                  icon={<MessageSquare className="h-5 w-5" />}
                  title={
                    inboxFilter === "unread"
                      ? isKhmer
                        ? "មិនមានសារមិនទាន់អានទេ"
                        : "All caught up!"
                      : isKhmer
                        ? "មិនមានការសន្ទនាទេ"
                        : "No support chats match"
                  }
                />
              </div>
            ) : (
              visibleUsers.map((u) => {
                const isActive = activeId === u.id;
                const initial = (u.name || "U").slice(0, 1).toUpperCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setActiveId(u.id);
                      setMobileShowThread(true);
                    }}
                    className={cn(
                      "relative flex w-full items-start justify-between gap-2.5 border-l-[3px] border-transparent px-4 py-3 text-left text-xs transition-colors",
                      isActive
                        ? "border-l-[#3874ff] bg-[#e5edff]/55 dark:bg-[#3874ff]/15"
                        : "hover:bg-[#f5f7fa] dark:hover:bg-[#181d2b]",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="relative shrink-0">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                            className="h-9 w-9 rounded-xl border border-[#cbd0dd] object-cover dark:border-[#373e53]"
                          />
                        ) : null}
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl font-display text-xs font-extrabold",
                            u.avatarUrl ? "hidden" : "flex",
                            isActive
                              ? "bg-[#3874ff] text-white"
                              : "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]",
                          )}
                        >
                          {initial}
                        </span>
                        {u.unreadCount > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#3874ff] ring-2 ring-white dark:ring-[#141824]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {u.name}
                            </p>
                            {u.role && (
                              <span
                                className={cn(
                                  "shrink-0 rounded border px-1 py-0.5 text-[9px] font-bold uppercase",
                                  getRoleBadgeClasses(u.role),
                                )}
                              >
                                {u.role}
                              </span>
                            )}
                          </div>
                          {u.lastTime && (
                            <span className="shrink-0 font-mono text-[10px] text-[#8a94ad]">
                              {formatChatShortDate(u.lastTime)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          {u.isTyping ? (
                            <span className="font-semibold text-[#3874ff] dark:text-[#85a9ff]">
                              {isKhmer ? "កំពុងវាយសារ..." : "Typing..."}
                            </span>
                          ) : (
                            u.lastMessage || `@${u.username}`
                          )}
                        </p>
                      </div>
                    </div>

                    {u.unreadCount > 0 && (
                      <span className="mt-1 shrink-0 rounded-full bg-[#3874ff] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                        {u.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Active Live Chat Thread */}
        <section
          className={cn(
            "ai-surface relative flex flex-col overflow-hidden lg:col-span-8",
            mobileShowThread ? "flex" : "hidden lg:flex",
          )}
        >
          {/* Thread Header */}
          <div className="flex items-center justify-between gap-3 border-b border-[#e3e6ed] px-4 py-3 dark:border-[#2b3245] sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileShowThread(false)}
                aria-label="Back to conversations"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#cbd0dd] text-[#525b75] hover:bg-[#eff2f6] dark:border-[#373e53] dark:text-[#9fa6bc] lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e5edff] font-display text-xs font-extrabold text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                {activeUser ? (activeUser.name || "U").slice(0, 1).toUpperCase() : <MessageSquare className="h-4 w-4" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                    {activeUser
                      ? activeUser.name
                      : isKhmer
                        ? "ជ្រើសរើសការសន្ទនា"
                        : "Select a conversation"}
                  </h3>
                  {activeUser?.role && (
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[9.5px] font-bold uppercase",
                        getRoleBadgeClasses(activeUser.role),
                      )}
                    >
                      {activeUser.role}
                    </span>
                  )}
                </div>
                {activeUser && (
                  <p className="truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {partnerTyping ? (
                      <span className="font-semibold text-[#3874ff] dark:text-[#85a9ff]">
                        {isKhmer ? "កំពុងវាយសារ..." : "Typing now..."}
                      </span>
                    ) : (
                      `@${activeUser.username}`
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSoundEnabled((s) => !s)}
                title={soundEnabled ? "Mute notification sound" : "Enable notification sound"}
                aria-label="Toggle notification sound"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] text-[#525b75] transition hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc]"
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-[#3874ff]" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
              {activeId && (
                <button
                  type="button"
                  onClick={() => void pollDeltaMessages(activeId)}
                  title="Sync now"
                  aria-label="Sync messages"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] text-[#525b75] transition hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              {activeUser && (
                <AdminStatusBadge tone="emerald" pulse>
                  {isKhmer ? "កំពុងភ្ជាប់" : "Connected"}
                </AdminStatusBadge>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={threadScrollRef}
              onScroll={() => {
                if (isNearBottom()) setHasUnseenBelow(false);
              }}
              className="phoenix-scroll flex-1 space-y-3 overflow-y-auto bg-[#f5f7fa]/45 p-5 dark:bg-[#0f111a]/45"
            >
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-[#6e7891] dark:text-[#8a94ad]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#3874ff]" />
                <span>{isKhmer ? "កំពុងផ្ទុកសារ..." : "Syncing conversation..."}</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <AdminEmptyState
                  icon={<MessageSquare className="h-5 w-5" />}
                  title={isKhmer ? "មិនទាន់មានសារនៅឡើយទេ" : "No messages in this conversation yet"}
                  description={
                    isKhmer
                      ? "សូមវាយសារ ផ្ញើរូបភាព ថតសំឡេង ឬចែករំលែកទីតាំងខាងក្រោម។"
                      : "Write a reply, record a voice note, or attach a photo below to start."
                  }
                />
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
                      <div className="flex items-center justify-center py-2">
                        <span className="rounded-full border border-[#e3e6ed] bg-white px-3 py-0.5 text-[10.5px] font-semibold text-[#6e7891] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#8a94ad]">
                          {dayLabel}
                        </span>
                      </div>
                    )}

                    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm",
                          mine
                            ? "rounded-br-md bg-[#3874ff] text-white"
                            : "rounded-bl-md border border-[#e3e6ed] bg-white text-[#141824] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6]",
                          m.optimistic && "opacity-75",
                        )}
                      >
                        {safe.kind === "image" && safe.url && (
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(safe.url!)}
                            className="mb-2 block overflow-hidden rounded-lg focus:outline-none"
                          >
                            <img
                              src={safe.url}
                              alt="Chat attachment"
                              className="max-h-52 rounded-lg object-cover transition hover:opacity-95"
                            />
                          </button>
                        )}
                        {safe.kind === "audio" && safe.url && (
                          <audio controls preload="metadata" src={safe.url} className="mb-2 max-w-full" />
                        )}
                        {safe.kind === "location" && safe.location && (
                          <a
                            href={safe.location.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "mb-1.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold underline",
                              mine
                                ? "bg-white/15 text-white"
                                : "bg-[#e5edff]/70 text-[#004dff] dark:bg-[#3874ff]/15 dark:text-[#85a9ff]",
                            )}
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>{safe.location.label}</span>
                          </a>
                        )}
                        {safe.text}
                      </div>

                      <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-[#8a94ad]">
                        <span>{formatChatClock(m.created_at)}</span>
                        {mine && (
                          <span title={m.optimistic ? "Sending" : m.is_read ? "Read" : "Sent"}>
                            {m.optimistic ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : m.is_read ? (
                              <CheckCheck className="h-3.5 w-3.5 text-[#3874ff]" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-[#8a94ad]" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}

            {partnerTyping && (
              <div className="flex items-start">
                <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#e3e6ed] bg-white px-3.5 py-2.5 dark:border-[#2b3245] dark:bg-[#141824]">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3874ff]" />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3874ff]"
                    style={{ animationDelay: "120ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3874ff]"
                    style={{ animationDelay: "240ms" }}
                  />
                </div>
              </div>
            )}

            <div ref={threadEndRef} />
            </div>

            {hasUnseenBelow && (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#3874ff] px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-[#004dff]"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>{isKhmer ? "សារថ្មី" : "New messages"}</span>
              </button>
            )}
          </div>

          {/* Quick Canned Reply Pills */}
          {activeId && (
            <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[#e3e6ed] bg-[#f5f7fa]/75 px-4 py-2 dark:border-[#2b3245] dark:bg-[#0f111a]/75 phoenix-scroll">
              {quickReplies.map((snippet) => (
                <button
                  key={snippet}
                  type="button"
                  onClick={() => setDraft(snippet)}
                  className="shrink-0 rounded-full border border-[#cbd0dd] bg-white px-2.5 py-1 text-[11px] font-medium text-[#525b75] transition hover:border-[#3874ff]/45 hover:text-[#004dff] dark:border-[#373e53] dark:bg-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#85a9ff]"
                >
                  {snippet}
                </button>
              ))}
            </div>
          )}

          {/* Staged Attachment Preview */}
          {stagedAttachment && (
            <div className="flex items-center justify-between gap-3 border-t border-[#e3e6ed] bg-[#e5edff]/40 px-4 py-2.5 dark:border-[#2b3245] dark:bg-[#3874ff]/10">
              <div className="flex min-w-0 items-center gap-3">
                {stagedAttachment.kind === "image" ? (
                  <img
                    src={stagedAttachment.previewUrl}
                    alt="Preview"
                    className="h-12 w-12 rounded-lg border border-[#cbd0dd] object-cover"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <FileAudio className="h-4 w-4 text-[#3874ff]" />
                    <audio controls src={stagedAttachment.previewUrl} className="h-8 max-w-[220px]" />
                  </div>
                )}
                <div className="min-w-0 text-xs">
                  <p className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                    {stagedAttachment.file.name}
                  </p>
                  <p className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {stagedAttachment.kind === "image"
                      ? isKhmer
                        ? "រូបភាពរួចរាល់សម្រាប់ផ្ញើ"
                        : "Photo ready to send"
                      : isKhmer
                        ? "សារសំឡេងរួចរាល់"
                        : "Voice message ready"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearStagedAttachment}
                className="rounded-lg p-1.5 text-[#525b75] hover:bg-white dark:text-[#9fa6bc] dark:hover:bg-[#1e2436]"
                aria-label="Discard attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Rich Real-Time Composer */}
          <form
            onSubmit={handleComposerSubmit}
            className="flex items-end gap-2 border-t border-[#e3e6ed] bg-white p-3.5 dark:border-[#2b3245] dark:bg-[#141824]"
          >
            <label
              className="ai-btn-secondary h-9 cursor-pointer px-2.5 text-xs"
              title={isKhmer ? "ភ្ជាប់រូបភាព" : "Attach photo"}
            >
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFilePick(f);
                  e.target.value = "";
                }}
              />
            </label>

            <button
              type="button"
              disabled={!activeId}
              onClick={toggleRecording}
              title={recording ? "Stop recording" : "Record voice message"}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition",
                recording
                  ? "border-[#fa3b1d] bg-[#ffe0db] text-[#b81800] dark:bg-[#492226] dark:text-[#ff9c8c]"
                  : "border-[#cbd0dd] bg-white text-[#31374a] hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6]",
              )}
            >
              {recording ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span className="font-mono text-[11px]">{formatRecordingSeconds(recordSeconds)}</span>
                </>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              disabled={!activeId || sending}
              onClick={handleShareLocation}
              className="ai-btn-secondary h-9 px-2.5 text-xs"
              title={isKhmer ? "ចែករំលែកទីតាំង" : "Share location"}
            >
              <MapPin className="h-4 w-4" />
            </button>

            <textarea
              rows={1}
              value={draft}
              disabled={!activeId || sending}
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value.trim()) emitTypingHeartbeat();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleComposerSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder={
                isKhmer
                  ? "វាយសារឆ្លើយតប... (ចុច Enter ដើម្បីផ្ញើ)"
                  : "Write a message... (Enter to send, Shift+Enter for new line)"
              }
              className="ai-input max-h-28 min-h-[36px] flex-1 resize-none py-2 text-xs leading-relaxed"
            />

            <button
              type="submit"
              disabled={!activeId || sending || (!draft.trim() && !stagedAttachment)}
              className="ai-btn-primary h-9 shrink-0 px-4 text-xs"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>{isKhmer ? "ផ្ញើ" : "Send"}</span>
            </button>
          </form>
        </section>
      </div>

      {/* Inline Photo Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f111a]/85 p-6 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close image preview"
            className="absolute right-5 top-5 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full resolution attachment"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-xl border border-white/15 object-contain shadow-2xl"
          />
        </div>
      )}
    </WorkspaceShell>
  );
}
