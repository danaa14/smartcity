"use client";

import type { Worker } from "tesseract.js";

export interface OcrWord {
  text: string;
  conf: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrPage {
  /** Canvas-sized image actually recognised (after preprocessing), as a data URL for preview. */
  image: string;
  width: number;
  height: number;
  text: string;
  words: OcrWord[];
  confidence: number;
}

export type Progress = (stage: "load" | "render" | "recognize", pct: number, page?: number, pages?: number, error?: string) => void;

function simdSupported(): boolean {
  try {
    // Minimal module using a v128 instruction; validates only if WebAssembly SIMD is available.
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch {
    return false;
  }
}

let workerPromise: Promise<Worker> | null = null;

/** One Tesseract worker per tab, loaded from this site only (no CDN), with Romanian + Russian best models. */
async function getWorker(onProgress?: Progress): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import("tesseract.js");
      const w = await createWorker(["ron", "rus"], OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        // Plain SIMD build: the relaxed-SIMD build aborts on some engines; fall back to non-SIMD where SIMD is missing.
        corePath: simdSupported() ? "/ocr/core/tesseract-core-simd-lstm.wasm.js" : "/ocr/core/tesseract-core-lstm.wasm.js",
        errorHandler: (e: unknown) => onProgress?.("load", 0, undefined, undefined, String(e)),
        langPath: "/ocr/lang",
        gzip: true,
        logger: (m) => {
          if (m.status === "recognizing text") onProgress?.("recognize", m.progress);
          else onProgress?.("load", m.progress);
        },
      });
      await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1", user_defined_dpi: "300" });
      return w;
    })();
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

/** Upscales small images, converts to grayscale and stretches contrast — the steps that most improve Tesseract accuracy on phone photos. */
function preprocess(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const targetLong = 2400;
  const scale = Math.min(3, Math.max(1, targetLong / Math.max(w, h)));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  // Contrast stretch between the 1st and 99th percentile.
  const total = c.width * c.height;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.01) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.01) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

async function fileToCanvases(file: File, onProgress?: Progress): Promise<HTMLCanvasElement[]> {
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdf/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = Math.min(pdf.numPages, 5);
    const out: HTMLCanvasElement[] = [];
    for (let n = 1; n <= pages; n++) {
      onProgress?.("render", n / pages, n, pages);
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 300 / 72 });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      out.push(preprocess(c, c.width, c.height));
    }
    return out;
  }
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  onProgress?.("render", 1, 1, 1);
  return [preprocess(bmp, bmp.width, bmp.height)];
}

/** Token-local fixes for systematic OCR errors on Romanian/Russian print; safe to apply to both page text and single words. */
export function cleanOcr(s: string): string {
  return s
    .replace(/(^|[\s(])[$§][1il](?=[\s,.;:)]|$)/g, "$1și")
    .replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț")
    .replace(/([\p{L}\p{N}._%+-]{2,})(?:\(Q|\(a\)|\(@|©|®)([\p{L}\p{N}-]+\.(?:md|com|ru|ro|net|org|eu|ua)\b)/giu, "$1@$2");
}

export async function recognize(file: File, onProgress?: Progress): Promise<OcrPage[]> {
  const worker = await getWorker(onProgress);
  const canvases = await fileToCanvases(file, onProgress);
  const pages: OcrPage[] = [];
  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i];
    const { data } = await worker.recognize(c, {}, { text: true, blocks: true });
    const words: OcrWord[] = [];
    for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) if (w.text.trim()) words.push({ text: cleanOcr(w.text), conf: w.confidence, bbox: w.bbox });
    pages.push({ image: c.toDataURL("image/jpeg", 0.85), width: c.width, height: c.height, text: cleanOcr(data.text), words, confidence: Math.round(data.confidence) });
    onProgress?.("recognize", 1, i + 1, canvases.length);
  }
  return pages;
}
