import React, { useState } from "react";
import { ArrowLeft, BadgeCheck, Check, Copy, Mail, ShieldCheck } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface MemberCardData {
  member: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    avatar_url: string;
    created_at?: string | null;
    is_active: boolean;
  };
  repLabel: string;
  roleNames: string;
  memberCardUrl: string;
  homeUrl: string;
}

export default function MemberCardPage({ bootstrap }: { bootstrap: AppBootstrap<MemberCardData> }) {
  const d = bootstrap.data;
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(d.memberCardUrl || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in non-HTTPS contexts
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-obsidian-950 dark:text-slate-100">
      <div className="ai-neural-mesh" />
      <div className="relative z-10 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <a href={d.homeUrl} className="ai-btn-secondary h-9 px-3 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            AGRI SYSTEM
          </a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCopyLink} className="ai-btn-secondary h-9 px-3 text-xs">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Link"}
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div className="ai-surface overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 p-5 text-white">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest opacity-90">
              <span>AGRI SYSTEM CREDENTIAL</span>
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>

          <div className="-mt-11 px-6 pb-6">
            <img
              src={d.member.avatar_url || "/static/img/avatar.png"}
              alt={d.member.full_name}
              className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg dark:border-obsidian-900"
            />
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold">{d.member.full_name}</h1>
                <BadgeCheck className="h-5 w-5 text-indigo-500" />
              </div>
              <p className="mt-1 inline-flex rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                {d.repLabel}
              </p>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-slate-200/70 pt-4 text-xs dark:border-slate-800/70">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Username</span>
                <span className="font-mono font-semibold">@{d.member.username}</span>
              </div>
              {d.member.email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {d.member.email}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Verified Roles</span>
                <span className="font-semibold uppercase">{d.roleNames}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {d.member.is_active ? "Active Representative" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
