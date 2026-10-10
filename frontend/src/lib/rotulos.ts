// Rótulos pt-BR para os enums do contrato.
import type {
  CampoCadastro,
  ComponentesPrincipalidade,
  DirecaoNoticia,
  Escopo,
  OrigemClassificacao,
  PerfilInvestidor,
  PosicaoXp,
  Produto,
  ProdutoDeclarado,
  Severidade,
  TipoAlerta,
} from "./api-types";

export const rotuloPosicaoXp: Record<PosicaoXp, string> = {
  PRINCIPAL: "XP principal",
  SECUNDARIA: "XP secundária",
  SO_INVESTIMENTOS: "Só investimentos",
  AUSENTE: "XP ausente",
};

export const rotuloCampoCadastro: Record<CampoCadastro, string> = {
  NOME: "Nome",
  IDADE: "Idade",
  PROFISSAO: "Profissão",
  CIDADE: "Cidade",
};

export const rotuloPerfil: Record<PerfilInvestidor, string> = {
  CONSERVADOR: "Conservador",
  MODERADO: "Moderado",
  ARROJADO: "Arrojado",
  AGRESSIVO: "Agressivo",
};

export const rotuloSeveridade: Record<Severidade, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

export const rotuloTipoAlerta: Record<TipoAlerta, string> = {
  FGC_EXCEDIDO: "Acima do FGC",
  FGC_TETO_GLOBAL: "Teto global do FGC",
  CONCENTRACAO_EMISSOR: "Exposição sem garantia",
  VENCIMENTO_PROXIMO: "Vencimento próximo",
  SALDO_PARADO: "Saldo parado",
  RENDA_FORA_XP: "Renda fora da XP",
  CONSENTIMENTO_EXPIRANDO: "Consentimento expirando",
  EVENTO_VIDA_PROXIMO: "Evento de vida",
  RESERVA_INSUFICIENTE: "Reserva insuficiente",
};

export const rotuloEscopo: Record<Escopo, string> = {
  CONTAS: "Contas e saldos",
  CARTOES: "Cartões e faturas",
  CREDITO: "Empréstimos e financiamentos",
  INVESTIMENTOS: "Investimentos",
};

export const descricaoEscopo: Record<Escopo, string> = {
  CONTAS: "saldos e movimentações das suas contas",
  CARTOES: "faturas e limites dos seus cartões",
  CREDITO: "saldos devedores e parcelas",
  INVESTIMENTOS: "aplicações, valores e vencimentos",
};

export const rotuloProdutoDeclarado: Record<ProdutoDeclarado, string> = {
  CONTA: "conta",
  CARTAO: "cartão",
  CREDITO: "crédito",
  INVESTIMENTOS: "investimentos",
};

export const rotuloProduto: Record<Produto | "SALDO_CONTA", string> = {
  CDB: "CDB",
  RDB: "RDB",
  LCI: "LCI",
  LCA: "LCA",
  LC: "LC",
  POUPANCA: "Poupança",
  TESOURO: "Tesouro",
  DEBENTURE: "Debênture",
  CRI: "CRI",
  CRA: "CRA",
  FUNDO: "Fundos",
  ACAO: "Ações",
  PREVIDENCIA: "Previdência",
  SALDO_CONTA: "Saldo em conta",
};

export type Componente = keyof ComponentesPrincipalidade;

/** Ordem dos componentes da principalidade (§7.4). */
export const componentes: { chave: Componente; rotulo: string }[] = [
  { chave: "renda", rotulo: "Renda" },
  { chave: "movimentacao", rotulo: "Movimentação" },
  { chave: "contasRecorrentes", rotulo: "Contas recorrentes" },
  { chave: "investimentos", rotulo: "Investimentos" },
  { chave: "cartao", rotulo: "Cartão" },
  { chave: "credito", rotulo: "Crédito" },
];

// ---------- Radar de notícias ----------

export const rotuloDirecao: Record<DirecaoNoticia, string> = {
  NEGATIVA: "Negativa",
  POSITIVA: "Positiva",
  NEUTRA: "Neutra",
};

export const rotuloOrigem: Record<OrigemClassificacao, string> = {
  REFERENCIA: "Referência",
  REGRAS: "Regras",
  LLM: "IA",
};

/** A classificação traz ids de emissor (seed/emissores.json); mostramos o nome. */
const nomesEmissor: Record<string, string> = {
  "emi-xp": "XP Investimentos",
  "emi-aurora": "Banco Aurora",
  "emi-aurora-fin": "Aurora Financeira",
  "emi-horizonte": "Banco Horizonte",
  "emi-ipe": "Banco Ipê",
  "emi-tesouro": "Tesouro Nacional",
  "emi-agrosul": "Agro Sul Sementes S.A.",
};

export function rotuloEmissor(id: string): string {
  return nomesEmissor[id] ?? id;
}
