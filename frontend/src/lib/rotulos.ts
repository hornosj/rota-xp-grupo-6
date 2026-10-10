// Rótulos pt-BR para os enums do contrato.
import type {
  ComponentesPrincipalidade,
  Escopo,
  PerfilInvestidor,
  PosicaoXp,
  Produto,
  ProdutoDeclarado,
  Severidade,
  StatusConsentimento,
  TipoAlerta,
} from "./api-types";

export const rotuloPosicaoXp: Record<PosicaoXp, string> = {
  PRINCIPAL: "XP principal",
  SECUNDARIA: "XP secundária",
  SO_INVESTIMENTOS: "Só investimentos",
  AUSENTE: "XP ausente",
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

export const rotuloStatusConsentimento: Record<StatusConsentimento, string> = {
  ATIVO: "Ativo",
  PENDENTE: "Pendente",
  EXPIRADO: "Expirado",
  REVOGADO: "Revogado",
};

export type Componente = keyof ComponentesPrincipalidade;

/** Ordem e cores dos componentes da principalidade (§7.4). */
export const componentes: { chave: Componente; rotulo: string; cor: string }[] = [
  { chave: "renda", rotulo: "Renda", cor: "#2a78d6" },
  { chave: "movimentacao", rotulo: "Movimentação", cor: "#eb6834" },
  { chave: "contasRecorrentes", rotulo: "Contas recorrentes", cor: "#1baf7a" },
  { chave: "investimentos", rotulo: "Investimentos", cor: "#eda100" },
  { chave: "cartao", rotulo: "Cartão", cor: "#e87ba4" },
  { chave: "credito", rotulo: "Crédito", cor: "#008300" },
];
