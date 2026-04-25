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
    if (!id || !name || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, name });
  });

  return rows.sort((left, right) => left.name.localeCompare(right.name));
}

function doesCropMatchContext(crop, domainId, subcategoryId) {
  if (!crop) return false;
  const matchDomain = !domainId || String(crop.domainId || "") === String(domainId);
  const matchSubcategory = !subcategoryId || String(crop.subcategoryId || "") === String(subcategoryId);
  return matchDomain && matchSubcategory;
}

function CropCard({ crop, selected, onSelect, subtitle }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("diag-choice-card", selected && "diag-choice-card-selected")}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-slate-900">{crop.name}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border text-sm transition-all duration-200",
            selected
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-slate-50 text-slate-400",
          )}
        >
          <i className={`fas ${selected ? "fa-check" : "fa-seedling"}`} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {titleFromSlug(crop.subcategoryId, "General")}
        </span>
        <span className="text-xs font-semibold text-emerald-700">
          {selected ? "Selected" : "Choose crop"}
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
          <p className="text-base font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-all duration-200",
            selected
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-slate-50 text-slate-400",
          )}
        >
          <i className={`fas ${selected ? "fa-check" : "fa-leaf"}`} aria-hidden="true" />
        </div>
      </div>
    </button>
  );
}

function ReviewList({ title, items, emptyText, icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <i className={`fas ${icon}`} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Review
          </p>
          <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
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
        <p className="mt-4 text-sm text-slate-500">{emptyText}</p>
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

  const [currentStep, setCurrentStep] = useState(1);
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
  const [cameraDevices, setCameraDevices] = useState([]);
  const [activeCameraDeviceId, setActiveCameraDeviceId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("");

  const deferredCropSearch = useDeferredValue(cropSearch);
  const deferredSymptomSearch = useDeferredValue(symptomSearch);

  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const steps = [
    {
      id: "crop",
      label: "Select Crop Type",
      description: "Choose the crop you want to diagnose.",
    },
    {
      id: "context",
      label: "Select Category / Growth Stage",
      description: "Refine the diagnosis context before symptoms are shown.",
    },
    {
      id: "symptoms",
      label: "Select Symptoms",
      description: "Pick only the symptoms that match what you observe.",
    },
    {
      id: "review",
      label: "Review + Submit",
      description: "Review the case, add notes or an image, and submit.",
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
    return normalizeText(symptom.name).includes(keyword);
  });
  const currentSymptomLookup = new Map(currentSymptoms.map((item) => [String(item.id), item.name]));
  const fallbackSymptomLookup = new Map(
    getSymptomsForCrop(0, symptomsByCrop).map((item) => [String(item.id), item.name]),
  );

  const selectedCrop = crops.find((item) => String(item.id) === String(selectedCropId)) || null;
  const selectedCropLabel = selectedCrop?.name || label("selectCrop", "Select crop");
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
      } else {
        setCameraStatus(label("scanSuggestionNone", "No confident symptom suggestions were found."));
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

    if (nextFile) {
      setCameraStatus(label("cameraCaptured", "Image added to this diagnosis."));
      if (scanMode && selectedCropId && scanSuggestionApi) {
        analyzeScanImage(nextFile);
      }
    } else {
      setCameraStatus("");
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

    if (!selectedSymptoms.length) {
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
    if (instantScanMode && currentStep === 4 && !fieldImage && hasSecureCameraContext() && hasLiveCameraSupport()) {
      openLiveCamera(activeCameraDeviceId);
    }
  }, [instantScanMode, currentStep]);

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
        <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-lime-100/80 blur-3xl" />

        <div className="diag-panel relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-600 to-green-700 px-5 py-6 text-white md:px-7 md:py-7">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_60%)] md:block" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                  AI-Powered Expert System
                </span>
                {scanMode ? (
                  <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">
                    {instantScanMode ? "Instant scan mode" : "Scan-assisted mode"}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
                {bootstrap.pageTitle || "Guided crop diagnosis"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/90 md:text-base">
                {bootstrap.pageSubtitle || "Move step by step through crop selection, context, symptoms, and review for a cleaner expert system workflow."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href={bootstrap.dashboardUrl} className="diag-secondary-button border-white/20 bg-white/10 text-white hover:border-white/35 hover:bg-white/15 hover:text-white">
                <i className="fas fa-arrow-left" aria-hidden="true" />
                {label("back", "Back")}
              </a>
              {bootstrap.chatUrl ? (
                <a href={bootstrap.chatUrl} className="diag-secondary-button border-white/20 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                  <i className="fas fa-user-md" aria-hidden="true" />
                  Ask Expert
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

          <Stepper steps={steps} currentStep={currentStep} />

          {formError ? (
            <div className="diag-panel border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 md:px-6">
              <div className="flex items-start gap-3">
                <i className="fas fa-exclamation-circle mt-0.5 text-red-500" aria-hidden="true" />
                <div>
                  <p className="font-semibold">We need one quick fix before continuing.</p>
                  <p className="mt-1">{formError}</p>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <StepCard
              eyebrow="Step 1"
              title="Select Crop Type"
              description="Pick the crop you want the expert system to evaluate. Crop cards replace the long select field and keep the flow focused."
              aside={
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <div className="font-semibold">Current context</div>
                  <div className="mt-1">{selectedSubcategoryId ? selectedTypeLabel : "All crop groups"}</div>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Selection
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="diag-chip">{selectedCrop ? selectedCrop.name : "No crop selected yet"}</span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {selectedTypeLabel}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <label htmlFor="crop-search" className="text-sm font-semibold text-slate-900">
                      Search crops
                    </label>
                    <input
                      id="crop-search"
                      type="text"
                      value={cropSearch}
                      onChange={(event) => setCropSearch(event.target.value)}
                      className="diag-input mt-3"
                      placeholder="Search by crop name"
                    />
                    <p className="mt-3 text-xs leading-6 text-slate-500">
                      Showing crops that match the current category filter.
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
                        subtitle={pickLabel(
                          subcategories.find((item) => String(item.id) === String(crop.subcategoryId)),
                          isKhmer,
                          titleFromSlug(crop.subcategoryId, "General crop"),
                        )}
                        onSelect={() => {
                          setSelectedCropId(String(crop.id));
                          setFormError("");
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <i className="fas fa-seedling text-xl" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-display text-xl font-bold text-slate-900">
                      No crops match this filter
                    </h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">
                      Adjust the category in Step 2 or clear your crop search to see more options.
                    </p>
                  </div>
                )}
              </div>
            </StepCard>
          ) : null}

          {currentStep === 2 ? (
            <StepCard
              eyebrow="Step 2"
              title="Select Category / Growth Stage"
              description="Keep the diagnosis context aligned before symptoms are shown. This step filters the crop list and keeps the symptom set relevant."
              aside={
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div className="font-semibold text-slate-900">Selected crop</div>
                  <div className="mt-1">{selectedCropLabel}</div>
                </div>
              }
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {label("category", "Category")}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the broader diagnosis category available in the current data model.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {(agriDomains.length ? agriDomains : [{ id: "", label: label("general", "General") }]).map((domain) => (
                      <ContextCard
                        key={domain.id || "general-domain"}
                        label={pickLabel(domain, isKhmer, "General")}
                        description="Used to keep crop and diagnosis context aligned."
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
                  <h3 className="text-base font-semibold text-slate-900">{label("type", "Type")}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the crop group or stage context that best matches this case.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <ContextCard
                      label={label("general", "General")}
                      description="Keep the crop list open across all available groups."
                      selected={!selectedSubcategoryId}
                      onSelect={() => {
                        setSelectedSubcategoryId("");
                        setFormError("");
                      }}
                    />
                    {subcategories.map((subcategory) => (
                      <ContextCard
                        key={subcategory.id}
                        label={pickLabel(subcategory, isKhmer, titleFromSlug(subcategory.id))}
                        description="Filters crop options and keeps symptoms targeted."
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
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                    <div className="flex items-start gap-3">
                      <i className="fas fa-info-circle mt-0.5 text-amber-500" aria-hidden="true" />
                      <p>{contextNotice}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                    Symptoms in the next step will be based on the selected crop and the context confirmed here.
                  </div>
                )}
              </div>
            </StepCard>
          ) : null}

          {currentStep === 3 ? (
            <StepCard
              eyebrow="Step 3"
              title="Select Symptoms"
              description="Choose the symptoms you actually see in the field. Each symptom behaves like a selectable card for faster expert-system input."
              aside={
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <div className="font-semibold">
                    {formatTemplate(
                      label("selectedCount", "{count} selected"),
                      { count: selectedSymptoms.length },
                      "{count} selected",
                    )}
                  </div>
                  <div className="mt-1">{selectedCropLabel}</div>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <label htmlFor="symptom-search" className="text-sm font-semibold text-slate-900">
                      {label("searchSymptom", "Search symptom")}
                    </label>
                    <input
                      id="symptom-search"
                      type="text"
                      value={symptomSearch}
                      onChange={(event) => setSymptomSearch(event.target.value)}
                      className="diag-input mt-3"
                      placeholder="Search relevant symptoms"
                    />
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Selected summary</p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">
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
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <i className="fas fa-stethoscope text-xl" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-display text-xl font-bold text-slate-900">
                      {currentSymptoms.length
                        ? label("noSymptomsMatch", "No symptoms match your search.")
                        : label("noSymptoms", "No symptoms are available for this crop.")}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">
                      {currentSymptoms.length
                        ? "Try a different keyword or clear the search field."
                        : "Go back and choose another crop or category to load a different symptom set."}
                    </p>
                  </div>
                )}
              </div>
            </StepCard>
          ) : null}

          {currentStep === 4 ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <StepCard
                eyebrow="Step 4"
                title="Review + Submit"
                description="Review the diagnosis context, confirm the symptoms, and send the case for rule-based analysis."
              >
                <div className="space-y-5">
                  <ReviewList
                    title="Selection"
                    icon="fa-seedling"
                    emptyText="Complete the earlier steps to review the crop context here."
                    items={[
                      selectedCrop ? `Crop: ${selectedCrop.name}` : "",
                      selectedDomainId
                        ? `${label("category", "Category")}: ${pickLabel(currentDomain, isKhmer, "General")}`
                        : "",
                      `${label("type", "Type")}: ${selectedTypeLabel}`,
                    ].filter(Boolean)}
                  />

                  <ReviewList
                    title="Symptoms"
                    icon="fa-notes-medical"
                    emptyText="Selected symptoms will appear here before submission."
                    items={selectedSymptomNames}
                  />

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <i className="fas fa-robot" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Diagnosis mode
                        </p>
                        <h3 className="font-display text-lg font-bold text-slate-900">
                          Rule-based expert analysis
                        </h3>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      The form will submit the same crop, symptom, notes, and image fields already used by the current backend logic. Only the frontend experience has changed.
                    </p>
                  </div>
                </div>
              </StepCard>

              <div className="space-y-6">
                <StepCard
                  eyebrow="Additional Notes"
                  title={label("freeTextNotes", "Additional Notes")}
                  description="Optional notes can give extra field context without changing the rule engine."
                >
                  <textarea
                    name="free_text_notes"
                    value={freeTextNotes}
                    onChange={(event) => setFreeTextNotes(event.target.value)}
                    rows={6}
                    maxLength={1000}
                    className="diag-input min-h-40 resize-none"
                    placeholder="Add growth stage, weather conditions, irrigation issues, or anything unusual you noticed in the field."
                  />
                </StepCard>

                <StepCard
                  eyebrow="Image Upload"
                  title={bootstrap.fieldImageLabel || label("fieldImage", "Field image")}
                  description={scanMode
                    ? "Upload or capture a field image. Scan mode can suggest symptoms automatically."
                    : "Upload an optional field image to keep the diagnosis record complete."}
                >
                  <div className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="field-image-input"
                      name="field_image"
                      accept="image/*"
                      capture={scanMode ? "environment" : undefined}
                      required={scanMode}
                      onChange={handleFileInputChange}
                      className="diag-upload-input"
                    />

                    <p className="text-xs leading-6 text-slate-500">
                      {label("maxUploadSize", "Upload a clear image for the best result.")}
                    </p>

                    {fieldImagePreview ? (
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <img
                          src={fieldImagePreview}
                          alt="Field preview"
                          className="h-64 w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                        {scanMode
                          ? "No field image added yet. You can upload a file or use the live camera tools below."
                          : "No image added yet. This section is optional for manual diagnosis."}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {fieldImage ? (
                        <button type="button" onClick={clearFieldImage} className="diag-secondary-button">
                          <i className="fas fa-times" aria-hidden="true" />
                          Remove image
                        </button>
                      ) : null}

                      {scanMode && fieldImage ? (
                        <button
                          type="button"
                          onClick={() => analyzeScanImage()}
                          className="diag-secondary-button border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          disabled={scanAnalyzing}
                        >
                          <i
                            className={`fas ${scanAnalyzing ? "fa-circle-notch animate-spin" : "fa-search"}`}
                            aria-hidden="true"
                          />
                          {scanAnalyzing
                            ? label("scanAnalyzing", "Analyzing...")
                            : label("analyzeScan", "Analyze scan")}
                        </button>
                      ) : null}
                    </div>

                    {scanMode ? (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-col gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                              Live Camera
                            </p>
                            <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                              Capture from device camera
                            </h3>
                            <p className="mt-2 text-sm leading-7 text-slate-500">
                              Open the camera, capture a field image, then let the scan helper suggest symptoms.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => openLiveCamera(activeCameraDeviceId)} className="diag-primary-button">
                              <i className="fas fa-video" aria-hidden="true" />
                              {label("cameraOpen", "Open camera")}
                            </button>
                            <button type="button" onClick={stopLiveCamera} className="diag-secondary-button">
                              <i className="fas fa-stop-circle" aria-hidden="true" />
                              {label("cameraStop", "Stop camera")}
                            </button>
                            <button
                              type="button"
                              onClick={captureFromLiveCamera}
                              className="diag-secondary-button border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              disabled={!cameraOpen}
                            >
                              <i className="fas fa-camera" aria-hidden="true" />
                              {label("cameraCapture", "Capture")}
                            </button>
                          </div>

                          {cameraDevices.length > 1 ? (
                            <select
                              value={activeCameraDeviceId}
                              onChange={(event) => {
                                const nextDeviceId = event.target.value;
                                setActiveCameraDeviceId(nextDeviceId);
                                if (cameraOpen) {
                                  openLiveCamera(nextDeviceId);
                                }
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

                          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900">
                            {cameraOpen ? (
                              <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="h-64 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-slate-300">
                                {hasSecureCameraContext()
                                  ? label("cameraReady", "Open the camera to capture a live field image.")
                                  : label("cameraSecureContext", "Camera access requires HTTPS or localhost.")}
                              </div>
                            )}
                          </div>

                          {cameraStatus ? (
                            <p className="text-sm text-slate-600">{cameraStatus}</p>
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
              <div className="text-sm text-slate-500">
                {currentStep < 4
                  ? "Progress is saved in the current form state until you submit."
                  : "Submitting will use the existing diagnosis endpoint and rule engine unchanged."}
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
                    Next
                    <i className="fas fa-arrow-right" aria-hidden="true" />
                  </button>
                ) : (
                  <button type="submit" className="diag-primary-button" disabled={submitting}>
                    <i
                      className={`fas ${submitting ? "fa-circle-notch animate-spin" : "fa-stethoscope"}`}
                      aria-hidden="true"
                    />
                    {submitting ? "Analyzing..." : label("diagnoseNow", "Diagnose now")}
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
