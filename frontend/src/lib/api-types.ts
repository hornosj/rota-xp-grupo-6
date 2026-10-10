// Tipos do contrato da API — escritos à mão a partir do docs/PLAN.md §4 e §5.
// O contrato real (contract/openapi.json) gera src/lib/api-types.gen.ts (`npm run gen:api`);
// como o springdoc marca todo campo como opcional, mantemos aqui os tipos "fortes" que o app usa
// e conferimos a compatibilidade com o gerado e com as fixtures reais em src/lib/contrato.test.ts.
// O backend omite campos nulos (Jackson NON_NULL): campo que pode faltar é opcional aqui.

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
  /** Edição do cadastro por voz: falta em backends antigos. */
  transcricao?: TranscricaoVoz;
}

// ---------- Edição do cadastro por voz (aditivo) ----------

export interface TranscricaoVoz {
  /** false sem chave do Whisper no servidor: o assessor digita o que mudou. */
  disponivel: boolean;
  modelo?: string;
}

/** O perfil de investidor fica de fora: vem do questionário de suitability. */
export type CampoCadastro = "NOME" | "IDADE" | "PROFISSAO" | "CIDADE";

export interface Transcricao {
  texto: string;
  modelo: string;
}

export interface AlteracaoCampo {
  campo: CampoCadastro;
  valorAtual?: string;
  valorNovo: string;
}

/** Só uma proposta: nada é gravado até o assessor confirmar (PATCH). */
export interface PropostaEdicao {
  clienteId: Id;
  transcricao: string;
  alteracoes: AlteracaoCampo[];
  /** O que foi entendido mas não entra na proposta (valor inválido, perfil de investidor). */
  avisos: string[];
  geradoPor: GeradoPor;
}

/** Corpo do PATCH /clientes/{id}: só os campos que mudam. */
export interface EdicaoCadastro {
  nome?: string;
  idade?: number;
  profissao?: string;
  cidade?: string;
}

// ---------- Radar de notícias (BE2-10, aditivo) ----------

export type IndexadorRadar = "CDI" | "IPCA" | "PRE" | "SELIC";
export type DirecaoNoticia = "POSITIVA" | "NEGATIVA" | "NEUTRA";
export type OrigemClassificacao = "REFERENCIA" | "REGRAS" | "LLM";

export interface Noticia {
  id: Id;
  fonte: string;
  titulo: string;
  resumo?: string;
  url?: string;
  /** ISO com fuso. */
  publicadaEm?: string;
}

export interface ClassificacaoNoticia {
  /** Ids de emissor (ex.: "emi-horizonte"), não nomes. */
  emissores: string[];
  indexadores: IndexadorRadar[];
  produtos: Produto[];
  direcao: DirecaoNoticia;
  /** 0–1 */
  relevancia: number;
  resumoImpacto?: string;
  origem: OrigemClassificacao;
}

export interface NoticiaClassificada {
  noticia: Noticia;
  classificacao: ClassificacaoNoticia;
}

export interface ResultadoProcessamento {
  coletadas: number;
  novas: number;
  classificadasPorLlm: number;
  classificadasPorRegra: number;
  lotes: number;
  processadoEm: string;
}

/** Uma notícia que mexe na carteira visível de um cliente (calculado por regra). */
export interface ImpactoNoticia {
  clienteId: Id;
  clienteNome: string;
  noticiaId: Id;
  titulo: string;
  fonte: string;
  direcao: DirecaoNoticia;
  /** 0–100 */
  pontos: number;
  /** reais */
  valorExposto: number;
  /** 0–1 */
  fracaoPatrimonio: number;
  motivo: string;
  gatilhos: string[];
}

/** Texto para o ASSESSOR: por que ligar e do que falar. */
export interface MotivoNoticia {
  texto: string;
  geradoPor: GeradoPor;
}

// ---------- Convite de consentimento Open Finance (reescopo, aditivo) ----------

export type StatusConvite = "PENDENTE" | "CONFIRMADO" | "EXPIRADO";

/** Convite que o assessor envia ao cliente para conectar uma instituição pelo Open Finance. */
export interface Convite {
  token: string;
  clienteId: Id;
  instituicaoId: Id;
  instituicaoNome: string;
  escopos: Escopo[];
  /** 12 */
  prazoMeses: number;
  /** ex.: http://localhost:3000/convite/{token} */
  link: string;
  status: StatusConvite;
  /** ISO com fuso */
  criadoEm: string;
  /** ISO com fuso; 48h depois de criadoEm */
  expiraEm: string;
}

export interface ErroApi {
  erro: string;
  mensagem: string;
}

// ---------- Onboarding do investidor (convite do assessor → cadastro pelo link) ----------

export type StatusConviteOnboarding = "PENDENTE" | "ABERTO" | "CONCLUIDO";
export type TipoEventoVida = EventoVida["tipo"];

export interface ConviteOnboarding {
  id: Id;
  token: string;
  /** Caminho relativo do formulário no front (ex.: /onboarding/{token}). */
  link: string;
  nome: string;
  assessorId: Id;
  status: StatusConviteOnboarding;
  criadoEm: string;
  abertoEm?: string;
  concluidoEm?: string;
  clienteId?: Id;
  perfil?: PerfilInvestidor;
}

export interface OpcaoSuitability {
  id: string;
  texto: string;
}

export interface PerguntaSuitability {
  id: string;
  texto: string;
  opcoes: OpcaoSuitability[];
}

export interface InstituicaoDisponivel {
  id: Id;
  nome: string;
}

export interface FormularioOnboarding {
  convite: ConviteOnboarding;
  instituicoes: InstituicaoDisponivel[];
  questionario: PerguntaSuitability[];
  produtos: ProdutoDeclarado[];
}

export interface RespostaSuitability {
  perguntaId: string;
  opcaoId: string;
}

export interface InstituicaoInformada {
  instituicaoId: Id;
  produtos: ProdutoDeclarado[];
  compartilharAgora: boolean;
}

export interface EventoPlanejado {
  tipo: TipoEventoVida;
  descricao: string;
  data: string;
}

export interface CadastroInvestidor {
  nome: string;
  cpf: string;
  dataNascimento: string;
  email: string;
  celular: string;
  profissao: string;
  cidade: string;
  uf: string;
  dependentes: Dependente[];
  eventosVida: EventoPlanejado[];
  respostasSuitability: RespostaSuitability[];
  instituicoes: InstituicaoInformada[];
  aceiteTermos: boolean;
}

export interface ResultadoOnboarding {
  convite: ConviteOnboarding;
  clienteId: Id;
  perfil: PerfilInvestidor;
  pontuacaoSuitability: number;
  consentimentos: ConsentimentoComNome[];
}

// ---------- Calculadora de deságio (FE1-11, aditivo) ----------

export type Indexador = "CDI" | "IPCA" | "PRE" | "SELIC" | "NA";

/** Premissas ilustrativas usadas para estimar a taxa anual de títulos pós-fixados (frações 0–1). */
export interface PremissasMercado {
  cdiAnual: number;
  ipcaAnual: number;
  selicAnual: number;
}

/** Uma posição de investimento visível e se ela permite simular venda com deságio. */
export interface PosicaoDesagio {
  posicaoId: Id;
  nome: string;
  produto: Produto;
  indexador: Indexador;
  instituicaoId: Id;
  instituicaoNome?: string;
  emissorNome?: string;
  valorAplicado: number;
  valorAtual: number;
  dataAplicacao?: string;
  vencimento?: string;
  /** anos até o vencimento (falta sem vencimento) */
  prazoRestanteAnos?: number;
  taxaTexto?: string;
  /** fração a.a.; falta quando a taxa não pode ser interpretada */
  taxaAnualEstimada?: number;
  /** true quando a taxa anual depende de premissa (CDI, IPCA, Selic) */
  taxaDependeDePremissa: boolean;
  elegivel: boolean;
  motivoInelegibilidade?: string;
}

export interface PosicoesDesagio {
  clienteId: Id;
  clienteNome: string;
  dataReferencia: string;
  premissas: PremissasMercado;
  /** elegíveis primeiro, por vencimento */
  posicoes: PosicaoDesagio[];
}

/** Informe exatamente um entre `desagio` (fração 0–1) e `precoVenda` (R$). Com `posicaoId`, o resto vem da posição. */
export interface DesagioPedido {
  clienteId?: Id;
  posicaoId?: Id;
  valorAtual?: number;
  taxaAntiga?: number;
  prazoRestanteAnos?: number;
  desagio?: number;
  precoVenda?: number;
  taxaNova: number;
}

export interface EntradaUsada {
  posicaoId?: Id;
  posicaoNome?: string;
  valorAtual: number;
  taxaAntiga: number;
  taxaNova: number;
  prazoRestanteAnos: number;
  desagio: number;
  precoVenda: number;
}

export interface PontoSerie {
  mes: number;
  anos: number;
  valorManter: number;
  valorVender: number;
  diferenca: number;
}

export interface DesagioDetalhado {
  entrada: EntradaUsada;
  perdaImediata: number;
  valorFinalManter: number;
  valorFinalVender: number;
  ganhoDaTroca: number;
  ganhoDaTrocaPercentual: number;
  /** anos até recuperar o deságio; falta quando a nova taxa não supera a atual (nunca recupera) */
  breakEvenAnos?: number;
  breakEvenMeses?: number;
  /** break-even antes do vencimento */
  compensa: boolean;
  desagioMaximoQueCompensa?: number;
  precoMinimoQueCompensa?: number;
  spreadTaxas: number;
  serie: PontoSerie[];
  explicacao: string;
  premissas: string[];
  avisos: string[];
}
