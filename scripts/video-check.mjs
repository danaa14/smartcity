// Checks the video-analysis route and the "description optional with video" rule.
// Needs the dev server on http://localhost:3100 and ffmpeg for the test clip.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
let fails = 0;
const ok = (name) => console.log(`${name} OK`);

const dir = mkdtempSync(path.join(tmpdir(), "pefir-video-"));
const clip = path.join(dir, "clip.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=320x240:d=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-shortest", "-c:v", "libx264", "-c:a", "aac", "-metadata", "location=+47.0131+028.8244/", clip]);
const buf = readFileSync(clip);

try {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "video/mp4" }), "clip.mp4");
  fd.append("lang", "ro");
  const r = await fetch(`${BASE}/api/report/video`, { method: "POST", body: fd });
  const j = await r.json().catch(() => null);
  if (r.ok && j && typeof j.transcript === "string" && typeof j.description === "string" && j.engine?.transcript) ok("VIDEO OK (full pipeline, ai=" + (j.ai ? "on" : "off") + ", gps=" + (j.lat != null ? `${j.lat},${j.lng}` : "none") + ")");
  else if (r.status === 503 && j?.error === "whisper_missing") ok("VIDEO OK (graceful 503, whisper missing)");
  else { fails++; console.log("VIDEO FAIL", r.status, JSON.stringify(j).slice(0, 200)); }

  const submit = async (desc) => {
    const fd2 = new FormData();
    fd2.append("description", desc);
    fd2.append("location", "Str. Test, 1");
    fd2.append("category", "roads");
    fd2.append("categorySuggested", "roads");
    fd2.append("locationSource", "manual");
    fd2.append("lang", "ro");
    fd2.append("confirm", "yes");
    if (buf.byteLength) fd2.append("media", new Blob([buf], { type: "video/mp4" }), "clip.mp4");
    return fetch(`${BASE}/api/tickets`, { method: "POST", body: fd2 });
  };
  const withVideo = await submit("");
  if (withVideo.ok) ok("DESC OPTIONAL OK (video present, empty description accepted)");
  else { fails++; console.log("DESC OPTIONAL FAIL", withVideo.status, (await withVideo.text()).slice(0, 200)); }

  const fd3 = new FormData();
  fd3.append("description", "");
  fd3.append("location", "Str. Test, 1");
  fd3.append("category", "roads");
  fd3.append("confirm", "yes");
  const noVideo = await fetch(`${BASE}/api/tickets`, { method: "POST", body: fd3 });
  if (noVideo.status === 422) ok("DESC REQUIRED OK (no video, empty description rejected)");
  else { fails++; console.log("DESC REQUIRED FAIL", noVideo.status); }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(fails ? `FAILS: ${fails}` : "ALL OK");
process.exit(fails ? 1 : 0);