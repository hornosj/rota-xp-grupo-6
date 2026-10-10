// Convites de consentimento Open Finance no modo mock (espelha BE1-11).
// Guardados no mesmo estado do localStorage (./estado.ts) para as abas abertas compartilharem.
import { ApiError } from "@/lib/api-base";
import type { Canal, Convite, Id, MensagemGerada, Visao360 } from "@/lib/api-types";
import { primeiroNome } from "@/lib/formato";
import { gravarConvite, lerConvites, registrarConcessao, type ConviteMock } from "./estado";

export const PRAZO_MESES = 12;
export const VALIDADE_MS = 48 * 60 * 60 * 1000;

/** Ação CONVIDAR_CONEXAO no formato do backend: acao-{clienteId}-convidar_conexao-{instituicaoId}. */
const RE_ACAO_CONVIDAR = /^acao-(.+)-convidar_conexao-(.+)$/;

export function instituicaoDaAcaoConvidar(acaoId: Id): Id | null {
  return RE_ACAO_CONVIDAR.exec(acaoId)?.[2] ?? null;
}

function origem(): string {
  try {
    if (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null") {
      return window.location.origin;
    }
  } catch {
    /* sem window */
  }
  return "http://localhost:3000";
}

function expiraEm(m: ConviteMock): string {
  return new Date(new Date(m.criadoEm).getTime() + VALIDADE_MS).toISOString();
}

function status(m: ConviteMock): Convite["status"] {
  if (m.confirmadoEm) return "CONFIRMADO";
  return Date.now() > new Date(expiraEm(m)).getTime() ? "EXPIRADO" : "PENDENTE";
}

function paraConvite(m: ConviteMock, v: Visao360): Convite {
  const cons = v.consentimentos.find((c) => c.instituicaoId === m.instituicaoId);
  return {
    token: m.token,
    clienteId: m.clienteId,
    instituicaoId: m.instituicaoId,
    instituicaoNome: cons?.instituicaoNome ?? m.instituicaoId,
    escopos: cons?.escopos ?? ["CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"],
    prazoMeses: PRAZO_MESES,
    link: `${origem()}/convite/${m.token}`,
    status: status(m),
    criadoEm: m.criadoEm,
    expiraEm: expiraEm(m),
  };
}

function tokenLivre(clienteId: Id, instituicaoId: Id): string {
  const base = `cv-${clienteId}-${instituicaoId}`;
  const usados = new Set(lerConvites().map((c) => c.token));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** `visao` = a 360 atual do cliente (para nome da instituição, escopos e se já está conectada). */
export function criarConviteMock(v: Visao360, instituicaoId: Id): Convite {
  const clienteId = v.cliente.id;
  const cons = v.consentimentos.find((c) => c.instituicaoId === instituicaoId);
  if (!cons) {
    throw new ApiError(404, `Instituição ${instituicaoId} não encontrada para ${clienteId}`, "INSTITUICAO_NAO_ENCONTRADA");
  }
  if (cons.status === "ATIVO") {
    throw new ApiError(409, `${cons.instituicaoNome} já está conectado`, "CONFLITO");
  }
  const pendente = lerConvites().find(
    (c) => c.clienteId === clienteId && c.instituicaoId === instituicaoId && status(c) === "PENDENTE",
  );
  if (pendente) return paraConvite(pendente, v);
  const novo: ConviteMock = {
    token: tokenLivre(clienteId, instituicaoId),
    clienteId,
    instituicaoId,
    criadoEm: new Date().toISOString(),
  };
  gravarConvite(novo);
  return paraConvite(novo, v);
}

export function convitesDoCliente(v: Visao360): Convite[] {
  return lerConvites()
    .filter((c) => c.clienteId === v.cliente.id)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    .map((c) => paraConvite(c, v));
}

/** `visaoDe` resolve a 360 do cliente dono do convite. 404 se o token não existe. */
export function buscarConviteMock(token: string, visaoDe: (clienteId: Id) => Visao360): Convite {
  const m = lerConvites().find((c) => c.token === token);
  if (!m) throw new ApiError(404, "Convite não encontrado", "NAO_ENCONTRADO");
  return paraConvite(m, visaoDe(m.clienteId));
}

/** Confirma (chama o "conceder"). Já confirmado = sucesso (o front trata o 409 assim); expirado = 410. */
export function confirmarConviteMock(token: string, visaoDe: (clienteId: Id) => Visao360): Convite {
  const m = lerConvites().find((c) => c.token === token);
  if (!m) throw new ApiError(404, "Convite não encontrado", "NAO_ENCONTRADO");
  const s = status(m);
  if (s === "EXPIRADO") throw new ApiError(410, "Este convite expirou. Peça um novo link para sua assessora.", "EXPIRADO");
  if (s === "PENDENTE") {
    const agora = new Date().toISOString();
    gravarConvite({ ...m, confirmadoEm: agora });
    registrarConcessao(m.clienteId, m.instituicaoId, agora);
  }
  return paraConvite(lerConvites().find((c) => c.token === token)!, visaoDe(m.clienteId));
}

/** Texto do stub para CONVIDAR_CONEXAO (igual ao do backend), já com o link do convite. */
export function mensagemConvite(v: Visao360, c: Convite, canal: Canal): MensagemGerada {
  const texto = `Oi, ${primeiroNome(v.cliente.nome)}! Para eu enxergar seu patrimônio completo e checar sua proteção no FGC, você pode conectar o ${c.instituicaoNome} por aqui: ${c.link}. Leva 1 minuto e você pode revogar quando quiser.`;
  return {
    texto:
      canal === "EMAIL"
        ? `Assunto: Convite para conectar o ${c.instituicaoNome}\n\n${texto}\n\nAbraço,\nSua assessora XP`
        : texto,
    canal,
    geradoPor: "stub",
  };
}
