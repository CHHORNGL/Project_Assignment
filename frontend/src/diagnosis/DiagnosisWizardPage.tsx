import React, { useDeferredValue, useEffect, useRef, useState } from "react";

import { scheduleLiveEvaluation } from "./liveEvaluation";

import StepCard from "./components/StepCard";
import Stepper from "./components/Stepper";
import SymptomCard from "./components/SymptomCard";
import { DiagIcon } from "./components/DiagIcon";
import { LiveSuspectsSkeleton } from "../components/ui/Skeleton";

interface WizardCrop {
  id: string | number;
  name: string;
  name_kh?: string;
  domainId?: string;
  subcategoryId?: string;
  category?: string;
  icon?: string;
  [key: string]: unknown;
}

interface WizardSymptom {
  id: string;
  name: string;
  name_kh?: string;
}

interface SymptomGroup {
  id: string;
  name_en: string;
  name_kh: string;
  description_en: string;
  description_kh: string;
  keywords: string[];
  symptoms: WizardSymptom[];
}

interface LabelledItem {
  id?: string;
  label?: string;
  label_kh?: string;
  subcategories?: LabelledItem[];
  [key: string]: unknown;
}

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u1780-\u17ff\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromSlug(value: unknown, fallback = "General"): string {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickLabel(item: LabelledItem | null | undefined, isKhmer: boolean, fallback: string): string {
  if (!item || typeof item !== "object") return fallback;
  const kh = String(item.label_kh || "").trim();
  const en = String(item.label || "").trim();
  if (isKhmer) return kh || en || fallback;
  return en || kh || fallback;
}

function formatTemplate(template: unknown, values: Record<string, unknown>, fallback: string): string {
  const source = String(template || fallback || "").trim();
  if (!source) return "";
  return source.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return String(values[key]);
    }
    return match;
  });
}

function getSymptomsForCrop(
  cropId: string | number | undefined,
  symptomsByCrop: Record<string, WizardSymptom[]>,
): WizardSymptom[] {
  const isGeneral = !cropId || String(cropId) === "0";
  const specific = symptomsByCrop?.[String(cropId ?? "")];
  const fallback = symptomsByCrop?.["0"] || [];

  let source: WizardSymptom[];
  if (isGeneral) {
    source = fallback;
  } else if (Array.isArray(specific)) {
    source = specific;
  } else {
    source = [];
  }

  const rows: WizardSymptom[] = [];
  const seen = new Set<string>();

  source.forEach((item) => {
    const id = String(item?.id || "").trim();
    const name = String(item?.name || "").trim();
    const name_kh = String(item?.name_kh || "").trim();
    if (!id || !name || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, name, name_kh });
  });

  return rows.sort((left, right) => left.name.localeCompare(right.name));
}

function doesCropMatchContext(crop: WizardCrop | null | undefined, domainId: string, subcategoryId: string): boolean {
  if (!crop) return false;
  const matchDomain = !domainId || String(crop.domainId || "") === String(domainId);
  const matchSubcategory = !subcategoryId || String(crop.subcategoryId || "") === String(subcategoryId);
  return matchDomain && matchSubcategory;
}

function groupSymptoms(symptoms: WizardSymptom[]): SymptomGroup[] {
  const categories: SymptomGroup[] = [
    {
      id: "leaf",
      name_en: "Leaf Symptoms",
      name_kh: "រោគសញ្ញាលើស្លឹក",
      description_en: "Spots, yellowing, powdery coating, or holes on leaves.",
      description_kh: "ស្នាមអុច លឿង ម្សៅស ឬប្រហោងនៅលើស្លឹក។",
      keywords: ["leaf", "leaves", "foliage", "spot", "mildew", "rust", "ស្លឹក", "អុច"],
      symptoms: []
    },
    {
      id: "stem",
      name_en: "Stem & Branch Symptoms",
      name_kh: "រោគសញ្ញាលើដើម និងមែក",
      description_en: "Cankers, oozing, cracks, or rot on the stalks or stems.",
      description_kh: "ស្នាមដំបៅ ហៀរជ័រ ប្រេះ ឬរលួយនៅលើដើម ឬទង។",
      keywords: ["stem", "stalk", "branch", "twig", "trunk", "bark", "ដើម", "មែក", "សំបក"],
      symptoms: []
    },
    {
      id: "fruit_flower",
      name_en: "Fruit & Flower Symptoms",
      name_kh: "រោគសញ្ញាលើផ្លែ និងផ្កា",
      description_en: "Deformation, rot, spots, or drop of fruits, flowers, or pods.",
      description_kh: "វៀចវេរ រលួយ អុចៗ ឬជ្រុះផ្លែ ផ្កា ឬផ្លែខ្ចី។",
      keywords: ["fruit", "flower", "pod", "blossom", "seed", "bloom", "grain", "ផ្លែ", "ផ្កា", "គ្រាប់"],
      symptoms: []
    },
    {
      id: "root_vigor",
      name_en: "Root & Plant Vigor",
      name_kh: "ឫស និងការលូតលាស់ទូទៅ",
      description_en: "Stunted growth, wilting, root rot, or overall plant decline.",
      description_kh: "ការលូតលាស់យឺត ស្រពោន រលួយឫស ឬខូចខាតរុក្ខជាតិទាំងមូល។",
      keywords: ["root", "soil", "wilt", "stunt", "growth", "die", "ឫស", "ដី", "ស្រពោន", "ក្រិន", "លូតលាស់"],
      symptoms: []
    }
  ];

  const categorizedIds = new Set();

  symptoms.forEach(s => {
    const name = (s.name || "").toLowerCase();
    const nameKh = (s.name_kh || "").toLowerCase();

    let matched = false;
    for (const cat of categories) {
      if (cat.keywords.some(kw => name.includes(kw) || nameKh.includes(kw))) {
        cat.symptoms.push(s);
        categorizedIds.add(s.id);
        matched = true;
        break;
      }
    }
  });

  const otherSymptoms = symptoms.filter(s => !categorizedIds.has(s.id));
  if (otherSymptoms.length > 0) {
    categories.push({
      id: "other",
      name_en: "Other Signs",
      name_kh: "សញ្ញាផ្សេងៗទៀត",
      description_en: "Other specific observations or pest sightings.",
      description_kh: "ការសង្កេតជាក់លាក់ផ្សេងទៀត ឬវត្តមានសត្វល្អិតចង្រៃ។",
      keywords: [],
      symptoms: otherSymptoms
    });
  }

  return categories.filter(cat => cat.symptoms.length > 0);
}

function CropCard({
  crop,
  selected,
  onSelect,
  subtitle,
  isKhmer,
  selectedText,
  chooseCropText,
  generalText,
}: {
  crop: WizardCrop;
  selected: boolean;
  onSelect: () => void;
  subtitle: string;
  isKhmer: boolean;
  selectedText: string;
  chooseCropText: string;
  generalText: string;
}) {
  const cropName = isKhmer && crop.name_kh ? crop.name_kh : crop.name;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("diag-choice-card justify-between", selected && "diag-choice-card-selected")}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "font-display text-base sm:text-lg",
              selected ? "font-bold text-slate-900 dark:text-white" : "font-semibold text-slate-800 dark:text-slate-200",
            )}
          >
            {cropName}
          </p>
          <p
            className={cn(
              "mt-0.5 text-xs sm:text-sm",
              selected ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400",
            )}
          >
            {subtitle}
          </p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs transition-all duration-150",
            selected
              ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
              : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-obsidian-950/70",
          )}
        >
          <DiagIcon name={selected ? "fa-check" : "fa-seedling"} className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/70">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-obsidian-800 dark:text-slate-300">
          {titleFromSlug(crop.subcategoryId, generalText)}
        </span>
        <span
          className={cn(
            "text-xs font-semibold",
            selected ? "text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400",
          )}
        >
          {selected ? selectedText : chooseCropText}
        </span>
      </div>
    </button>
  );
}

function ContextCard({
  label,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("diag-choice-card py-3.5", selected && "diag-choice-card-selected")}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "text-sm sm:text-base",
            selected ? "font-bold text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-200",
          )}
        >
          {label}
        </p>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs transition-all duration-150",
            selected
              ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
              : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-obsidian-950/70",
          )}
        >
          <DiagIcon name={selected ? "fa-check" : "fa-leaf"} className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
}

function ReviewList({
  title,
  items,
  emptyText,
  icon,
  reviewText,
}: {
  title: string;
  items: string[];
  emptyText: string;
  icon: string;
  reviewText: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/85 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-obsidian-950/50 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-300">
          <DiagIcon name={icon} className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {reviewText}
          </p>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
      </div>
      {items.length ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="diag-chip">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

export default function DiagnosisWizardPage({ bootstrap }: { bootstrap: Record<string, any> }) {
  const labels: Record<string, string> = bootstrap?.labels || {};
  const crops: WizardCrop[] = Array.isArray(bootstrap?.crops) ? bootstrap.crops : [];
  const agriDomains: LabelledItem[] = Array.isArray(bootstrap?.agriDomains) ? bootstrap.agriDomains : [];
  const symptomsByCrop: Record<string, WizardSymptom[]> =
    bootstrap?.symptomsByCrop && typeof bootstrap.symptomsByCrop === "object"
      ? bootstrap.symptomsByCrop
      : {};
  const domainDefaultDiagnosisCategory: Record<string, string> =
    bootstrap?.domainDefaultDiagnosisCategory && typeof bootstrap.domainDefaultDiagnosisCategory === "object"
      ? bootstrap.domainDefaultDiagnosisCategory
      : {};
  const initialCropId = String(bootstrap?.initialCropId || "").trim();
  const initialCrop = crops.find((item) => String(item.id) === initialCropId) || null;
  const isKhmer = String(bootstrap?.currentLang || "").toLowerCase().startsWith("km");

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedDomainId, setSelectedDomainId] = useState<string>(
    String(initialCrop?.domainId || agriDomains?.[0]?.id || ""),
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(
    String(initialCrop?.subcategoryId || ""),
  );
  const [selectedCropId, setSelectedCropId] = useState<string>(initialCropId);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [cropSearch, setCropSearch] = useState("");
  const [symptomSearch, setSymptomSearch] = useState("");
  const [freeTextNotes, setFreeTextNotes] = useState("");
  const [fieldImage, setFieldImage] = useState<File | null>(null);
  const [fieldImagePreview, setFieldImagePreview] = useState("");
  const [formError, setFormError] = useState("");
  const [contextNotice, setContextNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [questionnaireActive, setQuestionnaireActive] = useState(true);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [categoryAnswers, setCategoryAnswers] = useState<Record<string, string>>({});
  const [liveSuspects, setLiveSuspects] = useState<any[]>([]);
  const [liveBestMatch, setLiveBestMatch] = useState<any>(null);
  const [evaluatingLive, setEvaluatingLive] = useState(false);
  const [deniedSymptoms, setDeniedSymptoms] = useState<string[]>([]);

  const deferredCropSearch = useDeferredValue(cropSearch);
  const deferredSymptomSearch = useDeferredValue(symptomSearch);

  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const steps = [
    {
      id: "crop",
      label: label("stepCropLabel", "Select Crop Type"),
      description: label("stepCropDesc", "Choose the crop you want to diagnose."),
    },
    {
      id: "context",
      label: label("stepContextLabel", "Select Category / Growth Stage"),
      description: label("stepContextDesc", "Refine the diagnosis context before symptoms are shown."),
    },
    {
      id: "symptoms",
      label: label("stepSymptomsLabel", "Select Symptoms"),
      description: label("stepSymptomsDesc", "Pick only the symptoms that match what you observe."),
    },
    {
      id: "review",
      label: label("stepReviewLabel", "Review + Submit"),
      description: label("stepReviewDesc", "Review the case, add notes or an image, and submit."),
    },
  ];

  const currentDomain = agriDomains.find((item) => String(item.id) === String(selectedDomainId))
    || agriDomains[0]
    || null;
  const subcategories = Array.isArray(currentDomain?.subcategories)
    ? currentDomain.subcategories
    : [];

  const filteredCrops = crops
    .filter((crop) => {
      const keyword = normalizeText(deferredCropSearch);
      if (keyword) {
        const matchesEn = normalizeText(crop.name).includes(keyword);
        const matchesKh = crop.name_kh ? normalizeText(crop.name_kh).includes(keyword) : false;
        return matchesEn || matchesKh;
      }
      return doesCropMatchContext(crop, selectedDomainId, selectedSubcategoryId);
    });

  const currentSymptoms = getSymptomsForCrop(selectedCropId, symptomsByCrop);
  const allVisibleSymptoms = currentSymptoms.filter((symptom) => {
    const keyword = normalizeText(deferredSymptomSearch);
    if (!keyword) return true;
    const matchesEn = normalizeText(symptom.name).includes(keyword);
    const matchesKh = symptom.name_kh ? normalizeText(symptom.name_kh).includes(keyword) : false;
    return matchesEn || matchesKh;
  });
  const currentSymptomLookup = new Map(
    currentSymptoms.map((item) => [String(item.id), isKhmer && item.name_kh ? item.name_kh : item.name])
  );
  const fallbackSymptomLookup = new Map(
    getSymptomsForCrop(0, symptomsByCrop).map((item) => [
      String(item.id),
      isKhmer && item.name_kh ? item.name_kh : item.name,
    ])
  );

  const selectedCrop = crops.find((item) => String(item.id) === String(selectedCropId)) || null;
  const selectedCropLabel = selectedCrop
    ? (isKhmer && selectedCrop.name_kh ? selectedCrop.name_kh : selectedCrop.name)
    : label("selectCrop", "Select crop");
  const selectedTypeLabel = selectedSubcategoryId
    ? pickLabel(
      subcategories.find((item) => String(item.id) === String(selectedSubcategoryId)),
      isKhmer,
      titleFromSlug(selectedSubcategoryId),
    )
    : label("general", "General");
  const diagnosisCategory = String(domainDefaultDiagnosisCategory[selectedDomainId] || "other");
  const selectedSymptomNames = selectedSymptoms
    .map((id) => currentSymptomLookup.get(String(id)) || fallbackSymptomLookup.get(String(id)) || "")
    .filter(Boolean);

  function label(key: string, fallback: string): string {
    const value = String(labels[key] || "").trim();
    return value || fallback;
  }

  function setErrorAndStay(message: string, stepNumber: number) {
    setFormError(message);
    setCurrentStep(stepNumber);
  }

  function syncFileInput(file: File | null) {
    const input = fileInputRef.current;
    if (!input) return;

    if (!file) {
      input.value = "";
      return;
    }

    if (typeof DataTransfer === "undefined") {
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  }

  function setFieldImageFile(nextFile: File | null) {
    setFieldImage(nextFile || null);
    syncFileInput(nextFile || null);
    setFormError("");
  }

  function clearFieldImage() {
    setFieldImageFile(null);
  }

  function toggleSymptom(symptomId: string | number) {
    const nextId = String(symptomId);
    setSelectedSymptoms((current) => {
      if (current.includes(nextId)) {
        return current.filter((item) => item !== nextId);
      }
      return [...current, nextId];
    });
    setFormError("");
  }

  function handleCategoryAnswer(catId: string, answer: string) {
    const activeCategories = groupSymptoms(currentSymptoms);
    const category = activeCategories.find((c) => c.id === catId);
    if (!category) return;

    const catSymptomIds = category.symptoms.map((s) => String(s.id));

    setCategoryAnswers((prev) => ({ ...prev, [catId]: answer }));

    if (answer === "no") {
      setDeniedSymptoms((prev) => {
        const next = prev.filter((id) => !catSymptomIds.includes(String(id)));
        return [...next, ...catSymptomIds];
      });
      setSelectedSymptoms((prev) => prev.filter((id) => !catSymptomIds.includes(String(id))));
    } else if (answer === "yes") {
      setDeniedSymptoms((prev) => prev.filter((id) => !catSymptomIds.includes(String(id))));
    } else {
      setDeniedSymptoms((prev) => prev.filter((id) => !catSymptomIds.includes(String(id))));
      setSelectedSymptoms((prev) => prev.filter((id) => !catSymptomIds.includes(String(id))));
    }
  }

  function handleSymptomCheckboxToggle(symptomId: string | number) {
    const idStr = String(symptomId);
    setSelectedSymptoms((prev) => {
      if (prev.includes(idStr)) {
        return prev.filter((id) => id !== idStr);
      }
      return [...prev, idStr];
    });
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files && event.target.files.length ? event.target.files[0] : null;
    setFieldImage(nextFile || null);
    setFormError("");
  }

  function handleDropZone(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setFieldImageFile(file);
    setFormError("");
  }

  function validateStep(stepNumber: number) {
    if (stepNumber === 1 && !selectedCropId) {
      setErrorAndStay(label("pleaseSelectCrop", "Please select a crop to continue."), 1);
      return false;
    }

    if (stepNumber === 2) {
      if (!selectedCropId) {
        setErrorAndStay(label("pleaseSelectCrop", "Please select a crop to continue."), 1);
        return false;
      }
    }

    if (stepNumber === 3 && selectedSymptoms.length === 0) {
      setErrorAndStay(label("pleaseSelectSymptom", "Select at least one symptom to continue."), 3);
      return false;
    }

    return true;
  }

  function goNext() {
    if (!validateStep(currentStep)) return;
    setFormError("");
    setCurrentStep((step) => Math.min(step + 1, steps.length));
  }

  function goBack() {
    setFormError("");
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setFormError("");

    if (!selectedCropId) {
      event.preventDefault();
      setErrorAndStay(label("pleaseSelectCrop", "Please select a crop to continue."), 1);
      return;
    }

    if (!selectedSymptoms.length) {
      event.preventDefault();
      setErrorAndStay(label("pleaseSelectSymptom", "Select at least one symptom to continue."), 3);
      return;
    }

    if (fieldImage?.type && !fieldImage.type.startsWith("image/")) {
      event.preventDefault();
      setErrorAndStay(label("invalidImageType", "Please choose a valid image file."), 4);
      return;
    }

    setSubmitting(true);
  }

  useEffect(() => {
    setSelectedSymptoms([]);
    setSymptomSearch("");
    setFormError("");
    setQuestionnaireActive(true);
    if (!selectedCropId) {
      setSelectedSymptoms([]);
      setCurrentCategoryIndex(0);
      setCategoryAnswers({});
      setDeniedSymptoms([]);
      setLiveSuspects([]);
      setLiveBestMatch(null);
      return;
    }

    const crop = crops.find((item) => String(item.id) === String(selectedCropId));
    if (!crop) return;

    if (crop.domainId && String(crop.domainId) !== String(selectedDomainId)) {
      setSelectedDomainId(String(crop.domainId));
    }

    if (String(crop.subcategoryId || "") !== String(selectedSubcategoryId || "")) {
      setSelectedSubcategoryId(String(crop.subcategoryId || ""));
    }

    setContextNotice("");
    setCurrentCategoryIndex(0);
    setCategoryAnswers({});
    setDeniedSymptoms([]);
    setLiveSuspects([]);
    setLiveBestMatch(null);
  }, [selectedCropId]);

  useEffect(() => {
    if (!selectedCropId) return;

    const crop = crops.find((item) => String(item.id) === String(selectedCropId));
    if (!crop) return;

    if (!doesCropMatchContext(crop, selectedDomainId, selectedSubcategoryId)) {
      setSelectedCropId("");
      setSelectedSymptoms([]);
      setContextNotice("The crop was cleared because it no longer matches the selected context. Choose a compatible crop in Step 1.");
    }
  }, [selectedDomainId, selectedSubcategoryId]);

  useEffect(() => {
    if (!selectedCropId) {
      setSelectedSymptoms([]);
      return;
    }

    const validIds = new Set(getSymptomsForCrop(selectedCropId, symptomsByCrop).map((item) => String(item.id)));
    setSelectedSymptoms((current) => current.filter((item) => validIds.has(String(item))));
  }, [selectedCropId, symptomsByCrop]);

  useEffect(() => {
    if (!fieldImage) {
      setFieldImagePreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(fieldImage);
    setFieldImagePreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [fieldImage]);

  useEffect(() => {
    setLiveSuspects([]);
    setLiveBestMatch(null);
    setEvaluatingLive(false);
    if (currentStep !== 3 || !selectedCropId || (!selectedSymptoms.length && !deniedSymptoms.length)) {
      return undefined;
    }

    setEvaluatingLive(true);
    setFormError("");
    return scheduleLiveEvaluation({
      url: bootstrap.liveEvaluationApi,
      csrfToken: bootstrap.csrfToken,
      payload: {
        crop_id: selectedCropId,
        symptoms: selectedSymptoms,
        denied_symptoms: deniedSymptoms,
        category: diagnosisCategory,
      },
      onSuccess: (data) => {
        setLiveSuspects(Array.isArray(data.suspects) ? data.suspects : []);
        setLiveBestMatch(data.best || null);
      },
      onError: (error) => setFormError(error instanceof Error ? error.message : String(error)),
      onSettled: () => setEvaluatingLive(false),
    });
  }, [selectedCropId, selectedSymptoms, deniedSymptoms, diagnosisCategory, currentStep, bootstrap.liveEvaluationApi, bootstrap.csrfToken]);

  return (
    <div className={cn("mx-auto max-w-6xl font-body", isKhmer && "font-khmer")}>
      <div className="diag-shell">
        {/* Compact Mode & Actions Ribbon */}
        <div className="diag-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
              <DiagIcon name="fa-stethoscope" className="h-3.5 w-3.5" />
              <span>{label("aiPoweredSystem", "AI-Powered Expert System")}</span>
            </span>
            {selectedCrop && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-200">
                <DiagIcon name="fa-seedling" className="h-3 w-3 text-emerald-500" />
                <span>{selectedCropLabel}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href={bootstrap.dashboardUrl} className="diag-secondary-button h-8 px-3">
              <DiagIcon name="fa-arrow-left" className="h-3.5 w-3.5" />
              <span>{label("back", "Home")}</span>
            </a>
            {bootstrap.chatUrl ? (
              <a href={bootstrap.chatUrl} className="diag-secondary-button h-8 px-3">
                <DiagIcon name="fa-user-md" className="h-3.5 w-3.5" />
                <span>{label("askExpert", "Ask AI")}</span>
              </a>
            ) : null}
          </div>
        </div>

        <form
          ref={formRef}
          action={bootstrap.postUrl}
          method="POST"
          encType="multipart/form-data"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <input type="hidden" name="scan_mode" value="0" />
          <input type="hidden" name="instant_scan_mode" value="0" />
          <input type="hidden" name="agri_domain" value={selectedDomainId} />
          <input type="hidden" name="agri_subcategory" value={selectedSubcategoryId} />
          <input type="hidden" name="crop_id" value={selectedCropId} />
          <input type="hidden" name="diagnosis_category" value={diagnosisCategory} />
          <input type="hidden" name="slot_payload" value="{}" />
          <input type="hidden" name="visual_tags" value="[]" />
          <input type="hidden" name="clarification_payload" value="[]" />
          <input type="hidden" name="clarification_count" value="0" />
          {selectedSymptoms.map((symptomId) => (
            <input key={symptomId} type="hidden" name="symptoms" value={symptomId} />
          ))}
          {deniedSymptoms.map((symptomId) => (
            <input key={symptomId} type="hidden" name="denied_symptoms" value={symptomId} />
          ))}

          <Stepper
            steps={steps}
            currentStep={currentStep}
            title={label("guidedDiagnosis", "Guided Diagnosis")}
            stepProgressText={formatTemplate(
              label("stepProgress", "Step {current} of {total}"),
              { current: currentStep, total: steps.length },
              "Step {current} of {total}",
            )}
            hint={label("completeEachStep", "Complete each step to continue")}
            onStepSelect={(stepNum) => {
              setFormError("");
              setCurrentStep(stepNum);
            }}
          />

          {formError ? (
            <div className="diag-panel border-rose-200 bg-rose-50/90 px-5 py-3.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="flex items-start gap-2.5">
                <DiagIcon name="fa-exclamation-circle" className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div>
                  <p className="font-bold">{label("formErrorTitle", "We need one quick fix before continuing.")}</p>
                  <p className="mt-0.5">{formError}</p>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <StepCard
              eyebrow={label("step1", "Step 1")}
              title={label("stepCropLabel", "Select Crop Type")}
              description={label("stepCropDesc", "Pick the crop you want to evaluate. Search by English or Khmer name.")}
              aside={
                <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/75 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <span>{label("currentContext", "Group")}:</span>
                  <span className="font-bold">{selectedSubcategoryId ? selectedTypeLabel : label("allCropGroups", "All crops")}</span>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/85 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-obsidian-950/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="crop-search" className="text-xs font-bold text-slate-900 dark:text-white">
                      {label("searchCrops", "Search crops")}
                    </label>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-obsidian-900 dark:text-slate-300 dark:ring-slate-800">
                      {filteredCrops.length} {isKhmer ? "ដំណាំ" : "crops"}
                    </span>
                  </div>
                  <div className="relative mt-2.5">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <DiagIcon name="fa-search" className="h-4 w-4" />
                    </div>
                    <input
                      id="crop-search"
                      type="text"
                      value={cropSearch}
                      onChange={(event) => setCropSearch(event.target.value)}
                      className="diag-input pl-10 pr-9 text-xs"
                      placeholder={label("searchByCropName", "Search by crop name")}
                    />
                    {cropSearch && (
                      <button
                        type="button"
                        onClick={() => setCropSearch("")}
                        aria-label="Clear crop search"
                        className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-obsidian-800 dark:hover:text-slate-200"
                      >
                        <DiagIcon name="fa-times" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {selectedCrop && (
                    <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {label("selection", "Selected")}:{" "}
                      <span className="font-bold text-indigo-600 dark:text-indigo-300">
                        {isKhmer && selectedCrop.name_kh ? selectedCrop.name_kh : selectedCrop.name}
                      </span>
                    </p>
                  )}
                </div>

                {filteredCrops.length ? (
                  <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCrops.map((crop) => (
                      <CropCard
                        key={crop.id}
                        crop={crop}
                        selected={String(crop.id) === String(selectedCropId)}
                        isKhmer={isKhmer}
                        selectedText={label("selectedText", "Selected")}
                        chooseCropText={label("chooseCropText", "Choose crop")}
                        generalText={label("general", "General")}
                        subtitle={pickLabel(
                          subcategories.find((item) => String(item.id) === String(crop.subcategoryId)),
                          isKhmer,
                          titleFromSlug(crop.subcategoryId, label("generalCrop", "General crop")),
                        )}
                        onSelect={() => {
                          setSelectedCropId(String(crop.id));
                          setFormError("");
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center dark:border-slate-700 dark:bg-obsidian-950/60">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-obsidian-800">
                      <DiagIcon name="fa-seedling" className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
                      {label("noCropsMatch", "No crops match this filter")}
                    </h3>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {label("noCropsMatchDesc", "Adjust the category in Step 2 or clear your crop search to see more options.")}
                    </p>
                    {cropSearch && (
                      <button
                        type="button"
                        onClick={() => setCropSearch("")}
                        className="diag-secondary-button mt-4 h-8 px-3"
                      >
                        {isKhmer ? "សម្អាតការស្វែងរក" : "Clear search"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </StepCard>
          ) : null}

          {currentStep === 2 ? (
            <StepCard
              eyebrow={label("step2", "Step 2")}
              title={label("stepContextLabel", "Select Category / Growth Stage")}
              description={label("stepContextDesc", "Keep the diagnosis context aligned before symptoms are shown.")}
              aside={
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs dark:border-slate-800 dark:bg-obsidian-950">
                  <span className="text-slate-500">{label("selectedCrop", "Crop")}:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedCropLabel}</span>
                </div>
              }
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {label("category", "Category")}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {label("categoryDesc", "Used to keep crop and diagnosis context aligned.")}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {(agriDomains.length ? agriDomains : [{ id: "", label: label("general", "General") }]).map((domain) => (
                      <ContextCard
                        key={domain.id || "general-domain"}
                        label={pickLabel(domain, isKhmer, label("general", "General"))}
                        selected={String(domain.id || "") === String(selectedDomainId || "")}
                        onSelect={() => {
                          setSelectedDomainId(String(domain.id || ""));
                          setFormError("");
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 dark:border-slate-800/80">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{label("type", "Type")}</h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {label("subcategoryDesc", "Filters crop options and keeps symptoms targeted.")}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <ContextCard
                      label={label("general", "General")}
                      selected={!selectedSubcategoryId}
                      onSelect={() => {
                        setSelectedSubcategoryId("");
                        setFormError("");
                      }}
                    />
                    {subcategories.map((subcategory) => (
                      <ContextCard
                        key={subcategory.id}
                        label={pickLabel(subcategory, isKhmer, titleFromSlug(subcategory.id, label("general", "General")))}
                        selected={String(subcategory.id || "") === String(selectedSubcategoryId || "")}
                        onSelect={() => {
                          setSelectedSubcategoryId(String(subcategory.id || ""));
                          setFormError("");
                        }}
                      />
                    ))}
                  </div>
                </div>

                {contextNotice ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    <div className="flex items-start gap-2.5">
                      <DiagIcon name="fa-info-circle" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p>{contextNotice}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-obsidian-950/50 dark:text-slate-400">
                    {label("contextStepHint", "Symptoms in the next step will match your selected crop and context.")}
                  </div>
                )}
              </div>
            </StepCard>
          ) : null}

          {currentStep === 3 ? (
            <div className="grid min-w-0 items-start gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              {/* Questionnaire / Checklist Panel */}
              <div className="min-w-0 space-y-5">
                {questionnaireActive && currentSymptoms.length > 0 ? (
                  /* Guided Questionnaire Mode */
                  (() => {
                    const activeCategories = groupSymptoms(currentSymptoms);
                    const currentCat = activeCategories[currentCategoryIndex];

                    if (!currentCat) {
                      return (
                        <StepCard
                          eyebrow={label("step3", "Step 3")}
                          title={isKhmer ? "ការវិនិច្ឆ័យរហ័ស" : "Questionnaire Completed"}
                          description={isKhmer ? "អ្នកបានឆ្លើយសំណួរទាំងអស់រួចហើយ។ សូមបន្តទៅជំហានបន្ទាប់។" : "You have answered all symptom groups. Review your selection or proceed to Step 4."}
                        >
                          <div className="py-6 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <DiagIcon name="fa-check-double" className="h-5 w-5" />
                            </div>
                            <h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
                              {isKhmer ? "រួចរាល់ហើយ!" : "Ready to Review!"}
                            </h3>
                            <button
                              type="button"
                              onClick={() => setQuestionnaireActive(false)}
                              className="diag-secondary-button mt-4"
                            >
                              {isKhmer ? "មើលបញ្ជីសញ្ញាទាំងអស់" : "Switch to Full Checklist"}
                            </button>
                          </div>
                        </StepCard>
                      );
                    }

                    const catAnswer = categoryAnswers[currentCat.id] || "";
                    const categorySymptoms = currentCat.symptoms;

                    return (
                      <StepCard
                        eyebrow={label("step3", "Step 3")}
                        title={isKhmer ? currentCat.name_kh : currentCat.name_en}
                        description={isKhmer ? currentCat.description_kh : currentCat.description_en}
                        aside={
                          <button
                            type="button"
                            onClick={() => setQuestionnaireActive(false)}
                            className="diag-secondary-button h-8 px-3"
                          >
                            <DiagIcon name="fa-list" className="h-3.5 w-3.5" />
                            <span>{isKhmer ? "មើលបញ្ជី" : "Checklist Mode"}</span>
                          </button>
                        }
                      >
                        <div className="space-y-5">
                          {/* Category quick-jump tabs */}
                          {activeCategories.length > 1 && (
                            <div className="flex flex-wrap gap-1.5">
                              {activeCategories.map((cat, idx) => {
                                const answered = Boolean(categoryAnswers[cat.id]);
                                const isCurrent = idx === currentCategoryIndex;
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCurrentCategoryIndex(idx)}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                                      isCurrent
                                        ? "border-indigo-500 bg-indigo-600 text-white shadow-xs"
                                        : answered
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-300"
                                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300",
                                    )}
                                  >
                                    {answered && !isCurrent && (
                                      <DiagIcon name="fa-check" className="h-3 w-3" />
                                    )}
                                    <span>{isKhmer ? cat.name_kh : cat.name_en}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Screening Question */}
                          <div className="rounded-2xl border border-slate-200/85 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-obsidian-950/60 sm:p-5">
                            <h3 className="mb-3.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                              {isKhmer
                                ? `តើអ្នកសង្កេតឃើញមាន រោគសញ្ញាណាមួយនៅលើ ${currentCat.name_kh} ដែរឬទេ?`
                                : `Do you observe any symptoms on the ${currentCat.name_en}?`}
                            </h3>

                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                              <button
                                type="button"
                                onClick={() => handleCategoryAnswer(currentCat.id, "yes")}
                                className={cn(
                                  "flex flex-col items-center justify-center rounded-xl border px-1.5 py-3 text-center text-[11px] font-semibold transition-all duration-150 sm:p-3.5 sm:text-sm",
                                  catAnswer === "yes"
                                    ? "border-indigo-500 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-500/25 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-obsidian-900 dark:text-slate-300",
                                )}
                              >
                                <DiagIcon name="fa-check-circle" className="mb-1.5 h-5 w-5" />
                                {isKhmer ? "បាទ/ចាស (មាន)" : "Yes"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCategoryAnswer(currentCat.id, "no")}
                                className={cn(
                                  "flex flex-col items-center justify-center rounded-xl border px-1.5 py-3 text-center text-[11px] font-semibold transition-all duration-150 sm:p-3.5 sm:text-sm",
                                  catAnswer === "no"
                                    ? "border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500/20 dark:border-rose-400 dark:bg-rose-950/30 dark:text-rose-300"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-obsidian-900 dark:text-slate-300",
                                )}
                              >
                                <DiagIcon name="fa-times-circle" className="mb-1.5 h-5 w-5" />
                                {isKhmer ? "ទេ (គ្មាន)" : "No"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCategoryAnswer(currentCat.id, "unsure")}
                                className={cn(
                                  "flex flex-col items-center justify-center rounded-xl border px-1.5 py-3 text-center text-[11px] font-semibold transition-all duration-150 sm:p-3.5 sm:text-sm",
                                  catAnswer === "unsure"
                                    ? "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500/20 dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-300"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-obsidian-900 dark:text-slate-300",
                                )}
                              >
                                <DiagIcon name="fa-question-circle" className="mb-1.5 h-5 w-5" />
                                {isKhmer ? "មិនច្បាស់" : "Unsure"}
                              </button>
                            </div>
                          </div>

                          {/* Specific Checked Symptoms */}
                          {catAnswer === "yes" && (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                {isKhmer ? "ជ្រើសរើសរោគសញ្ញាជាក់លាក់ដែលអ្នកមើលឃើញ៖" : "Select all specific signs you observe:"}
                              </p>
                              <div className="grid gap-3 md:grid-cols-2">
                                {categorySymptoms.map((symptom) => {
                                  const isSelected = selectedSymptoms.includes(String(symptom.id));
                                  return (
                                    <button
                                      key={symptom.id}
                                      type="button"
                                      onClick={() => handleSymptomCheckboxToggle(symptom.id)}
                                      className={cn(
                                        "diag-symptom-card p-3.5",
                                        isSelected && "diag-symptom-card-selected",
                                      )}
                                    >
                                      <div className="flex items-start gap-3">
                                        <div
                                          className={cn(
                                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                                            isSelected
                                              ? "border-indigo-600 bg-indigo-600 text-white"
                                              : "border-slate-300 bg-white dark:border-slate-700 dark:bg-obsidian-950",
                                          )}
                                        >
                                          {isSelected && <DiagIcon name="fa-check" className="h-3 w-3" />}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-900 dark:text-white sm:text-sm">
                                            {isKhmer && symptom.name_kh ? symptom.name_kh : symptom.name}
                                          </p>
                                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                            {isSelected
                                              ? isKhmer
                                                ? "បានជ្រើសរើស"
                                                : "Included"
                                              : isKhmer
                                                ? "ចុចដើម្បីជ្រើសរើស"
                                                : "Click to select"}
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Questionnaire Navigation Footer */}
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => setCurrentCategoryIndex((prev) => Math.max(0, prev - 1))}
                              className="diag-secondary-button h-9 px-3 sm:px-3.5"
                              disabled={currentCategoryIndex === 0}
                            >
                              <DiagIcon name="fa-chevron-left" className="h-3.5 w-3.5" />
                              <span>{isKhmer ? "ត្រឡប់ក្រោយ" : "Prev Group"}</span>
                            </button>

                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {isKhmer
                                ? `សំណួរទី ${currentCategoryIndex + 1} នៃ ${activeCategories.length}`
                                : `${currentCategoryIndex + 1} of ${activeCategories.length}`}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                if (currentCategoryIndex < activeCategories.length - 1) {
                                  setCurrentCategoryIndex((prev) => prev + 1);
                                } else {
                                  goNext();
                                }
                              }}
                              className="diag-primary-button h-9 px-3.5 sm:px-4"
                              disabled={!catAnswer}
                            >
                              <span>
                                {currentCategoryIndex < activeCategories.length - 1
                                  ? isKhmer
                                    ? "សំណួរបន្ទាប់"
                                    : "Next Group"
                                  : isKhmer
                                    ? "បញ្ចប់ & ពិនិត្យ"
                                    : "Finish & Review"}
                              </span>
                              <DiagIcon name="fa-chevron-right" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </StepCard>
                    );
                  })()
                ) : (
                  /* Classic Checklist Mode fallback */
                  <StepCard
                    eyebrow={label("step3", "Step 3")}
                    title={label("stepSymptomsLabel", "Select Symptoms")}
                    description={label("stepSymptomsDesc", "Choose every symptom you visibly observe on the crop.")}
                    aside={
                      currentSymptoms.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setQuestionnaireActive(true)}
                          className="diag-primary-button h-8 px-3"
                        >
                          <DiagIcon name="fa-question-circle" className="h-3.5 w-3.5" />
                          <span>{isKhmer ? "របៀបសំណួរ" : "Guided Mode"}</span>
                        </button>
                      ) : undefined
                    }
                  >
                    <div className="min-w-0 space-y-4">
                      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="min-w-0 rounded-2xl border border-slate-200/85 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-obsidian-950/60">
                          <label htmlFor="symptom-search" className="text-xs font-bold text-slate-900 dark:text-white">
                            {label("searchSymptom", "Search symptom")}
                          </label>
                          <div className="relative mt-2.5">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                              <DiagIcon name="fa-search" className="h-4 w-4" />
                            </div>
                            <input
                              id="symptom-search"
                              type="text"
                              value={symptomSearch}
                              onChange={(event) => setSymptomSearch(event.target.value)}
                              className="diag-input pl-10 pr-9 text-xs"
                              placeholder={label("searchSymptom", "Search symptom")}
                            />
                            {symptomSearch && (
                              <button
                                type="button"
                                onClick={() => setSymptomSearch("")}
                                aria-label="Clear symptom search"
                                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-obsidian-800 dark:hover:text-slate-200"
                              >
                                <DiagIcon name="fa-times" className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/85 bg-white p-4 dark:border-slate-800 dark:bg-obsidian-950/60">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {label("selectedSummary", "Selected")} ({selectedSymptoms.length})
                            </p>
                            {selectedSymptoms.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedSymptoms([])}
                                className="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                              >
                                {isKhmer ? "សម្អាតទាំងអស់" : "Clear all"}
                              </button>
                            )}
                          </div>
                          {selectedSymptoms.length > 0 ? (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {selectedSymptoms.slice(0, 6).map((symId) => {
                                const symLabel =
                                  currentSymptomLookup.get(String(symId)) ||
                                  fallbackSymptomLookup.get(String(symId)) ||
                                  symId;
                                return (
                                  <button
                                    key={symId}
                                    type="button"
                                    onClick={() => toggleSymptom(symId)}
                                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
                                  >
                                    <span className="max-w-[140px] truncate">{symLabel}</span>
                                    <DiagIcon name="fa-times" className="h-2.5 w-2.5" />
                                  </button>
                                );
                              })}
                              {selectedSymptoms.length > 6 && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-obsidian-800 dark:text-slate-300">
                                  +{selectedSymptoms.length - 6}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {label("noManualSelectionYet", "No symptoms selected yet.")}
                            </p>
                          )}
                        </div>
                      </div>

                      {allVisibleSymptoms.length ? (
                        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                          {allVisibleSymptoms.map((symptom) => (
                            <SymptomCard
                              key={symptom.id}
                              symptom={symptom}
                              selected={selectedSymptoms.includes(String(symptom.id))}
                              onToggle={() => toggleSymptom(symptom.id)}
                              isKhmer={isKhmer}
                              selectedText={label("symptomSelectedHint", "Included in diagnosis review")}
                              unselectedText={label("symptomUnselectedHint", "Tap to include this symptom")}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center dark:border-slate-700 dark:bg-obsidian-950/60">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-obsidian-800">
                            <DiagIcon name="fa-stethoscope" className="h-5 w-5" />
                          </div>
                          <h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
                            {currentSymptoms.length
                              ? label("noSymptomsMatch", "No symptoms match your search.")
                              : label("noSymptoms", "No symptoms are available for this crop.")}
                          </h3>
                          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {currentSymptoms.length
                              ? label("noSymptomsMatchDesc", "Try a different keyword or clear the search field.")
                              : label("noSymptomsDesc", "Go back and choose another crop or category to load a different symptom set.")}
                          </p>
                        </div>
                      )}
                    </div>
                  </StepCard>
                )}
              </div>

              {/* Sticky Live Suspects Feedback Panel */}
              <div className="diag-panel min-w-0 p-4 sm:p-5 lg:sticky lg:top-20">
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800/80">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {isKhmer ? "ការវិនិច្ឆ័យផ្ទាល់" : "Live suspects analysis"}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {isKhmer ? "ធ្វើបច្ចុប្បន្នភាពតាមចម្លើយរបស់អ្នក" : "Real-time updates based on answers"}
                    </p>
                  </div>
                  {evaluatingLive ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                      <DiagIcon name="fa-spinner" className="h-3.5 w-3.5 animate-spin" />
                    </div>
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>

                {evaluatingLive && liveSuspects.length === 0 ? (
                  <LiveSuspectsSkeleton
                    label={isKhmer ? "កំពុងវិភាគរោគសញ្ញា..." : "Analyzing live suspects..."}
                  />
                ) : liveSuspects.length > 0 ? (
                  <div className="space-y-3.5">
                    {liveBestMatch && (
                      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/75 p-3.5 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold">
                          <DiagIcon name="fa-info-circle" className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                          <span>{isKhmer ? "ការសន្និដ្ឋានបណ្តោះអាសន្ន" : "Top Suspected Match"}</span>
                        </p>
                        <p className="leading-relaxed">
                          {isKhmer
                            ? `ប្រព័ន្ធសង្ស័យខ្ពស់លើជំងឺ៖ ${liveBestMatch.disease_name} (${liveBestMatch.confidence_percent}%)`
                            : `Strongest match: ${liveBestMatch.disease_name} (${liveBestMatch.confidence_percent}% confidence).`}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {liveSuspects.slice(0, 3).map((suspect, idx) => {
                        const barColor =
                          suspect.confidence_tier === "high"
                            ? "bg-emerald-500"
                            : suspect.confidence_tier === "medium"
                              ? "bg-amber-500"
                              : "bg-indigo-500";
                        return (
                          <div
                            key={idx}
                            className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-obsidian-950/60"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white font-mono text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-obsidian-900 dark:text-slate-300 dark:ring-slate-800">
                                  #{idx + 1}
                                </span>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {suspect.disease_name}
                                </p>
                              </div>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {suspect.confidence_percent}%
                              </span>
                            </div>

                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-obsidian-800">
                              <div
                                className={cn("h-1.5 rounded-full transition-all duration-300", barColor)}
                                style={{ width: `${suspect.confidence_percent}%` }}
                              />
                            </div>

                            <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {suspect.matched_symptoms?.length > 0 && (
                                <p className="line-clamp-2">
                                  <strong className="text-slate-700 dark:text-slate-300">
                                    {isKhmer ? "ត្រូវគ្នា៖" : "Matches:"}{" "}
                                  </strong>
                                  {suspect.matched_symptoms.join(", ")}
                                </p>
                              )}
                              {suspect.missing_symptoms?.length > 0 && (
                                <p className="line-clamp-2">
                                  <strong className="text-slate-700 dark:text-slate-300">
                                    {isKhmer ? "មិនទាន់ឃើញ៖" : "Unconfirmed:"}{" "}
                                  </strong>
                                  {suspect.missing_symptoms.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                    <div className="mb-3 flex justify-center">
                      <DiagIcon name="fa-microscope" className="h-7 w-7 animate-pulse text-slate-300 dark:text-slate-700" />
                    </div>
                    <p className="px-3 leading-relaxed">
                      {isKhmer
                        ? "កំពុងរង់ចាំការឆ្លើយតប... ចម្លើយរបស់អ្នកនឹងបង្ហាញលទ្ធផលវិនិច្ឆ័យនៅទីនេះភ្លាមៗ។"
                        : "Select symptoms or answer questions to see ranked disease probabilities update live."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <div className="min-w-0">
              <StepCard
                eyebrow={label("step4", "Step 4")}
                title={label("stepReviewLabel", "Review + Submit")}
                description={label("stepReviewDesc", "Review the diagnosis context, confirm the symptoms, and send the case for rule-based analysis.")}
              >
                <div className="min-w-0 space-y-5">
                  <ReviewList
                    title={label("selection", "Selection")}
                    icon="fa-seedling"
                    emptyText={label("reviewSelectionEmpty", "Complete the earlier steps to review the crop context here.")}
                    reviewText={label("review", "Review")}
                    items={[
                      selectedCrop ? `${label("cropColon", "Crop:")} ${isKhmer && selectedCrop.name_kh ? selectedCrop.name_kh : selectedCrop.name}` : "",
                      selectedDomainId
                        ? `${label("category", "Category")}: ${pickLabel(currentDomain, isKhmer, label("general", "General"))}`
                        : "",
                      `${label("type", "Type")}: ${selectedTypeLabel}`,
                    ].filter(Boolean)}
                  />

                  <ReviewList
                    title={label("stepSymptomsLabel", "Symptoms")}
                    icon="fa-notes-medical"
                    emptyText={label("reviewSymptomsEmpty", "Selected symptoms will appear here before submission.")}
                    reviewText={label("review", "Review")}
                    items={selectedSymptomNames}
                  />

                  <div className="rounded-2xl border border-slate-200/85 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-obsidian-950/50 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                        <DiagIcon name="fa-robot" className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {label("diagnosisMode", "Diagnosis Engine")}
                        </p>
                        <h3 className="break-words font-display text-base font-bold text-slate-900 dark:text-white">
                          {label("ruleBasedAnalysis", "Rule-based expert analysis")}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {isKhmer
                        ? "ប្រព័ន្ធនឹងវិភាគដំណាំ រោគសញ្ញា កំណត់ចំណាំ និងរូបភាពរបស់អ្នក ដើម្បីផ្តល់លទ្ធផលជំងឺ និងវិធីព្យាបាល។"
                        : "Our expert rule engine evaluates your selected crop, observed symptoms, and any field image to produce a ranked treatment plan."}
                    </p>
                  </div>
                </div>
              </StepCard>
              </div>

              <div className="min-w-0 space-y-5 sm:space-y-6">
                <StepCard
                  eyebrow={label("step4", "Step 4 · Context")}
                  title={label("freeTextNotes", "Additional Notes")}
                  description={label("freeTextNotesDesc", "Optional field notes add helpful weather, soil, or irrigation context.")}
                  aside={
                    <span className="font-mono text-[11px] text-slate-400">
                      {freeTextNotes.length} / 1000
                    </span>
                  }
                >
                  <textarea
                    name="free_text_notes"
                    value={freeTextNotes}
                    onChange={(event) => setFreeTextNotes(event.target.value)}
                    rows={5}
                    maxLength={1000}
                    className="diag-input min-h-[140px] resize-y text-xs leading-relaxed"
                    placeholder={label("freeTextNotesPlaceholder", "Add growth stage, weather conditions, irrigation issues, or anything unusual you noticed in the field.")}
                  />
                </StepCard>

                <StepCard
                  eyebrow={label("imageUpload", "Image Upload")}
                  title={bootstrap.fieldImageLabel || label("fieldImage", "Field image")}
                  description={label(
                    "imageUploadManualDesc",
                    "Upload an optional field photo to attach to your diagnosis record.",
                  )}
                >
                  <div className="space-y-4">
                    {/* Hidden real file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="field-image-input"
                      name="field_image"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />

                    {/* Drop Zone / Preview Area */}
                    <div
                      className={cn(
                        "relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300",
                        isDragOver
                          ? "scale-[1.01] border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                          : fieldImagePreview
                            ? "border-slate-200 bg-transparent dark:border-slate-800"
                            : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-emerald-950/10",
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDropZone}
                      role="button"
                      aria-label="Upload image"
                    >
                      {fieldImagePreview ? (
                        <>
                          <img
                            src={fieldImagePreview}
                            alt="Field preview"
                            className="block max-h-[320px] min-h-[180px] w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearFieldImage();
                            }}
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-xs text-white transition-colors hover:bg-red-600"
                            title="Remove image"
                          >
                            <DiagIcon name="fa-times" className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center transition-all">
                          <div
                            className={cn(
                              "flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
                              isDragOver
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500",
                            )}
                          >
                            <DiagIcon
                              name={isDragOver ? "fa-cloud-upload-alt" : "fa-image"}
                              className="h-7 w-7"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {isDragOver
                                ? isKhmer
                                  ? "ទម្លាក់រូបភាពនៅទីនេះ"
                                  : "Drop image here"
                                : isKhmer
                                  ? "ចុច ឬ អូសរូបភាពដើម្បីបញ្ចូល"
                                  : "Click or drag & drop an image"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {isKhmer ? "PNG, JPG, WEBP · អតិបរមា 5MB" : "PNG, JPG, WEBP · Max 5 MB"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="diag-secondary-button"
                      >
                        <DiagIcon name="fa-upload" className="h-4 w-4" />
                        {isKhmer ? "ជ្រើសរើសរូបភាព" : "Choose image"}
                      </button>
                    </div>
                  </div>
                </StepCard>
              </div>
            </div>
          ) : null}

          <div className="diag-panel px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 font-mono font-bold text-slate-700 dark:bg-obsidian-800 dark:text-slate-200">
                  {currentStep} / {steps.length}
                </span>
                <span>
                  {currentStep < 4
                    ? isKhmer
                      ? "ជ្រើសរើសតាមលំដាប់ រួចចុច បន្ទាប់ ដើម្បីវិភាគ។"
                      : "Progress is preserved between steps until you submit."
                    : isKhmer
                      ? "ត្រួតពិនិត្យព័ត៌មានរួចរាល់ ហើយចុច វិនិច្ឆ័យឥឡូវនេះ។"
                      : "Ready to run the agronomy rule engine on your selected case."}
                </span>
              </div>

              <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto sm:flex-wrap">
                <button
                  type="button"
                  onClick={goBack}
                  className="diag-secondary-button h-10 flex-1 justify-center px-4 sm:flex-initial"
                  disabled={currentStep === 1 || submitting}
                >
                  <DiagIcon name="fa-arrow-left" className="h-3.5 w-3.5" />
                  <span>{label("back", "Back")}</span>
                </button>

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="diag-primary-button h-10 flex-1 justify-center px-5 sm:flex-initial"
                    disabled={submitting}
                  >
                    <span>{label("next", "Next")}</span>
                    <DiagIcon name="fa-arrow-right" className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="diag-primary-button h-10 flex-1 justify-center px-5 sm:flex-initial sm:px-6"
                    disabled={submitting}
                  >
                    <DiagIcon
                      name={submitting ? "fa-circle-notch" : "fa-stethoscope"}
                      className={cn("h-4 w-4", submitting && "animate-spin")}
                    />
                    <span>{submitting ? label("analyzing", "Analyzing...") : label("diagnoseNow", "Diagnose now")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
