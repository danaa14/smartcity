export const RECIPIENTS = [
  { id: "city_hall", icon: "⌂", label: { ro: "Primărie", ru: "Примэрия" }, detail: { ro: "Străzi, iluminat, spații publice", ru: "Дороги, освещение, городские пространства" } },
  { id: "police", icon: "◇", label: { ro: "Poliție", ru: "Полиция" }, detail: { ro: "Siguranță și ordine publică", ru: "Безопасность и общественный порядок" } },
  { id: "hospital", icon: "+", label: { ro: "Spital", ru: "Больница" }, detail: { ro: "Probleme ale serviciilor medicale", ru: "Проблемы медицинских услуг" } },
  { id: "utilities", icon: "≈", label: { ro: "Servicii comunale", ru: "Коммунальные службы" }, detail: { ro: "Apă, canalizare, salubritate", ru: "Вода, канализация, уборка" } },
  { id: "transport", icon: "↔", label: { ro: "Transport public", ru: "Общественный транспорт" }, detail: { ro: "Stații și transport în oraș", ru: "Остановки и городской транспорт" } },
  { id: "other", icon: "···", label: { ro: "Nu sunt sigur", ru: "Не уверен(а)" }, detail: { ro: "Aleg destinatarul mai târziu", ru: "Выберу получателя позже" } },
] as const;
export type RecipientId = typeof RECIPIENTS[number]["id"];
