// Compatibilidade entre os tipos escritos à mão (api-types.ts) e o contrato real do backend
// (api-types.gen.ts, gerado de contract/openapi.json, + as fixtures reais de contract/fixtures).
//
// Parte de TIPOS: verificada pelo `npm run typecheck` (tsc inclui este arquivo).
//   1. todo campo que o front declara existe no contrato (sem campos inventados), em qualquer profundidade;
//   2. os tipos à mão são atribuíveis ao gerado (tipos/enums compatíveis);
//   3. os enums são idênticos aos do contrato.
// Parte de RUNTIME (Vitest): o springdoc não marca `required`, então conferimos nas fixtures reais
// que todo campo obrigatório dos tipos à mão está presente (o backend omite nulos — Jackson NON_NULL).
//
// Estreitamentos aceitos (o front é mais específico que o OpenAPI):
//   - Nivel.numero: number → 1 | 2 | 3 | 4
//   - PorProduto.produto: string → Produto | "SALDO_CONTA"
//   - PainelCarteira.distribuicaoPosicaoXp: Record<string, number> → Record<PosicaoXp, number>
//   - Diagnostico.detalhes: Record<string, unknown> → formas por tipo (Detalhes*), conferidas abaixo nas fixtures.
import { describe, expect, it } from "vitest";
import briefing from "@/mocks/fixtures-contrato/briefing-cli-001.json";
import clientes from "@/mocks/fixtures-contrato/clientes.json";
import filaAntes from "@/mocks/fixtures-contrato/fila-antes.json";
import filaDepois from "@/mocks/fixtures-contrato/fila-depois.json";
import jornadaAntes from "@/mocks/fixtures-contrato/jornada-cli-001-antes.json";
import jornadaDepois from "@/mocks/fixtures-contrato/jornada-cli-001-depois.json";
import jornada003 from "@/mocks/fixtures-contrato/jornada-cli-003-antes.json";
import mensagem from "@/mocks/fixtures-contrato/mensagem-cli-001-fgc.json";
import painel from "@/mocks/fixtures-contrato/painel.json";
import visaoAntes from "@/mocks/fixtures-contrato/visao360-cli-001-antes.json";
import visaoDepois from "@/mocks/fixtures-contrato/visao360-cli-001-depois.json";
import type * as H from "./api-types";
import type { components } from "./api-types.gen";

type S = components["schemas"];

// ---------------------------------------------------------------- utilitários de tipo
type Igual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Esperar<T extends true> = T;
type Cabe<A, B> = [A] extends [B] ? true : false;

/** Caminhos de campos declarados em H que não existem em G (recursivo). `never` = nenhum. */
type Extras<Hh, G> = Hh extends readonly (infer HU)[]
  ? G extends readonly (infer GU)[]
    ? Extras<HU, GU>
    : "<array no front, não no contrato>"
  : Hh extends object
    ? {
        [K in keyof Hh]-?: K extends keyof NonNullable<G>
          ? Extras<NonNullable<Hh[K]>, NonNullable<NonNullable<G>[K]>> extends infer E
            ? [E] extends [never]
              ? never
              : `${K & string}.${E & string}`
            : never
          : K & string;
      }[keyof Hh]
    : never;

type Compativel<Hh, G> = [Extras<Hh, G>] extends [never] ? Cabe<Hh, G> : { camposForaDoContrato: Extras<Hh, G> };

type En<T> = NonNullable<T>;
type ElemDe<T> = NonNullable<T> extends readonly (infer U)[] ? U : never;

// 1 + 2: forma de cada resposta/entidade
export type ChecagensForma = [
  Esperar<Compativel<H.Visao360, S["Visao360"]>>,
  Esperar<Compativel<H.Cliente, S["Cliente"]>>,
  Esperar<Compativel<H.Cobertura, S["Cobertura"]>>,
  Esperar<Compativel<H.Patrimonio, S["Patrimonio"]>>,
  Esperar<Compativel<H.Principalidade, S["Principalidade"]>>,
  Esperar<Compativel<H.ScoreInstituicao, S["ScoreInstituicao"]>>,
  Esperar<Compativel<H.FluxoCaixa, S["FluxoCaixa"]>>,
  Esperar<Compativel<H.Alerta, S["Alerta"]>>,
  Esperar<Compativel<H.AcaoSugerida, S["AcaoSugerida"]>>,
  Esperar<Compativel<H.ConsentimentoComNome, S["ConsentimentoView"]>>,
  Esperar<Compativel<H.EventoVida, S["EventoVida"]>>,
  Esperar<Compativel<H.Dependente, S["Dependente"]>>,
  Esperar<Compativel<H.ItemFila, S["ItemFila"]>>,
  Esperar<Compativel<H.PainelCarteira, S["PainelCarteira"]>>,
  Esperar<Compativel<H.Jornada, S["Jornada"]>>,
  Esperar<Compativel<H.NivelJornada, S["Nivel"]>>,
  Esperar<Compativel<H.Missao, S["Missao"]>>,
  Esperar<Compativel<H.Diagnostico, S["Diagnostico"]>>,
  Esperar<Compativel<H.MensagemGerada, S["MensagemGerada"]>>,
  Esperar<Compativel<H.Briefing, S["Briefing"]>>,
  Esperar<Compativel<H.ClienteResumo, S["ClienteResumo"]>>,
  Esperar<Compativel<H.DemoEstado, S["DemoEstado"]>>,
  Esperar<Compativel<H.ErroApi, S["ErroResposta"]>>,
];

// 3: enums idênticos
export type ChecagensEnum = [
  Esperar<Igual<H.PerfilInvestidor, En<S["Cliente"]["perfil"]>>>,
  Esperar<Igual<H.PosicaoXp, En<S["Principalidade"]["posicaoXp"]>>>,
  Esperar<Igual<H.TipoAlerta, En<S["Alerta"]["tipo"]>>>,
  Esperar<Igual<H.Severidade, En<S["Alerta"]["severidade"]>>>,
  Esperar<Igual<H.TipoAcao, En<S["AcaoSugerida"]["tipo"]>>>,
  Esperar<Igual<H.StatusConsentimento, En<S["ConsentimentoView"]["status"]>>>,
  Esperar<Igual<H.Consentimento["tipo"], En<S["ConsentimentoView"]["tipo"]>>>,
  Esperar<Igual<H.Escopo, ElemDe<S["ConsentimentoView"]["escopos"]>>>,
  Esperar<Igual<H.ProdutoDeclarado, ElemDe<S["InstituicaoDeclarada"]["produtos"]>>>,
  Esperar<Igual<H.Missao["tipo"], En<S["Missao"]["tipo"]>>>,
  Esperar<Igual<H.Missao["status"], En<S["Missao"]["status"]>>>,
  Esperar<Igual<H.TipoDiagnostico, En<S["Diagnostico"]["tipo"]>>>,
  Esperar<Igual<H.GeradoPor, En<S["MensagemGerada"]["geradoPor"]>>>,
  Esperar<Igual<H.GeradoPor, En<S["Briefing"]["geradoPor"]>>>,
  Esperar<Igual<H.Canal, En<S["MensagemGerada"]["canal"]>>>,
  Esperar<Igual<H.EventoVida["tipo"], En<S["EventoVida"]["tipo"]>>>,
  Esperar<Igual<H.EventoVida["origem"], En<S["EventoVida"]["origem"]>>>,
];

// ---------------------------------------------------------------- runtime: campos obrigatórios nas fixtures
type Obrigatorias<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T] & string;

/** Lista exatamente as chaves obrigatórias de T (o tsc reclama se faltar ou sobrar alguma). */
function obrigatorias<T>() {
  return <const L extends readonly Obrigatorias<T>[]>(
    ...l: L & ([Exclude<Obrigatorias<T>, L[number]>] extends [never] ? unknown : { faltaListar: Exclude<Obrigatorias<T>, L[number]> })
  ): readonly string[] => l;
}

interface Regra {
  chaves: readonly string[];
  filhos?: Record<string, Regra>;
}

const R = {} as Record<string, Regra>;
R.acao = { chaves: obrigatorias<H.AcaoSugerida>()("id", "clienteId", "tipo", "titulo", "motivo", "alertaIds", "principal") };
R.alerta = {
  chaves: obrigatorias<H.Alerta>()("id", "clienteId", "tipo", "severidade", "titulo", "explicacao", "detectadoEm", "novo"),
};
R.componentes = {
  chaves: obrigatorias<H.ComponentesPrincipalidade>()("renda", "movimentacao", "contasRecorrentes", "investimentos", "cartao", "credito"),
};
R.score = {
  chaves: obrigatorias<H.ScoreInstituicao>()("instituicaoId", "nome", "ehXp", "score", "participacoes", "contribuicoes", "destaques"),
  filhos: { participacoes: R.componentes, contribuicoes: R.componentes },
};
R.principalidade = {
  chaves: obrigatorias<H.Principalidade>()("instituicaoPrincipalId", "instituicaoPrincipalNome", "posicaoXp", "explicacao", "scores"),
  filhos: { scores: R.score },
};
R.cliente = {
  chaves: obrigatorias<H.Cliente>()(
    "id", "nome", "cpf", "idade", "profissao", "cidade", "perfil", "assessorId", "ancora",
    "instituicoesDeclaradas", "dependentes", "eventosVida",
  ),
  filhos: {
    instituicoesDeclaradas: { chaves: ["instituicaoId", "produtos"] },
    dependentes: { chaves: obrigatorias<H.Dependente>()("nome", "parentesco", "dataNascimento") },
    eventosVida: { chaves: obrigatorias<H.EventoVida>()("id", "tipo", "descricao", "data", "origem") },
  },
};
R.visao = {
  chaves: obrigatorias<H.Visao360>()(
    "cliente", "atualizadoEm", "cobertura", "patrimonio", "principalidade", "fluxoCaixa", "alertas", "acoes", "consentimentos",
  ),
  filhos: {
    cliente: R.cliente,
    cobertura: {
      chaves: obrigatorias<H.Cobertura>()("instituicoesDeclaradas", "instituicoesConectadas", "percentual", "pendentes"),
      filhos: { pendentes: { chaves: ["instituicaoId", "nome", "produtos"] } },
    },
    patrimonio: {
      chaves: obrigatorias<H.Patrimonio>()("totalVisivel", "naXp", "foraXp", "shareOfWalletXp", "porInstituicao", "porProduto"),
      filhos: {
        porInstituicao: { chaves: ["instituicaoId", "nome", "ehXp", "investimentos", "saldoContas", "total"] },
        porProduto: { chaves: ["produto", "total"] },
      },
    },
    principalidade: R.principalidade,
    fluxoCaixa: {
      chaves: obrigatorias<H.FluxoCaixa>()(
        "rendaMensal", "fontesRenda", "custoVidaMensal", "capacidadeAporteMensal", "liquidezImediata", "reservaEmergenciaMeses", "parcial",
      ),
      filhos: { fontesRenda: { chaves: ["pagadorNome", "instituicaoId", "valorMensal", "diaDoMes"] } },
    },
    alertas: R.alerta,
    acoes: R.acao,
    consentimentos: {
      chaves: obrigatorias<H.ConsentimentoComNome>()("id", "clienteId", "instituicaoId", "tipo", "status", "escopos", "instituicaoNome"),
    },
  },
};
R.itemFila = {
  chaves: obrigatorias<H.ItemFila>()("posicao", "clienteId", "nome", "perfil", "prioridade", "motivos", "posicaoXp", "novo"),
  filhos: { motivos: { chaves: ["texto", "pontos"] }, acaoPrincipal: R.acao },
};
R.painel = {
  chaves: obrigatorias<H.PainelCarteira>()(
    "assessorId", "totalClientes", "patrimonioNaXp", "patrimonioForaXpVisivel", "pctClientesXpPrincipal",
    "distribuicaoPosicaoXp", "coberturaMedia", "consentimentosExpirando15d", "clientesComAlertaAlto",
  ),
  filhos: { distribuicaoPosicaoXp: { chaves: ["PRINCIPAL", "SECUNDARIA", "SO_INVESTIMENTOS", "AUSENTE"] } },
};
R.jornada = {
  chaves: obrigatorias<H.Jornada>()("clienteId", "completude", "nivel", "missoes", "diagnosticos"),
  filhos: {
    nivel: { chaves: obrigatorias<H.NivelJornada>()("numero", "nome", "beneficios") },
    missoes: { chaves: obrigatorias<H.Missao>()("id", "tipo", "titulo", "descricao", "recompensa", "status", "progresso") },
    diagnosticos: { chaves: obrigatorias<H.Diagnostico>()("tipo", "titulo", "desbloqueado", "requisito") },
  },
};
R.mensagem = { chaves: obrigatorias<H.MensagemGerada>()("texto", "canal", "geradoPor") };
R.briefing = { chaves: obrigatorias<H.Briefing>()("clienteId", "bullets", "perguntasSugeridas", "geradoPor") };
R.clienteResumo = { chaves: obrigatorias<H.ClienteResumo>()("id", "nome", "perfil", "posicaoXp", "prioridade") };

// Detalhes dos diagnósticos (forma combinada com o backend; `detalhes` é livre no OpenAPI).
const regraDetalhes: Record<H.TipoDiagnostico, Regra> = {
  PATRIMONIO_COMPLETO: { chaves: obrigatorias<H.DetalhesPatrimonioCompleto>()("instituicoes", "total") },
  PROTECAO_FGC: {
    chaves: obrigatorias<H.DetalhesProtecaoFgc>()("valorSemCobertura", "conglomerados"),
    filhos: {
      conglomerados: { chaves: obrigatorias<H.ConglomeradoFgc>()("conglomeradoId", "nome", "valor", "coberto", "descoberto") },
    },
  },
  CUSTO_DE_VIDA: { chaves: obrigatorias<H.DetalhesCustoDeVida>()("total", "categorias", "parcial") },
  RESERVA_EMERGENCIA: { chaves: obrigatorias<H.DetalhesReservaEmergencia>()("meses", "liquidezImediata", "metaMeses", "meta") },
};

function faltando(obj: unknown, regra: Regra, caminho: string): string[] {
  if (Array.isArray(obj)) return obj.flatMap((x, i) => faltando(x, regra, `${caminho}[${i}]`));
  if (!obj || typeof obj !== "object") return [`${caminho} (não é objeto)`];
  const o = obj as Record<string, unknown>;
  const erros = regra.chaves.filter((k) => o[k] === undefined || o[k] === null).map((k) => `${caminho}.${k}`);
  for (const [k, sub] of Object.entries(regra.filhos ?? {})) {
    if (o[k] !== undefined && o[k] !== null) erros.push(...faltando(o[k], sub, `${caminho}.${k}`));
  }
  return erros;
}

describe("fixtures reais do backend × tipos do front", () => {
  it.each([
    ["visao360 antes", visaoAntes, R.visao],
    ["visao360 depois", visaoDepois, R.visao],
    ["fila antes", filaAntes, R.itemFila],
    ["fila depois", filaDepois, R.itemFila],
    ["painel", painel, R.painel],
    ["jornada cli-001 antes", jornadaAntes, R.jornada],
    ["jornada cli-001 depois", jornadaDepois, R.jornada],
    ["jornada cli-003 antes", jornada003, R.jornada],
    ["mensagem", mensagem, R.mensagem],
    ["briefing", briefing, R.briefing],
    ["clientes", clientes, R.clienteResumo],
  ] as const)("%s: todos os campos obrigatórios presentes", (_nome, fixture, regra) => {
    expect(faltando(fixture, regra, "$")).toEqual([]);
  });

  it("detalhes dos diagnósticos desbloqueados seguem a forma por tipo", () => {
    const diags = [...jornadaAntes.diagnosticos, ...jornadaDepois.diagnosticos, ...jornada003.diagnosticos] as unknown as H.Diagnostico[];
    const erros = diags
      .filter((d) => d.desbloqueado)
      .flatMap((d) => faltando(d.detalhes, regraDetalhes[d.tipo], `${d.tipo}.detalhes`));
    expect(erros).toEqual([]);
  });

  it("valores de enum das fixtures são conhecidos pelo front", () => {
    const geradoPor: H.GeradoPor[] = ["stub", "cache", "live"];
    expect(geradoPor).toContain(mensagem.geradoPor);
    expect(geradoPor).toContain(briefing.geradoPor);
    const produtos = [...visaoAntes.patrimonio.porProduto, ...visaoDepois.patrimonio.porProduto].map((p) => p.produto);
    const conhecidos: (H.Produto | "SALDO_CONTA")[] = [
      "CDB", "RDB", "LCI", "LCA", "LC", "POUPANCA", "TESOURO", "DEBENTURE", "CRI", "CRA", "FUNDO", "ACAO", "PREVIDENCIA", "SALDO_CONTA",
    ];
    for (const p of produtos) expect(conhecidos).toContain(p);
    const categorias: H.CategoriaCusto[] = ["CONTAS_RECORRENTES", "PARCELAS", "CONSUMO", "CARTOES"];
    const custo = jornadaAntes.diagnosticos.find((d) => d.tipo === "CUSTO_DE_VIDA")!.detalhes as unknown as H.DetalhesCustoDeVida;
    for (const k of Object.keys(custo.categorias)) expect(categorias).toContain(k);
    for (const j of [jornadaAntes, jornadaDepois, jornada003]) expect([1, 2, 3, 4]).toContain(j.nivel.numero);
  });
});
