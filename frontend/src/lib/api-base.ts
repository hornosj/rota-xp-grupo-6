// Interface única da API (implementada pelo cliente HTTP e pelo modo mock).
import type {
  Briefing,
  ContextoAssessor,
  CadastroInvestidor,
  Canal,
  ClienteResumo,
  ConsentimentoComNome,
  ConviteOnboarding,
  Convite,
  DemoEstado,
  EdicaoCadastro,
  FormularioOnboarding,
  Id,
  ImpactoNoticia,
  ItemFila,
  MensagemGerada,
  MotivoNoticia,
  NoticiaClassificada,
  OrigemAnotacao,
  PainelCarteira,
  Principalidade,
  ResultadoNota,
  PropostaEdicao,
  ResultadoOnboarding,
  ResultadoProcessamento,
  Transcricao,
  Visao360,
} from "./api-types";

export interface Api {
  listarClientes(): Promise<ClienteResumo[]>;
  visao360(clienteId: Id): Promise<Visao360>;
  principalidade(clienteId: Id): Promise<Principalidade>;
  consentimentos(clienteId: Id): Promise<ConsentimentoComNome[]>;
  /** 409 (já ativo) é tratado como sucesso. */
  conceder(clienteId: Id, instituicaoId: Id): Promise<Visao360>;
  revogar(clienteId: Id, instituicaoId: Id): Promise<Visao360>;
  fila(): Promise<ItemFila[]>;
  painel(): Promise<PainelCarteira>;
  mensagem(clienteId: Id, acaoId: Id, canal: Canal): Promise<MensagemGerada>;
  briefing(clienteId: Id): Promise<Briefing>;
  resetDemo(): Promise<void>;
  demoEstado(): Promise<DemoEstado>;
  // Radar de notícias
  noticiasRadar(): Promise<NoticiaClassificada[]>;
  processarRadar(): Promise<ResultadoProcessamento>;
  /** Ordenado por pontos (desc). Depende dos consentimentos do cliente. */
  radarCliente(clienteId: Id): Promise<ImpactoNoticia[]>;
  /** Toda a carteira, por pontos (desc). Padrão: 20. */
  radarCarteira(limite?: number): Promise<ImpactoNoticia[]>;
  /** 404 se a notícia não mexe na carteira do cliente. */
  motivoNoticia(clienteId: Id, noticiaId: Id): Promise<MotivoNoticia>;
  // Convites de consentimento Open Finance
  /** Reaproveita o PENDENTE se existir. 409 se a instituição já está conectada. */
  criarConvite(clienteId: Id, instituicaoId: Id): Promise<Convite>;
  convites(clienteId: Id): Promise<Convite[]>;
  /** 404 se o token não existe. */
  convite(token: string): Promise<Convite>;
  /** 409 (já confirmado) é tratado como sucesso; 410 se expirado; 404 se não existe. */
  confirmarConvite(token: string): Promise<Convite>;
  // Notas do assessor ("editar cliente"): o áudio é transcrito no navegador; só o texto vai ao backend
  /** 400 se a nota estiver vazia. */
  registrarNota(clienteId: Id, transcricao: string, origem: OrigemAnotacao): Promise<ResultadoNota>;
  contextoAssessor(clienteId: Id): Promise<ContextoAssessor>;
  // Onboarding
  convitesOnboarding(): Promise<ConviteOnboarding[]>;
  criarConviteOnboarding(nome: string): Promise<ConviteOnboarding>;
  /** 404 se o token não existir. Marca o convite como ABERTO. */
  formularioOnboarding(token: string): Promise<FormularioOnboarding>;
  /** 400 (REQUISICAO_INVALIDA) em dado inválido; 409 se já concluído ou CPF repetido. */
  concluirOnboarding(token: string, cadastro: CadastroInvestidor): Promise<ResultadoOnboarding>;
  // Edição do cadastro por voz
  /** Whisper. 503 sem chave configurada no servidor; 502 se o serviço falhar; 400 em formato não suportado. */
  transcreverAudio(clienteId: Id, audio: Blob, nomeArquivo: string): Promise<Transcricao>;
  /** Só propõe: nada é gravado. 400 se a transcrição estiver vazia. */
  proporEdicao(clienteId: Id, transcricao: string): Promise<PropostaEdicao>;
  /** Grava o que o assessor confirmou e devolve a 360 recalculada. 400 em valor inválido. */
  editarCliente(clienteId: Id, edicao: EdicaoCadastro): Promise<Visao360>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly erro?: string;

  constructor(status: number, mensagem: string, erro?: string) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.erro = erro;
  }
}
