import React, { useState } from "react";
import { MessageSquare, Send, User } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
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
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const sections = ui.sections || {};
  const labels = ui.labels || {};
  const [draft, setDraft] = useState("");

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
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e5edff] text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                  {d.activeSession.title}
                </h2>
                <p className="text-xs text-[#6e7891] dark:text-[#8a94ad]">
                  {labels.farmer || "Farmer"}:{" "}
                  <span className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                    {d.activeSession.farmerName}
                  </span>{" "}
                  · {sections.session || "Session"} #{d.activeSession.id}
                </p>
              </div>
            </div>
            <AdminStatusBadge tone="emerald" pulse>
              {sections.online || "Expert Reply"}
            </AdminStatusBadge>
          </div>
        </AdminSectionCard>

        <AdminSectionCard delayIndex={1}>
          {d.messages.length === 0 ? (
            <AdminEmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title={sections.emptyTitle || "No messages yet"}
              description={sections.emptyText}
            />
          ) : (
            <div className="phoenix-scroll max-h-[520px] space-y-4 overflow-y-auto pr-1">
              {d.messages.map((msg) => {
                const isExpert = msg.sender === "expert" || msg.sender === "assistant";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex flex-col", isExpert ? "items-end" : "items-start")}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-[#8a94ad]">
                      <span className="font-bold text-[#525b75] dark:text-[#cbd0dd]">
                        {msg.authorName}
                      </span>
                      <span className="font-mono">
                        {msg.createdAt ? msg.createdAt.slice(0, 16).replace("T", " ") : ""}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-xs leading-relaxed",
                        isExpert
                          ? "bg-[#3874ff] text-white"
                          : "border border-[#e3e6ed] bg-[#f5f7fa] text-[#31374a] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#eff2f6]",
                      )}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form
            method="POST"
            action={d.activeSession.postUrl}
            className="mt-5 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]"
          >
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
            {sections.helperText && (
              <p className="mb-2 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                {sections.helperText}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                name="message"
                rows={3}
                required
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={sections.composerHint || "Write expert guidance..."}
                className="ai-input flex-1 resize-y"
              />
              <button type="submit" className="ai-btn-primary h-10 shrink-0 px-5 text-xs">
                <Send className="h-3.5 w-3.5" />
                {sections.submit || "Send"}
              </button>
            </div>
          </form>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
