// The chat replies in the language selected on the platform (RO by default, RU when switched),
// whatever script the question is typed in. Provider mocked: this checks what the model is told
// and which language the answer envelope carries, not live model output.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.OPENCODE_API_KEY = 'mock-test-key';
process.env.AI_MODEL = 'mock-model';
const calls = [];
globalThis.fetch = async (_url, init) => {
  calls.push(JSON.parse(init.body));
  return Response.json({ choices: [{ message: { content: 'Salut!' } }] });
};

const originalCwd = process.cwd();
const dir = mkdtempSync(join(tmpdir(), 'smartcity-lang-'));
process.chdir(dir);
process.on('exit', () => { process.chdir(originalCwd); rmSync(dir, { recursive: true, force: true }); });

const { POST } = await import('../src/server/api/ask.ts');
const ask = async (body) => {
  const res = await POST(new Request('http://localhost/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  assert.equal(res.status, 200);
  return res.json();
};
const last = () => ({ system: calls.at(-1).messages[0].content, user: calls.at(-1).messages[1].content });
const RO_PERSONA = /Ești „Chișinău, pe fir”/;
const RU_PERSONA = /Ты — «Кишинэу, на связи»/;

// 1. Default platform language is Romanian, even for a question typed in Russian.
let answer = await ask({ question: 'Объясните, что такое приобретательная давность' });
assert.equal(answer.questionLang, 'ro');
assert.match(last().system, RO_PERSONA);
assert.match(last().user, /\(Răspunde în limba română\.\)$/);
console.log('DEFAULT RO OK');

// 2. Platform switched to Russian: Russian persona even for a Romanian question.
answer = await ask({ question: 'Explică-mi ce înseamnă uzucapiunea', lang: 'ru' });
assert.equal(answer.questionLang, 'ru');
assert.match(last().system, RU_PERSONA);
assert.match(last().user, /\(Ответь на русском языке\.\)$/);
console.log('SWITCH RU OK');

// 3. Switching mid-conversation: Romanian history, Russian platform → the reminder comes last.
answer = await ask({
  question: 'Și ce înseamnă asta pentru mine?',
  lang: 'ru',
  history: [{ role: 'user', content: 'Ce este uzucapiunea?' }, { role: 'assistant', content: 'Uzucapiunea înseamnă dobândirea proprietății prin posesie îndelungată.' }],
});
assert.equal(answer.questionLang, 'ru');
assert.match(last().system, RU_PERSONA);
assert.ok(last().user.indexOf('Uzucapiunea înseamnă') < last().user.indexOf('(Ответь на русском языке.)'));
console.log('MID-CONVERSATION SWITCH OK');

// 4. And back to Romanian with Russian history.
answer = await ask({
  question: 'А сколько это длится?',
  lang: 'ro',
  history: [{ role: 'user', content: 'Что такое давность?' }, { role: 'assistant', content: 'Это приобретение права собственности через длительное владение.' }],
});
assert.equal(answer.questionLang, 'ro');
assert.match(last().system, RO_PERSONA);
console.log('SWITCH BACK RO OK');

// 5. Cited corpus answers carry the platform language too.
for (const lang of ['ro', 'ru']) {
  answer = await ask({ question: 'Ce acte îmi trebuie pentru contractul de apă la apartament?', lang });
  assert.equal(answer.kind, 'corpus');
  assert.equal(answer.questionLang, lang);
}
console.log('CORPUS LANG OK');

// 6. Russian questions reach the same indexed sources as their Romanian twins.
const { retrieve } = await import('../src/lib/retrieval/index.ts');
const { EXAMPLES } = await import('../src/lib/corpus/examples.ts');
const { answerQuestion } = await import('../src/lib/answer/pipeline.ts');
const { detectAspects } = await import('../src/lib/retrieval/index.ts');
for (const ex of EXAMPLES) {
  const ro = retrieve(ex.q.ro), ru = retrieve(ex.q.ru);
  assert.equal(ru.grounded, ro.grounded, `grounded parity: ${ex.q.ru}`);
  assert.equal(ru.confident, ro.confident, `confidence parity: ${ex.q.ru}`);
  // Same verdict and same named gaps: a Russian question must not grow a spurious gap.
  const aro = answerQuestion(ex.q.ro, 'ro', { includeDemo: false }), aru = answerQuestion(ex.q.ru, 'ru', { includeDemo: false });
  assert.equal(aru.status, aro.status, `status parity: ${ex.q.ru}`);
  assert.equal(aru.topicId, aro.topicId, `topic parity: ${ex.q.ru}`);
  assert.equal(aru.missing.length, aro.missing.length, `gap parity: ${ex.q.ru}`);
}
// Short Russian aspect cues match exactly, as before: "сколько стоит" is a cost question only.
assert.deepEqual(detectAspects('Сколько стоит питьевая вода?'), ['cost']);
assert.deepEqual(detectAspects('Почему вода такая дорогая?'), []);
answer = await ask({ question: 'Какие документы нужны для договора на воду в квартире?', lang: 'ru' });
assert.equal(answer.kind, 'corpus');
assert.equal(answer.topicId, 'water-contract');
assert.equal(answer.status, 'supported');
// Stem matching must not invent a subject: none of these are covered by the corpus.
for (const q of [
  'Сколько стоит проезд в троллейбусе?', 'Где получить водительские права?', 'Как оплатить штраф за парковку?',
  'Нужен ли договор аренды квартиры?', 'Как уклониться от налогов?', 'Кто мэр Кишинёва?', 'Привет',
  'Как получить паспорт?', 'Сколько стоит вода в бутылках в магазине?', 'Как оформить наследство на дом?',
  'Когда отключат горячую воду?', 'Как записать ребёнка в школу?',
]) assert.equal(retrieve(q).confident, false, q);
console.log('RU RETRIEVAL PARITY OK');

console.log('Chat language checks passed (provider mocked).');
