import type { CSSProperties } from "react";

export type IconName = "chat" | "pin" | "plus" | "arrow" | "phone" | "close" | "chevron" | "document" | "source" | "help";

export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  const paths: Record<IconName, React.ReactNode> = {
    chat: <><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z" /><path d="M7 10h8M7 14h5" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M12 20V4m-7 7 7-7 7 7" />,
    phone: <path d="m8 3 3 5-3 3a17 17 0 0 0 5 5l3-3 5 3c0 3-2 5-5 5C9 20 4 15 3 8c0-3 2-5 5-5Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    document: <><path d="M14 3H5v18h14V8l-5-5Z" /><path d="M14 3v5h5M8 12h8M8 16h6" /></>,
    source: <><path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1ZM12 5v15" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 16h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}
