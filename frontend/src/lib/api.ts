// Funções tipadas por endpoint (PLAN §5). Sempre via /api (rewrite do Next → backend).
// Com NEXT_PUBLIC_USE_MOCKS=true, usa as fixtures de src/mocks (plano B da demo).
import { mockApi } from "@/mocks";
import { ApiError, type Api } from "./api-base";
import { USE_MOCKS } from "./config";
import type {
  Briefing,
  ClienteResumo,
  ConsentimentoComNome,
  Convite,
  ConviteOnboarding,
  DemoEstado,
  DesagioDetalhado,
  ErroApi,
  FormularioOnboarding,
  ImpactoNoticia,
  ItemFila,
  MensagemGerada,
  MotivoNoticia,
  NoticiaClassificada,
  PainelCarteira,
  PosicoesDesagio,
  Principalidade,
  PropostaEdicao,
  ResultadoOnboarding,
  ResultadoProcessamento,
  Transcricao,
  Visao360,
} from "./api-types";

export { ApiError, type Api } from "./api-base";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export { USE_MOCKS };

const seg = encodeURIComponent;

export function criarHttpApi(fetchImpl: Fetch = (u, i) => fetch(u, i)): Api {
  async function chamar<T>(caminho: string, init?: RequestInit & { json?: unknown }): Promise<T> {
    const { json, ...resto } = init ?? {};
    const res = await fetchImpl(`/api${caminho}`, {
      cache: "no-store",
      ...resto,
      headers: {
        Accept: "application/json",
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...resto.headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
    if (!res.ok) {
      let corpo: Partial<ErroApi> = {};
      try {
        corpo = (await res.json()) as Partial<ErroApi>;
      } catch {
        /* sem corpo */
      }
      throw new ApiError(res.status, corpo.mensagem ?? `Erro ${res.status} em ${caminho}`, corpo.erro);
    }
    if (res.status === 204) return undefined as T;
    const texto = await res.text();
    return (texto ? JSON.parse(texto) : undefined) as T;
  }

  const api: Api = {
    listarClientes: () => chamar<ClienteResumo[]>("/clientes"),
    visao360: (id) => chamar<Visao360>(`/clientes/${seg(id)}/360`),
    principalidade: (id) => chamar<Principalidade>(`/clientes/${seg(id)}/principalidade`),
    consentimentos: (id) => chamar<ConsentimentoComNome[]>(`/clientes/${seg(id)}/consentimentos`),
    async conceder(id, inst) {
      try {
        return await chamar<Visao360>(`/clientes/${seg(id)}/consentimentos/${seg(inst)}/conceder`, { method: "POST" });
      } catch (e) {
        // 409 = consentimento já ativo → sucesso; devolve a visão atual.
        if (e instanceof ApiError && e.status === 409) return api.visao360(id);
        throw e;
      }
    },
    revogar: (id, inst) => chamar<Visao360>(`/clientes/${seg(id)}/consentimentos/${seg(inst)}/revogar`, { method: "POST" }),
    fila: () => chamar<ItemFila[]>("/assessor/fila"),
    painel: () => chamar<PainelCarteira>("/assessor/painel"),
    mensagem: (id, acaoId, canal) =>
      chamar<MensagemGerada>(`/clientes/${seg(id)}/acoes/${seg(acaoId)}/mensagem`, { method: "POST", json: { canal } }),
    briefing: (id) => chamar<Briefing>(`/clientes/${seg(id)}/briefing`),
    resetDemo: () => chamar<void>("/demo/reset", { method: "POST" }),
    demoEstado: () => chamar<DemoEstado>("/demo/estado"),
    noticiasRadar: () => chamar<NoticiaClassificada[]>("/radar/noticias"),
    processarRadar: () => chamar<ResultadoProcessamento>("/radar/processar", { method: "POST" }),
    radarCliente: (id) => chamar<ImpactoNoticia[]>(`/clientes/${seg(id)}/radar`),
    radarCarteira: (limite = 20) => chamar<ImpactoNoticia[]>(`/assessor/radar?limite=${limite}`),
    motivoNoticia: (id, noticiaId) =>
      chamar<MotivoNoticia>(`/clientes/${seg(id)}/radar/${seg(noticiaId)}/motivo`, { method: "POST" }),
    criarConvite: (id, inst) => chamar<Convite>(`/clientes/${seg(id)}/convites/${seg(inst)}`, { method: "POST" }),
    convites: (id) => chamar<Convite[]>(`/clientes/${seg(id)}/convites`),
    convite: (token) => chamar<Convite>(`/convites/${seg(token)}`),
    async confirmarConvite(token) {
      try {
        return await chamar<Convite>(`/convites/${seg(token)}/confirmar`, { method: "POST" });
      } catch (e) {
        // 409 = já confirmado → sucesso; devolve o convite atual.
        if (e instanceof ApiError && e.status === 409) return api.convite(token);
        throw e;
      }
    },
    convitesOnboarding: () => chamar<ConviteOnboarding[]>("/assessor/convites"),
    criarConviteOnboarding: (nome) => chamar<ConviteOnboarding>("/assessor/convites", { method: "POST", json: { nome } }),
    formularioOnboarding: (token) => chamar<FormularioOnboarding>(`/onboarding/${seg(token)}`),
    concluirOnboarding: (token, cadastro) =>
      chamar<ResultadoOnboarding>(`/onboarding/${seg(token)}`, { method: "POST", json: cadastro }),
    transcreverAudio(id, audio, nomeArquivo) {
      // Multipart: o navegador põe o Content-Type com o boundary.
      const form = new FormData();
      form.append("audio", audio, nomeArquivo);
      return chamar<Transcricao>(`/clientes/${seg(id)}/edicao/transcricao`, { method: "POST", body: form });
    },
    proporEdicao: (id, transcricao) =>
      chamar<PropostaEdicao>(`/clientes/${seg(id)}/edicao/proposta`, { method: "POST", json: { transcricao } }),
    editarCliente: (id, edicao) => chamar<Visao360>(`/clientes/${seg(id)}`, { method: "PATCH", json: edicao }),
    posicoesDesagio: (id) => chamar<PosicoesDesagio>(`/clientes/${seg(id)}/desagio/posicoes`),
    simularDesagio: (pedido) => chamar<DesagioDetalhado>("/simulacoes/desagio/detalhado", { method: "POST", json: pedido }),
  };
  return api;
}

export const httpApi = criarHttpApi();

/** API usada pela aplicação. */
export const api: Api = USE_MOCKS ? mockApi : httpApi;
