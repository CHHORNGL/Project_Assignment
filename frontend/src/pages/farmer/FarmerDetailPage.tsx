import React from "react";
import { Award, Cpu, Layers, ShieldCheck, Users } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";

interface DetailData {
  supervisor?: { name?: string; role?: string; department?: string };
  team?: Array<{ name?: string; role?: string }>;
  dashboardUrl: string;
  diagnoseUrl: string;
}

export default function FarmerDetailPage({ bootstrap }: { bootstrap: AppBootstrap<DetailData> }) {
  const d = bootstrap.data;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        <div className="ai-surface p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Cpu className="h-4 w-4" /> System Architecture
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold">AGRI SYSTEM Hybrid Intelligence</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Designed to unify deterministic expert rules, multimodal crop leaf vision analysis, weather telemetry,
            human agronomist validation, and bilingual English/Khmer accessibility.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-slate-200/80 p-4 dark:border-slate-800">
              <Layers className="mb-2 h-5 w-5 text-indigo-500" />
              <p className="font-bold">Rule + Vision Fusion</p>
              <p className="mt-1 text-slate-500">Transparent symptom scoring backed by expert escalation queues.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-4 dark:border-slate-800">
              <ShieldCheck className="mb-2 h-5 w-5 text-emerald-500" />
              <p className="font-bold">Zero-Trust Identity</p>
              <p className="mt-1 text-slate-500">Passkey WebAuthn, email OTP, and isolated session auditing.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-4 dark:border-slate-800">
              <Award className="mb-2 h-5 w-5 text-amber-500" />
              <p className="font-bold">Local Ecosystem Ready</p>
              <p className="mt-1 text-slate-500">Native Khmer UI, TTS narration, and Bakong KHQR membership support.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="ai-surface p-6">
            <h3 className="font-display text-base font-bold">Project Supervisor</h3>
            <p className="mt-2 font-display text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {d.supervisor?.name || "Sek Socheat"}
            </p>
            <p className="text-xs text-slate-500">{d.supervisor?.role || "Academic & Engineering Advisor"}</p>
          </div>

          <div className="ai-surface p-6">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
              <Users className="h-4 w-4 text-indigo-500" /> Engineering Contributors
            </h3>
            <ul className="space-y-2 text-xs">
              {(d.team || [{ name: "Mao Seavik", role: "Lead Platform Engineer" }]).map((member, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3.5 py-2.5 dark:border-slate-800">
                  <span className="font-bold">{member.name}</span>
                  <span className="text-slate-500">{member.role || "Contributor"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
