import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DATA_DIR } from "../store/db";

const run = promisify(execFile);

export interface OcrWord {
  text: string;
  conf: number;
  box: { x: number; y: number; w: number; h: number };
  line: string;
}

export interface OcrLine {
  key: string;
  text: string;
  conf: number;
  box: { x: number; y: number; w: number; h: number };
}

export interface OcrResult {
  engine: string;
  text: string;
  meanConfidence: number;
  lines: OcrLine[];
  pageSize: { w: number; h: number };
  previewPng: string;
  /** Text layer extracted by pdftotext when the PDF has one (not OCR). */
  pdfTextLayer?: string;
}

export interface OcrAdapter {
  id: string;
  external: boolean;
  available(): Promise<boolean>;
  recognize(file: Buffer, mime: string): Promise<OcrResult>;
}

const BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
async function which(bin: string): Promise<string | null> {
  if (process.env[`${bin.toUpperCase()}_PATH`]) return process.env[`${bin.toUpperCase()}_PATH`]!;
  for (const d of BIN_DIRS) {
    try {
      await fs.access(path.join(/*turbopackIgnore: true*/ d, bin));
      return path.join(/*turbopackIgnore: true*/ d, bin);
    } catch {}
  }
  return null;
}

const TESSDATA = path.join(process.cwd(), "ocr", "tessdata");

/** Runs the Tesseract CLI on this machine. Files never leave the computer. */
export const localTesseract: OcrAdapter = {
  id: "tesseract-local",
  external: false,
  async available() {
    return (await which("tesseract")) !== null;
  },
  async recognize(file, mime) {
    const tesseract = await which("tesseract");
    if (!tesseract) throw new Error("tesseract_missing");
    const work = path.join(DATA_DIR, "work", randomBytes(6).toString("hex"));
    await fs.mkdir(work, { recursive: true });
    try {
      let image = path.join(work, "page.png");
      let pdfTextLayer: string | undefined;
      if (mime === "application/pdf") {
        const pdftoppm = await which("pdftoppm");
        if (!pdftoppm) throw new Error("pdftoppm_missing");
        const pdf = path.join(work, "in.pdf");
        await fs.writeFile(pdf, file);
        await run(pdftoppm, ["-r", "150", "-f", "1", "-l", "1", "-png", "-singlefile", pdf, path.join(work, "page")]);
        const pdftotext = await which("pdftotext");
        if (pdftotext) {
          const { stdout } = await run(pdftotext, ["-f", "1", "-l", "1", "-layout", pdf, "-"]).catch(() => ({ stdout: "" }));
          pdfTextLayer = stdout.trim() || undefined;
        }
      } else {
        const ext = mime.split("/")[1] ?? "png";
        image = path.join(work, `in.${ext}`);
        await fs.writeFile(image, file);
      }
      const langs = (await fs.access(path.join(TESSDATA, "ron.traineddata")).then(() => true, () => false)) ? "ron+rus" : "eng";
      const args = [image, "stdout", "-l", langs, "--psm", "3"];
      if (langs !== "eng") args.push("--tessdata-dir", TESSDATA);
      const { stdout } = await run(tesseract, [...args, "-c", "tessedit_create_tsv=1"], { maxBuffer: 20 * 1024 * 1024 });
      const parsed = parseTsv(stdout);
      const png = await fs.readFile(image);
      const isPng = image.endsWith(".png");
      return {
        engine: `Tesseract (local, ${langs})`,
        ...parsed,
        previewPng: isPng ? `data:image/png;base64,${png.toString("base64")}` : `data:${mime};base64,${file.toString("base64")}`,
        pdfTextLayer,
      };
    } finally {
      await fs.rm(work, { recursive: true, force: true });
    }
  },
};

function parseTsv(tsv: string) {
  const rows = tsv.trim().split("\n").slice(1).map((r) => r.split("\t"));
  let pageSize = { w: 1, h: 1 };
  const lines = new Map<string, { words: OcrWord[] }>();
  for (const r of rows) {
    const [level, page, block, par, line, , left, top, width, height, conf, ...rest] = r;
    const text = rest.join("\t");
    if (level === "1") pageSize = { w: +width, h: +height };
    if (level !== "5" || !text.trim()) continue;
    const key = `${page}-${block}-${par}-${line}`;
    const w: OcrWord = { text, conf: +conf, box: { x: +left, y: +top, w: +width, h: +height }, line: key };
    lines.set(key, { words: [...(lines.get(key)?.words ?? []), w] });
  }
  const outLines: OcrLine[] = [...lines.entries()].map(([key, { words }]) => {
    const x = Math.min(...words.map((w) => w.box.x));
    const y = Math.min(...words.map((w) => w.box.y));
    const x2 = Math.max(...words.map((w) => w.box.x + w.box.w));
    const y2 = Math.max(...words.map((w) => w.box.y + w.box.h));
    const conf = words.reduce((s, w) => s + w.conf, 0) / words.length;
    return { key, text: words.map((w) => w.text).join(" "), conf: Math.round(conf), box: { x, y, w: x2 - x, h: y2 - y } };
  });
  const allWords = [...lines.values()].flatMap((l) => l.words);
  const meanConfidence = allWords.length ? Math.round(allWords.reduce((s, w) => s + w.conf, 0) / allWords.length) : 0;
  return { text: outLines.map((l) => l.text).join("\n"), meanConfidence, lines: outLines, pageSize };
}

export function getOcrAdapter(): OcrAdapter {
  return localTesseract;
}
