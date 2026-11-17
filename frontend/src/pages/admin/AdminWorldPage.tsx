import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Cloud,
  CloudLightning,
  Compass,
  Droplets,
  ExternalLink,
  Gauge,
  Globe,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import type { WeatherPayload } from "@/lib/weatherHelpers";
import {
  WEATHER_LAYERS,
  buildWindyEmbedUrl,
  formatWindCardinal,
  getTemperatureBand,
  type WeatherLayerKey,
  type WeatherModelKey,
} from "@/lib/weatherMapHelpers";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import { useToast } from "@/context/ToastContext";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";
import { StationTelemetrySkeleton } from "@/components/ui/Skeleton";

interface ScanPoint {
  id: string | number;
  label: string;
  region: string;
  group?: string;
  lat?: number;
  lng?: number;
  status: string;
}

interface AdminWorldData {
  scanPoints: ScanPoint[];
  cesiumToken?: string;
  weatherApiUrl?: string;
  defaultCenter: { lat: number; lng: number; label: string };
}

const LAYER_ICONS: Record<WeatherLayerKey, React.ComponentType<{ className?: string }>> = {
  wind: Wind,
  temp: Thermometer,
  rh: Droplets,
  rain: CloudLightning,
  cape: Zap,
  radar: Radio,
  clouds: Cloud,
  pressure: Gauge,
};

export default function AdminWorldPage({ bootstrap }: { bootstrap: AppBootstrap<AdminWorldData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { pushToast } = useToast();

  const [lat, setLat] = useState(d.defaultCenter.lat);
  const [lng, setLng] = useState(d.defaultCenter.lng);
  const [draftLat, setDraftLat] = useState(d.defaultCenter.lat.toFixed(4));
  const [draftLng, setDraftLng] = useState(d.defaultCenter.lng.toFixed(4));
  const [stationLabel, setStationLabel] = useState(d.defaultCenter.label || "Phnom Penh, Cambodia");

  const [layer, setLayer] = useState<WeatherLayerKey>("wind");
  const [model, setModel] = useState<WeatherModelKey>("ecmwf");
  const [zoom, setZoom] = useState<number>(5);
  const [showPressure, setShowPressure] = useState<boolean>(true);
  const [hubGroup, setHubGroup] = useState<"cambodia" | "global">("cambodia");

  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherSource, setWeatherSource] = useState<string>("live");
  const [locating, setLocating] = useState(false);

  const weatherEndpoint = d.weatherApiUrl || "/admin/world/weather";

  const fetchStationWeather = useCallback(
    async (targetLat: number, targetLon: number) => {
      setLoadingWeather(true);
      try {
        const sep = weatherEndpoint.includes("?") ? "&" : "?";
        const url = `${weatherEndpoint}${sep}lat=${encodeURIComponent(targetLat)}&lon=${encodeURIComponent(targetLon)}&lang=${bootstrap.lang}`;
        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) throw new Error("Weather request failed");
        const data = (await resp.json()) as WeatherPayload;
        setWeather(data);
        setWeatherSource(resp.headers.get("X-Weather-Source") || data.meta?.source || "live");
      } catch {
        setWeather(null);
      } finally {
        setLoadingWeather(false);
      }
    },
    [weatherEndpoint, bootstrap.lang],
  );

  useEffect(() => {
    void fetchStationWeather(lat, lng);
  }, [lat, lng, fetchStationWeather]);

  const activeLayerMeta = useMemo(
    () => WEATHER_LAYERS.find((item) => item.key === layer) || WEATHER_LAYERS[0],
    [layer],
  );

  const embedUrl = useMemo(
    () =>
      buildWindyEmbedUrl({
        lat,
        lon: lng,
        zoom,
        overlay: layer,
        product: model,
        showPressure,
      }),
    [lat, lng, zoom, layer, model, showPressure],
  );

  const externalWindyUrl = `https://www.windy.com/?${encodeURIComponent(layer)},${lat.toFixed(3)},${lng.toFixed(3)},${zoom}`;

  const filteredStations = useMemo(
    () => d.scanPoints.filter((pt) => (pt.group || "cambodia") === hubGroup),
    [d.scanPoints, hubGroup],
  );

  const applyCoordinates = (nextLat: number, nextLon: number, label: string, suggestedZoom?: number) => {
    setLat(nextLat);
    setLng(nextLon);
    setDraftLat(nextLat.toFixed(4));
    setDraftLng(nextLon.toFixed(4));
    setStationLabel(label);
    if (suggestedZoom !== undefined) {
      setZoom(suggestedZoom);
    }
  };

  const handleManualCoordsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = Number.parseFloat(draftLat);
    const parsedLng = Number.parseFloat(draftLng);
    if (
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng) ||
      parsedLat < -85 ||
      parsedLat > 85 ||
      parsedLng < -180 ||
      parsedLng > 180
    ) {
      pushToast(
        "danger",
        isKhmer
          ? "កូអរដោនេមិនត្រឹមត្រូវ (Lat: -85..85, Lon: -180..180)។"
          : "Invalid coordinates (Latitude -85..85, Longitude -180..180).",
      );
      return;
    }
    applyCoordinates(parsedLat, parsedLng, `${parsedLat.toFixed(2)}, ${parsedLng.toFixed(2)}`);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      pushToast(
        "warning",
        isKhmer ? "កម្មវិធីរុករកមិនគាំទ្រទីតាំង GPS ទេ។" : "Browser geolocation is not available.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        applyCoordinates(
          pos.coords.latitude,
          pos.coords.longitude,
          isKhmer ? "ទីតាំងបច្ចុប្បន្នរបស់អ្នក" : "Current Location",
          8,
        );
      },
      () => {
        setLocating(false);
        pushToast(
          "warning",
          isKhmer ? "មិនអាចទទួលបានទីតាំង GPS បានទេ។" : "Unable to retrieve device coordinates.",
        );
      },
    );
  };

  const current = weather?.current || {};
  const analytics = weather?.analytics || {};
  const alerts = weather?.alerts || [];
  const forecast = weather?.forecast || [];

  const thermalBand = getTemperatureBand(current.temp_c, isKhmer);
  const windDeg = current.wind_direction_deg;
  const windCardinal = formatWindCardinal(windDeg);
  const hasThunderstorm =
    current.weather_code === 95 || current.weather_code === 96 || current.weather_code === 99;

  const zoomPresets = [
    { z: 3, label: isKhmer ? "ពិភពលោក" : "World", centerOnWorld: true },
    { z: 5, label: isKhmer ? "អាស៊ីអាគ្នេយ៍" : "SE Asia", centerOnWorld: false },
    { z: 7, label: isKhmer ? "កម្ពុជា" : "Country", centerOnWorld: false },
    { z: 9, label: isKhmer ? "តំបន់" : "Local", centerOnWorld: false },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="space-y-6">
        {/* Main Map + Telemetry Layout */}
        <div className="grid gap-6 xl:grid-cols-12">
          {/* Interactive Meteorological Map Column */}
          <AdminSectionCard
            className="min-w-0 xl:col-span-8"
            delayIndex={0}
            noPadding
            title={stationLabel}
            subtitle={isKhmer ? activeLayerMeta.descKm : activeLayerMeta.descEn}
            icon={<Globe className="h-4 w-4" />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge tone="emerald" pulse>
                  {model.toUpperCase()}
                </AdminStatusBadge>
                <a
                  href={externalWindyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Windy</span>
                </a>
              </div>
            }
          >
            {/* Atmospheric Layer Selector */}
            <div className="border-b border-[#e3e6ed] bg-[#f5f7fa]/80 px-4 py-3 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
              <div className="flex flex-wrap items-center gap-1.5">
                {WEATHER_LAYERS.map((item) => {
                  const Icon = LAYER_ICONS[item.key];
                  const active = layer === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setLayer(item.key)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150",
                        active
                          ? "border-[#3874ff] bg-[#3874ff] text-white shadow-sm"
                          : "border-[#cbd0dd]/90 bg-white text-[#31374a] hover:border-[#3874ff]/45 hover:text-[#004dff] dark:border-[#373e53] dark:bg-[#141824] dark:text-[#cbd0dd] dark:hover:border-[#3874ff]/50 dark:hover:text-[#85a9ff]",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{isKhmer ? item.labelKm : item.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Viewport Zoom, Forecast Model & Isobar Controls */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e3e6ed] dark:border-[#2b3245]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer ? "ទំហំមើល" : "Scope"}:
                  </span>
                  {zoomPresets.map((preset) => (
                    <button
                      key={preset.z}
                      type="button"
                      onClick={() => {
                        setZoom(preset.z);
                        if (preset.centerOnWorld) {
                          setLat(18.0);
                          setLng(60.0);
                          setDraftLat("18.0000");
                          setDraftLng("60.0000");
                          setStationLabel(isKhmer ? "ទិដ្ឋភាពពិភពលោក" : "Global View");
                        }
                      }}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                        zoom === preset.z
                          ? "bg-[#e5edff] text-[#004dff] ring-1 ring-[#3874ff]/30 dark:bg-[#3874ff]/20 dark:text-[#85a9ff]"
                          : "text-[#525b75] hover:bg-white dark:text-[#9fa6bc] dark:hover:bg-[#181d2b]",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={layer === "radar"}
                    onClick={() => setShowPressure((prev) => !prev)}
                    aria-pressed={showPressure && layer !== "radar"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-45",
                      showPressure && layer !== "radar"
                        ? "border-[#adc5ff] bg-[#e5edff]/70 text-[#004dff] dark:border-[#3874ff]/35 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                        : "border-[#cbd0dd] bg-white text-[#525b75] dark:border-[#373e53] dark:bg-[#141824] dark:text-[#9fa6bc]",
                    )}
                  >
                    <Gauge className="h-3 w-3" />
                    <span>{isKhmer ? "បន្ទាត់សម្ពាធ" : "Isobars"}</span>
                  </button>

                  <div className="inline-flex items-center rounded-md border border-[#cbd0dd] bg-white p-0.5 dark:border-[#373e53] dark:bg-[#141824]">
                    {(["ecmwf", "gfs", "icon"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModel(m)}
                        className={cn(
                          "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors",
                          model === m
                            ? "bg-[#3874ff] text-white"
                            : "text-[#6e7891] hover:text-[#141824] dark:text-[#9fa6bc] dark:hover:text-white",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Weather Map Canvas */}
            <div className="relative bg-[#0f111a]">
              <iframe
                key={`${layer}-${model}-${zoom}-${showPressure}-${lat.toFixed(2)}-${lng.toFixed(2)}`}
                title="Live Global Meteorological Map"
                src={embedUrl}
                className="h-[360px] w-full border-0 sm:h-[520px] lg:h-[580px]"
                loading="lazy"
                allow="geolocation"
              />
            </div>

            {/* Layer Color Scale Legend */}
            <div className="border-t border-[#e3e6ed] bg-[#f5f7fa]/85 px-5 py-3.5 dark:border-[#2b3245] dark:bg-[#0f111a]/75">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#141824] dark:text-[#eff2f6]">
                  <span>{isKhmer ? activeLayerMeta.labelKm : activeLayerMeta.labelEn}</span>
                  <span className="text-[11px] font-normal text-[#6e7891] dark:text-[#8a94ad]">
                    ({model.toUpperCase()})
                  </span>
                </div>
                <div className="flex flex-1 max-w-md flex-col gap-1">
                  <div
                    className="h-2 w-full rounded-full"
                    style={{ backgroundImage: activeLayerMeta.gradientCss }}
                  />
                  <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                    {(isKhmer ? activeLayerMeta.stopsKm : activeLayerMeta.stopsEn).map((stop) => (
                      <span key={stop} className="truncate">
                        {stop}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </AdminSectionCard>

          {/* Right Column: Live Station Conditions & Stations Explorer */}
          <div className="min-w-0 space-y-6 xl:col-span-4">
            {/* Selected Station Weather Telemetry Card */}
            <AdminSectionCard
              delayIndex={1}
              title={isKhmer ? "ស្ថានភាពអាកាសធាតុទីតាំង" : "Station Telemetry"}
              subtitle={`${lat.toFixed(3)}, ${lng.toFixed(3)} · ${weatherSource}`}
              icon={<Wind className="h-4 w-4" />}
              action={
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${thermalBand.badgeClass}`}
                  >
                    {thermalBand.label}
                  </span>
                  <button
                    type="button"
                    disabled={loadingWeather}
                    onClick={() => void fetchStationWeather(lat, lng)}
                    aria-label="Refresh telemetry"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#cbd0dd] bg-white text-[#525b75] transition hover:text-[#3874ff] dark:border-[#373e53] dark:bg-[#181d2b] dark:text-[#9fa6bc]"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingWeather ? "animate-spin" : ""}`} />
                  </button>
                </div>
              }
            >
              {loadingWeather && !weather ? (
                <StationTelemetrySkeleton
                  label={isKhmer ? "កំពុងទាញយកទិន្នន័យអាកាសធាតុ..." : "Loading station telemetry..."}
                />
              ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Temperature */}
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span>{isKhmer ? "សីតុណ្ហភាព" : "Temperature"}</span>
                      <Thermometer className="h-3.5 w-3.5 text-[#e5780b]" />
                    </div>
                    <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {current.temp_c !== null && current.temp_c !== undefined ? `${current.temp_c}°C` : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                      {current.feels_like_c !== null && current.feels_like_c !== undefined
                        ? `${isKhmer ? "មានអារម្មណ៍ថា" : "Feels"} ${current.feels_like_c}°C`
                        : current.condition || "—"}
                    </p>
                  </div>

                  {/* Wind & Compass Direction */}
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span>{isKhmer ? "ខ្យល់ និងទិសដៅ" : "Wind Vector"}</span>
                      <Wind className="h-3.5 w-3.5 text-[#3874ff]" />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-display text-xl font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          {current.wind_kph !== null && current.wind_kph !== undefined ? `${current.wind_kph}` : "—"}
                          <span className="ml-0.5 text-[11px] font-semibold text-[#6e7891]">km/h</span>
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#3874ff] dark:text-[#85a9ff]">
                          {windCardinal}
                          {windDeg !== null && windDeg !== undefined ? ` · ${windDeg}°` : ""}
                        </p>
                      </div>
                      <div
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#cbd0dd] bg-white dark:border-[#373e53] dark:bg-[#141824]"
                        title={
                          windDeg !== null && windDeg !== undefined
                            ? `Wind blowing from ${windCardinal} (${windDeg}°)`
                            : "Wind bearing"
                        }
                      >
                        <span className="absolute top-0.5 text-[7px] font-bold text-[#8a94ad]">N</span>
                        <ArrowUp
                          className="h-4 w-4 text-[#3874ff] transition-transform duration-300"
                          style={{
                            transform: `rotate(${windDeg !== null && windDeg !== undefined ? (windDeg + 180) % 360 : 0}deg)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Humidity */}
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span>{isKhmer ? "សំណើម" : "Humidity"}</span>
                      <Droplets className="h-3.5 w-3.5 text-[#0097eb]" />
                    </div>
                    <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {current.humidity_pct !== null && current.humidity_pct !== undefined
                        ? `${current.humidity_pct}%`
                        : "—"}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e3e6ed] dark:bg-[#1e2436]">
                      <div
                        className="h-full rounded-full bg-[#0097eb] transition-all duration-300"
                        style={{
                          width: `${Math.max(0, Math.min(100, Number(current.humidity_pct || 0)))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Rain & Storm Status */}
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span>{isKhmer ? "ភ្លៀង និងព្យុះ" : "Rain & Storms"}</span>
                      <CloudLightning
                        className={cn(
                          "h-3.5 w-3.5",
                          hasThunderstorm ? "text-[#fa3b1d]" : "text-[#6e7891]",
                        )}
                      />
                    </div>
                    <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {current.rain_mm !== null && current.rain_mm !== undefined
                        ? `${current.rain_mm} mm`
                        : "—"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                      {current.condition || "—"}
                    </p>
                  </div>

                  {/* Barometric Pressure */}
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span>{isKhmer ? "សម្ពាធ" : "Pressure"}</span>
                      <Gauge className="h-3.5 w-3.5 text-[#3874ff]" />
                    </div>
                    <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {current.pressure_hpa !== null && current.pressure_hpa !== undefined
                        ? `${current.pressure_hpa} hPa`
                        : "—"}
                    </p>
                  </div>

                  {/* Cloud Cover / Gusts */}
                  <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-3 dark:border-[#2b3245] dark:bg-[#0f111a]/65">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#6e7891] dark:text-[#8a94ad]">
                      <span>{isKhmer ? "ពពក / ខ្យល់បក់" : "Clouds / Gusts"}</span>
                      <Cloud className="h-3.5 w-3.5 text-[#8a94ad]" />
                    </div>
                    <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                      {current.cloud_cover_pct !== null && current.cloud_cover_pct !== undefined
                        ? `${current.cloud_cover_pct}%`
                        : "—"}
                      {current.wind_gusts_kph !== null && current.wind_gusts_kph !== undefined && (
                        <span className="ml-1.5 text-[11px] font-semibold text-[#6e7891]">
                          · {current.wind_gusts_kph} km/h
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Storm & Operational Hazard Advisories */}
                {alerts.length > 0 && (
                  <div className="space-y-2 border-t border-[#e3e6ed] pt-3 dark:border-[#2b3245]">
                    {alerts.slice(0, 2).map((alert, idx) => {
                      const isDanger = alert.level === "danger" || alert.color === "red";
                      const isWarning = alert.level === "warning" || alert.color === "orange";
                      return (
                        <div
                          key={`${alert.title}-${idx}`}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs",
                            isDanger
                              ? "border-[#f48270] bg-[#ffe0db]/75 text-[#9e1400] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15 dark:text-[#ffb4a8]"
                              : isWarning
                                ? "border-[#ffcc85] bg-[#ffefca]/75 text-[#9c3203] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15 dark:text-[#ffd399]"
                                : "border-[#90d67f] bg-[#d9fbd0]/65 text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#a8f294]",
                          )}
                        >
                          {isDanger || isWarning ? (
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold">{alert.title}</p>
                            {alert.message && (
                              <p className="mt-0.5 text-[11px] opacity-90">{alert.message}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </AdminSectionCard>

            {/* Coordinates & Weather Station Explorer */}
            <AdminSectionCard
              delayIndex={2}
              title={isKhmer ? "ស្ថានីយត្រួតពិនិត្យអាកាសធាតុ" : "Weather Stations & Coordinates"}
              subtitle={isKhmer ? "ចុចលើទីតាំងដើម្បីមើលព្យុះ និងខ្យល់" : "Jump between Cambodia hubs or global stations"}
              icon={<Compass className="h-4 w-4" />}
              action={
                <div className="inline-flex rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 dark:border-[#373e53] dark:bg-[#0f111a]">
                  {(["cambodia", "global"] as const).map((groupKey) => (
                    <button
                      key={groupKey}
                      type="button"
                      onClick={() => setHubGroup(groupKey)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        hubGroup === groupKey
                          ? "bg-white text-[#004dff] shadow-sm dark:bg-[#181d2b] dark:text-[#85a9ff]"
                          : "text-[#6e7891] hover:text-[#141824] dark:text-[#9fa6bc]",
                      )}
                    >
                      {groupKey === "cambodia"
                        ? isKhmer
                          ? "កម្ពុជា"
                          : "Cambodia"
                        : isKhmer
                          ? "ពិភពលោក"
                          : "Global"}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="space-y-4">
                {filteredStations.length === 0 ? (
                  <AdminEmptyState
                    icon={<MapPin className="h-5 w-5" />}
                    title={isKhmer ? "មិនទាន់មានស្ថានីយ៍ទេ។" : "No stations registered."}
                  />
                ) : (
                  <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 phoenix-scroll sm:grid-cols-2 xl:grid-cols-1">
                    {filteredStations.map((pt) => {
                      const isSelected =
                        pt.lat !== undefined &&
                        pt.lng !== undefined &&
                        Math.abs(pt.lat - lat) < 0.05 &&
                        Math.abs(pt.lng - lng) < 0.05;
                      return (
                        <button
                          key={String(pt.id)}
                          type="button"
                          onClick={() => {
                            if (pt.lat !== undefined && pt.lng !== undefined) {
                              applyCoordinates(
                                pt.lat,
                                pt.lng,
                                `${pt.label}${pt.region ? ` · ${pt.region}` : ""}`,
                                hubGroup === "global" ? 4 : 7,
                              );
                            }
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-all",
                            isSelected
                              ? "border-[#3874ff] bg-[#e5edff]/45 ring-1 ring-[#3874ff]/25 dark:bg-[#3874ff]/15"
                              : "border-[#e3e6ed] bg-[#f5f7fa]/60 hover:border-[#3874ff]/40 dark:border-[#2b3245] dark:bg-[#0f111a]/60",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#141824] dark:text-[#eff2f6]">
                              {pt.label}
                            </p>
                            <p className="truncate text-[10.5px] text-[#6e7891] dark:text-[#8a94ad]">
                              {pt.region}
                              {pt.lat !== undefined && pt.lng !== undefined
                                ? ` · ${pt.lat.toFixed(2)}, ${pt.lng.toFixed(2)}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "ml-2 h-2 w-2 shrink-0 rounded-full",
                              isSelected ? "bg-[#3874ff]" : "bg-[#25b003]",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                <form
                  onSubmit={handleManualCoordsSubmit}
                  className="space-y-2.5 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={draftLat}
                        onChange={(e) => setDraftLat(e.target.value)}
                        className="ai-input py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-[#6e7891] dark:text-[#8a94ad]">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={draftLng}
                        onChange={(e) => setDraftLng(e.target.value)}
                        className="ai-input py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="submit" className="ai-btn-primary h-8 px-3 text-xs">
                      {isKhmer ? "ផ្លាស់ប្តូរ" : "Inspect Coords"}
                    </button>
                    <button
                      type="button"
                      disabled={locating}
                      onClick={handleUseMyLocation}
                      className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
                    >
                      <LocateFixed className={`h-3.5 w-3.5 ${locating ? "animate-pulse" : ""}`} />
                      <span>{isKhmer ? "ទីតាំងខ្ញុំ" : "GPS"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyCoordinates(
                          d.defaultCenter.lat,
                          d.defaultCenter.lng,
                          d.defaultCenter.label,
                          5,
                        )
                      }
                      className="ai-btn-secondary h-8 gap-1 px-2.5 text-xs"
                    >
                      <Navigation className="h-3 w-3" />
                      <span>{isKhmer ? "កំណត់ដើម" : "Reset"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </AdminSectionCard>
          </div>
        </div>

        {/* Bottom 7-Day Atmospheric Forecast Outlook */}
        {forecast.length > 0 && (
          <AdminSectionCard
            delayIndex={3}
            title={
              isKhmer
                ? `ការព្យាករណ៍អាកាសធាតុ ៧ ថ្ងៃ (${stationLabel})`
                : `7-Day Atmospheric Outlook · ${stationLabel}`
            }
            subtitle={
              isKhmer
                ? `ទឹកភ្លៀងរំពឹងទុកសរុប ២៤ ម៉ោង៖ ${analytics.rain_next_24h_mm ?? 0} mm · ខ្យល់ខ្លាំងបំផុត៖ ${analytics.max_wind_next_24h_kph ?? 0} km/h`
                : `Next 24h Rain: ${analytics.rain_next_24h_mm ?? 0} mm · Peak Wind: ${analytics.max_wind_next_24h_kph ?? 0} km/h`
            }
            icon={<Cloud className="h-4 w-4" />}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {forecast.slice(0, 7).map((day, idx) => {
                const tempBand = getTemperatureBand(day.temp_max_c, isKhmer);
                return (
                  <div
                    key={day.date || idx}
                    className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/70 p-3 text-xs dark:border-[#2b3245] dark:bg-[#0f111a]/60"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-bold text-[#141824] dark:text-[#eff2f6]">
                        {day.date ? day.date.slice(5) : "—"}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${tempBand.badgeClass}`}>
                        {day.temp_max_c !== null && day.temp_max_c !== undefined ? `${day.temp_max_c}°` : "—"}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate font-medium text-[#525b75] dark:text-[#9fa6bc]">
                      {day.condition || "—"}
                    </p>
                    <div className="mt-2 space-y-1 border-t border-[#e3e6ed] pt-2 text-[11px] text-[#6e7891] dark:border-[#2b3245] dark:text-[#8a94ad]">
                      <div className="flex items-center justify-between">
                        <span>{isKhmer ? "ទាប/ខ្ពស់" : "Min/Max"}</span>
                        <span className="font-semibold tabular-nums text-[#141824] dark:text-[#eff2f6]">
                          {day.temp_min_c ?? "—"}° / {day.temp_max_c ?? "—"}°
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{isKhmer ? "ខ្យល់" : "Wind"}</span>
                        <span className="tabular-nums">{day.wind_kph ?? "—"} km/h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{isKhmer ? "ភ្លៀង" : "Rain"}</span>
                        <span className="tabular-nums">{day.rain_mm ?? 0} mm</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{isKhmer ? "សំណើម" : "Humid"}</span>
                        <span className="tabular-nums">{day.humidity_pct ?? "—"}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminSectionCard>
        )}
      </div>
    </WorkspaceShell>
  );
}
