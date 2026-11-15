import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Cpu, Database, FileText, GitBranch, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
  PhoenixSummaryStrip,
} from "@/components/admin/AdminPrimitives";

interface KnowledgeDashboardData {
  metrics: {
    symptomCount: number;
    ruleCount: number;
    diseaseCount: number;
    mixedSourceCount: number;
    mixedFactCount: number;
  };
  links: {
    createSymptomUrl: string;
    createRuleUrl: string;
    mixedAgriDashboardUrl: string;
    mixedAgriSourcesUrl: string;
    mixedAgriFactsUrl: string;
    diseasesUrl: string;
  };
  rules: Array<{
    id: number;
    name: string;
    diseaseName: string;
    symptomNames: string[];
    confidencePercent: number | null;
  }>;
}

export default function ExpertKnowledgeDashboardPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<KnowledgeDashboardData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const metrics = ui.metrics || {};
  const sections = ui.sections || {};
  const labels = ui.labels || {};
  const [query, setQuery] = useState("");

  const kpis = [
    {
      label: metrics.symptoms || "Symptoms",
      value: d.metrics.symptomCount,
      href: d.links.createSymptomUrl,
      icon: <Cpu className="h-5 w-5" />,
      tone: "indigo" as const,
    },
    {
      label: metrics.rules || "Rules",
      value: d.metrics.ruleCount,
      href: d.links.createRuleUrl,
      icon: <GitBranch className="h-5 w-5" />,
      tone: "sky" as const,
    },
    {
      label: metrics.diseases || "Diseases",
      value: d.metrics.diseaseCount,
      href: d.links.diseasesUrl,
      icon: <BookOpen className="h-5 w-5" />,
      tone: "emerald" as const,
    },
    {
      label: metrics.sources || "Sources",
      value: d.metrics.mixedSourceCount,
      href: d.links.mixedAgriSourcesUrl,
      icon: <Database className="h-5 w-5" />,
      tone: "amber" as const,
    },
    {
      label: metrics.facts || "Facts",
      value: d.metrics.mixedFactCount,
      href: d.links.mixedAgriFactsUrl,
      icon: <FileText className="h-5 w-5" />,
      tone: "slate" as const,
    },
  ];

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return d.rules;
    return d.rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.diseaseName.toLowerCase().includes(q) ||
        r.symptomNames.some((s) => s.toLowerCase().includes(q)),
    );
  }, [d.rules, query]);

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

        <div className="grid gap-4 md:grid-cols-2">
          <AdminSectionCard
            delayIndex={1}
            title={sections.workspace || "Knowledge Tools"}
            subtitle={sections.workspaceSubtitle}
            icon={<GitBranch className="h-4 w-4" />}
          >
            <div className="flex flex-wrap gap-2">
              <a href={d.links.createSymptomUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                {labels.addSymptom || "Add Symptom"}
              </a>
              <a href={d.links.createRuleUrl} className="ai-btn-primary h-9 px-3 text-xs">
                {labels.addRule || "Add Rule"}
              </a>
              <a href={d.links.diseasesUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                {labels.diagnosisKnowledge || "Diagnosis Knowledge"}
              </a>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={2}
            title={sections.mixedAgri || "Mixed Agriculture"}
            subtitle={sections.mixedAgriSubtitle}
            icon={<Database className="h-4 w-4" />}
          >
            <div className="flex flex-wrap gap-2">
              <a href={d.links.mixedAgriDashboardUrl} className="ai-btn-primary h-9 px-3 text-xs">
                {labels.openWorkspace || "Open Workspace"}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a href={d.links.mixedAgriSourcesUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                {labels.manageSources || "Sources"}
              </a>
              <a href={d.links.mixedAgriFactsUrl} className="ai-btn-secondary h-9 px-3 text-xs">
                {labels.manageFacts || "Facts"}
              </a>
            </div>
          </AdminSectionCard>
        </div>

        <AdminSectionCard
          delayIndex={3}
          noPadding
          title={sections.rules || "Rules Engine"}
          subtitle={sections.rulesSubtitle}
          icon={<GitBranch className="h-4 w-4" />}
          action={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isKhmer ? "ស្វែងរកច្បាប់..." : "Filter rules..."}
                className="ai-input py-1.5 pl-8 text-xs"
              />
            </div>
          }
        >
          {filteredRules.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title={labels.noRulesAdded || "No rules added yet."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e3e6ed] bg-[#f5f7fa] text-[11px] uppercase tracking-wider text-[#6e7891] dark:border-[#2b3245] dark:bg-[#0f111a] dark:text-[#8a94ad]">
                  <tr>
                    <th className="px-4 py-3 font-bold">{labels.id || "ID"}</th>
                    <th className="px-4 py-3 font-bold">{labels.ruleName || "Rule"}</th>
                    <th className="px-4 py-3 font-bold">{labels.disease || "Disease"}</th>
                    <th className="px-4 py-3 font-bold">{labels.symptoms || "Symptoms"}</th>
                    <th className="px-4 py-3 font-bold">{labels.confidence || "Confidence"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="ai-table-row">
                      <td className="px-4 py-3 font-mono text-[#6e7891] dark:text-[#8a94ad]">
                        #{rule.id}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#141824] dark:text-[#eff2f6]">
                        {rule.name}
                      </td>
                      <td className="px-4 py-3 text-[#31374a] dark:text-[#eff2f6]">
                        {rule.diseaseName}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {rule.symptomNames.map((sym, idx) => (
                            <AdminStatusBadge key={`${sym}-${idx}`} tone="indigo">
                              {sym}
                            </AdminStatusBadge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                        {rule.confidencePercent !== null
                          ? `${rule.confidencePercent}%`
                          : labels.notAvailable || "-"}
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
