import type { L10n } from "../corpus/types";

export type CategoryId = "roads" | "lighting" | "waste" | "greenery" | "water" | "other";

export const CATEGORIES: { id: CategoryId; label: L10n; icon: string; cues: string[] }[] = [
  { id: "roads", label: { ro: "Drum, trotuar, groapă", ru: "Дорога, тротуар, яма" }, icon: "🛣", cues: ["groapa", "gropi", "asfalt", "drum", "trotuar", "bordur", "strada", "яма", "ямы", "асфальт", "дорог", "тротуар", "бордюр"] },
  { id: "lighting", label: { ro: "Iluminat stradal", ru: "Уличное освещение" }, icon: "💡", cues: ["bec", "felinar", "iluminat", "lumina", "intuneric", "stalp", "фонар", "освещ", "свет", "темно", "столб"] },
  { id: "waste", label: { ro: "Deșeuri, gunoi", ru: "Мусор, отходы" }, icon: "🗑", cues: ["gunoi", "deseu", "tomberon", "container", "murdar", "мусор", "отход", "бак", "контейнер", "грязн", "свалк"] },
  { id: "greenery", label: { ro: "Arbori, spații verzi", ru: "Деревья, зелёные зоны" }, icon: "🌳", cues: ["copac", "arbor", "craca", "crengi", "iarba", "parc", "scuar", "дерев", "ветк", "трав", "парк", "сквер"] },
  { id: "water", label: { ro: "Apă, canalizare, scurgeri", ru: "Вода, канализация, утечки" }, icon: "💧", cues: ["apa", "teava", "scurgere", "canal", "inundat", "capac", "hidrant", "вода", "воды", "труб", "утечк", "канализ", "затоп", "люк"] },
  { id: "other", label: { ro: "Altceva", ru: "Другое" }, icon: "•", cues: [] },
];

export const SERVICES = [
  { id: "city", symbol: "⌂", label: { ro: "Primărie", ru: "Примэрия" }, hint: { ro: "Străzi, trotuare, iluminat", ru: "Дороги, тротуары, освещение" } },
  { id: "police", symbol: "◇", label: { ro: "Poliție", ru: "Полиция" }, hint: { ro: "Siguranță și ordine publică", ru: "Безопасность и порядок" } },
  { id: "hospital", symbol: "+", label: { ro: "Spital", ru: "Больница" }, hint: { ro: "Servicii și acces medical", ru: "Медицинские услуги и доступ" } },
  { id: "utilities", symbol: "≈", label: { ro: "Servicii comunale", ru: "Коммунальные службы" }, hint: { ro: "Apă, deșeuri, spații verzi", ru: "Вода, мусор, озеленение" } },
] as const;
export type ServiceId = typeof SERVICES[number]["id"];

export type TicketEventKind = "created_local" | "reviewed_by_user" | "deleted_media" | "marked_done" | "reopened";

export interface TicketMedia {
  kind: "photo" | "video" | "audio";
  file: string;
  mime: string;
  bytes: number;
}

export interface Ticket {
  id: string;
  createdAt: string;
  channel: "web" | "phone-demo";
  lang: "ro" | "ru";
  category: CategoryId;
  title?: string;
  recipient?: import("./recipients").RecipientId;
  links?: string[];
  authorityProgress?: { receivedAt?: string; onWayAt?: string; resolvedAt?: string };
  service?: ServiceId;
  transcript?: string;
  city?: string;
  status?: "active" | "done";
  categorySuggested: CategoryId | null;
  categoryChangedByUser: boolean;
  description: string;
  descriptionSuggested: string | null;
  location: { text: string; lat?: number; lng?: number; source: "manual" | "device" | "photo" };
  media: TicketMedia[];
  contactConsent: false;
  submission: { adapter: string; submitted: boolean; externalId: null; note: string };
  events: { at: string; kind: TicketEventKind }[];
}
