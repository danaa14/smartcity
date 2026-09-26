import type { Ticket } from "./types";

/**
 * Boundary to a future official submission channel. The UI only ever talks to
 * `getSubmissionAdapter()`, so a real integration can be swapped in without UI changes.
 */
export interface SubmissionResult {
  submitted: boolean;
  externalId: string | null;
  note: string;
}

export interface MunicipalSubmissionAdapter {
  readonly id: string;
  readonly official: boolean;
  /** Human-readable destination; shown to the user before they confirm. */
  readonly destination: { ro: string; ru: string };
  submit(ticket: Ticket): Promise<SubmissionResult>;
  status?(externalId: string): Promise<{ state: string; at: string } | null>;
}

/** Stores locally and sends nothing. The only adapter shipped with the prototype. */
export const localDemoAdapter: MunicipalSubmissionAdapter = {
  id: "local-demo",
  official: false,
  destination: {
    ro: "Doar pe acest computer (fișier local .data/tickets.json). Nimic nu este trimis Primăriei.",
    ru: "Только на этом компьютере (локальный файл .data/tickets.json). В Примэрию ничего не отправляется.",
  },
  async submit() {
    return { submitted: false, externalId: null, note: "local-demo: not submitted to City Hall" };
  },
};

/**
 * Placeholder showing the shape of a real integration (e.g. the public "Sesizează" portal
 * linked from chisinau.md). Not implemented: no public API for it was identified.
 */
export const officialPortalAdapterStub: MunicipalSubmissionAdapter = {
  id: "official-portal-stub",
  official: true,
  destination: { ro: "Neimplementat", ru: "Не реализовано" },
  async submit() {
    throw new Error("Official submission is not implemented in this prototype.");
  },
};

export function getSubmissionAdapter(): MunicipalSubmissionAdapter {
  return localDemoAdapter;
}
