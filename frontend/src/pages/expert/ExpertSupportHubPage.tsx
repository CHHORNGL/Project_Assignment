import React from "react";
import { ArrowRight, BookOpen, Clock, MessageSquare, Users } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions, statusBadgeClass } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminSectionCard,
  PhoenixSummaryStrip,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface SupportHubData {
  metrics: {
    totalRuleSessions: number;
    ruleUniqueFarmers: number;
    totalRuleMessages: number;
    last24hRuleMessages: number;
  };
  links: {
    farmerChatsUrl: string;
    pendingDiagnosesUrl: string;
    diseasesUrl: string;
    supportHubUrl: string;
  };
  filters: {
    cases: { cropId: string; status: string; dateFrom: string; dateTo: string };
    messages: { farmerId: string; keyword: string; dateFrom: string; dateTo: string };
  };
  filterOptions: {
    crops: Array<{ id: number; name: string }>;
    statuses: Array<{ id: string; label: string }>;
    farmers: Array<{ id: number; name: string }>;
  };
  quickActions: Array<{ title: string; subtitle: string; href: string; tone: string }>;
  autoCases: Array<{
    id: number;
    cropName: string;
    symptomsText: string;
    createdAt?: string | null;
    reviewUrl: string;
    status: string;
    statusLabel: string;
  }>;
  ruleChatMessages: Array<{
    id: number;
    sender: string;
    senderLabel: string;
    sessionId?: number | null;
    message: string;
    createdAt?: string | null;
  }>;
}

export default function ExpertSupportHubPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<SupportHubData>;
}) {
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const labels = ui.labels || {};

  const kpis = [
    {
      label: metrics.ruleSessions || "Rule Sessions",
      hint: metrics.ruleSessionsMeta,
      value: d.metrics.totalRuleSessions,
      icon: <BookOpen className="h-5 w-5" />,
      tone: "indigo" as const,
    },
    {
      label: metrics.ruleMessages || "Rule Messages",
      hint: metrics.ruleMessagesMeta,
      value: d.metrics.totalRuleMessages,
      icon: <MessageSquare className="h-5 w-5" />,
      tone: "sky" as const,
    },
    {
      label: metrics.farmers || "Farmers",
      hint: metrics.farmersMeta,
      value: d.metrics.ruleUniqueFarmers,
      icon: <Users className="h-5 w-5" />,
      tone: "emerald" as const,
    },
    {
      label: metrics.last24h || "Last 24h",
      hint: metrics.last24hMeta,
      value: d.metrics.last24hRuleMessages,
      icon: <Clock className="h-5 w-5" />,
      tone: "amber" as const,
    },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        <PhoenixSummaryStrip items={kpis} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.quickActions.map((card, idx) => (
            <a
              key={`${card.title}-${idx}`}
              href={card.href}
              className="ai-surface ai-card-hover group flex items-center justify-between p-4"
            >
              <div>
                <p className="text-sm font-bold text-[#141824] dark:text-[#eff2f6]">{card.title}</p>
                <p className="mt-0.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">{card.subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#8a94ad] transition group-hover:translate-x-0.5 group-hover:text-[#3874ff]" />
            </a>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminSectionCard
            delayIndex={1}
            title={sections.ruleCases || "Rule Cases"}
            subtitle={sections.ruleCasesSubtitle}
          >
            <div className="space-y-4">
              <form method="GET" action={d.links.supportHubUrl} className="grid gap-3 sm:grid-cols-2">
                <select
                  name="crop_id"
                  defaultValue={d.filters.cases.cropId}
                  className="ai-input py-2 text-xs"
                >
                  <option value="">{labels.allCrops || "All Crops"}</option>
                  {d.filterOptions.crops.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  name="status"
                  defaultValue={d.filters.cases.status}
                  className="ai-input py-2 text-xs"
                >
                  {d.filterOptions.statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  name="date_from"
                  defaultValue={d.filters.cases.dateFrom}
                  className="ai-input py-2 text-xs"
                />
                <input
                  type="date"
                  name="date_to"
                  defaultValue={d.filters.cases.dateTo}
                  className="ai-input py-2 text-xs"
                />
                <div className="flex gap-2 sm:col-span-2">
                  <button type="submit" className="ai-btn-primary h-8 px-3 text-xs">
                    {labels.applyFilters || "Apply"}
                  </button>
                  <a href={d.links.supportHubUrl} className="ai-btn-secondary h-8 px-3 text-xs">
                    {labels.reset || "Reset"}
                  </a>
                </div>
              </form>

              {d.autoCases.length === 0 ? (
                <AdminEmptyState title={labels.noAutoCases || "No matching cases."} />
              ) : (
                <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {d.autoCases.map((c) => (
                    <div
                      key={c.id}
                      className="ai-table-row flex items-center justify-between gap-3 rounded-lg px-2 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#141824] dark:text-[#eff2f6]">
                            {c.cropName || labels.unknownCrop}
                          </span>
                          <span
                            className={cn(
                              "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                              statusBadgeClass(c.status),
                            )}
                          >
                            {c.statusLabel}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[#6e7891] dark:text-[#8a94ad]">
                          {c.symptomsText || "-"}
                        </p>
                      </div>
                      <a href={c.reviewUrl} className="ai-btn-secondary h-8 shrink-0 px-2.5 text-xs">
                        {labels.review || "Review"}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={2}
            title={sections.ruleChatMessages || "Rule Chat Messages"}
            subtitle={sections.ruleChatMessagesSubtitle}
          >
            <div className="space-y-4">
              <form method="GET" action={d.links.supportHubUrl} className="grid gap-3 sm:grid-cols-2">
                <select
                  name="chat_farmer_id"
                  defaultValue={d.filters.messages.farmerId}
                  className="ai-input py-2 text-xs"
                >
                  <option value="">{labels.allFarmers || "All Farmers"}</option>
                  {d.filterOptions.farmers.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="chat_keyword"
                  defaultValue={d.filters.messages.keyword}
                  placeholder={labels.searchMessages || "Search messages..."}
                  className="ai-input py-2 text-xs"
                />
                <input
                  type="date"
                  name="chat_date_from"
                  defaultValue={d.filters.messages.dateFrom}
                  className="ai-input py-2 text-xs"
                />
                <input
                  type="date"
                  name="chat_date_to"
                  defaultValue={d.filters.messages.dateTo}
                  className="ai-input py-2 text-xs"
                />
                <div className="flex gap-2 sm:col-span-2">
                  <button type="submit" className="ai-btn-primary h-8 px-3 text-xs">
                    {labels.applyFilters || "Apply"}
                  </button>
                  <a href={d.links.supportHubUrl} className="ai-btn-secondary h-8 px-3 text-xs">
                    {labels.reset || "Reset"}
                  </a>
                </div>
              </form>

              {d.ruleChatMessages.length === 0 ? (
                <AdminEmptyState title={labels.noRuleChatMessages || "No messages found."} />
              ) : (
                <div className="phoenix-scroll max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                  {d.ruleChatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3 text-xs dark:border-[#2b3245] dark:bg-[#0f111a]"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        <span className="font-bold text-[#141824] dark:text-[#eff2f6]">
                          {msg.senderLabel} · {labels.session || "Session"} #{msg.sessionId ?? "-"}
                        </span>
                        <span className="font-mono">
                          {msg.createdAt ? msg.createdAt.slice(0, 16).replace("T", " ") : ""}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[#31374a] dark:text-[#eff2f6]">{msg.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AdminSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
