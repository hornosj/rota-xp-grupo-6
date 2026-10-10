// Radar de notícias no modo mock: respostas REAIS do backend gravadas em ./fixtures-radar
// (seed + 20 notícias curadas, copiloto em stub). A Marina alterna entre "antes" e "depois"
// do consentimento do Banco Horizonte, como o resto do mock. A carteira é montada só com os
// clientes que o mock conhece (a real tem clientes de fundo com outros nomes).
import { primeiroNome } from "@/lib/formato";
import type { DirecaoNoticia, Id, ImpactoNoticia, MotivoNoticia, NoticiaClassificada, ResultadoProcessamento } from "@/lib/api-types";
import marinaAntes from "./fixtures-radar/cliente-cli-001-antes.json";
import marinaDepois from "./fixtures-radar/cliente-cli-001-depois.json";
import carlos from "./fixtures-radar/cliente-cli-002.json";
import juliana from "./fixtures-radar/cliente-cli-003.json";
import patricia from "./fixtures-radar/cliente-cli-004.json";
import roberto from "./fixtures-radar/cliente-cli-005.json";
import lucas from "./fixtures-radar/cliente-cli-006.json";
import motivoMarinaHorizonte from "./fixtures-radar/motivo-cli-001-not-002.json";
import motivoRobertoAgroSul from "./fixtures-radar/motivo-cli-005-not-001.json";
import noticias from "./fixtures-radar/noticias.json";
import processar from "./fixtures-radar/processar.json";

// JSON importado tem strings "largas"; a forma é conferida em src/lib/contrato.test.ts.
const como = <T>(x: unknown): T => structuredClone(x) as T;

const POR_CLIENTE: Record<Id, unknown> = {
  "cli-002": carlos,
  "cli-003": juliana,
  "cli-004": patricia,
  "cli-005": roberto,
  "cli-006": lucas,
};

const MOTIVOS: Record<string, unknown> = {
  "cli-001|not-002": motivoMarinaHorizonte,
  "cli-005|not-001": motivoRobertoAgroSul,
};

export function noticiasMock(): NoticiaClassificada[] {
  return como<NoticiaClassificada[]>(noticias);
}

/** Radar do cliente (lista vazia se não há fixture para ele). */
export function radarDoCliente(clienteId: Id, marinaConectada: boolean): ImpactoNoticia[] {
  if (clienteId === "cli-001") return como<ImpactoNoticia[]>(marinaConectada ? marinaDepois : marinaAntes);
  const f = POR_CLIENTE[clienteId];
  return f ? como<ImpactoNoticia[]>(f) : [];
}

export function radarDaCarteira(clientes: Id[], marinaConectada: boolean, limite: number): ImpactoNoticia[] {
  return clientes
    .flatMap((id) => radarDoCliente(id, marinaConectada))
    .sort((a, b) => b.pontos - a.pontos || a.clienteId.localeCompare(b.clienteId))
    .slice(0, Math.max(0, limite));
}

const SUGESTAO: Record<DirecaoNoticia, string> = {
  NEGATIVA:
    "A notícia aumenta o risco dessa parte da carteira. Sugestão: ligar hoje, explicar o fato com calma e avaliar com o cliente se faz sentido reduzir ou diversificar essa exposição.",
  POSITIVA:
    "A notícia é favorável a essa parte da carteira. Sugestão: aproveitar para um contato de relacionamento e revisar os objetivos.",
  NEUTRA:
    "A notícia pode mudar o cenário dessa parte da carteira. Sugestão: revisar a posição com o cliente na próxima conversa.",
};

/** Mesmo texto do modo stub do backend (Copiloto.redigirMotivoNoticia). */
export function motivoDe(impacto: ImpactoNoticia): MotivoNoticia {
  const gravado = MOTIVOS[`${impacto.clienteId}|${impacto.noticiaId}`];
  if (gravado) return como<MotivoNoticia>(gravado);
  return {
    texto: `${primeiroNome(impacto.clienteNome)} tem ${impacto.motivo}. Notícia: "${impacto.titulo}" (${impacto.fonte}). ${SUGESTAO[impacto.direcao]}`,
    geradoPor: "stub",
  };
}

export function processarMock(): ResultadoProcessamento {
  return { ...como<ResultadoProcessamento>(processar), processadoEm: new Date().toISOString() };
}
