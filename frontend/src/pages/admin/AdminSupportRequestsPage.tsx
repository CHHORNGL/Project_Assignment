import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Globe,
  Headphones,
  Inbox,
  LifeBuoy,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Send,
  Ticket,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { formatAccountTimestamp } from "@/components/user/AccountHeaderTabs";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface SupportTicketItem {
  id: number;
  requesterName: string;
  requesterUsername?: string;
  requesterEmail?: string;
  requesterRole: string;
  message: string;
  page: string;
  status: string;
  createdAt?: string | null;
  resolvedAt?: string | null;
  resolveAction: string;
  reopenAction: string;
  deleteAction: string;
}

interface SupportRequestsData {
  filterStatus: string;
  q: string;
  counts: { open: number; resolved: number; total: number };
  links: { baseUrl: string; createAction: string; liveChatsUrl?: string };
  users: Array<{ id: number; label: string }>;
  requests: SupportTicketItem[];
}

function getRoleChipClasses(role: string): string {
  const r = (role || "").toLowerCase();
  if (r === "farmer") {
    return "border-[#90d67f]/80 bg-[#d9fbd0]/75 text-[#1c6c09] dark:border-[#25b003]/35 dark:bg-[#25b003]/15 dark:text-[#90ee7a]";
  }
  if (r === "expert") {
    return "border-[#adc5ff]/80 bg-[#e5edff] text-[#004dff] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]";
  }
  return "border-[#cbd0dd] bg-[#eff2f6] text-[#525b75] dark:border-[#373e53] dark:bg-[#1e2436] dark:text-[#9fa6bc]";
}

export default function AdminSupportRequestsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<SupportRequestsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [messageDraft, setMessageDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const resolutionRate =
    d.counts.total > 0 ? Math.round((d.counts.resolved / d.counts.total) * 100) : 100;

  const filterHref = (statusKey: string, query = d.q) => {
    const params = new URLSearchParams({ status: statusKey });
    if (query.trim()) params.set("q", query.trim());
    return `${d.links.baseUrl}?${params.toString()}`;
  };

  const kpiCards = [
    {
      st: "open",
      label: isKhmer ? "សំណើកំពុងបើក" : "Open Tickets",
      val: d.counts.open,
      tone: "amber" as const,
      icon: <LifeBuoy className="h-5 w-5" />,
      badge: isKhmer ? "កំពុងរង់ចាំ" : "Needs Triage",
    },
    {
      st: "resolved",
      label: isKhmer ? "បានដោះស្រាយ" : "Resolved",
      val: d.counts.resolved,
      tone: "emerald" as const,
      icon: <CheckCircle2 className="h-5 w-5" />,
      badge: `${resolutionRate}%`,
    },
    {
      st: "all",
      label: isKhmer ? "សំណើសរុប" : "Total Requests",
      val: d.counts.total,
      tone: "indigo" as const,
      icon: <Ticket className="h-5 w-5" />,
      badge: isKhmer ? "ទាំងអស់" : "All History",
    },
  ];

  const statusTabs = [
    { key: "open", label: isKhmer ? "កំពុងបើក" : "Open", count: d.counts.open },
    { key: "resolved", label: isKhmer ? "បានដោះស្រាយ" : "Resolved", count: d.counts.resolved },
    { key: "all", label: isKhmer ? "ទាំងអស់" : "All", count: d.counts.total },
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
        {/* Top KPI Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {kpiCards.map((item, idx) => {
            const isSelected = d.filterStatus === item.st;
            return (
              <div
                key={item.st}
                className={cn(
                  "rounded-xl transition-all",
                  isSelected && "ring-2 ring-[#3874ff] ring-offset-2 ring-offset-[#f5f7fa] dark:ring-offset-[#0f111a]",
                )}
              >
                <AdminKpiCard
                  delayIndex={idx}
                  href={filterHref(item.st)}
                  label={item.label}
                  value={item.val.toLocaleString()}
                  tone={item.tone}
                  icon={item.icon}
                  badge={item.badge}
                  progress={item.st === "resolved" ? resolutionRate : undefined}
                  hint={
                    isSelected
                      ? isKhmer
                        ? "កំពុងត្រងតាមស្ថានភាពនេះ"
                        : "Currently viewing this queue"
                      : isKhmer
                        ? "ចុចដើម្បីត្រង"
                        : "Click to filter queue"
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Main 12-Column Triage Layout */}
        <div className="grid gap-6 xl:grid-cols-12">
          {/* Left Column: Create Ticket & Resolution Overview */}
          <div className="min-w-0 space-y-6 xl:col-span-4">
            <AdminSectionCard
              delayIndex={2}
              title={isKhmer ? "បង្កើតសំណើជំនួយថ្មី" : "New Support Ticket"}
              subtitle={
                isKhmer
                  ? "កត់ត្រាបញ្ហាជំនួសសមាជិកណាមួយក្នុងប្រព័ន្ធ"
                  : "Log an inquiry or escalation on behalf of any platform member"
              }
              icon={<MessageSquarePlus className="h-4 w-4" />}
            >
              <form method="POST" action={d.links.createAction} className="space-y-4">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

                <div>
                  <label
                    htmlFor="ticket-requester"
                    className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                  >
                    {isKhmer ? "អ្នកស្នើសុំ" : "Requester Account"}
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                    <select
                      id="ticket-requester"
                      name="requester_id"
                      className="ai-input pl-9 text-xs"
                    >
                      <option value="">{isKhmer ? "អ្នកគ្រប់គ្រងបច្ចុប្បន្ន" : "Current Admin"}</option>
                      {d.users.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="ticket-page"
                    className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                  >
                    {isKhmer ? "ទំព័រពាក់ព័ន្ធ (ជាជម្រើស)" : "Source Route / Page (Optional)"}
                  </label>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                    <input
                      id="ticket-page"
                      type="text"
                      name="page"
                      placeholder="/farmer/dashboard"
                      className="ai-input pl-9 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="ticket-message"
                      className="text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                    >
                      {isKhmer ? "ព័ត៌មានលម្អិតសំណើ" : "Inquiry Message"}
                    </label>
                    <span className="text-[11px] tabular-nums text-[#8a94ad]">
                      {messageDraft.length}/1000
                    </span>
                  </div>
                  <textarea
                    id="ticket-message"
                    name="message"
                    rows={4}
                    required
                    maxLength={1000}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder={
                      isKhmer ? "ពិពណ៌នាបញ្ហា ឬសំណើរបស់អ្នកប្រើប្រាស់..." : "Describe the inquiry, bug report, or assistance needed..."
                    }
                    className="ai-input resize-y text-xs leading-relaxed"
                  />
                </div>

                <button type="submit" className="ai-btn-primary h-9 w-full justify-center text-xs">
                  <Send className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "បញ្ជូនសំណើ" : "Create Ticket"}</span>
                </button>
              </form>
            </AdminSectionCard>

            {/* Queue Resolution SLA Summary */}
            <AdminSectionCard
              delayIndex={3}
              title={isKhmer ? "ស្ថានភាពដោះស្រាយ" : "Resolution Overview"}
              subtitle={
                isKhmer
                  ? "អត្រាបិទបញ្ចប់សំណើសុំជំនួយសរុប"
                  : "Overall support queue completion rate"
              }
              icon={<Headphones className="h-4 w-4" />}
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/80 p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/70">
                  <AdminProgressBar
                    label={isKhmer ? "អត្រាដោះស្រាយ" : "Resolved Ratio"}
                    value={resolutionRate}
                    valueLabel={`${d.counts.resolved} / ${d.counts.total}`}
                    tone="emerald"
                  />
                </div>

                {d.links.liveChatsUrl && (
                  <a
                    href={d.links.liveChatsUrl}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#cbd0dd] bg-[#f5f7fa] py-2.5 text-xs font-semibold text-[#31374a] transition hover:border-[#3874ff]/45 hover:bg-[#eff2f6] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#eff2f6] dark:hover:bg-[#22283a]"
                  >
                    <Headphones className="h-3.5 w-3.5 text-[#3874ff]" />
                    <span>{isKhmer ? "បើកប្រអប់សារជំនួយផ្ទាល់" : "Open Live Support Inbox"}</span>
                  </a>
                )}
              </div>
            </AdminSectionCard>
          </div>

          {/* Right Column: Support Queue & Triage Controls */}
          <AdminSectionCard
            className="min-w-0 xl:col-span-8"
            delayIndex={3}
            title={isKhmer ? "ជួរសំណើសុំជំនួយ" : "Support Queue"}
            subtitle={
              isKhmer
                ? `បង្ហាញ ${d.requests.length} សំណើ`
                : `Showing ${d.requests.length} ticket${d.requests.length === 1 ? "" : "s"}`
            }
            icon={<Inbox className="h-4 w-4" />}
            action={
              <nav
                aria-label="Ticket status filter"
                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 dark:border-[#373e53] dark:bg-[#0f111a]"
              >
                {statusTabs.map((tab) => {
                  const active = d.filterStatus === tab.key;
                  return (
                    <a
                      key={tab.key}
                      href={filterHref(tab.key)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                        active
                          ? "bg-white text-[#004dff] shadow-sm ring-1 ring-[#cbd0dd]/70 dark:bg-[#181d2b] dark:text-[#85a9ff] dark:ring-[#373e53]"
                          : "text-[#525b75] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#eff2f6]",
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums",
                          active
                            ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                            : "bg-[#e3e6ed] text-[#525b75] dark:bg-[#1e2436] dark:text-[#9fa6bc]",
                        )}
                      >
                        {tab.count}
                      </span>
                    </a>
                  );
                })}
              </nav>
            }
          >
            <div className="space-y-4">
              {/* Search & Reset Filter Bar */}
              <form method="GET" action={d.links.baseUrl} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="status" value={d.filterStatus} />
                <div className="relative w-full min-w-0 flex-1 sm:w-auto sm:min-w-[220px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={d.q}
                    placeholder={
                      isKhmer
                        ? "ស្វែងរកតាមសារ អ៊ីមែល ឬទំព័រ..."
                        : "Search by inquiry text, username, email, or route..."
                    }
                    className="ai-input h-9 py-1.5 pl-9 text-xs"
                  />
                </div>
                <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                  {isKhmer ? "ស្វែងរក" : "Search"}
                </button>
                {d.q && (
                  <a
                    href={filterHref(d.filterStatus, "")}
                    className="ai-btn-secondary h-9 gap-1 px-3 text-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "សម្អាត" : "Clear"}</span>
                  </a>
                )}
              </form>

              {/* Tickets Feed */}
              {d.requests.length === 0 ? (
                <AdminEmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title={
                    isKhmer
                      ? "មិនមានសំណើជំនួយត្រូវនឹងការត្រងនេះទេ"
                      : "No support requests match this filter"
                  }
                  description={
                    d.q
                      ? isKhmer
                        ? `មិនមានលទ្ធផលសម្រាប់ "${d.q}" ទេ។`
                        : `No tickets matched "${d.q}". Try clearing the search or checking another status tab.`
                      : isKhmer
                        ? "សំណើជំនួយទាំងអស់ត្រូវបានដោះស្រាយរួចរាល់។"
                        : "Everything in this queue is clear."
                  }
                  action={
                    d.q ? (
                      <a href={filterHref(d.filterStatus, "")} className="ai-btn-secondary h-8 px-3 text-xs">
                        {isKhmer ? "បង្ហាញទាំងអស់ក្នុងស្ថានភាពនេះ" : "Reset Search"}
                      </a>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {d.requests.map((req) => {
                    const isResolved = req.status === "resolved";
                    const initial = (req.requesterName || "U").slice(0, 1).toUpperCase();
                    const awaitingConfirm = confirmDeleteId === req.id;

                    return (
                      <article
                        key={req.id}
                        className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/60 p-4 text-xs transition-all duration-150 hover:border-[#cbd0dd] hover:bg-white dark:border-[#2b3245] dark:bg-[#0f111a]/65 dark:hover:border-[#373e53] dark:hover:bg-[#141824]"
                      >
                        {/* Ticket Header */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e5edff] font-display text-xs font-extrabold text-[#004dff] ring-1 ring-[#3874ff]/20 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
                              {initial}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[11px] font-bold text-[#3874ff] dark:text-[#85a9ff]">
                                  #{req.id}
                                </span>
                                <span className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                                  {req.requesterName}
                                </span>
                                {req.requesterUsername &&
                                  req.requesterUsername !== req.requesterName && (
                                    <span className="font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                                      @{req.requesterUsername}
                                    </span>
                                  )}
                                <span
                                  className={cn(
                                    "rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                    getRoleChipClasses(req.requesterRole),
                                  )}
                                >
                                  {req.requesterRole || "member"}
                                </span>
                              </div>
                              {req.requesterEmail && (
                                <p className="mt-0.5 truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                                  {req.requesterEmail}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <AdminStatusBadge
                              tone={isResolved ? "emerald" : "amber"}
                              pulse={!isResolved}
                            >
                              {isResolved
                                ? isKhmer
                                  ? "បានដោះស្រាយ"
                                  : "Resolved"
                                : isKhmer
                                  ? "កំពុងបើក"
                                  : "Open"}
                            </AdminStatusBadge>
                          </div>
                        </div>

                        {/* Inquiry Message Body */}
                        <div className="mt-3 rounded-lg border border-[#e3e6ed]/85 bg-white px-3.5 py-3 text-[13px] leading-relaxed text-[#31374a] whitespace-pre-wrap dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#cbd0dd]">
                          {req.message}
                        </div>

                        {/* Metadata & Actions Footer */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="inline-flex items-center gap-1 rounded border border-[#e3e6ed] bg-white px-2 py-0.5 font-mono text-[10.5px] text-[#525b75] dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#9fa6bc]">
                              <Globe className="h-3 w-3 text-[#8a94ad]" />
                              {req.page || "/"}
                            </span>
                            {req.createdAt && (
                              <span
                                className="inline-flex items-center gap-1"
                                title={req.createdAt}
                              >
                                <Clock className="h-3 w-3 text-[#8a94ad]" />
                                {formatAccountTimestamp(req.createdAt)}
                              </span>
                            )}
                            {isResolved && req.resolvedAt && (
                              <span
                                className="inline-flex items-center gap-1 text-[#1c6c09] dark:text-[#90ee7a]"
                                title={req.resolvedAt}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {isKhmer ? "បានបិទ" : "Closed"}{" "}
                                {formatAccountTimestamp(req.resolvedAt)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!isResolved ? (
                              <form method="POST" action={req.resolveAction}>
                                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                                <input type="hidden" name="status" value={d.filterStatus} />
                                <input type="hidden" name="q" value={d.q} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#90d67f] bg-[#d9fbd0]/80 px-3 text-xs font-semibold text-[#1c6c09] transition hover:bg-[#d9fbd0] dark:border-[#25b003]/45 dark:bg-[#25b003]/20 dark:text-[#90ee7a] dark:hover:bg-[#25b003]/30"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{isKhmer ? "ដោះស្រាយរួច" : "Mark Resolved"}</span>
                                </button>
                              </form>
                            ) : (
                              <form method="POST" action={req.reopenAction}>
                                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                                <input type="hidden" name="status" value={d.filterStatus} />
                                <input type="hidden" name="q" value={d.q} />
                                <button
                                  type="submit"
                                  className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>{isKhmer ? "បើកឡើងវិញ" : "Reopen"}</span>
                                </button>
                              </form>
                            )}

                            {awaitingConfirm ? (
                              <div className="inline-flex items-center gap-1 rounded-lg border border-[#f48270] bg-[#ffe0db]/80 p-0.5 dark:border-[#fa3b1d]/40 dark:bg-[#492226]">
                                <form method="POST" action={req.deleteAction}>
                                  <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                                  <input type="hidden" name="status" value={d.filterStatus} />
                                  <input type="hidden" name="q" value={d.q} />
                                  <button
                                    type="submit"
                                    className="inline-flex h-7 items-center gap-1 rounded-md bg-[#fa3b1d] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#b81800]"
                                  >
                                    {isKhmer ? "បញ្ជាក់លុប" : "Confirm Delete"}
                                  </button>
                                </form>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="inline-flex h-7 items-center rounded-md px-2 text-[11px] font-semibold text-[#525b75] hover:bg-white/70 dark:text-[#cbd0dd] dark:hover:bg-black/20"
                                >
                                  {isKhmer ? "បោះបង់" : "Cancel"}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(req.id)}
                                title={isKhmer ? "លុបសំណើ" : "Delete ticket"}
                                aria-label={`Delete ticket #${req.id}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd0dd] bg-white text-[#6e7891] transition hover:border-[#f48270] hover:bg-[#ffe0db]/75 hover:text-[#b81800] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc] dark:hover:border-[#fa3b1d]/45 dark:hover:bg-[#492226] dark:hover:text-[#ff9c8c]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
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
