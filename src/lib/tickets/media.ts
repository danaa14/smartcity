const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
};

export function mediaMime(file: Pick<File, "name" | "type">): string {
  const mime = file.type.toLowerCase().split(";")[0];
  if (mime === "image/jpg") return "image/jpeg";
  if (["image/heic-sequence", "image/heif-sequence"].includes(mime)) return mime.replace("-sequence", "");
  const byExtension = EXTENSION_MIME[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
  return !mime || mime === "application/octet-stream" ? byExtension : mime;
}

export function isHeif(file: Pick<File, "name" | "type">): boolean {
  const mime = mediaMime(file);
  return mime === "image/heic" || mime === "image/heif";
}

/** Converts HEIC/HEIF only, locally, when this browser can decode it. */
export async function normalizeMobileMedia(file: File): Promise<File> {
  if (!isHeif(file)) {
    const mime = mediaMime(file);
    if (!mime) throw new Error("unsupported_type");
    return mime === file.type ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified });
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("heif_conversion_failed");
      context.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("heif_conversion_failed");
      return new File([blob], `${file.name.replace(/\.(heic|heif)$/i, "")}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
    } finally {
      bitmap.close();
    }
  } catch {
    throw new Error("heif_unsupported");
  }
}
