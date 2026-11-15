/* Diagnosis wizard and scan mode interactions. */
(function () {
  "use strict";

  const data = window.SIMPLE_DIAGNOSIS_DATA || {};
  const symptomsByCrop = data.symptomsByCrop || {};
  const rulesByCrop = data.rulesByCrop || {};
  const domainDefaultCat = data.domainDefaultDiagnosisCategory || {};
  const labels = data.labels || {};
  const scanSuggestionApi = String(data.scanSuggestionApi || "").trim();
  const initialCropId = String(data.initialCropId || "").trim();
  const scanMode = Boolean(data.scanMode);
  const instantScanMode = Boolean(data.instantScanMode);

  const lang = String(document.documentElement.lang || "").toLowerCase();
  const isKhmer = lang.startsWith("km");

  const form = document.getElementById("simpleDiagnosisForm");
  const cropSelect = document.getElementById("simpleCropSelect");
  const domainSelect = document.getElementById("simpleDomainSelect");
  const subSelect = document.getElementById("simpleSubcategorySelect");
  const categoryInput = document.getElementById("simpleDiagnosisCategory");
  const subtypeInput = document.getElementById("simpleCropSubtype");
  const selectedInputs = document.getElementById("simpleSelectedSymptomsInputs");
  const deniedInputs = document.getElementById("simpleDeniedSymptomsInputs");
  const clarPayload = document.getElementById("simpleClarificationPayload");
  const clarCount = document.getElementById("simpleClarificationCount");
  const imageInput = document.getElementById("simpleFieldImageInput");
  const formAlert = document.getElementById("simpleFormAlert");

  function label(key, fallback) {
    const value = String(labels[key] || "").trim();
    return value || fallback || "";
  }

  function stripKhmer(value) {
    return String(value || "")
      .replace(/[\u1780-\u17ff\u19e0-\u19ff]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripLatin(value) {
    return String(value || "")
      .replace(/[a-zA-Z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function localizedText(englishValue, khmerValue, fallback) {
    const english = stripKhmer(englishValue) || String(englishValue || "").trim();
    const khmer = String(khmerValue || "").trim() || stripLatin(englishValue);

    if (isKhmer) {
      return khmer || String(fallback || "").trim() || english;
    }

    return english || String(fallback || "").trim() || khmer;
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const KH_DIGITS = [
    "\u17e0",
    "\u17e1",
    "\u17e2",
    "\u17e3",
    "\u17e4",
    "\u17e5",
    "\u17e6",
    "\u17e7",
    "\u17e8",
    "\u17e9",
  ];

  function toKhNum(value) {
    return String(value).replace(/\d/g, (digit) => KH_DIGITS[Number(digit)] || digit);
  }

  function setAlert(message) {
    if (!formAlert) return;
    const text = String(message || "").trim();
    formAlert.classList.toggle("d-none", !text);
    formAlert.textContent = text;
  }

  function submitForm() {
    if (!form) return;
    form.submit();
  }

  function iconHtml(iconClass) {
    return `<i class="fas ${iconClass}" aria-hidden="true"></i>`;
  }

  const CROP_EMOJI_MAP = [
    /* Grains */
    [["rice", "paddy", "jasmine rice", "ស្រូវ", "អង្ករ"],                    "🌾"],
    [["wheat", "barley", "oat", "cereal", "grain"],                          "🌾"],
    [["corn", "maize", "sweetcorn", "ពោត"],                                  "🌽"],
    /* Vegetables */
    [["tomato", "cherry tomato", "ប៉េងប៉ោះ"],                                "🍅"],
    [["sweet potato", "yam", "cassava", "tapioca", "manioc", "ដំឡូង", "មឹង"], "🍠"],
    [["potato", "spud", "ដំឡូងបារាំង"],                                      "🥔"],
    [["carrot", "ការ៉ុត"],                                                    "🥕"],
    [["cucumber", "bitter gourd", "bitter melon", "ត្រសក់"],                  "🥒"],
    [["cabbage", "broccoli", "cauliflower", "kale", "ស្ពៃ"],                  "🥦"],
    [["lettuce", "spinach", "bokchoy", "water spinach", "morning glory", "chard"], "🥬"],
    [["eggplant", "brinjal", "aubergine", "ត្រប់"],                           "🍆"],
    [["onion", "shallot", "spring onion", "ខ្ទឹមបារាំង"],                    "🧅"],
    [["garlic", "ខ្ទឹម"],                                                     "🧄"],
    [["ginger", "galangal", "turmeric", "lemongrass", "ខ្ញី"],               "🧄"],
    [["chili", "pepper", "capsicum", "ម្ទេស"],                                "🌶️"],
    [["pumpkin", "squash", "gourd", "winter melon", "wax gourd"],             "🎃"],
    [["avocado"],                                                             "🥑"],
    [["taro", "colocasia", "ត្រាវ"],                                          "🧆"],
    /* Fruits */
    [["banana", "plantain", "ចេក"],                                           "🍌"],
    [["mango", "ស្វាយ"],                                                      "🥭"],
    [["papaya", "ល្ហុង"],                                                     "🥭"],
    [["durian", "ទុរេន"],                                                     "🍈"],
    [["jackfruit", "ខ្នុរ"],                                                  "🍈"],
    [["dragon fruit", "pitaya", "pitahaya"],                                  "🥝"],
    [["longan", "ល្ងន់"],                                                     "🍒"],
    [["lychee", "litchi", "ចេកខ្មោច"],                                       "🍒"],
    [["rambutan", "ស្រោងចៃ"],                                                "🍒"],
    [["watermelon", "melon", "ត្របែក"],                                       "🍉"],
    [["pineapple", "ananas", "ម្នាស់"],                                       "🍍"],
    [["coconut", "palm"],                                                     "🥥"],
    [["pomelo", "grapefruit", "ក្រូចត្រូ"],                                   "🍊"],
    [["orange", "tangerine", "mandarin", "kaffir lime", "citrus", "ក្រូច"],   "🍊"],
    [["lemon", "lime", "ក្រូចឆ្មា"],                                          "🍋"],
    [["guava", "ត្រប់", "ជីដូ"],                                              "🍐"],
    [["star fruit", "starfruit", "carambola"],                                "🥭"],
    [["passion fruit", "granadilla"],                                         "🍋"],
    [["apple"],                                                               "🍎"],
    [["grape", "vine"],                                                       "🍇"],
    [["strawberry"],                                                          "🍓"],
    [["blueberry", "berry"],                                                  "🫐"],
    [["peach", "nectarine"],                                                  "🍑"],
    [["cherry"],                                                              "🍒"],
    [["olive"],                                                               "🫒"],
    [["kiwi", "kiwifruit"],                                                   "🥝"],
    /* Legumes & Seeds */
    [["soybean", "soy", "edamame", "សណ្ដែកសៀង"],                             "🫘"],
    [["bean", "lentil", "legume", "mung", "mung bean", "kidney", "black bean"], "🫘"],
    [["pea", "snap pea", "green bean", "long bean", "string bean"],           "🫛"],
    [["peanut", "groundnut", "arachis", "cashew", "សណ្ដែកដី"],               "🥜"],
    [["sesame", "sesame seed", "til"],                                        "🌼"],
    [["sunflower"],                                                           "🌻"],
    /* Plantation & Tree Crops */
    [["sugarcane", "sugar cane", "อ้อย", "អំពៅ"],                            "🎋"],
    [["bamboo"],                                                              "🎋"],
    [["rubber", "rubber tree", "hevea", "ជ័រ"],                              "🌳"],
    [["coffee", "arabica", "robusta", "កាហ្វេ"],                             "☕"],
    [["tea", "green tea", "cha", "oolong"],                                   "🍵"],
    [["cocoa", "cacao", "chocolate"],                                         "🌳"],
    [["pepper", "black pepper", "white pepper"],                              "🌿"],
    [["cotton"],                                                              "🌸"],
    [["tobacco"],                                                             "🌿"],
    /* Herbs & Spices */
    [["lemongrass", "citronella"],                                            "🌿"],
    [["mint", "basil", "coriander", "parsley", "herb"],                       "🌿"],
    /* Other */
    [["mushroom", "fungi", "shiitake", "oyster mushroom"],                    "🍄"],
    [["fish", "tilapia", "catfish", "carp"],                                  "🐟"],
    [["shrimp", "prawn"],                                                     "🦐"],
    [["crab"],                                                                "🦀"],
    [["chicken", "poultry", "broiler"],                                       "🐓"],
    [["pig", "swine", "pork"],                                                "🐖"],
    [["cow", "cattle", "dairy"],                                              "🐄"],
    [["honey", "bee"],                                                        "🍯"],
  ];

  function getDefaultCropEmoji(nameEn, nameKh) {
    const combined = `${nameEn || ""} ${nameKh || ""}`.toLowerCase();
    const match = CROP_EMOJI_MAP.find(([keys]) => keys.some((key) => combined.includes(key.toLowerCase())));
    return match ? match[1] : "🌱";
  }

  function isRiceCrop(nameEn, nameKh) {
    const combined = `${nameEn || ""} ${nameKh || ""}`.toLowerCase();
    return (
      combined.includes("rice")
      || combined.includes("paddy")
      || String(nameKh || "").includes("\u179f\u17d2\u179a\u17bc\u179c")
      || String(nameKh || "").includes("\u17a2\u1784\u17d2\u1780\u179a")
    );
  }

  const RICE_SUBTYPES = [
    {
      id: "paddy",
      icon: "fa-seedling",
      name: label("paddyRice"),
      secondary: label("paddyRiceSecondary"),
      description: label("paddyRiceDesc"),
    },
    {
      id: "grain",
      icon: "fa-layer-group",
      name: label("nurseryRice"),
      secondary: label("nurseryRiceSecondary"),
      description: label("nurseryRiceDesc"),
    },
  ];

  function getAllSymptoms(cropId) {
    const rules = rulesByCrop[String(cropId)] || [];
    const freq = {};

    rules.forEach((ruleIds) => {
      (Array.isArray(ruleIds) ? ruleIds : []).forEach((id) => {
        const key = String(id);
        freq[key] = (freq[key] || 0) + 1;
      });
    });

    const source = symptomsByCrop[String(cropId)] || symptomsByCrop["0"] || [];
    return source
      .filter((symptom) => symptom && symptom.id && symptom.name)
      .map((symptom) => {
        const rawEn = String(symptom.name || "");
        const rawKh = String(symptom.name_kh || "");
        return {
          id: String(symptom.id),
          name: localizedText(rawEn, rawKh, rawEn),
          nameEn: stripKhmer(rawEn) || rawEn,
          nameKh: rawKh || stripLatin(rawEn),
          freq: freq[String(symptom.id)] || 0,
        };
      })
      .sort((left, right) => {
        if (right.freq !== left.freq) return right.freq - left.freq;
        return left.name.localeCompare(right.name);
      });
  }

  function syncCropContext(cropId) {
    const id = String(cropId || "").trim();
    if (cropSelect) cropSelect.value = id;

    const option = cropSelect
      ? Array.from(cropSelect.options).find((item) => String(item.value) === id)
      : null;

    if (!option) return;

    const domainId = String(option.dataset.domain || "").trim();
    const subcategoryId = String(option.dataset.subcategory || "").trim();

    if (domainId && domainSelect) domainSelect.value = domainId;
    if (categoryInput) categoryInput.value = domainDefaultCat[domainId] || "other";
    if (subcategoryId && subSelect) subSelect.value = subcategoryId;
  }

  if (!scanMode && !instantScanMode) {
    const wizProgFill = document.getElementById("wizProgFill");
    const wizStepLabel = document.getElementById("wizStepLabel");
    const wizBackBtn = document.getElementById("wizBackBtn");
    const scrLoading = document.getElementById("scrLoading");
    const scrCrop = document.getElementById("scrCrop");
    const scrSubtype = document.getElementById("scrSubtype");
    const scrSymptom = document.getElementById("scrSymptom");
    const cropGrid = document.getElementById("cropGrid");
    const cropSearchInput = document.getElementById("cropSearchInput");
    const cropNoMatch = document.getElementById("cropNoMatch");
    const subtypeList = document.getElementById("subtypeList");
    const symCropTag = document.getElementById("symCropTag");
    const symSelBadge = document.getElementById("symSelBadge");
    const symChipsGrid = document.getElementById("symChipsGrid");
    const symNoData = document.getElementById("symNoData");
    const symSearchInput = document.getElementById("symSearchInput");
    const symNoSearchMatch = document.getElementById("symNoSearchMatch");
    const symSelectedSummary = document.getElementById("symSelectedSummary");
    const symClearAllBtn = document.getElementById("symClearAllBtn");
    const btnDiagnose = document.getElementById("btnDiagnose");
    const btnDiagnoseCount = document.getElementById("btnDiagnoseCount");
    const allScreens = [scrLoading, scrCrop, scrSubtype, scrSymptom];

    const state = {
      screen: "loading",
      cropId: "",
      cropNameEn: "",
      cropNameKh: "",
      subtype: "",
      symptoms: [],
      selected: {},
      totalSteps: 3,
      curStep: 1,
      isRice: false,
    };

    function computeTotalSteps() {
      return 1 + (state.isRice ? 1 : 0) + 1;
    }

    function getDisplayNumber(value) {
      return isKhmer ? toKhNum(value) : String(value);
    }

    function updateProgress() {
      const pct = state.totalSteps > 0
        ? Math.round((state.curStep / state.totalSteps) * 100)
        : 0;

      if (wizProgFill) wizProgFill.style.width = `${pct}%`;
      if (wizStepLabel) {
        wizStepLabel.textContent = `${getDisplayNumber(state.curStep)} / ${getDisplayNumber(state.totalSteps)}`;
      }
    }

    function updateBackButton() {
      if (!wizBackBtn) return;
      wizBackBtn.style.visibility = state.screen !== "crop" ? "visible" : "hidden";
    }

    function showScreen(element) {
      allScreens.forEach((screen) => {
        if (!screen) return;
        screen.classList.toggle("d-none", screen !== element);
      });
    }

    function selectedCount() {
      return Object.values(state.selected).filter(Boolean).length;
    }

    function updateSelectionUI() {
      const count = selectedCount();
      const countLabel = getDisplayNumber(count);

      if (symSelBadge) {
        symSelBadge.style.display = count ? "" : "none";
        symSelBadge.textContent = count
          ? `${countLabel} ${label("selectedLabel", "selected")}`
          : "";
      }

      if (btnDiagnose) btnDiagnose.disabled = count === 0;

      if (btnDiagnoseCount) {
        btnDiagnoseCount.textContent = countLabel;
        btnDiagnoseCount.classList.toggle("d-none", count === 0);
      }

      renderSelectedSummary();
    }

    function filterCrops(query) {
      if (!cropGrid) return;
      const q = String(query || "").trim().toLowerCase();
      let visible = 0;
      Array.from(cropGrid.querySelectorAll(".wiz-crop-card")).forEach((card) => {
        const name = String(card.querySelector(".wiz-crop-name")?.textContent || "").toLowerCase();
        const show = !q || name.includes(q);
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });
      if (cropNoMatch) cropNoMatch.classList.toggle("d-none", visible > 0 || !q);
    }

    function filterSymptoms(query) {
      if (!symChipsGrid) return;
      const q = String(query || "").trim().toLowerCase();
      let visible = 0;
      Array.from(symChipsGrid.querySelectorAll(".sym-chip")).forEach((chip) => {
        const name = String(chip.querySelector(".sym-chip-kh")?.textContent || "").toLowerCase();
        const show = !q || name.includes(q);
        chip.style.display = show ? "" : "none";
        if (show) visible++;
      });
      if (symNoSearchMatch) {
        const hasChips = state.symptoms.length > 0;
        symNoSearchMatch.classList.toggle("d-none", !hasChips || visible > 0 || !q);
      }
    }

    function renderSelectedSummary() {
      if (!symSelectedSummary) return;
      const selected = state.symptoms.filter((s) => state.selected[s.id]);
      if (!selected.length) {
        symSelectedSummary.style.display = "none";
        symSelectedSummary.innerHTML = "";
        if (symClearAllBtn) symClearAllBtn.classList.add("d-none");
        return;
      }
      symSelectedSummary.style.display = "";
      if (symClearAllBtn) symClearAllBtn.classList.remove("d-none");
      symSelectedSummary.innerHTML = selected.map((s) => {
        const name = s.name || localizedText(s.nameEn, s.nameKh, s.nameEn);
        return `<span class="sym-summary-tag">
          <span class="sym-summary-tag-text">${esc(name)}</span>
          <button type="button" class="sym-tag-remove" data-id="${esc(s.id)}" aria-label="Remove">&#x2715;</button>
        </span>`;
      }).join("");
      symSelectedSummary.querySelectorAll(".sym-tag-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const chipId = String(btn.dataset.id || "");
          const chip = symChipsGrid?.querySelector(`[data-id="${chipId}"]`);
          if (chip) toggleChip(chipId, chip);
        });
      });
    }

    function clearAllSymptoms() {
      if (!symChipsGrid) return;
      state.selected = {};
      Array.from(symChipsGrid.querySelectorAll(".sym-chip")).forEach((chip) => {
        chip.classList.remove("sel");
        chip.setAttribute("aria-pressed", "false");
      });
      updateSelectionUI();
    }

    function toggleChip(id, chipEl) {
      state.selected[id] = !state.selected[id];
      chipEl.classList.toggle("sel", Boolean(state.selected[id]));
      chipEl.setAttribute("aria-pressed", state.selected[id] ? "true" : "false");
      updateSelectionUI();
    }

    function showCropScreen() {
      state.screen = "crop";
      state.curStep = 1;
      updateProgress();
      updateBackButton();

      if (cropSearchInput) {
        cropSearchInput.value = "";
        filterCrops("");
      }
      if (cropNoMatch) cropNoMatch.classList.add("d-none");

      if (cropGrid) {
        cropGrid.innerHTML = "";
        const options = cropSelect ? Array.from(cropSelect.options) : [];

        options.forEach((option, index) => {
          if (index === 0 || !option.value) return;

          const id = option.value;
          const nameEn = String(option.dataset.nameEn || option.text || "").trim();
          const nameKh = String(option.dataset.nameKh || "").trim();
          const display = localizedText(nameEn, nameKh, option.dataset.display || nameEn);
          const cropEmoji = String(option.dataset.emoji || "").trim() || getDefaultCropEmoji(nameEn, nameKh);
          const button = document.createElement("button");

          button.type = "button";
          button.className = `wiz-crop-card${id === state.cropId ? " active" : ""}`;
          button.setAttribute("aria-pressed", id === state.cropId ? "true" : "false");
          button.innerHTML = `
            <span class="wiz-crop-em wiz-crop-em-emoji" aria-hidden="true">${esc(cropEmoji)}</span>
            <span class="wiz-crop-name">${esc(display)}</span>
          `;
          button.addEventListener("click", () => onCropSelected(id, nameEn, nameKh));
          cropGrid.appendChild(button);
        });
      }

      showScreen(scrCrop);
    }

    function showSubtypeScreen() {
      state.screen = "subtype";
      state.curStep = 2;
      updateProgress();
      updateBackButton();

      if (subtypeList) {
        subtypeList.innerHTML = "";
        RICE_SUBTYPES.forEach((subtype) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `wiz-opt-card${subtype.id === state.subtype ? " active" : ""}`;
          button.setAttribute("aria-pressed", subtype.id === state.subtype ? "true" : "false");
          button.innerHTML = `
            <span class="wiz-opt-em">${iconHtml(subtype.icon)}</span>
            <span class="wiz-opt-body">
              <span class="wiz-opt-name">${esc(subtype.name)}</span>
              <span class="wiz-opt-name2">${esc(subtype.secondary)}</span>
              <span class="wiz-opt-desc">${esc(subtype.description)}</span>
            </span>
          `;
          button.addEventListener("click", () => onSubtypeSelected(subtype.id));
          subtypeList.appendChild(button);
        });
      }

      showScreen(scrSubtype);
    }

    function showSymptomScreen() {
      state.screen = "symptom";
      state.curStep = 1 + (state.isRice ? 1 : 0) + 1;
      updateProgress();
      updateBackButton();

      if (symSearchInput) {
        symSearchInput.value = "";
      }
      if (symNoSearchMatch) symNoSearchMatch.classList.add("d-none");

      if (symCropTag) {
        let tag = localizedText(state.cropNameEn, state.cropNameKh, state.cropNameEn);

        if (state.subtype) {
          const subtype = RICE_SUBTYPES.find((item) => item.id === state.subtype);
          if (subtype) tag += ` / ${subtype.name}`;
        }

        symCropTag.textContent = tag;
      }

      if (symChipsGrid) {
        symChipsGrid.innerHTML = "";

        state.symptoms.forEach((symptom) => {
          const isSelected = Boolean(state.selected[symptom.id]);
          const symptomName = symptom.name || localizedText(symptom.nameEn, symptom.nameKh, symptom.nameEn);
          const chip = document.createElement("button");

          chip.type = "button";
          chip.className = `sym-chip${isSelected ? " sel" : ""}`;
          chip.dataset.id = symptom.id;
          chip.setAttribute("aria-pressed", isSelected ? "true" : "false");
          chip.innerHTML = `
            <span class="sym-chip-row">
              <span class="sym-chip-check">${iconHtml("fa-check")}</span>
              <span>
                <span class="sym-chip-kh">${esc(symptomName)}</span>
              </span>
            </span>
          `;

          chip.addEventListener("click", () => toggleChip(symptom.id, chip));
          symChipsGrid.appendChild(chip);
        });
      }

      if (symNoData) symNoData.classList.toggle("d-none", state.symptoms.length > 0);
      if (symChipsGrid) symChipsGrid.style.display = state.symptoms.length > 0 ? "" : "none";

      updateSelectionUI();
      showScreen(scrSymptom);
    }

    function onCropSelected(cropId, nameEn, nameKh) {
      state.cropId = String(cropId);
      state.cropNameEn = nameEn || "";
      state.cropNameKh = nameKh || "";
      state.isRice = isRiceCrop(nameEn, nameKh);
      state.symptoms = getAllSymptoms(cropId);
      state.selected = {};
      state.totalSteps = computeTotalSteps();
      setAlert("");
      syncCropContext(cropId);

      if (state.isRice) showSubtypeScreen();
      else showSymptomScreen();
    }

    function onSubtypeSelected(subtypeId) {
      state.subtype = subtypeId;
      if (subtypeInput) subtypeInput.value = subtypeId;
      showSymptomScreen();
    }

    function goBack() {
      setAlert("");
      if (state.screen === "symptom") {
        if (state.isRice) showSubtypeScreen();
        else showCropScreen();
      } else if (state.screen === "subtype") {
        showCropScreen();
      }
    }

    function submitDiagnosis() {
      setAlert("");

      if (!state.cropId) {
        setAlert(label("invalidCrop", "Please select a crop."));
        return;
      }

      const yesIds = state.symptoms
        .filter((symptom) => state.selected[symptom.id])
        .map((symptom) => symptom.id);

      if (!yesIds.length) {
        setAlert(label("invalidSymptoms", "Please select at least one symptom."));
        return;
      }

      if (selectedInputs) {
        selectedInputs.innerHTML = "";
        yesIds.forEach((id) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "symptoms";
          input.value = id;
          selectedInputs.appendChild(input);
        });
      }

      if (deniedInputs) deniedInputs.innerHTML = "";
      if (clarPayload) clarPayload.value = "[]";
      if (clarCount) clarCount.value = "0";

      if (btnDiagnose) {
        btnDiagnose.disabled = true;
        btnDiagnose.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>${label("analyzing")}`;
      }

      submitForm();
    }

    if (wizBackBtn) wizBackBtn.addEventListener("click", goBack);
    if (btnDiagnose) btnDiagnose.addEventListener("click", submitDiagnosis);
    if (cropSearchInput) cropSearchInput.addEventListener("input", () => filterCrops(cropSearchInput.value));
    if (symSearchInput) symSearchInput.addEventListener("input", () => filterSymptoms(symSearchInput.value));
    if (symClearAllBtn) symClearAllBtn.addEventListener("click", clearAllSymptoms);

    showScreen(scrLoading);
    window.setTimeout(showCropScreen, 80);

    if (initialCropId && cropSelect) {
      const option = Array.from(cropSelect.options).find((item) => String(item.value) === initialCropId);
      if (option) {
        window.setTimeout(() => {
          onCropSelected(
            option.value,
            String(option.dataset.nameEn || option.text || ""),
            String(option.dataset.nameKh || ""),
          );
        }, 120);
      }
    }

    return;
  }

  const scanSubmitBtn = document.getElementById("scanSubmitBtn");
  const hdSubmitDesc = document.getElementById("hdSubmitDesc");
  const openCameraBtn = document.getElementById("simpleOpenCameraBtn");
  const stopCameraBtn = document.getElementById("simpleStopCameraBtn");
  const captureBtn = document.getElementById("simpleCaptureBtn");
  const retakeBtn = document.getElementById("simpleRetakeBtn");
  const cameraSelect = document.getElementById("simpleCameraSelect");
  const cameraVideo = document.getElementById("simpleCameraVideo");
  const cameraPreview = document.getElementById("simpleCameraPreview");
  const cameraEmpty = document.getElementById("simpleCameraEmpty");
  const cameraStatus = document.getElementById("simpleCameraStatus");
  const analyzeBtn = document.getElementById("simpleAnalyzeScanBtn");
  const cropMirror = document.getElementById("scanCropMirror");

  let liveCameraStream = null;
  let activeCameraDevice = "";
  let cameraPreviewUrl = "";
  let scanInFlight = false;

  function setCamStatus(message) {
    if (cameraStatus) cameraStatus.textContent = String(message || "").trim();
  }

  function readActiveFile() {
    return imageInput && imageInput.files && imageInput.files.length ? imageInput.files[0] : null;
  }

  function syncScanHidden() {
    if (selectedInputs) selectedInputs.innerHTML = selectedInputs.innerHTML || "";
  }

  function updateSubmitDesc() {
    const cropValue = String(cropSelect ? cropSelect.value : "").trim();
    const submitBar = document.getElementById("scanSubmitBar");
    const submitIcon = document.getElementById("hdSubmitIcon");
    const confirmEl = document.getElementById("scanCropConfirm");
    const confirmLabel = document.getElementById("scanCropConfirmLabel");
    const cropCard = document.querySelector(".diag-scan-grid .diag-card");

    if (!cropValue) {
      if (hdSubmitDesc) hdSubmitDesc.textContent = label("qaSubmitNoCrop", "Select a crop first.");
      if (submitIcon) submitIcon.textContent = "🌿";
      if (submitBar) submitBar.classList.remove("has-crop");
      if (confirmEl) confirmEl.classList.add("d-none");
      if (cropCard) cropCard.classList.remove("crop-card-selected");
      return;
    }

    const cropOpt = cropSelect
      ? Array.from(cropSelect.options).find((o) => o.value === cropValue)
      : null;
    const mirrorOpt = cropMirror
      ? Array.from(cropMirror.options).find((o) => o.value === cropValue)
      : null;

    const emoji = String((cropOpt && cropOpt.dataset.emoji) || "").trim() || "🌱";
    const name = String(
      (mirrorOpt && mirrorOpt.textContent.trim())
      || (cropOpt && cropOpt.textContent.trim())
      || cropValue
    );

    if (hdSubmitDesc) hdSubmitDesc.textContent = name;
    if (submitIcon) submitIcon.textContent = emoji;
    if (submitBar) submitBar.classList.add("has-crop");
    if (cropCard) cropCard.classList.add("crop-card-selected");
    if (confirmEl && confirmLabel) {
      confirmLabel.textContent = `${emoji} ${name}`;
      confirmEl.classList.remove("d-none");
    }
  }

  function hasCameraSupport() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function isSecureContext() {
    if (window.isSecureContext) return true;
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function stopCamera() {
    if (liveCameraStream) {
      liveCameraStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          // The stream is already closing; nothing else is needed.
        }
      });
      liveCameraStream = null;
    }

    if (cameraVideo) {
      cameraVideo.pause();
      cameraVideo.srcObject = null;
      cameraVideo.classList.add("d-none");
    }

    if (captureBtn) captureBtn.disabled = true;
    if (stopCameraBtn) stopCameraBtn.disabled = true;
    if (openCameraBtn) openCameraBtn.classList.remove("d-none");
  }

  function showCapturedPreview(file) {
    const preview = document.getElementById("hdImagePreview");
    const thumb = document.getElementById("hdImageThumb");
    const nameEl = document.getElementById("hdImageName");
    const sizeEl = document.getElementById("hdImageSize");
    const dropZone = document.getElementById("hdDropZone");

    if (!preview) return;

    if (!file) {
      preview.classList.add("d-none");
      if (dropZone) dropZone.style.display = "";
      if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
      cameraPreviewUrl = "";
      if (cameraPreview) {
        cameraPreview.src = "";
        cameraPreview.classList.add("d-none");
      }
      if (cameraEmpty) cameraEmpty.classList.remove("d-none");
      return;
    }

    if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    cameraPreviewUrl = URL.createObjectURL(file);

    if (thumb) thumb.src = cameraPreviewUrl;
    if (nameEl) nameEl.textContent = file.name || "field-image.jpg";
    if (sizeEl) sizeEl.textContent = `${Math.round(file.size / 1024)} KB`;

    preview.classList.remove("d-none");
    if (dropZone) dropZone.style.display = "none";

    if (cameraPreview) {
      cameraPreview.src = cameraPreviewUrl;
      cameraPreview.classList.remove("d-none");
    }

    if (cameraEmpty) cameraEmpty.classList.add("d-none");
    if (retakeBtn) retakeBtn.classList.remove("d-none");
  }

  function getCameraError(error) {
    const name = error && error.name ? String(error.name) : "";

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return label("cameraPermissionDenied", "Camera permission denied.");
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return label("cameraNoDevice", "No camera found.");
    }

    return label("cameraOpenFailed", "Unable to open camera.");
  }

  async function loadCameraDevices() {
    if (!cameraSelect || !hasCameraSupport()) return;

    let devices = [];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (error) {
      devices = [];
    }

    const cameras = devices.filter((device) => device.kind === "videoinput");
    cameraSelect.innerHTML = "";

    if (!cameras.length) {
      const option = document.createElement("option");
      option.textContent = label("cameraNoDevice", "No camera found.");
      cameraSelect.appendChild(option);
      cameraSelect.disabled = true;
      return;
    }

    cameras.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId || "";
      option.textContent = String(device.label || "").trim()
        || `${label("cameraSelectLabel", "Camera")} ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    if (activeCameraDevice) cameraSelect.value = activeCameraDevice;
    cameraSelect.disabled = cameras.length <= 1;
  }

  async function openCamera(deviceId) {
    if (!isSecureContext()) {
      setCamStatus(label("cameraSecureContext", "Camera requires HTTPS or localhost."));
      return;
    }

    if (!hasCameraSupport()) {
      setCamStatus(label("cameraUnsupported", "Camera not supported on this browser."));
      return;
    }

    if (!cameraVideo) return;
    stopCamera();

    const constraints = {
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };

    if (deviceId) constraints.video.deviceId = { exact: deviceId };
    else constraints.video.facingMode = { ideal: "environment" };

    try {
      liveCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      try {
        liveCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (fallbackError) {
        setCamStatus(getCameraError(fallbackError));
        return;
      }
    }

    cameraVideo.srcObject = liveCameraStream;

    try {
      await cameraVideo.play();
    } catch (error) {
      setCamStatus(label("cameraOpenFailed", "Unable to open camera."));
      stopCamera();
      return;
    }

    const track = liveCameraStream.getVideoTracks()[0];
    const settings = track && track.getSettings ? track.getSettings() : {};
    activeCameraDevice = String(settings.deviceId || deviceId || "");
    await loadCameraDevices();

    if (cameraSelect && activeCameraDevice) cameraSelect.value = activeCameraDevice;
    cameraVideo.classList.remove("d-none");
    if (cameraEmpty) cameraEmpty.classList.add("d-none");
    if (captureBtn) captureBtn.disabled = false;
    if (stopCameraBtn) stopCameraBtn.disabled = false;
    if (openCameraBtn) openCameraBtn.classList.add("d-none");

    setCamStatus(label("cameraReady", "Camera ready."));
  }

  function captureFrame() {
    if (!cameraVideo || !imageInput || !liveCameraStream) return;

    const width = cameraVideo.videoWidth || 1280;
    const height = cameraVideo.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(cameraVideo, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCamStatus("Capture failed.");
        return;
      }

      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });

      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        imageInput.files = transfer.files;
      } catch (error) {
        // Older browsers may not allow programmatic file assignment.
      }

      stopCamera();
      showCapturedPreview(file);
      setCamStatus(label("cameraCaptured", "Photo captured."));
      if (analyzeBtn) analyzeBtn.disabled = false;

      if (scanSuggestionApi && cropSelect && cropSelect.value) analyzeScan();
    }, "image/jpeg", 0.92);
  }

  async function analyzeScan() {
    if (!scanSuggestionApi || scanInFlight) return;

    const cropId = String(cropSelect ? cropSelect.value : "").trim();
    if (!cropId) {
      setAlert(label("invalidCrop", "Please select a crop."));
      return;
    }

    const file = readActiveFile();
    if (!file) {
      setAlert(label("imageRequired", "Please upload an image first."));
      return;
    }

    scanInFlight = true;
    if (analyzeBtn) analyzeBtn.disabled = true;
    setAlert("");
    setCamStatus(label("scanAnalyzing", "Analyzing image..."));

    const payload = new FormData();
    payload.append("crop_id", cropId);
    payload.append("field_image", file, file.name || "scan.jpg");

    try {
      const response = await fetch(scanSuggestionApi, {
        method: "POST",
        body: payload,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }

      if (!response.ok || !body || !body.ok) {
        const message = body && body.error
          ? String(body.error)
          : label("scanApiUnavailable", "Unable to analyze this image.");
        setAlert(message);
        setCamStatus(message);
        return;
      }

      const ids = (Array.isArray(body.suggestions) ? body.suggestions : [])
        .map((item) => String(item && item.id ? item.id : "").trim())
        .filter(Boolean);

      if (ids.length && selectedInputs) {
        selectedInputs.innerHTML = "";
        ids.forEach((id) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "symptoms";
          input.value = id;
          selectedInputs.appendChild(input);
        });
      }

      setCamStatus(
        ids.length
          ? label("scanApplied", "Applied {count} symptom(s).").replace("{count}", ids.length)
          : label("scanNoSuggestion", "No confident symptom suggestions were found."),
      );

      if (instantScanMode && ids.length) {
        setCamStatus(label("scanAutoSubmitting", "Submitting diagnosis automatically..."));
        window.setTimeout(submitForm, 280);
      }
    } catch (error) {
      const message = label("scanApiFailed", "Analyze failed. Please try again.");
      setAlert(message);
      setCamStatus(message);
    } finally {
      scanInFlight = false;
      if (analyzeBtn) analyzeBtn.disabled = false;
    }
  }

  if (scanSubmitBtn) {
    scanSubmitBtn.addEventListener("click", () => {
      setAlert("");
      const cropId = cropSelect ? cropSelect.value : "";

      if (!cropId) {
        setAlert(label("invalidCrop", "Please select a crop."));
        return;
      }

      const file = readActiveFile();
      if (scanMode && !file) {
        setAlert(label("imageRequired", "Please upload or capture an image."));
        return;
      }

      syncScanHidden();
      submitForm();
    });
  }

  if (openCameraBtn) {
    openCameraBtn.addEventListener("click", () => openCamera(cameraSelect ? String(cameraSelect.value || "") : ""));
  }

  if (stopCameraBtn) {
    stopCameraBtn.addEventListener("click", () => {
      stopCamera();
      if (cameraEmpty) cameraEmpty.classList.remove("d-none");
    });
  }

  if (captureBtn) captureBtn.addEventListener("click", captureFrame);
  if (analyzeBtn) analyzeBtn.addEventListener("click", analyzeScan);

  if (retakeBtn) {
    retakeBtn.addEventListener("click", () => {
      if (imageInput) imageInput.value = "";
      showCapturedPreview(null);
      openCamera(cameraSelect ? String(cameraSelect.value || "") : "");
      if (analyzeBtn) analyzeBtn.disabled = true;
    });
  }

  if (cameraSelect) {
    cameraSelect.addEventListener("change", () => {
      if (liveCameraStream) openCamera(String(cameraSelect.value || ""));
    });
  }

  if (cropMirror) {
    cropMirror.addEventListener("change", () => {
      syncCropContext(cropMirror.value);
      updateSubmitDesc();
    });
  }

  if (imageInput) {
    imageInput.addEventListener("change", () => {
      const file = readActiveFile();
      showCapturedPreview(file);
      if (analyzeBtn) analyzeBtn.disabled = !file;
      if (file && scanSuggestionApi && cropSelect && cropSelect.value) analyzeScan();
    });
  }

  const imageClear = document.getElementById("hdImageClear");
  if (imageClear) {
    imageClear.addEventListener("click", () => {
      if (imageInput) imageInput.value = "";
      showCapturedPreview(null);
      if (analyzeBtn) analyzeBtn.disabled = true;
    });
  }

  window.addEventListener("beforeunload", stopCamera);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCamera();
  });

  updateSubmitDesc();

  if (!isSecureContext()) setCamStatus(label("cameraSecureContext", "Camera requires HTTPS or localhost."));
  else if (!hasCameraSupport()) setCamStatus(label("cameraUnsupported", "Camera not supported on this browser."));
  else loadCameraDevices();

  if (instantScanMode && isSecureContext() && hasCameraSupport()) {
    openCamera(cameraSelect ? String(cameraSelect.value || "") : "");
  }

  if (initialCropId && cropSelect) {
    syncCropContext(initialCropId);
    if (cropMirror) cropMirror.value = initialCropId;
    updateSubmitDesc();
  }
})();
