// Notas do assessor no modo mock: espelha o stub do backend (necessidade por palavra-chave, divisão do
// ditado por oração, "já tem seguro") e o catálogo do application.yml (anotacoes.catalogo).
// Estado no localStorage (./estado.ts).
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
  ["PROTECAO_VEICULO", ["bateu o carro", "bateu a moto", "batida", "acidente de carro", "roubaram o carro", "carro roubado", "furtaram o carro"]],
  ["PROTECAO_VIDA", ["bebê", "grávida", "filho nasceu", "dependentes", "casou", "vai casar", "casamento"]],
  ["PROTECAO_RESIDENCIAL", ["assaltad", "casa foi roubada", "alagou", "enchente", "incêndio"]],
  ["SAUDE", ["doença", "doente", "hospital", "cirurgia", "internad", "diagnóstico", "câncer", "tratamento"]],
  ["RESERVA_EMERGENCIA", ["demitid", "desempreg", "perdeu o emprego", "imprevisto"]],
  ["EDUCACAO", ["faculdade", "escola"]],
  ["APOSENTADORIA", ["aposent"]],
  ["COMPRA_IMOVEL", ["comprar um apartamento", "comprar uma casa", "casa própria", "imóvel"]],
  ["COMPRA_VEICULO", ["comprar um carro", "carro novo", "trocar de carro"]],
  ["VIAGEM", ["viagem", "viajar", "férias"]],
  ["SUCESSAO", ["sucessão", "testamento", "inventário"]],
  ["LUTO", ["perdeu o filho", "perdeu a filha", "perdeu o pai", "perdeu a mãe", "perdeu o marido", "perdeu a esposa", "faleceu", "morreu", "falecimento", "luto"]],
  ["REORGANIZACAO_FINANCEIRA", ["perdeu todo o dinheiro", "perdeu dinheiro", "perdeu muito dinheiro", "prejuízo", "golpe", "dívida", "endividad", "divórcio", "divorci", "separou"]],
  ["ALOCACAO_LIQUIDEZ", ["herança", "herdou", "bônus", "plr", "indenização", "vendeu o", "vendeu a"]],
  ["AUMENTO_RENDA", ["promovid", "promoção", "aumento de salário", "novo emprego"]],
  ["EMPREENDIMENTO", ["abriu uma empresa", "abrir uma empresa", "abriu um negócio", "abrir um negócio", "empresa própria", "cnpj"]],
  ["INTERNACIONAL", ["morar fora", "exterior", "intercâmbio", "viagem internacional", "dólar"]],
];

const JA_TEM_SEGURO = ["com seguro", "tem seguro", "segurad", "tem plano"];
const OBJETO_DO_SEGURO: Partial<Record<TipoNecessidade, string[]>> = {
  PROTECAO_VEICULO: ["carro", "moto", "veículo"],
  PROTECAO_RESIDENCIAL: ["casa", "apartamento", "residência"],
  PROTECAO_VIDA: ["vida"],
  SAUDE: ["saúde", "plano"],
};
const ORACOES = /(?<=[.!?;,])\s+|\s+(?:(?:e|depois|agora|então|aí|mas|porque)\s+)+/;

interface ItemCatalogo {
  produto: string;
  descricao: string;
  revisao?: { produto: string; descricao: string };
  sensivel?: boolean;
}

const CATALOGO: Record<TipoNecessidade, ItemCatalogo> = {
  PROTECAO_VEICULO: {
    produto: "Seguro auto",
    descricao: "Cobertura para colisão, roubo e danos a terceiros; cotação com a corretora de seguros.",
    revisao: {
      produto: "Revisão do seguro auto",
      descricao: "O cliente já tem seguro; ajudar a acionar o sinistro e conferir franquia, carro reserva e terceiros.",
    },
  },
  PROTECAO_VIDA: {
    produto: "Seguro de vida",
    descricao: "Protege a renda da família se o cliente faltar ou ficar inválido.",
    revisao: {
      produto: "Revisão do seguro de vida",
      descricao: "Conferir se o capital segurado e os beneficiários ainda fazem sentido com a família atual.",
    },
  },
  PROTECAO_RESIDENCIAL: {
    produto: "Seguro residencial",
    descricao: "Cobre roubo, incêndio e danos elétricos ou por água no imóvel.",
    revisao: {
      produto: "Revisão do seguro residencial",
      descricao: "O cliente já tem seguro; ajudar a acionar o sinistro e conferir as coberturas.",
    },
  },
  SAUDE: {
    produto: "Seguro de vida com cobertura para doenças graves",
    descricao: "Indenização em dinheiro no diagnóstico, para custos que o plano de saúde não cobre.",
    sensivel: true,
    revisao: {
      produto: "Revisão das coberturas de saúde",
      descricao: "Conferir o que o plano e os seguros atuais cobrem no tratamento e reforçar a reserva.",
    },
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
  LUTO: {
    produto: "Apoio no inventário e revisão de beneficiários",
    descricao: "Sem oferta agora. Ajudar a resgatar previdência e seguros do falecido e revisar beneficiários.",
    sensivel: true,
  },
  REORGANIZACAO_FINANCEIRA: {
    produto: "Reorganização financeira",
    descricao: "Mapear perdas e dívidas, montar uma reserva mínima e rever o perfil de risco antes de novos aportes.",
    sensivel: true,
  },
  ALOCACAO_LIQUIDEZ: {
    produto: "Plano para o dinheiro novo",
    descricao: "Separar reserva, objetivos de curto prazo e de longo prazo antes de investir o valor recebido.",
  },
  AUMENTO_RENDA: {
    produto: "Aporte programado",
    descricao: "Direcionar parte do aumento para aporte mensal automático; PGBL se declarar IR completo.",
  },
  EMPREENDIMENTO: {
    produto: "Separação PF/PJ e caixa da empresa",
    descricao: "Conta PJ, caixa da empresa com liquidez diária e pró-labore definido.",
  },
  INTERNACIONAL: {
    produto: "Conta global e investimentos em dólar",
    descricao: "Moeda forte para custos fora do país, sem depender do câmbio do dia.",
  },
};

const OBJETOS = Object.values(OBJETO_DO_SEGURO).flat();

function jaPossui(tipo: TipoNecessidade, oracoes: string[]): boolean {
  const objetos = OBJETO_DO_SEGURO[tipo];
  if (!objetos) return false;
  return oracoes
    .map((o) => o.toLowerCase())
    .filter((o) => JA_TEM_SEGURO.some((p) => o.includes(p)))
    .some((o) => objetos.some((x) => o.includes(x)) || !OBJETOS.some((x) => o.includes(x)));
}

function necessidades(texto: string): Necessidade[] {
  const oracoes = texto.split(ORACOES).map((o) => o.trim()).filter(Boolean);
  const r = new Map<TipoNecessidade, Necessidade>();
  for (const o of oracoes) {
    const lower = o.toLowerCase();
    for (const [tipo, palavras] of PALAVRAS) {
      if (!r.has(tipo) && palavras.some((p) => lower.includes(p))) {
        r.set(tipo, { tipo, motivo: o.replace(/[.!?]+$/, ""), jaPossui: jaPossui(tipo, oracoes) });
      }
    }
  }
  return [...r.values()];
}

function recomendar(ns: Necessidade[]): RecomendacaoProduto[] {
  const r = ns.map((n): RecomendacaoProduto => {
    const c = CATALOGO[n.tipo];
    const rev = n.jaPossui && c.revisao ? c.revisao : null;
    return {
      necessidade: n.tipo,
      produto: rev?.produto ?? c.produto,
      descricao: rev?.descricao ?? c.descricao,
      motivo: n.motivo,
      revisao: rev !== null,
      sensivel: c.sensivel ?? false,
    };
  });
  return r.sort((a, b) => Number(b.sensivel) - Number(a.sensivel));
}

export function registrarNotaMock(clienteId: Id, primeiroNome: string, transcricao: string, origem: OrigemAnotacao): ResultadoNota {
  const texto = transcricao.trim();
  if (!texto) throw new ApiError(400, "A nota está vazia.", "REQUISICAO_INVALIDA");
  const ns = necessidades(texto);
  const recomendacoes = recomendar(ns);
  const atual = lerNotas(clienteId);
  // Como no backend: "já tem seguro" dito antes continua valendo se a nota nova não falar disso.
  const novas = recomendacoes.map((r) => {
    const antiga = atual.recomendacoes.find((a) => a.necessidade === r.necessidade);
    return antiga?.revisao && !r.revisao ? antiga : r;
  });
  const resumo = `Nota sobre ${primeiroNome}: ${ns.length} necessidade(s) identificada(s).`;
  gravarNotas(clienteId, {
    anotacoes: [{ id: `anot-${clienteId}-${atual.anotacoes.length + 1}`, texto, origem, data: DATA_REFERENCIA, resumo }, ...atual.anotacoes],
    recomendacoes: [...novas, ...atual.recomendacoes.filter((a) => !novas.some((r) => r.necessidade === a.necessidade))],
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
  const n = lerNotas(clienteId);
  return { clienteId, ...n, recomendacoes: [...n.recomendacoes].sort((a, b) => Number(b.sensivel) - Number(a.sensivel)) };
}
