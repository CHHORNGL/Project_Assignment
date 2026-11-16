import React, { useState } from "react";
import { ArrowLeft, Check, Languages, Save, Sprout } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { AdminSectionCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

interface CropFormData {
  isEdit: boolean;
  formAction: string;
  backUrl: string;
  formValues: {
    name: string;
    nameKh: string;
    emoji: string;
    description: string;
    descriptionKh: string;
  };
}

const EMOJI_PRESETS = ["🌾", "🥔", "🍅", "🥒", "🌶️", "🍌", "🌽", "🥜", "🌱", "🥬", "🍊", "🥥"];

export default function AdminCropFormPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<CropFormData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const v = d.formValues;

  const [name, setName] = useState(v.name || "");
  const [nameKh, setNameKh] = useState(v.nameKh || "");
  const [emoji, setEmoji] = useState(v.emoji || "");
  const [description, setDescription] = useState(v.description || "");
  const [descriptionKh, setDescriptionKh] = useState(v.descriptionKh || "");
  const [previewLang, setPreviewLang] = useState<"en" | "km">(isKhmer ? "km" : "en");

  const checklist = [
    {
      label: isKhmer ? "ឈ្មោះភាសាអង់គ្លេស" : "English Name",
      done: name.trim().length > 0,
    },
    {
      label: isKhmer ? "ឈ្មោះភាសាខ្មែរ" : "Khmer Name",
      done: nameKh.trim().length > 0,
    },
    {
      label: isKhmer ? "ការពិពណ៌នាអង់គ្លេស" : "English Summary",
      done: description.trim().length > 0,
    },
    {
      label: isKhmer ? "ការពិពណ៌នាខ្មែរ" : "Khmer Summary",
      done: descriptionKh.trim().length > 0,
    },
  ];
  const completeCount = checklist.filter((item) => item.done).length;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isKhmer ? "ត្រឡប់ទៅបញ្ជីដំណាំ" : "Back to Crops"}</span>
        </a>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Main Form */}
        <div className="min-w-0 lg:col-span-8">
          <AdminSectionCard
            delayIndex={0}
            title={
              d.isEdit
                ? isKhmer
                  ? "កែប្រែព័ត៌មានដំណាំ"
                  : "Update Crop Profile"
                : isKhmer
                  ? "ចុះបញ្ជីប្រភេទដំណាំថ្មី"
                  : "Register Crop Variety"
            }
            subtitle={
              isKhmer
                ? "បញ្ចូលឈ្មោះដំណាំ រូបតំណាង និងការពិពណ៌នាជាភាសាអង់គ្លេស និងខ្មែរ"
                : "Provide localized English and Khmer catalog labels and agronomy notes"
            }
            icon={<Sprout className="h-4 w-4" />}
          >
            <form method="POST" action={d.formAction} className="space-y-5">
              <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

              <div className="grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ឈ្មោះដំណាំ (អង់គ្លេស) *" : "Crop Name (English) *"}
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jasmine Rice"
                    className="ai-input text-xs"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "រូបតំណាង Emoji" : "Emoji Icon"}
                  </label>
                  <input
                    type="text"
                    name="emoji"
                    maxLength={8}
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    placeholder="🌾"
                    className="ai-input text-center text-base"
                  />
                </div>

                <div className="sm:col-span-12">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] font-medium text-[#6e7891] dark:text-[#8a94ad]">
                      {isKhmer ? "ជ្រើសរហ័ស៖" : "Quick pick:"}
                    </span>
                    {EMOJI_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEmoji(preset)}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border text-sm transition",
                          emoji === preset
                            ? "border-[#3874ff] bg-[#e5edff] dark:border-[#85a9ff] dark:bg-[#3874ff]/20"
                            : "border-[#e3e6ed] bg-[#f5f7fa] hover:border-[#cbd0dd] dark:border-[#2b3245] dark:bg-[#0f111a]",
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-12">
                  <label className="mb-1.5 block text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                    {isKhmer ? "ឈ្មោះដំណាំ (ខ្មែរ)" : "Crop Name (Khmer)"}
                  </label>
                  <input
                    type="text"
                    name="name_kh"
                    value={nameKh}
                    onChange={(e) => setNameKh(e.target.value)}
                    placeholder="ឧ. ស្រូវផ្កាម្លិះ"
                    className="ai-input text-xs"
                  />
                </div>

                <div className="sm:col-span-12">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "ការពិពណ៌នា (អង់គ្លេស)" : "Agronomy Notes (English)"}
                    </label>
                    <span className="font-mono text-[10.5px] text-[#8a94ad]">
                      {description.length} chars
                    </span>
                  </div>
                  <textarea
                    name="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Key characteristics, growing season, or diagnostic guidance..."
                    className="ai-input text-xs"
                  />
                </div>

                <div className="sm:col-span-12">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#31374a] dark:text-[#cbd0dd]">
                      {isKhmer ? "ការពិពណ៌នា (ខ្មែរ)" : "Agronomy Notes (Khmer)"}
                    </label>
                    <span className="font-mono text-[10.5px] text-[#8a94ad]">
                      {descriptionKh.length} chars
                    </span>
                  </div>
                  <textarea
                    name="description_kh"
                    rows={3}
                    value={descriptionKh}
                    onChange={(e) => setDescriptionKh(e.target.value)}
                    placeholder="លក្ខណៈទូទៅ រដូវដាំដុះ ឬការណែនាំបឋម..."
                    className="ai-input text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6ed] pt-4 dark:border-[#2b3245]">
                <a href={d.backUrl} className="ai-btn-secondary h-9 gap-1.5 px-3.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "ត្រឡប់ក្រោយ" : "Cancel"}</span>
                </a>
                <button type="submit" className="ai-btn-primary h-9 gap-1.5 px-6 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {d.isEdit
                      ? isKhmer
                        ? "រក្សាទុកការកែប្រែ"
                        : "Update Crop"
                      : isKhmer
                        ? "បង្កើតដំណាំ"
                        : "Add Crop"}
                  </span>
                </button>
              </div>
            </form>
          </AdminSectionCard>
        </div>

        {/* Right Sticky Live Catalog Card Preview & Readiness */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:col-span-4">
          <AdminSectionCard
            delayIndex={1}
            title={isKhmer ? "មើលជាមុន" : "Catalog Preview"}
            subtitle={isKhmer ? "ទម្រង់បង្ហាញក្នុងកាតាឡុក" : "Live appearance in crop directory"}
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
            <div className="rounded-xl border border-[#e3e6ed] bg-[#f5f7fa]/75 p-4 dark:border-[#2b3245] dark:bg-[#0f111a]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#90d67f]/60 bg-[#d9fbd0]/65 text-2xl dark:border-[#25b003]/35 dark:bg-[#25b003]/15">
                    {emoji.trim() || "🌱"}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-bold text-[#141824] dark:text-[#eff2f6]">
                      {previewLang === "km"
                        ? nameKh.trim() || name.trim() || "Untitled Crop"
                        : name.trim() || "Untitled Crop"}
                    </div>
                    <div className="truncate text-xs text-[#6e7891] dark:text-[#8a94ad]">
                      {previewLang === "km"
                        ? name.trim() || "—"
                        : nameKh.trim() || "No Khmer label"}
                    </div>
                  </div>
                </div>
                <AdminStatusBadge tone={completeCount === 4 ? "emerald" : "amber"}>
                  {completeCount}/4
                </AdminStatusBadge>
              </div>

              <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-[#525b75] dark:text-[#9fa6bc]">
                {previewLang === "km"
                  ? descriptionKh.trim() ||
                    description.trim() ||
                    (isKhmer ? "មិនទាន់មានការពិពណ៌នា..." : "Preview description...")
                  : description.trim() || descriptionKh.trim() || "Preview description..."}
              </p>
            </div>

            <div className="mt-4 space-y-2 border-t border-[#e3e6ed] pt-3.5 dark:border-[#2b3245]">
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6e7891] dark:text-[#8a94ad]">
                {isKhmer ? "ភាពពេញលេញទិន្នន័យ" : "Localization Checklist"}
              </div>
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-[#525b75] dark:text-[#9fa6bc]">{item.label}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-semibold",
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
