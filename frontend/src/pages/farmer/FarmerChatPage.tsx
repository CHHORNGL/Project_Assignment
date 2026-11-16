import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Crown,
  ImagePlus,
  Loader2,
  MessageSquare,
  PanelLeft,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  Volume2,
  VolumeX,
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

function formatClock(raw?: string | null): string {
  if (!raw) return "";
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return raw.slice(11, 16) || "";
  return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(raw?: string | null): string {
  if (!raw) return "";
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) {
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderInlineSegments(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-black/5 px-1 py-0.5 font-mono text-[12px] dark:bg-white/10"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function formatAiMessage(text: string): React.ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;
        const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-55" />
              <span className="min-w-0 flex-1">{renderInlineSegments(bulletMatch[1])}</span>
            </div>
          );
        }
        const numMatch = line.match(/^(\d+[.)])\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-0.5">
              <span className="shrink-0 font-semibold opacity-75">{numMatch[1]}</span>
              <span className="min-w-0 flex-1">{renderInlineSegments(numMatch[2])}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineSegments(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function FarmerChatPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<FarmerChatData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const sections = ui.sections || {};
  const { pushToast } = useToast();

  const [sessions, setSessions] = useState<ChatSessionItem[]>(d.sessions || []);
  const [messages, setMessages] = useState<ChatMessageItem[]>(d.messages || []);
  const [activeTitle, setActiveTitle] = useState(d.activeSession.title);
  const [activePostUrl, setActivePostUrl] = useState(d.activeSession.postUrl);
  const [credits, setCredits] = useState<number | string>(d.isPremium ? "unlimited" : d.aiCredits);

  const [sessionQuery, setSessionQuery] = useState("");
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [speakingId, setSpeakingId] = useState<string | number | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [messages.length, sending]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    const list = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;
    return [...list].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }, [sessions, sessionQuery]);

  const starterPrompts = useMemo(() => {
    const base = isKhmer
      ? [
          {
            title: "ស្លឹកស្រូវមានស្នាមអុជលឿង",
            prompt: "ស្លឹកស្រូវរបស់ខ្ញុំមានស្នាមអុជពណ៌លឿង និងស្ងួតគែម។ តើគួរព្យាបាលដូចម្តេច?",
          },
          {
            title: "ការពារផ្សិតក្នុងរដូវភ្លៀង",
            prompt: "តើគួរការពារជំងឺផ្សិតលើបន្លែ និងដំណាំស្រូវក្នុងរដូវភ្លៀងដោយវិធីណា?",
          },
          {
            title: "កាលវិភាគដាក់ជីដំបូង",
            prompt: "តើគួរដាក់ជី និងថែទាំដំណាំនៅដំណាក់កាលលូតលាស់ដំបូងដូចម្តេច?",
          },
        ]
      : [
          {
            title: "Yellow spots on rice leaves",
            prompt: "My rice leaves are showing yellow-brown diamond spots along the edges. What should I do?",
          },
          {
            title: "Rainy season fungal prevention",
            prompt: "How can I protect vegetables and rice crops from fungal infections during heavy rain?",
          },
          {
            title: "Early nutrient deficiency check",
            prompt: "How do I tell nitrogen deficiency apart from early leaf blight in field crops?",
          },
        ];

    if (d.exampleMessage && !base.some((b) => b.prompt === d.exampleMessage)) {
      return [
        { title: isKhmer ? "ឧទាហរណ៍រហ័ស" : "Quick example", prompt: d.exampleMessage },
        ...base.slice(0, 2),
      ];
    }
    return base;
  }, [isKhmer, d.exampleMessage]);

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if ((!trimmed && !file) || sending) return;

    const tempId = `tmp-u-${Date.now()}`;
    const optimisticUser: ChatMessageItem = {
      id: tempId,
      sender: "farmer",
      message: trimmed || (file ? `[Attached image: ${file.name}]` : ""),
      authorName: bootstrap.user.full_name || bootstrap.user.username || (isKhmer ? "អ្នក" : "You"),
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

    if (overrideText === undefined) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
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
        title?: string;
        credits_remaining?: number | string;
        error?: string;
      };
      if (!resp.ok || !json.ok) {
        pushToast("danger", json.error || (isKhmer ? "មិនអាចផ្ញើសារបានទេ។" : "Unable to send message."));
        return;
      }
      if (json.credits_remaining !== undefined && json.credits_remaining !== null) {
        setCredits(json.credits_remaining);
      }
      if (json.title) {
        setActiveTitle(json.title);
      }
      if (json.session_id) {
        const sid = json.session_id;
        if (!activePostUrl.includes(String(sid))) {
          setActivePostUrl(`/farmer/chat/${sid}`);
        }
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === sid);
          if (exists) {
            return prev.map((s) =>
              s.id === sid
                ? {
                    ...s,
                    active: true,
                    title: json.title || s.title,
                    updatedAt: new Date().toISOString(),
                  }
                : { ...s, active: false },
            );
          }
          const created: ChatSessionItem = {
            id: sid,
            title: json.title || trimmed.slice(0, 48) || (isKhmer ? "ការសន្ទនាថ្មី" : "New chat"),
            href: `/farmer/chat/${sid}`,
            pinUrl: `/farmer/chat/${sid}/pin`,
            renameUrl: `/farmer/chat/${sid}/rename`,
            deleteUrl: `/farmer/chat/${sid}/delete`,
            isPinned: false,
            updatedAt: new Date().toISOString(),
            active: true,
          };
          return [created, ...prev.map((s) => ({ ...s, active: false }))];
        });
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-ai-${Date.now()}`,
          sender: "system",
          message: json.reply || "",
          authorName: sections.assistant || "AGRI AI",
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      pushToast(
        "danger",
        isKhmer ? "មានបញ្ហាបណ្តាញពេលទាក់ទង AGRI AI។" : "Network error communicating with AGRI AI.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handlePin = async (sess: ChatSessionItem) => {
    const res = await postJson<{ ok?: boolean; is_pinned?: boolean }>(
      sess.pinUrl,
      {},
      bootstrap.csrfToken,
    );
    if (res.ok && res.data.ok) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sess.id ? { ...s, isPinned: Boolean(res.data.is_pinned) } : s)),
      );
    }
  };

  const handleRenameSubmit = async (sess: ChatSessionItem) => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      setEditingId(null);
      return;
    }
    const res = await postJson<{ ok?: boolean; title?: string; error?: string }>(
      sess.renameUrl,
      { title: nextTitle },
      bootstrap.csrfToken,
    );
    if (res.ok && res.data.ok) {
      const savedTitle = res.data.title || nextTitle;
      setSessions((prev) => prev.map((s) => (s.id === sess.id ? { ...s, title: savedTitle } : s)));
      if (sess.active) setActiveTitle(savedTitle);
      setEditingId(null);
    } else {
      pushToast("danger", res.data.error || "Unable to rename conversation.");
    }
  };

  const handleDelete = async (sess: ChatSessionItem) => {
    const res = await postJson<{ ok?: boolean; redirect_url?: string }>(
      sess.deleteUrl,
      {},
      bootstrap.csrfToken,
    );
    if (res.ok && res.data.ok) {
      setConfirmDeleteId(null);
      if (sess.active && res.data.redirect_url) {
        window.location.href = res.data.redirect_url;
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sess.id));
    }
  };

  const handleCopy = async (id: string | number, text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSpeak = (id: string | number, text: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      if (speakingId === id) {
        setSpeakingId(null);
        return;
      }
    }
    const audio = new Audio(
      `${d.ttsUrl}?lang=${bootstrap.lang}&text=${encodeURIComponent(text.slice(0, 450))}`,
    );
    audioRef.current = audio;
    setSpeakingId(id);
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setSpeakingId(null);
    };
    audio.onerror = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setSpeakingId(null);
    };
    void audio.play().catch(() => setSpeakingId(null));
  };

  const isUnlimited = d.isPremium || credits === "unlimited";

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/75 px-3.5 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {sections.history || "Conversations"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-obsidian-800 dark:text-slate-300">
            {sessions.length}
          </span>
        </div>
        <a
          href={d.newChatUrl}
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-indigo-50 px-2.5 text-[11px] font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
        >
          <Plus className="h-3 w-3" />
          <span>{isKhmer ? "ថ្មី" : "New"}</span>
        </a>
      </div>

      <div className="border-b border-slate-200/75 p-2.5 dark:border-slate-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            placeholder={isKhmer ? "ស្វែងរកការសន្ទនា..." : "Search chats..."}
            className="ai-input h-8 py-1 pl-10 pr-8 text-xs"
          />
          {sessionQuery && (
            <button
              type="button"
              onClick={() => setSessionQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2.5">
        {filteredSessions.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 opacity-40" />
            <p>
              {sessionQuery
                ? isKhmer
                  ? "រកមិនឃើញការសន្ទនាទេ"
                  : "No matching conversations"
                : isKhmer
                  ? "មិនទាន់មានប្រវត្តិសន្ទនា"
                  : "No previous chats yet"}
            </p>
          </div>
        ) : (
          filteredSessions.map((s) => {
            const isEditing = editingId === s.id;
            const isConfirming = confirmDeleteId === s.id;

            if (isEditing) {
              return (
                <form
                  key={s.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRenameSubmit(s);
                  }}
                  className="flex items-center gap-1 rounded-xl border border-indigo-400 bg-white p-1.5 dark:bg-obsidian-950"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-1.5 py-0.5 text-xs focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 p-1 text-white"
                    title="Save"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
                    title="Cancel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </form>
              );
            }

            if (isConfirming) {
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200"
                >
                  <span className="truncate font-semibold">
                    {isKhmer ? "លុបការសន្ទនា?" : "Delete thread?"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleDelete(s)}
                      className="rounded-lg bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-rose-700"
                    >
                      {isKhmer ? "លុប" : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-obsidian-900 dark:text-slate-300"
                    >
                      {isKhmer ? "ទេ" : "No"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition",
                  s.active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-obsidian-800",
                )}
              >
                <a href={s.href} className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {s.isPinned && <Pin className="h-3 w-3 shrink-0 opacity-90" />}
                    <span className="truncate font-semibold">{s.title}</span>
                  </div>
                  {s.updatedAt && (
                    <p
                      className={cn(
                        "mt-0.5 text-[10px]",
                        s.active ? "text-indigo-100" : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      {formatShortDate(s.updatedAt)}
                    </p>
                  )}
                </a>
                <div className="flex shrink-0 items-center gap-0.5 opacity-75 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => void handlePin(s)}
                    title={isKhmer ? "ខ្ទាស់" : "Pin"}
                    className={cn(
                      "rounded-md p-1 transition",
                      s.active ? "hover:bg-white/20" : "hover:bg-slate-200 dark:hover:bg-obsidian-700",
                    )}
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(s.id);
                      setEditingTitle(s.title);
                      setConfirmDeleteId(null);
                    }}
                    title={isKhmer ? "ប្តូរឈ្មោះ" : "Rename"}
                    className={cn(
                      "rounded-md p-1 transition",
                      s.active ? "hover:bg-white/20" : "hover:bg-slate-200 dark:hover:bg-obsidian-700",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(s.id);
                      setEditingId(null);
                    }}
                    title={isKhmer ? "លុប" : "Delete"}
                    className={cn(
                      "rounded-md p-1 transition",
                      s.active
                        ? "hover:bg-rose-500/80"
                        : "hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400",
                    )}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300 sm:inline-flex">
            {isUnlimited ? <Crown className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>
              {isUnlimited
                ? isKhmer
                  ? "គ្មានដែនកំណត់"
                  : "Unlimited Pro"
                : `${credits} ${isKhmer ? "ក្រេឌីត" : "Credits"}`}
            </span>
          </span>
          <a href={d.newChatUrl} className="ai-btn-primary h-9 gap-1.5 px-3 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>{isKhmer ? "ការសន្ទនាថ្មី" : "New Chat"}</span>
          </a>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Desktop Sessions Rail */}
        <aside className="ai-surface hidden h-[calc(100vh-14.5rem)] min-h-[520px] flex-col overflow-hidden lg:col-span-4 lg:flex xl:col-span-3">
          {sidebarContent}
        </aside>

        {/* Mobile Sessions Slide-Down Panel */}
        {mobileSessionsOpen && (
          <div className="ai-surface max-h-80 overflow-hidden lg:hidden">{sidebarContent}</div>
        )}

        {/* Main Conversation Area */}
        <section className="ai-surface flex h-[calc(100vh-14.5rem)] min-h-[520px] flex-col overflow-hidden lg:col-span-8 xl:col-span-9">
          {/* Active Thread Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/75 bg-white px-4 py-3 dark:border-slate-800/80 dark:bg-obsidian-900 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSessionsOpen((prev) => !prev)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300 lg:hidden"
                aria-label="Toggle conversations"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-obsidian-900" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                  {activeTitle}
                </h2>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {sections.online || (isKhmer ? "AGRI AI អនឡាញ · ជំនួយការកសិកម្ម" : "AGRI AI Online · Agronomy Assistant")}
                </p>
              </div>
            </div>

            <a
              href={d.diagnoseUrl}
              className="ai-btn-secondary h-8 shrink-0 gap-1.5 px-3 text-xs"
            >
              <Stethoscope className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">{sections.diagnose || (isKhmer ? "វិនិច្ឆ័យ" : "Diagnose")}</span>
            </a>
          </div>

          {/* Messages Viewport */}
          <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 dark:bg-obsidian-950/60 sm:p-5">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-6 text-center">
                <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-300">
                  <Bot className="h-7 w-7" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {sections.emptyTitle || (isKhmer ? "សួរជំនួយការ AI កសិកម្ម" : "Ask the AI Agronomist")}
                </h3>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
                  {sections.emptyText ||
                    (isKhmer
                      ? "ពិពណ៌នាអំពីរោគសញ្ញាដំណាំ ឬបង្ហោះរូបភាពស្លឹកដើម្បីទទួលបានដំណោះស្រាយភ្លាមៗ។"
                      : "Describe crop symptoms or upload a field leaf photo for tailored treatment steps.")}
                </p>

                <div className="mt-6 grid w-full gap-2.5 text-left sm:grid-cols-3">
                  {starterPrompts.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => void sendMessage(item.prompt)}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-sm dark:border-slate-800 dark:bg-obsidian-900 dark:hover:border-indigo-500/50"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                          {item.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {item.prompt}
                        </p>
                      </div>
                      <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="h-3 w-3" />
                        <span>{isKhmer ? "សួរឥឡូវ" : "Ask prompt"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => {
                  const isFarmer = m.sender === "farmer";
                  const speaking = speakingId === m.id;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-end gap-2.5",
                        isFarmer ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          isFarmer
                            ? "bg-indigo-600 text-white"
                            : "border border-slate-200 bg-white text-indigo-600 dark:border-slate-700 dark:bg-obsidian-850 dark:text-indigo-300",
                        )}
                      >
                        {isFarmer ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </span>

                      <div
                        className={cn(
                          "flex max-w-[85%] flex-col",
                          isFarmer ? "items-end" : "items-start",
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2 px-1 text-[10.5px] text-slate-400">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {m.authorName}
                          </span>
                          {m.createdAt && <span className="font-mono">{formatClock(m.createdAt)}</span>}
                        </div>

                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-xs",
                            isFarmer
                              ? "rounded-br-sm bg-indigo-600 text-white"
                              : "rounded-bl-sm border border-slate-200/90 bg-white text-slate-800 dark:border-slate-800 dark:bg-obsidian-900 dark:text-slate-100",
                          )}
                        >
                          {isFarmer ? (
                            <p className="whitespace-pre-wrap break-words">{m.message}</p>
                          ) : (
                            formatAiMessage(m.message)
                          )}
                        </div>

                        {!isFarmer && (
                          <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                            <button
                              type="button"
                              onClick={() => void handleCopy(m.id, m.message)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-obsidian-800 dark:hover:text-slate-200"
                            >
                              {copiedId === m.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" />
                                  <span>{isKhmer ? "បានចម្លង" : "Copied"}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>{isKhmer ? "ចម្លង" : "Copy"}</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSpeak(m.id, m.message)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition",
                                speaking
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                                  : "hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-obsidian-800 dark:hover:text-slate-200",
                              )}
                            >
                              {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                              <span>{speaking ? (isKhmer ? "បញ្ឈប់" : "Stop") : isKhmer ? "ស្តាប់" : "Listen"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-end gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 dark:border-slate-700 dark:bg-obsidian-850 dark:text-indigo-300">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200/90 bg-white px-4 py-2.5 text-xs shadow-xs dark:border-slate-800 dark:bg-obsidian-900">
                      <span className="inline-flex items-center gap-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:300ms]" />
                      </span>
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        {isKhmer ? "កំពុងវិភាគចម្លើយ..." : "AGRI AI is thinking..."}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={feedEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="border-t border-slate-200/75 bg-white p-3.5 dark:border-slate-800/80 dark:bg-obsidian-900"
          >
            {previewUrl && (
              <div className="mb-2.5 inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-800 dark:bg-obsidian-950">
                <img
                  src={previewUrl}
                  alt="Attachment preview"
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <span className="max-w-[180px] truncate font-medium text-slate-700 dark:text-slate-200">
                  {file?.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  aria-label="Remove attachment"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-rose-500 dark:hover:bg-obsidian-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/75 p-1.5 transition-all focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-slate-800 dark:bg-obsidian-950 dark:focus-within:border-indigo-400">
              <button
                type="button"
                disabled={sending}
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-obsidian-800 dark:hover:text-slate-100"
                title={isKhmer ? "បន្ថែមរូបភាពដំណាំ" : "Attach crop image"}
                aria-label={isKhmer ? "បន្ថែមរូបភាពដំណាំ" : "Attach crop image"}
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
                  e.target.value = "";
                }}
              />

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                placeholder={
                  sections.composerHint ||
                  (isKhmer ? "សួរអំពីដំណាំ រោគសញ្ញា ឬវិធីព្យាបាល..." : "Ask about crops, symptoms, or treatments...")
                }
                className="max-h-[120px] min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
              />

              <button
                type="submit"
                disabled={sending || (!input.trim() && !file)}
                aria-label={isKhmer ? "ផ្ញើសារ" : "Send message"}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-slate-400">
              <span>
                {isKhmer ? "Enter ផ្ញើ · Shift+Enter ចុះបន្ទាត់" : "Enter to send · Shift+Enter new line"}
              </span>
              {!isUnlimited && (
                <span>
                  {credits} {isKhmer ? "ក្រេឌីតនៅសល់" : "credits remaining"}
                </span>
              )}
            </div>
          </form>
        </section>
      </div>
    </WorkspaceShell>
  );
}
