import { beforeEach, describe, expect, it, vi } from "vitest";
import carteiraAntes from "./fixtures-radar/carteira-antes.json";
import marinaAntes from "./fixtures-radar/cliente-cli-001-antes.json";
import marinaDepois from "./fixtures-radar/cliente-cli-001-depois.json";
import roberto from "./fixtures-radar/cliente-cli-005.json";
import noticias from "./fixtures-radar/noticias.json";

async function novaInstancia() {
  // Simula outro iframe: módulo recarregado, mesmo localStorage.
  vi.resetModules();
  return (await import("./index")).mockApi;
}

const HORIZONTE = ["not-002", "not-020"];

describe("mockApi · radar de notícias (fixtures reais do backend)", () => {
  beforeEach(() => window.localStorage.clear());

  it("noticiasRadar devolve as 20 notícias curadas, mais recentes primeiro", async () => {
    const api = await novaInstancia();
    const n = await api.noticiasRadar();
    expect(n).toEqual(noticias);
    expect(n).toHaveLength(20);
    const datas = n.map((x) => x.noticia.publicadaEm ?? "");
    expect([...datas].sort().reverse()).toEqual(datas);
  });

  it("Marina antes do consentimento: sem notícias do Banco Horizonte", async () => {
    const api = await novaInstancia();
    const r = await api.radarCliente("cli-001");
    expect(r).toEqual(marinaAntes);
    expect(r.some((i) => HORIZONTE.includes(i.noticiaId))).toBe(false);
    await expect(api.motivoNoticia("cli-001", "not-002")).rejects.toMatchObject({ status: 404 });
  });

  it("Marina depois de conceder o Horizonte: rebaixamento (not-002) no topo, também em outro iframe", async () => {
    const cliente = await novaInstancia();
    await cliente.conceder("cli-001", "inst-horizonte");
    const assessor = await novaInstancia();
    const r = await assessor.radarCliente("cli-001");
    expect(r).toEqual(marinaDepois);
    expect(r[0].noticiaId).toBe("not-002");
    expect(r[0].direcao).toBe("NEGATIVA");
    expect(r.map((i) => i.noticiaId)).toEqual(expect.arrayContaining(HORIZONTE));
    const m = await assessor.motivoNoticia("cli-001", "not-002");
    expect(m.texto).toContain("Banco Horizonte");
    expect(m.geradoPor).toBe("stub");
  });

  it("revogar volta a Marina para o radar de antes", async () => {
    const api = await novaInstancia();
    await api.conceder("cli-001", "inst-horizonte");
    await api.revogar("cli-001", "inst-horizonte");
    expect(await api.radarCliente("cli-001")).toEqual(marinaAntes);
  });

  it("carteira: ordenada por pontos, Roberto/Agro Sul em 1º; Marina entra só depois do consentimento", async () => {
    const api = await novaInstancia();
    const antes = await api.radarCarteira();
    expect(antes[0]).toMatchObject({ clienteId: "cli-005", noticiaId: "not-001", pontos: 90 });
    const pontos = antes.map((i) => i.pontos);
    expect([...pontos].sort((a, b) => b - a)).toEqual(pontos);
    expect(antes.some((i) => i.clienteId === "cli-001" && HORIZONTE.includes(i.noticiaId))).toBe(false);
    expect(antes.length).toBeLessThanOrEqual(20);
    await api.conceder("cli-001", "inst-horizonte");
    const depois = await api.radarCarteira();
    expect(depois.find((i) => i.clienteId === "cli-001" && i.noticiaId === "not-002")?.pontos).toBe(80);
    expect(await api.radarCarteira(3)).toHaveLength(3);
  });

  it("carteira só aponta para clientes que existem no modo mock (links da 360 funcionam)", async () => {
    const api = await novaInstancia();
    const ids = new Set((await api.listarClientes()).map((c) => c.id));
    for (const i of await api.radarCarteira(50)) expect(ids.has(i.clienteId), i.clienteId).toBe(true);
    // a fixture real tem clientes de fundo que o mock não conhece
    expect(carteiraAntes.some((i) => !ids.has(i.clienteId))).toBe(true);
  });

  it("Roberto: impacto real do CRA da Agro Sul e motivo da fixture", async () => {
    const api = await novaInstancia();
    const r = await api.radarCliente("cli-005");
    expect(r).toEqual(roberto);
    expect(r[0].motivo).toBe("R$ 900 mil em CRA da Agro Sul Sementes S.A. (44,4% do patrimônio visível)");
    const m = await api.motivoNoticia("cli-005", "not-001");
    expect(m.texto).toMatch(/^Roberto tem R\$ 900 mil em CRA da Agro Sul/);
  });

  it("motivo sem fixture é redigido no formato do stub do backend (direção muda a sugestão)", async () => {
    const api = await novaInstancia();
    const pos = await api.motivoNoticia("cli-001", "not-005");
    expect(pos.texto).toBe(
      'Marina tem R$ 230 mil em CDB do Banco Ipê (23,4% do patrimônio visível). Notícia: "Banco Ipê conclui aumento de capital" (Curadoria (fictícia)). A notícia é favorável a essa parte da carteira. Sugestão: aproveitar para um contato de relacionamento e revisar os objetivos.',
    );
    const neutra = await api.motivoNoticia("cli-005", "not-003");
    expect(neutra.texto).toContain("A notícia pode mudar o cenário dessa parte da carteira.");
  });

  it("cliente sem radar no mock devolve lista vazia; cliente inexistente é 404", async () => {
    const api = await novaInstancia();
    expect(await api.radarCliente("cli-101")).toEqual([]);
    await expect(api.radarCliente("cli-999")).rejects.toMatchObject({ status: 404 });
  });

  it("fixtures reais têm todos os campos obrigatórios dos tipos à mão (backend omite nulos)", () => {
    const obrigatoriosImpacto = ["clienteId", "clienteNome", "noticiaId", "titulo", "fonte", "direcao", "pontos", "valorExposto", "fracaoPatrimonio", "motivo", "gatilhos"];
    for (const i of [...marinaAntes, ...marinaDepois, ...roberto, ...carteiraAntes]) {
      for (const k of obrigatoriosImpacto) expect(i, k).toHaveProperty(k);
      expect(i.pontos).toBeGreaterThanOrEqual(0);
      expect(i.pontos).toBeLessThanOrEqual(100);
      expect(i.fracaoPatrimonio).toBeLessThanOrEqual(1);
    }
    for (const n of noticias) {
      for (const k of ["id", "fonte", "titulo"]) expect(n.noticia, k).toHaveProperty(k);
      for (const k of ["emissores", "indexadores", "produtos", "direcao", "relevancia", "origem"]) expect(n.classificacao, k).toHaveProperty(k);
      for (const ix of n.classificacao.indexadores) expect(["CDI", "IPCA", "PRE", "SELIC"]).toContain(ix);
    }
  });

  it("processarRadar devolve o resumo do processamento com data atual", async () => {
    const api = await novaInstancia();
    const r = await api.processarRadar();
    expect(r).toMatchObject({ coletadas: 20, novas: 0, lotes: 0 });
    expect(Number.isNaN(new Date(r.processadoEm).getTime())).toBe(false);
  });
});
