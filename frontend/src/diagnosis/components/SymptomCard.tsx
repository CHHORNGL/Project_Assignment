import { Check, Plus } from "lucide-react";

export interface SymptomItem {
  id: string;
  name: string;
  name_kh?: string;
}

export interface SymptomCardProps {
  symptom: SymptomItem;
  selected: boolean;
  onToggle: () => void;
  isKhmer: boolean;
  selectedText: string;
  unselectedText: string;
}

export default function SymptomCard({
  symptom,
  selected,
  onToggle,
  isKhmer,
  selectedText,
  unselectedText,
}: SymptomCardProps) {
  const name = isKhmer && symptom.name_kh ? symptom.name_kh : symptom.name;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={[
        "diag-symptom-card",
        selected ? "diag-symptom-card-selected" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs transition-all duration-150",
            selected
              ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
              : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-obsidian-950/70",
          ].join(" ")}
        >
          {selected ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={
              selected
                ? "text-sm font-bold text-slate-900 dark:text-white"
                : "text-sm font-semibold text-slate-700 dark:text-slate-200"
            }
          >
            {name}
          </p>
          <p
            className={
              selected
                ? "mt-1 text-xs leading-relaxed text-indigo-700 dark:text-indigo-300"
                : "mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
            }
          >
            {selected ? selectedText : unselectedText}
          </p>
        </div>
      </div>
    </button>
  );
}
