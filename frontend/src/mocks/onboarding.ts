// Onboarding no modo mock: convites no localStorage (como ./estado.ts), perfil pelo mesmo
// questionário e limites do backend (application.yml → onboarding.suitability).
// O cliente criado aqui não ganha 360/jornada no mock — só o backend real faz isso.
import { ApiError } from "@/lib/api-base";
import type {
  CadastroInvestidor,
  Escopo,
  ConviteOnboarding,
  FormularioOnboarding,
  PerfilInvestidor,
  PerguntaSuitability,
  ProdutoDeclarado,
  ResultadoOnboarding,
} from "@/lib/api-types";

const CHAVE = "copiloto:mock:convites:v1";
const LIMITES: [number, PerfilInvestidor][] = [
  [8, "CONSERVADOR"],
  [12, "MODERADO"],
  [16, "ARROJADO"],
];

export const QUESTIONARIO: PerguntaSuitability[] = [
  {
    id: "objetivo",
    texto: "Qual é o seu principal objetivo ao investir?",
    opcoes: [
      { id: "a", texto: "Preservar o que já tenho, sem correr riscos" },
      { id: "b", texto: "Ter uma renda complementar estável" },
      { id: "c", texto: "Fazer o patrimônio crescer no médio prazo" },
      { id: "d", texto: "Buscar o maior retorno, aceitando oscilações fortes" },
    ],
  },
  {
    id: "prazo",
    texto: "Por quanto tempo você pretende deixar a maior parte do dinheiro investida?",
    opcoes: [
      { id: "a", texto: "Até 1 ano" },
      { id: "b", texto: "De 1 a 3 anos" },
      { id: "c", texto: "De 3 a 5 anos" },
      { id: "d", texto: "Mais de 5 anos" },
    ],
  },
  {
    id: "queda",
    texto: "Se seus investimentos caíssem 15% em um mês, o que você faria?",
    opcoes: [
      { id: "a", texto: "Resgataria tudo" },
      { id: "b", texto: "Resgataria uma parte" },
      { id: "c", texto: "Manteria e esperaria recuperar" },
      { id: "d", texto: "Aproveitaria para investir mais" },
    ],
  },
  {
    id: "experiencia",
    texto: "Com quais investimentos você já tem experiência?",
    opcoes: [
      { id: "a", texto: "Poupança ou nenhum" },
      { id: "b", texto: "CDB, Tesouro e fundos de renda fixa" },
      { id: "c", texto: "Também ações e fundos imobiliários" },
      { id: "d", texto: "Também derivativos, cripto ou operações frequentes" },
    ],
  },
  {
    id: "reserva",
    texto: "Quanto do seu patrimônio pode ficar investido sem que você precise resgatar?",
    opcoes: [
      { id: "a", texto: "Menos de 10%" },
      { id: "b", texto: "De 10% a 30%" },
      { id: "c", texto: "De 30% a 60%" },
      { id: "d", texto: "Mais de 60%" },
    ],
  },
];

const INSTITUICOES = [
  { id: "inst-aurora", nome: "Banco Aurora" },
  { id: "inst-aurora-fin", nome: "Aurora Financeira" },
  { id: "inst-horizonte", nome: "Banco Horizonte" },
  { id: "inst-ipe", nome: "Banco Ipê" },
];

const ESCOPO: Record<ProdutoDeclarado, Escopo> = { CONTA: "CONTAS", CARTAO: "CARTOES", CREDITO: "CREDITO", INVESTIMENTOS: "INVESTIMENTOS" };

let memoria: ConviteOnboarding[] = [];

function ler(): ConviteOnboarding[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return memoria;
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as ConviteOnboarding[]) : [];
  } catch {
    return memoria;
  }
}

function gravar(lista: ConviteOnboarding[]) {
  memoria = lista;
  try {
    if (typeof window !== "undefined") window.localStorage?.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* sem storage: fica só em memória */
  }
}

function achar(token: string): ConviteOnboarding {
  const c = ler().find((x) => x.token === token);
  if (!c) throw new ApiError(404, `Convite ${token} não encontrado`, "NAO_ENCONTRADO");
  return c;
}

function substituir(c: ConviteOnboarding) {
  gravar(ler().map((x) => (x.token === c.token ? c : x)));
}

export function resetarConvites() {
  memoria = [];
  try {
    if (typeof window !== "undefined") window.localStorage?.removeItem(CHAVE);
  } catch {
    /* ignore */
  }
}

export function listarConvites(): ConviteOnboarding[] {
  return [...ler()].reverse();
}

export function criarConvite(nome: string): ConviteOnboarding {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (limpo.length < 2) throw new ApiError(400, "Informe o nome do investidor", "INVALIDO");
  const lista = ler();
  const token = Math.random().toString(36).slice(2, 14).padEnd(12, "x");
  const c: ConviteOnboarding = {
    id: `conv-${String(lista.length + 1).padStart(3, "0")}`,
    token,
    link: `/onboarding/${token}`,
    nome: limpo,
    assessorId: "ass-001",
    status: "PENDENTE",
    criadoEm: new Date().toISOString(),
  };
  gravar([...lista, c]);
  return c;
}

export function formulario(token: string): FormularioOnboarding {
  let c = achar(token);
  if (c.status === "PENDENTE") {
    c = { ...c, status: "ABERTO", abertoEm: new Date().toISOString() };
    substituir(c);
  }
  return {
    convite: c,
    instituicoes: INSTITUICOES,
    questionario: QUESTIONARIO,
    produtos: ["CONTA", "CARTAO", "CREDITO", "INVESTIMENTOS"],
  };
}

export function concluir(token: string, cad: CadastroInvestidor): ResultadoOnboarding {
  const c = achar(token);
  if (c.status === "CONCLUIDO") throw new ApiError(409, "Este cadastro já foi concluído", "CONFLITO");
  const pontos = cad.respostasSuitability.reduce((s, r) => s + " abcd".indexOf(r.opcaoId), 0);
  const perfil = LIMITES.find(([lim]) => pontos <= lim)?.[1] ?? "AGRESSIVO";
  const clienteId = `cli-${200 + ler().filter((x) => x.status === "CONCLUIDO").length + 1}`;
  const agora = new Date().toISOString();
  const concluido: ConviteOnboarding = { ...c, status: "CONCLUIDO", concluidoEm: agora, clienteId, perfil };
  substituir(concluido);
  const hoje = agora.slice(0, 10);
  return {
    convite: concluido,
    clienteId,
    perfil,
    pontuacaoSuitability: pontos,
    consentimentos: [
      {
        id: `con-${clienteId}-xp`,
        clienteId,
        instituicaoId: "inst-xp",
        instituicaoNome: "XP Investimentos",
        tipo: "INTERNO",
        status: "ATIVO",
        escopos: ["CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"],
        concedidoEm: hoje,
      },
      ...cad.instituicoes.map((i) => ({
        id: `con-${clienteId}-${i.instituicaoId}`,
        clienteId,
        instituicaoId: i.instituicaoId,
        instituicaoNome: INSTITUICOES.find((x) => x.id === i.instituicaoId)?.nome ?? i.instituicaoId,
        tipo: "OPEN_FINANCE" as const,
        status: i.compartilharAgora ? ("ATIVO" as const) : ("PENDENTE" as const),
        escopos: i.produtos.map((p) => ESCOPO[p]),
        ...(i.compartilharAgora ? { concedidoEm: hoje } : {}),
      })),
    ],
  };
}
