import React, { useEffect, useState } from "react";
import { Loader2, MapPin, MessageSquare, Paperclip, Send, User } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminStatusBadge } from "@/components/admin/AdminPrimitives";

interface SupportUser {
  id: number;
  name: string;
  username: string;
  unreadCount: number;
  lastTime?: string | null;
}

interface SupportMsg {
  id: number;
  sender_id: number;
  message?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  created_at: string;
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

export default function AdminSupportChatsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminSupportChatsData>;
}) {
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [users, setUsers] = useState<SupportUser[]>(d.users || []);
  const [activeId, setActiveId] = useState<number | null>(d.users[0]?.id ?? null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  const loadMessages = async (partnerId: number) => {
    setLoading(true);
    try {
      const resp = await fetch(`${d.endpoints.messagesPrefix}${partnerId}/messages`, {
        headers: { Accept: "application/json" },
      });
      if (resp.ok) {
        const list = (await resp.json()) as SupportMsg[];
        setMessages(list);
        setUsers((prev) => prev.map((u) => (u.id === partnerId ? { ...u, unreadCount: 0 } : u)));
      }
    } catch {
      pushToast("danger", "Could not load conversation messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
    }
  }, [activeId]);

  const sendMessage = async (payload: {
    message?: string;
    attachment_url?: string;
    attachment_type?: string;
  }) => {
    if (!activeId) return;
    setSending(true);
    try {
      await requestJson(
        `${d.endpoints.messagesPrefix}${activeId}/send`,
        "POST",
        bootstrap.csrfToken,
        payload,
      );
      setDraft("");
      await loadMessages(activeId);
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!activeId) return;
    const validationError = validateAttachmentFile(file, "image");
    if (validationError) {
      pushToast("warning", validationError);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setSending(true);
    try {
      const res = await fetch(d.endpoints.upload, {
        method: "POST",
        headers: { "X-CSRFToken": bootstrap.csrfToken },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      await sendMessage({
        attachment_url: json.url,
        attachment_type: json.mime_type?.startsWith("image/") ? "image" : "file",
      });
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSending(false);
    }
  };

  const handleShareLocation = async () => {
    if (!activeId) return;
    const resolved = await resolveLocationDraftCoords({
      geolocation: typeof navigator !== "undefined" ? navigator.geolocation : null,
    });
    await sendMessage({
      message: resolved.label ? `📍 Location: ${resolved.label}` : "",
      attachment_url: resolved.coordString,
      attachment_type: "location",
    });
  };

  const activeUser = users.find((u) => u.id === activeId);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="grid h-[620px] gap-4 lg:grid-cols-12">
        <div
          style={{ ["--stagger" as string]: 0 }}
          className="ai-surface ai-stagger flex flex-col overflow-hidden lg:col-span-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3.5 dark:border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Conversations ({users.length})
            </span>
            <AdminStatusBadge tone="indigo">Live Inbox</AdminStatusBadge>
          </div>
          <div className="flex-1 divide-y divide-slate-200/50 overflow-y-auto dark:divide-slate-800/60">
            {users.length === 0 ? (
              <div className="p-5">
                <AdminEmptyState
                  icon={<MessageSquare className="h-5 w-5" />}
                  title="No support chats yet"
                />
              </div>
            ) : (
              users.map((u) => {
                const isActive = activeId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setActiveId(u.id)}
                    className={cn(
                      "relative flex w-full items-center justify-between border-l-2 border-transparent px-4 py-3.5 text-left text-xs transition-all duration-150 hover:bg-slate-50 dark:hover:bg-obsidian-850",
                      isActive &&
                        "border-l-indigo-600 bg-indigo-500/10 text-indigo-700 dark:border-l-indigo-400 dark:text-indigo-300",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
                        )}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{u.name}</p>
                        <p className="truncate text-[11px] text-slate-400">@{u.username}</p>
                      </div>
                    </div>
                    {u.unreadCount > 0 && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {u.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div
          style={{ ["--stagger" as string]: 1 }}
          className="ai-surface ai-stagger flex flex-col overflow-hidden lg:col-span-8"
        >
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3.5 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5 text-sm font-bold">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <div className="leading-tight">
                  {activeUser ? activeUser.name : "Select a conversation"}
                </div>
                {activeUser && (
                  <div className="text-[11px] font-normal text-slate-400">@{activeUser.username}</div>
                )}
              </div>
            </div>
            {activeUser && (
              <AdminStatusBadge tone="emerald" pulse>
                Connected
              </AdminStatusBadge>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-500" /> Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <AdminEmptyState
                  icon={<MessageSquare className="h-5 w-5" />}
                  title="No messages in this conversation yet"
                  description="Write a reply or share coordinates below to start helping."
                />
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === d.currentUserId;
                const safe = normalizeSupportMessageAttachment(m);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "animate-scale-in flex flex-col",
                      mine ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm",
                        mine
                          ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white"
                          : "border border-slate-200/80 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-obsidian-950/70 dark:text-slate-100",
                      )}
                    >
                      {safe.kind === "image" && safe.url && (
                        <img
                          src={safe.url}
                          alt="Chat attachment"
                          className="mb-2 max-h-48 rounded-lg object-cover"
                        />
                      )}
                      {safe.kind === "audio" && safe.url && (
                        <audio controls preload="metadata" src={safe.url} className="mb-2 max-w-full" />
                      )}
                      {safe.kind === "location" && safe.location && (
                        <a
                          href={safe.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-1.5 block font-semibold underline"
                        >
                          {safe.location.label}
                        </a>
                      )}
                      {safe.text}
                    </div>
                    <span className="mt-1 font-mono text-[10px] text-slate-400">{m.created_at}</span>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) sendMessage({ message: draft.trim() });
            }}
            className="flex items-center gap-2 border-t border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-obsidian-950/40"
          >
            <label className="ai-btn-secondary h-9 cursor-pointer px-2.5 text-xs" title="Attach file">
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleShareLocation}
              className="ai-btn-secondary h-9 px-2.5 text-xs"
              title="Share location"
            >
              <MapPin className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!activeId || sending}
              placeholder="Write a reply..."
              className="ai-input h-9 flex-1 text-xs"
            />
            <button
              type="submit"
              disabled={!activeId || sending}
              className="ai-btn-primary h-9 px-4 text-xs"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </button>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  );
}
