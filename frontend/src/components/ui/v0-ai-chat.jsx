import React, { useEffect, useRef, useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function useAutoResizeTextarea({ minHeight, maxHeight }) {
  const textareaRef = useRef(null);

  const adjustHeight = useCallback(
    (reset) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export function VercelV0Chat({ onSend, placeholder = "Ask Agri Expert a question..." }) {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        if (onSend) onSend(value);
        setValue("");
        adjustHeight(true);
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-50 text-center tracking-tight">
        What can I help you diagnose?
      </h1>

      <div className="w-full">
        <div className="relative bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-lg">
          <div className="overflow-y-auto px-4 pt-3">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "w-full resize-none bg-transparent border-none p-0 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-neutral-400 placeholder:text-sm min-h-[60px]"
              )}
              style={{ overflow: "hidden" }}
            />
          </div>

          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                🌱 Smart Expert
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (value.trim()) {
                    if (onSend) onSend(value);
                    setValue("");
                    adjustHeight(true);
                  }
                }}
                className={cn(
                  "p-2 rounded-xl text-sm transition-all flex items-center justify-center",
                  value.trim()
                    ? "bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 shadow-md scale-105"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                )}
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
          {["🌾 Rice Blast Diagnosis", "🍅 Tomato Leaf Curl", "🐛 Pest Control", "🧪 Soil & Fertilizer", "🌦️ Weather Warnings"].map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setValue(topic)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 text-xs font-medium transition-colors"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
