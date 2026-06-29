import { useDeferredValue, useEffect, useRef, useState } from "react";

import StepCard from "./components/StepCard";
import Stepper from "./components/Stepper";
import SymptomCard from "./components/SymptomCard";

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u1780-\u17ff\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromSlug(value, fallback = "General") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickLabel(item, isKhmer, fallback) {
  if (!item || typeof item !== "object") return fallback;
  const kh = String(item.label_kh || "").trim();
  const en = String(item.label || "").trim();
  if (isKhmer) return kh || en || fallback;
  return en || kh || fallback;
}

function formatTemplate(template, values, fallback) {
  const source = String(template || fallback || "").trim();
  if (!source) return "";
  return source.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return String(values[key]);
    }
    return match;
  });
}

function getSymptomsForCrop(cropId, symptomsByCrop) {
  const specific = symptomsByCrop?.[String(cropId)] || symptomsByCrop?.[cropId] || [];
  const fallback = symptomsByCrop?.["0"] || symptomsByCrop?.[0] || [];
  const source = Array.isArray(specific) && specific.length ? specific : fallback;
  const rows = [];
  const seen = new Set();

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

function doesCropMatchContext(crop, domainId, subcategoryId) {
  if (!crop) return false;
  const matchDomain = !domainId || String(crop.domainId || "") === String(domainId);
  const matchSubcategory = !subcategoryId || String(crop.subcategoryId || "") === String(subcategoryId);
  return matchDomain && matchSubcategory;
}

function groupSymptoms(symptoms) {
  const categories = [
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

function CropCard({ crop, selected, onSelect, subtitle, isKhmer, selectedText, chooseCropText, generalText }) {
  const cropName = isKhmer && crop.name_kh ? crop.name_kh : crop.name;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("diag-choice-card", selected && "diag-choice-card-selected")}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white">{cropName}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border text-sm transition-all duration-200",
            selected
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500",
          )}
        >
          <i className={`fas ${selected ? "fa-check" : "fa-seedling"}`} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
          {titleFromSlug(crop.subcategoryId, generalText)}
        </span>
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {selected ? selectedText : chooseCropText}
        </span>
      </div>
    </button>
  );
}

function ContextCard({ label, description, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("diag-choice-card", selected && "diag-choice-card-selected")}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-white">{label}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-all duration-200",
            selected
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500",
          )}
        >
          <i className={`fas ${selected ? "fa-check" : "fa-leaf"}`} aria-hidden="true" />
        </div>
      </div>
    </button>
  );
}

function ReviewList({ title, items, emptyText, icon, reviewText }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          <i className={`fas ${icon}`} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {reviewText}
          </p>
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
      </div>
      {items.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="diag-chip">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

export default function DiagnosisWizardPage({ bootstrap }) {
  const labels = bootstrap?.labels || {};
  const crops = Array.isArray(bootstrap?.crops) ? bootstrap.crops : [];
  const agriDomains = Array.isArray(bootstrap?.agriDomains) ? bootstrap.agriDomains : [];
  const symptomsByCrop = bootstrap?.symptomsByCrop && typeof bootstrap.symptomsByCrop === "object"
    ? bootstrap.symptomsByCrop
    : {};
  const domainDefaultDiagnosisCategory = bootstrap?.domainDefaultDiagnosisCategory
    && typeof bootstrap.domainDefaultDiagnosisCategory === "object"
    ? bootstrap.domainDefaultDiagnosisCategory
    : {};
  const initialCropId = String(bootstrap?.initialCropId || "").trim();
  const initialCrop = crops.find((item) => String(item.id) === initialCropId) || null;
  const isKhmer = String(bootstrap?.currentLang || "").toLowerCase().startsWith("km");
  const scanMode = Boolean(bootstrap?.scanMode);
  const instantScanMode = Boolean(bootstrap?.instantScanMode);
  const scanSuggestionApi = String(bootstrap?.scanSuggestionApi || "").trim();

  const [currentStep, setCurrentStep] = useState(scanMode ? 4 : 1);
  const [selectedDomainId, setSelectedDomainId] = useState(
    String(initialCrop?.domainId || agriDomains?.[0]?.id || ""),
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(
    String(initialCrop?.subcategoryId || ""),
  );
  const [selectedCropId, setSelectedCropId] = useState(initialCropId);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [cropSearch, setCropSearch] = useState("");
  const [symptomSearch, setSymptomSearch] = useState("");
  const [freeTextNotes, setFreeTextNotes] = useState("");
  const [fieldImage, setFieldImage] = useState(null);
  const [fieldImagePreview, setFieldImagePreview] = useState("");
  const [formError, setFormError] = useState("");
  const [contextNotice, setContextNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanAnalyzing, setScanAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { count, notes, confidence }
  const [isDragOver, setIsDragOver] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [activeCameraDeviceId, setActiveCameraDeviceId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("");

  const [questionnaireActive, setQuestionnaireActive] = useState(true);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [categoryAnswers, setCategoryAnswers] = useState({});
  const [liveSuspects, setLiveSuspects] = useState([]);
  const [liveBestMatch, setLiveBestMatch] = useState(null);
  const [evaluatingLive, setEvaluatingLive] = useState(false);
  const [deniedSymptoms, setDeniedSymptoms] = useState([]);

  const deferredCropSearch = useDeferredValue(cropSearch);
  const deferredSymptomSearch = useDeferredValue(symptomSearch);

  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
    .filter((crop) => doesCropMatchContext(crop, selectedDomainId, selectedSubcategoryId))
    .filter((crop) => {
      const keyword = normalizeText(deferredCropSearch);
      if (!keyword) return true;
      return normalizeText(crop.name).includes(keyword);
    });

  const currentSymptoms = getSymptomsForCrop(selectedCropId, symptomsByCrop);
  const allVisibleSymptoms = currentSymptoms.filter((symptom) => {
    const keyword = normalizeText(deferredSymptomSearch);
    if (!keyword) return true;
    const name = isKhmer && symptom.name_kh ? symptom.name_kh : symptom.name;
    return normalizeText(name).includes(keyword);
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

  function label(key, fallback) {
    const value = String(labels[key] || "").trim();
    return value || fallback;
  }

  function setErrorAndStay(message, stepNumber) {
    setFormError(message);
    setCurrentStep(stepNumber);
  }

  function syncFileInput(file) {
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

  function hasLiveCameraSupport() {
    return Boolean(
      navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === "function"
      && typeof navigator.mediaDevices.enumerateDevices === "function",
    );
  }

  function hasSecureCameraContext() {
    if (window.isSecureContext) return true;
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function stopLiveCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          // Ignore camera shutdown failures while releasing the stream.
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  }

  async function loadCameraDevices() {
    if (!hasLiveCameraSupport()) {
      setCameraDevices([]);
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device?.kind === "videoinput");
      setCameraDevices(cameras);
      if (!activeCameraDeviceId && cameras[0]?.deviceId) {
        setActiveCameraDeviceId(cameras[0].deviceId);
      }
      return cameras;
    } catch (error) {
      setCameraDevices([]);
      return [];
    }
  }

  function setFieldImageFile(nextFile) {
    setFieldImage(nextFile || null);
    syncFileInput(nextFile || null);
    setFormError("");
  }

  async function openLiveCamera(preferredDeviceId = "") {
    if (!hasSecureCameraContext()) {
      setCameraStatus(label("cameraSecureContext", "Camera access requires HTTPS or localhost."));
      return;
    }

    if (!hasLiveCameraSupport()) {
      setCameraStatus(label("cameraUnsupported", "Live camera is not supported on this browser."));
      return;
    }

    stopLiveCamera();

    const buildConstraints = (deviceId) => {
      const video = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      if (deviceId) {
        video.deviceId = { exact: deviceId };
      } else {
        video.facingMode = { ideal: "environment" };
      }
      return { video, audio: false };
    };

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(buildConstraints(preferredDeviceId));
      } catch (error) {
        stream = await navigator.mediaDevices.getUserMedia(buildConstraints(""));
      }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      const settings = track && typeof track.getSettings === "function" ? track.getSettings() : {};
      const nextDeviceId = String(settings.deviceId || preferredDeviceId || "");
      setActiveCameraDeviceId(nextDeviceId);
      setCameraOpen(true);
      setCameraStatus(label("cameraReady", "Camera is ready."));
      await loadCameraDevices();
    } catch (error) {
      setCameraStatus(label("cameraUnavailable", "Unable to access the camera right now."));
      stopLiveCamera();
    }
  }

  function clearFieldImage() {
    setFieldImageFile(null);
  }

  function captureFromLiveCamera() {
    if (!videoRef.current || !streamRef.current) return;

    const width = videoRef.current.videoWidth || 1280;
    const height = videoRef.current.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraStatus(label("cameraUnavailable", "Unable to capture the image."));
        return;
      }

      const capturedFile = new File(
        [blob],
        `diagnosis-scan-${Date.now()}.jpg`,
        { type: "image/jpeg" },
      );

      setFieldImageFile(capturedFile);
      stopLiveCamera();
      setCameraStatus(label("cameraCaptured", "Photo captured. Ready to analyze."));

      if (scanMode && selectedCropId && scanSuggestionApi) {
        analyzeScanImage(capturedFile);
      }
    }, "image/jpeg", 0.92);
  }

  function toggleSymptom(symptomId) {
    const nextId = String(symptomId);
    setSelectedSymptoms((current) => {
      if (current.includes(nextId)) {
        return current.filter((item) => item !== nextId);
      }
      return [...current, nextId];
    });
    setFormError("");
  }

  function handleCategoryAnswer(catId, answer) {
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

  function handleSymptomCheckboxToggle(symptomId) {
    const idStr = String(symptomId);
    setSelectedSymptoms((prev) => {
      if (prev.includes(idStr)) {
        return prev.filter((id) => id !== idStr);
      }
      return [...prev, idStr];
    });
  }

  function applySuggestedSymptoms(ids) {
    const availableIds = new Set(currentSymptoms.map((item) => String(item.id)));
    if (!availableIds.size) return 0;

    let added = 0;
    setSelectedSymptoms((current) => {
      const next = [...current];
      ids.forEach((rawId) => {
        const id = String(rawId || "").trim();
        if (!id || !availableIds.has(id) || next.includes(id)) return;
        next.push(id);
        added += 1;
      });
      return next;
    });
    return added;
  }

  async function analyzeScanImage(fileOverride = null) {
    const nextFile = fileOverride || fieldImage;
    if (!scanMode || !scanSuggestionApi || !nextFile || scanAnalyzing) {
      return;
    }

    if (!selectedCropId) {
      setErrorAndStay(label("pleaseSelectCrop", "Please select a crop before analyzing the image."), 1);
      return;
    }

    if (nextFile.type && !nextFile.type.startsWith("image/")) {
      setErrorAndStay(label("invalidImageType", "Please choose a valid image file."), 4);
      return;
    }

    const payload = new FormData();
    payload.append("crop_id", String(selectedCropId));
    payload.append("field_image", nextFile, nextFile.name || "field-scan.jpg");

    setScanAnalyzing(true);
    setCameraStatus(label("scanAnalyzing", "Analyzing image with the expert system..."));
    setScanResult(null);
    setFormError("");

    try {
      const response = await fetch(scanSuggestionApi, {
        method: "POST",
        body: payload,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || label("scanApiFailed", "Unable to analyze the scan image."));
      }

      const suggestedIds = Array.isArray(data.suggestions)
        ? data.suggestions
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
        : [];

      const added = applySuggestedSymptoms(suggestedIds);

      if (added > 0) {
        setCameraStatus(
          formatTemplate(
            label("scanSuggestionApplied", "Applied {count} symptom suggestions from the scan."),
            { count: added },
            "Applied {count} symptom suggestions from the scan.",
          ),
        );
        setScanResult({ count: added, notes: data.analysis || "", confidence: data.confidence || null });
      } else {
        setCameraStatus(label("scanSuggestionNone", "No confident symptom suggestions were found."));
        setScanResult({ count: 0, notes: data.analysis || "", confidence: data.confidence || null });
      }

      if (instantScanMode && suggestedIds.length && formRef.current) {
        setCameraStatus(label("scanAutoSubmitting", "Submitting the diagnosis automatically..."));
        if (typeof formRef.current.requestSubmit === "function") {
          formRef.current.requestSubmit();
        } else {
          formRef.current.submit();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : label("scanApiFailed", "Unable to analyze the scan image.");
      setFormError(message);
      setCameraStatus(message);
    } finally {
      setScanAnalyzing(false);
    }
  }

  function handleFileInputChange(event) {
    const nextFile = event.target.files && event.target.files.length ? event.target.files[0] : null;
    setFieldImage(nextFile || null);
    setFormError("");
    setScanResult(null);

    if (nextFile) {
      setCameraStatus(label("cameraCaptured", "Image added to this diagnosis."));
      if (scanMode && selectedCropId && scanSuggestionApi) {
        analyzeScanImage(nextFile);
      }
    } else {
      setCameraStatus("");
    }
  }

  function handleDropZone(event) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setFieldImageFile(file);
    setFormError("");
    setScanResult(null);
    setCameraStatus(label("cameraCaptured", "Image added to this diagnosis."));
    if (scanMode && selectedCropId && scanSuggestionApi) {
      analyzeScanImage(file);
    }
  }

  function validateStep(stepNumber) {
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

  function handleSubmit(event) {
    setFormError("");

    if (!selectedCropId) {
      event.preventDefault();
      setErrorAndStay(label("pleaseSelectCrop", "Please select a crop to continue."), 1);
      return;
    }

    if (!selectedSymptoms.length && !scanMode) {
      event.preventDefault();
      setErrorAndStay(label("pleaseSelectSymptom", "Select at least one symptom to continue."), 3);
      return;
    }

    if (scanMode && !fieldImage) {
      event.preventDefault();
      setErrorAndStay(label("scanImageRequired", "Please upload or capture an image for scan mode."), 4);
      return;
    }

    if (fieldImage?.type && !fieldImage.type.startsWith("image/")) {
      event.preventDefault();
      setErrorAndStay(label("invalidImageType", "Please choose a valid image file."), 4);
      return;
    }

    stopLiveCamera();
    setSubmitting(true);
  }

  useEffect(() => {
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
    loadCameraDevices();

    return () => {
      stopLiveCamera();
    };
  }, []);

  useEffect(() => {
    // In scan mode, auto-open camera when on step 4 and no image yet
    if (scanMode && currentStep === 4 && !fieldImage && hasSecureCameraContext() && hasLiveCameraSupport()) {
      openLiveCamera(activeCameraDeviceId);
    }
  }, [scanMode, currentStep]);
  const lastLiveEvalRef = useRef(null);

  const triggerLiveEvaluation = async (currentPos, currentNeg) => {
    if (!selectedCropId) return;

    const cacheKey = JSON.stringify({ pos: currentPos, neg: currentNeg });
    if (lastLiveEvalRef.current === cacheKey) return;
    lastLiveEvalRef.current = cacheKey;

    setEvaluatingLive(true);
    try {
      const response = await fetch("/api/diagnose/live-evaluation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": bootstrap?.csrfToken || "",
        },
        body: JSON.stringify({
          crop_id: selectedCropId,
          symptoms: currentPos,
          denied_symptoms: currentNeg,
          category: selectedDomainId,
        }),
      });

      const data = await response.json();
      if (data && data.ok) {
        setLiveSuspects(data.suspects || []);
        setLiveBestMatch(data.best || null);
      }
    } catch (e) {
      console.error("Live evaluation failed:", e);
    } finally {
      setEvaluatingLive(false);
    }
  };

  useEffect(() => {
    if (currentStep === 3) {
      triggerLiveEvaluation(selectedSymptoms, deniedSymptoms);
    }
  }, [selectedSymptoms, deniedSymptoms, currentStep]);
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        stopLiveCamera();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", stopLiveCamera);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", stopLiveCamera);
    };
  }, []);

  return (
    <div className={cn("mx-auto max-w-7xl font-body", isKhmer && "font-khmer")}>
      <div className="diag-shell">
        <div className="diag-panel relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-6 md:px-7 md:py-7">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {label("aiPoweredSystem", "AI-Powered Expert System")}
                </span>
                {scanMode ? (
                  <span className="rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {instantScanMode ? label("instantScanModeLabel", "Instant scan mode") : label("scanAssistedModeLabel", "Scan-assisted mode")}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl text-slate-900 dark:text-white">
                {bootstrap.pageTitle || label("pageTitle", "Guided crop diagnosis")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400 md:text-base">
                {bootstrap.pageSubtitle || label("guidedDiagnosisDescFallback", "Move step by step through crop selection, context, symptoms, and review for a cleaner expert system workflow.")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href={bootstrap.dashboardUrl} className="diag-secondary-button border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900">
                <i className="fas fa-arrow-left" aria-hidden="true" />
                {label("back", "Back")}
              </a>
              {bootstrap.chatUrl ? (
                <a href={bootstrap.chatUrl} className="diag-secondary-button border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <i className="fas fa-user-md" aria-hidden="true" />
                  {label("askExpert", "Ask Expert")}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <form
          ref={formRef}
          action={bootstrap.postUrl}
          method="POST"
          encType="multipart/form-data"
          onSubmit={handleSubmit}
          className="mt-6 space-y-6"
        >
          <input type="hidden" name="scan_mode" value={scanMode ? "1" : "0"} />
          <input type="hidden" name="instant_scan_mode" value={instantScanMode ? "1" : "0"} />
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
          />

          {formError ? (
            <div className="diag-panel border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-5 py-4 text-sm text-red-700 dark:text-red-400 md:px-6">
              <div className="flex items-start gap-3">
                <i className="fas fa-exclamation-circle mt-0.5 text-red-500 dark:text-red-400" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{label("formErrorTitle", "We need one quick fix before continuing.")}</p>
                  <p className="mt-1">{formError}</p>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <StepCard
              eyebrow={label("step1", "Step 1")}
              title={label("stepCropLabel", "Select Crop Type")}
              description={label("stepCropDesc", "Pick the crop you want the expert system to evaluate. Crop cards replace the long select field and keep the flow focused.")}
              aside={
                <div className="rounded-3xl border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <div className="font-semibold">{label("currentContext", "Current context")}</div>
                  <div className="mt-1">{selectedSubcategoryId ? selectedTypeLabel : label("allCropGroups", "All crop groups")}</div>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      {label("selection", "Selection")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="diag-chip">{selectedCrop ? (isKhmer && selectedCrop.name_kh ? selectedCrop.name_kh : selectedCrop.name) : label("noCropSelectedYet", "No crop selected yet")}</span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {selectedTypeLabel}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                    <label htmlFor="crop-search" className="text-sm font-semibold text-slate-900 dark:text-white">
                      {label("searchCrops", "Search crops")}
                    </label>
                    <input
                      id="crop-search"
                      type="text"
                      value={cropSearch}
                      onChange={(event) => setCropSearch(event.target.value)}
                      className="diag-input mt-3"
                      placeholder={label("searchByCropName", "Search by crop name")}
                    />
                    <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                      {label("showingMatchingCrops", "Showing crops that match the current category filter.")}
                    </p>
                  </div>
                </div>

                {filteredCrops.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-5 py-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
                      <i className="fas fa-seedling text-xl" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                      {label("noCropsMatch", "No crops match this filter")}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                      {label("noCropsMatchDesc", "Adjust the category in Step 2 or clear your crop search to see more options.")}
                    </p>
                  </div>
                )}
              </div>
            </StepCard>
          ) : null}

          {currentStep === 2 ? (
            <StepCard
              eyrow={label("step2", "Step 2")}
              title={label("stepContextLabel", "Select Category / Growth Stage")}
              description={label("stepContextDesc", "Keep the diagnosis context aligned before symptoms are shown. This step filters the crop list and keeps the symptom set relevant.")}
              aside={
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                  <div className="font-semibold text-slate-900 dark:text-white">{label("selectedCrop", "Selected crop")}</div>
                  <div className="mt-1">{selectedCropLabel}</div>
                </div>
              }
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {label("category", "Category")}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {label("categoryDesc", "Used to keep crop and diagnosis context aligned.")}
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {(agriDomains.length ? agriDomains : [{ id: "", label: label("general", "General") }]).map((domain) => (
                      <ContextCard
                        key={domain.id || "general-domain"}
                        label={pickLabel(domain, isKhmer, label("general", "General"))}
                        description={label("categoryDesc", "Used to keep crop and diagnosis context aligned.")}
                        selected={String(domain.id || "") === String(selectedDomainId || "")}
                        onSelect={() => {
                          setSelectedDomainId(String(domain.id || ""));
                          setFormError("");
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{label("type", "Type")}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {label("subcategoryDesc", "Filters crop options and keeps symptoms targeted.")}
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <ContextCard
                      label={label("general", "General")}
                      description={label("generalTypeDesc", "Keep the crop list open across all available groups.")}
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
                        description={label("subcategoryDesc", "Filters crop options and keeps symptoms targeted.")}
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
                  <div className="rounded-3xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-5 py-4 text-sm text-amber-800 dark:text-amber-400">
                    <div className="flex items-start gap-3">
                      <i className="fas fa-info-circle mt-0.5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                      <p>{contextNotice}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {label("contextStepHint", "Symptoms in the next step will be based on the selected crop and the context confirmed here.")}
                  </div>
                )}
              </div>
            </StepCard>
          ) : null}

          {currentStep === 3 ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Questionnaire / Checklist Panel */}
              <div className="space-y-6">
                {questionnaireActive ? (
                  /* Guided Questionnaire Mode */
                  (() => {
                    const activeCategories = groupSymptoms(currentSymptoms);
                    const currentCat = activeCategories[currentCategoryIndex];
                    
                    if (!currentCat) {
                      return (
                        <StepCard
                          eyebrow={label("step3", "Step 3")}
                          title={isKhmer ? "ការវិនិច្ឆ័យរហ័ស" : "Questionnaire Completed"}
                          description={isKhmer ? "អ្នកបានឆ្លើយសំណួរទាំងអស់រួចហើយ។ សូមបន្តទៅជំហានបន្ទាប់។" : "You have answered all general questions. Review your selection or proceed to Step 4."}
                        >
                          <div className="text-center py-6">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                              <i className="fas fa-check-double text-xl" />
                            </div>
                            <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
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
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setQuestionnaireActive(false)}
                              className="diag-secondary-button border-slate-200 dark:border-slate-800 text-xs px-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                              <i className="fas fa-list text-xs mr-1" />
                              {isKhmer ? "មើលបញ្ជី" : "Checklist Mode"}
                            </button>
                          </div>
                        }
                      >
                        <div className="space-y-6">
                          {/* Screening Question */}
                          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                              {isKhmer 
                                ? `តើអ្នកសង្កេតឃើញមាន រោគសញ្ញាណាមួយនៅលើ ${currentCat.name_kh} ដែរឬទេ?` 
                                : `Do you observe any symptoms on the ${currentCat.name_en}?`}
                            </h3>
                            
                            <div className="grid gap-3 grid-cols-3">
                              {/* YES option */}
                              <button
                                type="button"
                                onClick={() => handleCategoryAnswer(currentCat.id, "yes")}
                                className={cn(
                                  "flex flex-col items-center justify-center p-4 rounded-2xl border text-sm font-semibold transition-all duration-200",
                                  catAnswer === "yes"
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                                )}
                              >
                                <i className="fas fa-check-circle text-xl mb-2" />
                                {isKhmer ? "បាទ/ចាស (មាន)" : "Yes"}
                              </button>
                              
                              {/* NO option */}
                              <button
                                type="button"
                                onClick={() => handleCategoryAnswer(currentCat.id, "no")}
                                className={cn(
                                  "flex flex-col items-center justify-center p-4 rounded-2xl border text-sm font-semibold transition-all duration-200",
                                  catAnswer === "no"
                                    ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-400"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                                )}
                              >
                                <i className="fas fa-times-circle text-xl mb-2" />
                                {isKhmer ? "ទេ (គ្មាន)" : "No"}
                              </button>
                              
                              {/* UNSURE option */}
                              <button
                                type="button"
                                onClick={() => handleCategoryAnswer(currentCat.id, "unsure")}
                                className={cn(
                                  "flex flex-col items-center justify-center p-4 rounded-2xl border text-sm font-semibold transition-all duration-200",
                                  catAnswer === "unsure"
                                    ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                                )}
                              >
                                <i className="fas fa-question-circle text-xl mb-2" />
                                {isKhmer ? "មិនច្បាស់" : "Unsure"}
                              </button>
                            </div>
                          </div>

                          {/* Specific Checked Symptoms */}
                          {catAnswer === "yes" && (
                            <div className="space-y-4">
                              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                {isKhmer ? "ជ្រើសរើសរោគសញ្ញាជាក់លាក់ដែលអ្នកមើលឃើញ៖" : "Select all specific signs you see:"}
                              </p>
                              <div className="grid gap-4 md:grid-cols-2">
                                {categorySymptoms.map((symptom) => {
                                  const isSelected = selectedSymptoms.includes(String(symptom.id));
                                  return (
                                    <button
                                      key={symptom.id}
                                      type="button"
                                      onClick={() => handleSymptomCheckboxToggle(symptom.id)}
                                      className={cn(
                                        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
                                        isSelected
                                          ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/20"
                                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40"
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border mt-0.5",
                                          isSelected
                                            ? "border-emerald-600 bg-emerald-600 text-white"
                                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                                        )}
                                      >
                                        {isSelected && <i className="fas fa-check text-[10px]" />}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                          {isKhmer && symptom.name_kh ? symptom.name_kh : symptom.name}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                          {isKhmer ? "ចុចដើម្បីជ្រើសរើសសញ្ញានេះ" : "Click to select this sign"}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Questionnaire Navigation Footer */}
                          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900 pt-4 mt-6">
                            <button
                              type="button"
                              onClick={() => setCurrentCategoryIndex(prev => Math.max(0, prev - 1))}
                              className="diag-secondary-button"
                              disabled={currentCategoryIndex === 0}
                            >
                              <i className="fas fa-chevron-left" />
                              {isKhmer ? "ត្រឡប់ក្រោយ" : "Prev Question"}
                            </button>
                            
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {isKhmer 
                                ? `សំណួរទី ${currentCategoryIndex + 1} នៃ ${activeCategories.length}`
                                : `Question ${currentCategoryIndex + 1} of ${activeCategories.length}`}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (currentCategoryIndex < activeCategories.length - 1) {
                                  setCurrentCategoryIndex(prev => prev + 1);
                                } else {
                                  goNext();
                                }
                              }}
                              className="diag-primary-button"
                              disabled={!catAnswer}
                            >
                              {currentCategoryIndex < activeCategories.length - 1 
                                ? (isKhmer ? "សំណួរបន្ទាប់" : "Next Question")
                                : (isKhmer ? "បញ្ចប់ការឆ្លើយ" : "Finish & Review")}
                              <i className="fas fa-chevron-right" />
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
                    description={label("stepSymptomsDesc", "Choose the symptoms you actually see in the field. Each symptom behaves like a selectable card for faster expert-system input.")}
                    aside={
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setQuestionnaireActive(true)}
                          className="diag-primary-button border border-transparent text-xs px-3 py-1.5 rounded-xl"
                        >
                          <i className="fas fa-question-circle text-xs mr-1" />
                          {isKhmer ? "ប្តូរទៅរបៀបសំណួរ" : "Guided Mode"}
                        </button>
                      </div>
                    }
                  >
                    <div className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
                          <label htmlFor="symptom-search" className="text-sm font-semibold text-slate-900 dark:text-white">
                            {label("searchSymptom", "Search symptom")}
                          </label>
                          <input
                            id="symptom-search"
                            type="text"
                            value={symptomSearch}
                            onChange={(event) => setSymptomSearch(event.target.value)}
                            className="diag-input mt-3"
                            placeholder={label("searchSymptom", "Search symptom")}
                          />
                        </div>

                        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{label("selectedSummary", "Selected summary")}</p>
                          <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                            {selectedSymptomNames.length
                               ? selectedSymptomNames.slice(0, 5).join(", ")
                              : label("noManualSelectionYet", "No symptoms selected yet.")}
                          </p>
                        </div>
                      </div>

                      {allVisibleSymptoms.length ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {allVisibleSymptoms.map((symptom) => (
                            <SymptomCard
                              key={symptom.id}
                              symptom={symptom}
                              selected={selectedSymptoms.includes(String(symptom.id))}
                              onToggle={() => toggleSymptom(symptom.id)}
                              isKhmer={isKhmer}
                              selectedText={label("symptomSelectedHint", "Included in the diagnosis review.")}
                              unselectedText={label("symptomUnselectedHint", "Click to include this observed symptom.")}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-5 py-10 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
                            <i className="fas fa-stethoscope text-xl" aria-hidden="true" />
                          </div>
                          <h3 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                            {currentSymptoms.length
                              ? label("noSymptomsMatch", "No symptoms match your search.")
                              : label("noSymptoms", "No symptoms are available for this crop.")}
                          </h3>
                          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
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

              {/* Live Suspects Feedback Panel */}
              <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 h-fit shadow-panel">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {isKhmer ? "ការវិនិច្ឆ័យផ្ទាល់" : "Live suspects analysis"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isKhmer ? "ធ្វើបច្ចុប្បន្នភាពតាមចម្លើយរបស់អ្នក" : "Real-time updates based on answers"}
                    </p>
                  </div>
                  {evaluatingLive ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                      <i className="fas fa-spinner animate-spin text-sm" />
                    </div>
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>

                {liveSuspects.length > 0 ? (
                  <div className="space-y-4">
                    {/* Non-intrusive Suspicion summary */}
                    {liveBestMatch && (
                      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-400">
                        <p className="font-bold flex items-center gap-1.5 mb-1 text-sm">
                          <i className="fas fa-info-circle text-emerald-600 dark:text-emerald-400" />
                          {isKhmer ? "ការសន្និដ្ឋានបណ្តោះអាសន្ន" : "Top Suspected Disease"}
                        </p>
                        <p className="leading-5">
                          {isKhmer 
                            ? `យោងតាមចម្លើយរបស់អ្នក ប្រព័ន្ធសង្ស័យខ្ពស់លើជំងឺ៖ ${liveBestMatch.disease_name} (ភាពប្រាកដប្រជា ${liveBestMatch.confidence_percent}%)`
                            : `Based on current signals, the system strongly suspects: ${liveBestMatch.disease_name} (${liveBestMatch.confidence_percent}% confidence).`}
                        </p>
                      </div>
                    )}

                    {/* Suspect List */}
                    <div className="space-y-3">
                      {liveSuspects.slice(0, 3).map((suspect, idx) => {
                        const barColor = suspect.confidence_tier === "high" ? "bg-emerald-500" : suspect.confidence_tier === "medium" ? "bg-amber-500" : "bg-yellow-400";
                        return (
                          <div key={idx} className="rounded-2xl border border-slate-100 dark:border-slate-800/80 p-3 text-xs space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">
                                  {suspect.disease_name}
                                </p>
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {suspect.confidence_percent}%
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={cn("h-1.5 rounded-full transition-all duration-300", barColor)}
                                style={{ width: `${suspect.confidence_percent}%` }}
                              />
                            </div>

                            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                              {suspect.matched_symptoms?.length > 0 && (
                                <p className="line-clamp-2">
                                  <strong className="text-slate-700 dark:text-slate-300">{isKhmer ? "ត្រូវគ្នា៖" : "Matches:"} </strong> 
                                  {suspect.matched_symptoms.join(", ")}
                                </p>
                              )}
                              {suspect.missing_symptoms?.length > 0 && (
                                <p className="line-clamp-2">
                                  <strong className="text-slate-700 dark:text-slate-300">{isKhmer ? "មិនទាន់ឃើញ៖" : "Unconfirmed:"} </strong>
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
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    <i className="fas fa-microscope text-2xl mb-3 text-slate-300 dark:text-slate-700 animate-pulse" />
                    <p className="leading-5 px-4">
                      {isKhmer 
                        ? "កំពុងរង់ចាំការឆ្លើយតប... ការឆ្លើយតបរបស់អ្នកនឹងបង្ហាញលទ្ធផលវិនិច្ឆ័យនៅទីនេះភ្លាមៗ។"
                        : "Waiting for symptoms... Answering 'Yes' or 'No' will show suspect rules and probabilities here."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <StepCard
                eyebrow={label("step4", "Step 4")}
                title={label("stepReviewLabel", "Review + Submit")}
                description={label("stepReviewDesc", "Review the diagnosis context, confirm the symptoms, and send the case for rule-based analysis.")}
              >
                <div className="space-y-5">
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

                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                        <i className="fas fa-robot" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                          {label("diagnosisMode", "Diagnosis mode")}
                        </p>
                        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          {label("ruleBasedAnalysis", "Rule-based expert analysis")}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
                      {label("reviewModeDesc", "The form will submit the same crop, symptom, notes, and image fields already used by the current backend logic. Only the frontend experience has changed.")}
                    </p>
                  </div>
                </div>
              </StepCard>

              <div className="space-y-6">
                <StepCard
                  eyebrow={label("freeTextNotes", "Additional Notes")}
                  title={label("freeTextNotes", "Additional Notes")}
                  description={label("freeTextNotesDesc", "Optional notes can give extra field context without changing the rule engine.")}
                >
                  <textarea
                    name="free_text_notes"
                    value={freeTextNotes}
                    onChange={(event) => setFreeTextNotes(event.target.value)}
                    rows={6}
                    maxLength={1000}
                    className="diag-input min-h-40 resize-none"
                    placeholder={label("freeTextNotesPlaceholder", "Add growth stage, weather conditions, irrigation issues, or anything unusual you noticed in the field.")}
                  />
                </StepCard>

                <StepCard
                  eyebrow={label("imageUpload", "Image Upload")}
                  title={bootstrap.fieldImageLabel || label("fieldImage", "Field image")}
                  description={scanMode
                    ? label("imageUploadScanDesc", "Upload or capture a field image. Scan mode can suggest symptoms automatically.")
                    : label("imageUploadManualDesc", "Upload an optional field image to keep the diagnosis record complete.")}
                >
                  <div className="space-y-4">
                    {/* No-crop warning — shown when scan mode but no crop chosen yet */}
                    {scanMode && !selectedCropId && (
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm">
                        <i className="fas fa-exclamation-triangle mt-0.5 flex-shrink-0 text-amber-500" />
                        <div className="flex-1">
                          <p className="font-semibold text-amber-800 dark:text-amber-400">
                            {isKhmer ? "សូមជ្រើសរើសដំណាំមុន" : "Select a crop first"}
                          </p>
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                            {isKhmer ? "AI ត្រូវការដឹងពីប្រភេទដំណាំ ដើម្បីស្វែងរកសញ្ញាជំងឺបានត្រឹមត្រូវ" : "The AI needs to know your crop type to detect diseases accurately."}
                          </p>
                          <button
                            type="button"
                            onClick={() => { setFormError(""); setCurrentStep(1); }}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:no-underline"
                          >
                            <i className="fas fa-arrow-left" />
                            {isKhmer ? "ជ្រើសរើសដំណាំ" : "Go select a crop"}
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Hidden real file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="field-image-input"
                      name="field_image"
                      accept="image/*"
                      capture={scanMode ? "environment" : undefined}
                      required={scanMode}
                      onChange={handleFileInputChange}
                      className="hidden"
                    />

                    {/* Drop Zone / Preview Area */}
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer",
                        isDragOver
                          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 scale-[1.01]"
                          : fieldImagePreview
                          ? "border-slate-200 dark:border-slate-800 bg-transparent"
                          : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10",
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
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
                            style={{
                              display: "block",
                              width: "100%",
                              objectFit: "cover",
                              maxHeight: "60vw",
                              minHeight: "180px",
                            }}
                          />
                          {/* Scanning overlay */}
                          {scanAnalyzing && (
                            <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
                              {/* Scan corners */}
                              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                              {/* Sweep line */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  right: 0,
                                  height: "2px",
                                  background: "linear-gradient(90deg, transparent, #10b981, transparent)",
                                  animation: "scanSweep 1.8s ease-in-out infinite",
                                  boxShadow: "0 0 12px 4px rgba(16,185,129,0.5)",
                                }}
                              />
                              <div className="flex flex-col items-center gap-2 z-10">
                                <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                                  <i className="fas fa-search text-emerald-400 text-lg animate-pulse" />
                                </div>
                                <span className="text-white text-sm font-semibold">{isKhmer ? "កំពុងវិភាគ..." : "AI Scanning..."}</span>
                                <span className="text-emerald-400 text-xs">{isKhmer ? "ប្រព័ន្ធកំពុងស្វែងរកសញ្ញារោគ" : "Detecting crop symptoms"}</span>
                              </div>
                            </div>
                          )}
                          {/* Remove button overlay */}
                          {!scanAnalyzing && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); clearFieldImage(); setScanResult(null); }}
                              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-slate-900/70 text-white hover:bg-red-600 transition-colors flex items-center justify-center text-xs"
                              title="Remove image"
                            >
                              <i className="fas fa-times" />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center transition-all">
                          <div className={cn(
                            "h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                            isDragOver
                              ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600"
                              : "bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500",
                          )}>
                            <i className={cn("text-2xl fas", isDragOver ? "fa-cloud-upload-alt" : scanMode ? "fa-camera" : "fa-image")} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white text-sm">
                              {isDragOver
                                ? (isKhmer ? "ទម្លាក់រូបភាពនៅទីនេះ" : "Drop image here")
                                : (isKhmer ? "ចុច ឬ អូស​ Ảnh ​ដើម្បីបញ្ចូល" : "Click or drag & drop an image")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {isKhmer ? "PNG, JPG, WEBP · អតិបរមា 5MB" : "PNG, JPG, WEBP · Max 5 MB"}
                            </p>
                          </div>
                          {scanMode && (
                            <div className="mt-1 flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                              <i className="fas fa-magic" />
                              {isKhmer ? "AI នឹងស្វែងរកសញ្ញាជំងឺដោយស្វ័យប្រវត្តិ" : "AI will auto-detect symptoms"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scan result toast */}
                    {scanResult !== null && !scanAnalyzing && (
                      <div className={cn(
                        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-all",
                        scanResult.count > 0
                          ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400"
                          : "border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400",
                      )}>
                        <i className={cn(
                          "fas mt-0.5 flex-shrink-0",
                          scanResult.count > 0 ? "fa-check-circle text-emerald-600" : "fa-exclamation-triangle text-amber-500",
                        )} />
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {scanResult.count > 0
                              ? (isKhmer ? `AI រកឃើញ ${scanResult.count} សញ្ញារោគ` : `AI detected ${scanResult.count} symptom${scanResult.count > 1 ? "s" : ""} — applied automatically`)
                              : (isKhmer ? "AI មិនរកឃើញសញ្ញារោគច្បាស់លាស់" : "No confident symptoms detected — please select manually")}
                          </p>
                          {scanResult.notes ? (
                            <p className="text-xs opacity-80">{scanResult.notes}</p>
                          ) : null}
                          {scanResult.confidence ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              <i className="fas fa-signal" />
                              {isKhmer ? `ភាពប្រាកដ: ${scanResult.confidence}` : `Confidence: ${scanResult.confidence}`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="diag-secondary-button"
                      >
                        <i className="fas fa-upload" aria-hidden="true" />
                        {isKhmer ? "ជ្រើសរើស​ Ảnh" : "Choose image"}
                      </button>

                      {scanMode && fieldImage && !scanAnalyzing ? (
                        <button
                          type="button"
                          onClick={() => analyzeScanImage()}
                          className="diag-secondary-button border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-950/20"
                        >
                          <i className="fas fa-sync-alt" aria-hidden="true" />
                          {isKhmer ? "ស្កែននូបភាពម្ដងទៀត" : "Re-scan image"}
                        </button>
                      ) : null}

                      {scanAnalyzing ? (
                        <span className="diag-secondary-button border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 cursor-not-allowed opacity-70">
                          <i className="fas fa-circle-notch animate-spin" />
                          {isKhmer ? "កំពុងវិភាគ..." : "Analyzing..."}
                        </span>
                      ) : null}
                    </div>

                    {/* Live Camera Section (scan mode only) */}
                    {scanMode ? (
                      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 overflow-hidden">
                        {/* Camera header */}
                        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
                          <div className="h-9 w-9 rounded-xl bg-slate-900 dark:bg-slate-800 flex items-center justify-center text-white flex-shrink-0">
                            <i className="fas fa-camera text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                              {label("liveCamera", "Live Camera")}
                            </p>
                            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                              {label("captureFromDeviceCamera", "Capture from device camera")}
                            </h3>
                          </div>
                          {/* Camera status pill */}
                          <div className={cn(
                            "flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                            cameraOpen
                              ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                          )}>
                            <div className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              cameraOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
                            )} />
                            {cameraOpen ? (isKhmer ? "រស់" : "Live") : (isKhmer ? "បិទ" : "Off")}
                          </div>
                        </div>

                        {/* Video viewport — aspect-ratio keeps it visible on all screen sizes */}
                        <div className="relative bg-slate-900 w-full" style={{ aspectRatio: "16/9" }}>
                          {cameraOpen ? (
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              playsInline
                              style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                position: "absolute",
                                inset: 0,
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                              <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
                                <i className="fas fa-video-slash text-xl" />
                              </div>
                              <p className="text-sm text-slate-400">
                                {hasSecureCameraContext()
                                  ? label("cameraReady", "Open the camera to capture a live field image.")
                                  : label("cameraSecureContext", "Camera access requires HTTPS or localhost.")}
                              </p>
                            </div>
                          )}
                          {/* Viewfinder corners when camera is open */}
                          {cameraOpen && (
                            <>
                              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400/70 rounded-tl" />
                              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400/70 rounded-tr" />
                              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400/70 rounded-bl" />
                              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400/70 rounded-br" />
                            </>
                          )}
                        </div>

                        {/* Camera controls */}
                        <div className="p-4 space-y-3">
                          {cameraDevices.length > 1 ? (
                            <select
                              value={activeCameraDeviceId}
                              onChange={(event) => {
                                const nextDeviceId = event.target.value;
                                setActiveCameraDeviceId(nextDeviceId);
                                if (cameraOpen) openLiveCamera(nextDeviceId);
                              }}
                              className="diag-input"
                            >
                              {cameraDevices.map((device, index) => (
                                <option key={device.deviceId || index} value={device.deviceId || ""}>
                                  {device.label || `${label("cameraSwitch", "Camera")} ${index + 1}`}
                                </option>
                              ))}
                            </select>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {!cameraOpen ? (
                              <button type="button" onClick={() => openLiveCamera(activeCameraDeviceId)} className="diag-primary-button flex-1">
                                <i className="fas fa-video" aria-hidden="true" />
                                {label("cameraOpen", "Open camera")}
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={captureFromLiveCamera}
                                  className="diag-primary-button flex-1"
                                >
                                  <i className="fas fa-camera" aria-hidden="true" />
                                  {label("cameraCapture", "Capture")}
                                </button>
                                <button type="button" onClick={stopLiveCamera} className="diag-secondary-button">
                                  <i className="fas fa-stop-circle" aria-hidden="true" />
                                  {label("cameraStop", "Stop")}
                                </button>
                              </>
                            )}
                          </div>

                          {cameraStatus ? (
                            <div className={cn(
                              "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-medium",
                              scanResult?.count > 0
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400",
                            )}>
                              <i className={cn(
                                "fas flex-shrink-0",
                                scanAnalyzing ? "fa-circle-notch animate-spin" : scanResult?.count > 0 ? "fa-check-circle" : "fa-info-circle",
                              )} />
                              {cameraStatus}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </StepCard>
              </div>
            </div>
          ) : null}

          <div className="diag-panel px-5 py-4 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {currentStep < 4
                  ? label("progressSavedHint", "Progress is saved in the current form state until you submit.")
                  : label("submitEndpointHint", "Submitting will use the existing diagnosis endpoint and rule engine unchanged.")}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="diag-ghost-button"
                  disabled={currentStep === 1 || submitting}
                >
                  <i className="fas fa-arrow-left" aria-hidden="true" />
                  {label("back", "Back")}
                </button>

                {currentStep < 4 ? (
                  <button type="button" onClick={goNext} className="diag-primary-button" disabled={submitting}>
                    {label("next", "Next")}
                    <i className="fas fa-arrow-right" aria-hidden="true" />
                  </button>
                ) : (
                  <button type="submit" className="diag-primary-button" disabled={submitting}>
                    <i
                      className={`fas ${submitting ? "fa-circle-notch animate-spin" : "fa-stethoscope"}`}
                      aria-hidden="true"
                    />
                    {submitting ? label("analyzing", "Analyzing...") : label("diagnoseNow", "Diagnose now")}
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
