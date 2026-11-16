export type WeatherLayerKey =
  | "wind"
  | "temp"
  | "rh"
  | "rain"
  | "cape"
  | "clouds"
  | "pressure"
  | "radar";

export type WeatherModelKey = "ecmwf" | "gfs" | "icon";

export interface WeatherLayerMeta {
  key: WeatherLayerKey;
  labelEn: string;
  labelKm: string;
  descEn: string;
  descKm: string;
  gradientCss: string;
  stopsEn: string[];
  stopsKm: string[];
}

export const WEATHER_LAYERS: WeatherLayerMeta[] = [
  {
    key: "wind",
    labelEn: "Wind Direction",
    labelKm: "ទិសដៅខ្យល់",
    descEn: "Live global streamline flow vectors & wind speed (km/h)",
    descKm: "ចរន្តខ្យល់ និងល្បឿនខ្យល់ផ្ទាល់ទូទាំងពិភពលោក (km/h)",
    gradientCss: "linear-gradient(90deg, #3b82f6 0%, #10b981 35%, #f59e0b 70%, #ef4444 100%)",
    stopsEn: ["Calm <10", "Breeze 25", "Strong 45", "Gale 75+", "Storm 110+ km/h"],
    stopsKm: ["ស្ងប់ <10", "បង្គួរ 25", "ខ្លាំង 45", "ខ្យល់បក់ 75+", "ព្យុះ 110+ km/h"],
  },
  {
    key: "temp",
    labelEn: "Temperature (Cold / Hot)",
    labelKm: "សីតុណ្ហភាព (ត្រជាក់ / ក្តៅ)",
    descEn: "Surface thermal gradient from sub-zero cold fronts to heatwaves (°C)",
    descKm: "កម្រិតសីតុណ្ហភាពពីត្រជាក់ខ្លាំងដល់ក្តៅខ្លាំង (°C)",
    gradientCss:
      "linear-gradient(90deg, #6366f1 0%, #06b6d4 25%, #22c55e 50%, #f59e0b 75%, #dc2626 100%)",
    stopsEn: ["Cold <0°C", "Cool 12°C", "Mild 22°C", "Warm 31°C", "Hot 38°C+"],
    stopsKm: ["ត្រជាក់ខ្លាំង <0°C", "ត្រជាក់ 12°C", "ល្មម 22°C", "ក្តៅល្មម 31°C", "ក្តៅខ្លាំង 38°C+"],
  },
  {
    key: "rh",
    labelEn: "Humidity",
    labelKm: "សំណើម",
    descEn: "Atmospheric relative humidity & moisture concentration (%)",
    descKm: "ភាគរយសំណើមក្នុងបរិយាកាស (%)",
    gradientCss: "linear-gradient(90deg, #f59e0b 0%, #84cc16 35%, #06b6d4 70%, #1d4ed8 100%)",
    stopsEn: ["Arid <25%", "Dry 45%", "Balanced 65%", "Humid 85%", "Saturated 95%+"],
    stopsKm: ["ស្ងួត <25%", "ស្ងួតល្មម 45%", "សមស្រប 65%", "សើម 85%", "សំណើមខ្ពស់ 95%+"],
  },
  {
    key: "rain",
    labelEn: "Storms & Rain",
    labelKm: "ព្យុះ និងភ្លៀង",
    descEn: "Active storm cells, rainfall intensity & thunder bands (mm/h)",
    descKm: "តំបន់ព្យុះភ្លៀង ផ្គរ និងកម្រិតទឹកភ្លៀង (mm/h)",
    gradientCss:
      "linear-gradient(90deg, #94a3b8 0%, #38bdf8 25%, #2563eb 50%, #a855f7 75%, #e11d48 100%)",
    stopsEn: ["Clear 0mm", "Light Rain", "Moderate", "Heavy Rain", "Severe Storm"],
    stopsKm: ["ស្រឡះ 0mm", "ភ្លៀងតិច", "មធ្យម", "ភ្លៀងខ្លាំង", "ព្យុះធ្ងន់ធ្ងរ"],
  },
  {
    key: "cape",
    labelEn: "Storm Energy (CAPE)",
    labelKm: "ថាមពលព្យុះ (CAPE)",
    descEn: "Convective atmospheric instability highlighting thunderstorm zones (J/kg)",
    descKm: "អស្ថិរភាពបរិយាកាសបង្ហាញពីហានិភ័យព្យុះផ្គរ (J/kg)",
    gradientCss: "linear-gradient(90deg, #0ea5e9 0%, #22c55e 35%, #eab308 70%, #dc2626 100%)",
    stopsEn: ["Stable <300", "Marginal 800", "Active 1500", "Severe 2500+", "Extreme J/kg"],
    stopsKm: ["ស្ថិរភាព <300", "តិច 800", "សកម្ម 1500", "ធ្ងន់ 2500+", "ខ្លាំងបំផុត J/kg"],
  },
  {
    key: "radar",
    labelEn: "Live Radar",
    labelKm: "រ៉ាដាផ្ទាល់",
    descEn: "Doppler precipitation & storm cell movement radar",
    descKm: "រ៉ាដាតាមដានចលនាព្យុះ និងភ្លៀងផ្ទាល់",
    gradientCss: "linear-gradient(90deg, #64748b 0%, #22c55e 35%, #facc15 70%, #ef4444 100%)",
    stopsEn: ["No Echo", "Light dBZ", "Moderate", "Heavy Core", "Hail / Squall"],
    stopsKm: ["គ្មានភ្លៀង", "តិច", "មធ្យម", "ភ្លៀងខ្លាំង", "ព្យុះខ្លាំង"],
  },
  {
    key: "clouds",
    labelEn: "Clouds",
    labelKm: "ពពក",
    descEn: "Multi-layer total cloud coverage & overcast bands (%)",
    descKm: "គម្របពពកសរុបក្នុងបរិយាកាស (%)",
    gradientCss: "linear-gradient(90deg, #38bdf8 0%, #cbd5e1 50%, #475569 100%)",
    stopsEn: ["Clear 0%", "Scattered 30%", "Broken 65%", "Overcast 90%+"],
    stopsKm: ["ស្រឡះ 0%", "ពពកខ្លះ 30%", "ពពកច្រើន 65%", "អាប់ 90%+"],
  },
  {
    key: "pressure",
    labelEn: "Pressure Systems",
    labelKm: "សម្ពាធបរិយាកាស",
    descEn: "Mean sea-level pressure revealing cyclones & calm high ridges (hPa)",
    descKm: "សម្ពាធអាកាសសម្រាប់តាមដានតំបន់ព្យុះស៊ីក្លូន (hPa)",
    gradientCss: "linear-gradient(90deg, #7c3aed 0%, #3b82f6 35%, #22c55e 70%, #f97316 100%)",
    stopsEn: ["Low/Cyclone <995", "Trough 1005", "Normal 1013", "High 1024+ hPa"],
    stopsKm: ["សម្ពាធទាប/ព្យុះ <995", "ទាប 1005", "ធម្មតា 1013", "ខ្ពស់ 1024+ hPa"],
  },
];

export function formatWindCardinal(deg?: number | null): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % 8];
}

export function getTemperatureBand(
  tempC: number | null | undefined,
  isKhmer = false,
): { label: string; badgeClass: string } {
  if (tempC === null || tempC === undefined || !Number.isFinite(tempC)) {
    return {
      label: isKhmer ? "មិនទាន់មាន" : "No reading",
      badgeClass:
        "border-[#cbd0dd] bg-[#eff2f6] text-[#525b75] dark:border-[#373e53] dark:bg-[#1e2436] dark:text-[#9fa6bc]",
    };
  }
  if (tempC < 16) {
    return {
      label: isKhmer ? "ត្រជាក់ (Cold)" : "Cold",
      badgeClass:
        "border-[#7ad3ff] bg-[#dcf4ff] text-[#005585] dark:border-[#0097eb]/40 dark:bg-[#0097eb]/15 dark:text-[#7ed4ff]",
    };
  }
  if (tempC < 24) {
    return {
      label: isKhmer ? "ស្រទន់ (Cool)" : "Cool",
      badgeClass:
        "border-[#90d67f] bg-[#d9fbd0] text-[#1c6c09] dark:border-[#25b003]/40 dark:bg-[#25b003]/15 dark:text-[#90ee7a]",
    };
  }
  if (tempC < 32) {
    return {
      label: isKhmer ? "ក្តៅល្មម (Warm)" : "Warm",
      badgeClass:
        "border-[#ffcc85] bg-[#ffefca] text-[#bc3803] dark:border-[#e5780b]/40 dark:bg-[#e5780b]/15 dark:text-[#ffbd6b]",
    };
  }
  return {
    label: isKhmer ? "ក្តៅខ្លាំង (Hot)" : "Hot",
    badgeClass:
      "border-[#f48270] bg-[#ffe0db] text-[#b81800] dark:border-[#fa3b1d]/40 dark:bg-[#fa3b1d]/15 dark:text-[#ff9c8c]",
  };
}

export function buildWindyEmbedUrl({
  lat,
  lon,
  zoom = 5,
  overlay = "wind",
  product = "ecmwf",
  showPressure = true,
}: {
  lat: number;
  lon: number;
  zoom?: number;
  overlay?: WeatherLayerKey;
  product?: WeatherModelKey;
  showPressure?: boolean;
}): string {
  const safeLat = Number.isFinite(lat) ? Math.max(-85, Math.min(85, lat)) : 11.5564;
  const safeLon = Number.isFinite(lon) ? Math.max(-180, Math.min(180, lon)) : 104.9282;
  const safeZoom = Math.max(2, Math.min(12, Math.round(zoom)));

  const params = new URLSearchParams({
    lat: safeLat.toFixed(4),
    lon: safeLon.toFixed(4),
    detailLat: safeLat.toFixed(4),
    detailLon: safeLon.toFixed(4),
    zoom: String(safeZoom),
    level: "surface",
    overlay,
    product,
    menu: "",
    message: "true",
    marker: "true",
    calendar: "now",
    pressure: showPressure && overlay !== "radar" ? "true" : "false",
    type: "map",
    location: "coordinates",
    detail: "",
    metricWind: "km/h",
    metricTemp: "°C",
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}
