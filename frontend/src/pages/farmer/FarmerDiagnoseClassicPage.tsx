import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ImagePlus, ScanLine, Search, Sparkles, Sprout } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { postJson } from "@/lib/api";
import { selectCropState } from "@/lib/diagnosisHelpers";
import { cn } from "@/lib/utils";

interface SymptomOption {
  id?: number;
  name: string;
  name_kh?: string;
}

interface ClassicDiagnoseData {
  postUrl: string;
  liveEvalUrl: string;
  guidedUrl: string;
  selectedCropId?: number | null;
  crops: Array<{ id: number; name: string }>;
  cropSymptoms: Record<string, Array<SymptomOption | string>>;
  recentDiagnoses: Array<{
    id: number;
    cropName: string;
    diseaseName: string;
    status: string;
    confidence: number;
    resultUrl: string;
  }>;
}

export default function FarmerDiagnoseClassicPage({ bootstrap }: { bootstrap: AppBootstrap<ClassicDiagnoseData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [cropId, setCropId] = useState<string>(d.selectedCropId ? String(d.selectedCropId) : d.crops[0] ? String(d.crops[0].id) : "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [livePreview, setLivePreview] = useState<{ top_disease?: string; confidence?: number } | null>(null);

  const rawSymptoms = useMemo(() => d.cropSymptoms[String(cropId)] || [], [d.cropSymptoms, cropId]);
  const normalizedSymptoms = useMemo(
    () =>
      rawSymptoms.map((item) => {
        if (typeof item === "string") return { key: item, label: item };
        const label = isKhmer && item.name_kh ? item.name_kh : item.name;
        return { key: item.name, label };
      }),
    [rawSymptoms, isKhmer],
  );

  const filteredSymptoms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedSymptoms;
    return normalizedSymptoms.filter((s) => s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q));
  }, [normalizedSymptoms, search]);

  const handleSelectCrop = (nextId: string) => {
    const nextState = selectCropState(
      { cropId, selectedNames: selected, searchQuery: search },
      nextId,
    );
    if (nextState.cropId !== cropId) {
      setLivePreview(null);
    }
    setCropId(nextState.cropId);
    setSelected(nextState.selectedNames);
    setSearch(nextState.searchQuery);
  };

  useEffect(() => {
    if (!cropId || selected.length === 0) {
      setLivePreview(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await postJson<{
          top_candidate?: { disease_name?: string; confidence_percent?: number };
          candidates?: Array<{ disease_name?: string; confidence_percent?: number }>;
        }>(d.liveEvalUrl, { crop_id: Number(cropId), symptoms: selected }, bootstrap.csrfToken);
        const top = res.data.top_candidate || res.data.candidates?.[0];
        if (top) {
          setLivePreview({ top_disease: top.disease_name, confidence: top.confidence_percent });
        }
      } catch {
        // Optional live evaluation
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cropId, selected]);

  const toggleSymptom = (name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.guidedUrl} className="ai-btn-secondary h-9 px-3 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          {isKhmer ? "ប្តូរទៅ Wizard 4 ជំហាន" : "Switch to AI Wizard"}
        </a>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          method="post"
          action={d.postUrl}
          encType="multipart/form-data"
          className="ai-surface space-y-6 p-6 lg:col-span-2"
        >
          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
          <input type="hidden" name="crop_id" value={cropId} />
          <input type="hidden" name="symptoms" value={selected.join(", ")} />

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              1. {isKhmer ? "ជ្រើសរើសដំណាំ" : "Select Crop"}
            </label>
            <div className="flex flex-wrap gap-2">
              {d.crops.map((crop) => {
                const active = String(crop.id) === cropId;
                return (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => handleSelectCrop(String(crop.id))}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                      active
                        ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                        : "border-slate-200/80 hover:border-indigo-400 dark:border-slate-800",
                    )}
                  >
                    <Sprout className="h-3.5 w-3.5" />
                    {crop.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. {isKhmer ? "ជ្រើសរើសរោគសញ្ញា" : "Select Observed Symptoms"} ({selected.length})
              </label>
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isKhmer ? "ស្វែងរករោគសញ្ញា..." : "Filter symptoms..."}
                  className="ai-input py-1.5 pl-9 text-xs"
                />
              </div>
            </div>

            {filteredSymptoms.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">
                No symptoms listed for this crop yet.
              </p>
            ) : (
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredSymptoms.map((sym) => {
                  const checked = selected.includes(sym.key);
                  return (
                    <button
                      key={sym.key}
                      type="button"
                      onClick={() => toggleSymptom(sym.key)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition",
                        checked
                          ? "border-indigo-500 bg-indigo-500/10 font-semibold text-indigo-700 dark:text-indigo-200"
                          : "border-slate-200/80 hover:border-slate-300 dark:border-slate-800",
                      )}
                    >
                      <span>{sym.label}</span>
                      {checked && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              3. {isKhmer ? "ភ្ជាប់រូបភាពស្លឹក (ជាជម្រើស)" : "Field Leaf Photos (Optional)"}
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-xs hover:border-indigo-500 dark:border-slate-700">
              <ImagePlus className="h-5 w-5 text-indigo-500" />
              <span className="text-slate-600 dark:text-slate-300">Upload JPG/PNG leaf photos</span>
              <input type="file" name="diagnosis_image" accept=".jpg,.jpeg,.png,.webp,.gif" multiple className="hidden" />
            </label>
          </div>

          <button type="submit" disabled={!cropId || selected.length === 0} className="ai-btn-primary w-full py-3">
            <ScanLine className="h-4 w-4" />
            {isKhmer ? "ដំណើរការវិនិច្ឆ័យ" : "Run Diagnosis"}
          </button>
        </form>

        <div className="space-y-5">
          <div className="ai-surface p-5">
            <h3 className="font-display text-sm font-bold">Live Signal Match</h3>
            {livePreview?.top_disease ? (
              <div className="mt-3 rounded-xl bg-indigo-500/10 p-4">
                <p className="text-xs text-indigo-600 dark:text-indigo-300">Top Candidate</p>
                <p className="mt-1 font-display text-base font-bold">{livePreview.top_disease}</p>
                {livePreview.confidence !== undefined && (
                  <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                    Confidence: {Number(livePreview.confidence).toFixed(1)}%
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Select at least one symptom to preview rule candidates in real time.
              </p>
            )}
          </div>

          <div className="ai-surface p-5">
            <h3 className="mb-3 font-display text-sm font-bold">Recent Diagnoses</h3>
            <ul className="space-y-2 text-xs">
              {d.recentDiagnoses.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.resultUrl}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 p-2.5 hover:border-indigo-500/40 dark:border-slate-800"
                  >
                    <div>
                      <p className="font-semibold">{item.diseaseName}</p>
                      <p className="text-[11px] text-slate-400">{item.cropName}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
