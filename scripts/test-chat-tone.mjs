// The assistant talks like a support agent: no "Conform Anexei…" / "Согласно источнику…" openers,
// no [n] markers, no corpus jargon in the text people read. Provider mocked: this checks the
// prompts, the scrubbing of model output and the canned wording — not live model quality.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.OPENCODE_API_KEY = 'mock-test-key';
process.env.AI_MODEL = 'mock-model';

const { humanize } = await import('../src/lib/answer/tone.ts');

// 1. Source-attribution openers and markers are removed; meaningful openers stay.
const cases = [
  ['Conform Anexei 1, trebuie să depuneți o cerere tip.', 'Trebuie să depuneți o cerere tip.'],
  ['Potrivit informațiilor de pe site-ul Apă-Canal, contractul se încheie în 5 zile [2].', 'Contractul se încheie în 5 zile.'],
  ['Salut! Conform sursei [1], taxa este 20 lei. Potrivit documentului, plătiți la ghișeu.', 'Salut! Taxa este 20 lei. Plătiți la ghișeu.'],
  ['Din informațiile disponibile, termenul este de 30 de zile.', 'Termenul este de 30 de zile.'],
  ['Aveți nevoie de cerere (conform Anexei 1) și de buletin.', 'Aveți nevoie de cerere și de buletin.'],
  ['Согласно приложению 1, нужно подать заявление.', 'Нужно подать заявление.'],
  ['По данным сайта, срок — 30 дней. Исходя из предоставленных данных, оплата онлайн.', 'Срок — 30 дней. Оплата онлайн.'],
  ['Как указано в документе, договор заключается бесплатно.', 'Договор заключается бесплатно.'],
  // Left alone: these carry meaning, not provenance.
  ['Din documentele necesare, cel mai important e buletinul.', 'Din documentele necesare, cel mai important e buletinul.'],
  ['Conform legii, aveți dreptul la un răspuns în 30 de zile.', 'Conform legii, aveți dreptul la un răspuns în 30 de zile.'],
  ['[DEMO] Taxa este 20 lei pentru [NUME_1].', '[DEMO] Taxa este 20 lei pentru [NUME_1].'],
  ['Depuneți cererea (vezi pasul 3) la ghișeu.', 'Depuneți cererea (vezi pasul 3) la ghișeu.'],
  ['Подайте заявление (см. ниже) в окошке.', 'Подайте заявление (см. ниже) в окошке.'],
];
for (const [input, want] of cases) assert.equal(humanize(input), want, input);
console.log('HUMANIZE OK');

const originalCwd = process.cwd();
const dir = mkdtempSync(join(tmpdir(), 'smartcity-tone-'));
process.chdir(dir);
process.on('exit', () => { process.chdir(originalCwd); rmSync(dir, { recursive: true, force: true }); });

const calls = [];
let reply = 'Conform Anexei 1, pentru situația dumneavoastră aveți nevoie de o cerere [1].';
globalThis.fetch = async (_url, init) => {
  calls.push(JSON.parse(init.body));
  return Response.json({ choices: [{ message: { content: reply } }] });
};
const { POST } = await import('../src/server/api/ask.ts');
const ask = async (body) => {
  const res = await POST(new Request('http://localhost/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  assert.equal(res.status, 200);
  return res.json();
};

// 2. Conversational prose: the persona asks for a support-agent voice, and a robotic opener
//    that slips through is scrubbed before the person sees it.
let answer = await ask({ question: 'Explică-mi ce înseamnă uzucapiunea' });
const system = calls.at(-1).messages[0].content;
assert.match(system, /Pentru situația dumneavoastră, aveți nevoie de/);
assert.match(system, /Nu spune de unde vine informația/);
assert.match(system, /customer-support agent/);
assert.equal(answer.prose, 'Pentru situația dumneavoastră aveți nevoie de o cerere.');
answer = await ask({ question: 'Объясните, что такое давность', lang: 'ru' });
assert.match(calls.at(-1).messages[0].content, /В вашем случае понадобится/);
console.log('PROSE TONE OK');

// 3. Cited answers: the drafting prompt asks for direct, second-person claims, and a
//    "Conform Anexei…" claim keeps its verified quote but loses the opener.
const { FACTS } = await import('../src/lib/corpus/facts.ts');
const fact = FACTS.find((f) => f.id === 'w-cerere');
reply = JSON.stringify({ claims: [{
  ro: 'Conform Anexei 1, completați o cerere tip.',
  ru: 'Согласно приложению 1, заполните типовое заявление.',
  aspect: ['procedure'],
  cites: [{ passageId: fact.cites[0].passageId, quote: fact.cites[0].quote }],
}], missing: [] });
answer = await ask({ question: 'Ce acte îmi trebuie pentru contractul de apă la apartament?' });
assert.equal(answer.kind, 'corpus');
assert.equal(answer.engine.mode, 'llm');
assert.match(calls.at(-1).messages[0].content, /friendly support agent/);
assert.match(calls.at(-1).messages[0].content, /Never mention the source in the claim text/);
assert.equal(answer.claims[0].text.ro, 'Completați o cerere tip.');
assert.equal(answer.claims[0].text.ru, 'Заполните типовое заявление.');
assert.equal(answer.claims[0].citations[0].quote, fact.cites[0].quote, 'the evidence itself is untouched');
console.log('CITED TONE OK');

// 4. No corpus jargon in the gaps people read.
const { answerQuestion } = await import('../src/lib/answer/pipeline.ts');
const { EXAMPLES } = await import('../src/lib/corpus/examples.ts');
for (const lang of ['ro', 'ru'])
  for (const ex of EXAMPLES) {
    for (const a of [answerQuestion(ex.q[lang], lang), answerQuestion(ex.q[lang], lang, { forceMissing: true })])
      for (const m of a.missing) assert.doesNotMatch(m[lang], /corpus|корпус|pasaj|фрагмент|afirmație\(i\)|утверждение\(й\)/i, m[lang]);
  }
console.log('GAP WORDING OK');

// 4b. The pre-written claims (shown without a model, or when it fails) state the fact, not the page.
for (const f of FACTS.filter((x) => !x.text.ro.startsWith('[DEMO]')))
  for (const t of [f.text.ro, f.text.ru, f.uncertainty?.ro, f.uncertainty?.ru].filter(Boolean))
    assert.doesNotMatch(t, /\bpagin|conform paginii|lista mai menționează|на странице|страница |согласно странице|в списке также/i, `${f.id}: ${t}`);
console.log('CURATED WORDING OK');

// 5. Voice: no longer told to read source titles aloud.
const { INSTRUCTIONS } = await import('../src/server/api/voice.ts');
for (const lang of ['ro', 'ru']) {
  assert.doesNotMatch(INSTRUCTIONS(lang), /name each source title/);
  assert.match(INSTRUCTIONS(lang), /Do not read out source titles/);
}
console.log('VOICE TONE OK');

console.log('Chat tone checks passed (provider mocked).');
