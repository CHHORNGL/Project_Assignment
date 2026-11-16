import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Cpu,
  Database,
  FileText,
  GitBranch,
  Plus,
  Stethoscope,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  confidenceTone,
  ExpertHeaderActions,
  ExpertSearchField,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
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

type ConfidenceBand = "all" | "high" | "medium" | "low";

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
  const [band, setBand] = useState<ConfidenceBand>("all");

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.rules.filter((r) => {
      if (band !== "all") {
        const pct = r.confidencePercent;
        if (pct === null) return false;
        if (band === "high" && pct < 80) return false;
        if (band === "medium" && (pct < 50 || pct >= 80)) return false;
        if (band === "low" && pct >= 50) return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.diseaseName.toLowerCase().includes(q) ||
        r.symptomNames.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [d.rules, query, band]);

  const hasFilters = query.trim().length > 0 || band !== "all";
  const bandTabs: Array<{ id: ConfidenceBand; label: string }> = [
    { id: "all", label: isKhmer ? "ទាំងអស់" : "All" },
    { id: "high", label: isKhmer ? "ខ្ពស់ ≥80%" : "High ≥80%" },
    { id: "medium", label: isKhmer ? "មធ្យម 50–79%" : "Medium" },
    { id: "low", label: isKhmer ? "ទាប <50%" : "Low" },
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <AdminKpiCard
            delayIndex={0}
            label={metrics.symptoms || "Symptoms"}
            value={d.metrics.symptomCount}
            icon={<Cpu className="h-5 w-5" />}
            tone="indigo"
            href={d.links.createSymptomUrl}
          />
          <AdminKpiCard
            delayIndex={1}
            label={metrics.rules || "Rules"}
            value={d.metrics.ruleCount}
            icon={<GitBranch className="h-5 w-5" />}
            tone="sky"
            href={d.links.createRuleUrl}
          />
          <AdminKpiCard
            delayIndex={2}
            label={metrics.diseases || "Diseases"}
            value={d.metrics.diseaseCount}
            icon={<BookOpen className="h-5 w-5" />}
            tone="emerald"
            href={d.links.diseasesUrl}
          />
          <AdminKpiCard
            delayIndex={3}
            label={metrics.sources || "Sources"}
            value={d.metrics.mixedSourceCount}
            icon={<Database className="h-5 w-5" />}
            tone="amber"
            href={d.links.mixedAgriSourcesUrl}
          />
          <AdminKpiCard
            delayIndex={4}
            label={metrics.facts || "Facts"}
            value={d.metrics.mixedFactCount}
            icon={<FileText className="h-5 w-5" />}
            tone="slate"
            href={d.links.mixedAgriFactsUrl}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AdminSectionCard
            delayIndex={1}
            title={sections.workspace || "Knowledge Tools"}
            subtitle={sections.workspaceSubtitle}
            icon={<GitBranch className="h-4 w-4" />}
            action={
              <AdminStatusBadge tone="indigo">
                {d.metrics.ruleCount} {metrics.rules || "Rules"}
              </AdminStatusBadge>
            }
          >
            <div className="flex flex-wrap gap-2">
              <a href={d.links.createSymptomUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                <Stethoscope className="h-3.5 w-3.5" />
                <span>{labels.addSymptom || "Add Symptom"}</span>
              </a>
              <a href={d.links.createRuleUrl} className="ai-btn-primary h-9 gap-1.5 px-3 text-xs">
                <Plus className="h-3.5 w-3.5" />
                <span>{labels.addRule || "Add Rule"}</span>
              </a>
              <a href={d.links.diseasesUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                <BookOpen className="h-3.5 w-3.5" />
                <span>{labels.diagnosisKnowledge || "Diagnosis Knowledge"}</span>
              </a>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={2}
            title={sections.mixedAgri || "Mixed Agriculture"}
            subtitle={sections.mixedAgriSubtitle}
            icon={<Database className="h-4 w-4" />}
            action={
              <AdminStatusBadge tone="emerald">
                {d.metrics.mixedFactCount} {metrics.facts || "Facts"}
              </AdminStatusBadge>
            }
          >
            <div className="flex flex-wrap gap-2">
              <a href={d.links.mixedAgriDashboardUrl} className="ai-btn-primary h-9 gap-1.5 px-3 text-xs">
                <span>{labels.openWorkspace || "Open Workspace"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a href={d.links.mixedAgriSourcesUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                <Database className="h-3.5 w-3.5" />
                <span>{labels.manageSources || "Sources"}</span>
              </a>
              <a href={d.links.mixedAgriFactsUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
                <FileText className="h-3.5 w-3.5" />
                <span>{labels.manageFacts || "Facts"}</span>
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
            <AdminStatusBadge tone="indigo">
              {filteredRules.length} / {d.rules.length}
            </AdminStatusBadge>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ed] px-5 py-3.5 dark:border-[#2b3245]">
            <ExpertSearchField
              value={query}
              onChange={setQuery}
              placeholder={isKhmer ? "ស្វែងរកច្បាប់ ជំងឺ ឬរោគសញ្ញា..." : "Filter rules, disease, or symptom..."}
            />

            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#cbd0dd] bg-[#eff2f6] p-1 dark:border-[#373e53] dark:bg-[#0f111a]">
              {bandTabs.map((tab) => {
                const active = band === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBand(tab.id)}
                    className={
                      active
                        ? "rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                        : "rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#525b75] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#eff2f6]"
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredRules.length === 0 ? (
            <div className="p-8">
              <AdminEmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title={
                  hasFilters
                    ? isKhmer
                      ? "មិនមានច្បាប់ត្រូវនឹងការច្រោះទេ"
                      : "No matching rules"
                    : labels.noRulesAdded || "No rules added yet."
                }
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setBand("all");
                      }}
                      className="ai-btn-secondary h-8 px-3 text-xs"
                    >
                      {isKhmer ? "បង្ហាញទាំងអស់" : "Reset filters"}
                    </button>
                  ) : undefined
                }
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
                  {filteredRules.map((rule) => {
                    const visibleSymptoms = rule.symptomNames.slice(0, 4);
                    const overflowCount = Math.max(0, rule.symptomNames.length - 4);
                    return (
                      <tr key={rule.id} className="ai-table-row">
                        <td className="px-4 py-3.5 font-mono text-[#6e7891] dark:text-[#8a94ad]">
                          #{rule.id}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-[#141824] dark:text-[#eff2f6]">
                          {rule.name}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex rounded-md border border-[#cbd0dd] bg-[#f5f7fa] px-2 py-0.5 text-[11px] font-semibold text-[#31374a] dark:border-[#373e53] dark:bg-[#0f111a] dark:text-[#eff2f6]">
                            {rule.diseaseName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {visibleSymptoms.map((sym, idx) => (
                              <AdminStatusBadge key={`${sym}-${idx}`} tone="indigo">
                                {sym}
                              </AdminStatusBadge>
                            ))}
                            {overflowCount > 0 && (
                              <AdminStatusBadge tone="slate">+{overflowCount}</AdminStatusBadge>
                            )}
                          </div>
                        </td>
                        <td className="w-40 px-4 py-3.5">
                          {rule.confidencePercent !== null ? (
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1">
                                <AdminProgressBar
                                  value={rule.confidencePercent}
                                  tone={confidenceTone(rule.confidencePercent)}
                                  height="sm"
                                />
                              </div>
                              <span className="w-10 text-right font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                                {rule.confidencePercent}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#8a94ad]">{labels.notAvailable || "-"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
