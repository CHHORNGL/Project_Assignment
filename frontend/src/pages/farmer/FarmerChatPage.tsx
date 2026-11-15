import React, { useRef, useState } from "react";
import {
  Bot,
  Crown,
  ImagePlus,
  Loader2,
  Pin,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatSessionItem {
  id: number;
  title: string;
  href: string;
  pinUrl: string;
  renameUrl: string;
  deleteUrl: string;
  isPinned: boolean;
  updatedAt?: string | null;
  active: boolean;
}

interface ChatMessageItem {
  id: number | string;
  sender: string;
  message: string;
  createdAt?: string | null;
  authorName: string;
}

interface FarmerChatData {
  newChatUrl: string;
  diagnoseUrl: string;
  ttsUrl: string;
  exampleMessage: string;
  isPremium: boolean;
  aiCredits: number;
  activeSession: {
    id: number | null;
    title: string;
    postUrl: string;
    isPinned: boolean;
  };
  sessions: ChatSessionItem[];
  messages: ChatMessageItem[];
}

export default function FarmerChatPage({ bootstrap }: { bootstrap: AppBootstrap<FarmerChatData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [sessions, setSessions] = useState<ChatSessionItem[]>(d.sessions || []);
  const [messages, setMessages] = useState<ChatMessageItem[]>(d.messages || []);
  const [activePostUrl, setActivePostUrl] = useState(d.activeSession.postUrl);
  const [credits, setCredits] = useState<number | string>(d.isPremium ? "unlimited" : d.aiCredits);

  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !file) || sending) return;

    const optimisticUser: ChatMessageItem = {
      id: `tmp-u-${Date.now()}`,
      sender: "farmer",
      message: trimmed || (file ? `[Attached image: ${file.name}]` : ""),
      authorName: bootstrap.user.full_name || "You",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    const formData = new FormData();
    formData.append("csrf_token", bootstrap.csrfToken);
    formData.append("message", trimmed);
    if (file) {
      formData.append("attachment", file);
    }

    setInput("");
    setFile(null);
    setPreviewUrl(null);

    try {
      const resp = await fetch(activePostUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": bootstrap.csrfToken,
        },
        body: formData,
      });
      const json = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        reply?: string;
        session_id?: number;
        credits_remaining?: number | string;
        error?: string;
      };
      if (!resp.ok || !json.ok) {
        pushToast("danger", json.error || "Unable to send message.");
        return;
      }
      if (json.credits_remaining !== undefined && json.credits_remaining !== null) {
        setCredits(json.credits_remaining);
      }
      if (json.session_id && !activePostUrl.includes(String(json.session_id))) {
        setActivePostUrl(`/farmer/chat/${json.session_id}`);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-ai-${Date.now()}`,
          sender: "system",
          message: json.reply || "",
          authorName: bootstrap.ui.sections?.assistant || "AGRI AI",
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      pushToast("danger", "Network error communicating with AGRI AI.");
    } finally {
      setSending(false);
    }
  };

  const handlePin = async (sess: ChatSessionItem) => {
    const res = await postJson<{ ok?: boolean; is_pinned?: boolean }>(sess.pinUrl, {}, bootstrap.csrfToken);
    if (res.ok && res.data.ok) {
      setSessions((prev) => prev.map((s) => (s.id === sess.id ? { ...s, isPinned: Boolean(res.data.is_pinned) } : s)));
    }
  };

  const handleDelete = async (sess: ChatSessionItem) => {
    const res = await postJson<{ ok?: boolean; redirect_url?: string }>(sess.deleteUrl, {}, bootstrap.csrfToken);
    if (res.ok && res.data.ok) {
      if (sess.active && res.data.redirect_url) {
        window.location.href = res.data.redirect_url;
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sess.id));
    }
  };

  const handleSpeak = (text: string) => {
    const audio = new Audio(`${d.ttsUrl}?lang=${bootstrap.lang}&text=${encodeURIComponent(text.slice(0, 450))}`);
    void audio.play();
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300 sm:inline-flex items-center gap-1">
            {d.isPremium || credits === "unlimited" ? <Crown className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {d.isPremium || credits === "unlimited" ? "Unlimited" : `${credits} Credits`}
          </span>
          <a href={d.newChatUrl} className="ai-btn-primary h-9 px-3 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {isKhmer ? "ការសន្ទនាថ្មី" : "New Chat"}
          </a>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Sessions List */}
        <aside className="ai-surface flex max-h-[72vh] flex-col p-3 lg:col-span-4 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between px-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {bootstrap.ui.sections?.history || "Conversations"}
            </span>
            <a href={d.newChatUrl} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              + New
            </a>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition",
                  s.active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "hover:bg-slate-100 dark:hover:bg-obsidian-800",
                )}
              >
                <a href={s.href} className="min-w-0 flex-1 truncate font-medium">
                  {s.isPinned && <Pin className="mr-1 inline h-3 w-3" />}
                  {s.title}
                </a>
                <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100">
                  <button type="button" onClick={() => handlePin(s)} title="Pin">
                    <Pin className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => handleDelete(s)} title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Conversation Feed */}
        <section className="ai-surface flex h-[72vh] flex-col overflow-hidden lg:col-span-8 xl:col-span-9">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Bot className="h-6 w-6" />
                </div>
                <h2 className="font-display text-base font-bold">
                  {bootstrap.ui.sections?.emptyTitle || "Ask the AI Agronomist"}
                </h2>
                <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                  {bootstrap.ui.sections?.emptyText || "Describe crop symptoms or attach a field photo."}
                </p>
                {d.exampleMessage && (
                  <button
                    type="button"
                    onClick={() => setInput(d.exampleMessage)}
                    className="ai-btn-secondary mt-4 text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    {d.exampleMessage}
                  </button>
                )}
              </div>
            ) : (
              messages.map((m) => {
                const isFarmer = m.sender === "farmer";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col",
                      isFarmer ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        isFarmer
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-obsidian-850",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-4 text-[11px] opacity-75">
                        <span className="font-bold">{m.authorName}</span>
                        {!isFarmer && (
                          <button
                            type="button"
                            onClick={() => handleSpeak(m.message)}
                            className="inline-flex items-center gap-1 hover:text-indigo-500"
                            title="Listen"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-slate-200/70 p-3 dark:border-slate-800/70">
            {previewUrl && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-xs dark:border-slate-800 dark:bg-obsidian-850">
                <img src={previewUrl} alt="Attachment preview" className="h-10 w-10 rounded-lg object-cover" />
                <span className="max-w-[160px] truncate">{file?.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="rounded-md p-1 text-slate-400 hover:text-rose-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="ai-btn-secondary h-10 w-10 shrink-0 p-0"
                title="Attach crop image"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) {
                    setFile(chosen);
                    setPreviewUrl(URL.createObjectURL(chosen));
                  }
                }}
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={bootstrap.ui.sections?.composerHint || "Ask about crops, symptoms, or treatments..."}
                className="ai-input py-2.5"
              />
              <button type="submit" disabled={sending} className="ai-btn-primary h-10 shrink-0 px-4">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </section>
      </div>
    </WorkspaceShell>
  );
}
