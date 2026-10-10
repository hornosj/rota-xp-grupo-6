// Jornadas gamificadas do modo mock (§7.10). Marina usa as fixtures reais do backend (antes/depois);
// os demais são derivados da Visao360 mock seguindo as mesmas regras e a mesma forma de `detalhes`.
import type {
  Diagnostico,
  DetalhesCustoDeVida,
  DetalhesPatrimonioCompleto,
  DetalhesProtecaoFgc,
  DetalhesReservaEmergencia,
  Jornada,
  Missao,
  NivelJornada,
  Visao360,
} from "@/lib/api-types";
import { brlCurto, numero } from "@/lib/formato";
import jornadaMarinaAntes from "./fixtures-contrato/jornada-cli-001-antes.json";
import jornadaMarinaDepois from "./fixtures-contrato/jornada-cli-001-depois.json";

const LIMITE_FGC = 250_000;
const META_RESERVA_MESES = 6;

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

/** Marina: as respostas REAIS do backend (contract/fixtures), antes e depois de conectar o Banco Horizonte. */
export function jornadaMarina(depois: boolean): Jornada {
  return structuredClone((depois ? jornadaMarinaDepois : jornadaMarinaAntes) as unknown as Jornada);
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
  const fgcs = v.alertas.filter((a) => a.tipo === "FGC_EXCEDIDO");
  const fgc = [...fgcs].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))[0];
  const nomeInst = (id?: string) => v.patrimonio.porInstituicao.find((p) => p.instituicaoId === id)?.nome ?? id ?? "—";
  const detPatrimonio: DetalhesPatrimonioCompleto = {
    instituicoes: v.patrimonio.porInstituicao.length,
    total: v.patrimonio.totalVisivel,
  };
  // Aproximação do mock: um conglomerado por alerta de FGC (o backend real lista todos).
  const detFgc: DetalhesProtecaoFgc = {
    valorSemCobertura: fgcs.reduce((s, a) => s + (a.valor ?? 0), 0),
    ...(fgc ? { instituicao: nomeInst(fgc.instituicaoId) } : {}),
    conglomerados: fgcs.map((a) => ({
      conglomeradoId: `cong-${(a.instituicaoId ?? a.id).replace("inst-", "")}`,
      nome: nomeInst(a.instituicaoId),
      valor: LIMITE_FGC + (a.valor ?? 0),
      coberto: LIMITE_FGC,
      descoberto: a.valor ?? 0,
    })),
  };
  const detCusto: DetalhesCustoDeVida = { total: v.fluxoCaixa.custoVidaMensal, categorias: {}, parcial: v.fluxoCaixa.parcial };
  const detReserva: DetalhesReservaEmergencia = {
    meses: reserva,
    liquidezImediata: v.fluxoCaixa.liquidezImediata,
    metaMeses: META_RESERVA_MESES,
    meta: META_RESERVA_MESES * v.fluxoCaixa.custoVidaMensal,
  };
  const diagnosticos: Diagnostico[] = [
    {
      tipo: "PATRIMONIO_COMPLETO",
      titulo: "Patrimônio completo",
      desbloqueado: completo,
      requisito: "Conecte todas as instituições que você declarou",
      ...(completo
        ? {
            resumo: `${brlCurto(v.patrimonio.totalVisivel)} no total`,
            detalhes: { ...detPatrimonio },
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
          ? { resumo: `${brlCurto(detFgc.valorSemCobertura)} sem cobertura no ${detFgc.instituicao}`, detalhes: { ...detFgc } }
          : { resumo: "Todo o seu patrimônio está protegido", detalhes: { ...detFgc } }
        : {}),
    },
    {
      tipo: "CUSTO_DE_VIDA",
      titulo: "Custo de vida",
      desbloqueado: cartoesVisiveis,
      requisito: "Conecte todos os seus cartões",
      ...(cartoesVisiveis
        ? { resumo: `${brlCurto(v.fluxoCaixa.custoVidaMensal)} por mês`, detalhes: { ...detCusto } }
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
            detalhes: { ...detReserva },
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
