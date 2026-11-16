import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ClipboardList,
  Compass,
  Copy,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { requestJson } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminNoticeBanner,
  AdminSectionCard,
  AdminSegmentedTabs,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface ModelProfileRow {
  id: string;
  label?: string;
  model_id?: string;
  endpoint?: string;
  active?: boolean;
  hasToken?: boolean;
}

interface ProvincePreset {
  id: string;
  name: string;
  label?: string;
  lat: string;
  lon: string;
}

interface AdminSettingsData {
  activeTab: string;
  formAction: string;
  testConnectionUrl: string;
  generateKeyUrl: string;
  links?: {
    worldUrl?: string;
    auditLogsUrl?: string;
  };
  general: {
    systemName: string;
    serverLocationName: string;
    serverLocationLat: string;
    serverLocationLon: string;
  };
  provinces: ProvincePreset[];
  trainedAi: {
    activeProvider: string;
    hfModelId: string;
    hfInferenceUrl: string;
    hfKeyConfigured: boolean;
    legacyFallbackEnabled: boolean;
    hfModels: ModelProfileRow[];
    activeModelId: string;
    editingModel?: ModelProfileRow | null;
  };
}

export default function AdminSettingsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<AdminSettingsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [tab, setTab] = useState<"general" | "trained" | "guide">(
    d.activeTab === "trained" || d.activeTab === "guide" ? d.activeTab : "general",
  );

  // General & Geo Form State
  const [systemNameInput, setSystemNameInput] = useState(d.general.systemName);
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [locName, setLocName] = useState(d.general.serverLocationName);
  const [locLat, setLocLat] = useState(d.general.serverLocationLat);
  const [locLon, setLocLon] = useState(d.general.serverLocationLon);

  // Primary AI Engine Form State
  const [hfModelId, setHfModelId] = useState(d.trainedAi.hfModelId);
  const [hfUrl, setHfUrl] = useState(d.trainedAi.hfInferenceUrl);
  const [generatedKey, setGeneratedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // Endpoint Test State
  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [testBanner, setTestBanner] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Profile Editor & Delete Confirmation State
  const profileFormRef = useRef<HTMLDivElement | null>(null);
  const [editingProfileId, setEditingProfileId] = useState(
    d.trainedAi.editingModel?.id || "",
  );
  const [profileLabel, setProfileLabel] = useState(
    d.trainedAi.editingModel?.label || "",
  );
  const [profileModelId, setProfileModelId] = useState(
    d.trainedAi.editingModel?.model_id || "",
  );
  const [profileEndpoint, setProfileEndpoint] = useState(
    d.trainedAi.editingModel?.endpoint || "",
  );
  const [profileApiKey, setProfileApiKey] = useState("");
  const [activateOnSave, setActivateOnSave] = useState(true);
  const [pendingDeleteProfile, setPendingDeleteProfile] =
    useState<ModelProfileRow | null>(null);

  useEffect(() => {
    if (!pendingDeleteProfile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingDeleteProfile(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDeleteProfile]);

  const coordStatus = useMemo(() => {
    const latNum = Number.parseFloat(locLat);
    const lonNum = Number.parseFloat(locLon);
    const latValid = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90;
    const lonValid = Number.isFinite(lonNum) && lonNum >= -180 && lonNum <= 180;
    return { latValid, lonValid, valid: latValid && lonValid, latNum, lonNum };
  }, [locLat, locLon]);

  const activeProfile = useMemo(
    () =>
      d.trainedAi.hfModels.find(
        (m) => m.id === d.trainedAi.activeModelId || m.active,
      ) || null,
    [d.trainedAi.hfModels, d.trainedAi.activeModelId],
  );

  const handleProvinceChange = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    const found = d.provinces.find((p) => p.id === provinceId);
    if (found) {
      setLocName(found.name);
      if (found.lat) setLocLat(found.lat);
      if (found.lon) setLocLon(found.lon);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const { data: res } = await requestJson<{
        success: boolean;
        api_key?: string;
      }>(d.generateKeyUrl, "POST", bootstrap.csrfToken);
      if (res.success && res.api_key) {
        setGeneratedKey(res.api_key);
        setShowKey(true);
        pushToast(
          "success",
          isKhmer
            ? "បានបង្កើតសោ API សុវត្ថិភាពខ្ពស់ថ្មីរួចរាល់។"
            : "Generated high-entropy inference API key.",
        );
      }
    } catch (err) {
      pushToast(
        "danger",
        err instanceof Error
          ? err.message
          : isKhmer
            ? "មិនអាចបង្កើតសោ API បានទេ។"
            : "Failed to generate key.",
      );
    }
  };

  const handleCopyText = async (
    value: string,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setter(true);
      window.setTimeout(() => setter(false), 1600);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  };

  const runConnectionTest = async (
    targetKey: string,
    endpoint: string,
    apiKey?: string,
  ) => {
    setTestingTarget(targetKey);
    try {
      const payload: Record<string, string> = {
        provider: "own-ai",
        endpoint: endpoint.trim(),
      };
      if (apiKey && apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const { data: res } = await requestJson<{
        success: boolean;
        message?: string;
        error?: string;
        latency_ms?: number;
      }>(d.testConnectionUrl, "POST", bootstrap.csrfToken, payload);

      const message =
        res.message ||
        res.error ||
        (isKhmer ? "ការសាកល្បងការតភ្ជាប់បានបញ្ចប់។" : "Test finished.");
      setTestBanner({ ok: Boolean(res.success), message });
      pushToast(res.success ? "success" : "warning", message);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isKhmer
            ? "ការតភ្ជាប់ទៅ Endpoint បរាជ័យ។"
            : "Connection test failed.";
      setTestBanner({ ok: false, message });
      pushToast("danger", message);
    } finally {
      setTestingTarget(null);
    }
  };

  const startEditProfile = (profile: ModelProfileRow) => {
    setEditingProfileId(profile.id);
    setProfileLabel(profile.label || "");
    setProfileModelId(profile.model_id || "");
    setProfileEndpoint(profile.endpoint || "");
    setProfileApiKey("");
    setActivateOnSave(profile.id === d.trainedAi.activeModelId || Boolean(profile.active));
    profileFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const resetProfileForm = () => {
    setEditingProfileId("");
    setProfileLabel("");
    setProfileModelId("");
    setProfileEndpoint("");
    setProfileApiKey("");
    setActivateOnSave(true);
  };

  const envTemplate = useMemo(
    () =>
      [
        "AI_PROVIDER=own-ai",
        `HF_MODEL_ID=${hfModelId || "Maoseavik/agri-qwen3b-lora"}`,
        `HF_INFERENCE_URL=${hfUrl || "https://your-space.hf.space"}`,
        `HF_API_KEY=${generatedKey || "<paste-generated-key>"}`,
      ].join("\n"),
    [hfModelId, hfUrl, generatedKey],
  );

  const readinessChecks = [
    {
      label: isKhmer ? "URL សម្រាប់ Inference Endpoint" : "Inference Endpoint URL",
      detail:
        hfUrl.trim() ||
        (isKhmer ? "មិនទាន់បានកំណត់ URL ទេ" : "No deployed endpoint configured yet"),
      ok: Boolean(hfUrl.trim()),
    },
    {
      label: isKhmer ? "សោផ្ទៀងផ្ទាត់ Bearer API Key" : "Bearer API Key Secret",
      detail: d.trainedAi.hfKeyConfigured
        ? isKhmer
          ? "បានរក្សាទុកសោសុវត្ថិភាពរួចរាល់"
          : "Stored securely on server"
        : isKhmer
          ? "សូមបង្កើត និងបញ្ចូលសោ API Key"
          : "Generate or paste a bearer secret",
      ok: d.trainedAi.hfKeyConfigured,
    },
    {
      label: isKhmer ? "ទម្រង់ម៉ូដែល AI ដែលបានចុះឈ្មោះ" : "Registered Trained Model Profiles",
      detail:
        d.trainedAi.hfModels.length > 0
          ? `${d.trainedAi.hfModels.length} ${isKhmer ? "ម៉ូដែលត្រូវបានកំណត់" : "profile(s) ready"}`
          : isKhmer
            ? "ប្រើការកំណត់ Endpoint មេតែមួយ"
            : "Using primary endpoint configuration",
      ok: d.trainedAi.hfModels.length > 0 || Boolean(hfModelId.trim()),
    },
    {
      label: isKhmer ? "កូអរដោណេស្ថានីយ៍អាកាសធាតុ" : "Server Weather Geo Coordinates",
      detail: `${d.general.serverLocationName} (${d.general.serverLocationLat}, ${d.general.serverLocationLon})`,
      ok: Boolean(d.general.serverLocationName),
    },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.links?.worldUrl && (
            <a href={d.links.worldUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <Globe className="h-3.5 w-3.5" />
              <span>{isKhmer ? "ផែនទី និងអាកាសធាតុ" : "World & Weather"}</span>
            </a>
          )}
          {d.links?.auditLogsUrl && (
            <a href={d.links.auditLogsUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>{isKhmer ? "កំណត់ហេតុប្រព័ន្ធ" : "Audit Logs"}</span>
            </a>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top System & AI Telemetry Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "អត្តសញ្ញាណប្រព័ន្ធ" : "Platform Identity"}
            value={d.general.systemName}
            hint={isKhmer ? "បង្ហាញលើចំណងជើង និងសេវាកម្ម" : "Active platform branding"}
            tone="indigo"
            icon={<Server className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "ទីតាំងម៉ាស៊ីនមេ" : "Geo Anchor"}
            value={d.general.serverLocationName}
            hint={`${d.general.serverLocationLat}, ${d.general.serverLocationLon}`}
            tone="sky"
            icon={<MapPin className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "ម៉ូដែល AI សកម្ម" : "Active AI Engine"}
            value={
              activeProfile?.label ||
              d.trainedAi.hfModelId.split("/").pop() ||
              d.trainedAi.hfModelId ||
              "Own AI"
            }
            hint={d.trainedAi.hfInferenceUrl ? "HTTPS / Space Endpoint" : isKhmer ? "មិនទាន់កំណត់ URL" : "Endpoint not configured"}
            tone="emerald"
            badge={isKhmer ? "Self-Trained Only" : "Self-Trained Mode"}
            icon={<Bot className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "ទម្រង់ម៉ូដែល និងសោ" : "Profiles & Auth"}
            value={d.trainedAi.hfModels.length}
            hint={
              d.trainedAi.hfKeyConfigured
                ? isKhmer
                  ? "Bearer Key ត្រូវបានកំណត់រួច"
                  : "Bearer secret active"
                : isKhmer
                  ? "មិនទាន់មាន Bearer Key ទេ"
                  : "Missing inference key"
            }
            tone={d.trainedAi.hfKeyConfigured ? "indigo" : "amber"}
            badge={
              d.trainedAi.hfKeyConfigured
                ? isKhmer
                  ? "បានកំណត់សោ"
                  : "Key Configured"
                : isKhmer
                  ? "ត្រូវការសោ"
                  : "Key Needed"
            }
            icon={<KeyRound className="h-5 w-5" />}
          />
        </div>

        {/* Navigation Segmented Tabs */}
        <AdminSegmentedTabs
          activeId={tab}
          onChange={setTab}
          tabs={[
            {
              id: "general",
              label: isKhmer ? "ទូទៅ និងទីតាំង" : "General & Location",
              icon: <MapPin className="h-3.5 w-3.5" />,
            },
            {
              id: "trained",
              label: isKhmer ? "ម៉ូដែល AI ផ្ទាល់ខ្លួន" : "Trained AI Models",
              icon: <Cpu className="h-3.5 w-3.5" />,
              badge: d.trainedAi.hfModels.length || undefined,
            },
            {
              id: "guide",
              label: isKhmer ? "ការណែនាំដាក់ឱ្យដំណើរការ" : "Deployment Guide",
              icon: <BookOpen className="h-3.5 w-3.5" />,
            },
          ]}
        />

        {/* TAB 1: GENERAL & GEO CONFIGURATION */}
        {tab === "general" && (
          <div key="general" className="ai-tab-panel grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <AdminSectionCard
                title={
                  isKhmer
                    ? "អត្តសញ្ញាណប្រព័ន្ធ និងកូអរដោណេមូលដ្ឋាន"
                    : "General Platform & Geo Configuration"
                }
                subtitle={
                  isKhmer
                    ? "កំណត់ឈ្មោះផ្លូវការ និងទីតាំងម៉ាស៊ីនមេសម្រាប់ទិន្នន័យអាកាសធាតុ"
                    : "Set platform display identity and default agricultural monitoring coordinates"
                }
                icon={<MapPin className="h-4 w-4" />}
              >
                <form method="POST" action={d.formAction} className="space-y-5">
                  <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                  <input type="hidden" name="form_type" value="general" />

                  <div>
                    <label
                      htmlFor="system_name_input"
                      className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                    >
                      {isKhmer ? "ឈ្មោះប្រព័ន្ធ (Platform Name)" : "Platform Name"}
                    </label>
                    <input
                      id="system_name_input"
                      type="text"
                      name="system_name"
                      required
                      maxLength={120}
                      value={systemNameInput}
                      onChange={(e) => setSystemNameInput(e.target.value)}
                      className="ai-input text-xs"
                    />
                  </div>

                  {d.provinces.length > 0 && (
                    <div>
                      <label
                        htmlFor="cambodia_province_select"
                        className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                      >
                        {isKhmer
                          ? `ជ្រើសរើសខេត្ត/រាជធានីនៅកម្ពុជា (${d.provinces.length})`
                          : `Cambodia Province Preset (${d.provinces.length})`}
                      </label>
                      <select
                        id="cambodia_province_select"
                        value={selectedProvinceId}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                        className="ai-input text-xs"
                      >
                        <option value="">
                          {isKhmer ? "-- ជ្រើសរើសខេត្ត --" : "Select province preset..."}
                        </option>
                        {d.provinces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label || p.name} ({p.lat}, {p.lon})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        {isKhmer
                          ? "ជ្រើសរើសខេត្តណាមួយដើម្បីបំពេញឈ្មោះ និងកូអរដោណេដោយស្វ័យប្រវត្តិ។"
                          : "Selecting a province auto-fills station label, latitude, and longitude."}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="server_location_name_input"
                        className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                      >
                        {isKhmer ? "ឈ្មោះទីតាំងម៉ាស៊ីនមេ" : "Server Location Label"}
                      </label>
                      <input
                        id="server_location_name_input"
                        type="text"
                        name="server_location_name"
                        required
                        value={locName}
                        onChange={(e) => setLocName(e.target.value)}
                        className="ai-input text-xs"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="server_location_lat_input"
                        className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                      >
                        {isKhmer ? "រយៈទទឹង (Latitude)" : "Latitude"}
                      </label>
                      <input
                        id="server_location_lat_input"
                        type="text"
                        name="server_location_lat"
                        required
                        value={locLat}
                        onChange={(e) => setLocLat(e.target.value)}
                        className={cn(
                          "ai-input font-mono text-xs tabular-nums",
                          !coordStatus.latValid && "border-[#fa3b1d] focus:border-[#fa3b1d]",
                        )}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="server_location_lon_input"
                        className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                      >
                        {isKhmer ? "រយៈបណ្តោយ (Longitude)" : "Longitude"}
                      </label>
                      <input
                        id="server_location_lon_input"
                        type="text"
                        name="server_location_lon"
                        required
                        value={locLon}
                        onChange={(e) => setLocLon(e.target.value)}
                        className={cn(
                          "ai-input font-mono text-xs tabular-nums",
                          !coordStatus.lonValid && "border-[#fa3b1d] focus:border-[#fa3b1d]",
                        )}
                      />
                    </div>
                  </div>

                  {!coordStatus.valid && (
                    <AdminNoticeBanner
                      tone="rose"
                      message={
                        isKhmer
                          ? "រយៈទទឹងត្រូវស្ថិតនៅចន្លោះ -90 ដល់ 90 និងរយៈបណ្តោយចន្លោះ -180 ដល់ 180។"
                          : "Latitude must be between -90 and 90, and longitude between -180 and 180."
                      }
                    />
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                    <a
                      href={`https://www.google.com/maps?q=${encodeURIComponent(`${locLat},${locLon}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[#3874ff]" />
                      <span>{isKhmer ? "មើលលើ Google Maps" : "Preview Map"}</span>
                      <ExternalLink className="h-3 w-3 opacity-70" />
                    </a>
                    <button
                      type="submit"
                      disabled={!coordStatus.valid}
                      className="ai-btn-primary h-9 gap-1.5 px-5 text-xs disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "រក្សាទុកការកំណត់ទូទៅ" : "Save General Settings"}</span>
                    </button>
                  </div>
                </form>
              </AdminSectionCard>
            </div>

            <div className="lg:col-span-5">
              <AdminSectionCard
                delayIndex={1}
                title={isKhmer ? "ទិដ្ឋភាពទីតាំង និងអាកាសធាតុ" : "Live Geo & Telemetry Preview"}
                subtitle={
                  isKhmer
                    ? "ទីតាំងលំនាំដើមសម្រាប់សេវាកម្មអាកាសធាតុ"
                    : "Fallback anchor used across Weather Intelligence & Regional Map"
                }
                icon={<Compass className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                        {isKhmer ? "អត្តសញ្ញាណសកម្ម" : "Active Identity"}
                      </span>
                      <AdminStatusBadge tone="indigo">
                        {isKhmer ? "ផ្សាយបន្តផ្ទាល់" : "Live"}
                      </AdminStatusBadge>
                    </div>
                    <p className="mt-1.5 font-display text-lg font-extrabold text-[#141824] dark:text-[#eff2f6]">
                      {systemNameInput.trim() || "AgriSystem"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#525b75] dark:text-[#9fa6bc]">
                      {locName || d.general.serverLocationName}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e3e6ed] pt-3 dark:border-[#2b3245]">
                      <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#e3e6ed] dark:bg-[#181d2b] dark:ring-[#2b3245]">
                        <div className="text-[10px] font-bold uppercase text-[#6e7891] dark:text-[#8a94ad]">
                          LATITUDE
                        </div>
                        <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          {coordStatus.latValid ? coordStatus.latNum.toFixed(4) : locLat || "—"}°
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#e3e6ed] dark:bg-[#181d2b] dark:ring-[#2b3245]">
                        <div className="text-[10px] font-bold uppercase text-[#6e7891] dark:text-[#8a94ad]">
                          LONGITUDE
                        </div>
                        <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          {coordStatus.lonValid ? coordStatus.lonNum.toFixed(4) : locLon || "—"}°
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                    {isKhmer
                      ? "នៅពេលកសិករមិនអនុញ្ញាតឱ្យប្រើ GPS ឧបករណ៍ ប្រព័ន្ធព្យាករណ៍អាកាសធាតុ និងការគាំទ្រតាមតំបន់នឹងប្រើទីតាំងស្ថានីយ៍នេះជាគោល។"
                      : "Whenever a farmer device declines GPS permission or is behind an internal proxy, Weather Intelligence and agronomic support resolve local climate telemetry from these coordinates."}
                  </p>

                  {d.links?.worldUrl && (
                    <a
                      href={d.links.worldUrl}
                      className="flex items-center justify-between rounded-xl border border-[#e3e6ed] bg-white px-4 py-3 text-xs font-semibold text-[#141824] transition hover:border-[#3874ff]/40 hover:bg-[#e5edff]/35 dark:border-[#2b3245] dark:bg-[#141824] dark:text-[#eff2f6] dark:hover:border-[#3874ff]/40"
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-[#3874ff]" />
                        {isKhmer
                          ? "បើកផ្ទាំងគ្រប់គ្រងផែនទី និងអាកាសធាតុ"
                          : "Open World & Weather Telemetry"}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-[#6e7891]" />
                    </a>
                  )}
                </div>
              </AdminSectionCard>
            </div>
          </div>
        )}

        {/* TAB 2: TRAINED AI MODELS */}
        {tab === "trained" && (
          <div key="trained" className="ai-tab-panel space-y-6">
            {testBanner && (
              <AdminNoticeBanner
                tone={testBanner.ok ? "emerald" : "amber"}
                message={testBanner.message}
                onDismiss={() => setTestBanner(null)}
              />
            )}

            <AdminSectionCard
              title={
                isKhmer
                  ? "ម៉ាស៊ីន AI កសិកម្មផ្ទាល់ខ្លួន (Primary Endpoint)"
                  : "Self-Trained Agricultural AI Engine"
              }
              subtitle={
                isKhmer
                  ? "គ្រប់គ្រង Endpoint និងសោសម្ងាត់ Bearer សម្រាប់ម៉ូដែលផ្ទាល់ខ្លួន"
                  : "Primary inference endpoint & bearer credential management"
              }
              icon={<Bot className="h-4 w-4" />}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone="indigo">own-ai</AdminStatusBadge>
                  <button
                    type="button"
                    onClick={handleGenerateKey}
                    className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "បង្កើតសោ API Key" : "Generate API Key"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runConnectionTest("primary", hfUrl, generatedKey)}
                    disabled={testingTarget !== null}
                    className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                  >
                    {testingTarget === "primary" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3874ff]" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-[#3874ff]" />
                    )}
                    <span>{isKhmer ? "សាកល្បង Endpoint" : "Test Endpoint"}</span>
                  </button>
                </div>
              }
            >
              <form method="POST" action={d.formAction} className="space-y-5">
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="hf_model_id_input"
                      className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                    >
                      {isKhmer ? "លេខសម្គាល់ម៉ូដែល (Hugging Face / Model ID)" : "Hugging Face / Model ID"}
                    </label>
                    <input
                      id="hf_model_id_input"
                      type="text"
                      name="hf_model_id"
                      value={hfModelId}
                      onChange={(e) => setHfModelId(e.target.value)}
                      placeholder="Maoseavik/agri-qwen3b-lora"
                      className="ai-input text-xs"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="hf_inference_url_input"
                      className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                    >
                      {isKhmer ? "អាសយដ្ឋាន Endpoint (Inference URL)" : "Inference Endpoint URL"}
                    </label>
                    <input
                      id="hf_inference_url_input"
                      type="url"
                      name="hf_inference_url"
                      value={hfUrl}
                      onChange={(e) => setHfUrl(e.target.value)}
                      placeholder="https://your-space.hf.space"
                      className="ai-input font-mono text-xs"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="hf_api_key_input"
                        className="text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]"
                      >
                        {isKhmer ? "សោ Inference API Key / HF Token" : "Inference API Key / HF Token"}
                      </label>
                      <AdminStatusBadge tone={d.trainedAi.hfKeyConfigured ? "emerald" : "amber"}>
                        {d.trainedAi.hfKeyConfigured
                          ? isKhmer
                            ? "បានកំណត់សោរួច"
                            : "Configured"
                          : isKhmer
                            ? "មិនទាន់មានសោ"
                            : "Not Configured"}
                      </AdminStatusBadge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          id="hf_api_key_input"
                          type={showKey ? "text" : "password"}
                          name="hf_api_key"
                          value={generatedKey}
                          onChange={(e) => setGeneratedKey(e.target.value)}
                          placeholder={
                            isKhmer
                              ? "ទុកទទេដើម្បីរក្សាសោចាស់ដែលបានរក្សាទុក..."
                              : "Leave blank to keep existing key..."
                          }
                          className="ai-input pr-11 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((prev) => !prev)}
                          aria-label={showKey ? "Hide API key" : "Show API key"}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#6e7891] hover:bg-[#eff2f6] hover:text-[#141824] dark:text-[#8a94ad] dark:hover:bg-[#1e2436] dark:hover:text-[#eff2f6]"
                        >
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {generatedKey && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(generatedKey, setCopiedKey)}
                          className="ai-btn-secondary h-9 shrink-0 gap-1.5 px-3 text-xs"
                        >
                          {copiedKey ? (
                            <Check className="h-3.5 w-3.5 text-[#25b003]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {copiedKey
                              ? isKhmer
                                ? "បានចម្លង"
                                : "Copied"
                              : isKhmer
                                ? "ចម្លង"
                                : "Copy"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                  <p className="flex items-center gap-1.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#25b003]" />
                    <span>
                      {isKhmer
                        ? "ប្រព័ន្ធបដិសេធ LLM ពាណិជ្ជកម្មដោយស្វ័យប្រវត្តិ (ប្រើតែ Self-Trained AI ប៉ុណ្ណោះ)។"
                        : "Commercial LLM fallbacks remain permanently disabled to protect farm telemetry."}
                    </span>
                  </p>
                  <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-5 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "រក្សាទុក Endpoint សកម្ម" : "Save Active Endpoint"}</span>
                  </button>
                </div>
              </form>
            </AdminSectionCard>

            {/* Add / Edit Registered Profile Card */}
            <div ref={profileFormRef}>
              <AdminSectionCard
                delayIndex={1}
                title={
                  editingProfileId
                    ? isKhmer
                      ? "កែប្រែទម្រង់ម៉ូដែល AI"
                      : "Edit Trained Model Profile"
                    : isKhmer
                      ? "ចុះឈ្មោះទម្រង់ម៉ូដែល AI ថ្មី"
                      : "Add / Register Trained Model Profile"
                }
                subtitle={
                  isKhmer
                    ? "ប្តូរចុះឡើងរវាង Endpoint ដែលបានបណ្តុះបណ្តាលផ្សេងៗដោយមិនប៉ះពាល់មូលដ្ឋានទិន្នន័យ"
                    : "Hot-swap between regional fine-tuned model endpoints without restarts"
                }
                icon={editingProfileId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                action={
                  editingProfileId && (
                    <button
                      type="button"
                      onClick={resetProfileForm}
                      className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "បោះបង់ការកែប្រែ" : "Cancel Edit"}</span>
                    </button>
                  )
                }
              >
                <form method="POST" action={d.formAction} className="space-y-4">
                  <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                  <input
                    type="hidden"
                    name="model_action"
                    value={activateOnSave ? "activate" : "save"}
                  />
                  {editingProfileId && (
                    <input type="hidden" name="profile_id" value={editingProfileId} />
                  )}

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#525b75] dark:text-[#9fa6bc]">
                        {isKhmer ? "ឈ្មោះបង្ហាញ (Label)" : "Display Name"}
                      </label>
                      <input
                        type="text"
                        name="label"
                        value={profileLabel}
                        onChange={(e) => setProfileLabel(e.target.value)}
                        placeholder={isKhmer ? "ឧ. Khmer Agri Qwen3B v2" : "Khmer Agri Qwen3B v2"}
                        className="ai-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#525b75] dark:text-[#9fa6bc]">
                        {isKhmer ? "លេខសម្គាល់ម៉ូដែល (Model ID)" : "Model ID *"}
                      </label>
                      <input
                        type="text"
                        name="model_id"
                        required
                        value={profileModelId}
                        onChange={(e) => setProfileModelId(e.target.value)}
                        placeholder="Maoseavik/agri-qwen3b"
                        className="ai-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#525b75] dark:text-[#9fa6bc]">
                        {isKhmer ? "Endpoint URL *" : "Endpoint URL *"}
                      </label>
                      <input
                        type="url"
                        name="endpoint"
                        required
                        value={profileEndpoint}
                        onChange={(e) => setProfileEndpoint(e.target.value)}
                        placeholder="https://.../generate"
                        className="ai-input font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#525b75] dark:text-[#9fa6bc]">
                        {isKhmer ? "សោ API ផ្ទាល់ (ស្រេចចិត្ត)" : "Profile Token (optional)"}
                      </label>
                      <input
                        type="password"
                        name="model_api_key"
                        value={profileApiKey}
                        onChange={(e) => setProfileApiKey(e.target.value)}
                        placeholder={
                          editingProfileId
                            ? isKhmer
                              ? "ទុកទទេដើម្បីរក្សាសោចាស់"
                              : "Leave blank to keep token"
                            : isKhmer
                              ? "hf_... ឬ Bearer token"
                              : "hf_... or custom bearer"
                        }
                        className="ai-input font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#31374a] dark:text-[#cbd0dd]">
                      <input
                        type="checkbox"
                        checked={activateOnSave}
                        onChange={(e) => setActivateOnSave(e.target.checked)}
                        className="h-4 w-4 rounded border-[#cbd0dd] text-[#3874ff] focus:ring-[#3874ff]"
                      />
                      <span>
                        {isKhmer
                          ? "ដាក់ឱ្យដំណើរការម៉ូដែលនេះភ្លាមៗក្រោយរក្សាទុក"
                          : "Activate immediately after saving"}
                      </span>
                    </label>
                    <button type="submit" className="ai-btn-secondary h-9 gap-1.5 px-4 text-xs">
                      <Save className="h-3.5 w-3.5" />
                      <span>
                        {activateOnSave
                          ? isKhmer
                            ? "រក្សាទុក និងដាក់ឱ្យដំណើរការ"
                            : "Save & Activate Profile"
                          : isKhmer
                            ? "រក្សាទុកទម្រង់"
                            : "Save Profile"}
                      </span>
                    </button>
                  </div>
                </form>
              </AdminSectionCard>
            </div>

            {/* Registered Model Profiles List */}
            <AdminSectionCard
              delayIndex={2}
              noPadding
              title={isKhmer ? "ទម្រង់ម៉ូដែល AI ដែលបានចុះឈ្មោះ" : "Registered Model Profiles"}
              subtitle={`${d.trainedAi.hfModels.length} ${isKhmer ? "ទម្រង់ដែលមាននៅក្នុងប្រព័ន្ធ" : "configured profile(s)"}`}
              icon={<Cpu className="h-4 w-4" />}
            >
              {d.trainedAi.hfModels.length === 0 ? (
                <div className="p-5">
                  <AdminEmptyState
                    icon={<Cpu className="h-5 w-5" />}
                    title={isKhmer ? "មិនទាន់មានទម្រង់ម៉ូដែលបន្ថែមទេ" : "No Saved Model Profiles Yet"}
                    description={
                      isKhmer
                        ? "ប្រើទម្រង់ខាងលើដើម្បីចុះឈ្មោះ Endpoint ច្រើន និងផ្លាស់ប្តូរដោយចុចតែម្តង។"
                        : "Register regional or staged model endpoints above to switch production traffic in one click."
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                  {d.trainedAi.hfModels.map((m) => {
                    const isActive =
                      m.id === d.trainedAi.activeModelId || Boolean(m.active);
                    const isTestingThis = testingTarget === `profile:${m.id}`;
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "ai-table-row flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs",
                          isActive && "bg-[#e5edff]/35 dark:bg-[#3874ff]/10",
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                              {m.label || m.model_id || m.id}
                            </span>
                            {isActive ? (
                              <AdminStatusBadge tone="emerald" pulse>
                                {isKhmer ? "សកម្ម" : "Active"}
                              </AdminStatusBadge>
                            ) : (
                              <AdminStatusBadge tone="slate">
                                {isKhmer ? "រង់ចាំ" : "Standby"}
                              </AdminStatusBadge>
                            )}
                            <AdminStatusBadge tone={m.hasToken ? "indigo" : "slate"}>
                              {m.hasToken
                                ? isKhmer
                                  ? "សោផ្ទាល់"
                                  : "Profile Token"
                                : isKhmer
                                  ? "សោរួម"
                                  : "Shared Key"}
                            </AdminStatusBadge>
                          </div>
                          {m.model_id && (
                            <p className="font-mono text-[11px] font-semibold text-[#525b75] dark:text-[#9fa6bc]">
                              {m.model_id}
                            </p>
                          )}
                          <p className="truncate font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                            {m.endpoint}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => runConnectionTest(`profile:${m.id}`, m.endpoint || "")}
                            disabled={testingTarget !== null || !m.endpoint}
                            className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
                          >
                            {isTestingThis ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3874ff]" />
                            ) : (
                              <Activity className="h-3.5 w-3.5 text-[#3874ff]" />
                            )}
                            <span>{isKhmer ? "សាកល្បង" : "Test"}</span>
                          </button>

                          {!isActive && (
                            <form method="POST" action={d.formAction}>
                              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                              <input type="hidden" name="model_action" value="switch" />
                              <input type="hidden" name="profile_id" value={m.id} />
                              <button
                                type="submit"
                                className="ai-btn-primary h-8 gap-1 px-3 text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{isKhmer ? "ដាក់ឱ្យសកម្ម" : "Activate"}</span>
                              </button>
                            </form>
                          )}

                          <button
                            type="button"
                            onClick={() => startEditProfile(m)}
                            className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>{isKhmer ? "កែប្រែ" : "Edit"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPendingDeleteProfile(m)}
                            aria-label={`Delete profile ${m.label || m.model_id || m.id}`}
                            className="ai-btn-secondary h-8 px-2.5 text-xs text-[#b81800] hover:bg-[#ffe0db]/50 dark:text-[#ff8f7d] dark:hover:bg-[#fa3b1d]/15"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminSectionCard>
          </div>
        )}

        {/* TAB 3: DEPLOYMENT GUIDE */}
        {tab === "guide" && (
          <div key="guide" className="ai-tab-panel grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <AdminSectionCard
                title={
                  isKhmer
                    ? "ការណែនាំដាក់ឱ្យដំណើរការ Self-Trained AI"
                    : "Self-Hosted Trained AI Deployment"
                }
                subtitle={
                  isKhmer
                    ? "ជំហានត្រួតពិនិត្យមុនបើកចរាចរណ៍កសិករ"
                    : "Recommended checklist before routing live farmer traffic"
                }
                icon={<BookOpen className="h-4 w-4" />}
              >
                <div className="space-y-3 text-xs leading-relaxed text-[#525b75] dark:text-[#cbd0dd]">
                  {[
                    {
                      title: isKhmer
                        ? "១. បង្ហោះម៉ូដែល Qwen/Agri លើ HTTPS ឬ Hugging Face Space"
                        : "1. Serve your fine-tuned model over HTTPS or Hugging Face Space",
                      body: isKhmer
                        ? "ដាក់ម៉ូដែល Qwen/Agri របស់អ្នកនៅក្រោយ HTTPS (/generate ឬ Gradio .hf.space) ដោយបើកការផ្ទៀងផ្ទាត់ Bearer HF_API_KEY។"
                        : "Host your fine-tuned weights behind an HTTPS `/generate` or `.hf.space` Gradio endpoint protected by `HF_API_KEY` bearer authentication.",
                    },
                    {
                      title: isKhmer
                        ? "២. ចែករំលែកសោ Inference API Key រវាងប្រព័ន្ធទាំងពីរ"
                        : "2. Sync a high-entropy shared inference API key",
                      body: isKhmer
                        ? "បង្កើតសោ API Key នៅផ្ទាំង Trained AI Models រួចចម្លងដាក់ក្នុង Space Secret និងទម្រង់កំណត់នៅទីនេះ។"
                        : "Generate a shared inference API key in the Trained AI Models tab and store the exact same secret inside your Space environment variables.",
                    },
                    {
                      title: isKhmer
                        ? "៣. សាកល្បង Round-Trip Latency (អតិបរមា 180s Cold Start)"
                        : "3. Verify cold-start & latency with Test Endpoint",
                      body: isKhmer
                        ? "ចុច Test Endpoint ដើម្បីបញ្ជាក់ថា Endpoint ឆ្លើយតបត្រឹមត្រូវ។ ប្រព័ន្ធគាំទ្រ Timeout រហូតដល់ 180 វិនាទីសម្រាប់ CPU Cold-Start។"
                        : "Run Test Endpoint from Trained AI Models to confirm round-trip health. The backend supports up to 180s cold-start tolerance.",
                    },
                  ].map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-4 dark:border-[#2b3245] dark:bg-[#0f111a]"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#3874ff] font-display text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                          {step.title}
                        </p>
                        <p className="mt-1 text-xs text-[#525b75] dark:text-[#9fa6bc]">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Copyable Env Block */}
                <div className="mt-5 rounded-xl border border-[#e3e6ed] bg-[#141824] p-4 text-[#eff2f6] dark:border-[#2b3245] dark:bg-[#0f111a]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#85a9ff]">
                      {isKhmer ? "គំរូអថេរបរិស្ថាន (.env)" : "Space / Worker Env Snippet"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(envTemplate, setCopiedEnv)}
                      className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20"
                    >
                      {copiedEnv ? (
                        <Check className="h-3 w-3 text-[#7ee864]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedEnv ? (isKhmer ? "បានចម្លង" : "Copied") : isKhmer ? "ចម្លង" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[#cbd0dd]">
                    {envTemplate}
                  </pre>
                </div>
              </AdminSectionCard>
            </div>

            <div className="lg:col-span-5">
              <AdminSectionCard
                delayIndex={1}
                title={isKhmer ? "បញ្ជីត្រួតពិនិត្យភាពរួចរាល់" : "Live Readiness Checklist"}
                subtitle={
                  isKhmer ? "ស្ថានភាពកំណត់រចនាសម្ព័ន្ធបច្ចុប្បន្ន" : "Computed from saved SiteSetting records"
                }
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                <div className="space-y-3">
                  {readinessChecks.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[#e3e6ed] bg-white p-3.5 dark:border-[#2b3245] dark:bg-[#141824]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#141824] dark:text-[#eff2f6]">
                          {item.label}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                          {item.detail}
                        </p>
                      </div>
                      <AdminStatusBadge tone={item.ok ? "emerald" : "amber"}>
                        {item.ok
                          ? isKhmer
                            ? "រួចរាល់"
                            : "Ready"
                          : isKhmer
                            ? "ត្រូវពិនិត្យ"
                            : "Pending"}
                      </AdminStatusBadge>
                    </div>
                  ))}
                </div>
              </AdminSectionCard>
            </div>
          </div>
        )}
      </div>

      {/* Delete Profile Confirmation Modal */}
      {pendingDeleteProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-profile-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPendingDeleteProfile(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[#cbd0dd] bg-white p-6 shadow-2xl dark:border-[#373e53] dark:bg-[#141824]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe0db] text-[#b81800] dark:bg-[#fa3b1d]/20 dark:text-[#ff8f7d]">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    id="delete-profile-modal-title"
                    className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                  >
                    {isKhmer ? "លុបទម្រង់ម៉ូដែល AI" : "Remove Model Profile"}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer
                      ? "សកម្មភាពនេះនឹងលុបទម្រង់ និងសោ API ផ្ទាល់ខ្លួនរបស់វាចេញពីប្រព័ន្ធ។"
                      : "This removes the profile and clears its stored bearer token."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteProfile(null)}
                aria-label="Close confirmation dialog"
                className="rounded-lg p-1.5 text-[#6e7891] hover:bg-[#eff2f6] dark:text-[#8a94ad] dark:hover:bg-[#1e2436]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#e3e6ed] bg-[#f5f7fa] p-3.5 text-xs dark:border-[#2b3245] dark:bg-[#0f111a]">
              <p className="font-bold text-[#141824] dark:text-[#eff2f6]">
                {pendingDeleteProfile.label || pendingDeleteProfile.model_id}
              </p>
              <p className="mt-1 truncate font-mono text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                {pendingDeleteProfile.endpoint}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteProfile(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <form method="POST" action={d.formAction}>
                <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
                <input type="hidden" name="model_action" value="delete" />
                <input type="hidden" name="profile_id" value={pendingDeleteProfile.id} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#fa3b1d] px-4 text-xs font-semibold text-white transition hover:bg-[#d92d12]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "បញ្ជាក់ការលុប" : "Delete Profile"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
