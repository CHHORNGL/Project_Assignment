import React, { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { AUTH_INPUT_CLASS } from "@/components/layout/AiPlatformAuthShell";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showStrength?: boolean;
}

function passwordScore(value: string): { score: number; label: string; color: string } {
  if (!value) return { score: 0, label: "", color: "bg-neutral-200 dark:bg-neutral-800" };
  let points = 0;
  if (value.length >= 6) points += 1;
  if (value.length >= 10) points += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) points += 1;
  if (/[0-9]/.test(value) || /[^A-Za-z0-9]/.test(value)) points += 1;

  if (points <= 1) return { score: 1, label: "Weak", color: "bg-rose-500" };
  if (points === 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
  if (points === 3) return { score: 3, label: "Good", color: "bg-blue-600 dark:bg-blue-400" };
  return { score: 4, label: "Strong", color: "bg-neutral-900 dark:bg-white" };
}

export function PasswordInput({
  className = "",
  showStrength = false,
  value,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordScore(String(value || "")) : null;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
        <input
          {...props}
          type={visible ? "text" : "password"}
          value={value}
          className={cn(AUTH_INPUT_CLASS, "pl-10 pr-11", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {strength && String(value || "").length > 0 && (
        <div className="flex items-center gap-2 px-0.5">
          <div className="grid flex-1 grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={cn(
                  "h-1 rounded-full transition-colors duration-200",
                  step <= strength.score ? strength.color : "bg-neutral-200 dark:bg-neutral-800",
                )}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {strength.label}
          </span>
        </div>
      )}
    </div>
  );
}
