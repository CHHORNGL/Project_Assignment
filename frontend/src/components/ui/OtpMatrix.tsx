import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export interface OtpMatrixProps {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  name?: string;
  autoFocus?: boolean;
}

export function OtpMatrix({
  value,
  onChange,
  length = 6,
  name = "code",
  autoFocus = true,
}: OtpMatrixProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, idx) => value[idx] || "");

  const updateDigit = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = digits.slice();
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    const next = digits.slice();
    for (let offset = 0; offset < clean.length && index + offset < length; offset += 1) {
      next[index + offset] = clean[offset];
    }
    onChange(next.join("").slice(0, length));

    const focusTarget = Math.min(index + clean.length, length - 1);
    inputRefs.current[focusTarget]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = digits.slice();
      next[index - 1] = "";
      onChange(next.join(""));
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            autoFocus={autoFocus && index === 0}
            value={digit}
            aria-label={`Verification digit ${index + 1}`}
            onChange={(e) => updateDigit(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={cn(
              "h-12 w-full rounded-xl border text-center font-display text-lg font-bold outline-none transition-all duration-150 sm:h-14 sm:text-xl",
              digit
                ? "border-indigo-500 bg-indigo-50/70 text-indigo-700 ring-2 ring-indigo-500/15 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-200"
                : "border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-obsidian-950 dark:text-slate-100",
            )}
          />
        ))}
      </div>
    </div>
  );
}
