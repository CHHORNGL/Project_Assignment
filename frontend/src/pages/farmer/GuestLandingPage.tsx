import React, { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CloudSun,
  Cpu,
  Layers,
  Loader2,
  Mail,
  Menu,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Sprout,
  Stethoscope,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  AnnouncementMarquee,
  type MarqueeBannerItem,
} from "@/components/farmer/AnnouncementMarquee";
import { InteractiveModelShowcase } from "@/components/farmer/InteractiveModelShowcase";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GuestTeamMember {
  name?: string;
  name_kh?: string;
  rank?: string;
  rank_kh?: string;
  role?: string;
  task?: string;
  task_kh?: string;
  student_id?: string;
  department?: string;
  department_kh?: string;
  photo?: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  phoneHref?: string;
  telegram?: string;
  telegramUrl?: string;
}

interface GuestLandingStats {
  cropsCount?: number | null;
  diseasesCount?: number | null;
  rulesCount?: number | null;
  symptomsCount?: number | null;
  factsCount?: number | null;
}

interface GuestLandingData {
  guestChatUrl: string;
  loginUrl: string;
  registerUrl: string;
  staffLoginUrl: string;
  diagnoseUrl: string;
  detailUrl: string;
  showcaseModelUrl?: string;
  premiumPrice: string;
  yearlyMonthly: string;
  yearlyTotal: string;
  yearlyDiscountPercent: string;
  crops: Array<{ id: number; name: string }>;
  marquees: MarqueeBannerItem[];
  stats?: GuestLandingStats;
  supervisor?: GuestTeamMember;
  team?: GuestTeamMember[];
}

const SAMPLE_REPORTS = {
  rice: {
    crop: "Rice (Oryza sativa)",
    cropKm: "ស្រូវ (Oryza sativa)",
    disease: "Rice Blast (Magnaporthe oryzae)",
    diseaseKm: "ជំងឺប្លាសស្រូវ (Rice Blast)",
    confidence: "94.2%",
    symptoms: [
      "Diamond-shaped leaf lesions with gray centers",
      "Water-soaked borders along upper leaves",
      "Panicle neck rot risk near heading stage",
    ],
    symptomsKm: [
      "ស្នាមអុជរាងពេជ្រមានកណ្តាលពណ៌ប្រផេះលើស្លឹក",
      "គែមស្លឹកមានស្នាមសើមនៅស្លឹកផ្នែកខាងលើ",
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
      "Yellow-green chlorotic leaf mosaic pattern",
      "Twisted, asymmetrical young leaf blades",
      "Stunted apical shoot and reduced vigor",
    ],
    symptomsKm: [
      "ស្លឹកប្រែពណ៌លឿងបៃតងចម្រុះខុសប្រក្រតី",
      "សន្លឹកស្លឹករួញខុសទ្រង់ទ្រាយធម្មតា",
      "ត្រួយខ្ចីលូតលាស់យឺត និងដើមអន់ថយ",
    ],
    treatment: [
      "Rogue infected plants early before whitefly dispersal.",
      "Replant using certified mosaic-tolerant stem cuttings.",
      "Monitor surrounding field edges for whitefly vectors.",
    ],
    treatmentKm: [
      "ដកដើមដែលឆ្លងជំងឺចេញជាបន្ទាន់មុនសត្វល្អិតបន្តឆ្លង។",
      "ជ្រើសរើសកំណាត់ដើមពូជធន់ជំងឺ និងស្អាតសម្រាប់ដាំឡើងវិញ។",
      "ត្រួតពិនិត្យសត្វល្អិតសជុំវិញចម្ការជាប្រចាំ។",
    ],
  },
};

const TRUSTED_PARTNERS: Array<{
  name: string;
  logoUrl: string;
  paddingClass: string;
}> = [
  {
    name: "Norton University",
    logoUrl: "/static/img/partners/norton.png",
    paddingClass: "p-0.5 bg-white",
  },
  {
    name: "Angkor Green",
    logoUrl: "/static/img/partners/angkor-green.png",
    paddingClass: "p-0.5 bg-white",
  },
  {
    name: "DG Academy",
    logoUrl: "/static/img/partners/dg-academy.png",
    paddingClass: "p-0",
  },
  {
    name: "Cambodia Academic Space",
    logoUrl: "/static/img/partners/cambodia-academic-space.png",
    paddingClass: "p-0.5 bg-white",
  },
  {
    name: "Bakong",
    logoUrl: "/static/img/partners/bakong.png",
    paddingClass: "p-1 bg-white",
  },
  {
    name: "ABA",
    logoUrl: "/static/img/partners/aba.png",
    paddingClass: "p-0",
  },
];

function initialsFromName(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function TeamPortrait({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!photoUrl || imgFailed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-neutral-100 text-lg font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
          className,
        )}
      >
        {initialsFromName(name)}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      loading="lazy"
      onError={() => setImgFailed(true)}
      className={cn("h-full w-full object-cover object-top", className)}
    />
  );
}

export default function GuestLandingPage({
  bootstrap,
}: {
  bootstrap: AppBootstrap<GuestLandingData>;
}) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const { isDark } = useTheme();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: isKhmer
        ? "សួស្តី! ខ្ញុំគឺ AGRI SYSTEM AI។ សាកល្បងសួរអំពីរោគសញ្ញាដំណាំ ឬជំងឺស្រូវ និងដំឡូងមី។"
        : "Welcome to AGRI SYSTEM. Ask an agronomy question or test our diagnostic engine below.",
    },
  ]);

  const [sampleCrop, setSampleCrop] = useState<"rice" | "cassava">("rice");
  const [pipelineStep, setPipelineStep] = useState<0 | 1 | 2>(1);
  const [sceneTilt, setSceneTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
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
        (isKhmer
          ? "សូមចូលគណនី ដើម្បីបន្តសន្ទនាជាមួយ AGRI AI។"
          : "Sign in to continue chatting with AGRI AI.");
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: isKhmer
            ? "មិនអាចភ្ជាប់សេវា AI សាកល្បងបានទេនៅពេលនេះ។"
            : "Unable to reach AI preview service right now.",
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
  const pipelineStages = [
    {
      stepLabel: isKhmer ? "១. ជ្រើសរើសដំណាំ" : "01 Select Crop",
      leftTitle: isKhmer ? "ពូជដំណាំសកម្ម" : "Active Crop Profile",
      leftValue: isKhmer ? report.cropKm : report.crop,
      rightTitle: isKhmer ? "ក្រាហ្វក្បួនច្បាប់" : "Rule Graph Scope",
      rightValue:
        sampleCrop === "rice"
          ? isKhmer
            ? "ស្លឹក · កួរ · សំណើមដី"
            : "Foliar · Panicle · Field RH"
          : isKhmer
            ? "ត្រួយខ្ចី · ស្លឹក · សត្វល្អិត"
            : "Apical Shoot · Mosaic · Vectors",
    },
    {
      stepLabel: isKhmer ? "២. ផ្ទៀងផ្ទាត់រោគសញ្ញា" : "02 Match Signals",
      leftTitle: isKhmer ? "ក្រាហ្វរោគសញ្ញា" : "Symptom Signals",
      leftValue:
        sampleCrop === "rice"
          ? isKhmer
            ? "ស្លឹកលឿង · ស្នាមអុជពេជ្រ · សំណើម 84%"
            : "Diamond Lesions · Chlorosis · 84% RH"
          : isKhmer
            ? "ពណ៌លឿងបៃតង · ស្លឹករួញ · សត្វល្អិត"
            : "Chlorotic Mosaic · Blade Twist · Vectors",
      rightTitle: isKhmer ? "កម្រិតភាពជឿជាក់" : "Verified Match",
      rightValue: isKhmer
        ? `${report.confidence} ផ្ទៀងផ្ទាត់ដោយក្បួន + AI`
        : `${report.confidence} Agronomic Confidence`,
    },
    {
      stepLabel: isKhmer ? "៣. ផែនការព្យាបាល" : "03 Action Plan",
      leftTitle: isKhmer ? "ការវិនិច្ឆ័យគោលដៅ" : "Primary Finding",
      leftValue: isKhmer ? report.diseaseKm : report.disease,
      rightTitle: isKhmer ? "ជំហានអនុវត្តភ្លាម" : "Field Protocol",
      rightValue: isKhmer ? report.treatmentKm[0] : report.treatment[0],
    },
  ];
  const activePipelineStage = pipelineStages[pipelineStep] || pipelineStages[1];
  const supervisor = d.supervisor || {};
  const supervisorName =
    (isKhmer ? supervisor.name_kh : supervisor.name) || supervisor.name || "Sek Socheat";
  const supervisorRole =
    (isKhmer ? supervisor.rank_kh : supervisor.rank) ||
    supervisor.role ||
    (isKhmer ? "សាស្ត្រាចារ្យដឹកនាំស្រាវជ្រាវ" : "Research Supervisor");
  const supervisorTask =
    (isKhmer ? supervisor.task_kh : supervisor.task) ||
    supervisor.task ||
    (isKhmer
      ? "អ្នកគ្រប់គ្រងគម្រោង និងទីប្រឹក្សាសិក្សា"
      : "Project Supervisor & Academic Advisor");
  const supervisorDepartment =
    (isKhmer ? supervisor.department_kh : supervisor.department) || supervisor.department || "";
  const supervisorPhoto =
    supervisor.photoUrl ||
    (supervisor.photo
      ? `/static/img/image_detail/${encodeURIComponent(supervisor.photo)}`
      : "/static/img/image_detail/Sek%20Socheat.jpeg");
  const teamMembers: GuestTeamMember[] =
    d.team && d.team.length > 0
      ? d.team
      : [
          {
            name: "Mao Seavik",
            rank: "Leader & Backend Lead",
            photoUrl: "/static/img/image_detail/Mao%20Seavik.jpg",
          },
        ];

  const navItems = [
    { href: "#features", label: isKhmer ? "លក្ខណៈពិសេស" : "Features" },
    { href: "#nxWorkflow", label: isKhmer ? "ដំណើរការ" : "Workflow" },
    { href: "#nxProjectDetail", label: isKhmer ? "ក្រុមការងារ" : "Team" },
    { href: "#nxPricing", label: isKhmer ? "តម្លៃ" : "Pricing" },
    { href: "#nxFaqAccordion", label: isKhmer ? "សំណួរ" : "FAQ" },
  ];

  const features = [
    {
      Icon: BookOpen,
      title: isKhmer ? "វិនិច្ឆ័យផ្អែកលើក្បួនច្បាប់" : "Rule-Verified Diagnostics",
      desc: isKhmer
        ? "រួមបញ្ចូលក្រាហ្វរោគសញ្ញាដែលផ្ទៀងផ្ទាត់ដោយអ្នកជំនាញកសិកម្ម ដើម្បីផ្តល់ចម្លើយត្រឹមត្រូវ។"
        : "Deterministic crop pathology rules validated with agronomy experts for dependable triage.",
    },
    {
      Icon: Bot,
      title: isKhmer ? "ជំនួយការ AI កសិកម្មផ្ទាល់" : "Trained Agronomy AI",
      desc: isKhmer
        ? "គំរូ Qwen2.5-3B LoRA ហ្វឹកហាត់ និងបម្រើសេវាលើ Hugging Face Space សម្រាប់សួរឆ្លើយជំងឺដំណាំជាខ្មែរ និងអង់គ្លេស។"
        : "Fine-tuned Qwen2.5-3B LoRA copilot trained and served on Hugging Face Space for Khmer & English crop advice.",
    },
    {
      Icon: Volume2,
      title: isKhmer ? "បកប្រែ & សំឡេងពីរភាសា" : "Bilingual Voice Narration",
      desc: isKhmer
        ? "គាំទ្រភាសាខ្មែរ និងអង់គ្លេសពេញលេញ រួមទាំងសំឡេង Gemini 3.8 Flash TTS។"
        : "Full English and Khmer interface with optional Gemini 3.8 Flash TTS spoken readouts.",
    },
    {
      Icon: CloudSun,
      title: isKhmer ? "ការព្យាករណ៍អាកាសធាតុ" : "Weather Risk Intelligence",
      desc: isKhmer
        ? "តាមដានភ្លៀង ខ្យល់ និងពេលវេលាសមស្របសម្រាប់បាញ់ថ្នាំ ឬដាក់ជី។"
        : "Localized forecast insights and spray-window timing tuned to your farm region.",
    },
    {
      Icon: Users,
      title: isKhmer ? "ប្រឹក្សាអ្នកជំនាញផ្ទាល់" : "Human Expert Escalation",
      desc: isKhmer
        ? "ភ្ជាប់សំណួរទៅអ្នកជំនាញកសិកម្ម និង Admin ផ្ទាល់ជាមួយប្រវត្តិវិនិច្ឆ័យ។"
        : "Seamless live chat handoff to verified agronomists with your full field history attached.",
    },
    {
      Icon: Zap,
      title: isKhmer ? "ទូទាត់ភ្លាមតាម KHQR" : "Instant Bakong KHQR",
      desc: isKhmer
        ? "ដំឡើងគម្រោង Pro ភ្លាមៗដោយស្វ័យប្រវត្តិតាម Bakong KHQR ឬ Card/PayPal។"
        : "Automated Pro membership verification across Cambodian banks in seconds.",
    },
  ];

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
        ? "បាទ/ចាស គ្រប់ទំព័រ ការវិនិច្ឆ័យ និងការអានសំឡេង គាំទ្រភាសាខ្មែរ និងអង់គ្លេស (រួមទាំង Gemini 3.8 Flash TTS)។"
        : "Yes. Every workflow, disease guide, live expert chat, and audio briefing supports instant English and Khmer switching.",
    },
    {
      q: isKhmer ? "តើមានវិធីបង់ប្រាក់អ្វីខ្លះសម្រាប់ Pro?" : "How do farmers activate Pro membership?",
      a: isKhmer
        ? "អ្នកអាចទូទាត់ភ្លាមៗតាមរយៈ Bakong KHQR ឬកាត/PayPal ជាមួយការផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ។"
        : "Pay via Bakong KHQR across Cambodian banks for automatic verification within seconds, or checkout with card/PayPal.",
    },
  ];

  return (
    <div className="nx-landing-wrap relative min-h-dvh bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-50">
      {/* Harmonized ambient studio backdrop & subtle spatial coordinate field */}
      <div
        aria-hidden="true"
        className="nx-aurora-1 pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden"
      >
        <div className="nx-spatial-grid absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_65%_28%,#000_20%,transparent_80%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.065),_rgba(23,23,23,0.025)_42%,_transparent_72%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.085),_rgba(255,255,255,0.025)_42%,_transparent_72%)]" />
      </div>

      {/* Sticky Monochrome Header matching ChatDeck */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <a href={bootstrap.urls.home || "/"} className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <img
              src={bootstrap.urls.logoLight || "/static/img/newlogo.svg"}
              alt="AGRI SYSTEM"
              className="h-7 w-7 shrink-0 dark:hidden"
            />
            <img
              src={bootstrap.urls.logoDark || "/static/img/newlogo-dark.svg"}
              alt="AGRI SYSTEM"
              className="hidden h-7 w-7 shrink-0 dark:block"
            />
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-base">
              AGRI SYSTEM
            </span>
          </a>

          <nav
            aria-label={isKhmer ? "ម៉ឺនុយ" : "Primary navigation"}
            className="hidden items-center gap-8 text-sm font-medium text-neutral-600 dark:text-neutral-400 lg:flex"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors duration-150 hover:text-neutral-900 dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <LanguageSwitcher
              lang={bootstrap.lang}
              enUrl={bootstrap.urls.updateLanguageEn}
              kmUrl={bootstrap.urls.updateLanguageKm}
            />
            <ThemeToggle />
            <a
              href={d.loginUrl}
              className="hidden h-9 items-center justify-center rounded-full px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white sm:inline-flex"
            >
              {isKhmer ? "ចូលគណនី" : "Sign In"}
            </a>
            <a
              href={d.registerUrl}
              className="hidden h-9 items-center justify-center rounded-full bg-neutral-900 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 sm:inline-flex"
            >
              {isKhmer ? "ចាប់ផ្តើមប្រើ" : "Get Started"}
            </a>
            <button
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 lg:hidden"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Dropdown */}
        {mobileNavOpen && (
          <div className="border-t border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950 lg:hidden">
            <div className="flex flex-col space-y-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  {item.label}
                </a>
              ))}
              <div className="flex gap-2 pt-2">
                <a
                  href={d.loginUrl}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-neutral-200 text-xs font-medium dark:border-neutral-800"
                >
                  {isKhmer ? "ចូលគណនី" : "Sign In"}
                </a>
                <a
                  href={d.registerUrl}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white dark:bg-white dark:text-neutral-950"
                >
                  {isKhmer ? "ចាប់ផ្តើមប្រើ" : "Get Started"}
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Announcement Marquee if present */}
        <div className="pt-6">
          <AnnouncementMarquee
            marquees={d.marquees}
            isKhmer={isKhmer}
            badgeLabel={isKhmer ? "ព័ត៌មាន" : "Update"}
          />
        </div>

        {/* Split Editorial Hero + Borderless Floating 3D Print + Interactive Product Preview */}
        <section className="pb-14 pt-10 sm:pb-20 sm:pt-16">
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="text-center lg:col-span-7 lg:text-left">
              <div className="flex justify-center lg:justify-start">
                <span className="nx-badge inline-flex items-center rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-medium text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  {isKhmer
                    ? "គាំទ្រការវិនិច្ឆ័យដំណាំជាភាសាខ្មែរ និងអង់គ្លេស"
                    : "Precision AI Agronomy for Modern Farmers"}
                </span>
              </div>

              <h1 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl lg:text-6xl lg:leading-[1.08]">
                {isKhmer ? "ជំនួយការ AI " : "AI Assistant for "}
                <span className="nx-gradient-text bg-gradient-to-b from-neutral-950 to-neutral-600 bg-clip-text text-transparent dark:from-white dark:to-neutral-400">
                  {isKhmer ? "វិនិច្ឆ័យជំងឺដំណាំ។" : "Crop Health & Diagnostics."}
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400 sm:text-lg lg:mx-0">
                {isKhmer
                  ? "រួមបញ្ចូលក្បួនវិនិច្ឆ័យវិទ្យាសាស្ត្រ ជំនួយការ AI កសិកម្ម ការព្យាករណ៍អាកាសធាតុ និងការប្រឹក្សាជាមួយអ្នកជំនាញក្នុងកម្មវិធីតែមួយ។"
                  : "Combine rule-verified agronomy inference, conversational AI copilot guidance, weather risk tracking, and specialist support in one clean workspace."}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <a
                  href={d.diagnoseUrl}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <span>{isKhmer ? "សាកល្បងដោយឥតគិតថ្លៃ" : "Try For Free"}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={d.registerUrl}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-6 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Stethoscope className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  <span>{isKhmer ? "បង្កើតគណនីកសិករ" : "Create Farmer Account"}</span>
                </a>
              </div>
            </div>

            <div className="flex items-center justify-center lg:col-span-5">
              <InteractiveModelShowcase
                modelUrl={d.showcaseModelUrl || "/static/models/3D.glb"}
                isKhmer={isKhmer}
                isDark={isDark}
                className="h-[340px] sm:h-[410px] lg:h-[470px]"
              />
            </div>
          </div>

          {/* Centered Product Preview Frame (ChatDeck signature hero showcase) */}
          <div className="nx-dwrap mx-auto mt-12 max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/[0.06] dark:border-neutral-800 dark:bg-neutral-900/90 dark:shadow-black/50">
              <div className="nx-dtbar flex items-center justify-between border-b border-neutral-200 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/70">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
                    <Bot className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                    AGRI SYSTEM Copilot
                  </span>
                </div>
                <span
                  id="nxLiveActivity"
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600 dark:bg-blue-400" />
                  {isKhmer ? "សាកល្បងផ្ទាល់" : "Live Interactive Preview"}
                </span>
              </div>

              <div id="nxInteractiveChat" className="grid min-w-0 divide-y divide-neutral-200 dark:divide-neutral-800 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                {/* Left quick-guide column inside frame */}
                <div className="flex min-w-0 flex-col justify-between bg-neutral-50/50 p-4 dark:bg-neutral-950/40 sm:p-5 lg:col-span-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {isKhmer ? "សំណួរគំរូរហ័ស" : "Quick Prompts"}
                      </p>
                      <div className="mt-2.5 flex flex-col gap-2">
                        {samplePrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            disabled={chatBusy}
                            onClick={() => void sendPreviewMessage(prompt)}
                            className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="mt-6 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {isKhmer
                      ? "សាកល្បងសួរបានរហូតដល់ ៥ សំណួរដោយមិនចាំបាច់ចុះឈ្មោះ។"
                      : "Ask up to 5 trial questions directly before creating an account."}
                  </p>
                </div>

                {/* Right live conversation panel inside frame */}
                <div className="min-w-0 p-4 sm:p-6 lg:col-span-8">
                  <div
                    id="nxChatBody"
                    className="mb-4 h-60 space-y-3 overflow-y-auto pr-1 text-xs sm:text-[13px]"
                  >
                    {chatMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "min-w-0 rounded-2xl px-4 py-3 leading-relaxed",
                          m.role === "user"
                            ? "ml-auto max-w-[85%] bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                            : "mr-auto max-w-[92%] border border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200",
                        )}
                      >
                        <span className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-65">
                          {m.role === "assistant" && <Bot className="h-3 w-3" />}
                          {m.role === "user" ? (isKhmer ? "កសិករ" : "You") : "AGRI AI"}
                        </span>
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleGuestChat} className="flex gap-2">
                    <input
                      id="nxChatInput"
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={
                        isKhmer
                          ? "ឧ. ស្លឹកស្រូវមានស្នាមអុជពណ៌ត្នោត..."
                          : "Ask about rice, cassava, or crop symptoms..."
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-white/10 sm:text-sm"
                    />
                    <button
                      id="nxChatSendBtn"
                      type="submit"
                      disabled={chatBusy}
                      aria-label="Send message"
                      className="inline-flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                    >
                      {chatBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trusted by Leading Companies Worldwide Marquee (ChatDeck Showcase Strip) */}
        <section className="pb-14 pt-6 sm:pb-16">
          <div className="text-center">
            <p className="mb-8 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {isKhmer
                ? "ទទួលស្គាល់ និងគាំទ្រដោយដៃគូ និងស្ថាប័នឈានមុខគេ"
                : "Trusted by leading companies worldwide"}
            </p>
            <div className="ai-marquee-shell relative overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent dark:from-neutral-950 sm:w-24"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent dark:from-neutral-950 sm:w-24"
              />
              <div className="ai-marquee-viewport py-2">
                <div
                  className="ai-marquee-track"
                  style={{ "--marquee-duration": "32s" } as React.CSSProperties}
                >
                  {[0, 1].map((copyIdx) => (
                    <div
                      key={copyIdx}
                      aria-hidden={copyIdx === 1}
                      className="flex shrink-0 items-center gap-10 pr-10 sm:gap-14 sm:pr-14"
                    >
                      {TRUSTED_PARTNERS.map(({ name, logoUrl, paddingClass }) => (
                        <div
                          key={`${copyIdx}-${name}`}
                          className="group/partner flex shrink-0 items-center gap-3 opacity-75 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 shadow-sm dark:border-neutral-700",
                              paddingClass,
                            )}
                          >
                            <img
                              src={logoUrl}
                              alt={name}
                              loading="lazy"
                              className="h-full w-full object-contain"
                            />
                          </span>
                          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-neutral-800 dark:text-neutral-200 sm:text-lg">
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Crops Strip */}
        {d.crops && d.crops.length > 0 && (
          <section className="pb-16 pt-2 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              {isKhmer
                ? `គាំទ្រទិន្នន័យរោគសញ្ញា និងដំណាំចំនួន ${d.crops.length}+`
                : `Trained & Verified Across ${d.crops.length}+ Crop Profiles`}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              {d.crops.slice(0, 8).map((crop) => (
                <span
                  key={crop.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  <Sprout className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                  {crop.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ChatDeck 3x2 Feature Bento Grid */}
        <section id="features" className="py-14 sm:py-20">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl lg:text-5xl">
              {isKhmer ? "ហេតុអ្វីជ្រើសរើស AGRI SYSTEM?" : "Why Choose AGRI SYSTEM?"}
            </h2>
            <p className="mt-4 text-base text-neutral-600 dark:text-neutral-400 sm:text-lg">
              {isKhmer
                ? "រចនាឡើងសម្រាប់កសិករ និងអ្នកជំនាញកសិកម្ម ដោយភាពសាមញ្ញ ច្បាស់លាស់ និងរហ័ស។"
                : "Experience field agronomy powered by verified rules and AI—built for scale, designed for clarity."}
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 border-t border-neutral-200 dark:border-neutral-800 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="group/feature relative flex flex-col border-b border-neutral-200 py-8 dark:border-neutral-800 sm:py-10 md:odd:border-r lg:border-l lg:border-r-0 lg:odd:border-r-0 lg:last:border-r lg:[&:nth-child(3n)]:border-r"
              >
                <div className="pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100/80 to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100 dark:from-neutral-900/80" />
                <div className="relative z-10 mb-4 px-8 text-neutral-600 transition duration-200 group-hover/feature:text-neutral-900 dark:text-neutral-400 dark:group-hover/feature:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="relative z-10 mb-2 px-8 text-base font-bold">
                  <div className="absolute inset-y-0 left-0 h-6 w-1 origin-center rounded-br-full rounded-tr-full bg-neutral-300 transition-all duration-200 group-hover/feature:h-8 group-hover/feature:bg-neutral-900 dark:bg-neutral-700 dark:group-hover/feature:bg-white" />
                  <span className="inline-block text-neutral-900 transition duration-200 group-hover/feature:translate-x-1.5 dark:text-neutral-100">
                    {title}
                  </span>
                </div>
                <p className="relative z-10 max-w-xs px-8 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow Pipeline + Interactive Sample Report */}
        <section id="nxWorkflow" className="py-10 sm:py-12">
          <div className="grid min-w-0 gap-5 sm:gap-6 lg:grid-cols-2">
            {/* Pipeline Card */}
            <div
              id="nx3DShowcase"
              className="flex min-w-0 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-7"
            >
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                    <Cpu className="h-4 w-4 text-neutral-900 dark:text-white" />
                    {isKhmer ? "ដំណើរការវិនិច្ឆ័យ" : "Inference Pipeline"}
                  </span>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                    {isKhmer ? "ផ្ទៀងផ្ទាត់រួចរាល់" : "Rule + AI"}
                  </span>
                </div>

                <div
                  id="nx3dCanvas"
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0) return;
                    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
                    setSceneTilt({
                      rx: Number((-ny * 4.5).toFixed(2)),
                      ry: Number((nx * 5.5).toFixed(2)),
                    });
                  }}
                  onPointerLeave={() => setSceneTilt({ rx: 0, ry: 0 })}
                  className="relative overflow-hidden rounded-xl border border-neutral-200/90 bg-gradient-to-b from-neutral-50 via-white to-neutral-100/80 p-5 text-neutral-900 dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-black dark:text-neutral-100"
                >
                  <div
                    aria-hidden="true"
                    className="nx-spatial-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,#000_25%,transparent_80%)]"
                  />
                  <div
                    id="nx3dViewport"
                    style={{ perspective: "960px" }}
                    className="relative z-10 space-y-4"
                  >
                    <div
                      id="nx3dScene"
                      style={{
                        transform: `rotateX(${sceneTilt.rx}deg) rotateY(${sceneTilt.ry}deg)`,
                        transformStyle: "preserve-3d",
                      }}
                      className="relative overflow-hidden rounded-xl border border-neutral-200/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm transition-transform duration-200 ease-out dark:border-neutral-800/90 dark:bg-neutral-900/75"
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(14,165,233,0.08),_transparent_65%)] dark:bg-[radial-gradient(circle_at_50%_0%,_rgba(56,189,248,0.12),_transparent_65%)]"
                      />
                      <div
                        id="nx3dLaser"
                        className="nx-scan-laser pointer-events-none absolute inset-x-0 z-10 h-px bg-gradient-to-r from-transparent via-sky-500/70 to-transparent shadow-[0_0_12px_rgba(14,165,233,0.45)] dark:via-sky-400/75"
                      />
                      <div
                        style={{ transform: "translateZ(14px)" }}
                        className="relative z-10 grid gap-3 sm:grid-cols-2"
                      >
                        <div
                          id="nx3dCardLeft"
                          className="rounded-lg border border-neutral-200/90 bg-neutral-50/90 p-3.5 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-950/90"
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            {activePipelineStage.leftTitle}
                          </p>
                          <p className="mt-1.5 font-semibold text-neutral-900 dark:text-white">
                            {activePipelineStage.leftValue}
                          </p>
                        </div>
                        <div
                          id="nx3dCardRight"
                          className="rounded-lg border border-neutral-200/90 bg-neutral-50/90 p-3.5 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-950/90"
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            {activePipelineStage.rightTitle}
                          </p>
                          <p className="mt-1.5 font-semibold text-neutral-900 dark:text-white">
                            {activePipelineStage.rightValue}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-center text-[11px] font-medium min-[420px]:grid-cols-3">
                      {pipelineStages.map((stage, idx) => {
                        const isActiveStage = pipelineStep === idx;
                        return (
                          <button
                            key={stage.stepLabel}
                            type="button"
                            aria-pressed={isActiveStage}
                            onClick={() => setPipelineStep(idx as 0 | 1 | 2)}
                            className={cn(
                              "rounded-lg border px-2 py-2.5 transition-all duration-150",
                              isActiveStage
                                ? "border-neutral-900 bg-neutral-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-neutral-950"
                                : "border-neutral-200/90 bg-white/80 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-200",
                            )}
                          >
                            {stage.stepLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>
                  {isKhmer
                    ? "ដំណើរការតាមជំហានសម្រាប់លទ្ធផលជាក់លាក់"
                    : "Structured multi-step diagnosis workflow"}
                </span>
                <a
                  href={d.diagnoseUrl}
                  className="inline-flex items-center gap-1 font-medium text-neutral-900 hover:underline dark:text-white"
                >
                  <span>{isKhmer ? "ចាប់ផ្តើមវិនិច្ឆ័យ" : "Start Diagnosis"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Interactive Sample Report */}
            <div
              id="nxSampleReport"
              className="flex min-w-0 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-7"
            >
              <div>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {isKhmer ? "គំរូលទ្ធផលវិនិច្ឆ័យ" : "Sample Clinical Diagnosis"}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {isKhmer
                        ? "ប្តូរដំណាំដើម្បីមើលទម្រង់របាយការណ៍ជាក់ស្តែង"
                        : "Switch crop to preview structured field guidance"}
                    </p>
                  </div>

                  <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-950">
                    <button
                      type="button"
                      data-crop="rice"
                      onClick={() => setSampleCrop("rice")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                        sampleCrop === "rice"
                          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                      )}
                    >
                      <Sprout className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "ស្រូវ" : "Rice"}</span>
                    </button>
                    <button
                      type="button"
                      data-crop="cassava"
                      onClick={() => setSampleCrop("cassava")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                        sampleCrop === "cassava"
                          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>{isKhmer ? "ដំឡូងមី" : "Cassava"}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-950/60">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {isKhmer ? report.cropKm : report.crop}
                      </p>
                      <h4 className="mt-0.5 text-base font-bold text-neutral-900 dark:text-white">
                        {isKhmer ? report.diseaseKm : report.disease}
                      </h4>
                    </div>
                    <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-neutral-950">
                      {report.confidence} {isKhmer ? "ត្រូវគ្នា" : "Match"}
                    </span>
                  </div>

                  <div className="grid gap-4 text-xs sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {isKhmer ? "រោគសញ្ញាសង្កេតឃើញ" : "Observed Signals"}
                      </p>
                      <ul className="space-y-2 text-neutral-700 dark:text-neutral-300">
                        {(isKhmer ? report.symptomsKm : report.symptoms).map((s) => (
                          <li key={s} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-900 dark:text-white" />
                            <span className="leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {isKhmer ? "ជំហានព្យាបាល" : "Recommended Steps"}
                      </p>
                      <ol className="space-y-2 text-neutral-600 dark:text-neutral-400">
                        {(isKhmer ? report.treatmentKm : report.treatment).map((item, idx) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Research & Engineering Team Section (ChatDeck centered portrait card style with full info) */}
        <section id="nxProjectDetail" className="py-16 sm:py-24">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl lg:text-5xl">
              {isKhmer ? "ក្រុមស្រាវជ្រាវ និងអភិវឌ្ឍន៍" : "Research & Engineering Team"}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-600 dark:text-neutral-400 sm:text-lg">
              {isKhmer
                ? "ស្គាល់ពីទីប្រឹក្សាសិក្សា និងក្រុមវិស្វករដែលបង្កើតប្រព័ន្ធ AGRI SYSTEM។"
                : "Meet the academic advisor and multidisciplinary engineers behind AGRI SYSTEM."}
            </p>
          </div>

          {/* Academic Supervisor Spotlight Card */}
          <div className="mx-auto mb-6 max-w-md">
            <article className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 text-center transition-all duration-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/50">
              <div>
                <div className="mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
                  <TeamPortrait
                    name={supervisorName}
                    photoUrl={supervisorPhoto}
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  <ShieldCheck className="h-3 w-3" />
                  {isKhmer ? "ទីប្រឹក្សាសិក្សា" : "Academic Supervisor"}
                </span>
                <h3 className="mb-0.5 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {supervisorName}
                </h3>
                {supervisor.name_kh && supervisor.name && supervisor.name_kh !== supervisorName && (
                  <p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {supervisor.name_kh}
                  </p>
                )}
                <p className="mb-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {supervisorRole}
                </p>
                <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {supervisorTask}
                </p>
                {supervisorDepartment && (
                  <p className="mt-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {supervisorDepartment}
                  </p>
                )}
              </div>

              {(supervisor.email || supervisor.phone) && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                  {supervisor.email && (
                    <a
                      href={`mailto:${supervisor.email}`}
                      title={supervisor.email}
                      aria-label={`Email ${supervisorName}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                    >
                      <Mail className="h-4 w-4" />
                      <span>{supervisor.email}</span>
                    </a>
                  )}
                  {supervisor.phone && (
                    <a
                      href={supervisor.phoneHref || `tel:${supervisor.phone.replace(/\s+/g, "")}`}
                      title={supervisor.phone}
                      aria-label={`Call ${supervisorName}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                    >
                      <Phone className="h-4 w-4" />
                      <span>{supervisor.phone}</span>
                    </a>
                  )}
                </div>
              )}
            </article>
          </div>

          {/* Core Engineering Team 4-Column ChatDeck Grid with Full Details */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member, idx) => {
              const memberName =
                (isKhmer ? member.name_kh : member.name) || member.name || "Team Member";
              const secondaryName = isKhmer ? member.name : member.name_kh;
              const memberRole =
                (isKhmer ? member.rank_kh : member.rank) ||
                member.role ||
                (isKhmer ? "អ្នកអភិវឌ្ឍន៍ប្រព័ន្ធ" : "Platform Engineering");
              const memberTask = (isKhmer ? member.task_kh : member.task) || member.task || "";
              const memberDepartment =
                (isKhmer ? member.department_kh : member.department) || member.department || "";
              const memberPhoto =
                member.photoUrl ||
                (member.photo
                  ? `/static/img/image_detail/${encodeURIComponent(member.photo)}`
                  : undefined);
              const telegramHref =
                member.telegramUrl ||
                (member.telegram
                  ? `https://t.me/${encodeURIComponent(member.telegram.replace(/^@+/, ""))}`
                  : "");
              return (
                <article
                  key={`${member.name || "member"}-${idx}`}
                  className="group flex h-full flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 text-center transition-all duration-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/50"
                >
                  <div>
                    <div className="mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
                      <TeamPortrait
                        name={memberName}
                        photoUrl={memberPhoto}
                        className="transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <h3 className="mb-0.5 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      {memberName}
                    </h3>
                    {secondaryName && secondaryName !== memberName && (
                      <p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {secondaryName}
                      </p>
                    )}
                    <p className="mb-3 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      {memberRole}
                    </p>
                    {memberTask && (
                      <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                        {memberTask}
                      </p>
                    )}
                    {(member.student_id || memberDepartment) && (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {member.student_id && (
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono font-medium dark:border-neutral-800 dark:bg-neutral-950">
                            ID {member.student_id}
                          </span>
                        )}
                        {memberDepartment && (
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 dark:border-neutral-800 dark:bg-neutral-950">
                            {memberDepartment}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                    {member.email && (
                      <a
                        href={`mailto:${member.email}`}
                        title={member.email}
                        aria-label={`Email ${memberName}`}
                        className="text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                    {member.phone && (
                      <a
                        href={member.phoneHref || `tel:${member.phone.replace(/\s+/g, "")}`}
                        title={member.phone}
                        aria-label={`Call ${memberName}`}
                        className="text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {telegramHref && (
                      <a
                        href={telegramHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={member.telegram || "Telegram"}
                        aria-label={`Telegram ${memberName}`}
                        className="text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      >
                        <Send className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Pricing Section (ChatDeck bg-muted/40 rounded-xl aesthetic) */}
        <section
          id="nxPricing"
          className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-10 dark:border-neutral-800 dark:bg-neutral-900/40 sm:px-10 sm:py-20"
        >
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3.5 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {isKhmer ? "គម្រោងសមាជិកភាព" : "Pricing Plans"}
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              {isKhmer ? "ជ្រើសរើសគម្រោងរបស់អ្នក" : "Choose your plan"}
            </h2>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 sm:text-base">
              {isKhmer
                ? "ចាប់ផ្តើមដោយឥតគិតថ្លៃ ឬដំឡើងទៅ Pro តាមរយៈ Bakong KHQR ភ្លាមៗ"
                : "Start free to diagnose crops, or upgrade to Pro for unlimited AI guidance and priority expert review."}
            </p>

            <div className="mt-7 flex justify-center">
              <button
                id="nxPriceToggle"
                type="button"
                aria-pressed={yearlyBilling}
                onClick={() => setYearlyBilling((v) => !v)}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-200/80 p-1 text-xs font-medium dark:bg-neutral-800"
              >
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5 transition sm:px-4",
                    !yearlyBilling
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white"
                      : "text-neutral-600 dark:text-neutral-400",
                  )}
                >
                  {isKhmer ? "ប្រចាំខែ" : "Monthly"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition sm:px-4",
                    yearlyBilling
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white"
                      : "text-neutral-600 dark:text-neutral-400",
                  )}
                >
                  <span>{isKhmer ? "ប្រចាំឆ្នាំ" : "Annually"}</span>
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">
                    -{d.yearlyDiscountPercent}%
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:mt-10 sm:gap-6 md:grid-cols-2">
            {/* Free Tier */}
            <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-7">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  {isKhmer ? "គណនីឥតគិតថ្លៃ" : "Free"}
                </h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {isKhmer
                    ? "សមស្របសម្រាប់ការវិនិច្ឆ័យដំណាំប្រចាំថ្ងៃ"
                    : "Perfect for getting started on your plot"}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tabular-nums text-neutral-900 dark:text-white">
                    $0
                  </span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    / {isKhmer ? "ខែ" : "month"}
                  </span>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-neutral-900 dark:text-white" />
                    <span>{isKhmer ? "ឧបករណ៍វិនិច្ឆ័យដំណាំតាមច្បាប់" : "Rule-based crop diagnosis wizard"}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-neutral-900 dark:text-white" />
                    <span>{isKhmer ? "ក្រេឌីតសាកល្បង AI Copilot" : "Starter AI Copilot consultations"}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-neutral-900 dark:text-white" />
                    <span>{isKhmer ? "អាកាសធាតុ និងព័ត៌មានកសិកម្ម" : "Weather overview & field alerts"}</span>
                  </li>
                </ul>
              </div>

              <a
                href={d.registerUrl}
                className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
              >
                {isKhmer ? "ចាប់ផ្តើមប្រើ" : "Get Started"}
              </a>
            </div>

            {/* Pro Tier */}
            <div className="flex min-w-0 flex-col justify-between rounded-2xl border-2 border-neutral-900 bg-white p-5 shadow-lg dark:border-white dark:bg-neutral-950 sm:p-7">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Pro</h3>
                  <span className="rounded-full bg-neutral-900 px-3 py-0.5 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-950">
                    {isKhmer ? "ពេញនិយម" : "Popular"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {isKhmer
                    ? "សម្រាប់ការប្រឹក្សា AI គ្មានដែនកំណត់ និងអាទិភាពអ្នកជំនាញ"
                    : "Unlimited AI consultations & priority expert review"}
                </p>

                <div className="mt-6 flex flex-wrap items-baseline gap-2">
                  <span
                    id="nxProPlanPrice"
                    className="text-4xl font-bold tabular-nums text-neutral-900 dark:text-white"
                  >
                    ${yearlyBilling ? d.yearlyMonthly : d.premiumPrice}
                    <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                      /{isKhmer ? "ខែ" : "mo"}
                    </span>
                  </span>
                  {yearlyBilling && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      ({isKhmer ? `$${d.yearlyTotal}/ឆ្នាំ` : `$${d.yearlyTotal}/yr billed annually`})
                    </span>
                  )}
                </div>

                <ul className="mt-6 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-neutral-900 dark:text-white" />
                    <span>{isKhmer ? "ប្រឹក្សា AI Copilot & ស្កេនរូបភាពគ្មានដែនកំណត់" : "Unlimited AI Agronomy Chat & crop leaf scans"}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-neutral-900 dark:text-white" />
                    <span>{isKhmer ? "អាទិភាពពិនិត្យដោយអ្នកជំនាញ" : "Priority human agronomist verification"}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-neutral-900 dark:text-white" />
                    <span>{isKhmer ? "ទូទាត់ភ្លាមតាម Bakong KHQR" : "Instant Bakong KHQR & PayPal activation"}</span>
                  </li>
                </ul>
              </div>

              <a
                href={d.registerUrl}
                className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-full bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                {isKhmer ? "បង្កើតគណនីដើម្បីដំឡើង Pro" : "Upgrade After Sign Up"}
              </a>
            </div>
          </div>
        </section>

        {/* Centered Hairline FAQ Accordion (ChatDeck FAQ style) */}
        <section id="nxFaqAccordion" className="py-20 sm:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              {isKhmer ? "សំណួរញឹកញាប់" : "Frequently Asked Questions"}
            </h2>
            <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
              {isKhmer
                ? "ព័ត៌មានសំខាន់ៗអំពីការប្រើប្រាស់ប្រព័ន្ធ AGRI SYSTEM"
                : "Everything you need to know about AGRI SYSTEM and how it supports your farm."}
            </p>
          </div>

          <div className="mx-auto max-w-3xl divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-1">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq((cur) => (cur === idx ? null : idx))}
                    className="group flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-neutral-900 transition hover:underline dark:text-neutral-100 sm:text-base"
                  >
                    <span>{item.q}</span>
                    <Plus
                      className={cn(
                        "h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 dark:text-neutral-400",
                        isOpen && "rotate-45 text-neutral-900 dark:text-white",
                      )}
                    />
                  </button>
                  {isOpen && (
                    <p className="pb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Clean Structured Footer matching ChatDeck */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="space-y-3 md:col-span-5">
              <div className="flex items-center gap-2.5">
                <img
                  src={bootstrap.urls.logoLight || "/static/img/newlogo.svg"}
                  alt="AGRI SYSTEM"
                  className="h-6 w-6 dark:hidden"
                />
                <img
                  src={bootstrap.urls.logoDark || "/static/img/newlogo-dark.svg"}
                  alt="AGRI SYSTEM"
                  className="hidden h-6 w-6 dark:block"
                />
                <span className="text-base font-semibold text-neutral-900 dark:text-white">
                  AGRI SYSTEM
                </span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                {isKhmer
                  ? "ប្រព័ន្ធវិនិច្ឆ័យជំងឺដំណាំ និងជំនួយការ AI កសិកម្មសម្រាប់កសិករ។"
                  : "AI-powered agronomy diagnostics and expert field guidance for modern growers."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm md:col-span-7 sm:grid-cols-3">
              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {isKhmer ? "ផលិតផល" : "Product"}
                </p>
                <ul className="mt-3 space-y-2.5 text-neutral-600 dark:text-neutral-400">
                  <li>
                    <a href="#features" className="hover:text-neutral-900 dark:hover:text-white">
                      {isKhmer ? "លក្ខណៈពិសេស" : "Features"}
                    </a>
                  </li>
                  <li>
                    <a href={d.diagnoseUrl} className="hover:text-neutral-900 dark:hover:text-white">
                      {isKhmer ? "វិនិច្ឆ័យ" : "Guided Diagnosis"}
                    </a>
                  </li>
                  <li>
                    <a href="#nxPricing" className="hover:text-neutral-900 dark:hover:text-white">
                      {isKhmer ? "គម្រោងតម្លៃ" : "Pricing"}
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {isKhmer ? "ប្រព័ន្ធ" : "Platform"}
                </p>
                <ul className="mt-3 space-y-2.5 text-neutral-600 dark:text-neutral-400">
                  <li>
                    <a href="#nxProjectDetail" className="hover:text-neutral-900 dark:hover:text-white">
                      {isKhmer ? "ក្រុមការងារ" : "Team"}
                    </a>
                  </li>
                  <li>
                    <a href="#nxFaqAccordion" className="hover:text-neutral-900 dark:hover:text-white">
                      {isKhmer ? "សំណួរញឹកញាប់" : "FAQ"}
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {isKhmer ? "គណនី" : "Access"}
                </p>
                <ul className="mt-3 space-y-2.5 text-neutral-600 dark:text-neutral-400">
                  <li>
                    <a href={d.loginUrl} className="hover:text-neutral-900 dark:hover:text-white">
                      {isKhmer ? "ចូលគណនី" : "Sign In"}
                    </a>
                  </li>
                  <li>
                    <a href={d.registerUrl} className="hover:text-neutral-900 dark:hover:text-white">
                      {isKhmer ? "ចុះឈ្មោះ" : "Create Account"}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            © 2026 AGRI SYSTEM ·{" "}
            {isKhmer ? "ប្រព័ន្ធកសិកម្មឆ្លាតវៃ" : "All rights reserved"}
          </div>
        </div>
      </footer>
    </div>
  );
}
