import React, { useMemo, useState } from "react";
import { ArrowLeft, Check, GitBranch, Save, Search } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { AdminSectionCard } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface CreateRuleData {
  formAction: string;
  backUrl: string;
  options: {
    diseases: Array<{ id: number; name: string }>;
    symptoms: Array<{ id: number; name: string }>;
  };
  stats: { diseaseCount: number; symptomCount: number };
}

export default function ExpertCreateRulePage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<CreateRuleData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const ui = bootstrap.ui as Record<string, any>;
  const labels = ui.labels || {};
  const sections = ui.sections || {};

  const [symptomQuery, setSymptomQuery] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<number[]>([]);
  const [confidence, setConfidence] = useState("0.85");

  const filteredSymptoms = useMemo(() => {
    const q = symptomQuery.trim().toLowerCase();
    if (!q) return d.options.symptoms;
    return d.options.symptoms.filter((s) => s.name.toLowerCase().includes(q));
  }, [d.options.symptoms, symptomQuery]);

  const toggleSymptom = (id: number) => {
    setSelectedSymptoms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <AdminSectionCard
          className="lg:col-span-2"
          delayIndex={0}
          title={sections.form || "Create Rule"}
          subtitle={sections.formSubtitle}
          icon={<GitBranch className="h-4 w-4" />}
        >
          <form method="POST" action={d.formAction} className="space-y-5">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.ruleName || "Rule Name"}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder={labels.ruleNamePlaceholder}
                  className="ai-input text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.disease || "Disease"}
                </label>
                <select name="disease_id" required className="ai-input text-xs">
                  <option value="">{labels.selectDisease || "Select disease"}</option>
                  {d.options.diseases.map((dis) => (
                    <option key={dis.id} value={String(dis.id)}>
                      {dis.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                  {labels.symptoms || "Symptoms"} ({selectedSymptoms.length})
                </label>
                <div className="relative w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    value={symptomQuery}
                    onChange={(e) => setSymptomQuery(e.target.value)}
                    placeholder={isKhmer ? "ស្វែងរករោគសញ្ញា..." : "Search symptoms..."}
                    className="ai-input py-1 pl-8 text-xs"
                  />
                </div>
              </div>

              {d.options.symptoms.length === 0 ? (
                <p className="text-xs text-[#6e7891]">{labels.noSymptomsFound || "No symptoms found."}</p>
              ) : (
                <div className="phoenix-scroll grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-[#cbd0dd] bg-[#f5f7fa] p-3 dark:border-[#373e53] dark:bg-[#0f111a] sm:grid-cols-2">
                  {filteredSymptoms.map((sym) => {
                    const checked = selectedSymptoms.includes(sym.id);
                    return (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => toggleSymptom(sym.id)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition",
                          checked
                            ? "border-[#3874ff] bg-[#e5edff] font-semibold text-[#004dff] dark:border-[#3874ff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                            : "border-[#cbd0dd]/80 bg-white hover:bg-[#eff2f6] dark:border-[#2b3245] dark:bg-[#141824] dark:hover:bg-[#1e2436]",
                        )}
                      >
                        <span className="truncate">{sym.name}</span>
                        {checked && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#3874ff] dark:text-[#85a9ff]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedSymptoms.map((id) => (
                <input key={id} type="hidden" name="symptoms" value={String(id)} />
              ))}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                {labels.confidence || "Confidence"}:{" "}
                <span className="font-bold text-[#3874ff] dark:text-[#85a9ff]">{confidence}</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className="flex-1 accent-[#3874ff]"
                />
                <input
                  type="number"
                  name="confidence"
                  min="0"
                  max="1"
                  step="0.01"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className="ai-input w-24 text-xs"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">{labels.ruleHelp}</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a href={d.backUrl} className="ai-btn-secondary gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                {labels.cancel || labels.back || "Cancel"}
              </a>
              <button type="submit" className="ai-btn-primary gap-1.5 px-5 text-xs">
                <Save className="h-3.5 w-3.5" />
                {labels.saveRule || "Save Rule"}
              </button>
            </div>
          </form>
        </AdminSectionCard>

        <AdminSectionCard
          delayIndex={1}
          title={sections.summary || "Knowledge Summary"}
          subtitle={sections.summarySubtitle}
        >
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <span className="text-[#6e7891] dark:text-[#8a94ad]">
                {labels.availableDiseases || "Diseases"}
              </span>
              <span className="font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                {d.stats.diseaseCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <span className="text-[#6e7891] dark:text-[#8a94ad]">
                {labels.availableSymptoms || "Symptoms"}
              </span>
              <span className="font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                {d.stats.symptomCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#adc5ff] bg-[#e5edff] p-3 font-semibold text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
              <span>{labels.selectedSymptoms || "Selected"}</span>
              <span className="font-bold tabular-nums">{selectedSymptoms.length}</span>
            </div>
          </div>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
