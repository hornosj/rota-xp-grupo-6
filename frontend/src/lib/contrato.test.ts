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
//   - PorProduto.produto: string → Produto | "SALDO_CONTA"
//   - PainelCarteira.distribuicaoPosicaoXp: Record<string, number> → Record<PosicaoXp, number>
import { describe, expect, it } from "vitest";
import briefing from "@/mocks/fixtures-contrato/briefing-cli-001.json";
import clientes from "@/mocks/fixtures-contrato/clientes.json";
import conviteConfirmado from "@/mocks/fixtures-contrato/convite-cli-001-confirmado.json";
import convitePendente from "@/mocks/fixtures-contrato/convite-cli-001-pendente.json";
import posicoesDesagio from "@/mocks/fixtures-desagio/posicoes.json";
import simulacaoDesagio from "@/mocks/fixtures-desagio/simulacao-cli-001-inv-001-03.json";
import filaAntes from "@/mocks/fixtures-contrato/fila-antes.json";
import filaDepois from "@/mocks/fixtures-contrato/fila-depois.json";
import mensagemConvite from "@/mocks/fixtures-contrato/mensagem-cli-001-convite.json";
import mensagem from "@/mocks/fixtures-contrato/mensagem-cli-001-fgc.json";
import painel from "@/mocks/fixtures-contrato/painel.json";
import propostaEdicao from "@/mocks/fixtures-contrato/proposta-edicao-cli-004.json";
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
  Esperar<Compativel<H.MensagemGerada, S["MensagemGerada"]>>,
  Esperar<Compativel<H.Briefing, S["Briefing"]>>,
  Esperar<Compativel<H.ClienteResumo, S["ClienteResumo"]>>,
  Esperar<Compativel<H.DemoEstado, S["DemoEstado"]>>,
  Esperar<Compativel<H.ErroApi, S["ErroResposta"]>>,
  Esperar<Compativel<H.Convite, S["Convite"]>>,
  // onboarding (respostas e corpos de requisição)
  Esperar<Compativel<H.ConviteOnboarding, S["ConviteOnboarding"]>>,
  Esperar<Compativel<H.FormularioOnboarding, S["FormularioOnboarding"]>>,
  Esperar<Compativel<H.PerguntaSuitability, S["PerguntaSuitability"]>>,
  Esperar<Compativel<H.InstituicaoDisponivel, S["InstituicaoDisponivel"]>>,
  Esperar<Compativel<H.ResultadoOnboarding, S["ResultadoOnboarding"]>>,
  Esperar<Compativel<H.CadastroInvestidor, S["CadastroInvestidor"]>>,
  Esperar<Compativel<{ nome: string }, S["NovoConviteBody"]>>,
  // edição do cadastro por voz
  Esperar<Compativel<H.Transcricao, S["Transcricao"]>>,
  Esperar<Compativel<H.TranscricaoVoz, S["TranscricaoVoz"]>>,
  Esperar<Compativel<H.PropostaEdicao, S["PropostaEdicao"]>>,
  Esperar<Compativel<H.AlteracaoCampo, S["AlteracaoCampo"]>>,
  Esperar<Compativel<H.EdicaoCadastro, S["EdicaoCadastro"]>>,
  Esperar<Compativel<{ transcricao: string }, S["PedidoProposta"]>>,
  // calculadora de deságio
  Esperar<Compativel<H.PosicoesDesagio, S["PosicoesDesagio"]>>,
  Esperar<Compativel<H.PosicaoDesagio, S["PosicaoDesagio"]>>,
  Esperar<Compativel<H.PremissasMercado, S["PremissasMercado"]>>,
  Esperar<Compativel<H.DesagioPedido, S["DesagioPedido"]>>,
  Esperar<Compativel<H.DesagioDetalhado, S["DesagioDetalhado"]>>,
  Esperar<Compativel<H.EntradaUsada, S["EntradaUsada"]>>,
  Esperar<Compativel<H.PontoSerie, S["PontoSerie"]>>,
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
  Esperar<Igual<H.GeradoPor, En<S["MensagemGerada"]["geradoPor"]>>>,
  Esperar<Igual<H.GeradoPor, En<S["Briefing"]["geradoPor"]>>>,
  Esperar<Igual<H.Canal, En<S["MensagemGerada"]["canal"]>>>,
  Esperar<Igual<H.EventoVida["tipo"], En<S["EventoVida"]["tipo"]>>>,
  Esperar<Igual<H.EventoVida["origem"], En<S["EventoVida"]["origem"]>>>,
  Esperar<Igual<H.Convite["status"], En<S["Convite"]["status"]>>>,
  Esperar<Igual<H.Escopo, ElemDe<S["Convite"]["escopos"]>>>,
  Esperar<Igual<H.StatusConviteOnboarding, En<S["ConviteOnboarding"]["status"]>>>,
  Esperar<Igual<H.TipoEventoVida, En<S["EventoPlanejado"]["tipo"]>>>,
  Esperar<Igual<H.CampoCadastro, En<S["AlteracaoCampo"]["campo"]>>>,
  Esperar<Igual<H.GeradoPor, En<S["PropostaEdicao"]["geradoPor"]>>>,
  Esperar<Igual<H.Produto, En<S["PosicaoDesagio"]["produto"]>>>,
  Esperar<Igual<H.Indexador, En<S["PosicaoDesagio"]["indexador"]>>>,
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
R.mensagem = { chaves: obrigatorias<H.MensagemGerada>()("texto", "canal", "geradoPor") };
R.briefing = { chaves: obrigatorias<H.Briefing>()("clienteId", "bullets", "perguntasSugeridas", "geradoPor") };
R.convite = {
  chaves: obrigatorias<H.Convite>()(
    "token", "clienteId", "instituicaoId", "instituicaoNome", "escopos", "prazoMeses", "link", "status", "criadoEm", "expiraEm",
  ),
};
R.propostaEdicao = {
  chaves: obrigatorias<H.PropostaEdicao>()("clienteId", "transcricao", "alteracoes", "avisos", "geradoPor"),
  filhos: { alteracoes: { chaves: obrigatorias<H.AlteracaoCampo>()("campo", "valorNovo") } },
};
R.posicoesDesagio = {
  chaves: obrigatorias<H.PosicoesDesagio>()("clienteId", "clienteNome", "dataReferencia", "premissas", "posicoes"),
  filhos: {
    premissas: { chaves: obrigatorias<H.PremissasMercado>()("cdiAnual", "ipcaAnual", "selicAnual") },
    posicoes: {
      chaves: obrigatorias<H.PosicaoDesagio>()(
        "posicaoId", "nome", "produto", "indexador", "instituicaoId", "valorAplicado", "valorAtual", "taxaDependeDePremissa", "elegivel",
      ),
    },
  },
};
R.desagioDetalhado = {
  chaves: obrigatorias<H.DesagioDetalhado>()(
    "entrada", "perdaImediata", "valorFinalManter", "valorFinalVender", "ganhoDaTroca", "ganhoDaTrocaPercentual",
    "compensa", "spreadTaxas", "serie", "explicacao", "premissas", "avisos",
  ),
  filhos: {
    entrada: {
      chaves: obrigatorias<H.EntradaUsada>()("valorAtual", "taxaAntiga", "taxaNova", "prazoRestanteAnos", "desagio", "precoVenda"),
    },
    serie: { chaves: obrigatorias<H.PontoSerie>()("mes", "anos", "valorManter", "valorVender", "diferenca") },
  },
};
R.clienteResumo = { chaves: obrigatorias<H.ClienteResumo>()("id", "nome", "perfil", "posicaoXp", "prioridade") };

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
    ["mensagem", mensagem, R.mensagem],
    ["briefing", briefing, R.briefing],
    ["clientes", clientes, R.clienteResumo],
    ["convite pendente", convitePendente, R.convite],
    ["convite confirmado", conviteConfirmado, R.convite],
    ["mensagem do convite", mensagemConvite, R.mensagem],
    ["proposta de edição por voz", propostaEdicao, R.propostaEdicao],
    ["posições do deságio (todos os clientes)", Object.values(posicoesDesagio), R.posicoesDesagio],
    ["simulação de deságio", simulacaoDesagio, R.desagioDetalhado],
  ] as const)("%s: todos os campos obrigatórios presentes", (_nome, fixture, regra) => {
    expect(faltando(fixture, regra, "$")).toEqual([]);
  });

  it("a mensagem do convite traz o link exato (o WhatsApp transforma em link clicável)", () => {
    expect(convitePendente.status).toBe("PENDENTE");
    expect(conviteConfirmado.status).toBe("CONFIRMADO");
    expect(mensagemConvite.texto).toContain(convitePendente.link);
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
  });
});
