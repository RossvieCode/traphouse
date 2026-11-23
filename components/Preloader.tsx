"use client";

import { useEffect, useState } from "react";
import { SHOP_NAME, asset } from "@/lib/config";
import { useProducts } from "./Store";

/**
 * First-load screen: the logo on white with a thin loading bar, until the
 * products are in; then it lifts away. It's in the page's HTML, so it shows
 * before any script runs. If scripts never run, CSS hides it after a few
 * seconds (.preloader). Client-side page changes never show it again.
 */
export default function Preloader() {
  const { status } = useProducts();
  const [phase, setPhase] = useState<"on" | "leaving" | "gone">("on");

  useEffect(() => {
    if (status === "ready") setPhase((p) => (p === "on" ? "leaving" : p));
  }, [status]);
  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("gone"), 750);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div className={`preloader fixed inset-0 z-100 grid place-items-center bg-white ${phase === "leaving" ? "preloader-out" : ""}`} aria-busy={phase === "on"}>
      <p className="sr-only" role="status">
        Loading {SHOP_NAME}…
      </p>
      <div className="preloader-mark flex flex-col items-center" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("logo.png")} alt="" width={96} height={96} className="preloader-logo" />
        <span className="mt-5 block h-px w-28 overflow-hidden bg-line">
          <span className="preloader-bar block h-full w-1/3 bg-fg" />
        </span>
        <span className="label mt-3 tracking-[0.24em] text-muted">Kigali</span>
      </div>
    </div>
  );
}
