import type { Answer } from "@/lib/answer/types";
import type { DocContext } from "@/components/chat/DocumentTurn";

export type SavedTurn =
  | { kind: "ask"; id: number; question: string; answer?: Answer; failed?: string | true }
  | { kind: "doc"; id: number; name: string; goal: string; ctx: DocContext };
export interface Conversation {
  version: 1;
  id: string;
  ownerId: string;
  title: string;
  updatedAt: string;
  turns: SavedTurn[];
}
/** Replace this adapter with an authenticated API; derive ownership from the server session. */
export interface ConversationRepository {
  list(ownerId: string): Conversation[];
  save(conversation: Conversation): void;
}
export const conversationRepository: ConversationRepository = {
  list(ownerId) {
    const raw = localStorage.getItem(`pefir:conversations:v1:${ownerId}`);
    if (!raw) return [];
    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items)) throw new Error("Invalid history");
    return items.filter((item): item is Conversation => item?.version === 1 && item.ownerId === ownerId && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.turns));
  },
  save(conversation) {
    const items = this.list(conversation.ownerId).filter((item) => item.id !== conversation.id);
    localStorage.setItem(`pefir:conversations:v1:${conversation.ownerId}`, JSON.stringify([conversation, ...items].slice(0, 50)));
  },
};
