// Monta Visao360 a partir de definições compactas (só para o modo mock).
// Os números de entrada são os do PLAN §6.3; aqui só agregamos.
import type {
  AcaoSugerida,
  Alerta,
  Cliente,
  ComponentesPrincipalidade,
  ConsentimentoComNome,
  FluxoCaixa,
  Id,
  PosicaoXp,
  Produto,
  ScoreInstituicao,
  Visao360,
} from "@/lib/api-types";

export const DATA_REFERENCIA = "2026-10-11";
export const DETECTADO_BASE = "2026-10-11T08:00:00-03:00";

export const INSTITUICOES: Record<Id, { nome: string; ehXp: boolean }> = {
  "inst-xp": { nome: "XP Investimentos", ehXp: true },
  "inst-aurora": { nome: "Banco Aurora", ehXp: false },
  "inst-aurora-fin": { nome: "Aurora Financeira", ehXp: false },
  "inst-horizonte": { nome: "Banco Horizonte", ehXp: false },
  "inst-ipe": { nome: "Banco Ipê", ehXp: false },
};

export const nomeInst = (id: Id) => INSTITUICOES[id]?.nome ?? id;

const PESOS: ComponentesPrincipalidade = {
  renda: 0.3,
  movimentacao: 0.2,
  contasRecorrentes: 0.15,
  investimentos: 0.15,
  cartao: 0.1,
  credito: 0.1,
};

type Comp = keyof ComponentesPrincipalidade;
const COMPS: Comp[] = ["renda", "movimentacao", "contasRecorrentes", "investimentos", "cartao", "credito"];

const FRASES: Record<Comp, (p: string) => string> = {
  renda: (p) => `recebe ${p} da renda`,
  movimentacao: (p) => `${p} da movimentação`,
  contasRecorrentes: (p) => `paga ${p} das contas recorrentes`,
  investimentos: (p) => `custodia ${p} dos investimentos`,
  cartao: (p) => `${p} do gasto com cartão`,
  credito: (p) => `${p} do crédito`,
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export interface DefVisao {
  cliente: Cliente;
  consentimentos: ConsentimentoComNome[];
  /** saldos de conta visíveis */
  contas: { instituicaoId: Id; saldo: number }[];
  /** posições visíveis (por custodiante) */
  investimentos: { instituicaoId: Id; produto: Produto; valor: number }[];
  /** participações 0–1 por instituição visível; componentes ausentes = 0 */
  participacoes: Record<Id, Partial<ComponentesPrincipalidade>>;
  explicacao: string;
  posicaoXp: PosicaoXp;
  fluxoCaixa: FluxoCaixa;
  alertas: Alerta[];
  acoes: AcaoSugerida[];
}

function zero(): ComponentesPrincipalidade {
  return { renda: 0, movimentacao: 0, contasRecorrentes: 0, investimentos: 0, cartao: 0, credito: 0 };
}

export function montarVisao(def: DefVisao, atualizadoEm: string): Visao360 {
  // Componentes disponíveis = os que têm alguma participação no cliente (§7.4: renormaliza).
  const disponiveis = COMPS.filter((c) =>
    Object.values(def.participacoes).some((p) => (p[c] ?? 0) > 0),
  );
  const somaPesos = disponiveis.reduce((s, c) => s + PESOS[c], 0) || 1;

  const scores: ScoreInstituicao[] = Object.entries(def.participacoes).map(([instId, parc]) => {
    const participacoes = zero();
    const contribuicoes = zero();
    for (const c of COMPS) participacoes[c] = r4(parc[c] ?? 0);
    for (const c of disponiveis) contribuicoes[c] = r2((100 * PESOS[c] * participacoes[c]) / somaPesos);
    const score = r2(COMPS.reduce((s, c) => s + contribuicoes[c], 0));
    const destaques = COMPS.filter((c) => participacoes[c] >= 0.5).map((c) =>
      FRASES[c](`${Math.round(participacoes[c] * 100)}%`),
    );
    return {
      instituicaoId: instId,
      nome: nomeInst(instId),
      ehXp: INSTITUICOES[instId]?.ehXp ?? false,
      score,
      participacoes,
      contribuicoes,
      destaques,
    };
  });
  scores.sort((a, b) => b.score - a.score || b.participacoes.renda - a.participacoes.renda);
  const principal = scores[0];

  // Cobertura: declaradas com consentimento ATIVO (XP sempre conta).
  const ativos = new Set(def.consentimentos.filter((c) => c.status === "ATIVO").map((c) => c.instituicaoId));
  const declaradas = def.cliente.instituicoesDeclaradas;
  const conectadas = declaradas.filter((d) => ativos.has(d.instituicaoId) || d.instituicaoId === "inst-xp");
  const pendentes = declaradas
    .filter((d) => !conectadas.includes(d))
    .map((d) => ({ instituicaoId: d.instituicaoId, nome: nomeInst(d.instituicaoId), produtos: d.produtos }));

  // Patrimônio.
  const porInstMap = new Map<Id, { investimentos: number; saldoContas: number }>();
  const acc = (id: Id) => {
    if (!porInstMap.has(id)) porInstMap.set(id, { investimentos: 0, saldoContas: 0 });
    return porInstMap.get(id)!;
  };
  for (const c of def.contas) acc(c.instituicaoId).saldoContas += c.saldo;
  for (const i of def.investimentos) acc(i.instituicaoId).investimentos += i.valor;
  const porInstituicao = [...porInstMap.entries()]
    .map(([id, v]) => ({
      instituicaoId: id,
      nome: nomeInst(id),
      ehXp: INSTITUICOES[id]?.ehXp ?? false,
      investimentos: v.investimentos,
      saldoContas: v.saldoContas,
      total: v.investimentos + v.saldoContas,
    }))
    .sort((a, b) => b.total - a.total);
  const totalVisivel = porInstituicao.reduce((s, p) => s + p.total, 0);
  const naXp = porInstituicao.filter((p) => p.ehXp).reduce((s, p) => s + p.total, 0);
  const porProdutoMap = new Map<Produto | "SALDO_CONTA", number>();
  for (const i of def.investimentos) porProdutoMap.set(i.produto, (porProdutoMap.get(i.produto) ?? 0) + i.valor);
  const saldo = def.contas.reduce((s, c) => s + c.saldo, 0);
  if (saldo > 0) porProdutoMap.set("SALDO_CONTA", saldo);

  return {
    cliente: def.cliente,
    atualizadoEm,
    cobertura: {
      instituicoesDeclaradas: declaradas.length,
      instituicoesConectadas: conectadas.length,
      percentual: declaradas.length ? r4(conectadas.length / declaradas.length) : 1,
      pendentes,
    },
    patrimonio: {
      totalVisivel,
      naXp,
      foraXp: totalVisivel - naXp,
      shareOfWalletXp: totalVisivel ? r4(naXp / totalVisivel) : 0,
      porInstituicao,
      porProduto: [...porProdutoMap.entries()]
        .map(([produto, total]) => ({ produto, total }))
        .sort((a, b) => b.total - a.total),
    },
    principalidade: {
      instituicaoPrincipalId: principal?.instituicaoId ?? "",
      instituicaoPrincipalNome: principal?.nome ?? "",
      posicaoXp: def.posicaoXp,
      explicacao: def.explicacao,
      scores,
    },
    fluxoCaixa: def.fluxoCaixa,
    alertas: def.alertas,
    acoes: def.acoes,
    consentimentos: def.consentimentos,
  };
}

// Helpers para escrever fixtures enxutas.
export function consentimento(
  clienteId: Id,
  instituicaoId: Id,
  status: ConsentimentoComNome["status"],
  escopos: ConsentimentoComNome["escopos"],
  extra?: { concedidoEm?: string; expiraEm?: string },
): ConsentimentoComNome {
  const interno = instituicaoId === "inst-xp";
  return {
    id: `cons-${clienteId.replace("cli-", "")}-${instituicaoId.replace("inst-", "")}`,
    clienteId,
    instituicaoId,
    instituicaoNome: nomeInst(instituicaoId),
    tipo: interno ? "INTERNO" : "OPEN_FINANCE",
    status,
    escopos,
    ...(interno ? {} : extra),
  };
}

export function alerta(
  clienteId: Id,
  tipo: Alerta["tipo"],
  severidade: Alerta["severidade"],
  titulo: string,
  explicacao: string,
  extra?: Partial<Pick<Alerta, "valor" | "instituicaoId" | "emissorId" | "detectadoEm" | "novo">>,
): Alerta {
  const sufixo = [extra?.instituicaoId, extra?.emissorId].filter(Boolean).join("-");
  return {
    id: `al-${clienteId.replace("cli-", "")}-${tipo.toLowerCase()}${sufixo ? `-${sufixo}` : ""}`,
    clienteId,
    tipo,
    severidade,
    titulo,
    explicacao,
    detectadoEm: extra?.detectadoEm ?? DETECTADO_BASE,
    novo: extra?.novo ?? false,
    ...(extra?.valor != null ? { valor: extra.valor } : {}),
    ...(extra?.instituicaoId ? { instituicaoId: extra.instituicaoId } : {}),
    ...(extra?.emissorId ? { emissorId: extra.emissorId } : {}),
  };
}

export function acao(
  clienteId: Id,
  tipo: AcaoSugerida["tipo"],
  titulo: string,
  motivo: string,
  alertaIds: Id[],
  extra?: { impactoEstimado?: string; principal?: boolean; id?: Id },
): AcaoSugerida {
  return {
    id: extra?.id ?? `ac-${clienteId.replace("cli-", "")}-${tipo.toLowerCase()}`,
    clienteId,
    tipo,
    titulo,
    motivo,
    alertaIds,
    principal: extra?.principal ?? false,
    ...(extra?.impactoEstimado ? { impactoEstimado: extra.impactoEstimado } : {}),
  };
}
