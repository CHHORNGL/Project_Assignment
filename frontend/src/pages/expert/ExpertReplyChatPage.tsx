import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, MessageSquare, Send, ShieldCheck, User } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, formatShortDateTime } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface ReplyChatData {
  activeSession: {
    id: number;
    title: string;
    farmerName: string;
    updatedAt?: string | null;
    postUrl: string;
  };
  links: {
    farmerChatsUrl: string;
    dashboardUrl: string;
  };
  messages: Array<{
    id: number;
    sender: string;
    message: string;
    createdAt?: string | null;
    authorName: string;
  }>;
}

export default function ExpertReplyChatPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<ReplyChatData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const sections = ui.sections || {};
  const labels = ui.labels || {};
  const [draft, setDraft] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
  }, [d.messages.length]);

  const quickReplies = useMemo(
    () =>
      isKhmer
        ? [
            "សូមថតរូបស្លឹកដំណាំឱ្យច្បាស់បន្ថែមទៀត ដើម្បីឱ្យខ្ញុំជួយពិនិត្យ។",
            "សូមកាត់ស្លឹកដែលឆ្លងជំងឺធ្ងន់ធ្ងរចេញ និងតាមដានក្នុងរយៈពេល 48 ម៉ោង។",
          ]
        : [
            "Please share a close-up photo of the affected leaf underside so we can confirm the symptoms.",
            "Remove heavily affected leaves safely and check adjacent plants again within 48 hours.",
          ],
    [isKhmer],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim()) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <AdminSectionCard delayIndex={0}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e5edff] font-display text-base font-bold text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                {(d.activeSession.farmerName || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {d.activeSession.title}
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                  <span>
                    {labels.farmer || "Farmer"}:{" "}
                    <span className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                      {d.activeSession.farmerName}
                    </span>
                  </span>
                  <span>·</span>
                  <span className="font-mono">
                    {sections.session || "Session"} #{d.activeSession.id}
                  </span>
                  {d.activeSession.updatedAt && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3" />
                        {formatShortDateTime(d.activeSession.updatedAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={d.links.farmerChatsUrl}
                className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{labels.back || (isKhmer ? "ត្រឡប់ក្រោយ" : "All chats")}</span>
              </a>
              <AdminStatusBadge tone="emerald" pulse>
                {sections.online || "Expert Reply"}
              </AdminStatusBadge>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={1} noPadding>
          <div className="bg-[#f5f7fa]/75 p-3.5 dark:bg-[#0f111a]/65 sm:p-5">
            {d.messages.length === 0 ? (
              <AdminEmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title={sections.emptyTitle || "No messages yet"}
                description={sections.emptyText}
              />
            ) : (
              <div className="phoenix-scroll max-h-[55dvh] space-y-4 overflow-y-auto pr-1 sm:max-h-[480px]">
                {d.messages.map((msg) => {
                  const isExpert = msg.sender === "expert" || msg.sender === "assistant";
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex items-end gap-2.5",
                        isExpert ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          isExpert
                            ? "bg-[#3874ff] text-white"
                            : "border border-[#cbd0dd] bg-white text-[#525b75] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#cbd0dd]",
                        )}
                      >
                        {isExpert ? (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        ) : (
                          <User className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className={cn("flex min-w-0 max-w-[85%] flex-col sm:max-w-[82%]", isExpert ? "items-end" : "items-start")}>
                        <div className="mb-1 flex flex-wrap items-center gap-2 px-1 text-[11px] text-[#8a94ad]">
                          <span className="font-bold text-[#525b75] dark:text-[#cbd0dd]">
                            {msg.authorName}
                          </span>
                          <span className="font-mono">{formatShortDateTime(msg.createdAt)}</span>
                        </div>
                        <div
                          className={cn(
                            "whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs sm:px-4",
                            isExpert
                              ? "rounded-br-sm bg-[#3874ff] text-white"
                              : "rounded-bl-sm border border-[#e3e6ed] bg-white text-[#31374a] dark:border-[#2b3245] dark:bg-[#181d2b] dark:text-[#eff2f6]",
                          )}
                        >
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>
            )}
          </div>

          <form
            ref={formRef}
            method="POST"
            action={d.activeSession.postUrl}
            className="border-t border-[#e3e6ed] bg-white p-3.5 dark:border-[#2b3245] dark:bg-[#141824] sm:p-5"
          >
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {quickReplies.map((snippet, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setDraft((prev) => (prev.trim() ? `${prev.trim()} ${snippet}` : snippet))}
                  className="rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] px-2.5 py-1 text-[11px] font-medium text-[#31374a] transition hover:border-[#3874ff]/50 hover:bg-[#e5edff]/60 hover:text-[#004dff] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#cbd0dd]"
                >
                  + {snippet.slice(0, 46)}…
                </button>
              ))}
            </div>

            {sections.helperText && (
              <p className="mb-2 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                {sections.helperText}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <textarea
                  name="message"
                  rows={3}
                  required
                  value={draft}
                  onKeyDown={handleKeyDown}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={sections.composerHint || "Write expert guidance..."}
                  className="ai-input w-full resize-y text-xs leading-relaxed"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#8a94ad]">
                  <span>
                    {isKhmer ? "ចុច Ctrl/Cmd + Enter ដើម្បីផ្ញើ" : "Press Ctrl/Cmd + Enter to send"}
                  </span>
                  <span className="font-mono">{draft.length}</span>
                </div>
              </div>
              <button type="submit" className="ai-btn-primary h-10 w-full shrink-0 justify-center gap-1.5 px-5 text-xs sm:mb-5 sm:w-auto">
                <Send className="h-3.5 w-3.5" />
                <span>{sections.submit || "Send"}</span>
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
