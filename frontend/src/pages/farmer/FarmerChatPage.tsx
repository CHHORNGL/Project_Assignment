import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  ShieldCheck,
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
import { useSpeechPlayback } from "@/hooks/useSpeechPlayback";
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
  localAttachmentUrl?: string | null;
  localAttachmentName?: string | null;
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

const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function parseUtcDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hasZone = trimmed.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmed);
  const normalized = hasZone
    ? trimmed
    : `${trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")}Z`;
  const dt = new Date(normalized);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatClock(raw?: string | null): string {
  const dt = parseUtcDate(raw);
  if (!dt) return raw ? raw.slice(11, 16) || "" : "";
  return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(raw?: string | null): string {
  const dt = parseUtcDate(raw);
  if (!dt) return raw ? raw.slice(0, 10) : "";
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) {
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderInlineSegments(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-indigo-700 dark:bg-obsidian-800 dark:text-indigo-300"
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

        const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
        if (headingMatch) {
          return (
            <h4
              key={idx}
              className="pt-1 font-display text-[13.5px] font-bold tracking-tight text-slate-900 first:pt-0 dark:text-white"
            >
              {renderInlineSegments(headingMatch[1])}
            </h4>
          );
        }

        const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/75 dark:bg-indigo-400/75" />
              <span className="min-w-0 flex-1 leading-relaxed">
                {renderInlineSegments(bulletMatch[1])}
              </span>
            </div>
          );
        }

        const numMatch = line.match(/^(\d+[.)])\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-0.5">
              <span className="shrink-0 font-semibold text-indigo-600 dark:text-indigo-300">
                {numMatch[1]}
              </span>
              <span className="min-w-0 flex-1 leading-relaxed">
                {renderInlineSegments(numMatch[2])}
              </span>
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
  const [activeSessionId, setActiveSessionId] = useState<number | null>(d.activeSession.id);
  const [activeTitle, setActiveTitle] = useState(d.activeSession.title);
  const [activePostUrl, setActivePostUrl] = useState(d.activeSession.postUrl);
  const [credits, setCredits] = useState<number | string>(
    d.isPremium ? "unlimited" : d.aiCredits,
  );

  const [sessionQuery, setSessionQuery] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerEditTitle, setHeaderEditTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const { activeKey: speakingId, toggleSpeak: handleSpeak } = useSpeechPlayback<string | number>(
    d.ttsUrl,
    bootstrap.lang,
    (msg) => pushToast("warning", msg),
  );

  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const createdUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.requestAnimationFrame(() => {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [messages.length, sending]);

  useEffect(() => {
    if (!mobileDrawerOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      createdUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore revoke failures
        }
      });
      createdUrlsRef.current.clear();
    };
  }, []);

  const clearPendingAttachment = (revoke = true) => {
    if (previewUrl && revoke) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // Ignore revoke errors
      }
      createdUrlsRef.current.delete(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
  };

  const { pinnedSessions, recentSessions } = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    const list = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;
    return {
      pinnedSessions: list.filter((s) => s.isPinned),
      recentSessions: list.filter((s) => !s.isPinned),
    };
  }, [sessions, sessionQuery]);

  const activeSessionRecord = useMemo(
    () =>
      sessions.find((s) => s.id === activeSessionId || s.active) || null,
    [sessions, activeSessionId],
  );

  const starterPrompts = useMemo(() => {
    const base = isKhmer
      ? [
          {
            title: "ស្លឹកស្រូវមានស្នាមអុជលឿង",
            prompt:
              "ស្លឹកស្រូវរបស់ខ្ញុំមានស្នាមអុជពណ៌លឿង និងស្ងួតគែម។ តើគួរព្យាបាលដូចម្តេច?",
          },
          {
            title: "ការពារផ្សិតក្នុងរដូវភ្លៀង",
            prompt:
              "តើគួរការពារជំងឺផ្សិតលើបន្លែ និងដំណាំស្រូវក្នុងរដូវភ្លៀងដោយវិធីណា?",
          },
          {
            title: "សញ្ញាខ្វះសារធាតុចិញ្ចឹម",
            prompt:
              "តើអាចបែងចែករវាងការខ្វះអាសូត និងជំងឺរលួយស្លឹកដំណាំដោយរបៀបណា?",
          },
        ]
      : [
          {
            title: "Yellow spots on rice leaves",
            prompt:
              "My rice leaves are showing yellow-brown diamond spots along the edges. What should I do?",
          },
          {
            title: "Rainy season fungal care",
            prompt:
              "How can I protect vegetables and rice crops from fungal infections during heavy rain?",
          },
          {
            title: "Nutrient vs leaf blight",
            prompt:
              "How do I tell nitrogen deficiency apart from early leaf blight in field crops?",
          },
        ];

    if (d.exampleMessage && !base.some((b) => b.prompt === d.exampleMessage)) {
      return [
        { title: isKhmer ? "ឧទាហរណ៍រហ័ស" : "Quick question", prompt: d.exampleMessage },
        ...base.slice(0, 2),
      ];
    }
    return base;
  }, [isKhmer, d.exampleMessage]);

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    const pendingFile = overrideText === undefined ? file : null;
    const pendingPreview = overrideText === undefined ? previewUrl : null;
    if ((!trimmed && !pendingFile) || sending) return;

    const tempId = `tmp-u-${Date.now()}`;
    const optimisticUser: ChatMessageItem = {
      id: tempId,
      sender: "farmer",
      message:
        trimmed ||
        (pendingFile
          ? isKhmer
            ? "សូមវិភាគរូបភាពដំណាំដែលបានភ្ជាប់"
            : "Please analyze the attached crop photo"
          : ""),
      authorName:
        bootstrap.user.full_name ||
        bootstrap.user.username ||
        (isKhmer ? "អ្នក" : "You"),
      createdAt: new Date().toISOString(),
      localAttachmentUrl: pendingPreview,
      localAttachmentName: pendingFile?.name || null,
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    const formData = new FormData();
    formData.append("csrf_token", bootstrap.csrfToken);
    formData.append("message", trimmed);
    if (pendingFile) {
      formData.append("attachment", pendingFile);
    }

    if (overrideText === undefined) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      clearPendingAttachment(false);
    }

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
        user_created_at?: string | null;
        assistant_created_at?: string | null;
        error?: string;
      };
      if (!resp.ok || !json.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (overrideText === undefined) {
          if (trimmed && !input.trim()) setInput(trimmed);
          if (pendingFile) {
            setFile(pendingFile);
            setPreviewUrl(pendingPreview);
          }
        }
        pushToast(
          "danger",
          json.error || (isKhmer ? "មិនអាចផ្ញើសារបានទេ។" : "Unable to send message."),
        );
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
        setActiveSessionId(sid);
        const sessionHref = `/farmer/chat/${sid}`;
        if (!activePostUrl.includes(String(sid))) {
          setActivePostUrl(sessionHref);
          try {
            window.history.replaceState({}, "", sessionHref);
          } catch {
            // Ignore history restrictions
          }
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
            title:
              json.title ||
              trimmed.slice(0, 48) ||
              (isKhmer ? "ការសន្ទនាថ្មី" : "New chat"),
            href: sessionHref,
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
        ...prev.map((m) =>
          m.id === tempId && json.user_created_at
            ? { ...m, createdAt: json.user_created_at }
            : m,
        ),
        {
          id: `tmp-ai-${Date.now()}`,
          sender: "system",
          message: json.reply || "",
          authorName: sections.assistant || "AGRI AI",
          createdAt: json.assistant_created_at || new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (overrideText === undefined) {
        if (trimmed && !input.trim()) setInput(trimmed);
        if (pendingFile) {
          setFile(pendingFile);
          setPreviewUrl(pendingPreview);
        }
      }
      pushToast(
        "danger",
        isKhmer
          ? "មានបញ្ហាបណ្តាញពេលទាក់ទង AGRI AI។"
          : "Network error communicating with AGRI AI.",
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
        prev.map((s) =>
          s.id === sess.id ? { ...s, isPinned: Boolean(res.data.is_pinned) } : s,
        ),
      );
    } else {
      pushToast(
        "danger",
        isKhmer ? "មិនអាចខ្ទាស់ការសន្ទនាបានទេ។" : "Could not update pin state.",
      );
    }
  };

  const submitRename = async (sess: ChatSessionItem, candidate: string) => {
    const nextTitle = candidate.trim();
    if (!nextTitle) return false;
    const res = await postJson<{ ok?: boolean; title?: string; error?: string }>(
      sess.renameUrl,
      { title: nextTitle },
      bootstrap.csrfToken,
    );
    if (res.ok && res.data.ok) {
      const savedTitle = res.data.title || nextTitle;
      setSessions((prev) =>
        prev.map((s) => (s.id === sess.id ? { ...s, title: savedTitle } : s)),
      );
      if (sess.id === activeSessionId || sess.active) {
        setActiveTitle(savedTitle);
      }
      return true;
    }
    pushToast(
      "danger",
      res.data.error || (isKhmer ? "មិនអាចប្តូរឈ្មោះបានទេ។" : "Unable to rename conversation."),
    );
    return false;
  };

  const handleRenameSubmit = async (sess: ChatSessionItem) => {
    await submitRename(sess, editingTitle);
    setEditingId(null);
  };

  const handleHeaderRenameSubmit = async () => {
    if (!activeSessionRecord) {
      setHeaderEditing(false);
      return;
    }
    await submitRename(activeSessionRecord, headerEditTitle);
    setHeaderEditing(false);
  };

  const handleDelete = async (sess: ChatSessionItem) => {
    const res = await postJson<{ ok?: boolean; redirect_url?: string }>(
      sess.deleteUrl,
      {},
      bootstrap.csrfToken,
    );
    if (res.ok && res.data.ok) {
      setConfirmDeleteId(null);
      if ((sess.id === activeSessionId || sess.active) && res.data.redirect_url) {
        window.location.href = res.data.redirect_url;
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sess.id));
    } else {
      pushToast("danger", isKhmer ? "មិនអាចលុបការសន្ទនាបានទេ។" : "Could not delete thread.");
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

  const isUnlimited = d.isPremium || credits === "unlimited";

  const renderSessionRow = (s: ChatSessionItem) => {
    const isEditing = editingId === s.id;
    const isConfirming = confirmDeleteId === s.id;
    const isCurrent = s.id === activeSessionId || s.active;

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
            title={isKhmer ? "រក្សាទុក" : "Save"}
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title={isKhmer ? "បោះបង់" : "Cancel"}
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
          isCurrent
            ? "bg-indigo-50/90 text-indigo-800 ring-1 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/25"
            : "text-slate-700 hover:bg-slate-100/90 dark:text-slate-200 dark:hover:bg-obsidian-800/80",
        )}
      >
        <a
          href={s.href}
          onClick={() => setMobileDrawerOpen(false)}
          className="min-w-0 flex-1"
        >
          <div className="flex items-center gap-1.5">
            {s.isPinned && (
              <Pin className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
            )}
            <span className={cn("truncate", isCurrent ? "font-bold" : "font-medium")}>
              {s.title}
            </span>
          </div>
          {s.updatedAt && (
            <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-slate-500">
              {formatShortDate(s.updatedAt)}
            </p>
          )}
        </a>
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
            isCurrent && "sm:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={() => void handlePin(s)}
            title={s.isPinned ? (isKhmer ? "ដកខ្ទាស់" : "Unpin") : isKhmer ? "ខ្ទាស់" : "Pin"}
            className="rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-amber-600 dark:hover:bg-obsidian-900 dark:hover:text-amber-400"
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
            className="rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-indigo-600 dark:hover:bg-obsidian-900 dark:hover:text-indigo-300"
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
            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  const renderSidebarContent = (onCloseMobile?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/75 px-3.5 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {sections.history || (isKhmer ? "ប្រវត្តិសន្ទនា" : "Conversations")}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-obsidian-800 dark:text-slate-300">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={d.newChatUrl}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-3 w-3" />
            <span>{isKhmer ? "ថ្មី" : "New"}</span>
          </a>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label={isKhmer ? "បិទ" : "Close"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-obsidian-950 dark:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200/75 p-2.5 dark:border-slate-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            placeholder={isKhmer ? "ស្វែងរកការសន្ទនា..." : "Search threads..."}
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2.5">
        {pinnedSessions.length === 0 && recentSessions.length === 0 ? (
          <div className="px-3 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 opacity-40" />
            <p>
              {sessionQuery
                ? isKhmer
                  ? "រកមិនឃើញការសន្ទនាទេ"
                  : "No matching threads"
                : isKhmer
                  ? "មិនទាន់មានប្រវត្តិសន្ទនា"
                  : "No conversations yet"}
            </p>
          </div>
        ) : (
          <>
            {pinnedSessions.length > 0 && (
              <div>
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {isKhmer ? "បានខ្ទាស់" : "Pinned"}
                </p>
                <div className="space-y-1">{pinnedSessions.map(renderSessionRow)}</div>
              </div>
            )}

            {recentSessions.length > 0 && (
              <div>
                {pinnedSessions.length > 0 && (
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isKhmer ? "ថ្មីៗ" : "Recent"}
                  </p>
                )}
                <div className="space-y-1">{recentSessions.map(renderSessionRow)}</div>
              </div>
            )}
          </>
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
          <a
            href={d.diagnoseUrl}
            className="ai-btn-secondary hidden h-9 gap-1.5 px-3 text-xs md:inline-flex"
          >
            <Stethoscope className="h-3.5 w-3.5 text-indigo-500" />
            <span>{sections.diagnose || (isKhmer ? "វិនិច្ឆ័យដំណាំ" : "Crop Diagnosis")}</span>
          </a>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Desktop Conversations Rail */}
        <aside className="ai-surface hidden h-[calc(100dvh-11.25rem)] min-h-[460px] max-h-[820px] flex-col overflow-hidden lg:col-span-4 lg:flex xl:col-span-3">
          {renderSidebarContent()}
        </aside>

        {/* Main Conversation Studio */}
        <section className="ai-surface flex h-[calc(100dvh-14.25rem)] min-h-[400px] max-h-[820px] flex-col overflow-hidden sm:h-[calc(100dvh-11.25rem)] lg:col-span-8 xl:col-span-9">
          {/* Clean Active Thread Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/75 bg-white/95 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-obsidian-900/95 sm:px-5 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300 lg:hidden"
                aria-label={isKhmer ? "បើកប្រវត្តិសន្ទនា" : "Open conversations"}
              >
                <PanelLeft className="h-4 w-4" />
                {sessions.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                    {sessions.length}
                  </span>
                )}
              </button>

              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-obsidian-900" />
              </div>

              <div className="min-w-0 flex-1">
                {headerEditing && activeSessionRecord ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleHeaderRenameSubmit();
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={headerEditTitle}
                      onChange={(e) => setHeaderEditTitle(e.target.value)}
                      className="ai-input h-7 max-w-xs px-2 py-0.5 text-xs font-semibold"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeaderEditing(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 dark:border-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h2 className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                      {activeTitle}
                    </h2>
                    {activeSessionRecord && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderEditTitle(activeTitle);
                          setHeaderEditing(true);
                        }}
                        title={isKhmer ? "ប្តូរឈ្មោះ" : "Rename thread"}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-obsidian-800 dark:hover:text-indigo-300"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {sections.online ||
                    (isKhmer
                      ? "AGRI AI អនឡាញ · អ្នកជំនាញកសិកម្ម"
                      : "AGRI AI Online · Agronomy Specialist")}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={d.newChatUrl}
                title={isKhmer ? "ការសន្ទនាថ្មី" : "New Chat"}
                className="inline-flex h-8 items-center gap-1 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-2.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-500/20 dark:text-indigo-300 lg:hidden"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isKhmer ? "ថ្មី" : "New"}</span>
              </a>
              <a
                href={d.diagnoseUrl}
                title={sections.diagnose || (isKhmer ? "វិនិច្ឆ័យ" : "Diagnose")}
                className="ai-btn-secondary h-8 gap-1.5 px-2.5 text-xs md:hidden"
              >
                <Stethoscope className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline">
                  {sections.diagnose || (isKhmer ? "វិនិច្ឆ័យ" : "Diagnose")}
                </span>
              </a>
            </div>
          </div>

          {/* Airy Message Viewport */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 px-3.5 py-5 dark:bg-obsidian-950/60 sm:px-6">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-4 text-center">
                <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 shadow-sm dark:text-indigo-300">
                  <Bot className="h-7 w-7" />
                </div>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                  {sections.emptyTitle ||
                    (isKhmer ? "សួរជំនួយការ AI កសិកម្ម" : "Ask Agricultural Expert")}
                </h3>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
                  {sections.emptyText ||
                    (isKhmer
                      ? "ពិពណ៌នាអំពីរោគសញ្ញាដំណាំ ឬបង្ហោះរូបភាពស្លឹកដើម្បីទទួលបានដំណោះស្រាយច្បាស់លាស់។"
                      : "Describe field symptoms or attach a crop leaf photo for structured diagnosis and treatment guidance.")}
                </p>

                <div className="mt-6 grid w-full gap-2.5 text-left sm:grid-cols-3">
                  {starterPrompts.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => void sendMessage(item.prompt)}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-sm dark:border-slate-800 dark:bg-obsidian-900 dark:hover:border-indigo-500/50"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                          {item.title}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {item.prompt}
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="h-3 w-3" />
                        <span>{isKhmer ? "សួរឥឡូវ" : "Use prompt"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((m) => {
                  const isFarmer = m.sender === "farmer";
                  const isHumanExpert = m.sender === "expert";
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
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm",
                          isFarmer
                            ? "bg-indigo-600 text-white"
                            : isHumanExpert
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                              : "border border-slate-200 bg-white text-indigo-600 dark:border-slate-700 dark:bg-obsidian-900 dark:text-indigo-300",
                        )}
                      >
                        {isFarmer ? (
                          <User className="h-4 w-4" />
                        ) : isHumanExpert ? (
                          <ShieldCheck className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </span>

                      <div
                        className={cn(
                          "flex max-w-[88%] flex-col sm:max-w-[80%]",
                          isFarmer ? "items-end" : "items-start",
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2 px-1 text-[10.5px] text-slate-400">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {m.authorName}
                          </span>
                          {isHumanExpert && (
                            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300">
                              {isKhmer ? "អ្នកជំនាញ" : "Specialist"}
                            </span>
                          )}
                          {m.createdAt && (
                            <span className="font-mono">{formatClock(m.createdAt)}</span>
                          )}
                        </div>

                        <div
                          className={cn(
                            "rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-sm",
                            isFarmer
                              ? "rounded-br-sm bg-indigo-600 text-white"
                              : isHumanExpert
                                ? "rounded-bl-sm border border-emerald-500/30 bg-white text-slate-800 dark:border-emerald-500/25 dark:bg-obsidian-900 dark:text-slate-100"
                                : "rounded-bl-sm border border-slate-200/85 bg-white text-slate-800 dark:border-slate-800 dark:bg-obsidian-900 dark:text-slate-100",
                          )}
                        >
                          {m.localAttachmentUrl && (
                            <div className="mb-2 overflow-hidden rounded-xl border border-white/20">
                              <img
                                src={m.localAttachmentUrl}
                                alt={m.localAttachmentName || "Uploaded crop"}
                                className="max-h-48 w-full object-cover"
                              />
                            </div>
                          )}
                          {isFarmer ? (
                            <p className="whitespace-pre-wrap break-words">{m.message}</p>
                          ) : (
                            formatAiMessage(m.message)
                          )}
                        </div>

                        {!isFarmer && (
                          <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
                            <button
                              type="button"
                              onClick={() => void handleCopy(m.id, m.message)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-obsidian-800 dark:hover:text-slate-200"
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
                                "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 transition",
                                speaking
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                                  : "hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-obsidian-800 dark:hover:text-slate-200",
                              )}
                            >
                              {speaking ? (
                                <VolumeX className="h-3 w-3" />
                              ) : (
                                <Volume2 className="h-3 w-3" />
                              )}
                              <span>
                                {speaking
                                  ? isKhmer
                                    ? "បញ្ឈប់"
                                    : "Stop"
                                  : isKhmer
                                    ? "ស្តាប់"
                                    : "Listen"}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-end gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-600 dark:border-slate-700 dark:bg-obsidian-900 dark:text-indigo-300">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-bl-sm border border-slate-200/90 bg-white px-4 py-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-obsidian-900">
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

          {/* Grounded Centered Composer */}
          <form
            onSubmit={handleSend}
            className="shrink-0 border-t border-slate-200/75 bg-white/95 px-3 py-3 dark:border-slate-800/80 dark:bg-obsidian-900/95 sm:px-5"
          >
            <div className="mx-auto max-w-3xl">
              {previewUrl && (
                <div className="mb-2.5 inline-flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 pr-2.5 text-xs dark:border-slate-800 dark:bg-obsidian-950">
                  <img
                    src={previewUrl}
                    alt="Attachment preview"
                    className="h-11 w-11 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="max-w-[180px] truncate font-semibold text-slate-700 dark:text-slate-200">
                      {file?.name}
                    </p>
                    {file && (
                      <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => clearPendingAttachment(true)}
                    aria-label="Remove attachment"
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200/70 hover:text-rose-500 dark:hover:bg-obsidian-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/75 p-1.5 shadow-sm transition-all focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-slate-800 dark:bg-obsidian-950 dark:focus-within:border-indigo-400">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-obsidian-800 dark:hover:text-slate-100"
                  title={isKhmer ? "ភ្ជាប់រូបភាពដំណាំ" : "Attach crop photo"}
                  aria-label={isKhmer ? "ភ្ជាប់រូបភាពដំណាំ" : "Attach crop photo"}
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
                    e.target.value = "";
                    if (!chosen) return;
                    if (!ALLOWED_IMAGE_MIME.has(chosen.type)) {
                      pushToast(
                        "warning",
                        isKhmer
                          ? "សូមជ្រើសរើសរូបភាព JPG, PNG, WebP ឬ GIF។"
                          : "Please attach a JPG, PNG, WebP, or GIF image.",
                      );
                      return;
                    }
                    if (chosen.size > MAX_ATTACHMENT_BYTES) {
                      pushToast(
                        "warning",
                        isKhmer
                          ? "ទំហំរូបភាពត្រូវតែតូចជាង 6 MB។"
                          : "Image must be 6 MB or smaller.",
                      );
                      return;
                    }
                    clearPendingAttachment(true);
                    const nextUrl = URL.createObjectURL(chosen);
                    createdUrlsRef.current.add(nextUrl);
                    setFile(chosen);
                    setPreviewUrl(nextUrl);
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
                    (isKhmer
                      ? "សួរអំពីដំណាំ រោគសញ្ញា ឬវិធីព្យាបាល..."
                      : "Ask about crops, symptoms, or treatments...")
                  }
                  className="max-h-[120px] min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                />

                <button
                  type="submit"
                  disabled={sending || (!input.trim() && !file)}
                  aria-label={isKhmer ? "ផ្ញើសារ" : "Send message"}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-slate-400">
                <span className="hidden sm:inline">
                  {isKhmer
                    ? "Enter ផ្ញើ · Shift+Enter ចុះបន្ទាត់"
                    : "Enter to send · Shift+Enter for new line"}
                </span>
                <span className="sm:hidden">
                  {isKhmer ? "ប៉ះរូបភាព ដើម្បីភ្ជាប់ស្លឹក" : "Attach leaf photo for analysis"}
                </span>
                {!isUnlimited && (
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {credits} {isKhmer ? "ក្រេឌីតនៅសល់" : "credits left"}
                  </span>
                )}
              </div>
            </div>
          </form>
        </section>
      </div>

      {/* Mobile Conversations Slide-Over Sheet Portaled to Body */}
      {mobileDrawerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isKhmer ? "ប្រវត្តិសន្ទនា" : "Conversations"}
            className="fixed inset-0 z-[80] flex bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileDrawerOpen(false);
            }}
          >
            <div className="h-full w-[86vw] max-w-[320px] border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-obsidian-900">
              {renderSidebarContent(() => setMobileDrawerOpen(false))}
            </div>
          </div>,
          document.body,
        )}
    </WorkspaceShell>
  );
}
