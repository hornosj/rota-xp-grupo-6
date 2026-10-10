// Estado do modo mock, guardado no localStorage para sobreviver a recarregamentos
// e ser compartilhado entre abas da mesma origem.
// Sempre relido a cada chamada; se o localStorage não existir, cai num fallback em memória.
import type { Anotacao, RecomendacaoProduto } from "@/lib/api-types";
import type { EdicaoCadastro } from "@/lib/api-types";

export interface EstadoMock {
  /** "clienteId|instituicaoId" → ISO de quando foi concedido */
  concessoes: Record<string, string>;
  /** "clienteId|instituicaoId" → ISO de quando foi revogado */
  revogacoes: Record<string, string>;
  /** token → convite de consentimento (modo mock) */
  convites: Record<string, ConviteMock>;
  /** clienteId → campos do cadastro editados pelo assessor (edição por voz) */
  edicoes: Record<string, EdicaoCadastro>;
  /** clienteId → notas do assessor ("nota de contexto") e produtos sugeridos */
  notas: Record<string, NotasMock>;
}

export interface NotasMock {
  anotacoes: Anotacao[];
  recomendacoes: RecomendacaoProduto[];
}

export interface ConviteMock {
  token: string;
  clienteId: string;
  instituicaoId: string;
  criadoEm: string;
  confirmadoEm?: string;
}

const CHAVE = "copiloto:mock:estado:v1";

let memoria: EstadoMock = vazio();

function vazio(): EstadoMock {
  return { concessoes: {}, revogacoes: {}, convites: {}, edicoes: {}, notas: {} };
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function lerEstado(): EstadoMock {
  const s = storage();
  if (!s) return memoria;
  try {
    const bruto = s.getItem(CHAVE);
    if (!bruto) return vazio();
    const obj = JSON.parse(bruto) as Partial<EstadoMock>;
    return {
      concessoes: obj.concessoes ?? {},
      revogacoes: obj.revogacoes ?? {},
      convites: obj.convites ?? {},
      notas: obj.notas ?? {},
      edicoes: obj.edicoes ?? {},
    };
  } catch {
    return memoria;
  }
}

function gravar(e: EstadoMock) {
  memoria = e;
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* sem storage: fica só em memória */
  }
}

export function lerNotas(clienteId: string): NotasMock {
  return lerEstado().notas[clienteId] ?? { anotacoes: [], recomendacoes: [] };
}

export function gravarNotas(clienteId: string, notas: NotasMock) {
  const e = lerEstado();
  e.notas[clienteId] = notas;
  gravar(e);
}

const chave = (clienteId: string, instituicaoId: string) => `${clienteId}|${instituicaoId}`;

export function registrarConcessao(clienteId: string, instituicaoId: string, quando = new Date().toISOString()) {
  const e = lerEstado();
  const k = chave(clienteId, instituicaoId);
  e.concessoes[k] = quando;
  delete e.revogacoes[k];
  gravar(e);
}

export function registrarRevogacao(clienteId: string, instituicaoId: string, quando = new Date().toISOString()) {
  const e = lerEstado();
  const k = chave(clienteId, instituicaoId);
  e.revogacoes[k] = quando;
  delete e.concessoes[k];
  gravar(e);
}

export function concedidoEm(clienteId: string, instituicaoId: string): string | undefined {
  return lerEstado().concessoes[chave(clienteId, instituicaoId)];
}

export function revogadoEm(clienteId: string, instituicaoId: string): string | undefined {
  return lerEstado().revogacoes[chave(clienteId, instituicaoId)];
}

export function lerConvites(): ConviteMock[] {
  return Object.values(lerEstado().convites);
}

export function gravarConvite(c: ConviteMock) {
  const e = lerEstado();
  e.convites[c.token] = c;
  gravar(e);
}

export function edicaoDe(clienteId: string): EdicaoCadastro | undefined {
  return lerEstado().edicoes[clienteId];
}

export function registrarEdicao(clienteId: string, edicao: EdicaoCadastro) {
  const e = lerEstado();
  e.edicoes[clienteId] = { ...e.edicoes[clienteId], ...edicao };
  gravar(e);
}

export function resetarEstado() {
  memoria = vazio();
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(CHAVE);
  } catch {
    /* ignore */
  }
}
