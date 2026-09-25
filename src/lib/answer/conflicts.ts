import { FACT_BY_ID } from "../corpus/facts";
import { PASSAGE_BY_ID } from "../corpus/passages";
import type { Claim, Conflict } from "./types";

/**
 * Groups claims that answer the same question (conflictGroup) with different values from
 * different documents. We deliberately do not infer which one prevails.
 */
export function detectConflicts(claims: Claim[]): Conflict[] {
  const groups = new Map<string, Conflict["sides"]>();
  for (const c of claims) {
    const f = FACT_BY_ID.get(c.id);
    if (!f?.conflictGroup || !f.conflictValue) continue;
    const pid = c.citations[0].passageId;
    const side = { claimId: c.id, value: f.conflictValue, passageId: pid, docId: PASSAGE_BY_ID.get(pid)!.docId };
    groups.set(f.conflictGroup, [...(groups.get(f.conflictGroup) ?? []), side]);
  }
  const out: Conflict[] = [];
  for (const [group, sides] of groups) {
    const values = new Set(sides.map((s) => s.value));
    const docs = new Set(sides.map((s) => s.docId));
    if (values.size > 1 && docs.size > 1)
      out.push({
        group,
        sides,
        explanation: {
          ro: `Sursele indică valori diferite (${[...values].join(" vs. ")}). Diferă atât numărul, cât și tipul zilelor (calendaristice vs. lucrătoare). Un document mai nou nu înlocuiește automat un regulament mai vechi; statutul și prioritatea nu sunt stabilite în corpus. Cazul a fost trimis spre verificare umană.`,
          ru: `Источники указывают разные значения (${[...values].join(" vs. ")}). Различаются и число, и тип дней (календарные vs. рабочие). Более новый документ не отменяет автоматически старый регламент; статус и приоритет в корпусе не установлены. Случай передан на проверку человеку.`,
        },
      });
  }
  return out;
}
