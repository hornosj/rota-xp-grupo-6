// Notas do assessor no modo mock: espelha o stub do backend (necessidade por palavra-chave) e o
// catálogo de produtos do application.yml (anotacoes.catalogo). Estado no localStorage (./estado.ts).
import { ApiError } from "@/lib/api-base";
import type {
  ContextoAssessor,
  Id,
  Necessidade,
  OrigemAnotacao,
  RecomendacaoProduto,
  ResultadoNota,
  TipoNecessidade,
} from "@/lib/api-types";
import { DATA_REFERENCIA } from "./dados";
import { gravarNotas, lerNotas } from "./estado";

const PALAVRAS: [TipoNecessidade, string[]][] = [
  ["PROTECAO_VEICULO", ["bateu o carro", "batida", "acidente de carro", "roubaram o carro", "carro roubado", "furtaram o carro"]],
  ["PROTECAO_VIDA", ["bebê", "grávida", "filho nasceu", "dependentes"]],
  ["PROTECAO_RESIDENCIAL", ["assaltad", "casa foi roubada", "alagou", "enchente", "incêndio"]],
  ["SAUDE", ["doença", "hospital", "cirurgia", "internad", "diagnóstico"]],
  ["RESERVA_EMERGENCIA", ["demitid", "desempreg", "perdeu o emprego", "imprevisto"]],
  ["EDUCACAO", ["faculdade", "escola", "intercâmbio"]],
  ["APOSENTADORIA", ["aposent"]],
  ["COMPRA_IMOVEL", ["apartamento", "casa própria", "imóvel"]],
  ["COMPRA_VEICULO", ["comprar um carro", "carro novo", "trocar de carro"]],
  ["VIAGEM", ["viagem", "viajar", "férias"]],
  ["SUCESSAO", ["herança", "sucessão", "testamento", "inventário"]],
];

const CATALOGO: Record<TipoNecessidade, { produto: string; descricao: string }> = {
  PROTECAO_VEICULO: { produto: "Seguro auto", descricao: "Cobertura para colisão, roubo e danos a terceiros; cotação com a corretora de seguros." },
  PROTECAO_VIDA: { produto: "Seguro de vida", descricao: "Protege a renda da família se o cliente faltar ou ficar inválido." },
  PROTECAO_RESIDENCIAL: { produto: "Seguro residencial", descricao: "Cobre roubo, incêndio e danos elétricos ou por água no imóvel." },
  SAUDE: {
    produto: "Seguro de vida com cobertura para doenças graves",
    descricao: "Indenização em dinheiro no diagnóstico, para custos que o plano de saúde não cobre.",
  },
  RESERVA_EMERGENCIA: {
    produto: "Reserva de emergência com liquidez diária",
    descricao: "Tesouro Selic ou CDB com liquidez diária, até cobrir 6 meses do custo de vida.",
  },
  EDUCACAO: {
    produto: "Plano para educação dos filhos",
    descricao: "Aporte mensal em previdência ou título indexado à inflação com vencimento na data da faculdade.",
  },
  APOSENTADORIA: {
    produto: "Previdência privada (PGBL ou VGBL)",
    descricao: "Acumulação de longo prazo com benefício fiscal; o tipo depende da declaração de IR.",
  },
  COMPRA_IMOVEL: {
    produto: "Carteira para a entrada do imóvel",
    descricao: "Renda fixa com vencimento próximo da data da compra, sem risco de mercado no resgate.",
  },
  COMPRA_VEICULO: {
    produto: "Carteira para a compra do veículo",
    descricao: "CDB ou LCI com vencimento na data da troca, para pagar à vista e negociar desconto.",
  },
  VIAGEM: { produto: "Investimento com liquidez para a viagem", descricao: "Renda fixa com liquidez ou vencimento antes da viagem." },
  SUCESSAO: { produto: "Planejamento sucessório com VGBL", descricao: "Previdência fora do inventário, com beneficiários indicados." },
};

function necessidades(texto: string): Necessidade[] {
  const r = new Map<TipoNecessidade, Necessidade>();
  for (const frase of texto.split(/(?<=[.!?])\s+/)) {
    const f = frase.trim();
    const lower = f.toLowerCase();
    if (!f) continue;
    for (const [tipo, palavras] of PALAVRAS) {
      if (!r.has(tipo) && palavras.some((p) => lower.includes(p))) r.set(tipo, { tipo, motivo: f.replace(/[.!?]+$/, "") });
    }
  }
  return [...r.values()];
}

export function registrarNotaMock(clienteId: Id, primeiroNome: string, transcricao: string, origem: OrigemAnotacao): ResultadoNota {
  const texto = transcricao.trim();
  if (!texto) throw new ApiError(400, "A nota está vazia.", "REQUISICAO_INVALIDA");
  const ns = necessidades(texto);
  const recomendacoes: RecomendacaoProduto[] = ns.map((n) => ({ necessidade: n.tipo, ...CATALOGO[n.tipo], motivo: n.motivo }));
  const atual = lerNotas(clienteId);
  const resumo = `Nota sobre ${primeiroNome}: ${ns.length} necessidade(s) identificada(s).`;
  gravarNotas(clienteId, {
    anotacoes: [
      { id: `anot-${clienteId}-${atual.anotacoes.length + 1}`, texto, origem, data: DATA_REFERENCIA, resumo },
      ...atual.anotacoes,
    ],
    recomendacoes: [...recomendacoes, ...atual.recomendacoes.filter((a) => !recomendacoes.some((r) => r.necessidade === a.necessidade))],
  });
  return {
    resumo,
    eventosCriados: [],
    metas: [],
    mudancasPerfil: [],
    necessidades: ns,
    recomendacoes,
    acoesCriadas: [],
    geradoPor: "stub",
  };
}

export function contextoMock(clienteId: Id): ContextoAssessor {
  return { clienteId, ...lerNotas(clienteId) };
}
