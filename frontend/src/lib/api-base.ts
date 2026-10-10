// Interface única da API (implementada pelo cliente HTTP e pelo modo mock).
import type {
  Briefing,
  CadastroInvestidor,
  Canal,
  ClienteResumo,
  ConsentimentoComNome,
  ConviteOnboarding,
  DemoEstado,
  FormularioOnboarding,
  Id,
  ItemFila,
  Jornada,
  MensagemGerada,
  PainelCarteira,
  Principalidade,
  ResultadoOnboarding,
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
  jornada(clienteId: Id): Promise<Jornada>;
  mensagem(clienteId: Id, acaoId: Id, canal: Canal): Promise<MensagemGerada>;
  briefing(clienteId: Id): Promise<Briefing>;
  resetDemo(): Promise<void>;
  demoEstado(): Promise<DemoEstado>;
  // Onboarding
  convites(): Promise<ConviteOnboarding[]>;
  criarConvite(nome: string): Promise<ConviteOnboarding>;
  /** 404 se o token não existir. Marca o convite como ABERTO. */
  formularioOnboarding(token: string): Promise<FormularioOnboarding>;
  /** 400 (INVALIDO) em dado inválido; 409 se já concluído ou CPF repetido. */
  concluirOnboarding(token: string, cadastro: CadastroInvestidor): Promise<ResultadoOnboarding>;
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
