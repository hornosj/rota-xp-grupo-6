// Implementação mock da API (NEXT_PUBLIC_USE_MOCKS=true). Plano B da demo.
// Estado (consentimentos concedidos/revogados) fica no localStorage: ver ./estado.ts.
import { ApiError, type Api } from "@/lib/api-base";
import type { ClienteResumo, ConsentimentoComNome, Id, ItemFila, PainelCarteira, PosicaoXp, Visao360 } from "@/lib/api-types";
import { ANCORAS, DATA_REFERENCIA, DEFS_ESTATICAS, defMarina, type DefCliente } from "./dados";
import { concedidoEm, lerEstado, registrarConcessao, registrarRevogacao, resetarEstado, revogadoEm } from "./estado";
import {
  buscarConviteMock,
  confirmarConviteMock,
  convitesDoCliente,
  criarConviteMock,
  instituicaoDaAcaoConvidar,
  mensagemConvite,
} from "./convites";
import { montarVisao } from "./montar";
import { motivoDe, noticiasMock, processarMock, radarDaCarteira, radarDoCliente } from "./radar";
import { briefingStub, mensagemStub } from "./textos";

const JANELA_NOVO_MS = 10 * 60 * 1000;
const LATENCIA_MS = process.env.NODE_ENV === "test" ? 0 : 150;

const esperar = <T>(valor: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(valor)), LATENCIA_MS));

function estadoMarina(): { em: string; novo: boolean } | null {
  const em = concedidoEm("cli-001", "inst-horizonte");
  if (!em) return null;
  return { em, novo: Date.now() - new Date(em).getTime() < JANELA_NOVO_MS };
}

function aplicarOverrides(clienteId: Id, lista: ConsentimentoComNome[]): ConsentimentoComNome[] {
  return lista.map((c) => {
    if (c.tipo === "INTERNO") return c;
    const conc = concedidoEm(clienteId, c.instituicaoId);
    const rev = revogadoEm(clienteId, c.instituicaoId);
    if (conc && c.status !== "ATIVO") {
      const exp = new Date(conc);
      exp.setFullYear(exp.getFullYear() + 1);
      return { ...c, status: "ATIVO", concedidoEm: conc, expiraEm: exp.toISOString().slice(0, 10) };
    }
    if (rev) return { ...c, status: "REVOGADO" };
    return c;
  });
}

function defDe(clienteId: Id): DefCliente {
  if (clienteId === "cli-001") return defMarina(estadoMarina(), revogadoEm("cli-001", "inst-horizonte"));
  const f = DEFS_ESTATICAS[clienteId];
  if (!f) throw new ApiError(404, `Cliente ${clienteId} não encontrado`, "CLIENTE_NAO_ENCONTRADO");
  return f();
}

function visao(clienteId: Id): Visao360 {
  const def = defDe(clienteId);
  const v = montarVisao(
    { ...def.visao, consentimentos: aplicarOverrides(clienteId, def.visao.consentimentos) },
    new Date().toISOString(),
  );
  return v;
}

function todosIds(): Id[] {
  return ["cli-001", ...Object.keys(DEFS_ESTATICAS)];
}

function fila(): ItemFila[] {
  const itens = todosIds().map((id) => {
    const def = defDe(id);
    const v = visao(id);
    const soma = def.motivos.reduce((s, m) => s + m.pontos, 0);
    const prioridade = Math.min(100, Math.round(soma * 10) / 10);
    const item: ItemFila = {
      posicao: 0,
      clienteId: id,
      nome: v.cliente.nome,
      perfil: v.cliente.perfil,
      prioridade,
      motivos: [...def.motivos].sort((a, b) => b.pontos - a.pontos),
      posicaoXp: v.principalidade.posicaoXp,
      novo: v.alertas.some((a) => a.novo),
    };
    const acao = v.acoes.find((a) => a.principal);
    if (acao) item.acaoPrincipal = acao;
    return item;
  });
  itens.sort((a, b) => b.prioridade - a.prioridade || (ANCORAS.includes(a.clienteId) ? -1 : 1));
  return itens.map((i, k) => ({ ...i, posicao: k + 1 }));
}

function painel(): PainelCarteira {
  // Os 10 clientes do mock + 26 clientes de fundo "virtuais" para números realistas.
  const visoes = todosIds().map(visao);
  const dist: Record<PosicaoXp, number> = { PRINCIPAL: 6, SECUNDARIA: 5, SO_INVESTIMENTOS: 14, AUSENTE: 1 };
  for (const v of visoes) dist[v.principalidade.posicaoXp] += 1;
  const totalClientes = Object.values(dist).reduce((a, b) => a + b, 0);
  const naXp = visoes.reduce((s, v) => s + v.patrimonio.naXp, 0) + 8_420_000;
  const fora = visoes.reduce((s, v) => s + v.patrimonio.foraXp, 0) + 2_310_000;
  const cobertura = (visoes.reduce((s, v) => s + v.cobertura.percentual, 0) + 26 * 0.82) / totalClientes;
  const alertaAlto = visoes.filter((v) => v.alertas.some((a) => a.severidade === "ALTA")).length;
  const expirando = visoes.filter((v) => v.alertas.some((a) => a.tipo === "CONSENTIMENTO_EXPIRANDO")).length;
  return {
    assessorId: "ass-001",
    totalClientes,
    patrimonioNaXp: naXp,
    patrimonioForaXpVisivel: fora,
    pctClientesXpPrincipal: Math.round((dist.PRINCIPAL / totalClientes) * 10000) / 10000,
    distribuicaoPosicaoXp: dist,
    coberturaMedia: Math.round(cobertura * 10000) / 10000,
    consentimentosExpirando15d: expirando,
    clientesComAlertaAlto: alertaAlto,
  };
}

function exigirConsentimento(clienteId: Id, instituicaoId: Id) {
  const v = visao(clienteId);
  if (!v.consentimentos.some((c) => c.instituicaoId === instituicaoId)) {
    throw new ApiError(404, `Instituição ${instituicaoId} não encontrada para ${clienteId}`, "INSTITUICAO_NAO_ENCONTRADA");
  }
  return v;
}

export const mockApi: Api = {
  async listarClientes() {
    const r: ClienteResumo[] = fila().map((i) => ({
      id: i.clienteId,
      nome: i.nome,
      perfil: i.perfil,
      posicaoXp: i.posicaoXp,
      prioridade: i.prioridade,
    }));
    return esperar(r);
  },
  async visao360(id) {
    return esperar(visao(id));
  },
  async principalidade(id) {
    return esperar(visao(id).principalidade);
  },
  async consentimentos(id) {
    return esperar(visao(id).consentimentos);
  },
  async conceder(id, inst) {
    const v = exigirConsentimento(id, inst);
    const atual = v.consentimentos.find((c) => c.instituicaoId === inst);
    // já ativo = 409 no backend; o front trata como sucesso → aqui só devolvemos a visão.
    if (atual?.status !== "ATIVO") registrarConcessao(id, inst);
    return esperar(visao(id));
  },
  async revogar(id, inst) {
    exigirConsentimento(id, inst);
    if (inst !== "inst-xp") registrarRevogacao(id, inst);
    return esperar(visao(id));
  },
  async fila() {
    return esperar(fila());
  },
  async painel() {
    return esperar(painel());
  },
  async mensagem(id, acaoId, canal) {
    const v = visao(id);
    const instConvite = instituicaoDaAcaoConvidar(acaoId);
    if (instConvite) {
      // Como no backend: cria o convite se não existir e põe o link no texto.
      const c = criarConviteMock(v, instConvite);
      return esperar(mensagemConvite(visao(id), c, canal));
    }
    const acao = v.acoes.find((a) => a.id === acaoId);
    if (!acao) throw new ApiError(404, `Ação ${acaoId} não encontrada`, "ACAO_NAO_ENCONTRADA");
    return esperar(mensagemStub(v, acao, canal));
  },
  async briefing(id) {
    return esperar(briefingStub(visao(id)));
  },
  async resetDemo() {
    resetarEstado();
    await esperar(null);
  },
  async demoEstado() {
    return esperar({ dataReferencia: DATA_REFERENCIA, modoCopiloto: "mock" });
  },
  async noticiasRadar() {
    return esperar(noticiasMock());
  },
  async processarRadar() {
    return esperar(processarMock());
  },
  async radarCliente(id) {
    defDe(id); // 404 se o cliente não existe
    return esperar(radarDoCliente(id, estadoMarina() !== null));
  },
  async radarCarteira(limite = 20) {
    return esperar(radarDaCarteira(todosIds(), estadoMarina() !== null, limite));
  },
  async motivoNoticia(id, noticiaId) {
    defDe(id);
    const impacto = radarDoCliente(id, estadoMarina() !== null).find((i) => i.noticiaId === noticiaId);
    if (!impacto) throw new ApiError(404, `A notícia ${noticiaId} não mexe na carteira de ${id}`, "NAO_ENCONTRADO");
    return esperar(motivoDe(impacto));
  },
  async criarConvite(id, inst) {
    return esperar(criarConviteMock(visao(id), inst));
  },
  async convites(id) {
    return esperar(convitesDoCliente(visao(id)));
  },
  async convite(token) {
    return esperar(buscarConviteMock(token, visao));
  },
  async confirmarConvite(token) {
    return esperar(confirmarConviteMock(token, visao));
  },
};

/** Útil para depuração no console: window.__mockEstado() */
export const estadoAtual = lerEstado;
