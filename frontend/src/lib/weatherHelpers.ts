export interface WeatherMeta {
  source?: string;
  provider?: string;
  degraded?: boolean;
  error_code?: string;
  retry_after_seconds?: number;
  generated_at?: string;
  lang?: string;
  [key: string]: unknown;
}

export interface WeatherPayload {
  location?: { latitude?: number; longitude?: number; name?: string };
  current?: {
    temp_c?: number | null;
    condition?: string;
    icon?: string;
    humidity_pct?: number;
    wind_kph?: number;
    rain_mm?: number;
  };
  analytics?: {
    rain_next_24h_mm?: number;
    max_wind_next_24h_kph?: number;
    avg_temp_next_24h_c?: number;
    weekly_rain_mm?: number;
  };
  alerts?: Array<{ title?: string; message?: string; recommendation?: string; color?: string }>;
  forecast?: Array<{ date?: string; icon?: string; temp_max_c?: number; temp_min_c?: number; rain_mm?: number }>;
  recommendations?: string[];
  meta?: WeatherMeta;
}

export interface WeatherCoords {
  lat: number;
  lon: number;
}

export interface StorageLike {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
}

export interface WeatherAttribution {
  prefix: string;
  providerName: string;
  providerUrl: string;
  licenseUrl: string;
  licenseLabel: string;
  note?: string;
}

export interface WeatherOutcome {
  displayPayload: WeatherPayload;
  statusText: string;
  attribution: WeatherAttribution | null;
  retryDelayMs: number | null;
}

export const WEATHER_CACHE_KEY_PREFIX = "agri_weather_intel_payload_v3";
export const MAX_WEATHER_CACHE_AGE_MS = 6 * 60 * 60 * 1000;

export function weatherCacheKey(lang: string): string {
  return `${WEATHER_CACHE_KEY_PREFIX}_${lang === "km" ? "km" : "en"}`;
}

export function loadCachedWeatherPayload(
  storage: StorageLike | null | undefined,
  lang: string,
  coords?: WeatherCoords | null,
  nowMs: number = Date.now(),
): WeatherPayload | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(weatherCacheKey(lang));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload?: WeatherPayload } | null;
    const payload = parsed?.payload;
    if (!payload) return null;

    const meta = payload.meta || {};
    if (meta.source === "fallback" || payload.current?.temp_c == null) {
      return null;
    }

    const generatedAt = Date.parse(String(meta.generated_at || ""));
    const age = nowMs - generatedAt;
    if (!Number.isFinite(age) || age < 0 || age > MAX_WEATHER_CACHE_AGE_MS) {
      return null;
    }

    if (coords) {
      const location = payload.location || {};
      const lat = Number(location.latitude);
      const lon = Number(location.longitude);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat - coords.lat) > 0.002 ||
        Math.abs(lon - coords.lon) > 0.002
      ) {
        return null;
      }
    }

    const normalizedLang = lang === "km" ? "km" : "en";
    const payloadLang = String(meta.lang || "").toLowerCase();
    if (payloadLang && payloadLang !== normalizedLang) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function saveCachedWeatherPayload(
  storage: StorageLike | null | undefined,
  lang: string,
  payload: WeatherPayload | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!storage || !payload || payload.meta?.degraded || payload.current?.temp_c == null) {
    return false;
  }
  try {
    storage.setItem(
      weatherCacheKey(lang),
      JSON.stringify({ stored_at: nowMs, payload }),
    );
    return true;
  } catch {
    return false;
  }
}

export function formatWeatherTimestamp(iso: string | undefined, lang: string): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  try {
    return dt.toLocaleString(lang === "km" ? "km-KH" : undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function resolveWeatherOutcome(
  livePayload: WeatherPayload,
  savedPayload: WeatherPayload | null,
  lang: string,
): WeatherOutcome {
  const isKm = lang === "km";
  const liveMeta = livePayload.meta || {};
  const useSaved = liveMeta.source === "fallback" && Boolean(savedPayload);
  const displayPayload: WeatherPayload = useSaved && savedPayload
    ? {
        ...savedPayload,
        meta: {
          ...(savedPayload.meta || {}),
          source: "stale-cache",
          degraded: true,
          error_code: liveMeta.error_code,
        },
      }
    : livePayload;

  const meta = displayPayload.meta || {};
  const source = meta.source || "live";
  const isMet = meta.provider === "met-norway";
  const updatedAt = formatWeatherTimestamp(meta.generated_at, lang);
  const updatedLabel = updatedAt ? ` | ${isKm ? "បានធ្វើបច្ចុប្បន្នភាព" : "Updated"} ${updatedAt}` : "";

  let statusText: string;
  if (meta.degraded) {
    const rateLimited = meta.error_code === "provider_rate_limited";
    const baseMsg = rateLimited
      ? isKm
        ? "សេវាអាកាសធាតុដល់កម្រិតសំណើ | នឹងព្យាយាមឡើងវិញដោយស្វ័យប្រវត្តិ"
        : "Weather provider limit reached | Retrying automatically"
      : isKm
        ? "សេវាអាកាសធាតុមិនអាចប្រើបាន | នឹងព្យាយាមឡើងវិញដោយស្វ័យប្រវត្តិ"
        : "Weather provider unavailable | Retrying automatically";
    const savedSuffix = source === "stale-cache"
      ? ` | ${isKm ? "បង្ហាញទិន្នន័យអាកាសធាតុដែលបានរក្សាទុក" : "Showing saved weather"}${updatedLabel}`
      : "";
    statusText = `${baseMsg}${savedSuffix}`;
  } else {
    let sourceLabel = isKm ? "ផ្ទាល់" : "Live";
    if (source === "cache") sourceLabel = isKm ? "ទិន្នន័យសន្សំ" : "Cached";
    if (source === "stale-cache") sourceLabel = isKm ? "ទិន្នន័យសន្សំចាស់" : "Stale cache";
    if (source === "fallback") sourceLabel = isKm ? "ទិន្នន័យជំនួស" : "Fallback";
    if (isMet) {
      sourceLabel = `${isKm ? "ការព្យាករណ៍ MET Norway" : "MET Norway forecast"} | ${sourceLabel}`;
    }
    statusText = `${sourceLabel}${updatedLabel}`;
  }

  const attribution: WeatherAttribution | null = source === "fallback"
    ? null
    : {
        prefix: isMet
          ? isKm
            ? "ការព្យាករណ៍កែសម្រួលពី"
            : "Forecast adapted from"
          : isKm
            ? "ទិន្នន័យអាកាសធាតុពី"
            : "Weather data from",
        providerName: isMet ? "MET Norway" : "Open-Meteo",
        providerUrl: isMet ? "https://www.met.no/en" : "https://open-meteo.com/",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        licenseLabel: "CC BY 4.0",
        note: isMet
          ? isKm
            ? "តម្លៃប្រចាំថ្ងៃជាការប៉ាន់ស្មាន។ ថ្ងៃនេះគ្របដណ្តប់ម៉ោងដែលនៅសល់។"
            : "Daily values are estimates; today covers the remaining hours."
          : undefined,
      };

  const retryDelayMs = liveMeta.degraded
    ? Math.max(60, Number(liveMeta.retry_after_seconds) || 60) * 1000
    : null;

  return {
    displayPayload,
    statusText,
    attribution,
    retryDelayMs,
  };
}

export function buildOfflineWeatherPayload(lang: string): WeatherPayload {
  const isKm = lang === "km";
  return {
    current: {},
    analytics: {},
    forecast: [],
    alerts: [
      {
        color: "orange",
        title: isKm ? "មិនអាចទាញទិន្នន័យអាកាសធាតុតាមអ៊ីនធឺណិតបាន" : "No network weather data",
        recommendation: isKm
          ? "សូមភ្ជាប់អ៊ីនធឺណិតឡើងវិញ ហើយ Refresh ដើម្បីទាញទិន្នន័យផ្ទាល់។"
          : "Please reconnect internet and refresh for live weather alerts.",
      },
    ],
    recommendations: [
      isKm
        ? "សូមសង្កេតមេឃ និងខ្យល់នៅតំបន់ជាក់ស្តែង មុនបាញ់ថ្នាំ។"
        : "Use local sky and wind observations before spraying.",
      isKm
        ? "ពន្យារពេលការងារហានិភ័យខ្ពស់ រហូតទិន្នន័យអាកាសធាតុត្រលប់មកវិញ។"
        : "Delay high-risk field actions until live weather returns.",
    ],
  };
}
