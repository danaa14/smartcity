import { FACT_BY_ID } from "../corpus/facts";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import type { Fact, Passage } from "../corpus/types";

export interface EvidenceItem {
  fact: Fact;
  cites: { quote: string; passage: Passage; doc: { id: string; title: string; url: string | null; publisher: string; kind: "real" | "demo"; retrievedAt: string } }[];
}

export function evidenceFor(factIds: string[]): Record<string, EvidenceItem> {
  return Object.fromEntries(
    factIds.map((id) => {
      const f = FACT_BY_ID.get(id)!;
      return [
        id,
        {
          fact: f,
          cites: f.cites.map((c) => {
            const p = PASSAGE_BY_ID.get(c.passageId)!;
            const d = DOC_BY_ID.get(p.docId)!;
            return { quote: c.quote, passage: p, doc: { id: d.id, title: d.title, url: d.url, publisher: d.publisher, kind: d.kind, retrievedAt: d.retrievedAt } };
          }),
        },
      ];
    }),
  );
}
