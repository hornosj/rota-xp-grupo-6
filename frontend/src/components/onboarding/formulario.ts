// Estado, máscaras e validação do onboarding. A validação daqui é só para guiar o preenchimento:
// a regra que vale (idade mínima, datas futuras pela data de referência, CPF repetido) é a do backend.
import type {
  CadastroInvestidor,
  Dependente,
  EventoPlanejado,
  Id,
  PerguntaSuitability,
  ProdutoDeclarado,
} from "@/lib/api-types";

export const ETAPAS = [
  { id: "boas-vindas", titulo: "Boas-vindas" },
  { id: "dados", titulo: "Seus dados" },
  { id: "endereco", titulo: "Profissão e cidade" },
  { id: "familia", titulo: "Família e planos" },
  { id: "perfil", titulo: "Perfil de investidor" },
  { id: "instituicoes", titulo: "Onde você tem conta" },
  { id: "compartilhamento", titulo: "Compartilhamento" },
  { id: "revisao", titulo: "Revisão" },
] as const;

export type IdEtapa = (typeof ETAPAS)[number]["id"];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export interface InstituicaoEscolhida {
  produtos: ProdutoDeclarado[];
  compartilharAgora: boolean;
}

export interface EstadoFormulario {
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
  /** perguntaId → opcaoId */
  respostas: Record<string, string>;
  /** Só as instituições marcadas, na ordem em que foram marcadas. */
  instituicoes: Record<Id, InstituicaoEscolhida>;
  aceiteTermos: boolean;
}

export type Erros = Partial<Record<string, string>>;

export function estadoInicial(nome: string): EstadoFormulario {
  return {
    nome,
    cpf: "",
    dataNascimento: "",
    email: "",
    celular: "",
    profissao: "",
    cidade: "",
    uf: "",
    dependentes: [],
    eventosVida: [],
    respostas: {},
    instituicoes: {},
    aceiteTermos: false,
  };
}

const digitos = (v: string) => v.replace(/\D/g, "");

export function mascaraCpf(v: string): string {
  const d = digitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function mascaraCelular(v: string): string {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return resto.length > corte ? `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}` : `(${ddd}) ${resto}`;
}

/** Idade completa em `referencia` (YYYY-MM-DD). */
export function idade(nascimento: string, referencia: string): number {
  const [an, mn, dn] = nascimento.split("-").map(Number);
  const [ar, mr, dr] = referencia.split("-").map(Number);
  return ar - an - (mr < mn || (mr === mn && dr < dn) ? 1 : 0);
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validarEtapa(
  etapa: IdEtapa,
  f: EstadoFormulario,
  ctx: { hoje: string; questionario: PerguntaSuitability[] },
): Erros {
  const e: Erros = {};
  switch (etapa) {
    case "dados":
      if (f.nome.trim().split(/\s+/).length < 2) e.nome = "Informe nome e sobrenome";
      if (digitos(f.cpf).length !== 11) e.cpf = "Informe os 11 dígitos do CPF";
      if (!f.dataNascimento) e.dataNascimento = "Informe a data de nascimento";
      else if (idade(f.dataNascimento, ctx.hoje) < 18) e.dataNascimento = "É preciso ter pelo menos 18 anos";
      if (!EMAIL.test(f.email.trim())) e.email = "E-mail inválido";
      if (![10, 11].includes(digitos(f.celular).length)) e.celular = "Informe DDD + número";
      break;
    case "endereco":
      if (!f.profissao.trim()) e.profissao = "Informe sua profissão";
      if (!f.cidade.trim()) e.cidade = "Informe sua cidade";
      if (!UFS.includes(f.uf)) e.uf = "Escolha o estado";
      break;
    case "familia":
      f.dependentes.forEach((d, i) => {
        if (!d.nome.trim()) e[`dependentes.${i}.nome`] = "Informe o nome";
        if (!d.parentesco) e[`dependentes.${i}.parentesco`] = "Escolha o parentesco";
        if (!d.dataNascimento || d.dataNascimento > ctx.hoje) e[`dependentes.${i}.dataNascimento`] = "Data inválida";
      });
      f.eventosVida.forEach((ev, i) => {
        if (!ev.descricao.trim()) e[`eventosVida.${i}.descricao`] = "Descreva o acontecimento";
        if (!ev.data || ev.data < ctx.hoje) e[`eventosVida.${i}.data`] = "Escolha uma data futura";
      });
      break;
    case "perfil":
      for (const p of ctx.questionario) if (!f.respostas[p.id]) e[`perfil.${p.id}`] = "Escolha uma opção";
      break;
    case "instituicoes":
      for (const [id, inst] of Object.entries(f.instituicoes)) {
        if (!inst.produtos.length) e[`instituicoes.${id}`] = "Marque ao menos um produto";
      }
      break;
    case "revisao":
      if (!f.aceiteTermos) e.aceiteTermos = "É preciso aceitar para concluir";
      break;
  }
  return e;
}

export function montarCadastro(f: EstadoFormulario): CadastroInvestidor {
  return {
    nome: f.nome.trim(),
    cpf: f.cpf,
    dataNascimento: f.dataNascimento,
    email: f.email.trim(),
    celular: f.celular,
    profissao: f.profissao.trim(),
    cidade: f.cidade.trim(),
    uf: f.uf,
    dependentes: f.dependentes.map((d) => ({ ...d, nome: d.nome.trim() })),
    eventosVida: f.eventosVida.map((ev) => ({ ...ev, descricao: ev.descricao.trim() })),
    respostasSuitability: Object.entries(f.respostas).map(([perguntaId, opcaoId]) => ({ perguntaId, opcaoId })),
    instituicoes: Object.entries(f.instituicoes).map(([instituicaoId, i]) => ({
      instituicaoId,
      produtos: i.produtos,
      compartilharAgora: i.compartilharAgora,
    })),
    aceiteTermos: f.aceiteTermos,
  };
}
