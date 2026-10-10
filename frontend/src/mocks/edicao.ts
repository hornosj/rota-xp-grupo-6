// Edição do cadastro por voz no modo mock: as frases típicas do CopilotoStub e as regras do RegrasCadastro
// (backend), em versão enxuta. Não há Whisper aqui: o assessor digita o que mudou.
import { ApiError } from "@/lib/api-base";
import type { AlteracaoCampo, CampoCadastro, Cliente, EdicaoCadastro, PerfilInvestidor, PropostaEdicao } from "@/lib/api-types";
import { rotuloPerfil } from "@/lib/rotulos";

const IDADE_MINIMA = 18;
const IDADE_MAXIMA = 120;
const PARTICULAS = new Set(["de", "da", "do", "dos", "das", "e"]);
const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

// Os verbos ignoram maiúsculas; o valor capturado é recortado depois por nomeProprio (que não ignora).
const CIDADE =
  /\b(?:mudou-se|se mudou|mudou|vai se mudar|foi morar|passou a morar|est[áa] morando|mora|reside)\s+(?:agora\s+)?(?:para|pra|em|no)\s+(?:(?:o|a)\s+)?([^,.;!?]+)/giu;
const PROFISSAO =
  /\b(?:agora (?:ela |ele )?(?:é|trabalha como|atua como)|virou|passou a ser|trabalha como|atua como|começou a trabalhar como|profiss[ãa]o (?:dela |dele )?(?:agora )?(?:é|mudou para|passou a ser))\s+(?:(?:um|uma|o|a)\s+)?([^,.;!?]+)/giu;
const IDADE =
  /\b(?:fez|faz|completou|completa|tem|est[áa] com|idade (?:dela |dele )?(?:agora )?(?:é|de))\s+(\d{1,3})\s+anos(?!\s+de\s+(?!idade))/giu;
const NOME =
  /\bnome\s+(?:(?:correto|certo|completo)\s+)?(?:(?:dela|dele|do cliente|da cliente)\s+)?(?:agora\s+)?(?:é|para|passa a ser|fica)\s+([^,.;!?]+)/giu;
const PERFIL = /perfil[^.!?]*\b(conservador|moderad[oa]|arrojad[oa]|agressiv[oa])/giu;
const PALAVRA_DE_PERFIL = /\bperfil\b|conservador|moderad[oa]|arrojad[oa]|agressiv[oa]/iu;
const OUTRO_CAMPO = /\b(?:nome|idade|cidade|perfil)\b/iu;
const FIM_DA_PROFISSAO = /\s+(?:e|mas|que|porque|pois|desde|há)\s+.*$/iu;
const NOME_PROPRIO = /^\p{Lu}[\p{L}'-]*(?:\s+(?:(?:de|da|do|dos|das|e)\s+)?\p{Lu}[\p{L}'-]*)*(?:\s*[/-]\s*\p{Lu}{2}\b)?/u;

const nomeProprio = (s: string) => NOME_PROPRIO.exec(s.trim())?.[0] ?? null;

/** A última ocorrência vale: o assessor costuma se corrigir no fim. */
function ultimo(re: RegExp, texto: string, valor: (m: RegExpExecArray) => string | null): string | null {
  let r: string | null = null;
  for (const m of texto.matchAll(re)) r = valor(m) ?? r;
  return r;
}

interface CamposDitos {
  nome: string | null;
  idade: string | null;
  profissao: string | null;
  cidade: string | null;
  perfil: string | null;
}

export function extrairCampos(texto: string): CamposDitos {
  return {
    nome: ultimo(NOME, texto, (m) => {
      const n = nomeProprio(m[1]);
      return n && n.includes(" ") ? n : null;
    }),
    idade: ultimo(IDADE, texto, (m) => m[1]),
    cidade: ultimo(CIDADE, texto, (m) => {
      const c = nomeProprio(m[1]);
      return c && !PALAVRA_DE_PERFIL.test(c) ? c : null;
    }),
    perfil: ultimo(PERFIL, texto, (m) => m[1]),
    profissao: ultimo(PROFISSAO, texto, (m) => {
      const inicio = m.index ?? 0;
      const antes = texto.slice(Math.max(0, texto.lastIndexOf(".", inicio), texto.lastIndexOf(",", inicio)), inicio);
      const p = m[1].replace(FIM_DA_PROFISSAO, "").trim();
      return p && !OUTRO_CAMPO.test(antes) && !PALAVRA_DE_PERFIL.test(p) && !/\d/.test(p) ? p : null;
    }),
  };
}

// ---------------------------------------------------------------- regras

const invalido = (mensagem: string) => new ApiError(400, mensagem, "REQUISICAO_INVALIDA");
const limpo = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[\s.,;:!?]+$/, "");
const inicial = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

function titulo(s: string): string {
  return limpo(s)
    .split(" ")
    .map((p, i) => {
      const min = p.toLowerCase();
      if (i > 0 && PARTICULAS.has(min)) return min;
      return p === p.toUpperCase() || p === min ? inicial(min) : inicial(p);
    })
    .join(" ");
}

function nome(bruto: string): string {
  const v = limpo(bruto);
  if (!/^\p{L}[\p{L}'. -]*$/u.test(v) || v.split(" ").length < 2) {
    throw invalido(`Nome "${bruto.trim()}" inválido: use nome e sobrenome.`);
  }
  return titulo(v);
}

function idade(valor: number): number {
  if (!Number.isInteger(valor) || valor < IDADE_MINIMA || valor > IDADE_MAXIMA) {
    throw invalido(`Idade ${valor} fora do intervalo aceito (${IDADE_MINIMA} a ${IDADE_MAXIMA} anos).`);
  }
  return valor;
}

function profissao(bruto: string): string {
  const v = limpo(bruto);
  if (!v) throw invalido(`Profissão "${bruto.trim()}" inválida.`);
  return inicial(v);
}

function cidade(bruto: string): string {
  const v = limpo(bruto);
  if (!v || /\d/.test(v)) throw invalido(`Cidade "${bruto.trim()}" inválida.`);
  const m = /^(.+?)\s*[/,-]\s*(\p{L}{2})$/u.exec(v);
  if (m && UFS.has(m[2].toUpperCase())) return `${titulo(m[1])}/${m[2].toUpperCase()}`;
  return titulo(v);
}

function perfil(bruto: string): PerfilInvestidor | null {
  const v = bruto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (v.startsWith("conserv")) return "CONSERVADOR";
  if (v.startsWith("moder")) return "MODERADO";
  if (v.startsWith("arroj")) return "ARROJADO";
  if (v.startsWith("agress")) return "AGRESSIVO";
  return null;
}

export function proporEdicaoMock(cliente: Cliente, transcricao: string): PropostaEdicao {
  const t = transcricao.trim();
  if (!t) throw invalido("Transcrição vazia: grave um áudio ou digite o que mudou.");
  const ditos = extrairCampos(t);
  const alteracoes: AlteracaoCampo[] = [];
  const avisos: string[] = [];
  const comparar = (campo: CampoCadastro, dito: string | null, atual: string, normalizar: (v: string) => string) => {
    if (!dito?.trim()) return;
    try {
      const novo = normalizar(dito);
      if (novo.toLowerCase() !== atual.toLowerCase()) alteracoes.push({ campo, valorAtual: atual, valorNovo: novo });
    } catch (e) {
      avisos.push(e instanceof Error ? e.message : String(e));
    }
  };
  comparar("NOME", ditos.nome, cliente.nome, nome);
  comparar("IDADE", ditos.idade, String(cliente.idade), (v) => String(idade(Number(v))));
  comparar("PROFISSAO", ditos.profissao, cliente.profissao, profissao);
  comparar("CIDADE", ditos.cidade, cliente.cidade, cidade);
  const p = ditos.perfil ? perfil(ditos.perfil) : null;
  if (p && p !== cliente.perfil) {
    avisos.push(
      `O perfil de investidor não muda por voz: para ir de ${rotuloPerfil[cliente.perfil]} para ${rotuloPerfil[p]}, ` +
        "é preciso refazer o questionário de suitability.",
    );
  }
  return { clienteId: cliente.id, transcricao: t, alteracoes, avisos, geradoPor: "stub" };
}

/** Valida como o PATCH do backend (400 em valor inválido) e devolve os campos normalizados. */
export function validarEdicaoMock(e: EdicaoCadastro): EdicaoCadastro {
  const r: EdicaoCadastro = {};
  if (e.nome !== undefined) r.nome = nome(e.nome);
  if (e.idade !== undefined) r.idade = idade(e.idade);
  if (e.profissao !== undefined) r.profissao = profissao(e.profissao);
  if (e.cidade !== undefined) r.cidade = cidade(e.cidade);
  if (Object.keys(r).length === 0) throw invalido("Nada para alterar: informe nome, idade, profissão ou cidade.");
  return r;
}
