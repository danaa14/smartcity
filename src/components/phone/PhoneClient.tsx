"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "../LangProvider";
import { Notice, StatusBadge } from "../ui";
import type { Answer } from "@/lib/answer/types";
import type { Lang } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/tickets/types";

type Turn = { who: "bot" | "caller"; text: string; note?: string; answer?: Answer };
type Scenario = "question" | "missing" | "report";

const SCRIPTS: Record<Scenario, { label: { ro: string; ru: string }; caller: Record<Lang, string[]> }> = {
  question: {
    label: { ro: "Întrebare cu răspuns din surse", ru: "Вопрос с ответом из источников" },
    caller: { ro: ["Cum depun o petiție la primărie?"], ru: ["Как подать петицию в примэрию?"] },
  },
  missing: {
    label: { ro: "Informație lipsă → contact uman", ru: "Нет информации → связь с человеком" },
    caller: { ro: ["Cum înscriu copilul la grădiniță?"], ru: ["Как записать ребёнка в детский сад?"] },
  },
  report: {
    label: { ro: "Sesizare vocală cu citire înapoi", ru: "Голосовое обращение с зачитыванием" },
    caller: {
      ro: ["Vreau să raportez un bec stradal ars.", "Pe strada Exemplu, lângă blocul 10.", "Da, e corect."],
      ru: ["Хочу сообщить о неработающем уличном фонаре.", "На улице Пример, возле дома 10.", "Да, всё верно."],
    },
  },
};

const SAY: Record<string, { ro: string; ru: string }> = {
  greet: { ro: "Bună ziua. Sunteți în demonstrația asistentului „Chișinău, pe fir”. Nu este o linie oficială. Pentru limba rusă apăsați 2.", ru: "Здравствуйте. Это демонстрация помощника «Кишинэу, на связи». Это не официальная линия. Для румынского языка нажмите 1." },
  askWhat: { ro: "Spuneți pe scurt: aveți o întrebare sau vreți să raportați o problemă în oraș?", ru: "Коротко скажите: у вас вопрос или вы хотите сообщить о проблеме в городе?" },
  where: { ro: "Unde se află problema? Spuneți strada și un reper.", ru: "Где находится проблема? Назовите улицу и ориентир." },
  bye: { ro: "Vă mulțumim. La revedere.", ru: "Спасибо. До свидания." },
};

export function PhoneClient() {
  const { lang, t } = useLang();
  const [callLangChoice, setCallLang] = useState<Lang | null>(null);
  const callLang = callLangChoice ?? lang;
  const [scenario, setScenario] = useState<Scenario>("question");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [running, setRunning] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [speak, setSpeak] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const say = (text: string) => {
    if (speak && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = callLang === "ro" ? "ro-RO" : "ru-RU";
      window.speechSynthesis.speak(u);
    }
  };

  const push = (turn: Turn) => {
    setTurns((x) => [...x, turn]);
    if (turn.who === "bot") say(turn.text);
  };

  const L = (x: { ro: string; ru: string }) => x[callLang];

  const run = async () => {
    setRunning(true);
    setTurns([]);
    setTicketId(null);
    const callerLines = SCRIPTS[scenario].caller[callLang];
    push({ who: "bot", text: L(SAY.greet), note: t({ ro: "Alegerea limbii (DTMF 1/2)", ru: "Выбор языка (DTMF 1/2)" }) });
    push({ who: "caller", text: callLang === "ro" ? "[apasă 1]" : "[нажимает 2]" });
    push({ who: "bot", text: L(SAY.askWhat) });
    push({ who: "caller", text: callerLines[0], note: t({ ro: "Transcriere simulată (fără recunoaștere vocală live)", ru: "Имитация расшифровки (без живого распознавания речи)" }) });

    if (scenario !== "report") {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: callerLines[0], lang: callLang }) });
      const a = (await r.json()) as Answer;
      const spoken =
        a.kind === "prose"
          ? (a.unverified ? L({ ro: "Nu am acest lucru într-o sursă indexată, așa că vă rog să-l confirmați înainte de a acționa. ", ru: "Этого нет в индексированном источнике, поэтому подтвердите, прежде чем действовать. " }) : "") + (a.prose ?? "")
          : a.status === "missing"
          ? L({ ro: "Nu am în surse informații verificate despre acest subiect și nu vreau să vă induc în eroare. Vă pot da numărul Ghișeului Unic al Primăriei: ", ru: "У меня нет проверенных сведений по этой теме, и я не хочу ввести вас в заблуждение. Могу дать номер Единого окна Примэрии: " }) +
            "+373 22 20 15 05. " +
            L({ ro: "Doriți să vă transfer la un operator? În această demonstrație transferul nu este implementat.", ru: "Соединить вас с оператором? В этой демонстрации перевод звонка не реализован." })
          : L({ ro: "Conform paginii oficiale a Primăriei: ", ru: "Согласно официальной странице Примэрии: " }) +
            a.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s.text[callLang]}`).join(" ") +
            L({ ro: " Vă pot trimite prin SMS linkul către sursă. (SMS nu este implementat în demonstrație.)", ru: " Могу отправить ссылку на источник по SMS. (SMS в демонстрации не реализовано.)" });
      push({ who: "bot", text: spoken, answer: a, note: t({ ro: "Același motor și aceleași citări ca în „Întreabă primăria”", ru: "Тот же движок и те же цитаты, что в «Спросить примэрию»" }) });
    } else {
      const cat = CATEGORIES.find((c) => c.id === "lighting")!;
      push({ who: "bot", text: L({ ro: `Am înțeles: problemă de tip „${cat.label.ro}”. `, ru: `Понял: проблема типа «${cat.label.ru}». ` }) + L(SAY.where) });
      push({ who: "caller", text: callerLines[1] });
      push({
        who: "bot",
        text: L({ ro: `Citesc înapoi: categorie — ${cat.label.ro}; loc — „${callerLines[1]}”; descriere — „${callerLines[0]}”. Nu vă înregistrez numărul de telefon. Tichetul va fi DEMO, salvat local, și NU ajunge la Primărie. Confirmați?`, ru: `Зачитываю: категория — ${cat.label.ru}; место — «${callerLines[1]}»; описание — «${callerLines[0]}». Ваш номер телефона не сохраняется. Заявка будет DEMO, сохранена локально, и НЕ попадёт в Примэрию. Подтверждаете?` }),
        note: t({ ro: "Citire înapoi înainte de confirmare", ru: "Зачитывание перед подтверждением" }),
      });
      push({ who: "caller", text: callerLines[2] });
      const fd = new FormData();
      fd.append("description", callerLines[0]);
      fd.append("location", callerLines[1]);
      fd.append("category", "lighting");
      fd.append("categorySuggested", "lighting");
      fd.append("channel", "phone-demo");
      fd.append("lang", callLang);
      fd.append("confirm", "yes");
      const r = await fetch("/api/tickets", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok) {
        setTicketId(j.id);
        push({ who: "bot", text: L({ ro: `Am creat tichetul demo ${j.id}. Repet: nu a fost trimis Primăriei. `, ru: `Создана демо-заявка ${j.id}. Повторяю: она не отправлена в Примэрию. ` }) + L(SAY.bye) });
      } else {
        push({ who: "bot", text: L({ ro: "Nu am putut salva tichetul. Vă rog sunați la Ghișeul Unic: +373 22 20 15 05.", ru: "Не удалось сохранить заявку. Позвоните в Единое окно: +373 22 20 15 05." }) });
      }
    }
    setRunning(false);
  };

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Sună — același asistent, la telefon", ru: "Позвонить — тот же помощник по телефону" })}</h1>
        <Notice tone="demo" title={t({ ro: "Demonstrație de concept", ru: "Демонстрация концепции" })}>
          {t({ ro: "Nu există un număr de telefon real, recunoaștere vocală live, transfer de apel sau SMS. Replicile apelantului sunt scrise dinainte; răspunsurile asistentului sunt generate live de același motor cu citări ca pe site. Numărul Ghișeului Unic este citat de pe chisinau.md.", ru: "Реального номера, живого распознавания речи, перевода звонка и SMS нет. Реплики звонящего заготовлены; ответы помощника формируются тем же движком с цитатами, что и на сайте. Номер Единого окна процитирован с chisinau.md." })}
        </Notice>
      </header>

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="card space-y-4 p-4">
          <fieldset>
            <legend className="field-label">{t({ ro: "Limba apelului", ru: "Язык звонка" })}</legend>
            <div className="flex gap-2">
              {(["ro", "ru"] as const).map((l) => (
                <label key={l} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border font-semibold ${callLang === l ? "border-brand bg-brand-soft" : "border-line"}`}>
                  <input type="radio" name="clang" checked={callLang === l} onChange={() => setCallLang(l)} className="h-4 w-4" />
                  {l === "ro" ? "Română (1)" : "Русский (2)"}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">{t({ ro: "Scenariu", ru: "Сценарий" })}</legend>
            {(Object.keys(SCRIPTS) as Scenario[]).map((s) => (
              <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2">
                <input type="radio" name="scn" checked={scenario === s} onChange={() => setScenario(s)} className="h-4 w-4" />
                {t(SCRIPTS[s].label)}
              </label>
            ))}
          </fieldset>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} className="h-4 w-4" />
            {t({ ro: "Citește cu voce (sinteză vocală a browserului, locală)", ru: "Озвучивать (локальный синтез речи браузера)" })}
          </label>
          <button type="button" className="btn btn-primary w-full" onClick={run} disabled={running}>
            <span aria-hidden="true">☏</span> {running ? t({ ro: "Apel în desfășurare…", ru: "Идёт звонок…" }) : t({ ro: "Pornește apelul demo", ru: "Начать демо-звонок" })}
          </button>
        </div>

        <section aria-labelledby="tr-h" className="card p-4">
          <h2 id="tr-h" className="font-bold">{t({ ro: "Transcrierea apelului", ru: "Расшифровка звонка" })}</h2>
          {turns.length === 0 ? (
            <p className="mt-2 text-muted">{t({ ro: "Alegeți limba și scenariul, apoi porniți apelul.", ru: "Выберите язык и сценарий, затем начните звонок." })}</p>
          ) : (
            <ol ref={logRef} aria-live="polite" className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto">
              {turns.map((x, i) => (
                <li key={i} className={`flex ${x.who === "caller" ? "justify-end" : ""}`}>
                  <div lang={callLang} className={`max-w-[85%] rounded-2xl px-3 py-2 ${x.who === "caller" ? "bg-brand text-white" : "bg-paper"}`}>
                    <p className="text-xs font-bold opacity-80">{x.who === "caller" ? t({ ro: "Apelant", ru: "Звонящий" }) : t({ ro: "Asistent", ru: "Помощник" })}</p>
                    <p>{x.text}</p>
                    {x.note && <p className="mt-1 text-xs italic opacity-80">{x.note}</p>}
                    {x.answer && (
                      <div className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
                        <StatusBadge status={x.answer.status} lang={lang} size="sm" />
                        <p className="text-xs text-muted">
                          {t({ ro: "Surse folosite:", ru: "Использованные источники:" })}{" "}
                          {[...new Set(Object.values(x.answer.docs).map((d) => d.title))].join("; ")}
                        </p>
                        <Link className="link text-xs" href={`/intreaba?q=${encodeURIComponent(x.answer.question)}`}>
                          {t({ ro: "Vezi răspunsul complet cu citări", ru: "Полный ответ с цитатами" })}
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {ticketId && (
            <p className="mt-3">
              <Link href={`/tichet/${ticketId}`} className="btn btn-secondary">{t({ ro: "Deschide tichetul demo", ru: "Открыть демо-заявку" })} {ticketId}</Link>
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="arch-h" className="card p-4">
        <h2 id="arch-h" className="font-bold">{t({ ro: "Ce ar fi necesar pentru o linie reală", ru: "Что нужно для реальной линии" })}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
          <li>{t({ ro: "Un furnizor de telefonie (SIP/trunk) cu număr moldovenesc și contract cu Primăria.", ru: "Оператор телефонии (SIP/транк) с молдавским номером и договором с Примэрией." })}</li>
          <li>{t({ ro: "Recunoaștere vocală RO/RU (ex. Whisper auto-găzduit) și sinteză vocală; datele vocale nu trebuie trimise extern fără temei legal.", ru: "Распознавание речи RO/RU (напр. самостоятельно размещённый Whisper) и синтез речи; голосовые данные нельзя передавать наружу без правового основания." })}</li>
          <li>{t({ ro: "Transfer către operatori umani când dovezile lipsesc sau apelantul cere.", ru: "Перевод на операторов, когда доказательств нет или звонящий просит." })}</li>
          <li>{t({ ro: "Integrare oficială de sesizări (adaptorul MunicipalSubmissionAdapter din cod).", ru: "Официальная интеграция обращений (адаптер MunicipalSubmissionAdapter в коде)." })}</li>
        </ul>
      </section>
    </div>
  );
}
