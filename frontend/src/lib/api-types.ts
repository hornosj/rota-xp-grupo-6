// Tipos do contrato da API — escritos à mão a partir do docs/PLAN.md §4 e §5.
// PROVISÓRIO: quando contract/openapi.json existir, `npm run gen:api` gera
// src/lib/api-types.gen.ts; aí estes tipos passam a ser derivados do gerado.
// Os nomes de campo aqui são exatamente os do contrato (o backend produz os mesmos).

export type Id = string;
export type PerfilInvestidor = "CONSERVADOR" | "MODERADO" | "ARROJADO" | "AGRESSIVO";
export type ProdutoDeclarado = "CONTA" | "CARTAO" | "CREDITO" | "INVESTIMENTOS";
export type Escopo = "CONTAS" | "CARTOES" | "CREDITO" | "INVESTIMENTOS";

// ---------- §4.1 Entidades ----------

export interface Instituicao {
  id: Id;
  nome: string;
  conglomeradoId: Id;
  conglomeradoNome: string;
  ehXp: boolean;
}

export interface Emissor {
  id: Id;
  nome: string;
  conglomeradoId: Id;
  tipo: "BANCO" | "EMPRESA" | "TESOURO";
}

export interface EventoVida {
  id: Id;
  tipo: "ANIVERSARIO" | "CASAMENTO" | "NASCIMENTO" | "FERIAS" | "APOSENTADORIA" | "MUDANCA" | "OUTRO";
  descricao: string;
  data: string;
  origem: "CADASTRO" | "NOTA_REUNIAO";
}

export interface Dependente {
  nome: string;
  parentesco: string;
  dataNascimento: string;
}

export interface Cliente {
  id: Id;
  nome: string;
  cpf: string;
  idade: number;
  profissao: string;
  cidade: string;
  perfil: PerfilInvestidor;
  assessorId: Id;
  ancora: boolean;
  instituicoesDeclaradas: { instituicaoId: Id; produtos: ProdutoDeclarado[] }[];
  dependentes: Dependente[];
  eventosVida: EventoVida[];
}

export type StatusConsentimento = "ATIVO" | "PENDENTE" | "EXPIRADO" | "REVOGADO";

export interface Consentimento {
  id: Id;
  clienteId: Id;
  instituicaoId: Id;
  tipo: "OPEN_FINANCE" | "INTERNO";
  status: StatusConsentimento;
  escopos: Escopo[];
  concedidoEm?: string;
  expiraEm?: string;
}

export type Produto =
  | "CDB"
  | "RDB"
  | "LCI"
  | "LCA"
  | "LC"
  | "POUPANCA"
  | "TESOURO"
  | "DEBENTURE"
  | "CRI"
  | "CRA"
  | "FUNDO"
  | "ACAO"
  | "PREVIDENCIA";

// ---------- §4.2 Respostas derivadas ----------

export type PosicaoXp = "PRINCIPAL" | "SECUNDARIA" | "SO_INVESTIMENTOS" | "AUSENTE";

export type ConsentimentoComNome = Consentimento & { instituicaoNome: string };

export interface Visao360 {
  cliente: Cliente;
  atualizadoEm: string;
  cobertura: Cobertura;
  patrimonio: Patrimonio;
  principalidade: Principalidade;
  fluxoCaixa: FluxoCaixa;
  alertas: Alerta[];
  acoes: AcaoSugerida[];
  consentimentos: ConsentimentoComNome[];
}

export interface Cobertura {
  instituicoesDeclaradas: number;
  instituicoesConectadas: number;
  percentual: number;
  pendentes: { instituicaoId: Id; nome: string; produtos: ProdutoDeclarado[] }[];
}

export interface Patrimonio {
  totalVisivel: number;
  naXp: number;
  foraXp: number;
  shareOfWalletXp: number;
  porInstituicao: {
    instituicaoId: Id;
    nome: string;
    ehXp: boolean;
    investimentos: number;
    saldoContas: number;
    total: number;
  }[];
  porProduto: { produto: Produto | "SALDO_CONTA"; total: number }[];
}

export interface Principalidade {
  instituicaoPrincipalId: Id;
  instituicaoPrincipalNome: string;
  posicaoXp: PosicaoXp;
  explicacao: string;
  scores: ScoreInstituicao[];
}

export interface ComponentesPrincipalidade {
  renda: number;
  movimentacao: number;
  contasRecorrentes: number;
  investimentos: number;
  cartao: number;
  credito: number;
}

export interface ScoreInstituicao {
  instituicaoId: Id;
  nome: string;
  ehXp: boolean;
  score: number;
  /** 0–1 cada */
  participacoes: ComponentesPrincipalidade;
  /** pontos; somam o score */
  contribuicoes: ComponentesPrincipalidade;
  destaques: string[];
}

export interface FluxoCaixa {
  rendaMensal: number;
  fontesRenda: { pagadorNome: string; instituicaoId: Id; valorMensal: number; diaDoMes: number }[];
  custoVidaMensal: number;
  capacidadeAporteMensal: number;
  liquidezImediata: number;
  reservaEmergenciaMeses: number;
  parcial: boolean;
  observacao?: string;
}

export type TipoAlerta =
  | "FGC_EXCEDIDO"
  | "FGC_TETO_GLOBAL"
  | "CONCENTRACAO_EMISSOR"
  | "VENCIMENTO_PROXIMO"
  | "SALDO_PARADO"
  | "RENDA_FORA_XP"
  | "CONSENTIMENTO_EXPIRANDO"
  | "EVENTO_VIDA_PROXIMO"
  | "RESERVA_INSUFICIENTE";

export type Severidade = "ALTA" | "MEDIA" | "BAIXA";

export interface Alerta {
  id: Id;
  clienteId: Id;
  tipo: TipoAlerta;
  severidade: Severidade;
  titulo: string;
  explicacao: string;
  valor?: number;
  instituicaoId?: Id;
  emissorId?: Id;
  detectadoEm: string;
  novo: boolean;
}

export type TipoAcao =
  | "DIVERSIFICAR_FGC"
  | "REDUZIR_CONCENTRACAO"
  | "APLICAR_SALDO_PARADO"
  | "APORTE_PROGRAMADO"
  | "REINVESTIR_VENCIMENTO"
  | "RENOVAR_CONSENTIMENTO"
  | "CONTATO_RELACIONAMENTO"
  | "CONVIDAR_CONEXAO"
  | "MONTAR_RESERVA";

export interface AcaoSugerida {
  id: Id;
  clienteId: Id;
  tipo: TipoAcao;
  titulo: string;
  motivo: string;
  impactoEstimado?: string;
  alertaIds: Id[];
  principal: boolean;
}

export interface ItemFila {
  posicao: number;
  clienteId: Id;
  nome: string;
  perfil: PerfilInvestidor;
  prioridade: number;
  motivos: { texto: string; pontos: number }[];
  acaoPrincipal?: AcaoSugerida;
  posicaoXp: PosicaoXp;
  novo: boolean;
}

export interface PainelCarteira {
  assessorId: Id;
  totalClientes: number;
  patrimonioNaXp: number;
  patrimonioForaXpVisivel: number;
  pctClientesXpPrincipal: number;
  distribuicaoPosicaoXp: Record<PosicaoXp, number>;
  coberturaMedia: number;
  consentimentosExpirando15d: number;
  clientesComAlertaAlto: number;
}

export interface NivelJornada {
  numero: 1 | 2 | 3 | 4;
  nome: string;
  proximo?: string;
  comoSubir?: string;
  beneficios: string[];
}

export interface Jornada {
  clienteId: Id;
  completude: number;
  nivel: NivelJornada;
  missoes: Missao[];
  diagnosticos: Diagnostico[];
}

export interface Missao {
  id: Id;
  tipo: "CONECTAR_INSTITUICAO" | "CONECTAR_CARTAO" | "RESERVA_EMERGENCIA" | "RENOVAR_CONSENTIMENTO";
  titulo: string;
  descricao: string;
  recompensa: string;
  status: "DISPONIVEL" | "CONCLUIDA";
  progresso: number;
  instituicaoId?: Id;
}

export type TipoDiagnostico = "PATRIMONIO_COMPLETO" | "PROTECAO_FGC" | "CUSTO_DE_VIDA" | "RESERVA_EMERGENCIA";

export interface Diagnostico {
  tipo: TipoDiagnostico;
  titulo: string;
  desbloqueado: boolean;
  requisito: string;
  resumo?: string;
  detalhes?: Record<string, unknown>;
}

export type GeradoPor = "stub" | "cache" | "live";
export type Canal = "WHATSAPP" | "EMAIL";

export interface MensagemGerada {
  texto: string;
  canal: Canal;
  geradoPor: GeradoPor;
}

export interface Briefing {
  clienteId: Id;
  bullets: string[];
  perguntasSugeridas: string[];
  geradoPor: GeradoPor;
}

// ---------- §5 Endpoints (formas extras) ----------

export interface ClienteResumo {
  id: Id;
  nome: string;
  perfil: PerfilInvestidor;
  posicaoXp: PosicaoXp;
  prioridade: number;
}

export interface DemoEstado {
  dataReferencia: string;
  modoCopiloto: string;
}

export interface ErroApi {
  erro: string;
  mensagem: string;
}
