// Fixtures do modo mock: os 6 clientes-âncora (PLAN §6.3 / §6.5) e alguns clientes de fundo.
import type { Cliente, ConsentimentoComNome, Id, ItemFila } from "@/lib/api-types";
import { acao, alerta, consentimento, DATA_REFERENCIA, type DefVisao } from "./montar";

const TODOS: ConsentimentoComNome["escopos"] = ["CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"];

function cliente(c: Omit<Cliente, "assessorId" | "ancora" | "cpf"> & { cpf?: string; ancora?: boolean }): Cliente {
  return {
    assessorId: "ass-001",
    ancora: c.ancora ?? true,
    cpf: c.cpf ?? `000.000.${c.id.replace("cli-", "").padStart(3, "0")}-00`,
    ...c,
  };
}

export interface DefCliente {
  visao: DefVisao;
  motivos: ItemFila["motivos"];
}

// ---------------------------------------------------------------------------
// cli-001 — Dra. Marina Costa (antes/depois do consentimento do Banco Horizonte)
// ---------------------------------------------------------------------------

const marina = cliente({
  id: "cli-001",
  nome: "Dra. Marina Costa",
  cpf: "000.000.001-91",
  idade: 42,
  profissao: "Médica cardiologista",
  cidade: "Ribeirão Preto/SP",
  perfil: "ARROJADO",
  instituicoesDeclaradas: [
    { instituicaoId: "inst-xp", produtos: ["INVESTIMENTOS"] },
    { instituicaoId: "inst-aurora", produtos: ["CONTA", "CARTAO", "CREDITO"] },
    { instituicaoId: "inst-horizonte", produtos: ["INVESTIMENTOS"] },
  ],
  dependentes: [
    { nome: "Sofia", parentesco: "filha", dataNascimento: "2014-10-16" },
    { nome: "Pedro", parentesco: "filho", dataNascimento: "2017-03-02" },
  ],
  eventosVida: [
    { id: "ev-001-1", tipo: "ANIVERSARIO", descricao: "Aniversário da Sofia (12 anos)", data: "2026-10-16", origem: "CADASTRO" },
  ],
});

/** `depois` = quando o Banco Horizonte foi concedido (ISO) e se os alertas novos ainda estão na janela de "NOVO". */
export function defMarina(depois: { em: string; novo: boolean } | null, horizonteRevogado?: string): DefCliente {
  const c = "cli-001";
  const consentimentos = [
    consentimento(c, "inst-xp", "ATIVO", TODOS),
    consentimento(c, "inst-aurora", "ATIVO", ["CONTAS", "CARTOES", "CREDITO"], {
      concedidoEm: "2026-08-12T10:00:00-03:00",
      expiraEm: "2027-08-07",
    }),
    depois
      ? consentimento(c, "inst-horizonte", "ATIVO", ["INVESTIMENTOS"], {
          concedidoEm: depois.em,
          expiraEm: "2027-10-11",
        })
      : horizonteRevogado
        ? consentimento(c, "inst-horizonte", "REVOGADO", ["INVESTIMENTOS"])
        : consentimento(c, "inst-horizonte", "PENDENTE", ["INVESTIMENTOS"]),
  ];

  const saldoParado = alerta(
    c,
    "SALDO_PARADO",
    "MEDIA",
    "R$ 61 mil parados em conta corrente",
    "R$ 85 mil na conta do Banco Aurora, R$ 61 mil acima de 1 mês de custo de vida (R$ 24 mil). Em liquidez diária, renderiam cerca de R$ 486 por mês.",
    { valor: 61000, instituicaoId: "inst-aurora" },
  );
  const rendaFora = alerta(
    c,
    "RENDA_FORA_XP",
    "BAIXA",
    "Salário cai no Banco Aurora",
    "O salário de R$ 38 mil (Hospital Santa Clara) cai no Banco Aurora. Sobram cerca de R$ 14 mil por mês.",
    { valor: 14000, instituicaoId: "inst-aurora" },
  );
  const evento = alerta(
    c,
    "EVENTO_VIDA_PROXIMO",
    "BAIXA",
    "Aniversário da Sofia em 5 dias",
    "Sofia (filha) faz 12 anos em 16/10. Um bom motivo para um contato próximo.",
  );
  const fgc = alerta(
    c,
    "FGC_EXCEDIDO",
    "ALTA",
    "R$ 400 mil acima da cobertura do FGC",
    "R$ 650 mil em CDB do Banco Horizonte. O FGC cobre até R$ 250 mil por CPF por conglomerado: R$ 400 mil ficariam sem garantia se o banco quebrar.",
    { valor: 400000, instituicaoId: "inst-horizonte", emissorId: "emi-horizonte", detectadoEm: depois?.em, novo: depois?.novo },
  );
  const concentracao = alerta(
    c,
    "CONCENTRACAO_EMISSOR",
    "MEDIA",
    "Exposição sem garantia de 24,5% ao Banco Horizonte",
    "R$ 400 mil sem garantia do FGC no Banco Horizonte = 24,5% do patrimônio visível (R$ 1,6 mi). Referência: até 20% por emissor.",
    { valor: 400000, emissorId: "emi-horizonte", detectadoEm: depois?.em, novo: depois?.novo },
  );

  const acaoSaldo = (principal: boolean) =>
    acao(c, "APLICAR_SALDO_PARADO", "Levar R$ 61 mil parados para liquidez diária", "R$ 85 mil na conta do Banco Aurora; R$ 61 mil acima de 1 mês de custo de vida.", [saldoParado.id], {
      principal,
      impactoEstimado: "≈ R$ 486/mês (CDI ilustrativo de 10% a.a.)",
    });
  const acaoAporte = acao(c, "APORTE_PROGRAMADO", "Propor aporte programado de R$ 7 mil/mês (50% da sobra)", "O salário cai no Banco Aurora e sobram R$ 14 mil por mês.", [rendaFora.id], {
    impactoEstimado: "R$ 84 mil/ano a mais investidos",
  });
  const acaoAniversario = acao(c, "CONTATO_RELACIONAMENTO", "Aniversário da Sofia em 5 dias", "Sofia (filha) faz 12 anos em 16/10.", [evento.id]);

  const motivosBase: ItemFila["motivos"] = [
    { texto: "R$ 61 mil parados em conta corrente", pontos: 16.1 },
    { texto: "Renda cai fora da XP (Banco Aurora)", pontos: 10 },
    { texto: "Aniversário da Sofia em 5 dias", pontos: 8 },
    { texto: "XP só em investimentos", pontos: 5 },
  ];

  const fluxoCaixa: DefVisao["fluxoCaixa"] = {
    rendaMensal: 38000,
    fontesRenda: [{ pagadorNome: "Hospital Santa Clara", instituicaoId: "inst-aurora", valorMensal: 38000, diaDoMes: 5 }],
    custoVidaMensal: 24000,
    capacidadeAporteMensal: 14000,
    liquidezImediata: 155000,
    reservaEmergenciaMeses: 6.5,
    parcial: false,
  };
  const investimentosXp: DefVisao["investimentos"] = [
    { instituicaoId: "inst-xp", produto: "TESOURO", valor: 280000 },
    { instituicaoId: "inst-xp", produto: "FUNDO", valor: 260000 },
    { instituicaoId: "inst-xp", produto: "CDB", valor: 160000 },
    { instituicaoId: "inst-xp", produto: "CDB", valor: 70000 },
    { instituicaoId: "inst-xp", produto: "ACAO", valor: 130000 },
  ];
  const aurora = { renda: 1, movimentacao: 1, contasRecorrentes: 1, cartao: 1, credito: 1 };

  if (!depois) {
    return {
      motivos: motivosBase,
      visao: {
        cliente: marina,
        consentimentos,
        contas: [{ instituicaoId: "inst-aurora", saldo: 85000 }],
        investimentos: investimentosXp,
        participacoes: { "inst-aurora": aurora, "inst-xp": { investimentos: 1 } },
        explicacao:
          "Banco Aurora é a instituição principal: recebe 100% da renda e concentra 100% dos pagamentos recorrentes. A XP tem 15 pontos: só investimentos.",
        posicaoXp: "SO_INVESTIMENTOS",
        fluxoCaixa,
        alertas: [saldoParado, rendaFora, evento],
        acoes: [
          acaoSaldo(true),
          acaoAporte,
          acaoAniversario,
          acao(c, "CONVIDAR_CONEXAO", "Convidar a conectar o Banco Horizonte pelo app", "Marina declarou investimentos no Banco Horizonte que ainda não estão conectados (cobertura de 67%).", [], {
            id: "acao-cli-001-convidar_conexao-inst-horizonte",
          }),
        ],
      },
    };
  }

  return {
    motivos: [
      { texto: "R$ 400 mil acima do FGC no Banco Horizonte", pontos: 55 },
      { texto: "Exposição sem garantia de 24,5%", pontos: 15 },
      ...motivosBase,
    ],
    visao: {
      cliente: marina,
      consentimentos,
      contas: [{ instituicaoId: "inst-aurora", saldo: 85000 }],
      investimentos: [...investimentosXp, { instituicaoId: "inst-horizonte", produto: "CDB", valor: 650000 }],
      participacoes: {
        "inst-aurora": aurora,
        "inst-xp": { investimentos: 900000 / 1550000 },
        "inst-horizonte": { investimentos: 650000 / 1550000 },
      },
      explicacao:
        "Banco Aurora é a instituição principal: recebe 100% da renda e concentra 100% dos pagamentos recorrentes. A XP tem 8,7 pontos: só investimentos (58% dos investimentos visíveis; o Banco Horizonte tem os outros 42%).",
      posicaoXp: "SO_INVESTIMENTOS",
      fluxoCaixa,
      alertas: [fgc, concentracao, saldoParado, rendaFora, evento],
      acoes: [
        acao(c, "DIVERSIFICAR_FGC", "Distribuir R$ 400 mil entre emissores para ficar 100% coberta", "R$ 650 mil em CDB do Banco Horizonte; o FGC cobre até R$ 250 mil por conglomerado.", [fgc.id], {
          principal: true,
          impactoEstimado: "R$ 400 mil passam a ter garantia do FGC",
        }),
        acao(c, "REDUZIR_CONCENTRACAO", "Reduzir exposição sem garantia ao Banco Horizonte", "24,5% do patrimônio visível sem garantia em um único emissor.", [concentracao.id]),
        acaoSaldo(false),
        acaoAporte,
        acaoAniversario,
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Demais âncoras
// ---------------------------------------------------------------------------

function defCarlos(): DefCliente {
  const c = "cli-002";
  const venc = alerta(c, "VENCIMENTO_PROXIMO", "MEDIA", "CDB de R$ 240 mil vence em 20 dias",
    "R$ 240 mil em CDB do Banco Ipê vencem em 31/10/2026. Vale preparar o reinvestimento antes para o dinheiro não ficar parado.",
    { valor: 240000, emissorId: "emi-ipe" });
  const exp = alerta(c, "CONSENTIMENTO_EXPIRANDO", "MEDIA", "Open Finance do Banco Aurora expira em 10 dias",
    "O compartilhamento de dados do Banco Aurora expira em 21/10/2026. Sem renovação, a visão 360 perde a conta do Aurora.",
    { instituicaoId: "inst-aurora" });
  return {
    motivos: [
      { texto: "R$ 240 mil vencendo em 20 dias", pontos: 19.8 },
      { texto: "Consentimento do Aurora expira em 10 dias", pontos: 10 },
    ],
    visao: {
      cliente: cliente({
        id: c, nome: "Carlos Andrade", idade: 61, profissao: "Empresário (embalagens)", cidade: "Campinas/SP", perfil: "CONSERVADOR",
        instituicoesDeclaradas: [
          { instituicaoId: "inst-xp", produtos: ["CONTA", "CARTAO", "INVESTIMENTOS"] },
          { instituicaoId: "inst-aurora", produtos: ["CONTA"] },
        ],
        dependentes: [],
        eventosVida: [],
      }),
      consentimentos: [
        consentimento(c, "inst-xp", "ATIVO", TODOS),
        consentimento(c, "inst-aurora", "ATIVO", ["CONTAS"], { concedidoEm: "2025-10-21T09:00:00-03:00", expiraEm: "2026-10-21" }),
      ],
      contas: [{ instituicaoId: "inst-xp", saldo: 18000 }, { instituicaoId: "inst-aurora", saldo: 3000 }],
      investimentos: [
        { instituicaoId: "inst-xp", produto: "CDB", valor: 240000 },
        { instituicaoId: "inst-xp", produto: "LCA", valor: 200000 },
        { instituicaoId: "inst-xp", produto: "TESOURO", valor: 800000 },
        { instituicaoId: "inst-xp", produto: "FUNDO", valor: 400000 },
      ],
      participacoes: {
        "inst-xp": { renda: 1, movimentacao: 0.9118, contasRecorrentes: 0.9608, investimentos: 1, cartao: 1 },
        "inst-aurora": { movimentacao: 0.0882, contasRecorrentes: 0.0392 },
      },
      explicacao: "XP Investimentos é a instituição principal: recebe 100% da renda, 91% da movimentação e todo o gasto com cartão. O Banco Aurora tem uso residual (água e pequenas compras).",
      posicaoXp: "PRINCIPAL",
      fluxoCaixa: {
        rendaMensal: 25000,
        fontesRenda: [{ pagadorNome: "Andrade Embalagens", instituicaoId: "inst-xp", valorMensal: 25000, diaDoMes: 1 }],
        custoVidaMensal: 13600, capacidadeAporteMensal: 11400, liquidezImediata: 821000, reservaEmergenciaMeses: 60.4, parcial: false,
      },
      alertas: [venc, exp],
      acoes: [
        acao(c, "REINVESTIR_VENCIMENTO", "R$ 240 mil vencem em 20 dias: preparar reinvestimento", "CDB do Banco Ipê vence em 31/10/2026.", [venc.id], { principal: true }),
        acao(c, "RENOVAR_CONSENTIMENTO", "Lembrar renovação do Open Finance com o Aurora", "O consentimento expira em 21/10/2026.", [exp.id]),
      ],
    },
  };
}

function defJuliana(): DefCliente {
  const c = "cli-003";
  const saldo = alerta(c, "SALDO_PARADO", "MEDIA", "R$ 13 mil parados em conta corrente",
    "R$ 22 mil na conta do Banco Ipê, R$ 13 mil acima de 1 mês de custo de vida (R$ 9 mil). Em liquidez diária, renderiam cerca de R$ 104 por mês.",
    { valor: 13000, instituicaoId: "inst-ipe" });
  const renda = alerta(c, "RENDA_FORA_XP", "BAIXA", "Salário cai no Banco Ipê",
    "O salário de R$ 14 mil (TechVale Sistemas) cai no Banco Ipê. Sobram cerca de R$ 5 mil por mês.",
    { valor: 5000, instituicaoId: "inst-ipe" });
  const reserva = alerta(c, "RESERVA_INSUFICIENTE", "MEDIA", "Reserva de emergência de 3,0 meses",
    "R$ 27 mil de liquidez imediata cobrem 3,0 meses do custo de vida (R$ 9 mil). A meta é 6 meses: faltam R$ 27 mil.",
    { valor: 27000 });
  return {
    motivos: [
      { texto: "R$ 13 mil parados em conta corrente", pontos: 11.3 },
      { texto: "Renda cai fora da XP (Banco Ipê)", pontos: 10 },
      { texto: "Reserva de 3,0 meses (meta: 6)", pontos: 8 },
      { texto: "XP só em investimentos", pontos: 5 },
    ],
    visao: {
      cliente: cliente({
        id: c, nome: "Juliana Prado", idade: 29, profissao: "Engenheira de software", cidade: "São José dos Campos/SP", perfil: "MODERADO",
        instituicoesDeclaradas: [
          { instituicaoId: "inst-xp", produtos: ["INVESTIMENTOS"] },
          { instituicaoId: "inst-ipe", produtos: ["CONTA"] },
          { instituicaoId: "inst-aurora", produtos: ["CARTAO"] },
        ],
        dependentes: [],
        eventosVida: [],
      }),
      consentimentos: [
        consentimento(c, "inst-xp", "ATIVO", TODOS),
        consentimento(c, "inst-ipe", "ATIVO", ["CONTAS"], { concedidoEm: "2026-03-02T09:00:00-03:00", expiraEm: "2027-03-02" }),
        consentimento(c, "inst-aurora", "PENDENTE", ["CARTOES"]),
      ],
      contas: [{ instituicaoId: "inst-ipe", saldo: 22000 }],
      investimentos: [
        { instituicaoId: "inst-xp", produto: "CDB", valor: 5000 },
        { instituicaoId: "inst-xp", produto: "FUNDO", valor: 35000 },
        { instituicaoId: "inst-xp", produto: "TESOURO", valor: 20000 },
      ],
      participacoes: {
        "inst-ipe": { renda: 1, movimentacao: 1, contasRecorrentes: 1 },
        "inst-xp": { investimentos: 1 },
      },
      explicacao: "Banco Ipê é a instituição principal: recebe 100% da renda e concentra 100% dos pagamentos recorrentes. A XP tem 18,8 pontos: só investimentos.",
      posicaoXp: "SO_INVESTIMENTOS",
      fluxoCaixa: {
        rendaMensal: 14000,
        fontesRenda: [{ pagadorNome: "TechVale Sistemas", instituicaoId: "inst-ipe", valorMensal: 14000, diaDoMes: 5 }],
        custoVidaMensal: 9000, capacidadeAporteMensal: 5000, liquidezImediata: 27000, reservaEmergenciaMeses: 3.0, parcial: true,
        observacao: "Cartão do Banco Aurora estimado pelo pagamento da fatura (R$ 3 mil/mês): o cartão ainda não está conectado.",
      },
      alertas: [saldo, renda, reserva],
      acoes: [
        acao(c, "APLICAR_SALDO_PARADO", "Levar R$ 13 mil parados para liquidez diária", "R$ 22 mil na conta do Banco Ipê; R$ 13 mil acima de 1 mês de custo.", [saldo.id], { principal: true, impactoEstimado: "≈ R$ 104/mês (CDI ilustrativo)" }),
        acao(c, "MONTAR_RESERVA", "Completar a reserva: faltam R$ 27 mil", "Reserva atual de 3,0 meses; meta de 6 meses.", [reserva.id]),
        acao(c, "APORTE_PROGRAMADO", "Propor aporte programado de R$ 2,5 mil/mês (50% da sobra)", "Sobram R$ 5 mil por mês no Banco Ipê.", [renda.id]),
        acao(c, "CONVIDAR_CONEXAO", "Convidar a conectar o cartão do Banco Aurora pelo app", "O custo de vida está estimado: o cartão do Aurora não está conectado.", []),
      ],
    },
  };
}

function defPatricia(): DefCliente {
  const c = "cli-004";
  const fgc = alerta(c, "FGC_EXCEDIDO", "ALTA", "R$ 80 mil acima do FGC no conglomerado Aurora",
    "Banco Aurora e Aurora Financeira são do mesmo conglomerado: R$ 330 mil somados (poupança R$ 150 mil, LCI R$ 174 mil e conta R$ 6 mil). O FGC cobre até R$ 250 mil por CPF por conglomerado: R$ 80 mil ficariam sem garantia.",
    { valor: 80000, instituicaoId: "inst-aurora", emissorId: "emi-aurora" });
  const renda = alerta(c, "RENDA_FORA_XP", "BAIXA", "Benefício do INSS cai no Banco Aurora",
    "O benefício de R$ 8,5 mil cai no Banco Aurora. Sobram cerca de R$ 4,5 mil por mês.",
    { valor: 4500, instituicaoId: "inst-aurora" });
  const ativo = { concedidoEm: "2026-02-10T09:00:00-03:00", expiraEm: "2027-02-10" };
  return {
    motivos: [
      { texto: "R$ 80 mil acima do FGC (conglomerado Aurora)", pontos: 39 },
      { texto: "Renda cai fora da XP (Banco Aurora)", pontos: 10 },
      { texto: "XP só em investimentos", pontos: 5 },
    ],
    visao: {
      cliente: cliente({
        id: c, nome: "Patrícia Gomes", idade: 68, profissao: "Professora aposentada", cidade: "Bauru/SP", perfil: "CONSERVADOR",
        instituicoesDeclaradas: [
          { instituicaoId: "inst-xp", produtos: ["INVESTIMENTOS"] },
          { instituicaoId: "inst-aurora", produtos: ["CONTA", "INVESTIMENTOS"] },
          { instituicaoId: "inst-aurora-fin", produtos: ["INVESTIMENTOS"] },
        ],
        dependentes: [],
        eventosVida: [],
      }),
      consentimentos: [
        consentimento(c, "inst-xp", "ATIVO", TODOS),
        consentimento(c, "inst-aurora", "ATIVO", ["CONTAS", "INVESTIMENTOS"], ativo),
        consentimento(c, "inst-aurora-fin", "ATIVO", ["INVESTIMENTOS"], ativo),
      ],
      contas: [{ instituicaoId: "inst-aurora", saldo: 6000 }],
      investimentos: [
        { instituicaoId: "inst-aurora", produto: "POUPANCA", valor: 150000 },
        { instituicaoId: "inst-aurora-fin", produto: "LCI", valor: 174000 },
        { instituicaoId: "inst-xp", produto: "TESOURO", valor: 400000 },
      ],
      participacoes: {
        "inst-aurora": { renda: 1, movimentacao: 1, contasRecorrentes: 1, investimentos: 150000 / 724000 },
        "inst-aurora-fin": { investimentos: 174000 / 724000 },
        "inst-xp": { investimentos: 400000 / 724000 },
      },
      explicacao: "Banco Aurora é a instituição principal: recebe 100% da renda (INSS) e concentra 100% dos pagamentos recorrentes. A XP tem 10,4 pontos: só investimentos, apesar de custodiar 55% deles.",
      posicaoXp: "SO_INVESTIMENTOS",
      fluxoCaixa: {
        rendaMensal: 8500,
        fontesRenda: [{ pagadorNome: "INSS", instituicaoId: "inst-aurora", valorMensal: 8500, diaDoMes: 25 }],
        custoVidaMensal: 4000, capacidadeAporteMensal: 4500, liquidezImediata: 556000, reservaEmergenciaMeses: 139.0, parcial: false,
      },
      alertas: [fgc, renda],
      acoes: [
        acao(c, "DIVERSIFICAR_FGC", "Distribuir R$ 80 mil entre emissores para ficar 100% coberta", "Aurora e Aurora Financeira somam R$ 330 mil no mesmo conglomerado.", [fgc.id], { principal: true, impactoEstimado: "R$ 80 mil passam a ter garantia do FGC" }),
        acao(c, "APORTE_PROGRAMADO", "Propor aporte programado de R$ 2,2 mil/mês (50% da sobra)", "Sobram R$ 4,5 mil por mês no Banco Aurora.", [renda.id]),
      ],
    },
  };
}

function defRoberto(): DefCliente {
  const c = "cli-005";
  const conc = alerta(c, "CONCENTRACAO_EMISSOR", "ALTA", "Exposição sem garantia de 44% à Agro Sul",
    "R$ 900 mil em CRA da Agro Sul Sementes S.A. (empresa, sem FGC) = 44,4% do patrimônio visível. Referência: até 20% por emissor.",
    { valor: 900000, emissorId: "emi-agrosul" });
  return {
    motivos: [
      { texto: "44% sem garantia na Agro Sul (risco alto)", pontos: 25 },
      { texto: "XP só em investimentos", pontos: 5 },
    ],
    visao: {
      cliente: cliente({
        id: c, nome: "Roberto Lima", idade: 50, profissao: "Produtor rural", cidade: "Sertãozinho/SP", perfil: "MODERADO",
        instituicoesDeclaradas: [
          { instituicaoId: "inst-xp", produtos: ["INVESTIMENTOS"] },
          { instituicaoId: "inst-ipe", produtos: ["CONTA", "CARTAO", "CREDITO"] },
        ],
        dependentes: [{ nome: "Ana", parentesco: "filha", dataNascimento: "2002-12-01" }],
        eventosVida: [{ id: "ev-005-1", tipo: "CASAMENTO", descricao: "Casamento da Ana", data: "2027-03-20", origem: "CADASTRO" }],
      }),
      consentimentos: [
        consentimento(c, "inst-xp", "ATIVO", TODOS),
        consentimento(c, "inst-ipe", "ATIVO", ["CONTAS", "CARTOES", "CREDITO"], { concedidoEm: "2026-01-15T09:00:00-03:00", expiraEm: "2027-01-15" }),
      ],
      contas: [{ instituicaoId: "inst-ipe", saldo: 25000 }],
      investimentos: [
        { instituicaoId: "inst-xp", produto: "CRA", valor: 900000 },
        { instituicaoId: "inst-xp", produto: "TESOURO", valor: 600000 },
        { instituicaoId: "inst-xp", produto: "FUNDO", valor: 300000 },
        { instituicaoId: "inst-xp", produto: "LCA", valor: 200000 },
      ],
      participacoes: {
        "inst-ipe": { renda: 1, movimentacao: 1, contasRecorrentes: 1, cartao: 1, credito: 1 },
        "inst-xp": { investimentos: 1 },
      },
      explicacao: "Banco Ipê é a instituição principal: recebe 100% da renda e concentra os pagamentos, o cartão e o crédito rural. A XP tem 15 pontos: só investimentos.",
      posicaoXp: "SO_INVESTIMENTOS",
      fluxoCaixa: {
        rendaMensal: 20000,
        fontesRenda: [{ pagadorNome: "Fazenda Boa Vista", instituicaoId: "inst-ipe", valorMensal: 20000, diaDoMes: 10 }],
        custoVidaMensal: 19000, capacidadeAporteMensal: 1000, liquidezImediata: 625000, reservaEmergenciaMeses: 32.9, parcial: false,
      },
      alertas: [conc],
      acoes: [
        acao(c, "REDUZIR_CONCENTRACAO", "Reduzir exposição sem garantia à Agro Sul", "R$ 900 mil em CRA de um único emissor (empresa) = 44% do patrimônio.", [conc.id], { principal: true }),
      ],
    },
  };
}

function defLucas(): DefCliente {
  const c = "cli-006";
  return {
    motivos: [],
    visao: {
      cliente: cliente({
        id: c, nome: "Lucas Ferreira", idade: 35, profissao: "Dentista, dono de clínica", cidade: "Piracicaba/SP", perfil: "AGRESSIVO",
        instituicoesDeclaradas: [{ instituicaoId: "inst-xp", produtos: ["CONTA", "CARTAO", "INVESTIMENTOS"] }],
        dependentes: [],
        eventosVida: [{ id: "ev-006-1", tipo: "OUTRO", descricao: "Abertura da 2ª clínica", data: "2027-01-15", origem: "CADASTRO" }],
      }),
      consentimentos: [consentimento(c, "inst-xp", "ATIVO", TODOS)],
      contas: [{ instituicaoId: "inst-xp", saldo: 12000 }],
      investimentos: [
        { instituicaoId: "inst-xp", produto: "ACAO", valor: 300000 },
        { instituicaoId: "inst-xp", produto: "FUNDO", valor: 200000 },
        { instituicaoId: "inst-xp", produto: "TESOURO", valor: 100000 },
      ],
      participacoes: { "inst-xp": { renda: 1, movimentacao: 1, contasRecorrentes: 1, investimentos: 1, cartao: 1 } },
      explicacao: "XP Investimentos é a instituição principal: recebe 100% da renda e concentra a movimentação, as contas e o cartão.",
      posicaoXp: "PRINCIPAL",
      fluxoCaixa: {
        rendaMensal: 22000,
        fontesRenda: [{ pagadorNome: "Clínica Sorriso Pleno", instituicaoId: "inst-xp", valorMensal: 22000, diaDoMes: 5 }],
        custoVidaMensal: 12500, capacidadeAporteMensal: 9500, liquidezImediata: 112000, reservaEmergenciaMeses: 9.0, parcial: false,
      },
      alertas: [],
      acoes: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Alguns clientes de fundo (§6.4): prioridade ≤ 15
// ---------------------------------------------------------------------------

function defFundo(
  id: Id,
  nome: string,
  perfil: Cliente["perfil"],
  opts: { banco?: Id; xpPrincipal: boolean; investXp: number; saldo: number; renda: number; custo: number },
): DefCliente {
  const banco = opts.banco;
  const rendaFora = !opts.xpPrincipal && opts.renda - opts.custo >= 2000;
  const alertas = rendaFora
    ? [alerta(id, "RENDA_FORA_XP", "BAIXA", `Renda cai no ${banco ? nomeBanco(banco) : "banco"}`,
        `A renda de ${Math.round(opts.renda / 1000)} mil cai fora da XP. Sobram cerca de R$ ${Math.round((opts.renda - opts.custo) / 1000)} mil por mês.`,
        { valor: opts.renda - opts.custo, instituicaoId: banco })]
    : [];
  const posicaoXp = opts.xpPrincipal ? "PRINCIPAL" : "SO_INVESTIMENTOS";
  const motivos: ItemFila["motivos"] = [
    ...(rendaFora ? [{ texto: "Renda cai fora da XP", pontos: 10 }] : []),
    ...(posicaoXp === "SO_INVESTIMENTOS" ? [{ texto: "XP só em investimentos", pontos: 5 }] : []),
  ];
  const contaInst = opts.xpPrincipal ? "inst-xp" : (banco ?? "inst-xp");
  return {
    motivos,
    visao: {
      cliente: cliente({
        id, nome, idade: 40, profissao: "Profissional liberal", cidade: "São Paulo/SP", perfil, ancora: false,
        instituicoesDeclaradas: [
          { instituicaoId: "inst-xp", produtos: opts.xpPrincipal ? ["CONTA", "INVESTIMENTOS"] : ["INVESTIMENTOS"] },
          ...(banco ? [{ instituicaoId: banco, produtos: ["CONTA" as const] }] : []),
        ],
        dependentes: [],
        eventosVida: [],
      }),
      consentimentos: [
        consentimento(id, "inst-xp", "ATIVO", TODOS),
        ...(banco ? [consentimento(id, banco, "ATIVO", ["CONTAS"], { concedidoEm: "2026-05-01T09:00:00-03:00", expiraEm: "2027-05-01" })] : []),
      ],
      contas: [{ instituicaoId: contaInst, saldo: opts.saldo }],
      investimentos: [{ instituicaoId: "inst-xp", produto: "TESOURO", valor: opts.investXp }],
      participacoes: opts.xpPrincipal
        ? { "inst-xp": { renda: 1, movimentacao: 1, contasRecorrentes: 1, investimentos: 1 } }
        : { [contaInst]: { renda: 1, movimentacao: 1, contasRecorrentes: 1 }, "inst-xp": { investimentos: 1 } },
      explicacao: opts.xpPrincipal
        ? "XP Investimentos é a instituição principal: recebe 100% da renda e concentra os pagamentos."
        : `${nomeBanco(contaInst)} é a instituição principal: recebe 100% da renda. A XP tem 18,8 pontos: só investimentos.`,
      posicaoXp,
      fluxoCaixa: {
        rendaMensal: opts.renda,
        fontesRenda: [{ pagadorNome: "Empregador", instituicaoId: contaInst, valorMensal: opts.renda, diaDoMes: 5 }],
        custoVidaMensal: opts.custo,
        capacidadeAporteMensal: opts.renda - opts.custo,
        liquidezImediata: opts.saldo + opts.investXp,
        reservaEmergenciaMeses: Math.round(((opts.saldo + opts.investXp) / opts.custo) * 10) / 10,
        parcial: false,
      },
      alertas,
      acoes: rendaFora
        ? [acao(id, "APORTE_PROGRAMADO", "Propor aporte programado mensal", "A renda cai fora da XP e há sobra mensal.", alertas.map((a) => a.id), { principal: true })]
        : [],
    },
  };
}

function nomeBanco(id: Id) {
  return { "inst-aurora": "Banco Aurora", "inst-ipe": "Banco Ipê", "inst-horizonte": "Banco Horizonte" }[id] ?? "XP Investimentos";
}

export const ANCORAS: Id[] = ["cli-001", "cli-002", "cli-003", "cli-004", "cli-005", "cli-006"];

/** Definições estáticas (Marina vem à parte, depende do estado). */
export const DEFS_ESTATICAS: Record<Id, () => DefCliente> = {
  "cli-002": defCarlos,
  "cli-003": defJuliana,
  "cli-004": defPatricia,
  "cli-005": defRoberto,
  "cli-006": defLucas,
  "cli-101": () => defFundo("cli-101", "Fernanda Ribeiro", "MODERADO", { banco: "inst-aurora", xpPrincipal: false, investXp: 180000, saldo: 7000, renda: 15000, custo: 8000 }),
  "cli-102": () => defFundo("cli-102", "André Moura", "ARROJADO", { banco: "inst-ipe", xpPrincipal: false, investXp: 95000, saldo: 4000, renda: 9000, custo: 6000 }),
  "cli-103": () => defFundo("cli-103", "Beatriz Nogueira", "CONSERVADOR", { xpPrincipal: true, investXp: 420000, saldo: 9000, renda: 18000, custo: 11000 }),
  "cli-104": () => defFundo("cli-104", "Gustavo Teles", "AGRESSIVO", { banco: "inst-horizonte", xpPrincipal: false, investXp: 250000, saldo: 5000, renda: 7000, custo: 6000 }),
};

export { DATA_REFERENCIA };
