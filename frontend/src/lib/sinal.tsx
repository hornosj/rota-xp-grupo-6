"use client";

// Atualizar pelo clique: depois de uma ação (enviar/confirmar convite, conceder, resetar...), avisa todas as
// telas abertas (outras abas inclusive) para buscarem os dados de novo na hora. O polling vira
// só rede de segurança. Consultas de IA (briefing) nunca refazem sozinhas: gastam crédito.
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

const CANAL = "copiloto-dados";
const AVISO = { tipo: "dados-alterados" } as const;

function abrirCanal(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CANAL);
}

/** Avisa as outras telas/iframes que os dados mudaram. */
export function avisarDadosAlterados() {
  const canal = abrirCanal();
  if (!canal) return;
  canal.postMessage(AVISO);
  canal.close();
}

/** Escuta os avisos (de outras telas e desta). Devolve a função para parar de ouvir. */
export function ouvirDadosAlterados(aoAlterar: () => void): () => void {
  const canal = abrirCanal();
  if (!canal) return () => {};
  canal.onmessage = (e: MessageEvent) => {
    if ((e.data as { tipo?: string } | null)?.tipo === AVISO.tipo) aoAlterar();
  };
  return () => canal.close();
}

/** Consultas que chamam o LLM: nunca são refeitas por polling, aviso ou invalidação automática. */
export function ehChaveDeIa(chave: QueryKey): boolean {
  return chave[0] === "briefing";
}

/** Invalida tudo que é dado (barato); deixa as respostas de IA como estão. */
export function invalidarDados(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => !ehChaveDeIa(q.queryKey) });
}

/** Montado uma vez no Providers: ao receber o aviso, atualiza os dados desta tela. */
export function SincronizarDados() {
  const qc = useQueryClient();
  useEffect(() => ouvirDadosAlterados(() => void invalidarDados(qc)), [qc]);
  return null;
}
