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
    expect((await assessor.visao360("cli-001")).cobertura.instituicoesConectadas).toBe(3);
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
    expect((await b.visao360("cli-001")).cobertura.instituicoesConectadas).toBe(2);
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
    const c4 = await api.visao360("cli-004");
    expect(c4.alertas.find((a) => a.tipo === "FGC_EXCEDIDO")?.valor).toBe(80000);
    const c5 = await api.visao360("cli-005");
    expect(c5.alertas.find((a) => a.tipo === "CONCENTRACAO_EMISSOR")?.severidade).toBe("ALTA");
    const c6 = await api.visao360("cli-006");
    expect(c6.alertas).toEqual([]);
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

  it("cliente inexistente gera erro 404", async () => {
    const api = await novaInstancia();
    await expect(api.visao360("cli-999")).rejects.toMatchObject({ status: 404 });
  });
});

describe("mockApi — notas do assessor (editar cliente)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("nota vira contexto e recomenda produto pela necessidade; reset apaga", async () => {
    const api = await novaInstancia();
    const r = await api.registrarNota("cli-003", "A Juliana bateu o carro semana passada. Quer juntar para a faculdade do filho.", "AUDIO");

    expect(r.necessidades.map((n) => n.tipo)).toEqual(["PROTECAO_VEICULO", "EDUCACAO"]);
    expect(r.recomendacoes[0]).toMatchObject({ necessidade: "PROTECAO_VEICULO", produto: "Seguro auto",
      motivo: "A Juliana bateu o carro semana passada" });
    expect(r.geradoPor).toBe("stub");

    const outra = await novaInstancia();   // outro iframe do /palco: mesmo localStorage
    const c = await outra.contextoAssessor("cli-003");
    expect(c.anotacoes[0]).toMatchObject({ origem: "AUDIO", data: "2026-10-11" });
    expect(c.recomendacoes.map((x) => x.produto)).toContain("Seguro auto");
    expect((await outra.contextoAssessor("cli-001")).anotacoes).toEqual([]);

    await outra.resetDemo();
    expect((await api.contextoAssessor("cli-003")).anotacoes).toEqual([]);
  });

  it("nota vazia é 400 e cliente inexistente é 404", async () => {
    const api = await novaInstancia();
    await expect(api.registrarNota("cli-003", "   ", "TEXTO")).rejects.toMatchObject({ status: 400 });
    await expect(api.contextoAssessor("cli-999")).rejects.toMatchObject({ status: 404 });
  });
});
