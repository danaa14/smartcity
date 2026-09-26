"use client";

import { useState } from "react";
import { useLang } from "../LangProvider";
import { API, COMMON, PRICES_CHECKED_AT, SELF, computeApi, computeSelf, toMap, type Param } from "@/lib/budget";

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : 0 })}`;

export function BudgetCalculator() {
  const { lang, t } = useLang();
  const [c, setC] = useState(toMap(COMMON));
  const [a, setA] = useState(toMap(API));
  const [s, setS] = useState(toMap(SELF));
  const api = computeApi(c, a);
  const self = computeSelf(s);

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4" aria-labelledby="bc-common">
        <h3 id="bc-common" className="font-bold">{t({ ro: "Ipoteze comune (modificabile)", ru: "Общие допущения (можно менять)" })}</h3>
        <Inputs params={COMMON} values={c} set={setC} prefix="c" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4" aria-labelledby="bc-api">
          <h3 id="bc-api" className="text-lg font-bold">A. {t({ ro: "API extern (Claude Haiku 4.5)", ru: "Внешний API (Claude Haiku 4.5)" })}</h3>
          <p className="text-sm text-muted">
            <strong>{t({ ro: "Unde rulează:", ru: "Где работает:" })}</strong>{" "}
            {t({ ro: "Modelul — infrastructura Anthropic (rutare globală implicit; opțiunea doar-SUA costă 1,1×). Aplicația, baza de date și fișierele — un centru de date UE sau din Moldova. Textul întrebărilor și pasajele ajung la furnizor; fotografiile și documentele NU trebuie trimise.", ru: "Модель — инфраструктура Anthropic (глобальная маршрутизация по умолчанию; только США — 1,1×). Приложение, БД и файлы — ЦОД в ЕС или Молдове. Текст вопросов и фрагменты уходят провайдеру; фото и документы отправлять НЕ нужно." })}
          </p>
          <Inputs params={API} values={a} set={setA} prefix="a" />
          <dl className="space-y-1 rounded-lg bg-paper p-3 text-sm">
            <div className="flex justify-between"><dt>{t({ ro: "Inferență", ru: "Инференс" })}</dt><dd className="font-mono">{usd(api.inference)}</dd></div>
            <div className="flex justify-between"><dt>{t({ ro: "Găzduire aplicație + BD", ru: "Хостинг приложения + БД" })}</dt><dd className="font-mono">{usd(a.appHosting)}</dd></div>
            <div className="flex justify-between"><dt>{t({ ro: "Stocare", ru: "Хранилище" })}</dt><dd className="font-mono">{usd(a.storage)}</dd></div>
            <div className="flex justify-between"><dt>OCR ({c.ocrPages} {t({ ro: "pagini, Tesseract local", ru: "стр., локальный Tesseract" })})</dt><dd className="font-mono">$0</dd></div>
            <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><dt>{t({ ro: "Total aproximativ / lună", ru: "Итого примерно / мес." })}</dt><dd className="font-mono">{usd(api.total)}</dd></div>
          </dl>
          <p className="font-mono text-xs text-muted">
            ({(api.uncached / 1e6).toFixed(1)}M × ${a.inPrice}) + ({(api.cached / 1e6).toFixed(1)}M × ${a.cacheReadPrice}) + ({(api.out / 1e6).toFixed(1)}M × ${a.outPrice}) = {usd(api.inference)}
          </p>
        </section>

        <section className="card space-y-3 p-4" aria-labelledby="bc-self">
          <h3 id="bc-self" className="text-lg font-bold">B. {t({ ro: "Model auto-găzduit (open-weight)", ru: "Самостоятельно размещённая модель (open-weight)" })}</h3>
          <p className="text-sm text-muted">
            <strong>{t({ ro: "Unde rulează:", ru: "Где работает:" })}</strong>{" "}
            {t({ ro: "Totul într-un singur centru de date controlat de municipalitate sau furnizorul ei (UE sau Moldova). Nicio dată nu pleacă la un furnizor de AI. Prețul serverului GPU nu a putut fi verificat pe pagina oficială a furnizorului în această rulare.", ru: "Всё в одном ЦОД под контролем муниципалитета или его подрядчика (ЕС или Молдова). Данные не уходят к ИИ-провайдеру. Цену GPU-сервера не удалось проверить на официальной странице провайдера в этом прогоне." })}
          </p>
          <Inputs params={SELF} values={s} set={setS} prefix="s" />
          <dl className="space-y-1 rounded-lg bg-paper p-3 text-sm">
            <div className="flex justify-between"><dt>{t({ ro: "Server GPU (inferență)", ru: "GPU-сервер (инференс)" })}</dt><dd className="font-mono">{usd(self.inference)}</dd></div>
            <div className="flex justify-between"><dt>{t({ ro: "Găzduire aplicație + BD", ru: "Хостинг приложения + БД" })}</dt><dd className="font-mono">{usd(s.appHosting)}</dd></div>
            <div className="flex justify-between"><dt>{t({ ro: "Stocare", ru: "Хранилище" })}</dt><dd className="font-mono">{usd(s.storage)}</dd></div>
            <div className="flex justify-between"><dt>{t({ ro: "Mentenanță model", ru: "Обслуживание модели" })}</dt><dd className="font-mono">{usd(self.ops)}</dd></div>
            <div className="flex justify-between"><dt>OCR</dt><dd className="font-mono">$0</dd></div>
            <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><dt>{t({ ro: "Total aproximativ / lună", ru: "Итого примерно / мес." })}</dt><dd className="font-mono">{usd(self.total)}</dd></div>
          </dl>
          <p className="text-xs text-muted">{t({ ro: "Cost fix: nu depinde de numărul de întrebări până la limita de capacitate a unui GPU.", ru: "Фиксированная стоимость: не зависит от числа вопросов до предела мощности одного GPU." })}</p>
        </section>
      </div>

      <p role="status" className="rounded-lg border border-line bg-white p-3 text-sm">
        {api.total < self.total
          ? t({ ro: `La aceste ipoteze, API-ul extern este mai ieftin cu ~${usd(self.total - api.total)}/lună. Punctul de echilibru apare la volume mult mai mari sau când datele nu au voie să părăsească infrastructura proprie.`, ru: `При этих допущениях внешний API дешевле примерно на ${usd(self.total - api.total)}/мес. Точка равновесия — при гораздо больших объёмах или когда данные не могут покидать собственную инфраструктуру.` })
          : t({ ro: `La aceste ipoteze, varianta auto-găzduită este mai ieftină cu ~${usd(api.total - self.total)}/lună.`, ru: `При этих допущениях самостоятельное размещение дешевле примерно на ${usd(api.total - self.total)}/мес.` })}
      </p>
    </div>
  );
}

function Inputs({ params, values, set, prefix }: { params: Param[]; values: Record<string, number>; set: (v: Record<string, number>) => void; prefix: string }) {
const { lang, t } = useLang();
return (
  <div className="space-y-2">
    {params.map((p) => (
      <div key={p.key} className="grid grid-cols-[1fr_7.5rem] items-center gap-2">
        <label htmlFor={`${prefix}-${p.key}`} className="text-sm">
          {p.label[lang]}{" "}
          {p.verified ? (
            <a href={p.source} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-xs font-semibold text-ok underline">
              ✓ {t({ ro: "verificat", ru: "проверено" })} {PRICES_CHECKED_AT}
            </a>
          ) : (
            <span className="whitespace-nowrap text-xs font-semibold text-warn">{t({ ro: "ipoteză ilustrativă", ru: "иллюстративное допущение" })}</span>
          )}
        </label>
        <div className="flex items-center gap-1">
          <input
            id={`${prefix}-${p.key}`}
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={values[p.key]}
            onChange={(e) => set({ ...values, [p.key]: Math.max(0, Number(e.target.value) || 0) })}
            className="input px-2 py-1.5 text-right text-sm"
          />
          <span className="sr-only">{p.unit}</span>
        </div>
      </div>
    ))}
  </div>
);
}
