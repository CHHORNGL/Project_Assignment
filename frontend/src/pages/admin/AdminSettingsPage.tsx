import React, { useState } from "react";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Cpu,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { requestJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import {
  AdminSectionCard,
  AdminSegmentedTabs,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface AdminSettingsData {
  activeTab: string;
  formAction: string;
  testConnectionUrl: string;
  generateKeyUrl: string;
  general: {
    systemName: string;
    serverLocationName: string;
    serverLocationLat: string;
    serverLocationLon: string;
  };
  provinces: Array<{ id: string; name: string; lat: string; lon: string }>;
  trainedAi: {
    activeProvider: string;
    hfModelId: string;
    hfInferenceUrl: string;
    hfKeyConfigured: boolean;
    legacyFallbackEnabled: boolean;
    hfModels: Array<{ id: string; label?: string; model_id?: string; endpoint?: string; active?: boolean }>;
    activeModelId: string;
  };
}

export default function AdminSettingsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminSettingsData>;
}) {
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [tab, setTab] = useState<"general" | "trained" | "guide">(
    d.activeTab === "trained" || d.activeTab === "guide" ? d.activeTab : "general",
  );
  const [locName, setLocName] = useState(d.general.serverLocationName);
  const [locLat, setLocLat] = useState(d.general.serverLocationLat);
  const [locLon, setLocLon] = useState(d.general.serverLocationLon);

  const [generatedKey, setGeneratedKey] = useState("");
  const [testingAi, setTestingAi] = useState(false);

  const handleProvinceChange = (provinceId: string) => {
    const found = d.provinces.find((p) => p.id === provinceId);
    if (found) {
      setLocName(found.name);
      if (found.lat) setLocLat(found.lat);
      if (found.lon) setLocLon(found.lon);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const { data: res } = await requestJson<{ success: boolean; api_key?: string }>(
        d.generateKeyUrl,
        "POST",
        bootstrap.csrfToken,
      );
      if (res.success && res.api_key) {
        setGeneratedKey(res.api_key);
        pushToast("success", "Generated high-entropy inference API key.");
      }
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Failed to generate key.");
    }
  };

  const handleTestTrainedAi = async () => {
    setTestingAi(true);
    try {
      const { data: res } = await requestJson<{ success: boolean; message?: string; error?: string }>(
        d.testConnectionUrl,
        "POST",
        bootstrap.csrfToken,
        { provider: "own-ai", endpoint: d.trainedAi.hfInferenceUrl },
      );
      pushToast(res.success ? "success" : "warning", res.message || res.error || "Test finished.");
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTestingAi(false);
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        <AdminSegmentedTabs
          activeId={tab}
          onChange={setTab}
          tabs={[
            { id: "general", label: "General & Location", icon: <MapPin className="h-3.5 w-3.5" /> },
            {
              id: "trained",
              label: "Trained AI Models",
              icon: <Cpu className="h-3.5 w-3.5" />,
              badge: d.trainedAi.hfModels.length || undefined,
            },
            { id: "guide", label: "Deployment Guide", icon: <BookOpen className="h-3.5 w-3.5" /> },
          ]}
        />

        {tab === "general" && (
          <div key="general" className="ai-tab-panel max-w-3xl">
            <AdminSectionCard
              title="General Platform & Geo Configuration"
              subtitle="Set platform display identity and default agricultural monitoring coordinates"
              icon={<MapPin className="h-4 w-4" />}
            >
              <form method="POST" action={d.formAction} className="space-y-5">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="form_type" value="general" />

                <div>
                  <label className="mb-1.5 block text-xs font-semibold">Platform Name</label>
                  <input
                    type="text"
                    name="system_name"
                    defaultValue={d.general.systemName}
                    className="ai-input text-xs"
                  />
                </div>

                {d.provinces.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">Cambodia Province Preset</label>
                    <select onChange={(e) => handleProvinceChange(e.target.value)} className="ai-input text-xs">
                      <option value="">Select province...</option>
                      {d.provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">Server Location Label</label>
                    <input
                      type="text"
                      name="server_location_name"
                      value={locName}
                      onChange={(e) => setLocName(e.target.value)}
                      className="ai-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">Latitude</label>
                    <input
                      type="text"
                      name="server_location_lat"
                      value={locLat}
                      onChange={(e) => setLocLat(e.target.value)}
                      className="ai-input font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">Longitude</label>
                    <input
                      type="text"
                      name="server_location_lon"
                      value={locLon}
                      onChange={(e) => setLocLon(e.target.value)}
                      className="ai-input font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-800/80">
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(`${locLat},${locLon}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Preview Map <ExternalLink className="h-3 w-3" />
                  </a>
                  <button type="submit" className="ai-btn-primary gap-1.5 px-6 text-xs">
                    <Save className="h-3.5 w-3.5" /> Save General Settings
                  </button>
                </div>
              </form>
            </AdminSectionCard>
          </div>
        )}

        {tab === "trained" && (
          <div key="trained" className="ai-tab-panel space-y-6">
            <AdminSectionCard
              title="Self-Trained Agricultural AI Engine"
              subtitle="Primary inference endpoint & bearer credential management"
              icon={<Bot className="h-4 w-4" />}
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateKey}
                    className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Generate API Key
                  </button>
                  <button
                    type="button"
                    onClick={handleTestTrainedAi}
                    disabled={testingAi}
                    className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                  >
                    {testingAi ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    )}
                    Test Endpoint
                  </button>
                </div>
              }
            >
              <form method="POST" action={d.formAction} className="space-y-5">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">Hugging Face / Model ID</label>
                    <input
                      type="text"
                      name="hf_model_id"
                      defaultValue={d.trainedAi.hfModelId}
                      className="ai-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">Inference Endpoint URL</label>
                    <input
                      type="url"
                      name="hf_inference_url"
                      defaultValue={d.trainedAi.hfInferenceUrl}
                      className="ai-input font-mono text-xs"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold">Inference API Key / HF Token</label>
                      {d.trainedAi.hfKeyConfigured && (
                        <AdminStatusBadge tone="emerald">Configured</AdminStatusBadge>
                      )}
                    </div>
                    <input
                      type="text"
                      name="hf_api_key"
                      value={generatedKey}
                      onChange={(e) => setGeneratedKey(e.target.value)}
                      placeholder="Leave blank to keep existing key..."
                      className="ai-input font-mono text-xs"
                    />
                  </div>
                </div>

                <button type="submit" className="ai-btn-primary gap-1.5 px-6 text-xs">
                  <Save className="h-3.5 w-3.5" /> Save Active Endpoint
                </button>
              </form>
            </AdminSectionCard>

            <AdminSectionCard
              delayIndex={1}
              title="Add / Register Trained Model Profile"
              subtitle="Hot-swap between regional fine-tuned model endpoints"
              icon={<Plus className="h-4 w-4" />}
            >
              <form method="POST" action={d.formAction} className="space-y-4">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="model_action" value="activate" />
                <div className="grid gap-3 md:grid-cols-4">
                  <input type="text" name="label" placeholder="Display Name" className="ai-input text-xs" />
                  <input type="text" name="model_id" required placeholder="Model ID" className="ai-input text-xs" />
                  <input type="url" name="endpoint" required placeholder="https://..." className="ai-input text-xs" />
                  <input
                    type="password"
                    name="model_api_key"
                    placeholder="Token (optional)"
                    className="ai-input text-xs"
                  />
                </div>
                <button type="submit" className="ai-btn-secondary text-xs">
                  Save & Activate Profile
                </button>
              </form>
            </AdminSectionCard>

            {d.trainedAi.hfModels.length > 0 && (
              <AdminSectionCard
                delayIndex={2}
                noPadding
                title="Registered Model Profiles"
                icon={<Cpu className="h-4 w-4" />}
              >
                <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {d.trainedAi.hfModels.map((m) => (
                    <div
                      key={m.id}
                      className="ai-table-row flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white">{m.label || m.model_id}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {m.endpoint}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.id === d.trainedAi.activeModelId && (
                          <AdminStatusBadge tone="emerald" pulse>
                            <CheckCircle2 className="mr-1 inline h-3 w-3" /> Active
                          </AdminStatusBadge>
                        )}
                        <form method="POST" action={d.formAction}>
                          <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                          <input type="hidden" name="model_action" value="delete" />
                          <input type="hidden" name="profile_id" value={m.id} />
                          <button
                            type="submit"
                            className="ai-btn-secondary h-8 px-2.5 text-xs text-rose-600 dark:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </AdminSectionCard>
            )}
          </div>
        )}

        {tab === "guide" && (
          <div key="guide" className="ai-tab-panel max-w-3xl">
            <AdminSectionCard
              title="Self-Hosted Trained AI Deployment"
              subtitle="Recommended checklist before switching production farmer traffic"
              icon={<BookOpen className="h-4 w-4" />}
            >
              <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {[
                  "Deploy your fine-tuned Qwen/Agri model behind an HTTPS endpoint with `HF_API_KEY` or bearer auth enabled.",
                  "Generate a shared inference API key on the Trained AI Models tab and paste it into both your model service and the active profile.",
                  "Click Test Endpoint to verify round-trip latency before enabling farmer chat.",
                ].map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/75 p-4 dark:border-slate-800/80 dark:bg-obsidian-950/60"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-display text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <p className="pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </AdminSectionCard>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
