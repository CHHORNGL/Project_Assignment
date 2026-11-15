import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CloudRain,
  Compass,
  Droplets,
  Loader2,
  MapPin,
  RefreshCw,
  Thermometer,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildOfflineWeatherPayload,
  loadCachedWeatherPayload,
  resolveWeatherOutcome,
  saveCachedWeatherPayload,
  type WeatherAttribution,
  type WeatherPayload,
} from "@/lib/weatherHelpers";

interface WeatherProps {
  endpoint: string;
  lang: "en" | "km";
  fallbackLat: number;
  fallbackLon: number;
  labels: Record<string, string>;
}

export function WeatherIntelligenceCard({ endpoint, lang, fallbackLat, fallbackLon, labels }: WeatherProps) {
  const isKhmer = lang === "km";
  const storage = typeof window !== "undefined" ? window.localStorage : null;
  const retryTimerRef = useRef<number | null>(null);
  const [payload, setPayload] = useState<WeatherPayload | null>(() => loadCachedWeatherPayload(storage, lang));
  const [loading, setLoading] = useState(!payload);
  const [statusText, setStatusText] = useState<string>(labels.loadingWeather || "Syncing local weather...");
  const [attribution, setAttribution] = useState<WeatherAttribution | null>(null);

  const fetchWeather = async () => {
    if (retryTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setLoading(true);
    let lat = fallbackLat || 11.5564;
    let lon = fallbackLon || 104.9282;

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => resolve(), 3500);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            window.clearTimeout(timer);
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            resolve();
          },
          () => {
            window.clearTimeout(timer);
            resolve();
          },
          { timeout: 3500, maximumAge: 600000 },
        );
      });
    }

    const coords = { lat, lon };
    try {
      const sep = endpoint.includes("?") ? "&" : "?";
      const resp = await fetch(`${endpoint}${sep}lat=${lat}&lon=${lon}&lang=${lang}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Weather request failed");
      const data = (await resp.json()) as WeatherPayload;
      const saved = loadCachedWeatherPayload(storage, lang, coords);
      const outcome = resolveWeatherOutcome(data, saved, lang);
      setPayload(outcome.displayPayload);
      setStatusText(outcome.statusText);
      setAttribution(outcome.attribution);
      saveCachedWeatherPayload(storage, lang, data);
      if (outcome.retryDelayMs !== null && typeof window !== "undefined") {
        retryTimerRef.current = window.setTimeout(() => void fetchWeather(), outcome.retryDelayMs);
      }
    } catch {
      const fallback = loadCachedWeatherPayload(storage, lang, coords);
      if (fallback) {
        setPayload(fallback);
        setStatusText(isKhmer ? "គ្មានអ៊ីនធឺណិត | បង្ហាញទិន្នន័យចុងក្រោយ" : "Offline | Showing last weather snapshot");
      } else {
        setPayload(buildOfflineWeatherPayload(lang));
        setAttribution(null);
        setStatusText(isKhmer ? "មិនអាចភ្ជាប់សេវាអាកាសធាតុ" : "Weather service temporarily unavailable");
      }
      if (typeof window !== "undefined") {
        retryTimerRef.current = window.setTimeout(() => void fetchWeather(), 60_000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWeather();
    return () => {
      if (retryTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, [endpoint, lang]);

  const current = payload?.current || {};
  const analytics = payload?.analytics || {};
  const alerts = payload?.alerts || [];
  const forecast = payload?.forecast || [];
  const recommendations = payload?.recommendations || [];

  return (
    <div id="weather-intelligence-card" className="ai-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-indigo-500" />
            <h2 className="font-display text-base font-bold">{labels.title || "Weather Intelligence"}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {statusText}
            {payload?.location?.name ? ` · ${payload.location.name}` : ""}
          </p>
        </div>
        <button type="button" onClick={fetchWeather} disabled={loading} className="ai-btn-secondary h-8 px-3 text-xs">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {isKhmer ? "ផ្ទុកឡើងវិញ" : "Sync"}
        </button>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {/* Current Conditions + Analytics */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white shadow-lg shadow-indigo-500/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="inline-flex items-center gap-1 text-xs font-medium text-indigo-100">
                  <MapPin className="h-3.5 w-3.5" />
                  {payload?.location?.name || (isKhmer ? "ទីតាំងកសិដ្ឋាន" : "Farm Location")}
                </p>
                <p className="mt-2 font-display text-4xl font-extrabold">
                  {current.temp_c !== undefined ? `${current.temp_c}°C` : "--"}
                </p>
                <p className="mt-1 text-sm font-medium text-indigo-100">{current.condition || "--"}</p>
              </div>
              <Thermometer className="h-8 w-8 text-white/75" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-xs">
              <div>
                <span className="flex items-center gap-1 text-indigo-100">
                  <Droplets className="h-3 w-3" /> {labels.humidity || "Humidity"}
                </span>
                <p className="mt-0.5 font-bold">
                  {current.humidity_pct !== undefined ? `${Number(current.humidity_pct).toFixed(0)}%` : "--"}
                </p>
              </div>
              <div>
                <span className="flex items-center gap-1 text-indigo-100">
                  <Wind className="h-3 w-3" /> {labels.wind || "Wind"}
                </span>
                <p className="mt-0.5 font-bold">
                  {current.wind_kph !== undefined ? `${Number(current.wind_kph).toFixed(1)} km/h` : "--"}
                </p>
              </div>
              <div>
                <span className="flex items-center gap-1 text-indigo-100">
                  <CloudRain className="h-3 w-3" /> {labels.rain || "Rain"}
                </span>
                <p className="mt-0.5 font-bold">
                  {current.rain_mm !== undefined ? `${Number(current.rain_mm).toFixed(1)} mm` : "--"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
              <p className="text-slate-500">{labels.next24hRain || "24h Rain"}</p>
              <p className="mt-1 font-display text-sm font-bold">
                {analytics.rain_next_24h_mm !== undefined ? `${analytics.rain_next_24h_mm.toFixed(1)} mm` : "--"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
              <p className="text-slate-500">{labels.weeklyRain || "7d Rain"}</p>
              <p className="mt-1 font-display text-sm font-bold">
                {analytics.weekly_rain_mm !== undefined ? `${analytics.weekly_rain_mm.toFixed(1)} mm` : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* Smart Alerts + Recommendations */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {labels.alertsTitle || "Smart Alerts"}
          </h3>
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
              <p className="font-semibold">{isKhmer ? "អាកាសធាតុមានស្ថិរភាព" : "Stable field conditions"}</p>
              <p className="mt-0.5 opacity-80">
                {isKhmer ? "មិនមានការព្រមានអាកាសធាតុធ្ងន់ធ្ងរទេ។" : "No extreme weather alerts active."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 3).map((al, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border p-3 text-xs",
                    al.color === "red"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                      : al.color === "orange"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                        : "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
                  )}
                >
                  <p className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {al.title || "Advisory"}
                  </p>
                  <p className="mt-1 opacity-90">{al.recommendation || al.message}</p>
                </div>
              ))}
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="pt-1">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                {labels.recommendTitle || "Agronomy Recommendations"}
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {recommendations.slice(0, 4).map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 7-Day Forecast */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {labels.forecastTitle || "7-Day Outlook"}
          </h3>
          {forecast.length === 0 ? (
            <p className="text-xs text-slate-400">
              {isKhmer ? "កំពុងរង់ចាំទិន្នន័យព្យាករណ៍..." : "Forecast will load shortly..."}
            </p>
          ) : (
            <div className="divide-y divide-slate-200/70 rounded-xl border border-slate-200/80 dark:divide-slate-800/70 dark:border-slate-800">
              {forecast.slice(0, 7).map((day, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {day.date
                      ? new Date(`${day.date}T00:00:00`).toLocaleDateString(isKhmer ? "km-KH" : "en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : `Day ${idx + 1}`}
                  </span>
                  <span className="text-slate-400">
                    {day.rain_mm !== undefined ? `${day.rain_mm}mm` : "--"}
                  </span>
                  <span className="font-mono font-bold">
                    {day.temp_max_c ?? "--"}° / {day.temp_min_c ?? "--"}°
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {attribution && (
        <div className="border-t border-slate-200/70 px-6 py-3 text-[11px] text-slate-400 dark:border-slate-800/70">
          {attribution.prefix}{" "}
          <a href={attribution.providerUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-500">
            {attribution.providerName}
          </a>{" "}
          ·{" "}
          <a href={attribution.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-500">
            {attribution.licenseLabel}
          </a>
          {attribution.note ? ` · ${attribution.note}` : ""}
        </div>
      )}
    </div>
  );
}
