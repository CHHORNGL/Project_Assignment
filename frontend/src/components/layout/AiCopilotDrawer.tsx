import React, { useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { askAgriExpert } from "@/lib/aiApi";
import { cn } from "@/lib/utils";

export function AiCopilotDrawer({
  open,
  onClose,
  isKhmer,
  phoenix = false,
}: {
  open: boolean;
  onClose: () => void;
  isKhmer: boolean;
  phoenix?: boolean;
}) {
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  if (!open) return null;

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = aiInput.trim();
    if (!q || aiBusy) return;
    setAiMessages((prev) => [...prev, { role: "user", text: q }]);
    setAiInput("");
    setAiBusy(true);
    try {
      const reply = await askAgriExpert(q);
      setAiMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Assistant unavailable.";
      setAiMessages((prev) => [...prev, { role: "assistant", text: msg }]);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "ai-surface animate-fade-in-up fixed bottom-5 right-5 z-50 flex h-[440px] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden",
        phoenix
          ? "rounded-xl border border-[#cbd0dd] shadow-xl dark:border-[#373e53]"
          : "shadow-2xl",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3 text-white",
          phoenix
            ? "border-[#2f67e8] bg-[#3874ff]"
            : "border-slate-200/70 bg-gradient-to-r from-indigo-600 to-blue-600 dark:border-slate-800",
        )}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="text-sm font-bold">
            {isKhmer ? "ជំនួយការកសិកម្ម AI" : "Agri AI Copilot"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={isKhmer ? "បិទ" : "Close"}
          className="rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="phoenix-scroll flex-1 space-y-2.5 overflow-y-auto p-3.5 text-xs">
        {aiMessages.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">
            {isKhmer
              ? "សួរសំណួរអំពីរោគសញ្ញាដំណាំ ជំងឺ ឬការថែទាំ..."
              : "Ask about crop symptoms, treatment plans, or disease risks..."}
          </p>
        ) : (
          aiMessages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "animate-scale-in rounded-2xl px-3 py-2 leading-relaxed",
                msg.role === "user"
                  ? phoenix
                    ? "ml-8 bg-[#3874ff] text-white shadow-sm"
                    : "ml-8 bg-indigo-600 text-white shadow-sm"
                  : phoenix
                    ? "mr-6 bg-[#eff2f6] text-[#31374a] dark:bg-[#1e2436] dark:text-[#eff2f6]"
                    : "mr-6 bg-slate-100 text-slate-800 dark:bg-obsidian-800 dark:text-slate-200",
              )}
            >
              {msg.text}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={handleAskAi}
        className={cn(
          "flex items-center gap-2 border-t p-2.5",
          phoenix ? "border-[#cbd0dd]/80 dark:border-[#373e53]" : "border-slate-200/70 dark:border-slate-800",
        )}
      >
        <input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          placeholder={isKhmer ? "វាយសំណួរ..." : "Ask a question..."}
          className="ai-input py-2 text-xs"
        />
        <button type="submit" disabled={aiBusy} className="ai-btn-primary h-9 w-9 shrink-0 p-0">
          {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
    </div>
  );
}
