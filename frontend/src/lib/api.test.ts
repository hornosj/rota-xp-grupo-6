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
