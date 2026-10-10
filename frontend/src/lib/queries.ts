"use client";

// Hooks do TanStack Query (§9.1). Modo ao vivo → polling a cada 2 s.
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Canal, Id } from "./api-types";

export const INTERVALO_AO_VIVO_MS = 2000;

export const chaves = {
  fila: ["fila"] as const,
  painel: ["painel"] as const,
  clientes: ["clientes"] as const,
  demoEstado: ["demo", "estado"] as const,
  visao360: (id: Id) => ["360", id] as const,
  jornada: (id: Id) => ["jornada", id] as const,
  consentimentos: (id: Id) => ["consentimentos", id] as const,
  briefing: (id: Id) => ["briefing", id] as const,
  /** Prefixo de todas as consultas do radar de notícias. */
  radar: ["radar"] as const,
  noticiasRadar: ["radar", "noticias"] as const,
  /** Prefixo; a consulta usa [...radarCarteira, limite]. */
  radarCarteira: ["radar", "carteira"] as const,
  radarCliente: (id: Id) => ["radar", "cliente", id] as const,
};

interface OpcoesAoVivo {
  aoVivo?: boolean;
}

const intervalo = (o?: OpcoesAoVivo) => (o?.aoVivo ? INTERVALO_AO_VIVO_MS : false);

export function useFila(o?: OpcoesAoVivo) {
  return useQuery({ queryKey: chaves.fila, queryFn: () => api.fila(), refetchInterval: intervalo(o) });
}

export function usePainel(o?: OpcoesAoVivo) {
  return useQuery({ queryKey: chaves.painel, queryFn: () => api.painel(), refetchInterval: intervalo(o) });
}

export function useClientes() {
  return useQuery({ queryKey: chaves.clientes, queryFn: () => api.listarClientes() });
}

export function useDemoEstado() {
  return useQuery({ queryKey: chaves.demoEstado, queryFn: () => api.demoEstado(), staleTime: Infinity, retry: false });
}

export function useVisao360(id: Id, o?: OpcoesAoVivo) {
  return useQuery({ queryKey: chaves.visao360(id), queryFn: () => api.visao360(id), refetchInterval: intervalo(o) });
}

export function useJornada(id: Id, o?: OpcoesAoVivo) {
  return useQuery({ queryKey: chaves.jornada(id), queryFn: () => api.jornada(id), refetchInterval: intervalo(o) });
}

export function useConsentimentos(id: Id, o?: OpcoesAoVivo) {
  return useQuery({
    queryKey: chaves.consentimentos(id),
    queryFn: () => api.consentimentos(id),
    refetchInterval: intervalo(o),
  });
}

export function useBriefing(id: Id, o?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chaves.briefing(id),
    queryFn: () => api.briefing(id),
    enabled: o?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------- Radar de notícias ----------

export function useNoticiasRadar() {
  return useQuery({ queryKey: chaves.noticiasRadar, queryFn: () => api.noticiasRadar() });
}

export function useRadarCarteira(limite = 20, o?: OpcoesAoVivo) {
  return useQuery({
    queryKey: [...chaves.radarCarteira, limite],
    queryFn: () => api.radarCarteira(limite),
    refetchInterval: intervalo(o),
  });
}

export function useRadarCliente(id: Id, o?: OpcoesAoVivo) {
  return useQuery({
    queryKey: chaves.radarCliente(id),
    queryFn: () => api.radarCliente(id),
    refetchInterval: intervalo(o),
  });
}

/** Processamento pontual (coleta + classificação das novas); depois recarrega tudo do radar. */
export function useProcessarRadar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.processarRadar(),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.radar }),
  });
}

/** Texto para o assessor: por que ligar por causa desta notícia. */
export function useMotivoNoticia() {
  return useMutation({
    mutationFn: ({ clienteId, noticiaId }: { clienteId: Id; noticiaId: Id }) => api.motivoNoticia(clienteId, noticiaId),
  });
}

function invalidarCliente(qc: QueryClient, clienteId: Id) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: chaves.fila }),
    qc.invalidateQueries({ queryKey: chaves.painel }),
    qc.invalidateQueries({ queryKey: chaves.clientes }),
    qc.invalidateQueries({ queryKey: chaves.visao360(clienteId) }),
    qc.invalidateQueries({ queryKey: chaves.jornada(clienteId) }),
    qc.invalidateQueries({ queryKey: chaves.consentimentos(clienteId) }),
    qc.invalidateQueries({ queryKey: chaves.briefing(clienteId) }),
    // consentimento muda a carteira visível → muda o que as notícias tocam
    qc.invalidateQueries({ queryKey: chaves.radarCliente(clienteId) }),
    qc.invalidateQueries({ queryKey: chaves.radarCarteira }),
  ]);
}

interface VarsConsentimento {
  clienteId: Id;
  instituicaoId: Id;
}

/** Conceder (409 = já ativo é tratado como sucesso em lib/api). */
export function useConceder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, instituicaoId }: VarsConsentimento) => api.conceder(clienteId, instituicaoId),
    onSuccess: async (visao, { clienteId }) => {
      qc.setQueryData(chaves.visao360(clienteId), visao);
      await invalidarCliente(qc, clienteId);
    },
  });
}

export function useRevogar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, instituicaoId }: VarsConsentimento) => api.revogar(clienteId, instituicaoId),
    onSuccess: async (visao, { clienteId }) => {
      qc.setQueryData(chaves.visao360(clienteId), visao);
      await invalidarCliente(qc, clienteId);
    },
  });
}

export function useMensagem() {
  return useMutation({
    mutationFn: ({ clienteId, acaoId, canal }: { clienteId: Id; acaoId: Id; canal: Canal }) =>
      api.mensagem(clienteId, acaoId, canal),
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetDemo(),
    onSuccess: () => qc.invalidateQueries(),
  });
}
