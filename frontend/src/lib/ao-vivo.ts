"use client";

import { useSearchParams } from "next/navigation";

/** Modo ao vivo: `?aoVivo=1` na URL (usado pelo /palco). Liga o polling de 2 s. */
export function useAoVivo(): boolean {
  const sp = useSearchParams();
  const v = sp.get("aoVivo");
  return v === "1" || v === "true";
}
