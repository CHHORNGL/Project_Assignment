import { useCallback, useEffect, useRef, useState } from "react";
import { resolveTtsLanguage, sanitizeTtsText } from "@/lib/ttsHelpers";

export function useSpeechPlayback<K extends string | number>(
  ttsUrl: string,
  uiLang: string,
  onUnavailable?: (message: string) => void,
) {
  const [activeKey, setActiveKey] = useState<K | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeKeyRef = useRef<K | null>(null);
  activeKeyRef.current = activeKey;

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setActiveKey(null);
  }, []);

  useEffect(() => stop, [stop]);

  const speakWithBrowserFallback = useCallback(
    (cleanText: string, lang: "km" | "en", key: K) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setActiveKey(null);
        onUnavailable?.(
          lang === "km"
            ? "មិនអាចបើកសំឡេងអានបានទេ។ សូមពិនិត្យកម្រិតសំឡេងឧបករណ៍របស់អ្នក។"
            : "Audio playback is unavailable in this browser.",
        );
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(cleanText.slice(0, 800));
        utter.lang = lang === "km" ? "km-KH" : "en-US";
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) =>
          v.lang.toLowerCase().startsWith(lang === "km" ? "km" : "en"),
        );
        if (match) utter.voice = match;
        utter.onend = () => {
          if (activeKeyRef.current === key) setActiveKey(null);
        };
        utter.onerror = () => {
          if (activeKeyRef.current === key) setActiveKey(null);
        };
        window.speechSynthesis.speak(utter);
      } catch {
        setActiveKey(null);
        onUnavailable?.(
          lang === "km"
            ? "មិនអាចចាក់សំឡេងបានទេ។"
            : "Could not start voice narration.",
        );
      }
    },
    [onUnavailable],
  );

  const toggleSpeak = useCallback(
    (key: K, rawText: string) => {
      const cleanText = sanitizeTtsText(rawText);
      if (!cleanText) return;

      const wasSameKey = activeKeyRef.current === key;
      stop();
      if (wasSameKey) return;

      const lang = resolveTtsLanguage(cleanText, uiLang);
      const src = `${ttsUrl}?lang=${lang}&text=${encodeURIComponent(cleanText.slice(0, 900))}`;
      const audio = new Audio(src);
      audio.preload = "auto";
      audioRef.current = audio;
      setActiveKey(key);

      let fallbackTriggered = false;
      const triggerFallback = () => {
        if (fallbackTriggered || audioRef.current !== audio) return;
        fallbackTriggered = true;
        audioRef.current = null;
        speakWithBrowserFallback(cleanText, lang, key);
      };

      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setActiveKey(null);
        }
      };
      audio.onerror = triggerFallback;

      void audio.play().catch(triggerFallback);
    },
    [speakWithBrowserFallback, stop, ttsUrl, uiLang],
  );

  return { activeKey, toggleSpeak, stop };
}
