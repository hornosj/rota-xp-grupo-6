"use client";

// Hooks do TanStack Query (§9.1). As telas atualizam pelo clique (lib/sinal); no modo ao vivo há um
// polling lento só como rede de segurança. Consultas de IA nunca refazem sozinhas.
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { CadastroInvestidor, Canal, EdicaoCadastro, Id, OrigemAnotacao } from "./api-types";
import { carregarNotificacoes } from "./notificacoes";
import { avisarDadosAlterados, invalidarDados } from "./sinal";

export const INTERVALO_AO_VIVO_MS = 15000;

export const chaves = {
  fila: ["fila"] as const,
  painel: ["painel"] as const,
  clientes: ["clientes"] as const,
  demoEstado: ["demo", "estado"] as const,
  visao360: (id: Id) => ["360", id] as const,
  consentimentos: (id: Id) => ["consentimentos", id] as const,
  briefing: (id: Id) => ["briefing", id] as const,
  /** Prefixo de todas as consultas do radar de notícias. */
  radar: ["radar"] as const,
  noticiasRadar: ["radar", "noticias"] as const,
  /** Prefixo; a consulta usa [...radarCarteira, limite]. */
  radarCarteira: ["radar", "carteira"] as const,
  radarCliente: (id: Id) => ["radar", "cliente", id] as const,
  convites: (id: Id) => ["convites", id] as const,
  convite: (token: string) => ["convite", token] as const,
  contextoAssessor: (id: Id) => ["contexto-assessor", id] as const,
  convitesOnboarding: ["convites-onboarding"] as const,
  formularioOnboarding: (token: string) => ["onboarding", token] as const,
  notificacoes: ["notificacoes"] as const,
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

export function useConsentimentos(id: Id, o?: OpcoesAoVivo) {
  return useQuery({
    queryKey: chaves.consentimentos(id),
    queryFn: () => api.consentimentos(id),
    refetchInterval: intervalo(o),
  });
}

/** Provisório: montado no front a partir de /clientes + /360 (ver lib/notificacoes). */
export function useNotificacoes(o?: OpcoesAoVivo) {
  return useQuery({
    queryKey: chaves.notificacoes,
    queryFn: () => carregarNotificacoes(api),
    refetchInterval: intervalo(o),
    staleTime: 30 * 1000,
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chaves.radar });
      avisarDadosAlterados();
    },
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
    qc.invalidateQueries({ queryKey: chaves.notificacoes }),
    qc.invalidateQueries({ queryKey: chaves.visao360(clienteId) }),
    qc.invalidateQueries({ queryKey: chaves.consentimentos(clienteId) }),
    // consentimento muda a carteira visível → muda o que as notícias tocam
    qc.invalidateQueries({ queryKey: chaves.radarCliente(clienteId) }),
    qc.invalidateQueries({ queryKey: chaves.radarCarteira }),
  ]);
}

// ---------- Convites de consentimento ----------

export function useConvites(id: Id, o?: OpcoesAoVivo & { enabled?: boolean }) {
  return useQuery({
    queryKey: chaves.convites(id),
    queryFn: () => api.convites(id),
    refetchInterval: intervalo(o),
    enabled: o?.enabled ?? true,
  });
}

/** Tela do cliente (/convite/[token]): 404/410 não adiantam tentar de novo. */
export function useConvite(token: string) {
  return useQuery({ queryKey: chaves.convite(token), queryFn: () => api.convite(token), retry: false });
}

/** Cria (ou reaproveita o pendente). 409 = já conectado: a 360 é recarregada de qualquer forma. */
export function useCriarConvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, instituicaoId }: VarsConsentimento) => api.criarConvite(clienteId, instituicaoId),
    onSettled: async (_c, _e, { clienteId }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaves.convites(clienteId) }),
        qc.invalidateQueries({ queryKey: chaves.visao360(clienteId) }),
      ]);
      avisarDadosAlterados();
    },
  });
}

/** Confirmação do cliente (409 = já confirmado é sucesso em lib/api). Recalcula tudo do cliente. */
export function useConfirmarConvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.confirmarConvite(token),
    onSuccess: async (convite) => {
      qc.setQueryData(chaves.convite(convite.token), convite);
      await Promise.all([
        invalidarCliente(qc, convite.clienteId),
        qc.invalidateQueries({ queryKey: chaves.convites(convite.clienteId) }),
      ]);
      avisarDadosAlterados();
    },
  });
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
      avisarDadosAlterados();
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
      avisarDadosAlterados();
    },
  });
}

export function useMensagem() {
  return useMutation({
    mutationFn: ({ clienteId, acaoId, canal }: { clienteId: Id; acaoId: Id; canal: Canal }) =>
      api.mensagem(clienteId, acaoId, canal),
  });
}

// ---------- Edição do cadastro por voz ----------

export function useTranscreverAudio() {
  return useMutation({
    mutationFn: ({ clienteId, audio, nomeArquivo }: { clienteId: Id; audio: Blob; nomeArquivo: string }) =>
      api.transcreverAudio(clienteId, audio, nomeArquivo),
  });
}

/** Só propõe (nada é gravado): o assessor confere antes de aplicar. */
export function usePropostaEdicao() {
  return useMutation({
    mutationFn: ({ clienteId, transcricao }: { clienteId: Id; transcricao: string }) =>
      api.proporEdicao(clienteId, transcricao),
  });
}

/** Grava o que o assessor confirmou. Nome e cadastro aparecem na fila, no painel e nas mensagens. */
export function useEditarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, edicao }: { clienteId: Id; edicao: EdicaoCadastro }) => api.editarCliente(clienteId, edicao),
    onSuccess: async (visao, { clienteId }) => {
      qc.setQueryData(chaves.visao360(clienteId), visao);
      await invalidarCliente(qc, clienteId);
      avisarDadosAlterados();
    },
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetDemo(),
    onSuccess: async () => {
      await invalidarDados(qc);
      avisarDadosAlterados();
    },
  });
}

// ---------- Notas do assessor ("editar cliente") ----------

export function useContextoAssessor(id: Id) {
  return useQuery({ queryKey: chaves.contextoAssessor(id), queryFn: () => api.contextoAssessor(id) });
}

/** A nota muda o contexto do Copiloto (briefing) e pode criar eventos de vida (360). */
export function useRegistrarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, transcricao, origem }: { clienteId: Id; transcricao: string; origem: OrigemAnotacao }) =>
      api.registrarNota(clienteId, transcricao, origem),
    onSuccess: async (_r, { clienteId }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaves.contextoAssessor(clienteId) }),
        qc.invalidateQueries({ queryKey: chaves.briefing(clienteId) }),
        qc.invalidateQueries({ queryKey: chaves.visao360(clienteId) }),
      ]);
    },
  });
}

// ---------- Onboarding ----------

/** Lista de convites de cadastro do assessor; com polling para ver o investidor abrindo/concluindo. */
export function useConvitesOnboarding(o?: { intervaloMs?: number }) {
  return useQuery({
    queryKey: chaves.convitesOnboarding,
    queryFn: () => api.convitesOnboarding(),
    // Com erro (ex.: backend sem o endpoint), para de bater a cada intervalo.
    refetchInterval: (q) => (q.state.status === "error" ? false : (o?.intervaloMs ?? false)),
  });
}

export function useCriarConviteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => api.criarConviteOnboarding(nome),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.convitesOnboarding }),
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
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaves.convitesOnboarding }),
        qc.invalidateQueries({ queryKey: chaves.clientes }),
        qc.invalidateQueries({ queryKey: chaves.fila }),
        qc.invalidateQueries({ queryKey: chaves.painel }),
      ]);
      avisarDadosAlterados();
    },
  });
}
