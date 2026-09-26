import assert from "node:assert/strict";
import { searchPassages } from "../src/lib/retrieval/index.ts";

const allowed = ["voice-annex-source-list"];
const health = searchPassages("healthcare institutions", 8, allowed).filter((hit) => hit.coverage >= 0.16);
assert.ok(health.some((hit) => hit.passage.section === "Healthcare" && hit.passage.page === 1), "healthcare query should cite the correct Annex page and section");
assert.ok(health.every((hit) => hit.passage.docId === allowed[0]), "voice results must come only from the approved PDF");

const unsupported = searchPassages("water connection deadline requirements", 8, allowed).filter((hit) => hit.coverage >= 0.16);
assert.equal(unsupported.length, 0, "Annex source index must not answer a service-procedure question");

console.log("Voice retrieval returns only the approved Annex passages and leaves unsupported service questions unanswered.");
