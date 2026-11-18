"use client";

import { Camera, Clipboard, ImageUp, ScanSearch, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { btn } from "@/components/ui";
import { classifyQr } from "@/lib/analysis/qr";
import { ErrorBox, ProviderConsent, ScanResult, useConsent, useScan } from "./kit";

const STEPS = ["Classifying decoded content", "Checking the destination URL structure", "Querying configured reputation sources", "Building explainable report"];
const MAX_BYTES = 5 * 1024 * 1024;

/** Verify real file type by magic bytes, not just the extension / MIME. */
async function sniffImage(file: File): Promise<"png" | "jpeg" | "webp" | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

async function decodeCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const { QRCodeReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource, InvertedLuminanceSource, DecodeHintType } = await import("@zxing/library");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) lum[j] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new QRCodeReader();
  const source = new RGBLuminanceSource(lum, width, height);
  try {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(source)), hints).getText();
  } catch {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(new InvertedLuminanceSource(source))), hints).getText();
  }
}

async function decodeFile(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return decodeCanvas(canvas);
}

export function QrTool({ signedIn }: { signedIn: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [consent, setConsent] = useConsent();
  const [redirects, setRedirects] = useState(false);
  const [copied, setCopied] = useState(false);
  const scan = useScan("/api/v1/scans/qr");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);
  useEffect(() => () => { stopCamera(); }, [stopCamera]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function resetAll() {
    stopCamera();
    setPreview(null);
    setDecoded(null);
    setError(null);
    scan.reset();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    resetAll();
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Unsupported file type. Use a PNG, JPG/JPEG or WEBP image.");
    if (file.size > MAX_BYTES) return setError("The image is larger than 5 MB.");
    if (!(await sniffImage(file))) return setError("This file is not a valid PNG, JPEG or WEBP image.");
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      setDecoded(await decodeFile(file));
    } catch (e) {
      setError(e instanceof Error && /NotFound|No MultiFormat|not found/i.test(`${e.name} ${e.message}`) ? "No QR code was found in this image. Try a sharper, closer, well-lit picture." : "The image could not be decoded as a QR code.");
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    resetAll();
    if (!navigator.mediaDevices?.getUserMedia) return setError("Camera access is not supported in this browser. Upload an image instead.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        void v.play();
        const canvas = document.createElement("canvas");
        timer.current = window.setInterval(async () => {
          if (!v.videoWidth) return;
          canvas.width = Math.min(960, v.videoWidth);
          canvas.height = Math.round((canvas.width / v.videoWidth) * v.videoHeight);
          canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
          try {
            const text = await decodeCanvas(canvas);
            stopCamera();
            setDecoded(text);
          } catch {
            /* keep scanning */
          }
        }, 350);
      });
    } catch {
      setError("Camera permission was denied or no camera is available. You can upload an image instead.");
    }
  }

  const local = useMemo(() => (decoded ? classifyQr(decoded) : null), [decoded]);
  let host = "";
  let protocol = "";
  if (local?.url) {
    try {
      const u = new URL(local.url);
      host = u.hostname;
      protocol = u.protocol.replace(":", "");
    } catch { /* invalid */ }
  }

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void handleFile(e.dataTransfer.files?.[0]); }}
          className={`bracket flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition ${drag ? "border-accent bg-accent/5" : "border-line bg-panel/50"}`}
        >
          {cameraOn ? (
            <div className="w-full">
              <video ref={videoRef} muted playsInline className="mx-auto max-h-64 w-full rounded-md bg-black object-contain" aria-label="Camera preview" />
              <button type="button" className={`${btn.secondary} mt-3`} onClick={stopCamera}><X size={16} aria-hidden />Stop camera</button>
            </div>
          ) : (
            <>
              <ImageUp className="text-accent" size={30} aria-hidden />
              <p className="text-sm font-medium">Drag &amp; drop a QR image here</p>
              <p className="text-xs text-muted">PNG, JPG/JPEG or WEBP · max 5 MB · decoded <b>in your browser</b> – the image is never uploaded.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <label className={`${btn.primary} cursor-pointer`}>
                  <ImageUp size={16} aria-hidden />Choose image
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                <button type="button" className={btn.secondary} onClick={() => void startCamera()}><Camera size={16} aria-hidden />Use camera</button>
              </div>
            </>
          )}
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">QR preview workspace</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, cannot be optimized */}
          {preview ? <img src={preview} alt="Uploaded QR code preview" className="mx-auto mt-3 max-h-56 rounded-md border border-line bg-white object-contain p-2" /> : <p className="mt-3 text-sm text-muted">{busy ? "Decoding…" : "Your QR code will appear here. Only a local preview is shown."}</p>}
        </div>
      </div>

      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      {decoded !== null && local && (
        <section className="mt-6 space-y-4 rounded-lg border border-line bg-surface p-4" aria-labelledby="decoded-h">
          <h2 id="decoded-h" className="text-base font-semibold">Decoded content <span className="ml-2 rounded bg-raised px-2 py-0.5 text-xs font-medium text-muted">{local.label}</span></h2>
          <div className="bracket mono max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line bg-panel p-3 text-[13px]" data-testid="decoded">{decoded}</div>
          {host && <dl className="grid gap-1 text-sm sm:grid-cols-[130px_1fr]"><dt className="text-muted">Destination host</dt><dd className="mono break-all">{host}</dd><dt className="text-muted">Protocol</dt><dd className="mono">{protocol}</dd></dl>}
          <p className="rounded-md border border-warn/40 bg-warn/10 p-3 text-xs">ScamLens did <b>not</b> open this content, call, message or pay anything. A QR code only holds text – it cannot prove its destination is safe, and stickers can be placed over genuine codes.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.secondary} onClick={async () => { await navigator.clipboard.writeText(decoded); setCopied(true); setTimeout(() => setCopied(false), 2000); }}><Clipboard size={16} aria-hidden />{copied ? "Copied" : "Copy decoded content"}</button>
            <button type="button" className={btn.ghost} onClick={resetAll}>Scan another</button>
          </div>
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-sm font-medium">Continue to security analysis</p>
            <p className="text-xs text-muted">Sends the <b>decoded text</b> (not the image) to ScamLens for analysis{local.url ? ", including URL checks" : ""}.</p>
            {local.url && (
              <div className="grid gap-2 lg:grid-cols-2">
                <ProviderConsent checked={consent} onChange={setConsent} what="Sends the destination link to configured reputation providers." />
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-panel p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={redirects} onChange={(e) => setRedirects(e.target.checked)} /><span><b>Expand redirects</b> <span className="text-muted">with the restricted header-only fetcher.</span></span></label>
              </div>
            )}
            <button type="button" className={btn.primary} disabled={scan.loading} onClick={() => void scan.run({ content: decoded, shareWithProviders: consent, inspectRedirects: redirects })}><ScanSearch size={16} aria-hidden />{scan.loading ? "Analyzing…" : local.url ? "Analyze destination URL" : "Analyze QR content"}</button>
          </div>
        </section>
      )}
      <ScanResult s={scan} signedIn={signedIn} steps={STEPS} />
    </div>
  );
}
