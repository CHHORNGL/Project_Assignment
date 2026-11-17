import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Move, RefreshCw, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";

interface AvatarCropModalProps {
  open: boolean;
  imageUrl: string | null;
  fileName?: string;
  isKhmer: boolean;
  onCancel: () => void;
  onConfirm: (croppedFile: File, previewDataUrl: string) => void;
}

const OUTPUT_SIZE = 512;

export function AvatarCropModal({
  open,
  imageUrl,
  fileName,
  isKhmer,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [boxSize, setBoxSize] = useState(280);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ width: 0, height: 0 });
  }, [open, imageUrl]);

  useEffect(() => {
    if (!open || !stageRef.current) return;
    const el = stageRef.current;
    const syncSize = () => {
      if (el.clientWidth > 0) setBoxSize(el.clientWidth);
    };
    syncSize();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(syncSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  const geometry = useMemo(() => {
    const { width: nw, height: nh } = naturalSize;
    if (nw <= 0 || nh <= 0 || boxSize <= 0) {
      return {
        baseScale: 1,
        dispW: boxSize,
        dispH: boxSize,
        maxOx: 0,
        maxOy: 0,
      };
    }
    const odd = rotation % 180 !== 0;
    const rw = odd ? nh : nw;
    const rh = odd ? nw : nh;
    const baseScale = boxSize / Math.min(rw, rh);
    const dispW = rw * baseScale * zoom;
    const dispH = rh * baseScale * zoom;
    return {
      baseScale,
      dispW,
      dispH,
      maxOx: Math.max(0, (dispW - boxSize) / 2),
      maxOy: Math.max(0, (dispH - boxSize) / 2),
    };
  }, [boxSize, naturalSize, rotation, zoom]);

  const clampOffset = useCallback(
    (x: number, y: number) => ({
      x: Math.min(geometry.maxOx, Math.max(-geometry.maxOx, x)),
      y: Math.min(geometry.maxOy, Math.max(-geometry.maxOy, y)),
    }),
    [geometry.maxOx, geometry.maxOy],
  );

  const clamped = useMemo(() => clampOffset(offset.x, offset.y), [clampOffset, offset.x, offset.y]);

  useEffect(() => {
    setOffset((prev) => clampOffset(prev.x, prev.y));
  }, [clampOffset]);

  if (!open || !imageUrl) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: clamped.x,
      origY: clamped.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setOffset(clampOffset(drag.origX + dx, drag.origY + dy));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setZoom((prev) => Number(Math.min(3, Math.max(1, prev + delta)).toFixed(2)));
  };

  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img || naturalSize.width <= 0 || naturalSize.height <= 0 || saving) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const ratio = OUTPUT_SIZE / boxSize;
      ctx.translate(OUTPUT_SIZE / 2 + clamped.x * ratio, OUTPUT_SIZE / 2 + clamped.y * ratio);
      ctx.rotate((rotation * Math.PI) / 180);

      const scaleFactor = geometry.baseScale * zoom * ratio;
      const drawW = naturalSize.width * scaleFactor;
      const drawH = naturalSize.height * scaleFactor;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

      const cleanBase = (fileName || "avatar").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "") || "avatar";
      const outName = `${cleanBase}.jpg`;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9),
      );
      if (!blob) return;
      const croppedFile = new File([blob], outName, { type: "image/jpeg" });
      onConfirm(croppedFile, dataUrl);
    } finally {
      setSaving(false);
    }
  };

  const imgCssW = naturalSize.width > 0 ? naturalSize.width * geometry.baseScale * zoom : boxSize;
  const imgCssH = naturalSize.height > 0 ? naturalSize.height * geometry.baseScale * zoom : boxSize;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isKhmer ? "កាត់រូបភាពប្រវត្តិរូប" : "Crop Profile Image"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-obsidian-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="truncate font-display text-sm font-bold text-slate-900 dark:text-white sm:text-base">
              {isKhmer ? "កាត់រូបភាពប្រវត្តិរូប" : "Crop Profile Photo"}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Move className="h-3 w-3 shrink-0" />
              <span>
                {isKhmer
                  ? "អូសដើម្បីកំណត់ទីតាំង · ប្រើស្លាយដឺដើម្បីពង្រីក"
                  : "Drag to reposition · Use slider to zoom"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={isKhmer ? "បិទ" : "Close"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-obsidian-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Crop Viewport */}
        <div className="flex flex-col items-center bg-slate-950/95 px-4 py-5">
          <div
            ref={stageRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className="relative h-[260px] w-[260px] cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-slate-900 active:cursor-grabbing sm:h-[296px] sm:w-[296px]"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              onLoad={(e) => {
                setNaturalSize({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                });
              }}
              style={{
                width: `${imgCssW}px`,
                height: `${imgCssH}px`,
                maxWidth: "none",
                maxHeight: "none",
                transform: `translate(calc(-50% + ${clamped.x}px), calc(-50% + ${clamped.y}px)) rotate(${rotation}deg)`,
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 select-none"
            />
            {/* Circular Avatar Cutout Guide */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/85 shadow-[0_0_0_9999px_rgba(2,6,23,0.58)]"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Number(Math.max(1, z - 0.15).toFixed(2)))}
              aria-label="Zoom out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-obsidian-800"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label={isKhmer ? "កម្រិតពង្រីក" : "Zoom"}
              className="h-2 w-full cursor-pointer accent-indigo-600"
            />

            <button
              type="button"
              onClick={() => setZoom((z) => Number(Math.min(3, z + 0.15).toFixed(2)))}
              aria-label="Zoom in"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-obsidian-800"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-obsidian-850 dark:text-slate-200"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>{isKhmer ? "បង្វិល 90°" : "Rotate"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                  setOffset({ x: 0, y: 0 });
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-obsidian-850 dark:text-slate-300"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{isKhmer ? "កំណត់ឡើងវិញ" : "Reset"}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="ai-btn-secondary h-9 px-3.5 text-xs"
              >
                {isKhmer ? "បោះបង់" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={saving || naturalSize.width <= 0}
                onClick={() => void handleConfirm()}
                className="ai-btn-primary h-9 px-4 text-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isKhmer ? "ប្រើរូបភាពនេះ" : "Apply Crop"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
