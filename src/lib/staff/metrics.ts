import type { ReviewItem } from "../feedback";
import type { Ticket } from "../tickets/types";
import type { L10n } from "../corpus/types";
import { DOCS } from "../corpus/docs";
import { PASSAGES } from "../corpus/passages";
import { FACTS } from "../corpus/facts";
import { TOPICS } from "../corpus/topics";
import { CATEGORIES } from "../tickets/types";

export interface Slice {
  key: string;
  label: L10n;
  count: number;
}

export interface TopicCoverage {
  id: string;
  label: L10n;
  kind: "real" | "demo";
  facts: number;
  passages: number;
  questions: number;
}

export interface StaffMetrics {
  corpus: { docs: number; realDocs: number; demoDocs: number; passages: number; facts: number; topics: number; unknownValidity: number; inForce: number; citedPassages: number };
  coverage: { topics: TopicCoverage[]; unmatched: number; matched: number };
  questions: { logged: number; byStatus: Slice[]; byLang: Slice[]; byDay: { day: string; count: number }[] };
  tickets: {
    total: number;
    open: number;
    done: number;
    byCategory: Slice[];
    byDay: { day: string; count: number }[];
    ageBuckets: Slice[];
    classifier: { suggested: number; kept: number; changed: number };
    locationSource: Slice[];
    withGps: number;
    withMedia: number;
  };
  evidence: { flaggedPassages: { passageId: string; count: number }[]; topDocs: { id: string; title: string; passages: number }[] };
}

const DAY = 24 * 60 * 60 * 1000;

function days(iso: string[], span: number): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of iso) counts.set(value.slice(0, 10), (counts.get(value.slice(0, 10)) ?? 0) + 1);
  const out: { day: string; count: number }[] = [];
  const today = Date.now();
  for (let i = span - 1; i >= 0; i--) {
    const day = new Date(today - i * DAY).toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

function tally<T>(rows: T[], key: (row: T) => string | null | undefined, labels: Record<string, L10n>): Slice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({ key, count, label: labels[key] ?? { ro: key, ru: key } }))
    .sort((a, b) => b.count - a.count);
}

const STATUS_LABEL: Record<string, L10n> = {
  supported: { ro: "Susținut de dovezi", ru: "Подтверждено" },
  partial: { ro: "Parțial", ru: "Частично" },
  missing: { ro: "Fără acoperire", ru: "Нет покрытия" },
  contradiction: { ro: "Contradicție", ru: "Противоречие" },
};
const LANG_LABEL: Record<string, L10n> = { ro: { ro: "Română", ru: "Румынский" }, ru: { ro: "Rusă", ru: "Русский" } };
const SOURCE_LABEL: Record<string, L10n> = {
  manual: { ro: "Scrisă de om", ru: "Введено вручную" },
  device: { ro: "GPS dispozitiv", ru: "GPS устройства" },
  photo: { ro: "Din fotografie", ru: "Из фотографии" },
};

export function buildMetrics(items: ReviewItem[], tickets: Ticket[]): StaffMetrics {
  const passagesByDoc = new Map<string, number>();
  for (const p of PASSAGES) passagesByDoc.set(p.docId, (passagesByDoc.get(p.docId) ?? 0) + 1);

  const citedPassages = new Set(FACTS.flatMap((f) => f.cites.map((c) => c.passageId)));

  const questionsByTopic = new Map<string, number>();
  for (const i of items) {
    if (i.kind === "rating") continue;
    if (i.topicId) questionsByTopic.set(i.topicId, (questionsByTopic.get(i.topicId) ?? 0) + 1);
  }

  const topicPassages = (topicId: string) =>
    new Set(FACTS.filter((f) => f.topic === topicId).flatMap((f) => f.cites.map((c) => c.passageId))).size;

  const topics: TopicCoverage[] = TOPICS.map((t) => ({
    id: t.id,
    label: t.title,
    kind: t.kind,
    facts: FACTS.filter((f) => f.topic === t.id).length,
    passages: topicPassages(t.id),
    questions: questionsByTopic.get(t.id) ?? 0,
  })).sort((a, b) => b.questions - a.questions || b.facts - a.facts);

  const asked = items.filter((i) => i.kind !== "rating");
  const matched = asked.filter((i) => i.topicId).length;

  const open = tickets.filter((k) => (k.status ?? "active") !== "done");
  const now = Date.now();
  const age = (k: Ticket) => Math.floor((now - new Date(k.createdAt).getTime()) / DAY);
  const bucket = (d: number) => (d < 1 ? "today" : d < 3 ? "d1_2" : d < 8 ? "d3_7" : "d8plus");

  const suggested = tickets.filter((k) => k.categorySuggested);

  return {
    corpus: {
      docs: DOCS.length,
      realDocs: DOCS.filter((d) => d.kind === "real").length,
      demoDocs: DOCS.filter((d) => d.kind === "demo").length,
      passages: PASSAGES.length,
      facts: FACTS.length,
      topics: TOPICS.length,
      unknownValidity: DOCS.filter((d) => d.kind === "real" && d.status === "unknown").length,
      inForce: DOCS.filter((d) => d.status === "declared_in_force").length,
      citedPassages: citedPassages.size,
    },
    coverage: { topics, unmatched: asked.length - matched, matched },
    questions: {
      logged: asked.length,
      byStatus: tally(asked, (i) => i.answerStatus, STATUS_LABEL),
      byLang: tally(asked, (i) => i.lang, LANG_LABEL),
      byDay: days(asked.map((i) => i.createdAt), 14),
    },
    tickets: {
      total: tickets.length,
      open: open.length,
      done: tickets.length - open.length,
      byCategory: tally(tickets, (k) => k.category, Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))),
      byDay: days(tickets.map((k) => k.createdAt), 14),
      ageBuckets: tally(open, (k) => bucket(age(k)), {
        today: { ro: "Azi", ru: "Сегодня" },
        d1_2: { ro: "1–2 zile", ru: "1–2 дня" },
        d3_7: { ro: "3–7 zile", ru: "3–7 дней" },
        d8plus: { ro: "Peste 8 zile", ru: "Более 8 дней" },
      }),
      classifier: {
        suggested: suggested.length,
        kept: suggested.filter((k) => !k.categoryChangedByUser).length,
        changed: suggested.filter((k) => k.categoryChangedByUser).length,
      },
      locationSource: tally(tickets, (k) => k.location?.source, SOURCE_LABEL),
      withGps: tickets.filter((k) => k.location?.lat != null).length,
      withMedia: tickets.filter((k) => k.media.length > 0).length,
    },
    evidence: {
      flaggedPassages: [...items.filter((i) => i.kind === "citation_report" && i.passageId).reduce((acc, i) => acc.set(i.passageId!, (acc.get(i.passageId!) ?? 0) + 1), new Map<string, number>())]
        .map(([passageId, count]) => ({ passageId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topDocs: [...passagesByDoc]
        .map(([id, passages]) => ({ id, passages, title: DOCS.find((d) => d.id === id)?.title ?? id }))
        .sort((a, b) => b.passages - a.passages)
        .slice(0, 8),
    },
  };
}
