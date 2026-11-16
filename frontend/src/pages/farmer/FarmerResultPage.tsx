import React, { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ListChecks,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { useToast } from "@/context/ToastContext";

interface ResultBootstrapData {
  diagnosis: {
    id: number;
    diseaseLabel: string;
    cropLabel: string;
    createdAt?: string | null;
    status: string;
    statusLabel: string;
    confidencePercent: number | null;
    confidenceLevelLabel: string;
    categoryLabel: string;
    confirmedSymptoms: string[];
    causeText: string;
    treatmentSteps: string[];
    preventionTips: string[];
    references: string[];
    knowledgeImageUrl?: string | null;
    feedbackRating: string;
    feedbackComment: string;
    feedbackUrl: string;
  };
  symptomBreakdown: Array<{ name?: string; contribution?: number }>;
  rankedCandidates: Array<{
    diseaseName: string;
    matchedSymptoms: string[];
    matchPercent: number;
    tierLabel: string;
    treatment: string;
  }>;
  possibleDiseases: Array<{ id?: number; name: string }>;
  actions: {
    newDiagnosisUrl: string;
    chatUrl: string;
    historyUrl: string;
  };
}

export default function FarmerResultPage({ bootstrap }: { bootstrap: AppBootstrap<ResultBootstrapData> }) {
  const d = bootstrap.data;
  const diag = d.diagnosis;
  const { pushToast } = useToast();

  const [rating, setRating] = useState(diag.feedbackRating || "");
  const [comment, setComment] = useState(diag.feedbackComment || "");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setSubmittingFeedback(true);
    try {
      const formData = new FormData();
      formData.append("csrf_token", bootstrap.csrfToken);
      formData.append("rating", rating);
      formData.append("comment", comment);
      const res = await fetch(diag.feedbackUrl, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        pushToast("success", "Feedback saved. Thank you!");
      } else {
        pushToast("danger", "Could not save feedback.");
      }
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <a href={d.actions.chatUrl} className="ai-btn-secondary h-9 px-3 text-xs">
            <MessageSquare className="h-3.5 w-3.5" /> Ask Expert
          </a>
          <a href={d.actions.newDiagnosisUrl} className="ai-btn-primary h-9 px-3 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> New Diagnosis
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Result Summary Banner */}
        <div className="ai-surface grid gap-6 p-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                {diag.cropLabel}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                {diag.statusLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-obsidian-800 dark:text-slate-300">
                {diag.categoryLabel}
              </span>
            </div>
            <h2 className="font-display text-2xl font-extrabold">{diag.diseaseLabel}</h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{diag.causeText}</p>
            {diag.confirmedSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {diag.confirmedSymptoms.map((sym) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium dark:border-slate-800"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {sym}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">
              {bootstrap.ui.sections?.confidence || "Confidence"}
            </p>
            <p className="mt-1 font-display text-4xl font-extrabold">
              {diag.confidencePercent !== null ? `${diag.confidencePercent}%` : "--"}
            </p>
            <p className="mt-1 text-xs font-medium text-indigo-100">{diag.confidenceLevelLabel}</p>
            {diag.knowledgeImageUrl && (
              <img
                src={diag.knowledgeImageUrl}
                alt={diag.diseaseLabel}
                className="mt-4 h-28 w-full rounded-xl object-cover ring-2 ring-white/20"
              />
            )}
          </div>
        </div>

        {/* Treatment & Prevention */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="ai-surface p-6">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
              <ListChecks className="h-4 w-4 text-emerald-500" />
              {bootstrap.ui.sections?.treatment || "Treatment Steps"}
            </h3>
            {diag.treatmentSteps.length === 0 ? (
              <p className="text-xs text-slate-500">{bootstrap.ui.labels?.noTreatment || "Consult an expert before applying treatment."}</p>
            ) : (
              <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                {diag.treatmentSteps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="ai-surface p-6">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              {bootstrap.ui.sections?.prevention || "Prevention Tips"}
            </h3>
            {diag.preventionTips.length === 0 ? (
              <p className="text-xs text-slate-500">{bootstrap.ui.labels?.noPrevention || "Follow integrated crop management guidelines."}</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {diag.preventionTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Ranked Candidates */}
        {d.rankedCandidates.length > 0 && (
          <div className="ai-surface p-6">
            <h3 className="mb-4 font-display text-base font-bold">
              {bootstrap.ui.sections?.ranking || "Differential Match Ranking"}
            </h3>
            <div className="space-y-3">
              {d.rankedCandidates.map((cand, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200/80 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold">#{idx + 1} {cand.diseaseName}</span>
                    <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-300">
                      {cand.matchPercent}% · {cand.tierLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{cand.treatment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* References + Feedback */}
        <div className="grid gap-6 md:grid-cols-2">
          {diag.references.length > 0 && (
            <div className="ai-surface p-6">
              <h3 className="mb-3 font-display text-sm font-bold">{bootstrap.ui.sections?.references || "References"}</h3>
              <ul className="space-y-1.5 text-xs">
                {diag.references.map((ref, i) => (
                  <li key={i}>
                    <a href={ref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400">
                      {ref} <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleFeedback} className="ai-surface space-y-3 p-6">
            <h3 className="font-display text-sm font-bold">
              {bootstrap.ui.labels?.feedbackQuestion || "Was this diagnosis helpful?"}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRating("helpful")}
                className={rating === "helpful" ? "ai-btn-primary h-9 px-4 text-xs" : "ai-btn-secondary h-9 px-4 text-xs"}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Helpful
              </button>
              <button
                type="button"
                onClick={() => setRating("not_helpful")}
                className={rating === "not_helpful" ? "ai-btn-primary h-9 px-4 text-xs" : "ai-btn-secondary h-9 px-4 text-xs"}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Needs Review
              </button>
            </div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional comment..."
              className="ai-input py-2 text-xs"
            />
            <button type="submit" disabled={!rating || submittingFeedback} className="ai-btn-primary h-9 px-4 text-xs">
              Submit Feedback
            </button>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  );
}
