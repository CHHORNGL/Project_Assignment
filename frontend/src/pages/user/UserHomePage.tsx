import React from "react";
import { ArrowRight, Bell, KeyRound, ShieldCheck, Sliders, UserCircle } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";

interface UserHomeData {
  dashboardUrl: string;
  profileUrl: string;
  settingsUrl: string;
  loginActivityUrl: string;
  notificationsUrl: string;
}

export default function UserHomePage({ bootstrap }: { bootstrap: AppBootstrap<UserHomeData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const roles = bootstrap.user.roles?.length ? bootstrap.user.roles : ["Member"];

  const cards = [
    {
      title: isKhmer ? "ផ្ទាំងគ្រប់គ្រងការងារ" : "Main Workspace",
      desc: isKhmer ? "ត្រឡប់ទៅកាន់ផ្ទាំងគ្រប់គ្រងតាមតួនាទីរបស់អ្នក" : "Open your primary role dashboard and AI tools",
      href: d.dashboardUrl,
      icon: ArrowRight,
      accent: "from-indigo-500 to-blue-600",
    },
    {
      title: isKhmer ? "ប្រវត្តិរូប និង Passkeys" : "Profile & Passkeys",
      desc: isKhmer ? "កែសម្រួលព័ត៌មានផ្ទាល់ខ្លួន និង Passkeys" : "Manage your avatar, password, and biometric passkeys",
      href: d.profileUrl,
      icon: UserCircle,
      accent: "from-emerald-500 to-teal-600",
    },
    {
      title: isKhmer ? "ការកំណត់គណនី" : "Preferences & 2FA",
      desc: isKhmer ? "ប្តូរពន្លឺ/ងងឹត ភាសា និង 2FA" : "Customize theme appearance, language, and two-factor verification",
      href: d.settingsUrl,
      icon: Sliders,
      accent: "from-violet-500 to-purple-600",
    },
    {
      title: isKhmer ? "សកម្មភាពឧបករណ៍" : "Device Login Activity",
      desc: isKhmer ? "ពិនិត្យ និងបញ្ឈប់សម័យលើឧបករណ៍ផ្សេង" : "Audit active device sessions and revoke remote logins",
      href: d.loginActivityUrl,
      icon: ShieldCheck,
      accent: "from-amber-500 to-orange-600",
    },
    {
      title: isKhmer ? "ការជូនដំណឹង" : "Notifications",
      desc: isKhmer ? "អានការជូនដំណឹង និងការឆ្លើយតបថ្មីៗ" : "Review system alerts and unread updates",
      href: d.notificationsUrl,
      icon: Bell,
      accent: "from-sky-500 to-cyan-600",
    },
  ];

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
    >
      <div className="space-y-6">
        <div className="ai-surface flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <img
              src={bootstrap.user.avatar_url || "/static/img/avatar.png"}
              alt={bootstrap.user.full_name}
              className="h-14 w-14 rounded-2xl object-cover ring-2 ring-indigo-500/25"
            />
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300"
                  >
                    <KeyRound className="h-3 w-3" />
                    {role}
                  </span>
                ))}
              </div>
              <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                {bootstrap.user.full_name || bootstrap.user.username}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {bootstrap.user.email || bootstrap.user.username}
              </p>
            </div>
          </div>
          <a href={d.dashboardUrl} className="ai-btn-primary h-10 shrink-0 gap-1.5 px-5 text-xs">
            <span>{isKhmer ? "ទៅកាន់ផ្ទាំងគ្រប់គ្រង" : "Go to Dashboard"}</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <a
                key={card.href}
                href={card.href}
                className="ai-surface ai-card-hover group flex flex-col justify-between p-5"
              >
                <div>
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-sm`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {card.desc}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>{isKhmer ? "បើក" : "Open"}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </WorkspaceShell>
  );
}
