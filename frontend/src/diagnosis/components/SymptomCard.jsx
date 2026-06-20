export default function SymptomCard({ symptom, selected, onToggle, isKhmer, selectedText, unselectedText }) {
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
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm transition-all duration-200",
            selected
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500",
          ].join(" ")}
        >
          <i className={`fas ${selected ? "fa-check" : "fa-plus"}`} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {selected ? selectedText : unselectedText}
          </p>
        </div>
      </div>
    </button>
  );
}
