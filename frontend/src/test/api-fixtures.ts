// API de teste servida pelas fixtures REAIS do backend (contract/fixtures → src/mocks/fixtures-contrato).
// `estadoFixtures.conectado` alterna a Marina entre "antes" e "depois" do consentimento do Banco Horizonte.
import { ApiError, type Api } from "@/lib/api-base";
import type {
  Briefing,
  ClienteResumo,
  Convite,
  ConviteOnboarding,
  FormularioOnboarding,
  ItemFila,
  MensagemGerada,
  PainelCarteira,
  PropostaEdicao,
  ResultadoOnboarding,
  Visao360,
} from "@/lib/api-types";
import briefing from "@/mocks/fixtures-contrato/briefing-cli-001.json";
import clientes from "@/mocks/fixtures-contrato/clientes.json";
import filaAntes from "@/mocks/fixtures-contrato/fila-antes.json";
import filaDepois from "@/mocks/fixtures-contrato/fila-depois.json";
import convitesOnboarding from "@/mocks/fixtures-contrato/onboarding-convites.json";
import formularioOnboarding from "@/mocks/fixtures-contrato/onboarding-formulario.json";
import resultadoOnboarding from "@/mocks/fixtures-contrato/onboarding-resultado.json";
import mensagem from "@/mocks/fixtures-contrato/mensagem-cli-001-fgc.json";
import painel from "@/mocks/fixtures-contrato/painel.json";
import { contextoMock, registrarNotaMock } from "@/mocks/anotacoes";
import propostaEdicao from "@/mocks/fixtures-contrato/proposta-edicao-cli-004.json";
import { posicoesDesagioMock, simularDesagioMock } from "@/mocks/desagio";
import { motivoDe, noticiasMock, processarMock, radarDaCarteira, radarDoCliente } from "@/mocks/radar";
import visaoAntes from "@/mocks/fixtures-contrato/visao360-cli-001-antes.json";
import visaoDepois from "@/mocks/fixtures-contrato/visao360-cli-001-depois.json";

// JSON importado tem strings "largas"; a conformidade com os tipos é verificada em src/lib/contrato.test.ts.
const como = <T>(x: unknown): T => structuredClone(x) as T;

export const fixtures = {
  visaoAntes: () => como<Visao360>(visaoAntes),
  visaoDepois: () => como<Visao360>(visaoDepois),
  filaAntes: () => como<ItemFila[]>(filaAntes),
  filaDepois: () => como<ItemFila[]>(filaDepois),
  painel: () => como<PainelCarteira>(painel),
  mensagem: () => como<MensagemGerada>(mensagem),
  briefing: () => como<Briefing>(briefing),
  clientes: () => como<ClienteResumo[]>(clientes),
  convitesOnboarding: () => como<ConviteOnboarding[]>(convitesOnboarding),
  formularioOnboarding: () => como<FormularioOnboarding>(formularioOnboarding),
  resultadoOnboarding: () => como<ResultadoOnboarding>(resultadoOnboarding),
  propostaEdicao: () => como<PropostaEdicao>(propostaEdicao),
};

export const estadoFixtures = { conectado: false, convites: [] as Convite[] };

const LINK_BASE = "http://localhost:3000/convite/";

/** Convite da Marina para o Banco Horizonte, no formato do contrato (BE1-11). */
export function conviteMarina(extra?: Partial<Convite>): Convite {
  const token = extra?.token ?? "cv-9612a1d93c";
  return {
    token,
    clienteId: "cli-001",
    instituicaoId: "inst-horizonte",
    instituicaoNome: "Banco Horizonte",
    escopos: ["INVESTIMENTOS"],
    prazoMeses: 12,
    link: LINK_BASE + token,
    status: "PENDENTE",
    criadoEm: "2026-10-11T14:01:09.2712085-03:00",
    expiraEm: "2026-10-13T14:01:09.2712085-03:00",
    ...extra,
  };
}

export const TEXTO_CONVITE = (link: string) =>
  `Oi, Marina! Para eu enxergar seu patrimônio completo e checar sua proteção no FGC, você pode conectar o Banco Horizonte por aqui: ${link}. Leva 1 minuto e você pode revogar quando quiser.`;

function criarConviteFixture(id: string, inst: string): Convite {
  if (id !== "cli-001") throw naoEncontrado(id);
  if (estadoFixtures.conectado || inst !== "inst-horizonte") {
    throw new ApiError(409, "Banco Horizonte já está conectado", "CONFLITO");
  }
  const pendente = estadoFixtures.convites.find((c) => c.status === "PENDENTE");
  if (pendente) return structuredClone(pendente);
  const c = conviteMarina();
  estadoFixtures.convites.push(c);
  return structuredClone(c);
}

function acharConvite(token: string): Convite {
  const c = estadoFixtures.convites.find((x) => x.token === token);
  if (!c) throw new ApiError(404, "Convite não encontrado", "NAO_ENCONTRADO");
  return c;
}

const naoEncontrado = (id: string) => new ApiError(404, `Cliente ${id} não encontrado`, "CLIENTE_NAO_ENCONTRADO");

function visao(id: string): Visao360 {
  if (id !== "cli-001") throw naoEncontrado(id);
  return estadoFixtures.conectado ? fixtures.visaoDepois() : fixtures.visaoAntes();
}

/** Posições reais do backend (src/mocks/fixtures-desagio), antes/depois do consentimento do Horizonte. */
function posicoesDesagio(id: string) {
  return posicoesDesagioMock(id, visao(id).cliente.nome, estadoFixtures.conectado);
}

export const apiFixtures: Api = {
  listarClientes: async () => fixtures.clientes(),
  visao360: async (id) => visao(id),
  principalidade: async (id) => visao(id).principalidade,
  consentimentos: async (id) => visao(id).consentimentos,
  conceder: async (id) => {
    if (id === "cli-001") estadoFixtures.conectado = true;
    return visao(id);
  },
  revogar: async (id) => visao(id),
  fila: async () => (estadoFixtures.conectado ? fixtures.filaDepois() : fixtures.filaAntes()),
  painel: async () => fixtures.painel(),
  mensagem: async (id, acaoId, canal) => {
    if (acaoId === "acao-cli-001-convidar_conexao-inst-horizonte") {
      const c = criarConviteFixture(id, "inst-horizonte");
      return { texto: TEXTO_CONVITE(c.link), canal, geradoPor: "stub" };
    }
    return fixtures.mensagem();
  },
  briefing: async () => fixtures.briefing(),
  resetDemo: async () => {
    estadoFixtures.conectado = false;
    estadoFixtures.convites = [];
  },
  demoEstado: async () => ({ dataReferencia: "2026-10-10", modoCopiloto: "stub" }),
  noticiasRadar: async () => noticiasMock(),
  processarRadar: async () => processarMock(),
  radarCliente: async (id) => radarDoCliente(id, estadoFixtures.conectado),
  radarCarteira: async (limite = 20) =>
    radarDaCarteira(["cli-001", "cli-002", "cli-003", "cli-004", "cli-005", "cli-006"], estadoFixtures.conectado, limite),
  motivoNoticia: async (id, noticiaId) => {
    const impacto = radarDoCliente(id, estadoFixtures.conectado).find((i) => i.noticiaId === noticiaId);
    if (!impacto) throw new ApiError(404, `A notícia ${noticiaId} não mexe na carteira de ${id}`, "NAO_ENCONTRADO");
    return motivoDe(impacto);
  },
  criarConvite: async (id, inst) => criarConviteFixture(id, inst),
  convites: async (id) => (id === "cli-001" ? structuredClone(estadoFixtures.convites) : []),
  convite: async (token) => structuredClone(acharConvite(token)),
  confirmarConvite: async (token) => {
    const c = acharConvite(token);
    if (c.status === "EXPIRADO") throw new ApiError(410, "Este convite expirou", "EXPIRADO");
    c.status = "CONFIRMADO";
    estadoFixtures.conectado = true;
    return structuredClone(c);
  },
  registrarNota: async (id, transcricao, origem) => {
    visao(id);
    return registrarNotaMock(id, "Marina", transcricao, origem);
  },
  contextoAssessor: async (id) => {
    visao(id);
    return contextoMock(id);
  },
  convitesOnboarding: async () => fixtures.convitesOnboarding(),
  criarConviteOnboarding: async (nome) => ({ ...fixtures.formularioOnboarding().convite, nome, status: "PENDENTE" }),
  formularioOnboarding: async (token) => {
    if (token !== "TOKEN-EXEMPLO") throw new ApiError(404, `Convite ${token} não encontrado`, "NAO_ENCONTRADO");
    return fixtures.formularioOnboarding();
  },
  concluirOnboarding: async () => fixtures.resultadoOnboarding(),
  transcreverAudio: async () => ({ texto: fixtures.propostaEdicao().transcricao, modelo: "whisper-1" }),
  proporEdicao: async () => fixtures.propostaEdicao(),
  editarCliente: async (id, edicao) => {
    const v = visao(id);
    return { ...v, cliente: { ...v.cliente, ...edicao } };
  },
  posicoesDesagio: async (id) => posicoesDesagio(id),
  simularDesagio: async (pedido) => simularDesagioMock(pedido, posicoesDesagio),
};
