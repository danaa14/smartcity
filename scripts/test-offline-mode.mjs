// Without a model key the chat serves the curated, cited answers. A multi-part question about
// one subject gets that subject's answer (with its gaps); a question mixing subjects abstains
// rather than silently dropping a part.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.AI_MODE = 'off';
const originalCwd = process.cwd();
const dir = mkdtempSync(join(tmpdir(), 'smartcity-offline-'));
process.chdir(dir);
process.on('exit', () => { process.chdir(originalCwd); rmSync(dir, { recursive: true, force: true }); });

const { POST } = await import('../src/server/api/ask.ts');
const ask = async (question, lang = 'ro') => {
  const res = await POST(new Request('http://localhost/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, lang }) }));
  assert.equal(res.status, 200);
  return res.json();
};

for (const [q, lang] of [
  ['Cât costă și în cât timp se încheie contractul de apă?', 'ro'],
  ['Сколько стоит и за какой срок заключают договор на воду?', 'ru'],
]) {
  const a = await ask(q, lang);
  assert.equal(a.engine.mode, 'deterministic-demo', q);
  assert.equal(a.topicId, 'water-contract', q);
  assert.equal(a.status, 'partial', q);
  assert.ok(a.claims.length > 0 && a.missing.length > 0, q);
}
console.log('MULTI-PART SAME SUBJECT OK');

for (const q of ['Cât costă contractul de apă și cine e primarul?', 'Cât costă apa potabilă și cum depun o petiție?']) {
  const a = await ask(q);
  assert.equal(a.status, 'missing', q);
  assert.equal(a.claims.length, 0, q);
}
console.log('MIXED SUBJECTS ABSTAIN OK');

for (const [q, lang, topic] of [
  ['Ce acte îmi trebuie pentru contractul de apă la apartament?', 'ro', 'water-contract'],
  ['Какие документы нужны для договора на воду в квартире?', 'ru', 'water-contract'],
  ['Vreau să cer tăierea unui copac din curtea blocului', 'ro', 'trees'],
  ['Сколько стоит вывоз мусора для частного дома?', 'ru', 'waste'],
]) {
  const a = await ask(q, lang);
  assert.equal(a.topicId, topic, q);
  assert.notEqual(a.status, 'missing', q);
  assert.equal(a.questionLang, lang, q);
}
console.log('SINGLE SUBJECT RO/RU OK');

// With a model key, a drafting failure on the same kind of question falls back to the curated
// answer — never to a copy stripped of its claims. (Answers are cached per question for 60 s,
// so each case uses its own wording.)
const { answerWithModel } = await import('../src/lib/answer/withModel.ts');
const { answerQuestion } = await import('../src/lib/answer/pipeline.ts');
const { AI } = await import('../src/lib/ai/config.ts');
const realFetch = globalThis.fetch;
Object.defineProperty(AI, 'enabled', { value: true, configurable: true });
for (const [q, reply] of [
  ['Cât costă și în cât timp se încheie contractul de apă, pentru un apartament?', () => Response.json({ error: 'boom' }, { status: 500 })],
  ['Cât costă și în cât timp se încheie contractul de apă la apartament?', () => Response.json({ choices: [{ message: { content: '{"claims":[],"missing":[]}' } }] })],
]) {
  let modelCalled = false;
  globalThis.fetch = async () => { modelCalled = true; return reply(); };
  const curated = answerQuestion(q, 'ro', { includeDemo: false });
  const a = await answerWithModel(q, 'ro');
  assert.ok(modelCalled, 'the model path was exercised');
  assert.ok(a, 'model failure still yields the curated answer');
  assert.equal(a.engine.mode, 'llm-fallback', q);
  assert.equal(a.topicId, 'water-contract', q);
  assert.ok(a.claims.length > 0, 'fallback keeps the curated claims');
  assert.deepEqual(a.claims.map((c) => c.id), curated.claims.map((c) => c.id));
  assert.equal(a.missing.length, curated.missing.length, 'fallback keeps the named gaps');
}
globalThis.fetch = realFetch;
console.log('MODEL FAILURE FALLBACK OK');

console.log('Offline-mode answers passed (no model key).');
