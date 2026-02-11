(function () {
    const root = document.getElementById("weather-intelligence-card");
    if (!root) return;

    const CACHE_KEY_PREFIX = "agri_weather_intel_payload_v3";
    const LOCATION_KEY = "agri_weather_intel_location_v1";
    const GEO_TIMEOUT_MS = 5500;
    const REQUEST_TIMEOUT_MS = 8500;

    const endpoint = String(root.dataset.weatherEndpoint || "").trim();
    const fallbackLat = Number(root.dataset.fallbackLat || 0) || 11.5564;
    const fallbackLon = Number(root.dataset.fallbackLon || 0) || 104.9282;
    const lang = root.dataset.lang === "km" ? "km" : "en";
    const CACHE_KEY = `${CACHE_KEY_PREFIX}_${lang}`;
    const locale = lang === "km" ? "km-KH" : undefined;

    const I18N = {
        en: {
            status_loading_location: "Loading location...",
            status_loading_weather: "Loading weather...",
            status_cached_refreshing: "Cached | Refreshing...",
            status_offline_cache: "Offline | Showing last weather snapshot",
            status_offline_unavailable: "Offline | Weather unavailable",
            status_updated: "Updated",
            source_live: "Live",
            source_cache: "Cached",
            source_fallback: "Fallback",
            source_stale: "Stale cache",
            no_alert_title: "No weather alerts",
            no_alert_message: "The weather looks stable for now.",
            no_recommend: "No recommendations are available right now.",
            no_network_title: "No network weather data",
            no_network_reco_1: "Please reconnect internet and refresh for live weather alerts.",
            no_network_reco_2: "Use local sky and wind observations before spraying.",
            no_network_reco_3: "Delay high-risk field actions until live weather returns.",
        },
        km: {
            status_loading_location: "កំពុងកំណត់ទីតាំង...",
            status_loading_weather: "កំពុងផ្ទុកអាកាសធាតុ...",
            status_cached_refreshing: "ទិន្នន័យសន្សំ | កំពុងធ្វើបច្ចុប្បន្នភាព...",
            status_offline_cache: "គ្មានអ៊ីនធឺណិត | បង្ហាញទិន្នន័យចុងក្រោយ",
            status_offline_unavailable: "គ្មានអ៊ីនធឺណិត | មិនមានទិន្នន័យអាកាសធាតុ",
            status_updated: "បានធ្វើបច្ចុប្បន្នភាព",
            source_live: "ផ្ទាល់",
            source_cache: "ទិន្នន័យសន្សំ",
            source_fallback: "ទិន្នន័យជំនួស",
            source_stale: "ទិន្នន័យសន្សំចាស់",
            no_alert_title: "មិនមានការជូនដំណឹងអាកាសធាតុ",
            no_alert_message: "អាកាសធាតុស្ថិរភាពសម្រាប់ឥឡូវនេះ។",
            no_recommend: "មិនមានអនុសាសន៍ថ្មីនៅពេលនេះទេ។",
            no_network_title: "មិនអាចទាញទិន្នន័យអាកាសធាតុតាមអ៊ីនធឺណិតបាន",
            no_network_reco_1: "សូមភ្ជាប់អ៊ីនធឺណិតឡើងវិញ ហើយ Refresh ដើម្បីទាញទិន្នន័យផ្ទាល់។",
            no_network_reco_2: "សូមសង្កេតមេឃ និងខ្យល់នៅតំបន់ជាក់ស្តែង មុនបាញ់ថ្នាំ។",
            no_network_reco_3: "ពន្យារពេលការងារហានិភ័យខ្ពស់ រហូតទិន្នន័យអាកាសធាតុត្រលប់មកវិញ។",
        },
    };

    function tt(key) {
        const langPack = I18N[lang] || I18N.en;
        return langPack[key] || I18N.en[key] || key;
    }

    const statusEl = document.getElementById("wi-status");
    const tempEl = document.getElementById("wi-temp");
    const conditionEl = document.getElementById("wi-condition");
    const iconEl = document.getElementById("wi-current-icon");
    const humidityEl = document.getElementById("wi-humidity");
    const windEl = document.getElementById("wi-wind");
    const rainEl = document.getElementById("wi-rain");
    const rain24hEl = document.getElementById("wi-rain-24h");
    const maxWind24hEl = document.getElementById("wi-max-wind-24h");
    const avgTemp24hEl = document.getElementById("wi-avg-temp-24h");
    const rainWeekEl = document.getElementById("wi-rain-week");
    const alertListEl = document.getElementById("wi-alert-list");
    const forecastGridEl = document.getElementById("wi-forecast-grid");
    const recommendListEl = document.getElementById("wi-recommend-list");

    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatMetric(value, suffix, fallback) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
            return fallback || "--";
        }
        return `${Number(value).toFixed(1)}${suffix}`;
    }

    function formatDateLabel(dateIso) {
        if (!dateIso) return "--";
        const dt = new Date(`${dateIso}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return dateIso;
        return dt.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
    }

    function relativeUpdatedAt(iso) {
        if (!iso) return "";
        const dt = new Date(iso);
        if (Number.isNaN(dt.getTime())) return "";
        return dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    }

    function setCurrent(current) {
        if (!current) return;
        if (tempEl) tempEl.textContent = current.temp_c ?? "--";
        if (conditionEl) conditionEl.textContent = current.condition || "--";
        if (iconEl) iconEl.className = current.icon || "fas fa-cloud-sun";
        if (humidityEl) humidityEl.textContent = formatMetric(current.humidity_pct, "%", "--%");
        if (windEl) windEl.textContent = formatMetric(current.wind_kph, " km/h", "-- km/h");
        if (rainEl) rainEl.textContent = formatMetric(current.rain_mm, " mm", "-- mm");
    }

    function setAnalytics(analytics) {
        if (!analytics) return;
        if (rain24hEl) rain24hEl.textContent = formatMetric(analytics.rain_next_24h_mm, " mm", "-- mm");
        if (maxWind24hEl) maxWind24hEl.textContent = formatMetric(analytics.max_wind_next_24h_kph, " km/h", "-- km/h");
        if (avgTemp24hEl) avgTemp24hEl.textContent = formatMetric(analytics.avg_temp_next_24h_c, " C", "-- C");
        if (rainWeekEl) rainWeekEl.textContent = formatMetric(analytics.weekly_rain_mm, " mm", "-- mm");
    }

    function alertClass(color) {
        if (color === "red") return "wi-alert wi-alert-red";
        if (color === "orange") return "wi-alert wi-alert-orange";
        if (color === "green") return "wi-alert wi-alert-green";
        return "wi-alert wi-alert-blue";
    }

    function setAlerts(alerts) {
        if (!alertListEl) return;
        const list = Array.isArray(alerts) ? alerts.slice(0, 4) : [];
        if (!list.length) {
            alertListEl.innerHTML = (
                `<div class="wi-alert wi-alert-blue">` +
                `<div class="wi-alert-title">${escapeHtml(tt("no_alert_title"))}</div>` +
                `<div class="wi-alert-msg">${escapeHtml(tt("no_alert_message"))}</div>` +
                `</div>`
            );
            return;
        }

        alertListEl.innerHTML = list
            .map((item) => {
                const title = escapeHtml(item.title || "Weather update");
                const message = escapeHtml(item.recommendation || item.message || "");
                return (
                    `<div class="${alertClass(item.color)}">` +
                    `<div class="wi-alert-title">${title}</div>` +
                    `<div class="wi-alert-msg">${message}</div>` +
                    `</div>`
                );
            })
            .join("");
    }

    function setForecast(forecast) {
        if (!forecastGridEl) return;
        const days = Array.isArray(forecast) ? forecast.slice(0, 7) : [];
        forecastGridEl.innerHTML = days
            .map((day, index) => {
                const maxTemp = day.temp_max_c === null || day.temp_max_c === undefined ? "--" : `${day.temp_max_c} C`;
                const minTemp = day.temp_min_c === null || day.temp_min_c === undefined ? "--" : `${day.temp_min_c} C`;
                const rain = day.rain_mm === null || day.rain_mm === undefined ? "--" : `${day.rain_mm} mm`;
                const icon = escapeHtml(day.icon || "fas fa-cloud");
                const dateLabel = escapeHtml(formatDateLabel(day.date));
                return (
                    `<div class="wi-forecast-day" style="animation-delay:${index * 0.04}s;">` +
                    `<span class="wi-forecast-date">${dateLabel}</span>` +
                    `<i class="${icon}"></i>` +
                    `<span class="wi-forecast-temp">${escapeHtml(maxTemp)} / ${escapeHtml(minTemp)}</span>` +
                    `<span class="wi-forecast-rain">${escapeHtml(rain)}</span>` +
                    `</div>`
                );
            })
            .join("");
    }

    function setRecommendations(recommendations) {
        if (!recommendListEl) return;
        const items = Array.isArray(recommendations) ? recommendations.slice(0, 5) : [];
        if (!items.length) {
            recommendListEl.innerHTML = `<li>${escapeHtml(tt("no_recommend"))}</li>`;
            return;
        }
        recommendListEl.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    }

    function render(payload) {
        if (!payload || typeof payload !== "object") return;
        setCurrent(payload.current || {});
        setAnalytics(payload.analytics || {});
        setAlerts(payload.alerts || []);
        setForecast(payload.forecast || []);
        setRecommendations(payload.recommendations || []);

        const meta = payload.meta || {};
        const source = meta.source || "live";
        const updatedAt = relativeUpdatedAt(meta.generated_at);

        let sourceLabel = tt("source_live");
        if (source === "cache") sourceLabel = tt("source_cache");
        if (source === "stale-cache") sourceLabel = tt("source_stale");
        if (source === "fallback") sourceLabel = tt("source_fallback");

        const updatedLabel = updatedAt ? ` | ${tt("status_updated")} ${updatedAt}` : "";
        setStatus(`${sourceLabel}${updatedLabel}`);
    }

    function savePayload(payload) {
        try {
            localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    stored_at: Date.now(),
                    payload,
                })
            );
        } catch (error) {
            // Ignore browser storage failures.
        }
    }

    function loadPayload() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const payload = parsed && parsed.payload ? parsed.payload : null;
            if (!payload) return null;
            const payloadLang = String(((payload.meta || {}).lang || "")).toLowerCase();
            if (payloadLang && payloadLang !== lang) {
                return null;
            }
            return payload;
        } catch (error) {
            return null;
        }
    }

    function saveLocation(coords) {
        try {
            localStorage.setItem(LOCATION_KEY, JSON.stringify(coords));
        } catch (error) {
            // Ignore browser storage failures.
        }
    }

    function loadLocation() {
        try {
            const raw = localStorage.getItem(LOCATION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
                return parsed;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    function resolveLocation() {
        return new Promise((resolve) => {
            const stored = loadLocation();
            const fallback = stored || { lat: fallbackLat, lon: fallbackLon };
            if (!navigator.geolocation) {
                resolve(fallback);
                return;
            }

            let settled = false;
            const timer = window.setTimeout(() => {
                if (settled) return;
                settled = true;
                resolve(fallback);
            }, GEO_TIMEOUT_MS);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timer);
                    const coords = {
                        lat: Number(position.coords.latitude),
                        lon: Number(position.coords.longitude),
                    };
                    saveLocation(coords);
                    resolve(coords);
                },
                () => {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timer);
                    resolve(fallback);
                },
                {
                    enableHighAccuracy: false,
                    timeout: GEO_TIMEOUT_MS - 500,
                    maximumAge: 10 * 60 * 1000,
                }
            );
        });
    }

    async function fetchSummary(lat, lon) {
        if (!endpoint) throw new Error("Weather endpoint is not configured.");
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const url = `${endpoint}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&lang=${encodeURIComponent(lang)}`;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: { Accept: "application/json" },
                signal: controller.signal,
                credentials: "same-origin",
            });
            if (!response.ok) {
                throw new Error(`Weather API returned status ${response.status}`);
            }
            return await response.json();
        } finally {
            window.clearTimeout(timeout);
        }
    }

    async function loadWeather() {
        const cached = loadPayload();
        if (cached) {
            render(cached);
            setStatus(tt("status_cached_refreshing"));
        } else {
            setStatus(tt("status_loading_weather"));
        }

        try {
            const coords = await resolveLocation();
            const livePayload = await fetchSummary(coords.lat, coords.lon);
            render(livePayload);
            savePayload(livePayload);
        } catch (error) {
            const fallback = loadPayload();
            if (fallback) {
                render(fallback);
                setStatus(tt("status_offline_cache"));
            } else {
                setStatus(tt("status_offline_unavailable"));
                setAlerts([
                    {
                        color: "orange",
                        title: tt("no_network_title"),
                        recommendation: tt("no_network_reco_1"),
                    },
                ]);
                setRecommendations([tt("no_network_reco_2"), tt("no_network_reco_3")]);
            }
        }
    }

    function startLazyLoad() {
        if (!("IntersectionObserver" in window)) {
            loadWeather();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    observer.disconnect();
                    loadWeather();
                });
            },
            { rootMargin: "160px 0px 160px 0px" }
        );

        observer.observe(root);
    }

    setStatus(tt("status_loading_location"));
    startLazyLoad();
})();
