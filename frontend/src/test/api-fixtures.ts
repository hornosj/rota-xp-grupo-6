// API de teste servida pelas fixtures REAIS do backend (contract/fixtures → src/mocks/fixtures-contrato).
// `estadoFixtures.conectado` alterna a Marina entre "antes" e "depois" do consentimento do Banco Horizonte.
import { ApiError, type Api } from "@/lib/api-base";
import type {
  Briefing,
  ClienteResumo,
  ItemFila,
  Jornada,
  MensagemGerada,
  PainelCarteira,
  Visao360,
} from "@/lib/api-types";
import briefing from "@/mocks/fixtures-contrato/briefing-cli-001.json";
import clientes from "@/mocks/fixtures-contrato/clientes.json";
import filaAntes from "@/mocks/fixtures-contrato/fila-antes.json";
import filaDepois from "@/mocks/fixtures-contrato/fila-depois.json";
import jornadaAntes from "@/mocks/fixtures-contrato/jornada-cli-001-antes.json";
import jornadaDepois from "@/mocks/fixtures-contrato/jornada-cli-001-depois.json";
import jornada003 from "@/mocks/fixtures-contrato/jornada-cli-003-antes.json";
import mensagem from "@/mocks/fixtures-contrato/mensagem-cli-001-fgc.json";
import painel from "@/mocks/fixtures-contrato/painel.json";
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
  jornadaAntes: () => como<Jornada>(jornadaAntes),
  jornadaDepois: () => como<Jornada>(jornadaDepois),
  jornada003: () => como<Jornada>(jornada003),
  painel: () => como<PainelCarteira>(painel),
  mensagem: () => como<MensagemGerada>(mensagem),
  briefing: () => como<Briefing>(briefing),
  clientes: () => como<ClienteResumo[]>(clientes),
};

export const estadoFixtures = { conectado: false };

const naoEncontrado = (id: string) => new ApiError(404, `Cliente ${id} não encontrado`, "CLIENTE_NAO_ENCONTRADO");

function visao(id: string): Visao360 {
  if (id !== "cli-001") throw naoEncontrado(id);
  return estadoFixtures.conectado ? fixtures.visaoDepois() : fixtures.visaoAntes();
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
  jornada: async (id) => {
    if (id === "cli-003") return fixtures.jornada003();
    if (id !== "cli-001") throw naoEncontrado(id);
    return estadoFixtures.conectado ? fixtures.jornadaDepois() : fixtures.jornadaAntes();
  },
  mensagem: async () => fixtures.mensagem(),
  briefing: async () => fixtures.briefing(),
  resetDemo: async () => {
    estadoFixtures.conectado = false;
  },
  demoEstado: async () => ({ dataReferencia: "2026-10-11", modoCopiloto: "stub" }),
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
};
