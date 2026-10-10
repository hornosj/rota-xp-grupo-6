"use client";

import { useSearchParams } from "next/navigation";

/** Modo ao vivo: `?aoVivo=1` na URL. Liga o polling lento de segurança; o normal é atualizar pelo clique. */
export function useAoVivo(): boolean {
  const sp = useSearchParams();
  const v = sp.get("aoVivo");
  return v === "1" || v === "true";
}
