import assert from "node:assert/strict";
import { DOCS, DOC_BY_ID } from "../src/lib/corpus/docs.ts";
import { isCitizenAnswerSource } from "../src/lib/corpus/sources.ts";
import { searchPassages } from "../src/lib/retrieval/index.ts";
import { retrieve } from "../src/lib/retrieval/index.ts";

// Production voice scope: pages indexed from Annex 1, never Annex 1 itself or demo fixtures.
const officialIds = DOCS
  .filter(isCitizenAnswerSource)
  .map((doc) => doc.id);
assert.ok(officialIds.length >= 60, "the actual pages linked from Annex 1 should be indexed");

const tariff = searchPassages("Apă-Canal apă potabilă tarif", 8, officialIds);
assert.ok(tariff.some((hit) => hit.passage.docId === "acc-tarif"), "water-tariff question should retrieve its actual source page");

const road = searchPassages("Exdrupo întreținerea și reparația drumurilor", 8, officialIds);
assert.ok(road.some((hit) => hit.passage.docId.includes("exdrupo")), "road-maintenance question should retrieve the road-service source");

for (const hit of [...tariff, ...road]) {
  const doc = DOC_BY_ID.get(hit.passage.docId);
  assert.equal(doc?.kind, "real", "production retrieval must never return a DEMO record");
  assert.ok(doc?.url, "citizen-facing passages must carry a clickable official source URL");
}

const terrace = retrieve("Cu câte zile înainte depun cererea pentru terasă sezonieră?");
assert.ok(terrace.candidates.every((candidate) => !candidate.topicId.startsWith("demo-")), "normal retrieval must not rank demo topics");
assert.ok(terrace.passages.every((hit) => DOC_BY_ID.get(hit.passage.docId)?.kind === "real"), "normal retrieval passages must exclude demos");

console.log(`Voice retrieval scope checks passed (${officialIds.length} official pages eligible); Annex catalogue and demos are excluded.`);
