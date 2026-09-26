// Checks every real passage occurs verbatim (whitespace-normalised) in its raw snapshot.
// Run: npm run verify:corpus
import { readFileSync } from "node:fs";
import { PASSAGES } from "../src/lib/corpus/passages";
import { DOCS } from "../src/lib/corpus/docs";
import { FACTS } from "../src/lib/corpus/facts";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const docs = new Map(DOCS.map((d) => [d.id, d]));
const passages = new Map(PASSAGES.map((p) => [p.id, p]));
let failures = 0;

for (const p of PASSAGES) {
  const doc = docs.get(p.docId);
  if (!doc) { console.error(`✗ ${p.id}: unknown doc ${p.docId}`); failures++; continue; }
  if (doc.kind === "demo") {
    if (!p.text.startsWith("[DEMO")) { console.error(`✗ ${p.id}: demo passage not labelled`); failures++; }
    continue;
  }
  const raw = norm(readFileSync(doc.rawFile!, "utf8"));
  if (!raw.includes(norm(p.text))) { console.error(`✗ ${p.id}: not found verbatim in ${doc.rawFile}`); failures++; }
  else console.log(`✓ ${p.id}`);
}

for (const f of FACTS) {
  for (const c of f.cites) {
    const p = passages.get(c.passageId);
    if (!p) { console.error(`✗ fact ${f.id}: unknown passage ${c.passageId}`); failures++; continue; }
    if (!norm(p.text).includes(norm(c.quote))) { console.error(`✗ fact ${f.id}: quote not inside ${c.passageId}: "${c.quote}"`); failures++; }
  }
}

console.log(failures ? `\n${failures} problem(s)` : `\nAll ${PASSAGES.length} passages and ${FACTS.length} facts verified.`);
process.exit(failures ? 1 : 0);
