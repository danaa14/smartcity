import "server-only";
import { complete } from "../ai/client";
import { AI } from "../ai/config";
import { suggestCategory, suggestDescription } from "./classify";
import { CATEGORIES, type CategoryId } from "./types";
import type { Lang } from "../corpus/types";

export interface VideoSummary {
  lang: Lang;
  description: string;
  location: string;
  category: CategoryId | "";
  ai: boolean;
  engine: string;
}

const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));

const SYSTEM = `You are a city helpdesk. A resident recorded a short video reporting a problem (pothole, broken light, waste, trees, water leak, other). You receive the automatic transcription of their speech plus optional GPS coordinates.
Return ONLY JSON, no markdown:
{"description":{"ro":"short plain summary of the problem, max 2 sentences, no invented facts","ru":"same in Russian"},"location":{"ro":"street/intersection/landmark if mentioned, else null","ru":"same in Russian"},"category":"roads|lighting|waste|greenery|water|other"}
If the resident only said the problem without a place, location is null. Never invent streets or numbers that were not said.`;

function jsonOf(text: string): { description?: Record<string, string>; location?: Record<string, string>; category?: string } | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as ReturnType<typeof jsonOf>;
  } catch {
    return null;
  }
}

/** AI summary of the transcript + spoken/gps location. Falls back to keyword rules and the transcript head. */
export async function summarizeVideo(transcript: string, gps: { lat?: number; lng?: number }, lang: Lang): Promise<VideoSummary> {
  const gpsText = gps.lat != null ? `GPS: ${gps.lat}, ${gps.lng}` : "";
  const user = `Transcriere:\n${transcript}\n${gpsText}`;
  const fallback = (ai = false): VideoSummary => {
    const cat = suggestCategory(transcript);
    const filler = transcript.trim().length ? suggestDescription(transcript) : "";
    return {
      lang,
      description: filler,
      location: gps.lat != null ? `${gps.lat}, ${gps.lng}` : "",
      category: cat?.id ?? "",
      ai,
      engine: ai ? `${AI.model} (OpenCode Go)` : "reguli de cuvinte cheie",
    };
  };
  if (!AI.enabled || !transcript.trim()) return fallback();
  try {
    const raw = await complete(SYSTEM, user, `pefir-video-${Date.now().toString(36)}`);
    const j = jsonOf(raw);
    if (!j) return fallback();
    const desc = j.description?.[lang]?.trim() || fallback().description;
    const loc = j.location?.[lang]?.trim() || (gps.lat != null ? `${gps.lat}, ${gps.lng}` : "");
    const cat = CAT_IDS.has(j.category as CategoryId) ? (j.category as CategoryId) : suggestCategory(transcript)?.id ?? "";
    return { lang, description: desc.slice(0, 1000), location: loc.slice(0, 300), category: cat, ai: true, engine: `${AI.model} (OpenCode Go)` };
  } catch {
    return fallback();
  }
}