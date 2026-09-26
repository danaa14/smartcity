import type { AnswerStatus } from "../answer/types";
import type { L10n } from "./types";

/** Example questions, each tied to what the corpus can actually answer. */
export const EXAMPLES: { id: string; q: L10n; expected: AnswerStatus; demo?: boolean }[] = [
  { id: "water-docs", expected: "supported", q: { ro: "Ce acte îmi trebuie pentru contractul de apă la apartament?", ru: "Какие документы нужны для договора на воду в квартире?" } },
  { id: "petition", expected: "supported", q: { ro: "Cum depun o petiție la primărie?", ru: "Как подать петицию в примэрию?" } },
  { id: "water-tariff", expected: "supported", q: { ro: "Cât costă apa potabilă?", ru: "Сколько стоит питьевая вода?" } },
  { id: "trees", expected: "supported", q: { ro: "Vreau să cer tăierea unui copac din curtea blocului", ru: "Хочу попросить спилить дерево во дворе дома" } },
  { id: "partial", expected: "partial", q: { ro: "Cât costă și în cât timp se încheie contractul de apă?", ru: "Сколько стоит и за какой срок заключают договор на воду?" } },
  { id: "petition-time", expected: "partial", q: { ro: "În cât timp răspunde primăria la o petiție?", ru: "За какой срок примэрия отвечает на петицию?" } },
  { id: "missing", expected: "missing", q: { ro: "Cum înscriu copilul la grădiniță?", ru: "Как записать ребёнка в детский сад?" } },
  { id: "conflict", expected: "contradiction", demo: true, q: { ro: "Cu câte zile înainte depun cererea pentru terasă sezonieră?", ru: "За сколько дней подавать заявку на сезонную террасу?" } },
  { id: "waste", expected: "supported", q: { ro: "Cât costă evacuarea gunoiului la casă?", ru: "Сколько стоит вывоз мусора для частного дома?" } },
];
