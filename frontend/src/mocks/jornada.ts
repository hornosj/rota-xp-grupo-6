// Jornadas gamificadas do modo mock (§7.10). Marina tem fixtures explícitas (antes/depois);
// os demais são derivados da Visao360 mock seguindo as mesmas regras.
import type { Diagnostico, Jornada, Missao, NivelJornada, Visao360 } from "@/lib/api-types";
import { brlCurto, numero } from "@/lib/formato";

const NIVEIS: Record<1 | 2 | 3 | 4, Omit<NivelJornada, "comoSubir">> = {
  1: { numero: 1, nome: "Explorador", proximo: "Visão Clara", beneficios: ["Resumo do patrimônio conectado"] },
  2: {
    numero: 2,
    nome: "Visão Clara",
    proximo: "Patrimônio Completo",
    beneficios: ["Diagnóstico de custo de vida", "Reserva de emergência calculada"],
  },
  3: {
    numero: 3,
    nome: "Patrimônio Completo",
    proximo: "Cliente Principal",
    beneficios: ["Relatório mensal personalizado (exemplo)", "Diagnóstico de proteção do FGC", "Convites para eventos (exemplo)"],
  },
  4: {
    numero: 4,
    nome: "Cliente Principal",
    beneficios: ["Atendimento prioritário (exemplo)", "Relatório mensal personalizado (exemplo)", "Eventos exclusivos (exemplo)"],
  },
};

const CUSTO_MARINA = {
  categorias: {
    "Financiamento imobiliário": 6500,
    "Cartão de crédito": 9000,
    "Escola": 3200,
    "Condomínio": 2800,
    "Consumo no débito": 1900,
    "Energia": 450,
    "Internet": 150,
  },
  total: 24000,
};

export function jornadaMarina(depois: boolean): Jornada {
  const missaoHorizonte: Missao = {
    id: "mis-001-horizonte",
    tipo: "CONECTAR_INSTITUICAO",
    titulo: "Conecte o Banco Horizonte",
    descricao: "Conecte o Banco Horizonte e descubra se você está protegida pelo FGC.",
    recompensa: "Diagnóstico Proteção FGC + nível 3",
    status: depois ? "CONCLUIDA" : "DISPONIVEL",
    progresso: depois ? 1 : 0,
    instituicaoId: "inst-horizonte",
  };
  const diagnosticos: Diagnostico[] = [
    {
      tipo: "PATRIMONIO_COMPLETO",
      titulo: "Patrimônio completo",
      desbloqueado: depois,
      requisito: "Conecte todas as instituições que você declarou",
      ...(depois
        ? {
            resumo: "R$ 1,6 mi no total: 55% na XP",
            detalhes: { totalVisivel: 1635000, naXp: 900000, foraXp: 735000 },
          }
        : {}),
    },
    {
      tipo: "PROTECAO_FGC",
      titulo: "Proteção FGC",
      desbloqueado: depois,
      requisito: "Conecte o Banco Horizonte para ver 100% do patrimônio",
      ...(depois
        ? {
            resumo: "R$ 400 mil sem cobertura no Banco Horizonte",
            detalhes: { valorSemCobertura: 400000, instituicao: "Banco Horizonte", limitePorConglomerado: 250000, totalNoConglomerado: 650000 },
          }
        : {}),
    },
    {
      tipo: "CUSTO_DE_VIDA",
      titulo: "Custo de vida",
      desbloqueado: true,
      requisito: "Conecte todos os seus cartões",
      resumo: "R$ 24 mil por mês",
      detalhes: CUSTO_MARINA,
    },
    {
      tipo: "RESERVA_EMERGENCIA",
      titulo: "Reserva de emergência",
      desbloqueado: true,
      requisito: "Desbloqueie o custo de vida",
      resumo: "6,5 meses de reserva",
      detalhes: { meses: 6.5, liquidezImediata: 155000, metaMeses: 6 },
    },
  ];
  return {
    clienteId: "cli-001",
    completude: depois ? 1 : 0.6667,
    nivel: depois
      ? { ...NIVEIS[3], comoSubir: "Concentre seu dia a dia financeiro na XP (por exemplo, recebendo o salário na conta XP)." }
      : { ...NIVEIS[2], comoSubir: "Conecte o Banco Horizonte para ver 100% do seu patrimônio." },
    missoes: [missaoHorizonte],
    diagnosticos,
  };
}

/** Jornada derivada para os demais clientes (mesmas regras do §7.10). */
export function jornadaDerivada(v: Visao360): Jornada {
  const completude = v.cobertura.percentual;
  const ativos = new Set(
    v.consentimentos
      .filter((c) => c.status === "ATIVO")
      .map((c) => c.instituicaoId),
  );
  const cartoesVisiveis = v.cliente.instituicoesDeclaradas
    .filter((d) => d.produtos.includes("CARTAO"))
    .every((d) => {
      if (d.instituicaoId === "inst-xp") return true;
      const c = v.consentimentos.find((x) => x.instituicaoId === d.instituicaoId);
      return !!c && c.status === "ATIVO" && c.escopos.includes("CARTOES");
    });
  const numeroNivel: 1 | 2 | 3 | 4 =
    completude < 0.5 ? 1 : completude < 1 ? 2 : v.principalidade.posicaoXp === "PRINCIPAL" ? 4 : 3;
  const comoSubir =
    numeroNivel === 1 || numeroNivel === 2
      ? `Conecte ${v.cobertura.pendentes.map((p) => p.nome).join(" e ")} para ver 100% do seu patrimônio.`
      : numeroNivel === 3
        ? "Concentre seu dia a dia financeiro na XP (por exemplo, recebendo o salário na conta XP)."
        : undefined;

  const missoes: Missao[] = v.cliente.instituicoesDeclaradas
    .filter((d) => d.instituicaoId !== "inst-xp")
    .map((d) => {
      const nome = v.consentimentos.find((c) => c.instituicaoId === d.instituicaoId)?.instituicaoNome ?? d.instituicaoId;
      const cartao = d.produtos.includes("CARTAO");
      const concluida = ativos.has(d.instituicaoId);
      return {
        id: `mis-${v.cliente.id.replace("cli-", "")}-${d.instituicaoId.replace("inst-", "")}`,
        tipo: cartao ? "CONECTAR_CARTAO" : "CONECTAR_INSTITUICAO",
        titulo: cartao ? `Conecte seu cartão do ${nome}` : `Conecte o ${nome}`,
        descricao: cartao
          ? `Conecte o cartão do ${nome} e descubra quanto custa o seu mês de verdade.`
          : `Conecte o ${nome} para completar a visão do seu patrimônio.`,
        recompensa: cartao ? "Diagnóstico Custo de vida" : "Diagnóstico Patrimônio completo",
        status: concluida ? "CONCLUIDA" : "DISPONIVEL",
        progresso: concluida ? 1 : 0,
        instituicaoId: d.instituicaoId,
      } satisfies Missao;
    });

  const reserva = v.fluxoCaixa.reservaEmergenciaMeses;
  if (reserva < 6) {
    missoes.push({
      id: `mis-${v.cliente.id.replace("cli-", "")}-reserva`,
      tipo: "RESERVA_EMERGENCIA",
      titulo: "Monte sua reserva de emergência",
      descricao: `Você tem ${numero(reserva)} meses de reserva. A meta é 6 meses do seu custo de vida.`,
      recompensa: "Selo Reserva completa",
      status: "DISPONIVEL",
      progresso: Math.round((reserva / 6) * 100) / 100,
    });
  }
  for (const c of v.consentimentos) {
    if (c.status === "ATIVO" && c.expiraEm && c.expiraEm <= "2026-10-26") {
      missoes.push({
        id: `mis-${v.cliente.id.replace("cli-", "")}-renovar-${c.instituicaoId.replace("inst-", "")}`,
        tipo: "RENOVAR_CONSENTIMENTO",
        titulo: `Renove a conexão com o ${c.instituicaoNome}`,
        descricao: "Sua autorização expira em breve. Renove para manter a visão completa.",
        recompensa: "Mantém o nível atual",
        status: "DISPONIVEL",
        progresso: 0,
        instituicaoId: c.instituicaoId,
      });
    }
  }

  const completo = completude >= 1;
  const fgc = v.alertas.find((a) => a.tipo === "FGC_EXCEDIDO");
  const diagnosticos: Diagnostico[] = [
    {
      tipo: "PATRIMONIO_COMPLETO",
      titulo: "Patrimônio completo",
      desbloqueado: completo,
      requisito: "Conecte todas as instituições que você declarou",
      ...(completo
        ? {
            resumo: `${brlCurto(v.patrimonio.totalVisivel)} no total`,
            detalhes: { totalVisivel: v.patrimonio.totalVisivel, naXp: v.patrimonio.naXp, foraXp: v.patrimonio.foraXp },
          }
        : {}),
    },
    {
      tipo: "PROTECAO_FGC",
      titulo: "Proteção FGC",
      desbloqueado: completo,
      requisito: "Conecte todas as instituições para ver 100% do patrimônio",
      ...(completo
        ? fgc
          ? { resumo: `${brlCurto(fgc.valor)} sem cobertura`, detalhes: { valorSemCobertura: fgc.valor ?? 0 } }
          : { resumo: "Todo o seu patrimônio está protegido", detalhes: { valorSemCobertura: 0 } }
        : {}),
    },
    {
      tipo: "CUSTO_DE_VIDA",
      titulo: "Custo de vida",
      desbloqueado: cartoesVisiveis,
      requisito: "Conecte todos os seus cartões",
      ...(cartoesVisiveis
        ? { resumo: `${brlCurto(v.fluxoCaixa.custoVidaMensal)} por mês`, detalhes: { total: v.fluxoCaixa.custoVidaMensal } }
        : {}),
    },
    {
      tipo: "RESERVA_EMERGENCIA",
      titulo: "Reserva de emergência",
      desbloqueado: cartoesVisiveis,
      requisito: "Desbloqueie o custo de vida",
      ...(cartoesVisiveis
        ? {
            resumo: `${numero(reserva)} meses de reserva`,
            detalhes: { meses: reserva, liquidezImediata: v.fluxoCaixa.liquidezImediata, metaMeses: 6 },
          }
        : {}),
    },
  ];

  return {
    clienteId: v.cliente.id,
    completude,
    nivel: { ...NIVEIS[numeroNivel], ...(comoSubir ? { comoSubir } : {}) },
    missoes,
    diagnosticos,
  };
}
