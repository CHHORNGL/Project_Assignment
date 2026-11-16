import React, { useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Cpu,
  Layers,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  Stethoscope,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  AnnouncementMarquee,
  type MarqueeBannerItem,
} from "@/components/farmer/AnnouncementMarquee";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GuestLandingData {
  guestChatUrl: string;
  loginUrl: string;
  registerUrl: string;
  staffLoginUrl: string;
  diagnoseUrl: string;
  detailUrl: string;
  premiumPrice: string;
  yearlyMonthly: string;
  yearlyTotal: string;
  yearlyDiscountPercent: string;
  crops: Array<{ id: number; name: string }>;
  marquees: MarqueeBannerItem[];
  supervisor?: { name?: string; role?: string };
  team?: Array<{ name?: string; role?: string }>;
}

const SAMPLE_REPORTS = {
  rice: {
    crop: "Rice (Oryza sativa)",
    cropKm: "ស្រូវ (Oryza sativa)",
    disease: "Rice Blast (Magnaporthe oryzae)",
    diseaseKm: "ជំងឺប្លាសស្រូវ (Rice Blast)",
    confidence: "94.2%",
    symptoms: [
      "Diamond-shaped leaf lesions",
      "Gray-green water-soaked margins",
      "Neck rot risk at panicle",
    ],
    symptomsKm: [
      "ស្នាមរាងពេជ្រលើស្លឹកស្រូវ",
      "គែមស្លឹកពណ៌ប្រផេះលាយបៃតង",
      "ហានិភ័យរលួយកួរនៅដំណាក់កាលចេញផ្កា",
    ],
    treatment: [
      "Apply tricyclazole-based fungicide at early boot stage.",
      "Avoid excess nitrogen fertilization during humid weeks.",
      "Maintain shallow flood levels and clear field edges.",
    ],
    treatmentKm: [
      "ប្រើថ្នាំការពារផ្សិតតាមកម្រិតណែនាំនៅដំណាក់កាលផើម។",
      "ជៀសវាងការដាក់ជីអ៊ុយរ៉េច្រើនហួសនៅពេលសំណើមខ្ពស់។",
      "គ្រប់គ្រងកម្រិតទឹក និងសម្អាតស្មៅតាមភ្លឺស្រែ។",
    ],
  },
  cassava: {
    crop: "Cassava (Manihot esculenta)",
    cropKm: "ដំឡូងមី (Manihot esculenta)",
    disease: "Cassava Mosaic Disease (CMD)",
    diseaseKm: "ជំងឺម៉ូសាអ៊ីកដំឡូងមី (CMD)",
    confidence: "91.8%",
    symptoms: [
      "Yellow-green chlorotic leaf mosaic",
      "Twisted asymmetrical leaf blades",
      "Stunted apical shoot vigor",
    ],
    symptomsKm: [
      "ស្លឹកប្រែពណ៌លឿងបៃតងចម្រុះ",
      "សន្លឹកស្លឹករួញខុសទ្រង់ទ្រាយធម្មតា",
      "លូតលាស់យឺតនៅត្រួយខ្ចី",
    ],
    treatment: [
      "Rogue infected plants early before whitefly vector dispersal.",
      "Replant with certified mosaic-tolerant stem cuttings.",
      "Monitor surrounding field edges for Bemisia tabaci.",
    ],
    treatmentKm: [
      "ដកដើមដែលឆ្លងជំងឺចេញជាបន្ទាន់មុនសត្វល្អិតបន្តឆ្លង។",
      "ជ្រើសរើសកំណាត់ដើមពូជធន់ជំងឺ និងស្អាតសម្រាប់ដាំឡើងវិញ។",
      "ត្រួតពិនិត្យសត្វល្អិតសជុំវិញចម្ការជាប្រចាំ។",
    ],
  },
};

export default function GuestLandingPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<GuestLandingData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;

  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: isKhmer
        ? "សួស្តី! ខ្ញុំគឺ AGRI SYSTEM AI។ សាកល្បងសួរអំពីរោគសញ្ញាដំណាំ ឬជំងឺស្រូវ និងដំឡូងមី។"
        : "Welcome to AGRI SYSTEM AI. Ask a quick agronomy question or test our diagnostic engine below.",
    },
  ]);

  const [sampleCrop, setSampleCrop] = useState<"rice" | "cassava">("rice");
  const [yearlyBilling, setYearlyBilling] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const sendPreviewMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || chatBusy) return;
    setChatMessages((prev) => [...prev, { role: "user", text: message }]);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await postJson<{ reply?: string; message?: string; error?: string }>(
        d.guestChatUrl,
        { message },
        bootstrap.csrfToken,
      );
      const reply =
        res.data.reply ||
        res.data.message ||
        res.data.error ||
        (isKhmer ? "សូមចូលគណនី ដើម្បីបន្តសន្ទនាជាមួយ AGRI AI។" : "Sign in to continue chatting with AGRI AI.");
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: isKhmer ? "មិនអាចភ្ជាប់សេវា AI សាកល្បងបានទេនៅពេលនេះ។" : "Unable to reach AI preview service right now.",
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  const handleGuestChat = (e: React.FormEvent) => {
    e.preventDefault();
    void sendPreviewMessage(chatInput);
  };

  const samplePrompts = isKhmer
    ? ["រោគសញ្ញាជំងឺប្លាសស្រូវ?", "វិធីការពារផ្សិតរដូវភ្លៀង"]
    : ["Signs of Rice Blast?", "Rainy season fungal tips"];

  const report = SAMPLE_REPORTS[sampleCrop];
  const faqs = [
    {
      q: isKhmer ? "តើប្រព័ន្ធវិនិច្ឆ័យ AI ដំណើរការយ៉ាងដូចម្តេច?" : "How does AGRI SYSTEM combine rules and AI?",
      a: isKhmer
        ? "វាផ្សំក្បួនវិទ្យាសាស្ត្រកសិកម្ម ដែលត្រួតពិនិត្យដោយអ្នកជំនាញ ជាមួយជំនួយការ AI សម្រាប់សួរឆ្លើយ។"
        : "Our dual engine pairs deterministic agronomy rule graphs validated by experts with conversational AI copilot triage.",
    },
    {
      q: isKhmer ? "តើអាចប្រើជាភាសាខ្មែរពេញលេញបានទេ?" : "Is full Khmer language & audio narration supported?",
      a: isKhmer
        ? "បាទ/ចាស គ្រប់ទំព័រ ការវិនិច្ឆ័យ និងការអានសំឡេង គាំទ្រភាសាខ្មែរ និងអង់គ្លេស។"
        : "Yes. Every workflow, disease encyclopedia entry, expert chat, and TTS audio briefing supports seamless English and Khmer switching.",
    },
    {
      q: isKhmer ? "តើមានវិធីបង់ប្រាក់អ្វីខ្លះសម្រាប់ Pro?" : "How do farmers activate Pro membership?",
      a: isKhmer
        ? "អ្នកអាចទូទាត់ភ្លាមៗតាមរយៈ Bakong KHQR ឬកាត/PayPal។"
        : "Instant activation works via Bakong KHQR across Cambodian banks or PayPal, unlocking unlimited AI chats and priority expert review.",
    },
  ];

  return (
    <div className="nx-landing-wrap relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-obsidian-950 dark:text-slate-100">
      <div className="nx-aurora-1 ai-neural-mesh" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-obsidian-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href={bootstrap.urls.home || "/"} className="flex items-center gap-2.5">
            <img
              src={bootstrap.urls.logoLight || "/static/img/newlogo.svg"}
              alt="AGRI SYSTEM"
              className="h-7 w-7 dark:hidden"
            />
            <img
              src={bootstrap.urls.logoDark || "/static/img/newlogo-dark.svg"}
              alt="AGRI SYSTEM"
              className="hidden h-7 w-7 dark:block"
            />
            <span className="font-display text-sm font-extrabold tracking-tight">AGRI SYSTEM</span>
            <span className="nx-badge hidden rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 sm:inline-block">
              AI PLATFORM
            </span>
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher
              lang={bootstrap.lang}
              enUrl={bootstrap.urls.updateLanguageEn}
              kmUrl={bootstrap.urls.updateLanguageKm}
            />
            <ThemeToggle />
            <a href={d.loginUrl} className="ai-btn-secondary hidden h-9 px-3.5 text-xs sm:inline-flex">
              {isKhmer ? "ចូលគណនី" : "Sign In"}
            </a>
            <a href={d.registerUrl} className="ai-btn-primary h-9 px-4 text-xs">
              {isKhmer ? "ចុះឈ្មោះឥតគិតថ្លៃ" : "Get Started"}
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6 lg:py-14">
        {/* Announcement Marquee if present */}
        <AnnouncementMarquee
          marquees={d.marquees}
          isKhmer={isKhmer}
          badgeLabel={isKhmer ? "ព័ត៌មានថ្មី" : "Advisory"}
        />

        {/* Hero Split */}
        <section className="grid items-center gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-6">
            <span className="nx-badge inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              {isKhmer ? "ប្រព័ន្ធវិនិច្ឆ័យជំងឺដំណាំ AI ជំនាន់ថ្មី" : "Precision AI Agronomy Intelligence"}
            </span>
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {isKhmer ? "វិនិច្ឆ័យដំណាំឆ្លាតវៃ" : "Diagnose crop health in"}{" "}
              <span className="nx-gradient-text bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500 bg-clip-text text-transparent">
                {isKhmer ? "លឿន និងច្បាស់លាស់" : "real time."}
              </span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {isKhmer
                ? "រួមបញ្ចូលការវិភាគរោគសញ្ញាតាមច្បាប់កសិកម្ម ជំនួយការ AI ការព្យាករណ៍អាកាសធាតុ និងការប្រឹក្សាជាមួយអ្នកជំនាញ។"
                : "Combine deterministic rule inference, AI agronomy copilot chat, localized weather intelligence, and verified agronomist review inside one unified workspace."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href={d.diagnoseUrl} className="ai-btn-primary px-6 py-3">
                <Stethoscope className="h-4 w-4" />
                {isKhmer ? "សាកល្បងវិនិច្ឆ័យភ្លាម" : "Launch Guided Diagnosis"}
              </a>
              <a href={d.registerUrl} className="ai-btn-secondary px-5 py-3">
                {isKhmer ? "បង្កើតគណនីកសិករ" : "Create Farmer Account"}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isKhmer ? "បុគ្គលិក ឬអ្នកជំនាញ?" : "Agronomist or Administrator?"}{" "}
              <a href={d.staffLoginUrl} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                {isKhmer ? "ចូលតាមច្រកបុគ្គលិក →" : "Staff Portal →"}
              </a>
            </p>
          </div>

          {/* Interactive Preview Window */}
          <div className="nx-dwrap lg:col-span-6">
            <div className="ai-surface overflow-hidden shadow-2xl">
              <div className="nx-dtbar flex items-center justify-between border-b border-slate-200/70 bg-slate-100/70 px-4 py-2.5 dark:border-slate-800 dark:bg-obsidian-900">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span
                  id="nxLiveActivity"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  {isKhmer ? "សាកល្បង AI Copilot ផ្ទាល់" : "Live AI Copilot Preview"}
                </span>
              </div>

              <div id="nxInteractiveChat" className="p-5">
                <div id="nxChatBody" className="mb-3 max-h-60 space-y-2.5 overflow-y-auto pr-1 text-xs">
                  {chatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 leading-relaxed",
                        m.role === "user"
                          ? "ml-10 bg-indigo-600 text-white"
                          : "mr-6 border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-obsidian-850",
                      )}
                    >
                      <span className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase opacity-75">
                        {m.role === "assistant" && <Bot className="h-3 w-3" />}
                        {m.role === "user" ? (isKhmer ? "កសិករ" : "Farmer") : "AGRI AI"}
                      </span>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {samplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={chatBusy}
                      onClick={() => void sendPreviewMessage(prompt)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-800 dark:bg-obsidian-950 dark:text-slate-300 dark:hover:text-indigo-300"
                    >
                      + {prompt}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleGuestChat} className="flex gap-2">
                  <input
                    id="nxChatInput"
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={isKhmer ? "ឧ. ស្លឹកស្រូវមានស្នាមអុជពណ៌ត្នោត..." : "e.g. Diamond spots appearing on rice leaves..."}
                    className="ai-input py-2 text-xs"
                  />
                  <button
                    id="nxChatSendBtn"
                    type="submit"
                    disabled={chatBusy}
                    aria-label="Send message"
                    className="ai-btn-primary h-10 shrink-0 px-4 text-xs"
                  >
                    {chatBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow + 3D Scanner + Sample Crop Report */}
        <section id="nxWorkflow" className="grid gap-6 lg:grid-cols-2">
          <div id="nx3DShowcase" className="ai-surface relative overflow-hidden p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <Cpu className="h-4 w-4" />{" "}
                {isKhmer ? "ប្រព័ន្ធវិភាគរោគសញ្ញា និងក្បួនច្បាប់ AI" : "Symptom & Rule Inference Engine"}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                {isKhmer ? "រួចរាល់" : "Ready"}
              </span>
            </div>
            <div id="nx3dCanvas" className="rounded-2xl border border-slate-200/80 bg-slate-950 p-5 text-slate-100 dark:border-slate-800">
              <div id="nx3dViewport" className="space-y-4">
                <div id="nx3dScene" className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/70 to-slate-900 p-4">
                  <div id="nx3dLaser" className="mb-3 h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div id="nx3dCardLeft" className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                      <p className="text-[10px] uppercase tracking-wider text-indigo-300">
                        {isKhmer ? "ក្រាហ្វរោគសញ្ញា" : "Symptom Graph"}
                      </p>
                      <p className="mt-1 font-bold">
                        {isKhmer ? "ស្លឹកលឿង · ស្នាមអុជ · សំណើម 84%" : "Chlorosis · Lesions · Humidity 84%"}
                      </p>
                    </div>
                    <div id="nx3dCardRight" className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300">
                        {isKhmer ? "កម្រិតភាពជឿជាក់" : "Confidence Match"}
                      </p>
                      <p className="mt-1 font-bold">
                        {isKhmer ? "94.2% ផ្ទៀងផ្ទាត់ដោយច្បាប់ + AI" : "94.2% Verified Rule + AI"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-300">
                  <div className="rounded-lg bg-white/5 p-2">
                    {isKhmer ? "1. ជ្រើសរើសដំណាំ" : "1. Select Crop"}
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    {isKhmer ? "2. ផ្ទៀងផ្ទាត់រោគសញ្ញា" : "2. Match Signals"}
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    {isKhmer ? "3. ផែនការព្យាបាល" : "3. Action Plan"}
                  </div>
                </div>
              </div>
            </div>

            {d.crops && d.crops.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {isKhmer ? "ដំណាំគាំទ្រ:" : "Supported:"}
                </span>
                {d.crops.slice(0, 6).map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-800 dark:bg-obsidian-850 dark:text-slate-300"
                  >
                    <Sprout className="h-3 w-3 text-emerald-500" />
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div id="nxSampleReport" className="ai-surface p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">
                {isKhmer ? "គំរូលទ្ធផលវិនិច្ឆ័យអន្តរកម្ម" : "Interactive Sample Diagnosis"}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-crop="rice"
                  onClick={() => setSampleCrop("rice")}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs font-semibold transition",
                    sampleCrop === "rice" ? "bg-indigo-600 text-white" : "ai-btn-secondary",
                  )}
                >
                  <Sprout className="mr-1 inline h-3.5 w-3.5" /> {isKhmer ? "ស្រូវ" : "Rice"}
                </button>
                <button
                  type="button"
                  data-crop="cassava"
                  onClick={() => setSampleCrop("cassava")}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs font-semibold transition",
                    sampleCrop === "cassava" ? "bg-indigo-600 text-white" : "ai-btn-secondary",
                  )}
                >
                  <Layers className="mr-1 inline h-3.5 w-3.5" /> {isKhmer ? "ដំឡូងមី" : "Cassava"}
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-obsidian-950/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {isKhmer ? report.cropKm : report.crop}
                  </p>
                  <h3 className="font-display text-base font-bold">
                    {isKhmer ? report.diseaseKm : report.disease}
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                  {report.confidence} {isKhmer ? "ត្រូវគ្នា" : "Match"}
                </span>
              </div>
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 font-bold uppercase tracking-wider text-slate-500">
                    {isKhmer ? "រោគសញ្ញាសង្កេតឃើញ" : "Observed Signals"}
                  </p>
                  <ul className="space-y-1.5">
                    {(isKhmer ? report.symptomsKm : report.symptoms).map((s) => (
                      <li key={s} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 font-bold uppercase tracking-wider text-slate-500">
                    {isKhmer ? "ជំហានណែនាំ" : "Recommended Steps"}
                  </p>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                    {(isKhmer ? report.treatmentKm : report.treatment).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="nxPricing" className="ai-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold">
                {isKhmer ? "គម្រោងសមាជិកភាព" : "Transparent Plans"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isKhmer
                  ? "ចាប់ផ្តើមដោយឥតគិតថ្លៃ ឬដំឡើងទៅ Pro សម្រាប់ការប្រឹក្សា AI គ្មានដែនកំណត់"
                  : "Start free or unlock unlimited AI consultations & priority agronomy."}
              </p>
            </div>
            <button
              id="nxPriceToggle"
              type="button"
              onClick={() => setYearlyBilling((v) => !v)}
              className="ai-btn-secondary h-9 px-4 text-xs"
            >
              {yearlyBilling
                ? isKhmer
                  ? `ប្រចាំឆ្នាំ (-${d.yearlyDiscountPercent}%)`
                  : `Yearly (-${d.yearlyDiscountPercent}%)`
                : isKhmer
                  ? "ប្រចាំខែ"
                  : "Monthly Billing"}
            </button>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 p-6 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isKhmer ? "គម្រោងឥតគិតថ្លៃ" : "Starter"}
              </p>
              <p className="mt-2 font-display text-3xl font-extrabold">
                $0<span className="text-sm font-medium text-slate-400">/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{isKhmer ? "ឧបករណ៍វិនិច្ឆ័យដំណាំតាមច្បាប់" : "Rule-based crop diagnosis wizard"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{isKhmer ? "ក្រេឌីតសាកល្បង AI Copilot" : "Starter AI Copilot credits"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{isKhmer ? "ការព្យាករណ៍អាកាសធាតុប្រចាំសប្តាហ៍" : "Weather intelligence summary"}</span>
                </li>
              </ul>
              <a href={d.registerUrl} className="ai-btn-secondary mt-6 w-full">
                {isKhmer ? "ចាប់ផ្តើមដោយឥតគិតថ្លៃ" : "Start Free"}
              </a>
            </div>

            <div className="rounded-2xl border-2 border-indigo-500 bg-indigo-500/[0.04] p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Pro Agronomist
              </p>
              <p id="nxProPlanPrice" className="mt-2 font-display text-3xl font-extrabold">
                ${yearlyBilling ? d.yearlyMonthly : d.premiumPrice}
                <span className="text-sm font-medium text-slate-400">/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{isKhmer ? "ប្រឹក្សាជាមួយ AI Copilot គ្មានដែនកំណត់" : "Unlimited AI Agronomy Chat Copilot"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{isKhmer ? "អាទិភាពពិនិត្យដោយអ្នកជំនាញ" : "Priority Human Agronomist Verification"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{isKhmer ? "បង់ប្រាក់ភ្លាមតាម Bakong KHQR" : "Bakong KHQR & Instant Activation"}</span>
                </li>
              </ul>
              <a href={d.registerUrl} className="ai-btn-primary mt-6 w-full">
                {isKhmer ? "ដំឡើងគម្រោងក្រោយចុះឈ្មោះ" : "Upgrade After Sign Up"}
              </a>
            </div>
          </div>
        </section>

        {/* Project Team + FAQ */}
        <section id="nxProjectDetail" className="grid gap-6 lg:grid-cols-2">
          <div className="ai-surface p-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
              <span>{isKhmer ? "ការស្រាវជ្រាវ និងវិស្វកម្ម" : "Academic & Engineering Credits"}</span>
            </div>
            <h2 className="font-display text-lg font-bold">
              {isKhmer ? "ក្រុមស្រាវជ្រាវ និងអភិវឌ្ឍន៍" : "Research Supervision & Team"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Supervised by <strong>{d.supervisor?.name || "Sek Socheat"}</strong> — built by{" "}
              {(d.team || [{ name: "Mao Seavik" }]).map((m) => m.name).filter(Boolean).join(", ")}.
            </p>
            <a
              href={d.detailUrl}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <span>{isKhmer ? "មើលស្ថាបត្យកម្មប្រព័ន្ធ" : "View Architecture Overview"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div id="nxFaqAccordion" className="ai-surface divide-y divide-slate-200/70 p-4 dark:divide-slate-800/70">
            {faqs.map((item, idx) => (
              <div key={idx} className="py-2">
                <button
                  type="button"
                  onClick={() => setOpenFaq((cur) => (cur === idx ? null : idx))}
                  className="flex w-full items-center justify-between py-2 text-left text-sm font-bold"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", openFaq === idx && "rotate-180")} />
                </button>
                {openFaq === idx && (
                  <p className="pb-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <img
              src={bootstrap.urls.logoLight || "/static/img/newlogo.svg"}
              alt="AGRI SYSTEM"
              className="h-5 w-5 dark:hidden"
            />
            <img
              src={bootstrap.urls.logoDark || "/static/img/newlogo-dark.svg"}
              alt="AGRI SYSTEM"
              className="hidden h-5 w-5 dark:block"
            />
            <span className="font-semibold text-slate-700 dark:text-slate-300">AGRI SYSTEM</span>
            <span>· {isKhmer ? "ប្រព័ន្ធកសិកម្មឆ្លាតវៃ" : "AI Precision Agriculture"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href={d.detailUrl} className="hover:text-indigo-600 dark:hover:text-indigo-400">
              {isKhmer ? "អំពីប្រព័ន្ធ" : "Platform"}
            </a>
            <a href={d.staffLoginUrl} className="hover:text-indigo-600 dark:hover:text-indigo-400">
              {isKhmer ? "ច្រកបុគ្គលិក" : "Staff Portal"}
            </a>
            <a href={d.loginUrl} className="hover:text-indigo-600 dark:hover:text-indigo-400">
              {isKhmer ? "ចូលគណនី" : "Sign In"}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
