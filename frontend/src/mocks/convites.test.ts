import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function novaInstancia() {
  // Simula outro iframe: módulo recarregado, mesmo localStorage.
  vi.resetModules();
  return (await import("./index")).mockApi;
}

const ACAO_CONVIDAR = "acao-cli-001-convidar_conexao-inst-horizonte";

describe("mockApi · convites", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("criarConvite gera token determinístico, 12 meses, 48h, link /convite/{token}", async () => {
    const api = await novaInstancia();
    const c = await api.criarConvite("cli-001", "inst-horizonte");
    expect(c.token).toBe("cv-cli-001-inst-horizonte");
    expect(c).toMatchObject({
      clienteId: "cli-001",
      instituicaoId: "inst-horizonte",
      instituicaoNome: "Banco Horizonte",
      prazoMeses: 12,
      status: "PENDENTE",
    });
    expect(c.escopos).toContain("INVESTIMENTOS");
    expect(c.link).toMatch(/\/convite\/cv-cli-001-inst-horizonte$/);
    expect(new Date(c.expiraEm).getTime() - new Date(c.criadoEm).getTime()).toBe(48 * 3600 * 1000);
  });

  it("criarConvite de novo reaproveita o PENDENTE (mesmo token, sem duplicar)", async () => {
    const api = await novaInstancia();
    const a = await api.criarConvite("cli-001", "inst-horizonte");
    const b = await (await novaInstancia()).criarConvite("cli-001", "inst-horizonte");
    expect(b.token).toBe(a.token);
    expect(b.criadoEm).toBe(a.criadoEm);
    expect(await api.convites("cli-001")).toHaveLength(1);
  });

  it("convites lista os do cliente; convite(token) busca e 404 se não existe", async () => {
    const api = await novaInstancia();
    expect(await api.convites("cli-001")).toEqual([]);
    const c = await api.criarConvite("cli-001", "inst-horizonte");
    expect((await api.convites("cli-001")).map((x) => x.token)).toEqual([c.token]);
    expect(await api.convites("cli-002")).toEqual([]);
    expect((await api.convite(c.token)).status).toBe("PENDENTE");
    await expect(api.convite("cv-nao-existe")).rejects.toMatchObject({ status: 404 });
  });

  it("criarConvite para instituição já conectada é 409 CONFLITO; inexistente é 404", async () => {
    const api = await novaInstancia();
    await expect(api.criarConvite("cli-001", "inst-aurora")).rejects.toMatchObject({ status: 409, erro: "CONFLITO" });
    await expect(api.criarConvite("cli-001", "inst-nada")).rejects.toMatchObject({ status: 404 });
    await expect(api.criarConvite("cli-999", "inst-horizonte")).rejects.toMatchObject({ status: 404 });
  });

  it("confirmar troca a Marina para 'depois' em todos os iframes (1º, NOVO, FGC R$ 400 mil, 3 de 3)", async () => {
    const assessor = await novaInstancia();
    const c = await assessor.criarConvite("cli-001", "inst-horizonte");
    const celular = await novaInstancia();
    const confirmado = await celular.confirmarConvite(c.token);
    expect(confirmado.status).toBe("CONFIRMADO");

    const outra = await novaInstancia();
    const v = await outra.visao360("cli-001");
    expect(v.cobertura.instituicoesConectadas).toBe(3);
    expect(v.cobertura.percentual).toBe(1);
    expect(v.alertas.find((a) => a.tipo === "FGC_EXCEDIDO")).toMatchObject({ valor: 400000, novo: true });
    const fila = await outra.fila();
    expect(fila[0]).toMatchObject({ clienteId: "cli-001", novo: true });
    expect((await outra.convites("cli-001"))[0].status).toBe("CONFIRMADO");
    // depois de conectado, novo convite para a mesma instituição é 409
    await expect(outra.criarConvite("cli-001", "inst-horizonte")).rejects.toMatchObject({ status: 409 });
  });

  it("confirmar de novo (já confirmado) é sucesso; token inexistente é 404", async () => {
    const api = await novaInstancia();
    const c = await api.criarConvite("cli-001", "inst-horizonte");
    await api.confirmarConvite(c.token);
    expect((await api.confirmarConvite(c.token)).status).toBe("CONFIRMADO");
    await expect(api.confirmarConvite("cv-nao-existe")).rejects.toMatchObject({ status: 404 });
  });

  it("convite com mais de 48h fica EXPIRADO e confirmar é 410", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T10:00:00-03:00"));
    const api = await novaInstancia();
    const c = await api.criarConvite("cli-001", "inst-horizonte");
    vi.setSystemTime(new Date("2026-10-13T10:00:01-03:00"));
    expect((await api.convite(c.token)).status).toBe("EXPIRADO");
    await expect(api.confirmarConvite(c.token)).rejects.toMatchObject({ status: 410 });
    expect((await api.visao360("cli-001")).cobertura.instituicoesConectadas).toBe(2);
    // um convite novo substitui o expirado (outro token)
    const novo = await api.criarConvite("cli-001", "inst-horizonte");
    expect(novo.status).toBe("PENDENTE");
    expect(novo.token).not.toBe(c.token);
  });

  it("resetDemo apaga os convites e volta a Marina para 'antes'", async () => {
    const api = await novaInstancia();
    const c = await api.criarConvite("cli-001", "inst-horizonte");
    await api.confirmarConvite(c.token);
    await api.resetDemo();
    const b = await novaInstancia();
    expect(await b.convites("cli-001")).toEqual([]);
    await expect(b.convite(c.token)).rejects.toMatchObject({ status: 404 });
    expect((await b.visao360("cli-001")).cobertura.instituicoesConectadas).toBe(2);
  });

  it("a ação CONVIDAR_CONEXAO da Marina tem o id do backend e a mensagem traz o link (cria o convite)", async () => {
    const api = await novaInstancia();
    const v = await api.visao360("cli-001");
    expect(v.acoes.find((a) => a.tipo === "CONVIDAR_CONEXAO")?.id).toBe(ACAO_CONVIDAR);
    const m = await api.mensagem("cli-001", ACAO_CONVIDAR, "WHATSAPP");
    const [c] = await api.convites("cli-001");
    expect(c.status).toBe("PENDENTE");
    expect(m.texto).toBe(
      `Oi, Marina! Para eu enxergar seu patrimônio completo e checar sua proteção no FGC, você pode conectar o Banco Horizonte por aqui: ${c.link}. Leva 1 minuto e você pode revogar quando quiser.`,
    );
    // gerar de novo reaproveita o mesmo convite
    await api.mensagem("cli-001", ACAO_CONVIDAR, "EMAIL");
    expect(await api.convites("cli-001")).toHaveLength(1);
  });
});
