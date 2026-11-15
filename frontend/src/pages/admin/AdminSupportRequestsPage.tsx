import React from "react";
import { CheckCircle2, Inbox, LifeBuoy, RotateCcw, Search, Ticket, Trash2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface SupportRequestsData {
  filterStatus: string;
  q: string;
  counts: { open: number; resolved: number; total: number };
  links: { baseUrl: string; createAction: string };
  users: Array<{ id: number; label: string }>;
  requests: Array<{
    id: number;
    requesterName: string;
    requesterRole: string;
    message: string;
    page: string;
    status: string;
    createdAt?: string | null;
    resolvedAt?: string | null;
    resolveAction: string;
    reopenAction: string;
    deleteAction: string;
  }>;
}

export default function AdminSupportRequestsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<SupportRequestsData>;
}) {
  const d = bootstrap.data;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Open Tickets", val: d.counts.open, st: "open", tone: "amber" as const, icon: <LifeBuoy className="h-5 w-5" /> },
            { label: "Resolved", val: d.counts.resolved, st: "resolved", tone: "emerald" as const, icon: <CheckCircle2 className="h-5 w-5" /> },
            { label: "Total Requests", val: d.counts.total, st: "all", tone: "indigo" as const, icon: <Ticket className="h-5 w-5" /> },
          ].map((item, idx) => (
            <div
              key={item.st}
              className={
                d.filterStatus === item.st
                  ? "rounded-3xl ring-2 ring-indigo-500/60 ring-offset-2 ring-offset-slate-50 dark:ring-offset-obsidian-950"
                  : ""
              }
            >
              <AdminKpiCard
                delayIndex={idx}
                href={`${d.links.baseUrl}?status=${item.st}`}
                label={item.label}
                value={item.val.toLocaleString()}
                tone={item.tone}
                icon={item.icon}
                hint={d.filterStatus === item.st ? "Active filter" : "Click to filter"}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <AdminSectionCard
            delayIndex={3}
            title="Create Support Ticket"
            subtitle="Log an issue on behalf of any platform member"
            icon={<LifeBuoy className="h-4 w-4" />}
          >
            <form method="POST" action={d.links.createAction} className="space-y-3">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <select name="requester_id" className="ai-input text-xs">
                <option value="">Current Admin</option>
                {d.users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="page"
                placeholder="/farmer/dashboard (optional)"
                className="ai-input text-xs"
              />
              <textarea
                name="message"
                rows={4}
                required
                placeholder="Describe inquiry or issue..."
                className="ai-input text-xs"
              />
              <button type="submit" className="ai-btn-primary w-full justify-center text-xs">
                Submit Ticket
              </button>
            </form>
          </AdminSectionCard>

          <AdminSectionCard
            className="lg:col-span-2"
            delayIndex={4}
            title="Support Queue"
            subtitle={`${d.requests.length} ticket(s) displayed`}
            icon={<Inbox className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <form method="GET" action={d.links.baseUrl} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="status" value={d.filterStatus} />
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={d.q}
                    placeholder="Search tickets..."
                    className="ai-input h-9 py-1 pl-8 text-xs"
                  />
                </div>
                <button type="submit" className="ai-btn-primary h-9 px-4 text-xs">
                  Search
                </button>
              </form>

              {d.requests.length === 0 ? (
                <AdminEmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title="No support requests match this filter"
                />
              ) : (
                <div className="space-y-3">
                  {d.requests.map((req) => (
                    <div
                      key={req.id}
                      className="ai-card-hover rounded-2xl border border-slate-200/70 bg-slate-50/75 p-4 text-xs dark:border-slate-800/80 dark:bg-obsidian-950/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">#{req.id}</span>
                          <span>{req.requesterName}</span>
                          <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-obsidian-800 dark:text-slate-300">
                            {req.requesterRole || "user"}
                          </span>
                        </div>
                        <AdminStatusBadge
                          tone={req.status === "resolved" ? "emerald" : "amber"}
                          pulse={req.status === "open"}
                        >
                          {req.status}
                        </AdminStatusBadge>
                      </div>
                      <p className="mt-2.5 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
                        {req.message}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800/70">
                        <span className="font-mono">
                          {req.page || "/"} · {req.createdAt ? req.createdAt.slice(0, 16).replace("T", " ") : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {req.status === "open" ? (
                            <form method="POST" action={req.resolveAction}>
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <input type="hidden" name="status" value={d.filterStatus} />
                              <input type="hidden" name="q" value={d.q} />
                              <button
                                type="submit"
                                className="inline-flex h-7 items-center gap-1 rounded-xl bg-emerald-600 px-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Resolve
                              </button>
                            </form>
                          ) : (
                            <form method="POST" action={req.reopenAction}>
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <input type="hidden" name="status" value={d.filterStatus} />
                              <input type="hidden" name="q" value={d.q} />
                              <button type="submit" className="ai-btn-secondary h-7 gap-1 px-2.5 text-[11px]">
                                <RotateCcw className="h-3 w-3" /> Reopen
                              </button>
                            </form>
                          )}
                          <form method="POST" action={req.deleteAction}>
                            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                            <input type="hidden" name="status" value={d.filterStatus} />
                            <input type="hidden" name="q" value={d.q} />
                            <button
                              type="submit"
                              className="ai-btn-secondary h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </form>
                        </div>
                      </div>
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
