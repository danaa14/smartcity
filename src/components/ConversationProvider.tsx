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
  useEffect(() => {
    const load = () => { try { setItems(conversationRepository.list(ownerId)); } catch { setError(true); } setReady(true); };
    load(); window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [ownerId]);
  const select = useCallback((item: Conversation | null) => { activeRef.current = item; setActive(item); setRevision((n) => n + 1); }, []);
  const save = useCallback((turns: SavedTurn[]) => {
    if (!turns.length) return;
    const previous = activeRef.current;
    if (previous && JSON.stringify(previous.turns) === JSON.stringify(turns)) return;
    {
      const first = turns[0];
      const conversation: Conversation = { version: 1, id: previous?.id ?? crypto.randomUUID(), ownerId, title: (first.kind === "ask" ? first.question : first.name).slice(0, 100), updatedAt: new Date().toISOString(), turns };
      try { conversationRepository.save(conversation); setItems(conversationRepository.list(ownerId)); setError(false); } catch { setError(true); }
      activeRef.current = conversation;
      setActive(conversation);
    }
  }, [ownerId]);
  return <Context.Provider value={{ items, active, revision, ready, error, select, save }}>{children}</Context.Provider>;
}
function AccountStore({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession();
  const owner = status === "loading" ? "loading" : data?.user?.id ? `google:${data.user.id}` : "guest";
  return <Store key={owner} ownerId={owner}>{children}</Store>;
}
export function ConversationProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider><AccountStore>{children}</AccountStore></SessionProvider>;
}
