"use client";

// Hooks do TanStack Query (§9.1). Modo ao vivo → polling a cada 2 s.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { CadastroInvestidor, Canal, Id } from "./api-types";

export const INTERVALO_AO_VIVO_MS = 2000;

export const chaves = {
  fila: ["fila"] as const,
  painel: ["painel"] as const,
  clientes: ["clientes"] as const,
  demoEstado: ["demo", "estado"] as const,
  visao360: (id: Id) => ["360", id] as const,
  briefing: (id: Id) => ["briefing", id] as const,
  convites: ["convites"] as const,
  formularioOnboarding: (token: string) => ["onboarding", token] as const,
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

export function useBriefing(id: Id, o?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chaves.briefing(id),
    queryFn: () => api.briefing(id),
    enabled: o?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMensagem() {
  return useMutation({
    mutationFn: ({ clienteId, acaoId, canal }: { clienteId: Id; acaoId: Id; canal: Canal }) =>
      api.mensagem(clienteId, acaoId, canal),
  });
}

// ---------- Onboarding ----------

/** Lista de convites do assessor; com polling para ver o investidor abrindo/concluindo. */
export function useConvites(o?: { intervaloMs?: number }) {
  return useQuery({
    queryKey: chaves.convites,
    queryFn: () => api.convites(),
    // Com erro (ex.: backend sem o endpoint), para de bater a cada intervalo.
    refetchInterval: (q) => (q.state.status === "error" ? false : (o?.intervaloMs ?? false)),
  });
}

export function useCriarConvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => api.criarConvite(nome),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.convites }),
  });
}

export function useFormularioOnboarding(token: string) {
  return useQuery({
    queryKey: chaves.formularioOnboarding(token),
    queryFn: () => api.formularioOnboarding(token),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useConcluirOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ token, cadastro }: { token: string; cadastro: CadastroInvestidor }) =>
      api.concluirOnboarding(token, cadastro),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: chaves.convites }),
        qc.invalidateQueries({ queryKey: chaves.clientes }),
        qc.invalidateQueries({ queryKey: chaves.fila }),
        qc.invalidateQueries({ queryKey: chaves.painel }),
      ]),
  });
}
