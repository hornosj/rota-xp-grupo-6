// Interface única da API (implementada pelo cliente HTTP e pelo modo mock).
import type {
  Briefing,
  Canal,
  ClienteResumo,
  ConsentimentoComNome,
  DemoEstado,
  Id,
  ItemFila,
  Jornada,
  MensagemGerada,
  PainelCarteira,
  Principalidade,
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
