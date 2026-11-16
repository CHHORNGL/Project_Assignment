import React, { useMemo, useState } from "react";
import { Check, GitBranch, Sliders, Stethoscope } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import {
  confidenceTone,
  ExpertFieldLabel,
  ExpertFormFooter,
  ExpertHeaderActions,
  ExpertSearchField,
} from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminProgressBar,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
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

  const selectAllVisible = () => {
    setSelectedSymptoms((prev) =>
      Array.from(new Set([...prev, ...filteredSymptoms.map((s) => s.id)])),
    );
  };

  const parsedConfidencePct = useMemo(() => {
    const num = Number.parseFloat(confidence);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num * 100)));
  }, [confidence]);

  const tierTone = confidenceTone(parsedConfidencePct);
  const tierLabel =
    parsedConfidencePct >= 80
      ? isKhmer
        ? "ភាពជាក់លាក់ខ្ពស់"
        : "High precision"
      : parsedConfidencePct >= 50
        ? isKhmer
          ? "កម្រិតមធ្យម"
          : "Moderate weight"
        : isKhmer
          ? "កម្រិតសាកល្បង"
          : "Exploratory";

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <form method="POST" action={d.formAction} className="min-w-0 space-y-5 lg:col-span-2">
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

          <AdminSectionCard
            delayIndex={0}
            title={sections.form || "Create Rule"}
            subtitle={sections.formSubtitle}
            icon={<GitBranch className="h-4 w-4" />}
          >
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <ExpertFieldLabel label={labels.ruleName || "Rule Name"} required />
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder={labels.ruleNamePlaceholder}
                    className="ai-input text-xs"
                  />
                </div>

                <div>
                  <ExpertFieldLabel label={labels.disease || "Disease"} required />
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
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                      {labels.symptoms || "Symptoms"}
                    </span>
                    <AdminStatusBadge tone="indigo">{selectedSymptoms.length}</AdminStatusBadge>
                  </div>
                  <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
                    <ExpertSearchField
                      value={symptomQuery}
                      onChange={setSymptomQuery}
                      placeholder={isKhmer ? "ស្វែងរករោគសញ្ញា..." : "Search symptoms..."}
                      className="min-w-0 sm:w-52"
                    />
                    {filteredSymptoms.length > 0 && (
                      <button
                        type="button"
                        onClick={selectAllVisible}
                        className="ai-btn-secondary h-9 px-2.5 text-[11px]"
                      >
                        {isKhmer ? "ជ្រើសទាំងអស់" : "Select visible"}
                      </button>
                    )}
                    {selectedSymptoms.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSymptoms([])}
                        className="ai-btn-secondary h-9 px-2.5 text-[11px]"
                      >
                        {isKhmer ? "សម្អាត" : "Clear"}
                      </button>
                    )}
                  </div>
                </div>

                {d.options.symptoms.length === 0 ? (
                  <AdminEmptyState
                    icon={<Stethoscope className="h-5 w-5" />}
                    title={labels.noSymptomsFound || "No symptoms found."}
                  />
                ) : filteredSymptoms.length === 0 ? (
                  <AdminEmptyState
                    icon={<Stethoscope className="h-5 w-5" />}
                    title={isKhmer ? "រកមិនឃើញរោគសញ្ញាទេ" : "No symptoms match your search"}
                    action={
                      <button
                        type="button"
                        onClick={() => setSymptomQuery("")}
                        className="ai-btn-secondary h-8 px-3 text-xs"
                      >
                        {isKhmer ? "បង្ហាញរោគសញ្ញាទាំងអស់" : "Show all symptoms"}
                      </button>
                    }
                  />
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
                            "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition",
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

              <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/85 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#31374a] dark:text-[#eff2f6]">
                    {labels.confidence || "Rule Confidence Weight"}:{" "}
                    <span className="font-mono font-bold text-[#3874ff] dark:text-[#85a9ff]">
                      {parsedConfidencePct}%
                    </span>
                  </span>
                  <AdminStatusBadge tone={tierTone}>{tierLabel}</AdminStatusBadge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value)}
                    className="min-w-[140px] flex-1 accent-[#3874ff]"
                  />
                  <input
                    type="number"
                    name="confidence"
                    min="0"
                    max="1"
                    step="0.01"
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value)}
                    className="ai-input h-9 w-20 text-center font-mono text-xs sm:w-24"
                  />
                </div>
                {labels.ruleHelp && (
                  <p className="mt-2 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {labels.ruleHelp}
                  </p>
                )}
              </div>
            </div>
          </AdminSectionCard>

          <ExpertFormFooter
            backUrl={d.backUrl}
            cancelLabel={labels.cancel || labels.back || "Cancel"}
            submitLabel={labels.saveRule || "Save Rule"}
          />
        </form>

        <AdminSectionCard
          className="min-w-0"
          delayIndex={1}
          title={sections.summary || "Knowledge Summary"}
          subtitle={sections.summarySubtitle}
          icon={<Sliders className="h-4 w-4" />}
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <span className="text-[#6e7891] dark:text-[#8a94ad]">
                {labels.availableDiseases || "Diseases"}
              </span>
              <span className="font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                {d.stats.diseaseCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <span className="text-[#6e7891] dark:text-[#8a94ad]">
                {labels.availableSymptoms || "Symptoms"}
              </span>
              <span className="font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                {d.stats.symptomCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#adc5ff] bg-[#e5edff] p-3.5 font-semibold text-[#004dff] dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]">
              <span>{labels.selectedSymptoms || "Selected Symptoms"}</span>
              <span className="font-bold tabular-nums">{selectedSymptoms.length}</span>
            </div>

            <div className="pt-1">
              <AdminProgressBar
                label={isKhmer ? "ទម្ងន់ទំនុកចិត្ត" : "Rule Confidence"}
                value={parsedConfidencePct}
                tone={tierTone}
                height="sm"
              />
            </div>
          </div>
        </AdminSectionCard>
      </div>
    </WorkspaceShell>
  );
}
