// Smoke-tests the answer pipeline on the documented demo scenarios.
import { answerQuestion } from "../src/lib/answer/pipeline";
const cases: [string, string][] = [
  ["Ce acte îmi trebuie pentru contractul de apă la apartament?", "supported"],
  ["Cât costă și în cât timp se încheie contractul de apă?", "partial"],
  ["Cum înscriu copilul la grădiniță?", "missing"],
  ["Cu câte zile înainte depun cererea pentru terasă sezonieră?", "contradiction"],
  ["Какие документы нужны для договора на воду в квартире?", "supported"],
  ["Cât costă apa potabilă?", "supported"],
  ["Cum depun o petiție la primărie?", "supported"],
  ["В какой срок мэрия отвечает на петицию?", "partial"],
  ["Vreau să tai un copac din curtea blocului", "supported"],
  ["Cât costă evacuarea gunoiului la casă?", "supported"],
  ["cine e primar", "missing"],
];
let bad = 0;
for (const [q, want] of cases) {
  const a = answerQuestion(q);
  const ok = a.status === want;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} [${a.status}${ok ? "" : " want " + want}] ${q}\n   topic=${a.topicId} aspects=${a.requestedAspects} claims=${a.claims.map(c=>c.id)} steps=${a.steps.length} missing=${a.missing.length} valid=${a.validation.passed}/${a.validation.checked}`);
}
process.exit(bad ? 1 : 0);
