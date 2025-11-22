"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeFrameDiff } from "../lib/diff";
import { extractZones } from "../lib/crop";
import { ZONE_ORDER, ZONES } from "../lib/zones";

const CONFIG = {
  frameInterval: 200,
  diffThreshold: 1_200_000,
  stableMs: 700,
  captureDelay: 300,
  cooldownMs: 1500,
  historyPollMs: 7000,
  preprocess: {
    targetWidth: 1200,
    jpegQuality: 0.85,
    brightnessBoost: 0.12,
    blockSize: 16
  }
};

type HistoryItem = { id: string; text: string; timestamp: string | null };

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const cooldownRef = useRef(0);
  const [status, setStatus] = useState("Initializing camera…");
  const [streaming, setStreaming] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [confidence, setConfidence] = useState<string>("—");
  const [lastSaved, setLastSaved] = useState<string>("—");
  const [lastText, setLastText] = useState<string>("—");
  const [flash, setFlash] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [latestScan, setLatestScan] = useState("");
  const [latestTimestamp, setLatestTimestamp] = useState("");
  const [showResultPanel, setShowResultPanel] = useState(false);

  const hasCamera = useMemo(() => typeof window !== "undefined" && !!navigator.mediaDevices, []);

  const resizeOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;
    const rect = video.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/history");
      const json = await response.json();
      if (Array.isArray(json.items)) {
        setHistory(json.items.slice(0, 10));
      }
    } catch (error) {
      console.warn("History fetch failed", error);
    }
  }, []);

  const captureAndSend = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setStatus("Processing capture…");

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        throw new Error("Camera not ready");
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas unavailable");

      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      await new Promise((resolve) => setTimeout(resolve, CONFIG.captureDelay));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const zonesPayload = extractZones(canvas, CONFIG.preprocess);

      setStatus("Uploading to OCR…");
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zones: zonesPayload,
          meta: {
            capturedAt: new Date().toISOString(),
            devicePixelRatio: window.devicePixelRatio
          }
        })
      });

      const json = await response.json();

      if (!response.ok || !json.saved) {
        throw new Error(json.error || "OCR failed");
      }

      setSentCount((cnt) => cnt + 1);
      setLastText(json.text || "—");
      setLastSaved(json.timestamp || new Date().toISOString());
      setConfidence(
        typeof json.confidence === "number" ? `${json.confidence}%` : "—"
      );
      setStatus("Saved ✓ — waiting for next sheet");
      setShowResult(true);
      window.setTimeout(() => setShowResult(false), 5000);
      
      // Immediately show OCR result in UI
      setLatestScan(json.text || "");
      setLatestTimestamp(json.timestamp || new Date().toISOString());
      // Use requestAnimationFrame to ensure smooth fade-in animation
      requestAnimationFrame(() => {
        setShowResultPanel(true);
        window.setTimeout(() => setShowResultPanel(false), 5000);
      });
      
      fetchHistory();
    } catch (error) {
      console.error("Capture pipeline error", error);
      setStatus("Capture failed — retrying");
    } finally {
      capturingRef.current = false;
      cooldownRef.current = Date.now() + CONFIG.cooldownMs;
    }
  }, [fetchHistory]);

  useEffect(() => {
    if (!hasCamera) {
      setStatus("Camera API not supported");
      return;
    }

    const videoElement = videoRef.current;
    let active = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        if (!active) return;
        const targetVideo = videoRef.current ?? videoElement;
        if (!targetVideo) return;
        targetVideo.srcObject = stream;
        await targetVideo.play();
        setStreaming(true);
        setStatus("Camera running — waiting for paper…");
        resizeOverlay();
      } catch (error) {
        console.error("Camera error", error);
        setStatus("Camera error — allow permission");
      }
    };

    startCamera();

    return () => {
      active = false;
      const stream = (videoElement?.srcObject as MediaStream | null) ?? null;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [hasCamera, resizeOverlay]);

  useEffect(() => {
    const handler = () => resizeOverlay();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [resizeOverlay]);

  useEffect(() => {
    if (!streaming) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const interval = window.setInterval(() => {
      if (!video.videoWidth || capturingRef.current) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { diff, snapshot } = computeFrameDiff(imgData, prevFrameRef.current, {
        threshold: CONFIG.diffThreshold
      });
      prevFrameRef.current = snapshot;

      if (diff > CONFIG.diffThreshold) {
        if (stableSinceRef.current === null) stableSinceRef.current = Date.now();
        if (
          Date.now() - (stableSinceRef.current ?? 0) > CONFIG.stableMs &&
          Date.now() > cooldownRef.current
        ) {
          stableSinceRef.current = null;
          captureAndSend();
        }
      } else {
        stableSinceRef.current = null;
      }
    }, CONFIG.frameInterval);

    return () => window.clearInterval(interval);
  }, [streaming, captureAndSend]);

  useEffect(() => {
    fetchHistory();
    const timer = window.setInterval(fetchHistory, CONFIG.historyPollMs);
    return () => window.clearInterval(timer);
  }, [fetchHistory]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-4 py-6">
      <div className="w-full max-w-5xl space-y-4">
        {/* Camera Preview - Full Width, Rounded, Centered */}
        <section className="relative w-full overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-0"
          >
            {ZONE_ORDER.map((zone) => {
              const cfg = ZONES[zone];
              return (
                <div
                  key={zone}
                  className="absolute opacity-0 pointer-events-none"
                  style={{
                    left: `${cfg.x * 100}%`,
                    top: `${cfg.y * 100}%`,
                    width: `${cfg.w * 100}%`,
                    height: `${cfg.h * 100}%`
                  }}
                />
              );
            })}
          </div>
          <div
            className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-200 ${
              flash ? "opacity-30" : "opacity-0"
            }`}
          />
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-xs font-medium text-white shadow-lg">
            {status}
          </div>
        </section>

        {/* Animated Result Panel - Shows immediately on OCR success */}
        {latestScan && (
          <section
            className={`rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-lg transition-all duration-300 ease-in-out ${
              showResultPanel ? "opacity-100 translate-y-0 max-h-[500px]" : "opacity-0 -translate-y-2 max-h-0 overflow-hidden"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-[#111827] font-semibold mb-2">
              Scanned Text
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-base text-[#111827] break-words">
              {latestScan}
            </pre>
            {latestTimestamp && (
              <p className="mt-3 text-xs text-gray-500">
                {new Date(latestTimestamp).toLocaleString()}
              </p>
            )}
          </section>
        )}

        {/* History List - Last 10 entries */}
        <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
          <header className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#111827]">
              History
            </p>
          </header>
          <div className="space-y-3 text-sm max-h-[400px] overflow-y-auto">
            {history.length === 0 && <p className="text-gray-500">No scans yet.</p>}
            {history.map((item) => (
              <div key={item.id} className="rounded-md border border-[#e5e7eb] bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1">
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[#111827] text-sm line-clamp-3">
                  {item.text ? item.text.trim().substring(0, 150) + (item.text.length > 150 ? "..." : "") : "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

