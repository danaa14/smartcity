"use client";
import { useEffect, useState } from "react";
import { useLang } from "../LangProvider";

export function ReportMedia({ file }: { file: File }) {
  const { t } = useLang();
  const [url, setUrl] = useState("");
  const [previewErrorFor, setPreviewErrorFor] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(file);
    // Object URLs belong to this mounted preview only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  if (!url) return null;
  if (previewErrorFor === url) return <span role="status">{t({ ro: "Previzualizarea nu este disponibilă pentru acest fișier.", ru: "Предпросмотр этого файла недоступен." })}</span>;
  if (file.type.startsWith("audio/")) return <audio controls src={url} aria-label={file.name} />;
  if (file.type.startsWith("video/")) return <video controls src={url} aria-label={file.name} onError={() => setPreviewErrorFor(url)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={file.name} style={{ imageOrientation: "from-image" }} onError={() => setPreviewErrorFor(url)} />;
}
