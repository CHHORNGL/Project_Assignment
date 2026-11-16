/** Pure TTS text sanitization and script language detection helpers. */

export function sanitizeTtsText(raw: string): string {
  return (raw || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>|]+/g, " ")
    .replace(/^\s*[-•]+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveTtsLanguage(text: string, uiLang?: string): "km" | "en" {
  if (/[\u1780-\u17ff]/.test(text)) {
    return "km";
  }
  if (/[A-Za-z]/.test(text)) {
    return "en";
  }
  return (uiLang || "").toLowerCase().startsWith("km") ? "km" : "en";
}
