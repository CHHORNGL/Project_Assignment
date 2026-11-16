import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Bug,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  Languages,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Sprout,
  Upload,
  X,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface CropTranslationRow {
  id: number;
  name: string;
  nameKh: string;
  description: string;
  descriptionKh: string;
}

interface DiseaseTranslationRow {
  id: number;
  name: string;
  nameKh: string;
  description: string;
  descriptionKh: string;
  treatment: string;
  treatmentKh: string;
}

interface SymptomTranslationRow {
  id: number;
  name: string;
  nameKh: string;
  description: string;
  descriptionKh: string;
}

interface CoverageBucket {
  total: number;
  translated: number;
}

interface TranslationsData {
  currentSection: string;
  q: string;
  missingOnly: boolean;
  formAction: string;
  aiTranslateUrl?: string;
  backupsUrl: string;
  coverageStats?: {
    crops: CoverageBucket;
    diseases: CoverageBucket;
    symptoms: CoverageBucket;
  };
  crops: CropTranslationRow[];
  diseases: DiseaseTranslationRow[];
  symptoms: SymptomTranslationRow[];
}

type SectionKey = "crops" | "diseases" | "symptoms";

const PAGE_SIZE = 25;

export default function AdminTranslationsPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<TranslationsData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const activeTab: SectionKey =
    d.currentSection === "diseases" || d.currentSection === "symptoms"
      ? d.currentSection
      : "crops";

  const [localFilter, setLocalFilter] = useState(d.q || "");
  const [page, setPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<"import" | "import_all">("import");
  const [importSection, setImportSection] = useState<SectionKey>(activeTab);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [pendingTabUrl, setPendingTabUrl] = useState<string | null>(null);

  const [cropDrafts, setCropDrafts] = useState<Record<number, { nameKh: string; descriptionKh: string }>>(() =>
    Object.fromEntries(
      d.crops.map((c) => [c.id, { nameKh: c.nameKh || "", descriptionKh: c.descriptionKh || "" }]),
    ),
  );
  const [diseaseDrafts, setDiseaseDrafts] = useState<
    Record<number, { nameKh: string; descriptionKh: string; treatmentKh: string }>
  >(() =>
    Object.fromEntries(
      d.diseases.map((item) => [
        item.id,
        {
          nameKh: item.nameKh || "",
          descriptionKh: item.descriptionKh || "",
          treatmentKh: item.treatmentKh || "",
        },
      ]),
    ),
  );
  const [symptomDrafts, setSymptomDrafts] = useState<
    Record<number, { nameKh: string; descriptionKh: string }>
  >(() =>
    Object.fromEntries(
      d.symptoms.map((s) => [s.id, { nameKh: s.nameKh || "", descriptionKh: s.descriptionKh || "" }]),
    ),
  );

  useEffect(() => {
    setPage(1);
  }, [activeTab, localFilter]);

  useEffect(() => {
    if (!showImportModal && !pendingTabUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowImportModal(false);
        setPendingTabUrl(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showImportModal, pendingTabUrl]);

  const dirtyCropIds = useMemo(
    () =>
      d.crops
        .filter((c) => {
          const draft = cropDrafts[c.id];
          return (
            draft &&
            (draft.nameKh !== (c.nameKh || "") || draft.descriptionKh !== (c.descriptionKh || ""))
          );
        })
        .map((c) => c.id),
    [d.crops, cropDrafts],
  );

  const dirtyDiseaseIds = useMemo(
    () =>
      d.diseases
        .filter((item) => {
          const draft = diseaseDrafts[item.id];
          return (
            draft &&
            (draft.nameKh !== (item.nameKh || "") ||
              draft.descriptionKh !== (item.descriptionKh || "") ||
              draft.treatmentKh !== (item.treatmentKh || ""))
          );
        })
        .map((item) => item.id),
    [d.diseases, diseaseDrafts],
  );

  const dirtySymptomIds = useMemo(
    () =>
      d.symptoms
        .filter((s) => {
          const draft = symptomDrafts[s.id];
          return (
            draft &&
            (draft.nameKh !== (s.nameKh || "") || draft.descriptionKh !== (s.descriptionKh || ""))
          );
        })
        .map((s) => s.id),
    [d.symptoms, symptomDrafts],
  );

  const activeDirtyCount =
    activeTab === "crops"
      ? dirtyCropIds.length
      : activeTab === "diseases"
        ? dirtyDiseaseIds.length
        : dirtySymptomIds.length;

  const filteredCrops = useMemo(() => {
    const q = localFilter.trim().toLowerCase();
    if (!q) return d.crops;
    return d.crops.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameKh.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [d.crops, localFilter]);

  const filteredDiseases = useMemo(() => {
    const q = localFilter.trim().toLowerCase();
    if (!q) return d.diseases;
    return d.diseases.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.nameKh.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.treatment.toLowerCase().includes(q),
    );
  }, [d.diseases, localFilter]);

  const filteredSymptoms = useMemo(() => {
    const q = localFilter.trim().toLowerCase();
    if (!q) return d.symptoms;
    return d.symptoms.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nameKh.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [d.symptoms, localFilter]);

  const totalVisibleItems =
    activeTab === "crops"
      ? filteredCrops.length
      : activeTab === "diseases"
        ? filteredDiseases.length
        : filteredSymptoms.length;

  const totalPages = Math.max(1, Math.ceil(totalVisibleItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(totalVisibleItems, startIdx + PAGE_SIZE);

  const pageCrops = filteredCrops.slice(startIdx, endIdx);
  const pageDiseases = filteredDiseases.slice(startIdx, endIdx);
  const pageSymptoms = filteredSymptoms.slice(startIdx, endIdx);

  const stats = d.coverageStats ?? {
    crops: { total: d.crops.length, translated: d.crops.filter((c) => c.nameKh).length },
    diseases: { total: d.diseases.length, translated: d.diseases.filter((x) => x.nameKh).length },
    symptoms: { total: d.symptoms.length, translated: d.symptoms.filter((s) => s.nameKh).length },
  };

  const pct = (b: CoverageBucket) => (b.total > 0 ? Math.round((b.translated / b.total) * 100) : 0);

  const aiTranslateUrl = d.aiTranslateUrl || "/admin/translations/ai";

  const requestAiTranslation = async (
    key: string,
    sourceText: string,
    onTranslated: (khmer: string) => void,
  ) => {
    const clean = sourceText.trim();
    if (!clean) {
      pushToast("warning", isKhmer ? "គ្មានអត្ថបទអង់គ្លេសដើម្បីបកប្រែទេ។" : "No English source text to translate.");
      return;
    }
    setTranslatingKey(key);
    try {
      const resp = await fetch(aiTranslateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": bootstrap.csrfToken,
        },
        body: JSON.stringify({ text: clean.slice(0, 800) }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.translation) {
        pushToast(
          "error",
          json?.error || (isKhmer ? "សេវាបកប្រែ AI មិនអាចដំណើរការបានទេ។" : "AI translation unavailable right now."),
        );
        return;
      }
      onTranslated(String(json.translation));
    } catch {
      pushToast("error", isKhmer ? "បណ្តាញមានបញ្ហាក្នុងការបកប្រែ។" : "Network error while requesting AI translation.");
    } finally {
      setTranslatingKey((prev) => (prev === key ? null : prev));
    }
  };

  const resetActiveDrafts = () => {
    if (activeTab === "crops") {
      setCropDrafts(
        Object.fromEntries(
          d.crops.map((c) => [c.id, { nameKh: c.nameKh || "", descriptionKh: c.descriptionKh || "" }]),
        ),
      );
    } else if (activeTab === "diseases") {
      setDiseaseDrafts(
        Object.fromEntries(
          d.diseases.map((item) => [
            item.id,
            {
              nameKh: item.nameKh || "",
              descriptionKh: item.descriptionKh || "",
              treatmentKh: item.treatmentKh || "",
            },
          ]),
        ),
      );
    } else {
      setSymptomDrafts(
        Object.fromEntries(
          d.symptoms.map((s) => [s.id, { nameKh: s.nameKh || "", descriptionKh: s.descriptionKh || "" }]),
        ),
      );
    }
  };

  const sectionTabs: Array<{ key: SectionKey; label: string; count: number }> = [
    { key: "crops", label: isKhmer ? "ដំណាំ" : "Crops", count: d.crops.length },
    { key: "diseases", label: isKhmer ? "ជំងឺ" : "Diseases", count: d.diseases.length },
    { key: "symptoms", label: isKhmer ? "រោគសញ្ញា" : "Symptoms", count: d.symptoms.length },
  ];

  const handleSectionTabClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, sec: SectionKey) => {
    if (sec === activeTab) {
      e.preventDefault();
      return;
    }
    if (activeDirtyCount > 0) {
      e.preventDefault();
      setPendingTabUrl(href);
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <form method="POST" action={d.formAction} className="inline">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
            <input type="hidden" name="action" value="export" />
            <input type="hidden" name="section" value={activeTab} />
            <input type="hidden" name="q" value={d.q} />
            <input type="hidden" name="missing" value={d.missingOnly ? "1" : "0"} />
            <button type="submit" className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <Download className="h-3.5 w-3.5" />
              <span>{isKhmer ? `នាំចេញ CSV (${activeTab})` : `Export ${activeTab} CSV`}</span>
            </button>
          </form>

          <form method="POST" action={d.formAction} className="inline">
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
            <input type="hidden" name="action" value="export_all" />
            <button type="submit" className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
              <FileArchive className="h-3.5 w-3.5" />
              <span>{isKhmer ? "ទាញយក ZIP ទាំងអស់" : "Export All ZIP"}</span>
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setImportSection(activeTab);
              setShowImportModal(true);
            }}
            className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{isKhmer ? "នាំចូល CSV/ZIP" : "Import"}</span>
          </button>

          <a href={d.backupsUrl} className="ai-btn-primary h-9 gap-1.5 px-3.5 text-xs">
            <Archive className="h-3.5 w-3.5" />
            <span>{isKhmer ? "ការបម្រុងទុក" : "Backups"}</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Localization Coverage KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            delayIndex={0}
            label={isKhmer ? "ការបកប្រែដំណាំ" : "Crops Localized"}
            value={`${stats.crops.translated} / ${stats.crops.total}`}
            hint={`${pct(stats.crops)}% ${isKhmer ? "បានបកប្រែឈ្មោះ" : "Khmer names ready"}`}
            progress={pct(stats.crops)}
            tone="emerald"
            icon={<Sprout className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={1}
            label={isKhmer ? "ការបកប្រែជំងឺ" : "Diseases Localized"}
            value={`${stats.diseases.translated} / ${stats.diseases.total}`}
            hint={`${pct(stats.diseases)}% ${isKhmer ? "បានបកប្រែឈ្មោះ" : "Khmer names ready"}`}
            progress={pct(stats.diseases)}
            tone="indigo"
            icon={<Bug className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={2}
            label={isKhmer ? "ការបកប្រែរោគសញ្ញា" : "Symptoms Localized"}
            value={`${stats.symptoms.translated} / ${stats.symptoms.total}`}
            hint={`${pct(stats.symptoms)}% ${isKhmer ? "បានបកប្រែឈ្មោះ" : "Khmer names ready"}`}
            progress={pct(stats.symptoms)}
            tone="sky"
            icon={<Activity className="h-5 w-5" />}
          />
          <AdminKpiCard
            delayIndex={3}
            label={isKhmer ? "កំពុងកែសម្រួល" : "Active Workspace"}
            value={totalVisibleItems.toLocaleString()}
            hint={
              activeDirtyCount > 0
                ? isKhmer
                  ? `${activeDirtyCount} កំណត់ត្រាបានកែប្រែមិនទាន់រក្សាទុក`
                  : `${activeDirtyCount} unsaved edit(s) pending`
                : isKhmer
                  ? `ផ្នែក ${activeTab}`
                  : `Viewing ${activeTab} catalog`
            }
            tone={activeDirtyCount > 0 ? "amber" : "slate"}
            icon={<Languages className="h-5 w-5" />}
          />
        </div>

        {/* Main Translations Studio Card */}
        <AdminSectionCard
          delayIndex={2}
          noPadding
          title={
            isKhmer
              ? `ស្ទូឌីយោបកប្រែភាសាខ្មែរ — ${activeTab}`
              : `Khmer Localization Studio — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`
          }
          subtitle={
            isKhmer
              ? "ប្រើប្រាស់ប៊ូតុង AI បកប្រែរហ័ស ឬកែសម្រួលដោយផ្ទាល់រួចរក្សាទុក"
              : "Translate alongside English source context or auto-fill with AI Translation"
          }
          icon={<Languages className="h-4 w-4" />}
          action={
            activeDirtyCount > 0 ? (
              <AdminStatusBadge tone="amber" pulse>
                {activeDirtyCount} {isKhmer ? "កំពុងកែប្រែ" : "unsaved"}
              </AdminStatusBadge>
            ) : undefined
          }
        >
          {/* Section Switcher & Search Filter Toolbar */}
          <div className="space-y-3 border-b border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Server Section Tabs */}
              <div className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-[#cbd0dd] bg-white p-1 dark:border-[#373e53] dark:bg-[#141824]">
                {sectionTabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const href = `${d.formAction}?section=${tab.key}&q=${encodeURIComponent(d.q)}&missing=${d.missingOnly ? "1" : "0"}`;
                  return (
                    <a
                      key={tab.key}
                      href={href}
                      onClick={(e) => handleSectionTabClick(e, href, tab.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors",
                        isActive
                          ? "bg-[#e5edff] text-[#004dff] dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                          : "text-[#525b75] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-[#eff2f6]",
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className="font-mono text-[10px] opacity-80">{tab.count}</span>
                    </a>
                  );
                })}
              </div>

              {/* Dual Live + Archive Search Form */}
              <form method="GET" action={d.formAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="section" value={activeTab} />
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94ad]" />
                  <input
                    type="text"
                    name="q"
                    value={localFilter}
                    onChange={(e) => {
                      setLocalFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder={
                      isKhmer ? "ស្វែងរកពាក្យ EN ឬ KM..." : "Filter loaded rows or press Enter..."
                    }
                    className="ai-input h-9 py-1 pl-9 pr-8 text-xs"
                  />
                  {localFilter && !d.q && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalFilter("");
                        setPage(1);
                      }}
                      aria-label={isKhmer ? "សម្អាត" : "Clear filter"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {d.q && (
                    <a
                      href={`${d.formAction}?section=${activeTab}`}
                      title={isKhmer ? "សម្អាត" : "Clear filter"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a94ad] hover:text-[#141824] dark:hover:text-[#eff2f6]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#cbd0dd] bg-white px-3 text-xs font-medium text-[#31374a] dark:border-[#373e53] dark:bg-[#141824] dark:text-[#cbd0dd]">
                  <input
                    type="checkbox"
                    name="missing"
                    value="1"
                    defaultChecked={d.missingOnly}
                    className="rounded accent-[#3874ff]"
                  />
                  <span>{isKhmer ? "តែខ្វះភាសាខ្មែរ" : "Missing Khmer only"}</span>
                </label>

                <button type="submit" className="ai-btn-primary h-9 px-3.5 text-xs">
                  {isKhmer ? "ត្រងទិន្នន័យ" : "Apply Filter"}
                </button>
              </form>
            </div>
          </div>

          {/* Controlled Translation Editor Form */}
          <form method="POST" action={d.formAction}>
            <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
            <input type="hidden" name="action" value="save" />
            <input type="hidden" name="section" value={activeTab} />
            <input type="hidden" name="q" value={d.q} />
            <input type="hidden" name="missing" value={d.missingOnly ? "1" : "0"} />

            {/* Hidden inputs for ALL dirty records across pages */}
            {activeTab === "crops" &&
              dirtyCropIds.map((id) => {
                const draft = cropDrafts[id];
                if (!draft) return null;
                return (
                  <React.Fragment key={`dirty-crop-${id}`}>
                    <input type="hidden" name={`crop_name_kh_${id}`} value={draft.nameKh} />
                    <input type="hidden" name={`crop_desc_kh_${id}`} value={draft.descriptionKh} />
                  </React.Fragment>
                );
              })}

            {activeTab === "diseases" &&
              dirtyDiseaseIds.map((id) => {
                const draft = diseaseDrafts[id];
                if (!draft) return null;
                return (
                  <React.Fragment key={`dirty-dis-${id}`}>
                    <input type="hidden" name={`disease_name_kh_${id}`} value={draft.nameKh} />
                    <input type="hidden" name={`disease_desc_kh_${id}`} value={draft.descriptionKh} />
                    <input type="hidden" name={`disease_treatment_kh_${id}`} value={draft.treatmentKh} />
                  </React.Fragment>
                );
              })}

            {activeTab === "symptoms" &&
              dirtySymptomIds.map((id) => {
                const draft = symptomDrafts[id];
                if (!draft) return null;
                return (
                  <React.Fragment key={`dirty-sym-${id}`}>
                    <input type="hidden" name={`symptom_name_kh_${id}`} value={draft.nameKh} />
                    <input type="hidden" name={`symptom_desc_kh_${id}`} value={draft.descriptionKh} />
                  </React.Fragment>
                );
              })}

            {totalVisibleItems === 0 ? (
              <div className="p-6">
                <AdminEmptyState
                  icon={<Languages className="h-5 w-5" />}
                  title={
                    isKhmer
                      ? "មិនមានកំណត់ត្រាត្រូវនឹងការត្រងទេ"
                      : "No translation entries match this filter"
                  }
                  description={
                    d.missingOnly
                      ? isKhmer
                        ? "កំណត់ត្រាទាំងអស់ក្នុងផ្នែកនេះត្រូវបានបកប្រែរួចរាល់!"
                        : "Great work — all items matching this view already have Khmer translations."
                      : isKhmer
                        ? "សាកល្បងសម្អាតពាក្យស្វែងរកដើម្បីមើលបញ្ជីទាំងអស់។"
                        : "Try clearing your search query or switching to another section."
                  }
                  action={
                    d.q || d.missingOnly ? (
                      <a href={`${d.formAction}?section=${activeTab}`} className="ai-btn-secondary h-8 px-3 text-xs">
                        {isKhmer ? "បង្ហាញទាំងអស់" : "Show All Entries"}
                      </a>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-[#e3e6ed] dark:divide-[#2b3245]">
                {activeTab === "crops" &&
                  pageCrops.map((crop) => {
                    const draft = cropDrafts[crop.id] || { nameKh: "", descriptionKh: "" };
                    const isDirty = dirtyCropIds.includes(crop.id);
                    const isComplete = Boolean(
                      draft.nameKh.trim() && (!crop.description.trim() || draft.descriptionKh.trim()),
                    );

                    return (
                      <div
                        key={crop.id}
                        className={cn(
                          "grid gap-4 p-4 transition-colors sm:p-5 lg:grid-cols-12",
                          isDirty && "bg-[#e5edff]/20 dark:bg-[#3874ff]/[0.05]",
                        )}
                      >
                        {/* English Source Reference */}
                        <div className="min-w-0 space-y-2 lg:col-span-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-[#8a94ad]">#{crop.id}</span>
                            <h4 className="text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                              {crop.name}
                            </h4>
                            <AdminStatusBadge tone={isDirty ? "indigo" : isComplete ? "emerald" : "amber"}>
                              {isDirty ? (isKhmer ? "បានកែប្រែ" : "Edited") : isComplete ? "Complete" : "Missing"}
                            </AdminStatusBadge>
                          </div>
                          <p className="text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                            {crop.description || (isKhmer ? "គ្មានការពិពណ៌នាអង់គ្លេស" : "No English description")}
                          </p>
                        </div>

                        {/* Khmer Target Inputs */}
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-8">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                                {isKhmer ? "ឈ្មោះដំណាំ (ខ្មែរ)" : "Khmer Name"}
                              </label>
                              <button
                                type="button"
                                disabled={translatingKey === `crop-name-${crop.id}`}
                                onClick={() =>
                                  requestAiTranslation(`crop-name-${crop.id}`, crop.name, (val) =>
                                    setCropDrafts((prev) => ({
                                      ...prev,
                                      [crop.id]: { ...draft, nameKh: val },
                                    })),
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#3874ff] transition hover:bg-[#e5edff] disabled:opacity-50 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/20"
                              >
                                {translatingKey === `crop-name-${crop.id}` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                <span>{isKhmer ? "បកប្រែ AI" : "AI Fill"}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={draft.nameKh}
                              onChange={(e) =>
                                setCropDrafts((prev) => ({
                                  ...prev,
                                  [crop.id]: { ...draft, nameKh: e.target.value },
                                }))
                              }
                              placeholder="ឈ្មោះជាភាសាខ្មែរ..."
                              className="ai-input text-xs"
                            />
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                                {isKhmer ? "ការពិពណ៌នា (ខ្មែរ)" : "Khmer Description"}
                              </label>
                              {crop.description.trim() && (
                                <button
                                  type="button"
                                  disabled={translatingKey === `crop-desc-${crop.id}`}
                                  onClick={() =>
                                    requestAiTranslation(`crop-desc-${crop.id}`, crop.description, (val) =>
                                      setCropDrafts((prev) => ({
                                        ...prev,
                                        [crop.id]: { ...draft, descriptionKh: val },
                                      })),
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#3874ff] transition hover:bg-[#e5edff] disabled:opacity-50 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/20"
                                >
                                  {translatingKey === `crop-desc-${crop.id}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>{isKhmer ? "បកប្រែ AI" : "AI Fill"}</span>
                                </button>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              value={draft.descriptionKh}
                              onChange={(e) =>
                                setCropDrafts((prev) => ({
                                  ...prev,
                                  [crop.id]: { ...draft, descriptionKh: e.target.value },
                                }))
                              }
                              placeholder="ការពិពណ៌នាជាភាសាខ្មែរ..."
                              className="ai-input text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {activeTab === "diseases" &&
                  pageDiseases.map((dis) => {
                    const draft = diseaseDrafts[dis.id] || {
                      nameKh: "",
                      descriptionKh: "",
                      treatmentKh: "",
                    };
                    const isDirty = dirtyDiseaseIds.includes(dis.id);
                    const isComplete = Boolean(
                      draft.nameKh.trim() &&
                        (!dis.description.trim() || draft.descriptionKh.trim()) &&
                        (!dis.treatment.trim() || draft.treatmentKh.trim()),
                    );

                    return (
                      <div
                        key={dis.id}
                        className={cn(
                          "grid gap-4 p-4 transition-colors sm:p-5 lg:grid-cols-12",
                          isDirty && "bg-[#e5edff]/20 dark:bg-[#3874ff]/[0.05]",
                        )}
                      >
                        <div className="min-w-0 space-y-2 lg:col-span-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-[#8a94ad]">#{dis.id}</span>
                            <h4 className="text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                              {dis.name}
                            </h4>
                            <AdminStatusBadge tone={isDirty ? "indigo" : isComplete ? "emerald" : "amber"}>
                              {isDirty ? (isKhmer ? "បានកែប្រែ" : "Edited") : isComplete ? "Complete" : "Missing"}
                            </AdminStatusBadge>
                          </div>
                          {dis.description && (
                            <p className="line-clamp-2 text-xs text-[#525b75] dark:text-[#9fa6bc]">
                              <strong className="text-[#31374a] dark:text-[#cbd0dd]">Overview:</strong>{" "}
                              {dis.description}
                            </p>
                          )}
                          {dis.treatment && (
                            <p className="line-clamp-2 text-xs text-[#525b75] dark:text-[#9fa6bc]">
                              <strong className="text-[#31374a] dark:text-[#cbd0dd]">Treatment:</strong>{" "}
                              {dis.treatment}
                            </p>
                          )}
                        </div>

                        <div className="grid min-w-0 gap-3 md:grid-cols-3 lg:col-span-8">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                                {isKhmer ? "ឈ្មោះជំងឺ (ខ្មែរ)" : "Khmer Name"}
                              </label>
                              <button
                                type="button"
                                disabled={translatingKey === `dis-name-${dis.id}`}
                                onClick={() =>
                                  requestAiTranslation(`dis-name-${dis.id}`, dis.name, (val) =>
                                    setDiseaseDrafts((prev) => ({
                                      ...prev,
                                      [dis.id]: { ...draft, nameKh: val },
                                    })),
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#3874ff] transition hover:bg-[#e5edff] disabled:opacity-50 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/20"
                              >
                                {translatingKey === `dis-name-${dis.id}` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                <span>{isKhmer ? "AI" : "AI Fill"}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={draft.nameKh}
                              onChange={(e) =>
                                setDiseaseDrafts((prev) => ({
                                  ...prev,
                                  [dis.id]: { ...draft, nameKh: e.target.value },
                                }))
                              }
                              placeholder="ឈ្មោះជំងឺ..."
                              className="ai-input text-xs"
                            />
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                                {isKhmer ? "ការពិពណ៌នា (ខ្មែរ)" : "Khmer Overview"}
                              </label>
                              {dis.description.trim() && (
                                <button
                                  type="button"
                                  disabled={translatingKey === `dis-desc-${dis.id}`}
                                  onClick={() =>
                                    requestAiTranslation(`dis-desc-${dis.id}`, dis.description, (val) =>
                                      setDiseaseDrafts((prev) => ({
                                        ...prev,
                                        [dis.id]: { ...draft, descriptionKh: val },
                                      })),
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#3874ff] transition hover:bg-[#e5edff] disabled:opacity-50 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/20"
                                >
                                  {translatingKey === `dis-desc-${dis.id}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>{isKhmer ? "AI" : "AI Fill"}</span>
                                </button>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              value={draft.descriptionKh}
                              onChange={(e) =>
                                setDiseaseDrafts((prev) => ({
                                  ...prev,
                                  [dis.id]: { ...draft, descriptionKh: e.target.value },
                                }))
                              }
                              placeholder="ការពិពណ៌នាជំងឺ..."
                              className="ai-input text-xs"
                            />
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                                {isKhmer ? "វិធីព្យាបាល (ខ្មែរ)" : "Khmer Treatment"}
                              </label>
                              {dis.treatment.trim() && (
                                <button
                                  type="button"
                                  disabled={translatingKey === `dis-treat-${dis.id}`}
                                  onClick={() =>
                                    requestAiTranslation(`dis-treat-${dis.id}`, dis.treatment, (val) =>
                                      setDiseaseDrafts((prev) => ({
                                        ...prev,
                                        [dis.id]: { ...draft, treatmentKh: val },
                                      })),
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#3874ff] transition hover:bg-[#e5edff] disabled:opacity-50 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/20"
                                >
                                  {translatingKey === `dis-treat-${dis.id}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>{isKhmer ? "AI" : "AI Fill"}</span>
                                </button>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              value={draft.treatmentKh}
                              onChange={(e) =>
                                setDiseaseDrafts((prev) => ({
                                  ...prev,
                                  [dis.id]: { ...draft, treatmentKh: e.target.value },
                                }))
                              }
                              placeholder="វិធីព្យាបាល..."
                              className="ai-input text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {activeTab === "symptoms" &&
                  pageSymptoms.map((sym) => {
                    const draft = symptomDrafts[sym.id] || { nameKh: "", descriptionKh: "" };
                    const isDirty = dirtySymptomIds.includes(sym.id);
                    const isComplete = Boolean(
                      draft.nameKh.trim() && (!sym.description.trim() || draft.descriptionKh.trim()),
                    );

                    return (
                      <div
                        key={sym.id}
                        className={cn(
                          "grid gap-4 p-4 transition-colors sm:p-5 lg:grid-cols-12",
                          isDirty && "bg-[#e5edff]/20 dark:bg-[#3874ff]/[0.05]",
                        )}
                      >
                        <div className="min-w-0 space-y-1.5 lg:col-span-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-[#8a94ad]">#{sym.id}</span>
                            <h4 className="text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                              {sym.name}
                            </h4>
                            <AdminStatusBadge tone={isDirty ? "indigo" : isComplete ? "emerald" : "amber"}>
                              {isDirty ? (isKhmer ? "បានកែប្រែ" : "Edited") : isComplete ? "Complete" : "Missing"}
                            </AdminStatusBadge>
                          </div>
                          <p className="text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                            {sym.description || (isKhmer ? "គ្មានការពិពណ៌នាអង់គ្លេស" : "No English description")}
                          </p>
                        </div>

                        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-8">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                                {isKhmer ? "ឈ្មោះរោគសញ្ញា (ខ្មែរ)" : "Khmer Name"}
                              </label>
                              <button
                                type="button"
                                disabled={translatingKey === `sym-name-${sym.id}`}
                                onClick={() =>
                                  requestAiTranslation(`sym-name-${sym.id}`, sym.name, (val) =>
                                    setSymptomDrafts((prev) => ({
                                      ...prev,
                                      [sym.id]: { ...draft, nameKh: val },
                                    })),
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#3874ff] transition hover:bg-[#e5edff] disabled:opacity-50 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/20"
                              >
                                {translatingKey === `sym-name-${sym.id}` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                <span>{isKhmer ? "បកប្រែ AI" : "AI Fill"}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={draft.nameKh}
                              onChange={(e) =>
                                setSymptomDrafts((prev) => ({
                                  ...prev,
                                  [sym.id]: { ...draft, nameKh: e.target.value },
                                }))
                              }
                              placeholder="ឈ្មោះរោគសញ្ញា..."
                              className="ai-input text-xs"
                            />
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                                {isKhmer ? "ការពិពណ៌នា (ខ្មែរ)" : "Khmer Description"}
                              </label>
                              {sym.description.trim() && (
                                <button
                                  type="button"
                                  disabled={translatingKey === `sym-desc-${sym.id}`}
                                  onClick={() =>
                                    requestAiTranslation(`sym-desc-${sym.id}`, sym.description, (val) =>
                                      setSymptomDrafts((prev) => ({
                                        ...prev,
                                        [sym.id]: { ...draft, descriptionKh: val },
                                      })),
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#3874ff] transition hover:bg-[#e5edff] disabled:opacity-50 dark:text-[#85a9ff] dark:hover:bg-[#3874ff]/20"
                                >
                                  {translatingKey === `sym-desc-${sym.id}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>{isKhmer ? "បកប្រែ AI" : "AI Fill"}</span>
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={draft.descriptionKh}
                              onChange={(e) =>
                                setSymptomDrafts((prev) => ({
                                  ...prev,
                                  [sym.id]: { ...draft, descriptionKh: e.target.value },
                                }))
                              }
                              placeholder="ការពិពណ៌នារោគសញ្ញា..."
                              className="ai-input text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Pagination & Save Bar Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] bg-[#f5f7fa]/75 px-5 py-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
              <div className="flex items-center gap-3 text-xs text-[#6e7891] dark:text-[#8a94ad]">
                {totalVisibleItems > 0 && (
                  <span>
                    {isKhmer
                      ? `បង្ហាញ ${startIdx + 1}–${endIdx} នៃ ${totalVisibleItems}`
                      : `Showing ${startIdx + 1}–${endIdx} of ${totalVisibleItems}`}
                  </span>
                )}
                {totalPages > 1 && (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous page"
                      className="ai-btn-secondary h-7 w-7 justify-center px-0 text-xs disabled:opacity-45"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-2 font-mono text-[11px] font-semibold text-[#141824] dark:text-[#eff2f6]">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Next page"
                      className="ai-btn-secondary h-7 w-7 justify-center px-0 text-xs disabled:opacity-45"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeDirtyCount > 0 && (
                  <button
                    type="button"
                    onClick={resetActiveDrafts}
                    className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{isKhmer ? "បោះបង់ការកែប្រែ" : "Discard Edits"}</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={activeDirtyCount === 0}
                  className="ai-btn-primary h-9 gap-1.5 px-6 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {isKhmer
                      ? `រក្សាទុក (${activeDirtyCount})`
                      : `Save Translations (${activeDirtyCount})`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </AdminSectionCard>
      </div>

      {/* Bulk CSV / ZIP Import Modal */}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-translations-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setShowImportModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-2xl dark:border-[#2b3245] dark:bg-[#141824] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="import-translations-title"
                  className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
                >
                  {isKhmer ? "នាំចូលការបកប្រែ (CSV / ZIP)" : "Import Khmer Translations"}
                </h3>
                <p className="mt-1 text-xs text-[#525b75] dark:text-[#9fa6bc]">
                  {isKhmer
                    ? "ប្រព័ន្ធនឹងបង្កើតច្បាប់បម្រុងទុកដោយស្វ័យប្រវត្តិមុនពេលអនុវត្តការនាំចូល។"
                    : "A rollback snapshot is automatically saved to Backups before applying imported edits."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-lg p-1 text-[#6e7891] hover:bg-[#f5f7fa] dark:hover:bg-[#1e2436]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              method="POST"
              action={d.formAction}
              encType="multipart/form-data"
              className="mt-4 space-y-4 text-xs"
            >
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />
              <input type="hidden" name="action" value={importMode} />

              <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#cbd0dd] bg-[#f5f7fa] p-1 dark:border-[#373e53] dark:bg-[#0f111a]">
                <button
                  type="button"
                  onClick={() => setImportMode("import")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-semibold transition",
                    importMode === "import"
                      ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                      : "text-[#525b75] dark:text-[#9fa6bc]",
                  )}
                >
                  {isKhmer ? "ឯកសារ CSV តាមផ្នែក" : "Section CSV"}
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("import_all")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-semibold transition",
                    importMode === "import_all"
                      ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                      : "text-[#525b75] dark:text-[#9fa6bc]",
                  )}
                >
                  {isKhmer ? "កញ្ចប់ ZIP ទាំងអស់" : "Full ZIP Archive"}
                </button>
              </div>

              {importMode === "import" && (
                <div>
                  <label className="mb-1.5 block font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ផ្នែកគោលដៅ" : "Target Section"}
                  </label>
                  <select
                    name="section"
                    value={importSection}
                    onChange={(e) => setImportSection(e.target.value as SectionKey)}
                    className="ai-input text-xs"
                  >
                    <option value="crops">Crops (id, name_kh, description_kh)</option>
                    <option value="diseases">Diseases (id, name_kh, description_kh, treatment_kh)</option>
                    <option value="symptoms">Symptoms (id, name_kh, description_kh)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                  {importMode === "import"
                    ? isKhmer
                      ? "ជ្រើសរើសឯកសារ CSV"
                      : "Choose CSV File"
                    : isKhmer
                      ? "ជ្រើសរើសឯកសារ ZIP"
                      : "Choose ZIP Bundle"}
                </label>
                <input
                  type="file"
                  name="file"
                  required
                  accept={importMode === "import" ? ".csv,text/csv" : ".zip,application/zip"}
                  className="ai-input py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="ai-btn-secondary h-9 px-4 text-xs"
                >
                  {isKhmer ? "បោះបង់" : "Cancel"}
                </button>
                <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-5 text-xs">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "ចាប់ផ្តើមនាំចូល" : "Upload & Apply"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unsaved Edits Warning Modal when switching section tabs */}
      {pendingTabUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-translations-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => setPendingTabUrl(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e3e6ed] bg-white p-5 shadow-xl dark:border-[#2b3245] dark:bg-[#141824] sm:p-6"
          >
            <h3
              id="discard-translations-title"
              className="font-display text-base font-bold text-[#141824] dark:text-[#eff2f6]"
            >
              {isKhmer ? "មានការកែប្រែមិនទាន់រក្សាទុក" : "Unsaved Translations"}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
              {isKhmer
                ? `អ្នកមានការបកប្រែចំនួន ${activeDirtyCount} ដែលមិនទាន់រក្សាទុក។ តើចង់បោះបង់ ហើយប្តូរផ្នែកឬ?`
                : `You have ${activeDirtyCount} unsaved edit(s) in ${activeTab}. Switch tabs without saving?`}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
              <button
                type="button"
                onClick={() => setPendingTabUrl(null)}
                className="ai-btn-secondary h-9 px-4 text-xs"
              >
                {isKhmer ? "ត្រឡប់ទៅរក្សាទុក" : "Stay Here"}
              </button>
              <a
                href={pendingTabUrl}
                className="inline-flex h-9 items-center rounded-lg bg-[#e5780b] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#c86606]"
              >
                {isKhmer ? "បោះបង់ និងប្តូរផ្នែក" : "Discard & Switch"}
              </a>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
