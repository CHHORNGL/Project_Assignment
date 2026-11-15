import React from "react";
import { Plus, Sparkles, Ticket, Trash2 } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface PromoCodesData {
  createAction: string;
  codes: Array<{
    id: number;
    code: string;
    tokensReward: number;
    isRedeemed: boolean;
    redeemedAt?: string | null;
    createdAt?: string | null;
    deleteAction: string;
  }>;
}

export default function AdminPromoCodesPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<PromoCodesData>;
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
        <AdminSectionCard
          delayIndex={0}
          title="Mint AI Credit Voucher"
          subtitle="Generate single-use reward codes redeemable for farmer AI credits"
          icon={<Sparkles className="h-4 w-4" />}
        >
          <form method="POST" action={d.createAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
            <div className="w-64">
              <label className="mb-1.5 block text-xs font-semibold">AI Credit Reward Amount</label>
              <input
                type="number"
                name="tokens"
                min="1"
                defaultValue="1000"
                required
                className="ai-input font-mono text-xs"
              />
            </div>
            <button type="submit" className="ai-btn-primary h-10 gap-1.5 px-5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Generate Reward Code
            </button>
          </form>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          noPadding
          title="Issued Reward Codes"
          icon={<Ticket className="h-4 w-4" />}
          action={<AdminStatusBadge tone="indigo">{d.codes.length} codes</AdminStatusBadge>}
        >
          {d.codes.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                icon={<Ticket className="h-5 w-5" />}
                title="No reward codes created yet"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-obsidian-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Reward</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {d.codes.map((c) => (
                    <tr key={c.id} className="ai-table-row">
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-lg bg-indigo-500/10 px-2.5 py-1 font-mono font-bold tracking-wider text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {c.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold tabular-nums">
                        {c.tokensReward.toLocaleString()} credits
                      </td>
                      <td className="px-4 py-3.5">
                        <AdminStatusBadge tone={c.isRedeemed ? "slate" : "emerald"} pulse={!c.isRedeemed}>
                          {c.isRedeemed ? "Redeemed" : "Available"}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {c.createdAt ? c.createdAt.slice(0, 16).replace("T", " ") : ""}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <form method="POST" action={c.deleteAction}>
                          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                          <button
                            type="submit"
                            className="ai-btn-secondary h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
