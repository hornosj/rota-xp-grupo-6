// Textos "stub" do Copiloto no modo mock (espelham o modo stub do backend, §8.1).
import type { AcaoSugerida, Briefing, Canal, MensagemGerada, Visao360 } from "@/lib/api-types";
import { brlCurto, numero, primeiroNome } from "@/lib/formato";

function ganchoEvento(v: Visao360): string {
  const ev = v.alertas.find((a) => a.tipo === "EVENTO_VIDA_PROXIMO");
  if (!ev) return "";
  const dep = v.cliente.dependentes[0];
  if (ev.titulo.toLowerCase().includes("aniversário") && dep) {
    return ` E já adianto: parabéns antecipado pelo aniversário da ${dep.nome}!`;
  }
  return "";
}

function corpo(v: Visao360, a: AcaoSugerida): string {
  const nome = primeiroNome(v.cliente.nome);
  const fgc = v.alertas.find((x) => x.tipo === "FGC_EXCEDIDO");
  const fgcInst = fgc?.instituicaoId ? v.consentimentos.find((c) => c.instituicaoId === fgc.instituicaoId)?.instituicaoNome : undefined;
  const evento = ganchoEvento(v);
  switch (a.tipo) {
    case "DIVERSIFICAR_FGC":
      return `Oi, ${nome}! Tudo bem? Revisando seu patrimônio, vi que ${brlCurto(fgc?.valor)}${fgcInst ? ` no ${fgcInst}` : ""} estão acima da cobertura do FGC. Tenho uma sugestão simples para deixar tudo protegido. Podemos falar 10 minutos amanhã?${evento}`;
    case "REDUZIR_CONCENTRACAO":
      return `Oi, ${nome}! Tudo bem? Olhando sua carteira, vi uma parte relevante concentrada em um único emissor, sem garantia do FGC. Queria te mostrar uma forma de diluir esse risco sem perder rentabilidade. Tem 15 minutos esta semana?${evento}`;
    case "APLICAR_SALDO_PARADO": {
      const s = v.alertas.find((x) => x.tipo === "SALDO_PARADO");
      return `Oi, ${nome}! Tudo bem? Vi que você tem cerca de ${brlCurto(s?.valor)} parados em conta corrente, além da sua reserva do mês. Dá para deixar esse valor rendendo com liquidez diária, sem perder acesso. Posso te mandar uma proposta?${evento}`;
    }
    case "APORTE_PROGRAMADO":
      return `Oi, ${nome}! Tudo bem? Pensando nos seus objetivos, que tal programar um aporte mensal automático? Assim a sobra do mês já vai direto para os investimentos. Te explico em 10 minutos quando puder.${evento}`;
    case "REINVESTIR_VENCIMENTO":
      return `Oi, ${nome}! Tudo bem? Um investimento seu vence nos próximos dias e queria deixar o reinvestimento preparado para o dinheiro não ficar parado. Podemos conversar amanhã?${evento}`;
    case "RENOVAR_CONSENTIMENTO":
      return `Oi, ${nome}! Tudo bem? A conexão do Open Finance com o seu banco expira em breve. Renovar pelo app leva 1 minuto e mantém sua visão completa do patrimônio.${evento}`;
    case "CONTATO_RELACIONAMENTO": {
      const dep = v.cliente.dependentes[0];
      return `Oi, ${nome}! Tudo bem? Passando para desejar um feliz aniversário antecipado ${dep ? `para a ${dep.nome}` : ""}! Se quiser, depois a gente conversa sobre um investimento para o futuro dela.`;
    }
    case "CONVIDAR_CONEXAO": {
      const p = v.cobertura.pendentes[0];
      return `Oi, ${nome}! Tudo bem? No app da XP você pode conectar ${p ? `o ${p.nome}` : "suas outras instituições"} pelo Open Finance e ver se todo o seu patrimônio está protegido. Leva 1 minuto e você pode revogar quando quiser.${evento}`;
    }
    case "MONTAR_RESERVA":
      return `Oi, ${nome}! Tudo bem? Fiz as contas e sua reserva de emergência cobre ${numero(v.fluxoCaixa.reservaEmergenciaMeses)} meses do seu custo de vida. Queria te ajudar a chegar nos 6 meses com aportes pequenos. Podemos falar?${evento}`;
  }
}

export function mensagemStub(v: Visao360, a: AcaoSugerida, canal: Canal): MensagemGerada {
  const texto = corpo(v, a);
  return {
    texto: canal === "EMAIL" ? `Assunto: ${a.titulo}\n\n${texto}\n\nAbraço,\nSua assessora XP` : texto,
    canal,
    geradoPor: "stub",
  };
}

export function briefingStub(v: Visao360): Briefing {
  const nome = primeiroNome(v.cliente.nome);
  const bullets = [
    v.principalidade.explicacao,
    `Patrimônio visível de ${brlCurto(v.patrimonio.totalVisivel)}, ${brlCurto(v.patrimonio.naXp)} na XP (${Math.round(v.patrimonio.shareOfWalletXp * 100)}%).`,
    `Renda de ${brlCurto(v.fluxoCaixa.rendaMensal)}/mês, custo de vida de ${brlCurto(v.fluxoCaixa.custoVidaMensal)} e sobra de ${brlCurto(v.fluxoCaixa.capacidadeAporteMensal)}.`,
    ...v.alertas.slice(0, 2).map((a) => a.titulo + "."),
  ];
  const acao = v.acoes.find((a) => a.principal);
  if (acao) bullets.push(`Próxima melhor ação: ${acao.titulo}.`);
  return {
    clienteId: v.cliente.id,
    bullets: bullets.slice(0, 5),
    perguntasSugeridas: [
      `${nome}, quais são seus planos para os próximos 12 meses?`,
      "Você tem algum gasto grande previsto (viagem, reforma, escola)?",
      v.cobertura.pendentes.length
        ? `Topa conectar ${v.cobertura.pendentes.map((p) => `o ${p.nome}`).join(" e ")} pelo app para eu ver o quadro completo?`
        : "Como você se sente em relação ao risco da carteira hoje?",
    ],
    geradoPor: "stub",
  };
}
