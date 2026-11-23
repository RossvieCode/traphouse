"use client";

import { useCallback, useState } from "react";
import { localPhoto, photo } from "@/lib/config";

/**
 * Product photo from Supabase Storage. If that fails, tries the copy in
 * public/images (photos imported from the old site), then shows a grey box.
 */
export default function Photo({
  file,
  alt,
  className = "",
  eager,
}: {
  file: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<{ file: string; tries: number }>({ file: "", tries: 0 });
  const [loaded, setLoaded] = useState("");
  const tries = failed.file === file ? failed.tries : 0;
  const src = [photo(file), localPhoto(file)].filter(Boolean)[tries] as string | undefined;
  // already in the browser cache: show it straight away, no fade
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth) setLoaded(img.currentSrc || img.src);
  }, []);
  if (!file || !src) return <span role="img" aria-label={alt || undefined} className={`block bg-soft ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      data-loading={loaded === src || loaded.endsWith(src) ? undefined : ""}
      onLoad={() => setLoaded(src)}
      onError={() => {
        if (tries) console.warn(`[products] photo not found: ${file}`);
        setFailed({ file, tries: tries + 1 });
      }}
      className={`photo ${className}`}
    />
  );
}
