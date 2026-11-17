import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Copy,
  Headphones,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { askAgriExpert } from "@/lib/aiApi";
import { requestJson } from "@/lib/api";
import {
  normalizeSupportMessageAttachment,
  resolveLocationDraftCoords,
  validateAttachmentFile,
} from "@/lib/supportChatSecurity";
import {
  buildFarmerSupportQueryUrl,
  formatChatClock,
  mergeSupportMessages,
  type LiveEnvelopeResponse,
  type LiveSupportMsg,
  type SupportChannelsMap,
  type SupportTarget,
} from "@/lib/liveSupportHelpers";
import { cn } from "@/lib/utils";
import { AiThinkingSkeleton, ChatThreadSkeleton } from "@/components/ui/Skeleton";

export interface AiCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  isKhmer: boolean;
  phoenix?: boolean;
  enableLiveSupport?: boolean;
  currentUserId?: number | null;
  csrfToken?: string;
  scope?: string;
  userName?: string;
  bottomOffsetClass?: string;
}

interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  error?: boolean;
  failedQuery?: string;
}

interface DrawerTheme {
  shell: string;
  header: string;
  headerBadgeAi: string;
  headerBadgeSupport: string;
  headerTitle: string;
  headerSub: string;
  headerActionBtn: string;
  tabBar: string;
  tabActiveAi: string;
  tabActiveSupport: string;
  tabInactive: string;
  viewport: string;
  emptyCard: string;
  promptCard: string;
  assistantAvatar: string;
  assistantBubble: string;
  userBubble: string;
  errorBubble: string;
  metaText: string;
  copyBtn: string;
  composerWrap: string;
  composerBox: string;
  textarea: string;
  sendBtnAi: string;
  sendBtnSupport: string;
  toolIconBtn: string;
}

function getDrawerTheme(phoenix: boolean): DrawerTheme {
  if (phoenix) {
    return {
      shell:
        "rounded-2xl border border-[#cbd0dd] bg-white shadow-[0_24px_56px_-12px_rgba(15,17,26,0.22)] dark:border-[#373e53] dark:bg-[#141824] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.68)]",
      header:
        "border-b border-[#e3e6ed] bg-white dark:border-[#2b3245] dark:bg-[#141824]",
      headerBadgeAi:
        "bg-gradient-to-br from-[#3874ff] to-[#004dff] text-white shadow-sm shadow-[#3874ff]/25",
      headerBadgeSupport:
        "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20",
      headerTitle: "text-[#141824] dark:text-[#eff2f6]",
      headerSub: "text-[#6e7891] dark:text-[#9fa6bc]",
      headerActionBtn:
        "text-[#525b75] hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]",
      tabBar:
        "border-b border-[#e3e6ed] bg-[#f5f7fa] dark:border-[#2b3245] dark:bg-[#0f111a]/70",
      tabActiveAi:
        "bg-white text-[#3874ff] shadow-xs ring-1 ring-[#cbd0dd]/80 dark:bg-[#181d2b] dark:text-[#85a9ff] dark:ring-[#373e53]",
      tabActiveSupport:
        "bg-white text-emerald-700 shadow-xs ring-1 ring-[#cbd0dd]/80 dark:bg-[#181d2b] dark:text-emerald-400 dark:ring-[#373e53]",
      tabInactive:
        "text-[#525b75] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#eff2f6]",
      viewport: "bg-[#f5f7fa]/85 dark:bg-[#0f111a]/75",
      emptyCard:
        "border border-[#e3e6ed] bg-white shadow-xs dark:border-[#2b3245] dark:bg-[#181d2b]",
      promptCard:
        "border border-[#e3e6ed] bg-white text-[#31374a] hover:border-[#3874ff]/55 hover:bg-[#eff2f6]/65 dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:border-[#3874ff]/60 dark:hover:bg-[#1e2436]",
      assistantAvatar:
        "border border-[#cbd0dd] bg-white text-[#3874ff] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#85a9ff]",
      assistantBubble:
        "border border-[#e3e6ed] bg-white text-[#31374a] shadow-xs dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#eff2f6]",
      userBubble: "bg-[#3874ff] text-white shadow-sm shadow-[#3874ff]/20",
      errorBubble:
        "border border-rose-200 bg-rose-50/90 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200",
      metaText: "text-[#8a94ad] dark:text-[#6e7891]",
      copyBtn:
        "text-[#6e7891] hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#22283a] dark:hover:text-[#eff2f6]",
      composerWrap:
        "border-t border-[#e3e6ed] bg-white dark:border-[#2b3245] dark:bg-[#141824]",
      composerBox:
        "border border-[#cbd0dd] bg-[#f5f7fa]/70 focus-within:border-[#3874ff] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3874ff]/15 dark:border-[#373e53] dark:bg-[#0f111a] dark:focus-within:border-[#3874ff] dark:focus-within:bg-[#0f111a]",
      textarea:
        "text-[#141824] placeholder:text-[#8a94ad] dark:text-[#eff2f6] dark:placeholder:text-[#6e7891]",
      sendBtnAi: "bg-[#3874ff] text-white hover:bg-[#004dff] shadow-xs shadow-[#3874ff]/25",
      sendBtnSupport: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs",
      toolIconBtn:
        "text-[#525b75] hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]",
    };
  }

  return {
    shell:
      "rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_56px_-12px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-obsidian-900 dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)]",
    header:
      "border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-obsidian-900",
    headerBadgeAi:
      "bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25",
    headerBadgeSupport:
      "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20",
    headerTitle: "text-slate-900 dark:text-slate-50",
    headerSub: "text-slate-500 dark:text-slate-400",
    headerActionBtn:
      "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-obsidian-800 dark:hover:text-slate-100",
    tabBar:
      "border-b border-slate-200/80 bg-slate-50/90 dark:border-slate-800 dark:bg-obsidian-950/60",
    tabActiveAi:
      "bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200/90 dark:bg-obsidian-850 dark:text-indigo-400 dark:ring-slate-700",
    tabActiveSupport:
      "bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/90 dark:bg-obsidian-850 dark:text-emerald-400 dark:ring-slate-700",
    tabInactive:
      "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
    viewport: "bg-slate-50/80 dark:bg-obsidian-950/60",
    emptyCard:
      "border border-slate-200/85 bg-white shadow-xs dark:border-slate-800 dark:bg-obsidian-850",
    promptCard:
      "border border-slate-200/90 bg-white text-slate-700 hover:border-indigo-400/70 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-obsidian-850 dark:text-slate-200 dark:hover:border-indigo-500/50 dark:hover:bg-obsidian-800",
    assistantAvatar:
      "border border-slate-200 bg-white text-indigo-600 dark:border-slate-700 dark:bg-obsidian-850 dark:text-indigo-400",
    assistantBubble:
      "border border-slate-200/90 bg-white text-slate-800 shadow-xs dark:border-slate-800 dark:bg-obsidian-850 dark:text-slate-100",
    userBubble: "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20",
    errorBubble:
      "border border-rose-200 bg-rose-50/90 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200",
    metaText: "text-slate-400 dark:text-slate-500",
    copyBtn:
      "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-obsidian-800 dark:hover:text-slate-200",
    composerWrap:
      "border-t border-slate-200/80 bg-white dark:border-slate-800 dark:bg-obsidian-900",
    composerBox:
      "border border-slate-200 bg-slate-50/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/15 dark:border-slate-700/80 dark:bg-obsidian-950 dark:focus-within:border-indigo-400",
    textarea:
      "text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500",
    sendBtnAi: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs",
    sendBtnSupport: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs",
    toolIconBtn:
      "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-obsidian-800 dark:hover:text-slate-100",
  };
}

function getQuickPrompts(
  scope: string | undefined,
  isKhmer: boolean,
): Array<{ label: string; prompt: string }> {
  if (scope === "admin") {
    return isKhmer
      ? [
          {
            label: "ការគ្រប់គ្រងអ្នកប្រើប្រាស់ និងតួនាទី",
            prompt: "តើខ្ញុំអាចគ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ កំណត់តួនាទី និងពិនិត្យ Audit Logs ក្នុងប្រព័ន្ធដូចម្តេច?",
          },
          {
            label: "ការកំណត់ជំងឺ និងក្បួនវិនិច្ឆ័យ (Rules)",
            prompt: "តើរបៀបបន្ថែមជំងឺដំណាំថ្មី និងកំណត់ក្បួនរោគសញ្ញា (Rule Engine) ក្នុងផ្ទាំង Admin ធ្វើដូចម្តេច?",
          },
          {
            label: "ស្ថាបត្យកម្មប្រព័ន្ធ និងសមាជិកក្រុម",
            prompt: "សូមរៀបរាប់អំពីស្ថាបត្យកម្មបច្ចេកទេសនៃគម្រោង AgriSystem និងសមាជិកក្រុមអភិវឌ្ឍន៍។",
          },
        ]
      : [
          {
            label: "Manage users, roles & audit logs",
            prompt: "How do I manage user accounts, assign roles, and inspect security audit logs in the Admin Portal?",
          },
          {
            label: "Configure diseases & rule engine",
            prompt: "How do I add crop diseases and configure symptom decision rules in the Admin Portal?",
          },
          {
            label: "System architecture & project team",
            prompt: "Tell me about the AgriSystem project architecture, technology stack, and development team.",
          },
        ];
  }

  if (scope === "expert") {
    return isKhmer
      ? [
          {
            label: "ការត្រួតពិនិត្យ និងបញ្ជាក់រោគវិនិច្ឆ័យ",
            prompt: "តើអ្នកជំនាញត្រូវត្រួតពិនិត្យ និងអនុម័តលទ្ធផលវិនិច្ឆ័យរបស់កសិករនៅក្នុងប្រព័ន្ធដូចម្តេច?",
          },
          {
            label: "ការគ្រប់គ្រងមូលដ្ឋានទិន្នន័យជំងឺ",
            prompt: "តើខ្ញុំអាចកែសម្រួលព័ត៌មានជំងឺដំណាំ និងការព្យាបាលនៅក្នុង Expert Portal ដោយរបៀបណា?",
          },
          {
            label: "ការឆ្លើយតបសារពិគ្រោះជាមួយកសិករ",
            prompt: "តើមុខងារ Consultations និង Live Support សម្រាប់ជជែកជាមួយកសិករដំណើរការដូចម្តេច?",
          },
        ]
      : [
          {
            label: "Review & verify farmer diagnoses",
            prompt: "How do I review, verify, and confirm farmer diagnosis submissions in the Expert Portal?",
          },
          {
            label: "Manage disease knowledge base",
            prompt: "How do I update plant disease descriptions and treatment guides in the Expert Portal?",
          },
          {
            label: "Farmer consultations & live chat",
            prompt: "How do Expert Consultations and Live Support channels work in AgriSystem?",
          },
        ];
  }

  return isKhmer
    ? [
        {
          label: "របៀបប្រើប្រាស់មុខងារពិនិត្យជំងឺ",
          prompt: "តើរបៀបប្រើប្រាស់ AI Diagnosis និង Rule-Based Diagnosis នៅក្នុងប្រព័ន្ធ AgriSystem ធ្វើដូចម្តេច?",
        },
        {
          label: "អំពីគម្រោង និងសមាជិកក្រុមអភិវឌ្ឍន៍",
          prompt: "សូមរៀបរាប់អំពីប្រព័ន្ធគម្រោង AgriSystem សាស្ត្រាចារ្យដឹកនាំ និងសមាជិកក្រុមអភិវឌ្ឍន៍។",
        },
        {
          label: "គណនី សុវត្ថិភាព Passkey និងការដំឡើង Pro",
          prompt: "តើខ្ញុំអាចកំណត់ Passkey ផ្លាស់ប្តូរភាសា ឬដំឡើងគណនី Pro តាមរយៈ Bakong KHQR ដោយរបៀបណា?",
        },
      ]
    : [
        {
          label: "How to use Diagnosis & platform tools",
          prompt: "How do I use AI Diagnosis, Rule-Based Diagnosis, and Ask Agricultural Expert in this system?",
        },
        {
          label: "About the project & development team",
          prompt: "Tell me about the AgriSystem project architecture, supervisor, and development team.",
        },
        {
          label: "Account, Passkeys & Bakong Pro upgrade",
          prompt: "How do I set up Passkeys, switch language/theme, or upgrade to Pro using Bakong KHQR?",
        },
      ];
}

function formatNowClock(): string {
  return new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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

function formatMessageText(text: string): React.ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
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

export function AiCopilotDrawer({
  open,
  onClose,
  isKhmer,
  phoenix = false,
  enableLiveSupport = false,
  currentUserId = null,
  csrfToken = "",
  scope,
  userName,
  bottomOffsetClass = "bottom-4 right-4 sm:bottom-5 sm:right-5",
}: AiCopilotDrawerProps) {
  const [mode, setMode] = useState<"ai" | "support">("ai");
  const [expanded, setExpanded] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Support (Farmer <-> Admin / Expert) state
  const [supportTarget, setSupportTarget] = useState<SupportTarget>("admin");
  const [supportChannels, setSupportChannels] = useState<SupportChannelsMap | null>(null);
  const [supportMessages, setSupportMessages] = useState<LiveSupportMsg[]>([]);
  const [supportDraft, setSupportDraft] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [supportTyping, setSupportTyping] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  const lastSupportIdRef = useRef<number>(0);
  const supportTargetRef = useRef<SupportTarget>(supportTarget);
  const lastTypingEmitRef = useRef<number>(0);

  useEffect(() => {
    supportTargetRef.current = supportTarget;
  }, [supportTarget]);
  const supportEndRef = useRef<HTMLDivElement>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const supportPollCountRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const theme = useMemo(() => getDrawerTheme(phoenix), [phoenix]);
  const quickPrompts = useMemo(() => getQuickPrompts(scope, isKhmer), [scope, isKhmer]);
  const firstName = useMemo(() => {
    const clean = (userName || "").trim();
    if (!clean) return "";
    return clean.split(/\s+/)[0];
  }, [userName]);

  const refreshSupportChannels = useCallback(async () => {
    if (!enableLiveSupport) return;
    try {
      const resp = await fetch("/farmer/support_chat/channels", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) return;
      const json = (await resp.json()) as { channels?: SupportChannelsMap };
      if (json.channels) {
        setSupportChannels(json.channels);
      }
    } catch {
      // Ignore transient channel poll failure
    }
  }, [enableLiveSupport]);

  const loadSupportHistory = useCallback(async () => {
    if (!enableLiveSupport) return;
    const activeTarget = supportTargetRef.current;
    setSupportLoading(true);
    setSupportError(null);
    setSupportTyping(false);
    lastSupportIdRef.current = 0;
    try {
      const resp = await fetch(
        buildFarmerSupportQueryUrl("/farmer/support_chat/messages", {
          target: activeTarget,
          envelope: true,
        }),
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      if (!resp.ok) throw new Error("Failed");
      const json = (await resp.json()) as LiveEnvelopeResponse;
      if (supportTargetRef.current !== activeTarget) return;
      const list = json.messages || [];
      lastSupportIdRef.current = list.length ? list[list.length - 1].id : 0;
      setSupportMessages(mergeSupportMessages([], list, json.read_ids || []));
      setSupportTyping(Boolean(json.partner_typing));
      void refreshSupportChannels();
      window.requestAnimationFrame(() =>
        supportEndRef.current?.scrollIntoView({ behavior: "auto" }),
      );
    } catch {
      setSupportError(
        isKhmer ? "មិនអាចភ្ជាប់ជំនួយផ្ទាល់បានទេ។" : "Could not load live support chat.",
      );
    } finally {
      setSupportLoading(false);
    }
  }, [enableLiveSupport, isKhmer, refreshSupportChannels]);

  const pollSupportDelta = useCallback(async () => {
    if (!enableLiveSupport) return;
    const activeTarget = supportTargetRef.current;
    try {
      const resp = await fetch(
        buildFarmerSupportQueryUrl("/farmer/support_chat/messages", {
          target: activeTarget,
          afterId: lastSupportIdRef.current,
          envelope: true,
        }),
        { credentials: "include", headers: { Accept: "application/json" } },
      );
      if (!resp.ok) return;
      const json = (await resp.json()) as LiveEnvelopeResponse;
      if (supportTargetRef.current !== activeTarget) return;
      const incoming = json.messages || [];
      const readIds = json.read_ids || [];
      setSupportTyping(Boolean(json.partner_typing));
      const hasUpdates = incoming.length > 0 || readIds.length > 0;
      if (hasUpdates) {
        if (incoming.length > 0) {
          lastSupportIdRef.current = Math.max(
            lastSupportIdRef.current,
            incoming[incoming.length - 1].id,
          );
        }
        setSupportMessages((prev) => mergeSupportMessages(prev, incoming, readIds));
        if (incoming.length > 0) {
          window.requestAnimationFrame(() =>
            supportEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          );
        }
      }
      supportPollCountRef.current += 1;
      if (hasUpdates || supportPollCountRef.current % 4 === 0) {
        void refreshSupportChannels();
      }
    } catch {
      // Ignore transient poll error
    }
  }, [enableLiveSupport, refreshSupportChannels]);

  useEffect(() => {
    if (open && enableLiveSupport && mode === "support") {
      setSupportMessages([]);
      void loadSupportHistory();
      const timer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void pollSupportDelta();
        }
      }, 4500);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [open, enableLiveSupport, mode, supportTarget, loadSupportHistory, pollSupportDelta]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (open && mode === "ai") {
      window.requestAnimationFrame(() => {
        aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [open, mode, aiMessages.length, aiBusy]);

  useEffect(() => {
    if (open && mode === "ai") {
      window.setTimeout(() => aiTextareaRef.current?.focus(), 60);
    }
  }, [open, mode]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  if (!open) return null;

  const submitAiQuestion = async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q || aiBusy) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      text: q,
      createdAt: formatNowClock(),
    };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    if (aiTextareaRef.current) {
      aiTextareaRef.current.style.height = "auto";
    }
    setAiBusy(true);

    try {
      const currentPage =
        typeof window !== "undefined" ? window.location.pathname : "";
      const reply = await askAgriExpert(q, {
        endpoint: "/assistant/ask",
        page: currentPage,
        signal: controller.signal,
        csrfToken: csrfToken || undefined,
      });
      if (controller.signal.aborted) return;
      setAiMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "assistant",
          text: reply,
          createdAt: formatNowClock(),
        },
      ]);
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg =
        err instanceof Error
          ? err.message
          : isKhmer
            ? "ជំនួយការ AI មិនអាចឆ្លើយតបបានទេនៅពេលនេះ។"
            : "Assistant is temporarily unavailable.";
      setAiMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "assistant",
          text: msg,
          createdAt: formatNowClock(),
          error: true,
          failedQuery: q,
        },
      ]);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setAiBusy(false);
    }
  };

  const handleAskAi = (e: React.FormEvent) => {
    e.preventDefault();
    void submitAiQuestion(aiInput);
  };

  const handleAiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitAiQuestion(aiInput);
    }
  };

  const handleClearAi = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAiBusy(false);
    setAiMessages([]);
    window.setTimeout(() => aiTextareaRef.current?.focus(), 40);
  };

  const handleCopyReply = async (id: string, text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Clipboard write unavailable
    }
  };

  const emitFarmerTyping = () => {
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 2500) return;
    lastTypingEmitRef.current = now;
    void fetch("/farmer/support_chat/typing", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({ target: supportTarget }),
    }).catch(() => {});
  };

  const sendSupportPayload = async (payload: {
    message?: string;
    attachment_url?: string;
    attachment_type?: string;
  }) => {
    if (supportSending) return;
    const activeTarget = supportTarget;
    setSupportError(null);
    setSupportSending(true);
    try {
      const res = await requestJson<{ success?: boolean; message?: LiveSupportMsg }>(
        "/farmer/support_chat/send",
        "POST",
        csrfToken,
        {
          ...payload,
          target: activeTarget,
        },
      );
      if (res.data?.message && supportTargetRef.current === activeTarget) {
        const saved = res.data.message;
        lastSupportIdRef.current = Math.max(lastSupportIdRef.current, saved.id);
        setSupportMessages((prev) => mergeSupportMessages(prev, [saved]));
      } else {
        await pollSupportDelta();
      }
      void refreshSupportChannels();
      window.requestAnimationFrame(() =>
        supportEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch (err) {
      setSupportError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSupportSending(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = supportDraft.trim();
    if (!text) return;
    setSupportDraft("");
    await sendSupportPayload({ message: text });
  };

  const handleSupportPhoto = async (file: File) => {
    const err = validateAttachmentFile(file, "image");
    if (err) {
      setSupportError(err);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setSupportSending(true);
    try {
      const resp = await fetch("/farmer/support_chat/upload", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken },
        body: fd,
      });
      const json = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !json.url) throw new Error(json.error || "Upload failed");
      setSupportSending(false);
      await sendSupportPayload({ attachment_url: json.url, attachment_type: "image" });
    } catch (e) {
      setSupportError(e instanceof Error ? e.message : "Upload failed");
      setSupportSending(false);
    }
  };

  const handleSupportLocation = async () => {
    const coords = await resolveLocationDraftCoords({
      geolocation: typeof navigator !== "undefined" ? navigator.geolocation : null,
    });
    await sendSupportPayload({
      message: coords.label ? `Location: ${coords.label}` : "",
      attachment_url: coords.coordString,
      attachment_type: "location",
    });
  };

  const drawerWidthHeight = expanded
    ? "h-[650px] max-h-[calc(100dvh-6.75rem-env(safe-area-inset-bottom))] w-[calc(100vw-1.5rem)] sm:w-[540px]"
    : "h-[540px] max-h-[calc(100dvh-6.75rem-env(safe-area-inset-bottom))] w-[calc(100vw-1.5rem)] sm:w-[420px]";

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={isKhmer ? "ជំនួយការ AI កសិកម្ម" : "Agri AI Copilot"}
      className={cn(
        "ai-surface animate-fade-in-up fixed z-50 flex flex-col overflow-hidden transition-[width,height] duration-200 ease-out",
        bottomOffsetClass,
        drawerWidthHeight,
        theme.shell,
      )}
    >
      {/* Executive Header */}
      <div className={cn("flex items-center justify-between gap-2 px-4 py-3", theme.header)}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              mode === "ai" ? theme.headerBadgeAi : theme.headerBadgeSupport,
            )}
          >
            {mode === "ai" ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Headphones className="h-4 w-4" />
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#141824]"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className={cn("truncate text-sm font-semibold tracking-tight", theme.headerTitle)}>
                {mode === "ai"
                  ? isKhmer
                    ? "ជំនួយការ AI កសិកម្ម"
                    : "Agri AI Copilot"
                  : supportTarget === "expert"
                    ? isKhmer
                      ? "ជជែកផ្ទាល់ជាមួយអ្នកជំនាញ"
                      : "Live Expert Support"
                    : isKhmer
                      ? "ជជែកផ្ទាល់ជាមួយ Admin"
                      : "Live Admin Support"}
              </h2>
            </div>
            <p className={cn("truncate text-[11px] font-medium", theme.headerSub)}>
              {mode === "ai"
                ? isKhmer
                  ? "អនឡាញ · ជំនួយការប្រព័ន្ធ និងគម្រោង"
                  : "Online · System & project assistant"
                : supportTyping
                  ? isKhmer
                    ? "កំពុងវាយអក្សរ..."
                    : `${supportTarget === "expert" ? "Expert" : "Admin"} is typing...`
                  : supportTarget === "expert"
                    ? isKhmer
                      ? "ភ្ជាប់ផ្ទាល់ជាមួយអ្នកជំនាញកសិកម្ម"
                      : "Direct channel with Agricultural Expert"
                    : isKhmer
                      ? "ភ្ជាប់ផ្ទាល់ជាមួយអ្នកគ្រប់គ្រងប្រព័ន្ធ"
                      : "Direct channel with Platform Admin"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {mode === "ai" && aiMessages.length > 0 && (
            <button
              type="button"
              onClick={handleClearAi}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                theme.headerActionBtn,
              )}
              title={isKhmer ? "សម្អាតការសន្ទនា" : "Clear conversation"}
              aria-label={isKhmer ? "សម្អាតការសន្ទនា" : "Clear conversation"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={cn(
              "hidden h-8 w-8 items-center justify-center rounded-lg transition-colors sm:inline-flex",
              theme.headerActionBtn,
            )}
            title={
              expanded
                ? isKhmer
                  ? "បង្រួមផ្ទាំង"
                  : "Compact view"
                : isKhmer
                  ? "ពង្រីកផ្ទាំង"
                  : "Expand view"
            }
            aria-label={expanded ? "Compact view" : "Expand view"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              theme.headerActionBtn,
            )}
            title={isKhmer ? "បិទ (Esc)" : "Close (Esc)"}
            aria-label={isKhmer ? "បិទ" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mode Switcher Bar (Farmers only when Live Support enabled) */}
      {enableLiveSupport && (
        <div className={cn("px-3.5 py-2", theme.tabBar)}>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.04]">
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                mode === "ai" ? theme.tabActiveAi : theme.tabInactive,
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{isKhmer ? "ជំនួយការ AI" : "AI Copilot"}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("support")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                mode === "support" ? theme.tabActiveSupport : theme.tabInactive,
              )}
            >
              <Headphones className="h-3.5 w-3.5" />
              <span>{isKhmer ? "ជំនួយផ្ទាល់" : "Live Support"}</span>
            </button>
          </div>

          {mode === "support" && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200/80 bg-white/75 p-1 dark:border-slate-800 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setSupportTarget("admin")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all",
                  supportTarget === "admin"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : theme.tabInactive,
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{isKhmer ? "ផ្ញើទៅ Admin" : "Message Admin"}</span>
                {(supportChannels?.admin?.unreadCount || 0) > 0 && (
                  <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
                    {supportChannels?.admin?.unreadCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSupportTarget("expert")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all",
                  supportTarget === "expert"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : theme.tabInactive,
                )}
              >
                <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{isKhmer ? "ផ្ញើទៅ Expert" : "Message Expert"}</span>
                {(supportChannels?.expert?.unreadCount || 0) > 0 && (
                  <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
                    {supportChannels?.expert?.unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "ai" ? (
        <>
          {/* AI Messages Viewport */}
          <div className={cn("phoenix-scroll flex-1 overflow-y-auto px-4 py-4", theme.viewport)}>
            {aiMessages.length === 0 ? (
              <div className="flex h-full flex-col justify-between gap-4">
                <div className={cn("rounded-2xl p-4", theme.emptyCard)}>
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        phoenix
                          ? "bg-[#3874ff]/10 text-[#3874ff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                          : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
                      )}
                    >
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className={cn("text-sm font-semibold", theme.headerTitle)}>
                        {isKhmer
                          ? `សួស្តី${firstName ? ` ${firstName}` : ""}! តើខ្ញុំអាចជួយអ្វីបានខ្លះ?`
                          : `Hello${firstName ? `, ${firstName}` : ""}! How can I help?`}
                      </h3>
                      <p className={cn("mt-1 text-xs leading-relaxed", theme.headerSub)}>
                        {isKhmer
                          ? "សួរអំពីរបៀបប្រើប្រាស់ប្រព័ន្ធ មុខងារក្នុងគម្រោង សមាជិកក្រុមអភិវឌ្ឍន៍ សុវត្ថិភាពគណនី ឬការដំឡើងគម្រោង Pro។"
                          : "Ask about system navigation, project architecture, team members, platform features, account security, or Bakong Pro upgrades."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={cn("px-1 text-[11px] font-semibold uppercase tracking-wider", theme.metaText)}>
                    {isKhmer ? "សំណួរណែនាំរហ័ស" : "Suggested prompts"}
                  </p>
                  <div className="space-y-1.5">
                    {quickPrompts.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => void submitAiQuestion(item.prompt)}
                        className={cn(
                          "group flex w-full items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all",
                          theme.promptCard,
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold leading-snug">{item.label}</div>
                          <div className={cn("mt-0.5 truncate text-[11px]", theme.headerSub)}>
                            {item.prompt}
                          </div>
                        </div>
                        <Send className={cn("h-3.5 w-3.5 shrink-0 opacity-45 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100")} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {aiMessages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex flex-col items-end gap-1">
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[13px] leading-relaxed",
                          theme.userBubble,
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      </div>
                      <span className={cn("px-1 text-[10px]", theme.metaText)}>
                        {m.createdAt}
                      </span>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          m.error
                            ? "border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
                            : theme.assistantAvatar,
                        )}
                      >
                        {m.error ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 max-w-[86%] flex-1">
                        <div
                          className={cn(
                            "rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px]",
                            m.error ? theme.errorBubble : theme.assistantBubble,
                          )}
                        >
                          {formatMessageText(m.text)}
                        </div>
                        <div className="mt-1 flex items-center gap-2 px-1">
                          <span className={cn("text-[10px]", theme.metaText)}>{m.createdAt}</span>
                          {!m.error ? (
                            <button
                              type="button"
                              onClick={() => void handleCopyReply(m.id, m.text)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                                theme.copyBtn,
                              )}
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
                          ) : (
                            m.failedQuery && (
                              <button
                                type="button"
                                onClick={() => void submitAiQuestion(m.failedQuery!)}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-100/70 dark:text-rose-400 dark:hover:bg-rose-950/50"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>{isKhmer ? "សាកល្បងម្តងទៀត" : "Retry"}</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                )}

                {aiBusy && (
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        theme.assistantAvatar,
                      )}
                    >
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <AiThinkingSkeleton
                      compact
                      label={isKhmer ? "កំពុងវិភាគ..." : "Thinking..."}
                      bubbleClassName={theme.assistantBubble}
                    />
                  </div>
                )}
                <div ref={aiEndRef} />
              </div>
            )}
          </div>

          {/* AI Composer */}
          <form onSubmit={handleAskAi} className={cn("px-3.5 pb-3 pt-2.5", theme.composerWrap)}>
            <div className={cn("flex items-end gap-2 rounded-xl p-1.5 transition-all", theme.composerBox)}>
              <textarea
                ref={aiTextareaRef}
                rows={1}
                value={aiInput}
                onKeyDown={handleAiKeyDown}
                onChange={(e) => {
                  setAiInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 108)}px`;
                }}
                placeholder={isKhmer ? "សួរជំនួយការ AI..." : "Ask Agri AI Copilot..."}
                className={cn(
                  "max-h-[108px] min-h-[34px] flex-1 resize-none border-0 bg-transparent px-2.5 py-1.5 text-[13px] leading-5 shadow-none focus:outline-none focus:ring-0",
                  theme.textarea,
                )}
              />
              <button
                type="submit"
                disabled={aiBusy || !aiInput.trim()}
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  theme.sendBtnAi,
                )}
                aria-label={isKhmer ? "ផ្ញើសំណួរ" : "Send question"}
              >
                {aiBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px]">
              <span className={theme.metaText}>
                {isKhmer ? "Enter ផ្ញើ · Shift+Enter ចុះបន្ទាត់" : "Enter to send · Shift+Enter new line"}
              </span>
              {aiInput.length > 350 && (
                <span className={theme.metaText}>{aiInput.length}/2000</span>
              )}
            </div>
          </form>
        </>
      ) : (
        <>
          {/* Live Support Messages Viewport */}
          <div className={cn("phoenix-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4", theme.viewport)}>
            {supportError && (
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs",
                  theme.errorBubble,
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{supportError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadSupportHistory()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold hover:bg-rose-200/50 dark:hover:bg-rose-900/40"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>{isKhmer ? "ផ្ទុកឡើងវិញ" : "Retry"}</span>
                </button>
              </div>
            )}

            {supportLoading && supportMessages.length === 0 ? (
              <ChatThreadSkeleton
                compact
                phoenix={phoenix}
                count={4}
                label={isKhmer ? "កំពុងភ្ជាប់ជំនួយផ្ទាល់..." : "Connecting to live support..."}
              />
            ) : supportMessages.length === 0 ? (
              <div className={cn("rounded-2xl p-4", theme.emptyCard)}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className={cn("text-sm font-semibold", theme.headerTitle)}>
                      {supportTarget === "expert"
                        ? isKhmer
                          ? "សន្ទនាផ្ទាល់ជាមួយអ្នកជំនាញកសិកម្ម"
                          : "Message Agricultural Expert"
                        : isKhmer
                          ? "សន្ទនាផ្ទាល់ជាមួយអ្នកគ្រប់គ្រង"
                          : "Message Platform Admin"}
                    </h3>
                    <p className={cn("mt-1 text-xs leading-relaxed", theme.headerSub)}>
                      {supportTarget === "expert"
                        ? isKhmer
                          ? "ផ្ញើសារ រូបភាពស្លឹកដំណាំ ឬទីតាំង GPS ទៅអ្នកជំនាញកសិកម្ម។"
                          : "Send crop photos, symptoms, or farm GPS location to an Agricultural Expert."
                        : isKhmer
                          ? "ផ្ញើសារ រូបភាព ឬសំណួរអំពីគណនីទៅកាន់អ្នកគ្រប់គ្រងប្រព័ន្ធ។"
                          : "Ask Platform Admin about your account, billing, or technical issues."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              supportMessages.map((msg) => {
                const mine = currentUserId !== null && msg.sender_id === currentUserId;
                const safe = normalizeSupportMessageAttachment(msg);
                return (
                  <div
                    key={msg.id}
                    className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                        mine
                          ? "rounded-br-sm bg-emerald-600 text-white shadow-sm"
                          : cn("rounded-bl-sm", theme.assistantBubble),
                      )}
                    >
                      {safe.kind === "image" && safe.url && (
                        <a
                          href={safe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-1.5 block overflow-hidden rounded-lg"
                        >
                          <img
                            src={safe.url}
                            alt="Support attachment"
                            className="max-h-44 w-full rounded-lg object-cover transition-transform hover:scale-[1.01]"
                          />
                        </a>
                      )}
                      {safe.kind === "audio" && safe.url && (
                        <audio controls src={safe.url} className="mb-1.5 h-8 w-full max-w-[230px]" />
                      )}
                      {safe.kind === "location" && safe.location && (
                        <a
                          href={safe.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "mb-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium underline decoration-current/40 underline-offset-2",
                            mine
                              ? "bg-white/15 text-white hover:bg-white/25"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300",
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span>{safe.location.label}</span>
                        </a>
                      )}
                      {safe.text && <p className="whitespace-pre-wrap break-words">{safe.text}</p>}
                    </div>
                    <div className={cn("flex items-center gap-1 px-1 text-[10px]", theme.metaText)}>
                      <span>{formatChatClock(msg.created_at)}</span>
                      {mine &&
                        (msg.is_read ? (
                          <CheckCheck className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Check className="h-3 w-3 opacity-60" />
                        ))}
                    </div>
                  </div>
                );
              })
            )}

            {supportTyping && (
              <div className="flex items-center gap-2 px-1">
                <span className="inline-flex items-center gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
                </span>
                <span className={cn("text-[11px] font-medium", theme.headerSub)}>
                  {isKhmer ? "ក្រុមការងារកំពុងវាយអក្សរ..." : "Support team is typing..."}
                </span>
              </div>
            )}
            <div ref={supportEndRef} />
          </div>

          {/* Live Support Composer */}
          <form onSubmit={handleSupportSubmit} className={cn("px-3.5 pb-3 pt-2.5", theme.composerWrap)}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleSupportPhoto(file);
              }}
            />
            <div className={cn("flex items-center gap-1 rounded-xl p-1.5 transition-all", theme.composerBox)}>
              <button
                type="button"
                disabled={supportSending}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
                  theme.toolIconBtn,
                )}
                title={isKhmer ? "ផ្ញើរូបភាព" : "Attach photo"}
                aria-label={isKhmer ? "ផ្ញើរូបភាព" : "Attach photo"}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={supportSending}
                onClick={() => void handleSupportLocation()}
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
                  theme.toolIconBtn,
                )}
                title={isKhmer ? "ចែករំលែកទីតាំង GPS" : "Share GPS location"}
                aria-label={isKhmer ? "ចែករំលែកទីតាំង GPS" : "Share GPS location"}
              >
                <MapPin className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={supportDraft}
                onChange={(e) => {
                  setSupportDraft(e.target.value);
                  emitFarmerTyping();
                }}
                placeholder={
                  supportTarget === "expert"
                    ? isKhmer
                      ? "សរសេរសារទៅអ្នកជំនាញ..."
                      : "Message Agricultural Expert..."
                    : isKhmer
                      ? "សរសេរសារទៅ Admin..."
                      : "Message Platform Admin..."
                }
                className={cn(
                  "min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-[13px] shadow-none focus:outline-none focus:ring-0",
                  theme.textarea,
                )}
              />
              <button
                type="submit"
                disabled={supportSending || !supportDraft.trim()}
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  theme.sendBtnSupport,
                )}
                aria-label={isKhmer ? "ផ្ញើសារ" : "Send message"}
              >
                {supportSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
