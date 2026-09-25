import Link from "next/link";
import { getLang } from "@/lib/i18n/server";
import { UI, tr, fmtDate } from "@/lib/i18n";
import { DOCS } from "@/lib/corpus/docs";
import { EXAMPLES } from "@/lib/corpus/examples";

export default async function Home() {
  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const real = DOCS.filter((d) => d.kind === "real");
  const orgs = new Set(real.map((d) => d.publisher.replace(/\s*\(.*\)$/, "")));

  const tasks = [
    { href: "/raporteaza", icon: "!", title: UI.nav.report, desc: { ro: "Groapă, bec ars, gunoi, copac căzut — foto, voce sau text. Primiți un număr de tichet (demo local).", ru: "Яма, сгоревший фонарь, мусор, упавшее дерево — фото, голос или текст. Номер заявки (локальное демо)." } },
    { href: "/scaneaza", icon: "▣", title: UI.nav.scan, desc: { ro: "Încărcați o cerere: vedeți textul recunoscut, câmpurile goale și ce spun sursele.", ru: "Загрузите заявление: распознанный текст, пустые поля и что говорят источники." } },
    { href: "/suna", icon: "☏", title: UI.nav.call, desc: { ro: "Cum ar funcționa același asistent la telefon (demonstrație de concept).", ru: "Как тот же помощник работал бы по телефону (демонстрация концепции)." } },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="ask-h" className="card p-4 sm:p-6">
        <h1 id="ask-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t({ ro: "Ce vreți să aflați de la primărie?", ru: "Что вы хотите узнать у примэрии?" })}
        </h1>
        <p className="mt-1 text-muted">{t(UI.promise)}</p>
        <form action="/intreaba" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="home-q" className="sr-only">
            {t({ ro: "Întrebarea dvs.", ru: "Ваш вопрос" })}
          </label>
          <input
            id="home-q"
            name="q"
            required
            maxLength={500}
            className="input text-lg"
            placeholder={t({ ro: "ex.: Ce acte trebuie pentru contractul de apă?", ru: "напр.: Какие документы нужны для договора на воду?" })}
          />
          <button className="btn btn-primary px-6 text-lg">{t({ ro: "Întreabă", ru: "Спросить" })}</button>
        </form>
        <p className="mt-3 text-sm font-semibold">{t({ ro: "Sau alegeți o întrebare:", ru: "Или выберите вопрос:" })}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.slice(0, 4).map((e) => (
            <li key={e.id}>
              <Link href={`/intreaba?q=${encodeURIComponent(e.q[lang])}`} className="inline-block rounded-full border border-brand bg-white px-3 py-1.5 text-sm text-brand hover:bg-brand-soft">
                {e.q[lang]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tasks-h">
        <h2 id="tasks-h" className="sr-only">{t({ ro: "Alte acțiuni", ru: "Другие действия" })}</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {tasks.map((x) => (
            <li key={x.href}>
              <Link href={x.href} className="card flex h-full gap-3 p-4 hover:border-brand hover:bg-brand-soft">
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-white">{x.icon}</span>
                <span>
                  <span className="block font-bold text-brand-dark">{t(x.title)}</span>
                  <span className="block text-sm text-muted">{t(x.desc)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-h" className="grid gap-3 md:grid-cols-3">
        <h2 id="how-h" className="sr-only">{t({ ro: "Cum funcționează", ru: "Как это работает" })}</h2>
        {[
          { title: { ro: "Radiografia răspunsului", ru: "Рентген ответа" }, body: { ro: "Fiecare afirmație are un marcaj [1]. Apăsați-l și vedeți pasajul exact din documentul oficial, evidențiat.", ru: "У каждого утверждения есть метка [1]. Нажмите — и увидите точный фрагмент официального документа с выделением." } },
          { title: { ro: "GPS birocratic", ru: "Бюрократический GPS" }, body: { ro: "Răspunsul devine un traseu de pași, iar fiecare pas are propria dovadă.", ru: "Ответ превращается в маршрут шагов, и у каждого шага — своё доказательство." } },
          { title: { ro: "Bucla de reparare", ru: "Петля исправления" }, body: { ro: "Ce lipsește sau se contrazice în surse ajunge într-o listă de verificare pentru angajați.", ru: "То, чего нет или что противоречит в источниках, попадает в список проверки для сотрудников." } },
        ].map((c) => (
          <div key={c.title.ro} className="rounded-xl border border-line bg-white/60 p-4">
            <h3 className="font-bold">{t(c.title)}</h3>
            <p className="text-sm text-muted">{t(c.body)}</p>
          </div>
        ))}
      </section>

      <p className="text-sm text-muted">
        {t({ ro: "Acoperire:", ru: "Охват:" })} {real.length} {t({ ro: "pagini/documente reale de la", ru: "реальных страниц/документов от" })} {orgs.size}{" "}
        {t({ ro: "instituții, preluate la", ru: "учреждений, получены" })} {fmtDate("2026-09-25", lang)}, {t({ ro: "plus 2 documente DEMO fictive.", ru: "плюс 2 вымышленных DEMO-документа." })}{" "}
        <Link href="/despre#acoperire" className="link">{t({ ro: "Ce acoperim și ce nu", ru: "Что охвачено, а что нет" })}</Link>
      </p>
    </div>
  );
}
