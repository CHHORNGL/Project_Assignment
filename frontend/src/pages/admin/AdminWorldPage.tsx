import React, { useState } from "react";
import { Compass, ExternalLink, Globe, MapPin, Navigation } from "lucide-react";
import type { AppBootstrap } from "@/types/app";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";
import { ExpertHeaderActions } from "@/components/expert/ExpertShared";
import {
  AdminEmptyState,
  AdminSectionCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";

interface AdminWorldData {
  scanPoints: Array<{
    id: string | number;
    label: string;
    region: string;
    lat?: number;
    lng?: number;
    status: string;
  }>;
  cesiumToken?: string;
  defaultCenter: { lat: number; lng: number; label: string };
}

export default function AdminWorldPage({ bootstrap }: { bootstrap: AppBootstrap<AdminWorldData> }) {
  const isKhmer = bootstrap.lang === "km";
  const d = bootstrap.data;
  const [lat, setLat] = useState(String(d.defaultCenter.lat));
  const [lng, setLng] = useState(String(d.defaultCenter.lng));

  const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=7&output=embed`;

  return (
    <WorkspaceShell
      bootstrap={bootstrap}
      navSections={buildNavSections(bootstrap)}
      pageTitle={bootstrap.ui.pageTitle}
      pageSubtitle={bootstrap.ui.pageSubtitle}
      headerActions={<ExpertHeaderActions bootstrap={bootstrap} />}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <AdminSectionCard
          className="lg:col-span-2"
          delayIndex={0}
          noPadding
          title={d.defaultCenter.label}
          subtitle={isKhmer ? "ផែនទីត្រួតពិនិត្យតំបន់កសិកម្ម" : "Live regional telemetry viewport"}
          icon={<Globe className="h-4 w-4" />}
          action={
            <div className="flex items-center gap-2">
              <AdminStatusBadge tone="emerald" pulse>
                Live
              </AdminStatusBadge>
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ai-btn-secondary h-8 gap-1.5 px-3 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Google Maps
              </a>
            </div>
          }
        >
          <iframe
            title="Cambodia Agriculture Monitoring Map"
            src={mapsEmbedUrl}
            className="h-[460px] w-full border-0 bg-slate-100 dark:bg-obsidian-950"
            loading="lazy"
          />
        </AdminSectionCard>

        <div className="space-y-5">
          <AdminSectionCard
            delayIndex={1}
            title={isKhmer ? "កូអរដោនេ" : "Coordinates"}
            subtitle={isKhmer ? "កំណត់ទីតាំងកណ្តាល" : "Viewport center latitude & longitude"}
            icon={<Compass className="h-4 w-4" />}
            action={
              <button
                type="button"
                onClick={() => {
                  setLat(String(d.defaultCenter.lat));
                  setLng(String(d.defaultCenter.lng));
                }}
                className="ai-btn-secondary h-8 gap-1 px-2.5 text-[11px]"
              >
                <Navigation className="h-3 w-3" />
                Reset
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Latitude
                </label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="ai-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Longitude
                </label>
                <input
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="ai-input font-mono text-xs"
                />
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            delayIndex={2}
            title={
              isKhmer
                ? `ចំណុចស្កេនតំបន់ (${d.scanPoints.length})`
                : `Active Telemetry Points (${d.scanPoints.length})`
            }
            icon={<MapPin className="h-4 w-4" />}
          >
            {d.scanPoints.length === 0 ? (
              <AdminEmptyState
                icon={<MapPin className="h-5 w-5" />}
                title={isKhmer ? "មិនទាន់មានចំណុចស្កេនសកម្មទេ។" : "No regional scan points registered yet."}
              />
            ) : (
              <div className="space-y-2.5">
                {d.scanPoints.map((pt) => {
                  const hasCoords = pt.lat !== undefined && pt.lng !== undefined;
                  return (
                    <button
                      key={String(pt.id)}
                      type="button"
                      onClick={() => {
                        if (hasCoords) {
                          setLat(String(pt.lat));
                          setLng(String(pt.lng));
                        }
                      }}
                      className="ai-card-hover flex w-full items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/75 p-3.5 text-left text-xs dark:border-slate-800/80 dark:bg-obsidian-950/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{pt.label}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {pt.region}
                        </p>
                      </div>
                      <AdminStatusBadge tone="emerald" pulse>
                        {pt.status}
                      </AdminStatusBadge>
                    </button>
                  );
                })}
              </div>
            )}
          </AdminSectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
