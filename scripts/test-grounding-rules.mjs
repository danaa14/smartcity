import assert from "node:assert/strict";
import { DOCS, DOC_BY_ID } from "../src/lib/corpus/docs.ts";
import { isCitizenAnswerSource } from "../src/lib/corpus/sources.ts";
import { decomposeQuestion, officialNextSteps, retrieve } from "../src/lib/retrieval/index.ts";
import { answerQuestion } from "../src/lib/answer/pipeline.ts";

const unknownReal = DOCS.find((doc) => doc.kind === "real" && doc.status === "unknown" && doc.url);
assert.ok(unknownReal && isCitizenAnswerSource(unknownReal), "unknown currency is usable only with a visible caveat");
assert.ok(!isCitizenAnswerSource({ ...unknownReal, status: "superseded" }), "superseded sources cannot support current answers");
assert.ok(!isCitizenAnswerSource({ ...unknownReal, status: "abrogated" }), "abrogated sources cannot support current answers");
assert.ok(!isCitizenAnswerSource(DOC_BY_ID.get("voice-annex-source-list")), "the Annex catalogue is not an answer source");
assert.ok(!isCitizenAnswerSource(DOCS.find((doc) => doc.kind === "demo")), "fictional documents cannot support citizen answers");

const parts = decomposeQuestion("Ce acte pentru contractul de apă și cât costă?");
assert.equal(parts.length, 2, "explicitly joined questions should be searched independently");
assert.deepEqual(decomposeQuestion("Ce acte pentru contractul de apă?"), ["Ce acte pentru contractul de apă?"]);

const multi = retrieve("Cât costă apa și cum depun o petiție?");
assert.equal(multi.informationNeeds.length, 2);
assert.ok(multi.needPassages.every((hits) => hits.length > 0), "each clause should have its own evidence candidates");
assert.ok(multi.needPassages[0].some((hit) => hit.passage.docId.includes("tarif")));
assert.ok(multi.needPassages[1].some((hit) => /petit|petition/i.test(hit.passage.docId)));

const nextSteps = officialNextSteps("Nu găsesc informații despre grădiniță", "ro");
assert.ok(nextSteps.length > 0, "abstentions should offer a corpus-backed official contact");
assert.ok(nextSteps.every((step) => step.url.startsWith("https://") && step.passage));
assert.equal(
  answerQuestion("Cât costă apa?", "ro", { includeDemo: false, forceMissing: true }).status,
  "missing",
  "municipal fallbacks must not use a topic match when retrieval did not verify the evidence",
);

console.log("Grounding rules passed: source eligibility, independent multi-part retrieval, and cited official next steps.");
