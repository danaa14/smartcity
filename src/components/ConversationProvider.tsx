"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { conversationRepository, type Conversation, type SavedTurn } from "@/lib/chat/types";

const Context = createContext<{
  items: Conversation[]; active: Conversation | null; revision: number; ready: boolean; error: boolean;
  select: (item: Conversation | null) => void; save: (turns: SavedTurn[]) => void;
}>({ items: [], active: null, revision: 0, ready: false, error: false, select: () => {}, save: () => {} });
export const useConversations = () => useContext(Context);

function Store({ ownerId, children }: { ownerId: string; children: React.ReactNode }) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const activeRef = useRef<Conversation | null>(null);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const previousOwner = useRef(ownerId);
  useEffect(() => {
    const from = previousOwner.current;
    previousOwner.current = ownerId;
    // A real account switch starts a fresh conversation, so nothing crosses between owners.
    // Resolving "loading" is not a switch: the conversation already under way carries over.
    if (from !== ownerId && from !== "loading") {
      activeRef.current = null;
      setActive(null);
      setItems([]);
      setRevision((n) => n + 1);
    }
    if (ownerId === "loading") return;
    const load = () => { try { setItems(conversationRepository.list(ownerId)); } catch { setError(true); } setReady(true); };
    load(); window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [ownerId]);
  const select = useCallback((item: Conversation | null) => { activeRef.current = item; setActive(item); setRevision((n) => n + 1); }, []);
  const save = useCallback((turns: SavedTurn[]) => {
    if (!turns.length) return;
    const previous = activeRef.current;
    if (previous && previous.ownerId === ownerId && JSON.stringify(previous.turns) === JSON.stringify(turns)) return;
    {
      const first = turns[0];
      const conversation: Conversation = { version: 1, id: previous?.id ?? crypto.randomUUID(), ownerId, title: (first.kind === "ask" ? first.question : first.name).slice(0, 100), updatedAt: new Date().toISOString(), turns };
      // Until the session resolves the owner is unknown: keep the turns in memory only. `save`
      // changes identity when the owner resolves, so the chat saves again under the real owner.
      if (ownerId !== "loading") {
        try { conversationRepository.save(conversation); setItems(conversationRepository.list(ownerId)); setError(false); } catch { setError(true); }
      }
      activeRef.current = conversation;
      setActive(conversation);
    }
  }, [ownerId]);
  return <Context.Provider value={{ items, active, revision, ready, error, select, save }}>{children}</Context.Provider>;
}
function AccountStore({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession();
  const owner = status === "loading" ? "loading" : data?.user?.id ? `google:${data.user.id}` : "guest";
  // Not keyed by owner: remounting here would restart every page (and cancel an in-flight
  // question) the moment the session check finishes.
  return <Store ownerId={owner}>{children}</Store>;
}
export function ConversationProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider><AccountStore>{children}</AccountStore></SessionProvider>;
}
