import React from "react";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Clock,
  Filter,
  Headphones,
  MessageSquare,
  RotateCcw,
  Search,
  User,
  Users,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  ExpertHeaderActions,
  formatShortDateTime,
  statusBadgeClass,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
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

function quickActionToneStyle(tone: string) {
  switch ((tone || "").toLowerCase()) {
    case "emerald":
      return {
        box: "bg-[#d9fbd0] text-[#1c6c09] ring-1 ring-[#25b003]/20 dark:bg-[#25b003]/15 dark:text-[#7ee864]",
        icon: <BookOpen className="h-4 w-4" />,
      };
    case "amber":
      return {
        box: "bg-[#ffefca] text-[#bc3803] ring-1 ring-[#e5780b]/25 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]",
        icon: <Clock className="h-4 w-4" />,
      };
    case "sky":
      return {
        box: "bg-[#dcf4ff] text-[#005585] ring-1 ring-[#0097eb]/25 dark:bg-[#0097eb]/15 dark:text-[#6fd0ff]",
        icon: <Headphones className="h-4 w-4" />,
      };
    default:
      return {
        box: "bg-[#e5edff] text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]",
        icon: <MessageSquare className="h-4 w-4" />,
      };
  }
}

export default function ExpertSupportHubPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<SupportHubData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const labels = ui.labels || {};

  const casesFiltered = Boolean(
    d.filters.cases.cropId ||
      d.filters.cases.status ||
      d.filters.cases.dateFrom ||
      d.filters.cases.dateTo,
  );
  const messagesFiltered = Boolean(
    d.filters.messages.farmerId ||
      d.filters.messages.keyword ||
      d.filters.messages.dateFrom ||
      d.filters.messages.dateTo,
  );

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={metrics.ruleSessions || "Rule Sessions"}
            hint={metrics.ruleSessionsMeta}
            value={d.metrics.totalRuleSessions}
            icon={<BookOpen className="h-5 w-5" />}
            tone="indigo"
          />
          <AdminKpiCard
            delayIndex={1}
            label={metrics.ruleMessages || "Rule Messages"}
            hint={metrics.ruleMessagesMeta}
            value={d.metrics.totalRuleMessages}
            icon={<MessageSquare className="h-5 w-5" />}
            tone="sky"
          />
          <AdminKpiCard
            delayIndex={2}
            label={metrics.farmers || "Farmers"}
            hint={metrics.farmersMeta}
            value={d.metrics.ruleUniqueFarmers}
            icon={<Users className="h-5 w-5" />}
            tone="emerald"
            href={d.links.farmerChatsUrl}
          />
          <AdminKpiCard
            delayIndex={3}
            label={metrics.last24h || "Last 24h"}
            hint={metrics.last24hMeta}
            value={d.metrics.last24hRuleMessages}
            icon={<Clock className="h-5 w-5" />}
            tone="amber"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.quickActions.map((card, idx) => {
            const style = quickActionToneStyle(card.tone);
            return (
              <a
                key={`${card.title}-${idx}`}
                href={card.href}
                className="ai-surface ai-card-hover group flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                      style.box,
                    )}
                  >
                    {style.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                      {card.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#6e7891] dark:text-[#8a94ad]">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#8a94ad] transition group-hover:translate-x-0.5 group-hover:text-[#3874ff]" />
              </a>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminSectionCard
            delayIndex={1}
            title={sections.ruleCases || "Rule Cases"}
            subtitle={sections.ruleCasesSubtitle}
            icon={<BookOpen className="h-4 w-4" />}
            action={
              <div className="flex items-center gap-2">
                {casesFiltered && (
                  <AdminStatusBadge tone="indigo">
                    {isKhmer ? "បានច្រោះ" : "Filtered"}
                  </AdminStatusBadge>
                )}
                <AdminStatusBadge tone="slate">{d.autoCases.length}</AdminStatusBadge>
              </div>
            }
          >
            <div className="space-y-4">
              <form
                method="GET"
                action={d.links.supportHubUrl}
                className="grid gap-3 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/70 sm:grid-cols-2"
              >
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.crop || (isKhmer ? "ដំណាំ" : "Crop")}
                  </label>
                  <select
                    name="crop_id"
                    defaultValue={d.filters.cases.cropId}
                    className="ai-input h-9 py-1 text-xs"
                  >
                    <option value="">{labels.allCrops || "All Crops"}</option>
                    {d.filterOptions.crops.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.status || (isKhmer ? "ស្ថានភាព" : "Status")}
                  </label>
                  <select
                    name="status"
                    defaultValue={d.filters.cases.status}
                    className="ai-input h-9 py-1 text-xs"
                  >
                    {d.filterOptions.statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.dateFrom || (isKhmer ? "ចាប់ពីថ្ងៃ" : "From")}
                  </label>
                  <input
                    type="date"
                    name="date_from"
                    defaultValue={d.filters.cases.dateFrom}
                    className="ai-input h-9 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.dateTo || (isKhmer ? "រហូតដល់ថ្ងៃ" : "To")}
                  </label>
                  <input
                    type="date"
                    name="date_to"
                    defaultValue={d.filters.cases.dateTo}
                    className="ai-input h-9 py-1 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="submit" className="ai-btn-primary h-8 gap-1.5 px-3 text-xs">
                    <Filter className="h-3.5 w-3.5" />
                    <span>{labels.applyFilters || "Apply"}</span>
                  </button>
                  <a href={d.links.supportHubUrl} className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{labels.reset || "Reset"}</span>
                  </a>
                </div>
              </form>

              {d.autoCases.length === 0 ? (
                <AdminEmptyState
                  icon={<BookOpen className="h-5 w-5" />}
                  title={labels.noAutoCases || "No matching cases."}
                  action={
                    casesFiltered ? (
                      <a href={d.links.supportHubUrl} className="ai-btn-secondary h-8 px-3 text-xs">
                        {labels.reset || "Reset"}
                      </a>
                    ) : undefined
                  }
                />
              ) : (
                <div className="phoenix-scroll max-h-[430px] divide-y divide-[#e3e6ed] overflow-y-auto pr-1 dark:divide-[#2b3245]">
                  {d.autoCases.map((c) => (
                    <div
                      key={c.id}
                      className="ai-table-row flex items-center justify-between gap-3 rounded-lg px-2.5 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                            #{c.id}
                          </span>
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
                          {c.createdAt && (
                            <span className="font-mono text-[10.5px] text-[#8a94ad]">
                              {formatShortDateTime(c.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[#6e7891] dark:text-[#8a94ad]">
                          {c.symptomsText || "-"}
                        </p>
                      </div>
                      <a href={c.reviewUrl} className="ai-btn-secondary h-8 shrink-0 gap-1 px-2.5 text-xs">
                        <span>{labels.review || "Review"}</span>
                        <ArrowRight className="h-3 w-3" />
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
            icon={<MessageSquare className="h-4 w-4" />}
            action={
              <div className="flex items-center gap-2">
                {messagesFiltered && (
                  <AdminStatusBadge tone="indigo">
                    {isKhmer ? "បានច្រោះ" : "Filtered"}
                  </AdminStatusBadge>
                )}
                <AdminStatusBadge tone="slate">{d.ruleChatMessages.length}</AdminStatusBadge>
              </div>
            }
          >
            <div className="space-y-4">
              <form
                method="GET"
                action={d.links.supportHubUrl}
                className="grid gap-3 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/70 sm:grid-cols-2"
              >
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.farmer || (isKhmer ? "កសិករ" : "Farmer")}
                  </label>
                  <select
                    name="chat_farmer_id"
                    defaultValue={d.filters.messages.farmerId}
                    className="ai-input h-9 py-1 text-xs"
                  >
                    <option value="">{labels.allFarmers || "All Farmers"}</option>
                    {d.filterOptions.farmers.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.keyword || (isKhmer ? "ពាក្យគន្លឹះ" : "Keyword")}
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                    <input
                      type="text"
                      name="chat_keyword"
                      defaultValue={d.filters.messages.keyword}
                      placeholder={labels.searchMessages || "Search messages..."}
                      className="ai-input h-9 py-1 pl-10 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.dateFrom || (isKhmer ? "ចាប់ពីថ្ងៃ" : "From")}
                  </label>
                  <input
                    type="date"
                    name="chat_date_from"
                    defaultValue={d.filters.messages.dateFrom}
                    className="ai-input h-9 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.dateTo || (isKhmer ? "រហូតដល់ថ្ងៃ" : "To")}
                  </label>
                  <input
                    type="date"
                    name="chat_date_to"
                    defaultValue={d.filters.messages.dateTo}
                    className="ai-input h-9 py-1 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="submit" className="ai-btn-primary h-8 gap-1.5 px-3 text-xs">
                    <Filter className="h-3.5 w-3.5" />
                    <span>{labels.applyFilters || "Apply"}</span>
                  </button>
                  <a href={d.links.supportHubUrl} className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{labels.reset || "Reset"}</span>
                  </a>
                </div>
              </form>

              {d.ruleChatMessages.length === 0 ? (
                <AdminEmptyState
                  icon={<MessageSquare className="h-5 w-5" />}
                  title={labels.noRuleChatMessages || "No messages found."}
                  action={
                    messagesFiltered ? (
                      <a href={d.links.supportHubUrl} className="ai-btn-secondary h-8 px-3 text-xs">
                        {labels.reset || "Reset"}
                      </a>
                    ) : undefined
                  }
                />
              ) : (
                <div className="phoenix-scroll max-h-[430px] space-y-2.5 overflow-y-auto pr-1">
                  {d.ruleChatMessages.map((msg) => {
                    const isFarmer = msg.sender === "farmer" || msg.sender === "user";
                    return (
                      <div
                        key={msg.id}
                        className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3.5 text-xs dark:border-[#2b3245] dark:bg-[#0f111a]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                                isFarmer
                                  ? "bg-[#d9fbd0] text-[#1c6c09] dark:bg-[#25b003]/20 dark:text-[#7ee864]"
                                  : "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]",
                              )}
                            >
                              {isFarmer ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                            </span>
                            <span className="font-bold text-[#141824] dark:text-[#eff2f6]">
                              {msg.senderLabel}
                            </span>
                            <span className="rounded border border-[#cbd0dd] bg-white px-1.5 py-0.5 font-mono text-[10px] dark:border-[#373e53] dark:bg-[#141824]">
                              {labels.session || "Session"} #{msg.sessionId ?? "-"}
                            </span>
                          </div>
                          <span className="font-mono text-[11px]">
                            {formatShortDateTime(msg.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[#31374a] dark:text-[#eff2f6]">
                          {msg.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </AdminSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
