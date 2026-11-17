import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Cpu,
  Globe,
  GraduationCap,
  Hash,
  Mail,
  Phone,
  Send,
  Sparkles,
  Sprout,
  Stethoscope,
  Users,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export interface DetailMember {
  name?: string;
  name_kh?: string;
  rank?: string;
  rank_kh?: string;
  role?: string;
  photo?: string;
  photoUrl?: string;
  task?: string;
  task_kh?: string;
  student_id?: string;
  department?: string;
  department_kh?: string;
  email?: string;
  phone?: string;
  phoneHref?: string;
  telegram?: string;
  telegramUrl?: string;
}

export interface DetailStats {
  cropsCount?: number | null;
  diseasesCount?: number | null;
  rulesCount?: number | null;
  symptomsCount?: number | null;
  factsCount?: number | null;
}

export interface DetailData {
  supervisor?: DetailMember;
  team?: DetailMember[];
  stats?: DetailStats;
  dashboardUrl: string;
  diagnoseUrl: string;
  chatUrl?: string;
  newsUrl?: string;
}

type RoleTone = "indigo" | "sky" | "emerald" | "amber";

const ROLE_TONES: Record<
  RoleTone,
  {
    badge: string;
    ring: string;
    iconBg: string;
    taskBorder: string;
  }
> = {
  indigo: {
    badge:
      "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300",
    ring: "ring-indigo-500/25 dark:ring-indigo-400/30",
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    taskBorder: "border-l-indigo-500/60",
  },
  sky: {
    badge:
      "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:bg-sky-500/15 dark:text-sky-300",
    ring: "ring-sky-500/25 dark:ring-sky-400/30",
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    taskBorder: "border-l-sky-500/60",
  },
  emerald: {
    badge:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300",
    ring: "ring-emerald-500/25 dark:ring-emerald-400/30",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    taskBorder: "border-l-emerald-500/60",
  },
  amber: {
    badge:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-300",
    ring: "ring-amber-500/25 dark:ring-amber-400/30",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    taskBorder: "border-l-amber-500/60",
  },
};

const TEAM_TONE_ORDER: RoleTone[] = ["indigo", "sky", "emerald", "amber"];

function cleanText(raw?: string | null): string {
  return String(raw || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localizedText(isKhmer: boolean, en?: string | null, km?: string | null): string {
  const enClean = cleanText(en);
  const kmClean = cleanText(km);
  if (isKhmer && kmClean) return kmClean;
  return enClean || kmClean;
}

function getInitials(name: string): string {
  const parts = cleanText(name).split(" ").filter(Boolean);
  if (parts.length === 0) return "AG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function resolveMemberPhotoUrl(member?: DetailMember): string {
  if (!member) return "";
  if (member.photoUrl) return member.photoUrl;
  const filename = cleanText(member.photo);
  if (!filename) return "";
  return `/static/img/image_detail/${encodeURIComponent(filename)}`;
}

function resolveTelegramUrl(handle?: string, explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  const cleaned = cleanText(handle).replace(/^@+/, "");
  return cleaned ? `https://t.me/${encodeURIComponent(cleaned)}` : "";
}

function resolvePhoneHref(phone?: string, explicitHref?: string): string {
  if (explicitHref) return explicitHref;
  const compact = cleanText(phone).replace(/\s+/g, "");
  return compact ? `tel:${compact}` : "";
}

function MemberAvatar({
  src,
  alt,
  initials,
  sizeClass,
  ringClass,
}: {
  src: string;
  alt: string;
  initials: string;
  sizeClass: string;
  ringClass: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 font-display font-extrabold text-white shadow-sm ring-2",
          sizeClass,
          ringClass,
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-2xl bg-slate-100 object-cover object-top shadow-sm ring-2 dark:bg-obsidian-800",
        sizeClass,
        ringClass,
      )}
    />
  );
}

function MemberMetadataFacts({
  member,
  isKhmer,
  compact = false,
}: {
  member: DetailMember;
  isKhmer: boolean;
  compact?: boolean;
}) {
  const studentId = cleanText(member.student_id);
  const department = localizedText(isKhmer, member.department, member.department_kh);
  const email = cleanText(member.email);
  const phone = cleanText(member.phone);
  const phoneHref = resolvePhoneHref(phone, member.phoneHref);
  const telegram = cleanText(member.telegram);
  const telegramUrl = resolveTelegramUrl(telegram, member.telegramUrl);

  const hasMetadata = Boolean(studentId || department || email || phone || telegram);
  if (!hasMetadata) return null;

  return (
    <div className="mt-4 space-y-2.5 border-t border-slate-200/80 pt-3.5 dark:border-slate-800/80">
      {(department || studentId) && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          {department && (
            <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-slate-100/90 px-2.5 py-1 font-medium dark:bg-obsidian-800/90">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0 break-words">{department}</span>
            </span>
          )}
          {studentId && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-obsidian-950 dark:text-slate-300">
              <Hash className="h-3 w-3 text-indigo-500" />
              <span>{studentId}</span>
            </span>
          )}
        </div>
      )}

      {(email || phone || telegram) && (
        <div className={cn("flex min-w-0 flex-wrap gap-2", compact ? "text-[11px]" : "text-xs")}>
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-2.5 py-1.5 font-medium text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700/80 dark:bg-obsidian-950/80 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <span className="min-w-0 break-all">{email}</span>
            </a>
          )}
          {phone && (
            <a
              href={phoneHref}
              className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-2.5 py-1.5 font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700/80 dark:bg-obsidian-950/80 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="whitespace-nowrap">{phone}</span>
            </a>
          )}
          {telegram && (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-xl border border-sky-200/90 bg-sky-50/70 px-2.5 py-1.5 font-semibold text-sky-700 transition hover:border-sky-400 hover:bg-sky-100/80 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
            >
              <Send className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{telegram}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function FarmerDetailPage({ bootstrap }: { bootstrap: AppBootstrap<DetailData> }) {
  const d = bootstrap.data;
  const isKhmer = bootstrap.lang === "km";

  const supervisor = d.supervisor || {
    name: "Sek Socheat",
    rank: "Professor",
    task: "Project Supervisor & Academic Advisor",
  };
  const team = useMemo(
    () =>
      Array.isArray(d.team) && d.team.length > 0
        ? d.team
        : [{ name: "Mao Seavik", rank: "Leader & Backend Lead" }],
    [d.team],
  );

  const supervisorName = localizedText(isKhmer, supervisor.name, supervisor.name_kh) || "Sek Socheat";
  const supervisorAltName =
    isKhmer && cleanText(supervisor.name) && supervisorName !== cleanText(supervisor.name)
      ? cleanText(supervisor.name)
      : !isKhmer && cleanText(supervisor.name_kh)
        ? cleanText(supervisor.name_kh)
        : "";
  const supervisorRank =
    localizedText(isKhmer, supervisor.rank || supervisor.role, supervisor.rank_kh) ||
    (isKhmer ? "សាស្ត្រាចារ្យ" : "Academic Advisor");
  const supervisorTask = localizedText(isKhmer, supervisor.task, supervisor.task_kh);

  const statsItems = useMemo(() => {
    const s = d.stats || {};
    const fmt = (v?: number | null) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "—");
    return [
      {
        label: isKhmer ? "ប្រភេទដំណាំ" : "Cataloged Crops",
        value: fmt(s.cropsCount),
        Icon: Sprout,
        toneClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
      {
        label: isKhmer ? "ជំងឺក្នុងប្រព័ន្ធ" : "Disease Profiles",
        value: fmt(s.diseasesCount),
        Icon: Stethoscope,
        toneClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      },
      {
        label: isKhmer ? "វិធានវិនិច្ឆ័យ" : "Inference Rules",
        value: fmt(s.rulesCount),
        Icon: Cpu,
        toneClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      },
      {
        label: isKhmer ? "រោគសញ្ញាតាមដាន" : "Tracked Symptoms",
        value: fmt(s.symptomsCount),
        Icon: CheckCircle2,
        toneClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      },
    ];
  }, [d.stats, isKhmer]);

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        {/* Hero Overview */}
        <section className="ai-surface relative overflow-hidden p-5 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-br from-indigo-500/[0.09] via-emerald-500/[0.05] to-transparent dark:from-indigo-500/15 dark:via-emerald-500/10"
          />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    {isKhmer ? "បញ្ញាសិប្បនិម្មិតកសិកម្មកូនកាត់" : "Hybrid Agronomy Intelligence"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Globe className="h-3 w-3" />
                    {isKhmer ? "ភាសាខ្មែរ · English" : "Bilingual EN / KM"}
                  </span>
                </div>

                <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {isKhmer
                    ? "អំពីប្រព័ន្ធ AGRI SYSTEM និងក្រុមវិស្វកម្ម"
                    : "About AGRI SYSTEM & Engineering Team"}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {isKhmer
                    ? "វេទិកាកសិកម្មឆ្លាតវៃដែលបញ្ចូលគ្នារវាងម៉ាស៊ីនវិភាគផ្អែកលើវិធានជំនាញ AI វិភាគរូបភាពស្លឹករុក្ខជាតិ ទិន្នន័យអាកាសធាតុជាក់ស្តែង និងការផ្ទៀងផ្ទាត់ដោយអ្នកជំនាញកសិកម្ម សម្រាប់កសិករនៅកម្ពុជា។"
                    : "An end-to-end agronomy decision platform unifying deterministic expert rules, leaf vision AI inference, real-time weather intelligence, certified human validation, and Khmer/English accessibility."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0">
                <a href={d.diagnoseUrl} className="ai-btn-primary h-10 px-4 text-xs sm:text-sm">
                  <Stethoscope className="h-4 w-4" />
                  <span>{isKhmer ? "ចាប់ផ្តើមវិភាគជំងឺ" : "Launch Diagnosis"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                {d.chatUrl && (
                  <a href={d.chatUrl} className="ai-btn-secondary h-10 px-4 text-xs sm:text-sm">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <span>{isKhmer ? "សួរអ្នកជំនាញ AI" : "AI Advisor"}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Live Knowledge Base Snapshot */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statsItems.map((stat) => {
                const StatIcon = stat.Icon;
                return (
                  <div
                    key={stat.label}
                    className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/80 p-3 backdrop-blur-sm dark:border-slate-800/80 dark:bg-obsidian-950/60 sm:gap-3 sm:p-3.5"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10",
                        stat.toneClass,
                      )}
                    >
                      <StatIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-lg font-extrabold leading-none text-slate-900 dark:text-white">
                        {stat.value}
                      </p>
                      <p className="mt-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Academic Supervision & Engineering Team */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-obsidian-900/80 dark:text-slate-300">
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              <span>
                {isKhmer
                  ? `សាស្ត្រាចារ្យ 1 · សមាជិក ${team.length} នាក់`
                  : `1 Supervisor · ${team.length} Contributors`}
              </span>
            </span>
          </div>
            {/* Academic Supervisor Spotlight */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-indigo-500" />
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                    {isKhmer ? "សាស្ត្រាចារ្យណែនាំគម្រោង" : "Project Supervisor & Advisor"}
                  </h3>
                </div>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                  {isKhmer ? "ទីប្រឹក្សាសិក្សា" : "Faculty Supervision"}
                </span>
              </div>

              <article className="ai-surface ai-card-hover relative overflow-hidden p-4 sm:p-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-indigo-500/[0.04] to-transparent"
                />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                  <MemberAvatar
                    src={resolveMemberPhotoUrl(supervisor)}
                    alt={supervisorName}
                    initials={getInitials(supervisorName)}
                    sizeClass="h-24 w-24 sm:h-28 sm:w-28 text-xl"
                    ringClass="ring-indigo-500/30 dark:ring-indigo-400/35"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        <span>{supervisorRank}</span>
                      </span>
                      {supervisorAltName && (
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {supervisorAltName}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-2 font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                      {supervisorName}
                    </h4>

                    {supervisorTask && (
                      <div className="mt-3 rounded-2xl border border-slate-200/80 border-l-4 border-l-indigo-500/70 bg-slate-50/80 px-4 py-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:border-l-indigo-400/70 dark:bg-obsidian-950/70 dark:text-slate-200 sm:text-sm">
                        {supervisorTask}
                      </div>
                    )}

                    <MemberMetadataFacts member={supervisor} isKhmer={isKhmer} />
                  </div>
                </div>
              </article>
            </div>

            {/* Engineering Contributors Grid */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-500" />
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                    {isKhmer ? "ក្រុមវិស្វករ និងអ្នកអភិវឌ្ឍន៍" : "Engineering & Research Team"}
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {team.length} {isKhmer ? "សមាជិក" : "Members"}
                </span>
              </div>

              <div className="grid min-w-0 gap-4 sm:gap-5 md:grid-cols-2">
                {team.map((member, index) => {
                  const toneKey = TEAM_TONE_ORDER[index % TEAM_TONE_ORDER.length];
                  const tone = ROLE_TONES[toneKey];
                  const displayName = localizedText(isKhmer, member.name, member.name_kh) || `Member ${index + 1}`;
                  const secondaryName =
                    isKhmer && cleanText(member.name) && displayName !== cleanText(member.name)
                      ? cleanText(member.name)
                      : !isKhmer && cleanText(member.name_kh)
                        ? cleanText(member.name_kh)
                        : "";
                  const displayRank =
                    localizedText(isKhmer, member.rank || member.role, member.rank_kh) ||
                    (isKhmer ? "អ្នកអភិវឌ្ឍន៍" : "Contributor");
                  const displayTask = localizedText(isKhmer, member.task, member.task_kh);

                  return (
                    <article
                      key={`${cleanText(member.name) || index}-${cleanText(member.student_id)}`}
                      className="ai-surface ai-card-hover flex min-w-0 flex-col justify-between p-4 sm:p-5"
                    >
                      <div>
                        <div className="flex items-start gap-4">
                          <MemberAvatar
                            src={resolveMemberPhotoUrl(member)}
                            alt={displayName}
                            initials={getInitials(displayName)}
                            sizeClass="h-16 w-16 sm:h-[72px] sm:w-[72px] text-base"
                            ringClass={tone.ring}
                          />

                          <div className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                                tone.badge,
                              )}
                            >
                              {displayRank}
                            </span>

                            <h4 className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                              {displayName}
                            </h4>

                            {secondaryName && (
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {secondaryName}
                              </p>
                            )}
                          </div>
                        </div>

                        {displayTask && (
                          <div
                            className={cn(
                              "mt-4 rounded-2xl border border-slate-200/80 border-l-4 bg-slate-50/75 px-3.5 py-3 dark:border-slate-800 dark:bg-obsidian-950/70",
                              tone.taskBorder,
                            )}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {isKhmer ? "ភារកិច្ច និងការចូលរួម" : "Role & Contributions"}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                              {displayTask}
                            </p>
                          </div>
                        )}
                      </div>

                      <MemberMetadataFacts member={member} isKhmer={isKhmer} compact />
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
      </div>
    </WorkspaceShell>
  );
}
