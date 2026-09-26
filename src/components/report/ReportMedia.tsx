"use client";
import { useEffect, useState } from "react";

export function ReportMedia({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(file);
    // Object URLs belong to this mounted preview only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  if (!url) return null;
  if (file.type.startsWith("audio/")) return <audio controls src={url} aria-label={file.name} />;
  if (file.type.startsWith("video/")) return <video controls src={url} aria-label={file.name} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={file.name} />;
}
