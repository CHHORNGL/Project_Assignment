import React, { useState } from "react";
import {
  ArrowLeft,
  Check,
  Languages,
  Loader2,
  Megaphone,
  Save,
  Sparkles,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";
import { AdminSectionCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface MarqueeFormData {
  isEdit: boolean;
  marqueeId?: number | null;
  formAction: string;
  backUrl: string;
  aiTranslateUrl?: string;
  formValues: {
    text: string;
    textKh: string;
    sortOrder: number;
    isActive: boolean;
  };
}

export default function AdminMarqueeFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<MarqueeFormData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const v = d.formValues;
  const { pushToast } = useToast();

  const [text, setText] = useState(v.text || "");
  const [textKh, setTextKh] = useState(v.textKh || "");
  const [sortOrder, setSortOrder] = useState(String(v.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(Boolean(v.isActive));
  const [previewLang, setPreviewLang] = useState<"en" | "km">(isKhmer ? "km" : "en");
  const [translating, setTranslating] = useState(false);

  const handleAiTranslate = async () => {
    const clean = text.trim();
    if (!clean) {
      pushToast(
        "warning",
        isKhmer ? "សូមបញ្ចូលអត្ថបទអង់គ្លេសជាមុនសិន។" : "Enter English announcement copy first.",
      );
      return;
    }
    setTranslating(true);
    try {
      const resp = await fetch(d.aiTranslateUrl || "/admin/translations/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": bootstrap.csrfToken,
        },
        body: JSON.stringify({ text: clean.slice(0, 800) }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.translation) {
        pushToast(
          "error",
          json?.error || (isKhmer ? "សេវាបកប្រែ AI មិនអាចប្រើបានទេ។" : "AI translation service unavailable."),
        );
        return;
      }
      setTextKh(String(json.translation));
    } catch {
      pushToast("error", isKhmer ? "បណ្តាញមានបញ្ហាក្នុងការបកប្រែ។" : "Network error during translation.");
    } finally {
      setTranslating(false);
    }
  };

  const checklist = [
    { label: isKhmer ? "អត្ថបទអង់គ្លេស" : "English Copy", done: text.trim().length > 0 },
    { label: isKhmer ? "អត្ថបទខ្មែរ" : "Khmer Copy", done: textKh.trim().length > 0 },
    { label: isKhmer ? "ស្ថានភាពផ្សាយ" : "Broadcast Enabled", done: isActive },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {d.isEdit && d.marqueeId && (
            <AdminStatusBadge tone={isActive ? "emerald" : "slate"} pulse={isActive}>
              #{d.marqueeId} · {isActive ? "Active" : "Paused"}
            </AdminStatusBadge>
          )}
          <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isKhmer ? "ត្រឡប់ទៅបញ្ជីសារ" : "Back to Marquees"}</span>
          </a>
        </div>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Main Composer Card */}
        <div className="min-w-0 lg:col-span-8">
          <AdminSectionCard
            delayIndex={0}
            title={
              d.isEdit
                ? isKhmer
                  ? "កែប្រែសារជូនដំណឹង"
                  : "Update Announcement Marquee"
                : isKhmer
                  ? "បង្កើតសារជូនដំណឹងថ្មី"
                  : "Publish Announcement Marquee"
            }
            subtitle={
              isKhmer
                ? "សរសេរខ្លឹមសារជាភាសាអង់គ្លេស និងខ្មែរ កំណត់លំដាប់ និងស្ថានភាពផ្សាយ"
                : "Compose multi-line platform ticker notices in English and Khmer"
            }
            icon={<Megaphone className="h-4 w-4" />}
          >
            <form method="POST" action={d.formAction} className="space-y-5">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "អត្ថបទជូនដំណឹង (អង់គ្លេស) *" : "Announcement Text (English) *"}
                  </label>
                  <span className="font-mono text-[10.5px] text-[#8a94ad]">
                    {text.length} chars
                  </span>
                </div>
                <textarea
                  name="text"
                  required
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter announcement notice for farmers..."
                  className="ai-input text-xs leading-relaxed"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "អត្ថបទជូនដំណឹង (ខ្មែរ)" : "Announcement Text (Khmer)"}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10.5px] text-[#8a94ad]">
                      {textKh.length} chars
                    </span>
                    <button
                      type="button"
                      disabled={translating}
                      onClick={handleAiTranslate}
                      className="inline-flex items-center gap-1 rounded-md border border-[#adc5ff] bg-[#e5edff] px-2 py-0.5 text-[10.5px] font-semibold text-[#004dff] transition hover:bg-[#d5e3ff] disabled:opacity-50 dark:border-[#3874ff]/40 dark:bg-[#3874ff]/15 dark:text-[#85a9ff]"
                    >
                      {translating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      <span>{isKhmer ? "បកប្រែដោយ AI" : "AI Translate"}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  name="text_kh"
                  rows={4}
                  value={textKh}
                  onChange={(e) => setTextKh(e.target.value)}
                  placeholder="បញ្ចូលសេចក្តីជូនដំណឹងជាភាសាខ្មែរ..."
                  className="ai-input text-xs leading-relaxed"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "លំដាប់អាទិភាព (Sort Order)" : "Priority Sort Order"}
                  </label>
                  <input
                    type="number"
                    name="sort_order"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="ai-input font-mono text-xs"
                  />
                  <p className="mt-1 text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                    {isKhmer
                      ? "លេខតូចជាងបង្ហាញមុនគេក្នុងរបារជូនដំណឹង។"
                      : "Lower numbers appear first in the live ticker sequence."}
                  </p>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ស្ថានភាពផ្សាយ" : "Visibility Status"}
                  </span>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#cbd0dd] bg-[#f5f7fa]/80 px-3.5 py-2.5 text-xs transition hover:border-[#adc5ff] dark:border-[#373e53] dark:bg-[#0f111a]">
                    <div>
                      <div className="font-semibold text-[#141824] dark:text-[#eff2f6]">
                        {isActive
                          ? isKhmer
                            ? "បើកផ្សាយភ្លាមៗ"
                            : "Active Banner"
                          : isKhmer
                            ? "ផ្អាកទុកជាព្រាង"
                            : "Paused Draft"}
                      </div>
                      <div className="text-[11px] text-[#6e7891] dark:text-[#8a94ad]">
                        {isActive
                          ? isKhmer
                            ? "បង្ហាញលើផ្ទាំងកសិករ"
                            : "Visible in farmer portal"
                          : isKhmer
                            ? "លាក់ពីអ្នកប្រើប្រាស់"
                            : "Hidden from workspace"}
                      </div>
                    </div>

                    <span className="relative inline-flex shrink-0 items-center">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#3874ff]/45",
                          isActive ? "bg-[#25b003]" : "bg-[#cbd0dd] dark:bg-[#373e53]",
                        )}
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-150",
                            isActive ? "translate-x-4" : "translate-x-0",
                          )}
                        />
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "បោះបង់" : "Cancel"}</span>
                </a>
                <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {d.isEdit
                      ? isKhmer
                        ? "រក្សាទុកការកែប្រែ"
                        : "Update Marquee"
                      : isKhmer
                        ? "បោះពុម្ពផ្សាយ"
                        : "Publish Banner"}
                  </span>
                </button>
              </div>
            </form>
          </AdminSectionCard>
        </div>

        {/* Right Live Banner Simulator */}
        <aside className="min-w-0 lg:sticky lg:top-20 lg:col-span-4">
          <AdminSectionCard
            delayIndex={1}
            title={isKhmer ? "មើលជាមុនរបារជូនដំណឹង" : "Banner Preview"}
            subtitle={isKhmer ? "ទម្រង់បង្ហាញលើផ្ទាំងកសិករ" : "Live appearance in farmer view"}
            icon={<Languages className="h-4 w-4" />}
            action={
              <div className="inline-flex rounded-lg border border-[#cbd0dd] bg-[#f5f7fa] p-0.5 text-[10px] font-bold dark:border-[#373e53] dark:bg-[#0f111a]">
                <button
                  type="button"
                  onClick={() => setPreviewLang("en")}
                  className={cn(
                    "rounded px-2 py-0.5",
                    previewLang === "en"
                      ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                      : "text-[#6e7891] dark:text-[#8a94ad]",
                  )}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLang("km")}
                  className={cn(
                    "rounded px-2 py-0.5",
                    previewLang === "km"
                      ? "bg-white text-[#004dff] shadow-xs dark:bg-[#181d2b] dark:text-[#85a9ff]"
                      : "text-[#6e7891] dark:text-[#8a94ad]",
                  )}
                >
                  KM
                </button>
              </div>
            }
          >
            <div className="space-y-3 rounded-xl border border-[#adc5ff] bg-[#e5edff]/50 p-4 dark:border-[#3874ff]/35 dark:bg-[#3874ff]/10">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#004dff] dark:text-[#85a9ff]">
                  <Megaphone className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "សេចក្តីជូនដំណឹង" : "Announcement"}</span>
                </span>
                <AdminStatusBadge tone={isActive ? "emerald" : "slate"} pulse={isActive}>
                  {isActive ? "Live" : "Paused"}
                </AdminStatusBadge>
              </div>

              <p className="max-h-48 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-[#141824] dark:text-[#eff2f6]">
                {previewLang === "km"
                  ? textKh.trim() || text.trim() || "Preview banner text..."
                  : text.trim() || "Preview banner text..."}
              </p>
            </div>

            <div className="mt-4 space-y-2 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "បញ្ជីត្រួតពិនិត្យ" : "Readiness Checklist"}
              </div>
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-[#525b75] dark:text-[#9fa6bc]">{item.label}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      item.done
                        ? "text-[#1c6c09] dark:text-[#90ee7a]"
                        : "text-[#8a94ad]",
                    )}
                  >
                    {item.done ? <Check className="h-3.5 w-3.5" /> : "—"}
                  </span>
                </div>
              ))}
            </div>
          </AdminSectionCard>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
