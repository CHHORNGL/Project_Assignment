(function () {
  const form = document.getElementById("simpleDiagnosisForm");
  if (!form) {
    return;
  }

  const data = window.SIMPLE_DIAGNOSIS_DATA || {};
  const agriDomains = Array.isArray(data.agriDomains) ? data.agriDomains : [];
  const symptomsByCrop = data.symptomsByCrop && typeof data.symptomsByCrop === "object"
    ? data.symptomsByCrop
    : {};
  const domainDefaultCategory = data.domainDefaultDiagnosisCategory
    && typeof data.domainDefaultDiagnosisCategory === "object"
    ? data.domainDefaultDiagnosisCategory
    : {};
  const labels = data.labels && typeof data.labels === "object" ? data.labels : {};
  const scanSuggestionApi = String(data.scanSuggestionApi || "").trim();
  const initialCropId = String(data.initialCropId || "").trim();
  const scanMode = Boolean(data.scanMode);
  const instantScanMode = Boolean(data.instantScanMode);

  const isKhmer = String(document.documentElement.lang || "")
    .toLowerCase()
    .startsWith("km");

  const domainSelect = document.getElementById("simpleDomainSelect");
  const subcategorySelect = document.getElementById("simpleSubcategorySelect");
  const cropSelect = document.getElementById("simpleCropSelect");

  const manualSearchInput = document.getElementById("simpleManualSearch");
  const manualList = document.getElementById("simpleManualList");
  const manualEmpty = document.getElementById("simpleManualEmpty");
  const manualSelectedSummary = document.getElementById("simpleManualSelectedSummary");
  const manualStats = document.getElementById("simpleManualStats");

  const selectedSymptomsInputs = document.getElementById("simpleSelectedSymptomsInputs");
  const deniedSymptomsInputs = document.getElementById("simpleDeniedSymptomsInputs");
  const clarificationPayloadInput = document.getElementById("simpleClarificationPayload");
  const clarificationCountInput = document.getElementById("simpleClarificationCount");
  const diagnosisCategoryInput = document.getElementById("simpleDiagnosisCategory");

  const imageInput = document.getElementById("simpleFieldImageInput");
  const formAlert = document.getElementById("simpleFormAlert");
  const cameraPanel = document.getElementById("simpleCameraPanel");
  const openCameraBtn = document.getElementById("simpleOpenCameraBtn");
  const stopCameraBtn = document.getElementById("simpleStopCameraBtn");
  const captureBtn = document.getElementById("simpleCaptureBtn");
  const retakeBtn = document.getElementById("simpleRetakeBtn");
  const cameraSelect = document.getElementById("simpleCameraSelect");
  const cameraVideo = document.getElementById("simpleCameraVideo");
  const cameraPreview = document.getElementById("simpleCameraPreview");
  const cameraEmpty = document.getElementById("simpleCameraEmpty");
  const cameraStatus = document.getElementById("simpleCameraStatus");
  const analyzeScanBtn = document.getElementById("simpleAnalyzeScanBtn");

  const manualSelectedSymptoms = new Set();
  let currentSymptoms = [];
  let liveCameraStream = null;
  let activeCameraDeviceId = "";
  let cameraPreviewObjectUrl = "";
  let scanAnalyzeInFlight = false;

  function formatLabel(template, values) {
    if (!template) {
      return "";
    }
    return String(template).replace(/\{(\w+)\}/g, function (match, key) {
      return key in values ? String(values[key]) : match;
    });
  }

  function toText(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function pickLabel(item, fallback) {
    if (!item || typeof item !== "object") {
      return fallback || "";
    }
    if (isKhmer) {
      return toText(item.label_kh, toText(item.label, fallback || ""));
    }
    return toText(item.label, toText(item.label_kh, fallback || ""));
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u1780-\u17ff\s]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setAlert(message) {
    if (!formAlert) {
      return;
    }
    if (!message) {
      formAlert.classList.add("d-none");
      formAlert.textContent = "";
      return;
    }
    formAlert.classList.remove("d-none");
    formAlert.textContent = message;
  }

  function setCameraStatus(message) {
    if (!cameraStatus) {
      return;
    }
    cameraStatus.textContent = String(message || "").trim();
  }

  function canAnalyzeScan() {
    if (!scanMode || !analyzeScanBtn || !scanSuggestionApi) {
      return false;
    }
    const selectedCrop = String(cropSelect ? cropSelect.value : "").trim();
    const file = readActiveFile();
    return Boolean(selectedCrop && file && (!file.type || file.type.indexOf("image/") === 0));
  }

  function refreshAnalyzeButtonState() {
    if (!analyzeScanBtn) {
      return;
    }
    analyzeScanBtn.disabled = scanAnalyzeInFlight || !canAnalyzeScan();
  }

  function hasLiveCameraSupport() {
    return Boolean(
      navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === "function"
      && typeof navigator.mediaDevices.enumerateDevices === "function",
    );
  }

  function hasSecureCameraContext() {
    if (window.isSecureContext) {
      return true;
    }
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function setLiveCameraVisible(isVisible) {
    if (cameraVideo) {
      cameraVideo.classList.toggle("d-none", !isVisible);
    }
    if (captureBtn) {
      captureBtn.disabled = !isVisible;
    }
    if (stopCameraBtn) {
      stopCameraBtn.disabled = !isVisible;
    }
    if (openCameraBtn) {
      openCameraBtn.classList.toggle("d-none", isVisible);
    }
  }

  function revokeCameraPreviewUrl() {
    if (cameraPreviewObjectUrl && cameraPreviewObjectUrl.indexOf("blob:") === 0) {
      URL.revokeObjectURL(cameraPreviewObjectUrl);
    }
    cameraPreviewObjectUrl = "";
  }

  function stopLiveCamera() {
    if (liveCameraStream) {
      liveCameraStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          // Ignore track shutdown errors; the stream is being released.
        }
      });
      liveCameraStream = null;
    }
    if (cameraVideo) {
      cameraVideo.pause();
      cameraVideo.srcObject = null;
    }
    setLiveCameraVisible(false);
  }

  function readActiveFile() {
    return imageInput && imageInput.files && imageInput.files.length
      ? imageInput.files[0]
      : null;
  }

  function clearImageInputFile() {
    if (!imageInput) {
      return;
    }
    imageInput.value = "";
  }

  function showCapturedPreviewFromFile(file) {
    if (!cameraPreview || !cameraEmpty) {
      return;
    }
    if (!file) {
      revokeCameraPreviewUrl();
      cameraPreview.removeAttribute("src");
      cameraPreview.classList.add("d-none");
      if (!liveCameraStream) {
        cameraEmpty.classList.remove("d-none");
      }
      return;
    }

    revokeCameraPreviewUrl();
    const objectUrl = URL.createObjectURL(file);
    cameraPreviewObjectUrl = objectUrl;
    cameraPreview.src = objectUrl;
    cameraPreview.classList.remove("d-none");
    cameraEmpty.classList.add("d-none");
    if (retakeBtn) {
      retakeBtn.classList.remove("d-none");
    }
  }

  function getCameraErrorMessage(error) {
    const errorName = error && error.name ? String(error.name) : "";
    if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
      return labels.cameraPermissionDenied || "Camera permission denied. Allow camera access and try again.";
    }
    if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      return labels.cameraNoDevice || "No camera device found.";
    }
    if (errorName === "NotReadableError" || errorName === "TrackStartError") {
      return labels.cameraOpenFailed || "Unable to open camera. Close other camera apps and try again.";
    }
    if (errorName === "SecurityError") {
      return labels.cameraSecureContext || "Camera access requires HTTPS or localhost.";
    }
    return labels.cameraOpenFailed || "Unable to open camera. Please try again.";
  }

  async function loadCameraDeviceOptions() {
    if (!cameraSelect || !hasLiveCameraSupport()) {
      return [];
    }

    let devices = [];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (error) {
      devices = [];
    }

    const cameras = devices.filter((device) => device && device.kind === "videoinput");
    cameraSelect.innerHTML = "";

    if (!cameras.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = labels.cameraNoDevice || "No camera device found.";
      cameraSelect.appendChild(option);
      cameraSelect.disabled = true;
      return [];
    }

    cameras.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId || "";
      option.textContent = String(device.label || "").trim() || (
        (labels.cameraSelectLabel || "Camera") + " " + String(index + 1)
      );
      cameraSelect.appendChild(option);
    });

    if (activeCameraDeviceId) {
      cameraSelect.value = activeCameraDeviceId;
    } else if (cameras[0] && cameras[0].deviceId) {
      cameraSelect.value = cameras[0].deviceId;
    }

    cameraSelect.disabled = cameras.length <= 1;
    return cameras;
  }

  function chooseCameraConstraints(deviceId) {
    const video = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
    if (deviceId) {
      video.deviceId = { exact: deviceId };
    } else {
      video.facingMode = { ideal: "environment" };
    }
    return { video: video, audio: false };
  }

  async function openLiveCamera(preferredDeviceId) {
    if (!cameraPanel) {
      return false;
    }
    if (!hasSecureCameraContext()) {
      setCameraStatus(labels.cameraSecureContext || "Camera access requires HTTPS or localhost.");
      return false;
    }
    if (!hasLiveCameraSupport()) {
      setCameraStatus(labels.cameraUnsupported || "Live camera is not supported on this browser.");
      return false;
    }
    if (!cameraVideo) {
      return false;
    }

    stopLiveCamera();
    if (cameraPreview) {
      cameraPreview.classList.add("d-none");
    }
    if (cameraEmpty) {
      cameraEmpty.classList.add("d-none");
    }
    if (retakeBtn) {
      retakeBtn.classList.add("d-none");
    }

    try {
      liveCameraStream = await navigator.mediaDevices.getUserMedia(chooseCameraConstraints(preferredDeviceId));
    } catch (error) {
      try {
        if (preferredDeviceId) {
          liveCameraStream = await navigator.mediaDevices.getUserMedia(chooseCameraConstraints(""));
        } else {
          liveCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        }
      } catch (fallbackError) {
        setCameraStatus(getCameraErrorMessage(fallbackError));
        return false;
      }
    }

    cameraVideo.srcObject = liveCameraStream;
    try {
      await cameraVideo.play();
    } catch (error) {
      setCameraStatus(labels.cameraOpenFailed || "Unable to open camera. Please try again.");
      stopLiveCamera();
      return false;
    }

    const track = liveCameraStream.getVideoTracks()[0];
    const settings = track && typeof track.getSettings === "function" ? track.getSettings() : {};
    activeCameraDeviceId = String(settings.deviceId || preferredDeviceId || "");
    await loadCameraDeviceOptions();
    if (cameraSelect && activeCameraDeviceId) {
      cameraSelect.value = activeCameraDeviceId;
    }
    setLiveCameraVisible(true);
    setCameraStatus(labels.cameraReady || "Camera is ready.");
    return true;
  }

  function captureFromLiveCamera() {
    if (!cameraVideo || !imageInput || !liveCameraStream) {
      return;
    }

    const width = cameraVideo.videoWidth || 1280;
    const height = cameraVideo.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.drawImage(cameraVideo, 0, 0, width, height);

    canvas.toBlob(function (blob) {
      if (!blob) {
        setCameraStatus(labels.cameraOpenFailed || "Unable to capture photo.");
        return;
      }
      const file = new File([blob], "scan-" + String(Date.now()) + ".jpg", { type: "image/jpeg" });
      if (typeof DataTransfer === "undefined") {
        setCameraStatus(labels.cameraOpenFailed || "Capture is not supported here. Use file upload.");
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(file);
      imageInput.files = transfer.files;
      stopLiveCamera();
      showCapturedPreviewFromFile(file);
      if (cameraPreview) {
        cameraPreview.classList.remove("d-none");
      }
      setCameraStatus(labels.cameraCaptured || "Photo captured. Ready to submit.");
      setAlert("");
      refreshAnalyzeButtonState();
      if (scanSuggestionApi && cropSelect && String(cropSelect.value || "").trim()) {
        analyzeScanImage();
      }
    }, "image/jpeg", 0.92);
  }

  async function analyzeScanImage() {
    if (!scanSuggestionApi || scanAnalyzeInFlight) {
      return;
    }

    const selectedCrop = String(cropSelect ? cropSelect.value : "").trim();
    if (!selectedCrop) {
      setAlert(labels.invalidCrop || "Please select a crop.");
      refreshAnalyzeButtonState();
      return;
    }

    const file = readActiveFile();
    if (!file) {
      setAlert(labels.imageRequired || "Please upload an image for scan mode.");
      refreshAnalyzeButtonState();
      return;
    }
    if (file.type && file.type.indexOf("image/") !== 0) {
      setAlert(labels.invalidImage || "Please choose a valid image file.");
      refreshAnalyzeButtonState();
      return;
    }

    scanAnalyzeInFlight = true;
    refreshAnalyzeButtonState();
    setAlert("");
    setCameraStatus(labels.scanAnalyzing || "Analyzing image with API...");

    const payload = new FormData();
    payload.append("crop_id", selectedCrop);
    payload.append("field_image", file, file.name || "scan.jpg");

    try {
      const response = await fetch(scanSuggestionApi, {
        method: "POST",
        body: payload,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok || !data || !data.ok) {
        const apiError = data && data.error
          ? String(data.error)
          : (labels.scanApiUnavailable || labels.scanApiFailed || "Unable to analyze scan image.");
        setAlert(apiError);
        setCameraStatus(apiError);
        return;
      }

      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      const suggestedIds = suggestions
        .map((item) => String(item && item.id ? item.id : "").trim())
        .filter(Boolean);

      applySuggestedSymptoms(suggestedIds);
      if (suggestedIds.length) {
        setCameraStatus(
          formatLabel(
            labels.scanApplied,
            { count: suggestedIds.length },
          ) || ("Applied " + String(suggestedIds.length) + " symptom(s) from scan."),
        );
        if (instantScanMode) {
          setCameraStatus(labels.scanAutoSubmitting || "Submitting diagnosis automatically...");
          setTimeout(function () {
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
            } else {
              form.submit();
            }
          }, 260);
          return;
        }
      } else {
        setCameraStatus(labels.scanNoSuggestion || "No confident symptom found from this image.");
      }
    } catch (error) {
      const failureText = labels.scanApiFailed || "Unable to analyze scan image.";
      setAlert(failureText);
      setCameraStatus(failureText);
    } finally {
      scanAnalyzeInFlight = false;
      refreshAnalyzeButtonState();
    }
  }

  function setupScanCamera() {
    if (!scanMode || !cameraPanel) {
      return;
    }

    if (!hasSecureCameraContext()) {
      setCameraStatus(labels.cameraSecureContext || "Camera access requires HTTPS or localhost.");
    } else if (!hasLiveCameraSupport()) {
      setCameraStatus(labels.cameraUnsupported || "Live camera is not supported on this browser.");
    } else {
      setCameraStatus("");
      loadCameraDeviceOptions();
    }

    if (openCameraBtn) {
      openCameraBtn.addEventListener("click", function () {
        const preferredDeviceId = cameraSelect ? String(cameraSelect.value || "").trim() : "";
        openLiveCamera(preferredDeviceId);
      });
    }

    if (stopCameraBtn) {
      stopCameraBtn.addEventListener("click", function () {
        stopLiveCamera();
        if (!readActiveFile() && cameraEmpty) {
          cameraEmpty.classList.remove("d-none");
        }
      });
    }

    if (captureBtn) {
      captureBtn.addEventListener("click", function () {
        captureFromLiveCamera();
      });
    }

    if (analyzeScanBtn) {
      analyzeScanBtn.addEventListener("click", function () {
        analyzeScanImage();
      });
    }

    if (retakeBtn) {
      retakeBtn.addEventListener("click", function () {
        clearImageInputFile();
        showCapturedPreviewFromFile(null);
        const preferredDeviceId = cameraSelect ? String(cameraSelect.value || "").trim() : "";
        openLiveCamera(preferredDeviceId);
        refreshAnalyzeButtonState();
      });
    }

    if (cameraSelect) {
      cameraSelect.addEventListener("change", function () {
        const nextDeviceId = String(cameraSelect.value || "").trim();
        if (liveCameraStream && nextDeviceId) {
          openLiveCamera(nextDeviceId);
        }
      });
    }

    if (imageInput) {
      imageInput.addEventListener("change", function () {
        const file = readActiveFile();
        if (!file || (file.type && file.type.indexOf("image/") !== 0)) {
          showCapturedPreviewFromFile(null);
          if (!file && !liveCameraStream && cameraEmpty) {
            cameraEmpty.classList.remove("d-none");
          }
          refreshAnalyzeButtonState();
          return;
        }
        stopLiveCamera();
        showCapturedPreviewFromFile(file);
        setCameraStatus(labels.cameraCaptured || "Photo captured. Ready to submit.");
        refreshAnalyzeButtonState();
        if (scanSuggestionApi && cropSelect && String(cropSelect.value || "").trim()) {
          analyzeScanImage();
        }
      });
    }

    window.addEventListener("beforeunload", stopLiveCamera);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopLiveCamera();
      }
    });
    refreshAnalyzeButtonState();

    if (instantScanMode && hasSecureCameraContext() && hasLiveCameraSupport()) {
      const preferredDeviceId = cameraSelect ? String(cameraSelect.value || "").trim() : "";
      openLiveCamera(preferredDeviceId);
    }
  }

  function getSymptomsForCrop(cropId) {
    const specific = symptomsByCrop[String(cropId)] || symptomsByCrop[cropId] || [];
    const fallback = symptomsByCrop["0"] || symptomsByCrop[0] || [];
    const source = Array.isArray(specific) && specific.length ? specific : fallback;

    const symptomById = new Map();
    source.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }
      const id = Number(item.id);
      const name = String(item.name || "").trim();
      if (!Number.isInteger(id) || id <= 0 || !name) {
        return;
      }
      const key = String(id);
      if (!symptomById.has(key)) {
        symptomById.set(key, { id: key, name: name });
      }
    });

    return Array.from(symptomById.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function syncClarificationInputs() {
    if (clarificationPayloadInput) {
      clarificationPayloadInput.value = "[]";
    }
    if (clarificationCountInput) {
      clarificationCountInput.value = "0";
    }
  }

  function syncHiddenInputs() {
    if (selectedSymptomsInputs) {
      selectedSymptomsInputs.innerHTML = "";
      manualSelectedSymptoms.forEach((id) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "symptoms";
        input.value = id;
        selectedSymptomsInputs.appendChild(input);
      });
    }

    if (deniedSymptomsInputs) {
      deniedSymptomsInputs.innerHTML = "";
    }

    syncClarificationInputs();
  }

  function renderManualSelectionSummary() {
    if (!manualSelectedSummary) {
      return;
    }

    const nameMap = new Map();
    currentSymptoms.forEach((item) => {
      nameMap.set(String(item.id), item.name);
    });
    if (manualList) {
      Array.from(manualList.querySelectorAll("label.simple-symptom-item")).forEach((item) => {
        const checkbox = item.querySelector("input[type='checkbox']");
        const textEl = item.querySelector("span");
        const id = String((checkbox && (checkbox.dataset.symptomId || checkbox.value)) || "").trim();
        const name = String((textEl && textEl.textContent) || "").trim();
        if (id && name && !nameMap.has(id)) {
          nameMap.set(id, name);
        }
      });
    }

    const names = Array.from(manualSelectedSymptoms)
      .map((id) => nameMap.get(String(id)))
      .filter(Boolean);

    if (!names.length) {
      manualSelectedSummary.textContent = labels.manualSummaryNone || "No manual selection yet.";
      return;
    }

    manualSelectedSummary.textContent = formatLabel(
      labels.selectedSummaryTemplate,
      {
        label: labels.selectedLabel || "Selected",
        count: names.length,
        items: names.slice(0, 8).join(", "),
      },
    ) || ("Selected (" + String(names.length) + "): " + names.slice(0, 8).join(", "));
  }

  function updateManualStats() {
    if (!manualStats) {
      return;
    }
    manualStats.textContent = formatLabel(
      labels.selectedCountTemplate,
      {
        count: manualSelectedSymptoms.size,
      },
    ) || (String(manualSelectedSymptoms.size) + " selected");
  }

  function pruneManualSelections() {
    if (!currentSymptoms.length) {
      return;
    }
    const validIds = new Set(currentSymptoms.map((item) => String(item.id)));
    Array.from(manualSelectedSymptoms).forEach((id) => {
      if (!validIds.has(String(id))) {
        manualSelectedSymptoms.delete(String(id));
      }
    });
  }

  function bindExistingManualCheckboxes(searchKeyword) {
    if (!manualList) {
      return 0;
    }

    let shownCount = 0;
    Array.from(manualList.querySelectorAll("label.simple-symptom-item")).forEach((item) => {
      const checkbox = item.querySelector("input[type='checkbox']");
      const textEl = item.querySelector("span");
      if (!checkbox) {
        return;
      }

      const symptomId = String(checkbox.dataset.symptomId || checkbox.value || "").trim();
      const symptomText = normalizeText(textEl ? textEl.textContent : "");
      const isMatch = !searchKeyword || symptomText.includes(searchKeyword);
      item.classList.toggle("d-none", !isMatch);
      if (!isMatch) {
        return;
      }

      shownCount += 1;
      if (symptomId && manualSelectedSymptoms.has(symptomId)) {
        checkbox.checked = true;
      }
      if (symptomId && checkbox.checked) {
        manualSelectedSymptoms.add(symptomId);
      }

      if (checkbox.dataset.boundManual !== "1") {
        checkbox.addEventListener("change", function () {
          if (checkbox.checked) {
            manualSelectedSymptoms.add(symptomId);
          } else {
            manualSelectedSymptoms.delete(symptomId);
          }
          syncHiddenInputs();
          updateManualStats();
          renderManualSelectionSummary();
          setAlert("");
        });
        checkbox.dataset.boundManual = "1";
      }
    });

    return shownCount;
  }

  function renderManualList() {
    if (!manualList || !manualEmpty) {
      return;
    }

    const searchKeyword = normalizeText(manualSearchInput ? manualSearchInput.value : "");
    if (!currentSymptoms.length) {
      const shownCountFromDom = bindExistingManualCheckboxes(searchKeyword);
      if (shownCountFromDom === 0) {
        if (searchKeyword) {
          manualEmpty.textContent = labels.noSearchResult || "No symptoms match your search.";
        } else if (cropSelect && !cropSelect.value) {
          manualEmpty.textContent = labels.selectCropForManual || "Please select a crop to load symptoms.";
        } else {
          manualEmpty.textContent = labels.noSymptoms || "No symptoms available for this crop.";
        }
        manualEmpty.classList.remove("d-none");
      } else {
        manualEmpty.classList.add("d-none");
      }
      syncHiddenInputs();
      updateManualStats();
      renderManualSelectionSummary();
      return;
    }

    manualList.innerHTML = "";

    let shownCount = 0;

    currentSymptoms.forEach((symptom) => {
      if (!symptom || !symptom.id || !symptom.name) {
        return;
      }

      const symptomNameNormalized = normalizeText(symptom.name);
      if (searchKeyword && !symptomNameNormalized.includes(searchKeyword)) {
        return;
      }

      shownCount += 1;

      const item = document.createElement("label");
      item.className = "simple-symptom-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = symptom.id;
      checkbox.checked = manualSelectedSymptoms.has(String(symptom.id));
      checkbox.addEventListener("change", function () {
        if (checkbox.checked) {
          manualSelectedSymptoms.add(String(symptom.id));
        } else {
          manualSelectedSymptoms.delete(String(symptom.id));
        }
        syncHiddenInputs();
        updateManualStats();
        renderManualSelectionSummary();
        setAlert("");
      });

      const text = document.createElement("span");
      text.textContent = symptom.name;

      item.appendChild(checkbox);
      item.appendChild(text);
      manualList.appendChild(item);
    });

    if (shownCount === 0) {
      manualEmpty.textContent = currentSymptoms.length
        ? (labels.noSearchResult || "No symptoms match your search.")
        : (cropSelect && !cropSelect.value
          ? (labels.selectCropForManual || "Please select a crop to load symptoms.")
          : (labels.noSymptoms || "No symptoms available for this crop."));
      manualEmpty.classList.remove("d-none");
    } else {
      manualEmpty.classList.add("d-none");
    }

    updateManualStats();
    renderManualSelectionSummary();
  }

  function renderSubcategories() {
    if (!domainSelect || !subcategorySelect) {
      return;
    }

    const selectedDomain = agriDomains.find((domain) => {
      return String(domain.id) === String(domainSelect.value);
    }) || agriDomains[0] || null;

    if (selectedDomain && domainSelect.value !== String(selectedDomain.id)) {
      domainSelect.value = String(selectedDomain.id);
    }

    subcategorySelect.innerHTML = "";
    const subcategories = selectedDomain && Array.isArray(selectedDomain.subcategories)
      ? selectedDomain.subcategories
      : [];

    if (!subcategories.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = labels.generalLabel || "General";
      subcategorySelect.appendChild(option);
      return;
    }

    subcategories.forEach((subcategory, index) => {
      const option = document.createElement("option");
      option.value = subcategory.id || "";
      option.textContent = pickLabel(subcategory, "Type " + String(index + 1));
      subcategorySelect.appendChild(option);
    });
  }

  function filterCropOptions() {
    if (!cropSelect) {
      return;
    }

    const currentDomain = String(domainSelect ? domainSelect.value : "");
    const currentSubcategory = String(subcategorySelect ? subcategorySelect.value : "");

    Array.from(cropSelect.options).forEach((option, index) => {
      if (index === 0) {
        option.hidden = false;
        return;
      }

      const optionDomain = String(option.dataset.domain || "crop");
      const optionSubcategory = String(option.dataset.subcategory || "");
      const matchDomain = !currentDomain || optionDomain === currentDomain;
      const matchSubcategory = !currentSubcategory || optionSubcategory === currentSubcategory;
      const visible = matchDomain && matchSubcategory;

      option.hidden = !visible;
    });

    const selectedOption = cropSelect.options[cropSelect.selectedIndex];
    if (selectedOption && selectedOption.hidden) {
      cropSelect.value = "";
    }
  }

  function ensureCropSelection() {
    if (!cropSelect || cropSelect.value) {
      return;
    }

    let firstVisibleCrop = "";

    Array.from(cropSelect.options).forEach((option, index) => {
      if (index === 0 || option.hidden) {
        return;
      }
      if (!firstVisibleCrop) {
        firstVisibleCrop = String(option.value || "");
      }
    });

    if (firstVisibleCrop) {
      cropSelect.value = firstVisibleCrop;
    }
  }

  function syncDiagnosisCategory() {
    if (!domainSelect || !diagnosisCategoryInput) {
      return;
    }
    const domainId = String(domainSelect.value || "crop");
    diagnosisCategoryInput.value = String(domainDefaultCategory[domainId] || "other");
  }

  function getCropOptionByValue(rawValue) {
    if (!cropSelect) {
      return null;
    }
    const value = String(rawValue || "").trim();
    if (!value) {
      return null;
    }
    return Array.from(cropSelect.options).find((option) => {
      return String(option.value || "").trim() === value;
    }) || null;
  }

  function applyCropContextFromOption(option) {
    if (!option) {
      return;
    }

    const optionDomain = String(option.dataset.domain || "").trim();
    if (optionDomain && domainSelect) {
      const available = Array.from(domainSelect.options).some((row) => String(row.value) === optionDomain);
      if (available) {
        domainSelect.value = optionDomain;
      }
    }

    renderSubcategories();

    const optionSubcategory = String(option.dataset.subcategory || "").trim();
    if (optionSubcategory && subcategorySelect) {
      const available = Array.from(subcategorySelect.options).some(
        (row) => String(row.value) === optionSubcategory,
      );
      if (available) {
        subcategorySelect.value = optionSubcategory;
      }
    }

    filterCropOptions();
  }

  function applyInitialCropSelection() {
    const option = getCropOptionByValue(initialCropId);
    if (!option || !cropSelect) {
      return false;
    }

    cropSelect.value = String(option.value || "");
    applyCropContextFromOption(option);
    return true;
  }

  function updateSymptomSource() {
    const cropId = String(cropSelect ? cropSelect.value : "").trim();

    if (!cropId) {
      currentSymptoms = getSymptomsForCrop(0);
      manualSelectedSymptoms.clear();
      return;
    }

    currentSymptoms = getSymptomsForCrop(cropId);
    pruneManualSelections();
  }

  function clearManualSelections() {
    manualSelectedSymptoms.clear();
    syncHiddenInputs();
  }

  function refreshManualUI() {
    syncHiddenInputs();
    renderManualList();
  }

  function applySuggestedSymptoms(ids) {
    if (!Array.isArray(ids) || !ids.length) {
      return 0;
    }

    const availableIds = new Set(currentSymptoms.map((item) => String(item.id)));
    let added = 0;

    ids.forEach((rawId) => {
      const id = String(rawId || "").trim();
      if (!id) {
        return;
      }
      if (availableIds.size && !availableIds.has(id)) {
        return;
      }
      if (!manualSelectedSymptoms.has(id)) {
        added += 1;
      }
      manualSelectedSymptoms.add(id);
    });

    refreshManualUI();
    return added;
  }

  function setupInitialState() {
    if (domainSelect && agriDomains.length && !domainSelect.value) {
      domainSelect.value = String(agriDomains[0].id || "crop");
    }

    renderSubcategories();
    const hasInitialCrop = applyInitialCropSelection();
    if (!hasInitialCrop) {
      filterCropOptions();
      ensureCropSelection();
    }

    syncDiagnosisCategory();
    updateSymptomSource();
    refreshManualUI();
    if (scanMode && cropSelect && !cropSelect.value) {
      const firstOption = Array.from(cropSelect.options).find((option, index) => {
        return index > 0 && option.value && !option.hidden;
      });
      if (firstOption) {
        cropSelect.value = firstOption.value;
        if (domainSelect && !domainSelect.value) {
          const optionDomain = firstOption.dataset.domain || "";
          if (optionDomain) {
            domainSelect.value = optionDomain;
            renderSubcategories();
          }
        }
        updateSymptomSource();
        refreshManualUI();
      }
    }
  }

  if (domainSelect) {
    domainSelect.addEventListener("change", function () {
      renderSubcategories();
      filterCropOptions();
      ensureCropSelection();
      syncDiagnosisCategory();
      clearManualSelections();
      updateSymptomSource();
      setAlert("");
      refreshManualUI();
      refreshAnalyzeButtonState();
    });
  }

  if (subcategorySelect) {
    subcategorySelect.addEventListener("change", function () {
      filterCropOptions();
      ensureCropSelection();
      clearManualSelections();
      updateSymptomSource();
      setAlert("");
      refreshManualUI();
      refreshAnalyzeButtonState();
    });
  }

  if (cropSelect) {
    cropSelect.addEventListener("change", function () {
      clearManualSelections();
      updateSymptomSource();
      setAlert("");
      refreshManualUI();
      refreshAnalyzeButtonState();
    });
  }

  if (manualSearchInput) {
    manualSearchInput.addEventListener("input", function () {
      renderManualList();
    });
  }

  form.addEventListener("submit", function (event) {
    setAlert("");

    const selectedCrop = String(cropSelect ? cropSelect.value : "").trim();
    if (!selectedCrop) {
      event.preventDefault();
      setAlert(labels.invalidCrop || "Please select a crop.");
      return;
    }

    if (manualSelectedSymptoms.size === 0) {
      event.preventDefault();
      setAlert(labels.invalidSymptoms || "Please select at least one symptom.");
      return;
    }

    const file = imageInput && imageInput.files && imageInput.files.length ? imageInput.files[0] : null;
    if (scanMode && !file) {
      event.preventDefault();
      setAlert(labels.imageRequired || "Please upload an image for scan mode.");
      return;
    }
    if (file && file.type && file.type.indexOf("image/") !== 0) {
      event.preventDefault();
      setAlert(labels.invalidImage || "Please choose a valid image file.");
      return;
    }

    stopLiveCamera();
    syncHiddenInputs();
  });

  setupInitialState();
  setupScanCamera();
})();
