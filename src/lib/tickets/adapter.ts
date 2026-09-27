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

/** Persists a ticket in this server's JSON collection; no external institution is connected. */
export const localDemoAdapter: MunicipalSubmissionAdapter = {
  id: "server-json",
  official: false,
  destination: {
    ro: "Pe serverul aplicației (.data/tickets.json). Nimic nu este trimis Primăriei.",
    ru: "На сервере приложения (.data/tickets.json). В Примэрию ничего не отправляется.",
  },
  async submit() {
    return { submitted: false, externalId: null, note: "server-json: not submitted to City Hall" };
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
