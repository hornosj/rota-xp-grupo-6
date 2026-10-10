import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-base";
import { criarHttpApi } from "./api";

function resposta(status: number, corpo?: unknown) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
  });
}

describe("httpApi", () => {
  it("usa /api como base e devolve o JSON tipado", async () => {
    const f = vi.fn(async () => resposta(200, [{ posicao: 1 }]));
    const api = criarHttpApi(f);
    const fila = await api.fila();
    expect(fila).toEqual([{ posicao: 1 }]);
    expect(f).toHaveBeenCalledWith("/api/assessor/fila", expect.objectContaining({ cache: "no-store" }));
  });

  it("conceder com 409 (já ativo) é sucesso: busca a 360 atual", async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return resposta(409, { erro: "JA_ATIVO", mensagem: "já ativo" });
      return resposta(200, { cliente: { id: "cli-001" } });
    });
    const api = criarHttpApi(f);
    const v = await api.conceder("cli-001", "inst-horizonte");
    expect(v.cliente.id).toBe("cli-001");
    expect(f).toHaveBeenNthCalledWith(1, "/api/clientes/cli-001/consentimentos/inst-horizonte/conceder", expect.objectContaining({ method: "POST" }));
    expect(f).toHaveBeenNthCalledWith(2, "/api/clientes/cli-001/360", expect.anything());
  });

  it("conceder com 200 devolve a 360 recalculada sem segunda chamada", async () => {
    const f = vi.fn(async () => resposta(200, { cliente: { id: "cli-001" }, cobertura: { percentual: 1 } }));
    const v = await criarHttpApi(f).conceder("cli-001", "inst-horizonte");
    expect(v.cobertura.percentual).toBe(1);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("erros viram ApiError com status e mensagem do backend", async () => {
    const f = vi.fn(async () => resposta(404, { erro: "CLIENTE_NAO_ENCONTRADO", mensagem: "Cliente cli-999 não encontrado" }));
    const p = criarHttpApi(f).visao360("cli-999");
    await expect(p).rejects.toBeInstanceOf(ApiError);
    await expect(criarHttpApi(f).visao360("cli-999")).rejects.toMatchObject({ status: 404, message: "Cliente cli-999 não encontrado" });
  });

  it("mensagem envia { canal } e reset aceita 204", async () => {
    const f = vi.fn(async (url: string) =>
      url.endsWith("/reset") ? resposta(204) : resposta(200, { texto: "Oi", canal: "WHATSAPP", geradoPor: "cache" }),
    );
    const api = criarHttpApi(f);
    const m = await api.mensagem("cli-001", "ac-1", "WHATSAPP");
    expect(m.geradoPor).toBe("cache");
    const chamada = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(chamada[0]).toBe("/api/clientes/cli-001/acoes/ac-1/mensagem");
    expect(JSON.parse(String(chamada[1].body))).toEqual({ canal: "WHATSAPP" });
    await expect(api.resetDemo()).resolves.toBeUndefined();
  });

  it("codifica ids na URL", async () => {
    const f = vi.fn(async () => resposta(200, {}));
    await criarHttpApi(f).jornada("cli 1/x");
    expect(f).toHaveBeenCalledWith("/api/clientes/cli%201%2Fx/jornada", expect.anything());
  });
});

describe("httpApi · radar de notícias", () => {
  it("noticiasRadar faz GET em /api/radar/noticias", async () => {
    const f = vi.fn(async () => resposta(200, []));
    await criarHttpApi(f).noticiasRadar();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/radar/noticias");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("processarRadar faz POST em /api/radar/processar e devolve o resultado", async () => {
    const f = vi.fn(async () => resposta(200, { coletadas: 20, novas: 3, lotes: 1 }));
    const r = await criarHttpApi(f).processarRadar();
    expect(r.novas).toBe(3);
    expect(f).toHaveBeenCalledWith("/api/radar/processar", expect.objectContaining({ method: "POST" }));
  });

  it("radarCliente faz GET em /api/clientes/{id}/radar (id codificado)", async () => {
    const f = vi.fn(async () => resposta(200, [{ noticiaId: "not-001" }]));
    const r = await criarHttpApi(f).radarCliente("cli 5");
    expect(r[0].noticiaId).toBe("not-001");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/clientes/cli%205/radar");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("radarCarteira usa limite 20 por padrão e aceita outro limite", async () => {
    const f = vi.fn(async () => resposta(200, []));
    const api = criarHttpApi(f);
    await api.radarCarteira();
    await api.radarCarteira(5);
    expect(f).toHaveBeenNthCalledWith(1, "/api/assessor/radar?limite=20", expect.anything());
    expect(f).toHaveBeenNthCalledWith(2, "/api/assessor/radar?limite=5", expect.anything());
  });

  it("motivoNoticia faz POST e devolve { texto, geradoPor }", async () => {
    const f = vi.fn(async () => resposta(200, { texto: "Roberto tem R$ 900 mil", geradoPor: "stub" }));
    const m = await criarHttpApi(f).motivoNoticia("cli-005", "not-001");
    expect(m).toEqual({ texto: "Roberto tem R$ 900 mil", geradoPor: "stub" });
    expect(f).toHaveBeenCalledWith("/api/clientes/cli-005/radar/not-001/motivo", expect.objectContaining({ method: "POST" }));
  });

  it("motivoNoticia com 404 (notícia não mexe na carteira) vira ApiError 404", async () => {
    const f = vi.fn(async () =>
      resposta(404, { erro: "NAO_ENCONTRADO", mensagem: "A notícia not-001 não mexe na carteira de cli-001" }),
    );
    await expect(criarHttpApi(f).motivoNoticia("cli-001", "not-001")).rejects.toMatchObject({
      status: 404,
      erro: "NAO_ENCONTRADO",
      message: "A notícia not-001 não mexe na carteira de cli-001",
    });
  });
});
