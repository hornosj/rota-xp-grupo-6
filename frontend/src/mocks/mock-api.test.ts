import { beforeEach, describe, expect, it, vi } from "vitest";

async function novaInstancia() {
  // Simula outro iframe: módulo recarregado, mesmo localStorage.
  vi.resetModules();
  return (await import("./index")).mockApi;
}

describe("mockApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("fila antes: cli-004 em 1º, Marina em 2º com 39,1", async () => {
    const api = await novaInstancia();
    const fila = await api.fila();
    const ancoras = fila.filter((i) => ["cli-001","cli-002","cli-003","cli-004","cli-005","cli-006"].includes(i.clienteId));
    expect(ancoras.map((i) => i.clienteId)).toEqual([
      "cli-004", "cli-001", "cli-003", "cli-005", "cli-002", "cli-006",
    ]);
    expect(fila[1].prioridade).toBeCloseTo(39.1, 1);
    expect(fila[1].novo).toBe(false);
    expect(fila.map((i) => i.posicao)).toEqual(fila.map((_, k) => k + 1));
    expect(fila.find((i) => i.clienteId === "cli-004")?.prioridade).toBe(54);
  });

  it("Marina antes: 67% coberta, Aurora principal 85 x XP 15, sem FGC", async () => {
    const api = await novaInstancia();
    const v = await api.visao360("cli-001");
    expect(v.cobertura.instituicoesConectadas).toBe(2);
    expect(v.cobertura.pendentes.map((p) => p.instituicaoId)).toEqual(["inst-horizonte"]);
    expect(v.principalidade.instituicaoPrincipalId).toBe("inst-aurora");
    expect(v.principalidade.posicaoXp).toBe("SO_INVESTIMENTOS");
    const aurora = v.principalidade.scores.find((s) => s.instituicaoId === "inst-aurora")!;
    const xp = v.principalidade.scores.find((s) => s.instituicaoId === "inst-xp")!;
    expect(aurora.score).toBeCloseTo(85, 1);
    expect(xp.score).toBeCloseTo(15, 1);
    const soma = Object.values(aurora.contribuicoes).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(aurora.score, 1);
    expect(v.fluxoCaixa.custoVidaMensal).toBe(24000);
    expect(v.fluxoCaixa.reservaEmergenciaMeses).toBe(6.5);
    const tipos = v.alertas.map((a) => a.tipo).sort();
    expect(tipos).toEqual(["EVENTO_VIDA_PROXIMO", "RENDA_FORA_XP", "SALDO_PARADO"]);
    expect(v.alertas.find((a) => a.tipo === "SALDO_PARADO")?.valor).toBe(61000);
    expect(v.patrimonio.totalVisivel).toBe(985000);
  });

  it("jornada Marina antes: 67%, nível 2, missão Horizonte, FGC bloqueado", async () => {
    const api = await novaInstancia();
    const j = await api.jornada("cli-001");
    expect(j.completude).toBeCloseTo(0.6667, 3);
    expect(j.nivel.numero).toBe(2);
    expect(j.nivel.nome).toBe("Visão Clara");
    expect(j.missoes.find((m) => m.instituicaoId === "inst-horizonte")?.status).toBe("DISPONIVEL");
    const fgc = j.diagnosticos.find((d) => d.tipo === "PROTECAO_FGC")!;
    expect(fgc.desbloqueado).toBe(false);
    expect(j.diagnosticos.find((d) => d.tipo === "CUSTO_DE_VIDA")?.desbloqueado).toBe(true);
  });

  it("conceder troca a Marina para 'depois' e é compartilhado via localStorage", async () => {
    const cliente = await novaInstancia();
    const depois = await cliente.conceder("cli-001", "inst-horizonte");
    expect(depois.cobertura.percentual).toBe(1);
    const fgc = depois.alertas.find((a) => a.tipo === "FGC_EXCEDIDO")!;
    expect(fgc.valor).toBe(400000);
    expect(fgc.severidade).toBe("ALTA");
    expect(fgc.novo).toBe(true);
    const conc = depois.alertas.find((a) => a.tipo === "CONCENTRACAO_EMISSOR")!;
    expect(conc.severidade).toBe("MEDIA");
    expect(depois.acoes.find((a) => a.principal)?.tipo).toBe("DIVERSIFICAR_FGC");

    // "outro iframe"
    const assessor = await novaInstancia();
    const fila = await assessor.fila();
    expect(fila[0].clienteId).toBe("cli-001");
    expect(fila[0].prioridade).toBe(100);
    expect(fila[0].novo).toBe(true);
    const j = await assessor.jornada("cli-001");
    expect(j.completude).toBe(1);
    expect(j.nivel.numero).toBe(3);
    const fgcDiag = j.diagnosticos.find((d) => d.tipo === "PROTECAO_FGC")!;
    expect(fgcDiag.desbloqueado).toBe(true);
    expect(fgcDiag.resumo).toContain("R$ 400 mil");
    expect(j.missoes.find((m) => m.instituicaoId === "inst-horizonte")?.status).toBe("CONCLUIDA");
  });

  it("conceder de novo (já ativo) não quebra", async () => {
    const api = await novaInstancia();
    await api.conceder("cli-001", "inst-horizonte");
    const v = await api.conceder("cli-001", "inst-horizonte");
    expect(v.cobertura.percentual).toBe(1);
  });

  it("resetDemo restaura o estado inicial para todos", async () => {
    const a = await novaInstancia();
    await a.conceder("cli-001", "inst-horizonte");
    await a.resetDemo();
    const b = await novaInstancia();
    expect((await b.fila()).findIndex((i) => i.clienteId === "cli-001")).toBeGreaterThan(0);
    expect((await b.jornada("cli-001")).nivel.numero).toBe(2);
  });

  it("revogar Horizonte volta a Marina para 'antes' e marca REVOGADO", async () => {
    const api = await novaInstancia();
    await api.conceder("cli-001", "inst-horizonte");
    const v = await api.revogar("cli-001", "inst-horizonte");
    expect(v.alertas.some((a) => a.tipo === "FGC_EXCEDIDO")).toBe(false);
    expect(v.consentimentos.find((c) => c.instituicaoId === "inst-horizonte")?.status).toBe("REVOGADO");
  });

  it("âncoras do §6.5", async () => {
    const api = await novaInstancia();
    const c2 = await api.visao360("cli-002");
    expect(c2.principalidade.posicaoXp).toBe("PRINCIPAL");
    expect(c2.alertas.map((a) => a.tipo).sort()).toEqual(["CONSENTIMENTO_EXPIRANDO", "VENCIMENTO_PROXIMO"]);
    const c3 = await api.visao360("cli-003");
    expect(c3.fluxoCaixa.parcial).toBe(true);
    expect(c3.fluxoCaixa.reservaEmergenciaMeses).toBe(3);
    const j3 = await api.jornada("cli-003");
    expect(j3.diagnosticos.find((d) => d.tipo === "CUSTO_DE_VIDA")?.desbloqueado).toBe(false);
    expect(j3.missoes.some((m) => m.tipo === "CONECTAR_CARTAO")).toBe(true);
    expect(j3.missoes.some((m) => m.tipo === "RESERVA_EMERGENCIA")).toBe(true);
    const c4 = await api.visao360("cli-004");
    expect(c4.alertas.find((a) => a.tipo === "FGC_EXCEDIDO")?.valor).toBe(80000);
    const c5 = await api.visao360("cli-005");
    expect(c5.alertas.find((a) => a.tipo === "CONCENTRACAO_EMISSOR")?.severidade).toBe("ALTA");
    const c6 = await api.visao360("cli-006");
    expect(c6.alertas).toEqual([]);
    expect((await api.jornada("cli-006")).nivel.numero).toBe(4);
    expect((await api.jornada("cli-002")).nivel.numero).toBe(4);
  });

  it("painel, consentimentos, mensagem e briefing", async () => {
    const api = await novaInstancia();
    const p = await api.painel();
    const soma = Object.values(p.distribuicaoPosicaoXp).reduce((a, b) => a + b, 0);
    expect(soma).toBe(p.totalClientes);
    const cons = await api.consentimentos("cli-001");
    expect(cons.find((c) => c.instituicaoId === "inst-horizonte")?.status).toBe("PENDENTE");
    expect(cons.find((c) => c.instituicaoId === "inst-horizonte")?.instituicaoNome).toBe("Banco Horizonte");
    await api.conceder("cli-001", "inst-horizonte");
    const v = await api.visao360("cli-001");
    const acaoFgc = v.acoes.find((a) => a.tipo === "DIVERSIFICAR_FGC")!;
    const m = await api.mensagem("cli-001", acaoFgc.id, "WHATSAPP");
    expect(m.texto).toContain("Marina");
    expect(m.texto).toContain("Sofia");
    expect(m.texto).toContain("R$ 400");
    expect(m.canal).toBe("WHATSAPP");
    const b = await api.briefing("cli-001");
    expect(b.bullets.length).toBeGreaterThan(0);
    expect(b.perguntasSugeridas.length).toBeGreaterThan(0);
  });

  it("jornada da Marina no modo mock é a resposta REAL do backend (antes e depois)", async () => {
    const api = await novaInstancia();
    const antes = (await import("./fixtures-contrato/jornada-cli-001-antes.json")).default;
    const depois = (await import("./fixtures-contrato/jornada-cli-001-depois.json")).default;
    expect(await api.jornada("cli-001")).toEqual(antes);
    await api.conceder("cli-001", "inst-horizonte");
    expect(await api.jornada("cli-001")).toEqual(depois);
  });

  it("jornadas derivadas: detalhes dos diagnósticos na forma do contrato real", async () => {
    const api = await novaInstancia();
    const obrigatorias: Record<string, string[]> = {
      PATRIMONIO_COMPLETO: ["instituicoes", "total"],
      PROTECAO_FGC: ["valorSemCobertura", "conglomerados"],
      CUSTO_DE_VIDA: ["total", "categorias", "parcial"],
      RESERVA_EMERGENCIA: ["meses", "liquidezImediata", "metaMeses", "meta"],
    };
    const conhecidas = new Set(Object.values(obrigatorias).flat().concat("instituicao"));
    let desbloqueados = 0;
    for (const id of ["cli-002", "cli-003", "cli-004", "cli-005", "cli-006", "cli-101", "cli-103"]) {
      const j = await api.jornada(id);
      for (const d of j.diagnosticos.filter((x) => x.desbloqueado)) {
        desbloqueados++;
        expect(Object.keys(d.detalhes ?? {}), `${id} ${d.tipo}`).toEqual(expect.arrayContaining(obrigatorias[d.tipo]));
        for (const k of Object.keys(d.detalhes ?? {})) expect(conhecidas, `${id} ${d.tipo}.${k}`).toContain(k);
      }
    }
    expect(desbloqueados).toBeGreaterThan(4);
  });

  it("cliente inexistente gera erro 404", async () => {
    const api = await novaInstancia();
    await expect(api.visao360("cli-999")).rejects.toMatchObject({ status: 404 });
  });
});
