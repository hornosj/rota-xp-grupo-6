// Calculadora de deságio no modo mock: posições REAIS do backend gravadas em ./fixtures-desagio
// (seed, data de referência 2026-10-10) e o mesmo cálculo do DesagioService (PLAN §7.11).
// A Marina alterna entre "antes" e "depois" do consentimento do Banco Horizonte, como o resto do mock.
// Clientes sem fixture (os de fundo) aparecem sem posições.
import { ApiError } from "@/lib/api-base";
import type { DesagioDetalhado, DesagioPedido, Id, PontoSerie, PosicaoDesagio, PosicoesDesagio } from "@/lib/api-types";
import posicoes from "./fixtures-desagio/posicoes.json";
import { DATA_REFERENCIA } from "./montar";

// JSON importado tem strings "largas"; a forma é conferida em src/lib/contrato.test.ts.
const POSICOES = posicoes as unknown as Record<string, PosicoesDesagio>;

const DIAS_POR_ANO = 365;
const LIMITE_TAXA = 5;
const LIMITE_PRAZO = 50;

const PREMISSAS = [
  "Ignora IR, IOF e custos de corretagem.",
  "Supõe risco de crédito equivalente entre o título atual e o novo.",
  "Reinveste o valor da venda à taxa nova, constante, até o vencimento do título atual.",
  "Taxas efetivas ao ano, com capitalização composta.",
];
const RESSALVA = "Simulação simplificada: ignora IR e supõe risco equivalente entre os títulos.";

export function posicoesDesagioMock(clienteId: Id, clienteNome: string, horizonteConectado: boolean): PosicoesDesagio {
  const chave = clienteId === "cli-001" && horizonteConectado ? "cli-001-conectado" : clienteId;
  const gravado = POSICOES[chave];
  if (gravado) return structuredClone({ ...gravado, clienteNome });
  return { clienteId, clienteNome, dataReferencia: DATA_REFERENCIA, premissas: POSICOES["cli-001"].premissas, posicoes: [] };
}

const invalido = (mensagem: string) => new ApiError(400, mensagem, "REQUISICAO_INVALIDA");

/** `posicoesDe` devolve o que o cliente tem visível agora (depende dos consentimentos). */
export function simularDesagioMock(p: DesagioPedido, posicoesDe: (clienteId: Id) => PosicoesDesagio): DesagioDetalhado {
  const pos = origem(p, posicoesDe);
  const valor = p.valorAtual ?? pos?.valorAtual;
  const prazo = p.prazoRestanteAnos ?? (pos?.vencimento ? prazoAnos(pos.vencimento) : undefined);
  const taxaAntiga = p.taxaAntiga ?? pos?.taxaAnualEstimada;
  const avisos: string[] = [];
  if (p.taxaAntiga == null && pos?.taxaAnualEstimada != null && pos.taxaDependeDePremissa) {
    avisos.push(avisoTaxaEstimada(pos, posicoesDe(p.clienteId!)));
  }
  validar(p, valor, taxaAntiga, prazo);
  return calcular(p, pos, valor!, taxaAntiga!, prazo!, avisos);
}

function origem(p: DesagioPedido, posicoesDe: (clienteId: Id) => PosicoesDesagio): PosicaoDesagio | undefined {
  if (!p.posicaoId) return undefined;
  if (!p.clienteId) throw invalido("Informe clienteId junto com posicaoId.");
  const pos = posicoesDe(p.clienteId).posicoes.find((x) => x.posicaoId === p.posicaoId);
  if (!pos) {
    throw new ApiError(404, `Posição ${p.posicaoId} não encontrada para o cliente ${p.clienteId}`, "NAO_ENCONTRADO");
  }
  if (!pos.elegivel) throw invalido(`Esta posição não permite simular deságio: ${pos.motivoInelegibilidade}`);
  return pos;
}

function prazoAnos(vencimento: string): number {
  const dias = (Date.parse(`${vencimento}T00:00:00Z`) - Date.parse(`${DATA_REFERENCIA}T00:00:00Z`)) / 86_400_000;
  return dias / DIAS_POR_ANO;
}

function avisoTaxaEstimada(pos: PosicaoDesagio, todas: PosicoesDesagio): string {
  const { cdiAnual, ipcaAnual, selicAnual } = todas.premissas;
  const premissa =
    pos.indexador === "IPCA" ? `IPCA de ${pct(ipcaAnual)} a.a.`
    : pos.indexador === "SELIC" ? `Selic de ${pct(selicAnual)} a.a.`
    : `CDI de ${pct(cdiAnual)} a.a.`;
  return `Taxa atual estimada (${pct(pos.taxaAnualEstimada!)} a.a.) a partir de "${pos.taxaTexto}" (${premissa}). `
    + "Ajuste se souber a taxa efetiva.";
}

function validar(p: DesagioPedido, valor?: number, taxaAntiga?: number, prazo?: number) {
  const erros: string[] = [];
  if (valor == null || valor <= 0) erros.push("valorAtual deve ser maior que zero");
  entreZeroE(erros, taxaAntiga, LIMITE_TAXA, "taxaAntiga é obrigatória (fração a.a., ex.: 0.12)", "taxaAntiga deve estar entre 0 e 5 (fração a.a.)");
  entreZeroE(erros, p.taxaNova, LIMITE_TAXA, "taxaNova é obrigatória (fração a.a., ex.: 0.14)", "taxaNova deve estar entre 0 e 5 (fração a.a.)");
  entreZeroE(erros, prazo, LIMITE_PRAZO, "prazoRestanteAnos é obrigatório", "prazoRestanteAnos deve estar entre 0 e 50");
  if ((p.desagio == null) === (p.precoVenda == null)) {
    erros.push("informe exatamente um entre desagio (fração 0–1) e precoVenda (R$)");
  } else if (p.desagio != null && (p.desagio < 0 || p.desagio >= 1)) {
    erros.push("desagio deve estar entre 0 (inclusive) e 1 (exclusive)");
  } else if (p.precoVenda != null && (p.precoVenda <= 0 || (valor != null && p.precoVenda > valor))) {
    erros.push("precoVenda deve ser maior que zero e não pode superar o valorAtual (ágio não é suportado)");
  }
  if (erros.length > 0) throw invalido(`${erros.join("; ")}.`);
}

function entreZeroE(erros: string[], v: number | undefined, max: number, seAusente: string, seFora: string) {
  if (v == null) erros.push(seAusente);
  else if (v <= 0 || v > max) erros.push(seFora);
}

interface BreakEven {
  anos: number;
  meses: number;
  compensa: boolean;
  desagioMaximo: number;
  precoMinimo: number;
}

function calcular(
  p: DesagioPedido, pos: PosicaoDesagio | undefined, valorBruto: number, ra: number, prazo: number, avisos: string[],
): DesagioDetalhado {
  const rn = p.taxaNova;
  const valor = dinheiro(valorBruto);
  const preco = p.precoVenda != null ? dinheiro(p.precoVenda) : dinheiro(valor * (1 - p.desagio!));
  const d = p.precoVenda != null ? arredondar(1 - preco / valor, 6) : p.desagio!;

  const manter = projetar(valor, ra, prazo);
  const vender = projetar(preco, rn, prazo);
  const ganho = dinheiro(vender - manter);
  const perda = dinheiro(valor - preco);
  const be = rn > ra ? breakEven(d, ra, rn, prazo, valor) : null;

  const entrada = {
    ...(pos ? { posicaoId: pos.posicaoId, posicaoNome: pos.nome } : {}),
    valorAtual: valor, taxaAntiga: ra, taxaNova: rn, prazoRestanteAnos: prazo, desagio: arredondar(d, 6), precoVenda: preco,
  };
  return {
    entrada,
    perdaImediata: perda,
    valorFinalManter: manter,
    valorFinalVender: vender,
    ganhoDaTroca: ganho,
    ganhoDaTrocaPercentual: manter === 0 ? 0 : arredondar(ganho / manter, 6),
    ...(be
      ? { breakEvenAnos: be.anos, breakEvenMeses: be.meses, desagioMaximoQueCompensa: be.desagioMaximo, precoMinimoQueCompensa: be.precoMinimo }
      : {}),
    compensa: be?.compensa ?? false,
    spreadTaxas: arredondar(rn - ra, 6),
    serie: serie(valor, preco, ra, rn, prazo),
    explicacao: explicar(entrada.posicaoNome, entrada.desagio, ra, rn, prazo, preco, perda, manter, vender, ganho, be),
    premissas: [...PREMISSAS],
    avisos,
  };
}

function breakEven(d: number, ra: number, rn: number, prazo: number, valor: number): BreakEven {
  const t = d <= 0 ? 0 : Math.log(1 / (1 - d)) / Math.log((1 + rn) / (1 + ra));
  const dmax = 1 - Math.pow((1 + ra) / (1 + rn), prazo);
  return {
    anos: arredondar(t, 2),
    meses: Math.round(t * 12),
    compensa: t < prazo,
    desagioMaximo: arredondar(dmax, 6),
    precoMinimo: dinheiro(valor * (1 - dmax)),
  };
}

function serie(valor: number, preco: number, ra: number, rn: number, prazo: number): PontoSerie[] {
  const meses = Math.floor(prazo * 12);
  const pontos: PontoSerie[] = [];
  for (let m = 0; m <= meses; m++) pontos.push(ponto(m, m / 12, valor, preco, ra, rn));
  if (meses / 12 < prazo - 1e-9) pontos.push(ponto(meses + 1, prazo, valor, preco, ra, rn));
  return pontos;
}

function ponto(mes: number, anos: number, valor: number, preco: number, ra: number, rn: number): PontoSerie {
  const valorManter = projetar(valor, ra, anos);
  const valorVender = projetar(preco, rn, anos);
  return { mes, anos: arredondar(anos, 4), valorManter, valorVender, diferenca: dinheiro(valorVender - valorManter) };
}

function explicar(
  nome: string | undefined, d: number, ra: number, rn: number, prazo: number, preco: number,
  perda: number, manter: number, vender: number, ganho: number, be: BreakEven | null,
): string {
  const frases = [
    `Vender ${nome ?? "o título"} com deságio de ${pct(d)} gera uma perda imediata de ${reais(perda)} (recebe ${reais(preco)}).`,
  ];
  if (!be) {
    frases.push(
      `Como a nova taxa (${pct(rn)} a.a.) não supera a atual (${pct(ra)} a.a.), a perda nunca é recuperada: `
        + `no vencimento o cliente ficaria com ${reais(Math.abs(ganho))} a menos.`,
    );
  } else {
    frases.push(`Trocar ${pct(ra)} a.a. por ${pct(rn)} a.a. recupera a perda em ${decimal(be.anos)} ano(s) (cerca de ${be.meses} meses).`);
    frases.push(
      `Como faltam ${decimal(prazo)} ano(s) para o vencimento, a troca ${be.compensa ? "compensa" : "não compensa"}: `
        + `no vencimento o cliente terá ${reais(vender)} contra ${reais(manter)} mantendo o título `
        + `(${ganho >= 0 ? "+" : "−"}${reais(Math.abs(ganho))}).`,
    );
    frases.push(`O deságio máximo que ainda compensa é de ${pct(be.desagioMaximo)}.`);
  }
  frases.push(RESSALVA);
  return frases.join(" ");
}

function projetar(valor: number, taxa: number, anos: number): number {
  return dinheiro(valor * Math.pow(1 + taxa, anos));
}

function dinheiro(x: number): number {
  return Math.round(x * 100) / 100;
}

function arredondar(x: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(x * f) / f;
}

/** Como o Texto.java do backend: até uma casa decimal, sem zeros à direita. */
function decimal(x: number): string {
  return x.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

function pct(fracao: number): string {
  return `${decimal(fracao * 100)}%`;
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}
