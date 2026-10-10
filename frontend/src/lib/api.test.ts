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
    await criarHttpApi(f).visao360("cli 1/x");
    expect(f).toHaveBeenCalledWith("/api/clientes/cli%201%2Fx/360", expect.anything());
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

describe("httpApi · convites de consentimento", () => {
  const convite = {
    token: "cv-cli-001-inst-horizonte",
    clienteId: "cli-001",
    instituicaoId: "inst-horizonte",
    instituicaoNome: "Banco Horizonte",
    escopos: ["INVESTIMENTOS"],
    prazoMeses: 12,
    link: "http://localhost:3000/convite/cv-cli-001-inst-horizonte",
    status: "PENDENTE",
    criadoEm: "2026-10-11T10:00:00-03:00",
    expiraEm: "2026-10-13T10:00:00-03:00",
  };

  it("criarConvite faz POST em /api/clientes/{id}/convites/{instituicaoId}", async () => {
    const f = vi.fn(async () => resposta(200, convite));
    const c = await criarHttpApi(f).criarConvite("cli-001", "inst-horizonte");
    expect(c.token).toBe("cv-cli-001-inst-horizonte");
    expect(f).toHaveBeenCalledWith("/api/clientes/cli-001/convites/inst-horizonte", expect.objectContaining({ method: "POST" }));
  });

  it("criarConvite com 409 (instituição já conectada) vira ApiError 409", async () => {
    const f = vi.fn(async () => resposta(409, { erro: "CONFLITO", mensagem: "Banco Horizonte já está conectado" }));
    await expect(criarHttpApi(f).criarConvite("cli-001", "inst-horizonte")).rejects.toMatchObject({ status: 409, erro: "CONFLITO" });
  });

  it("convites faz GET em /api/clientes/{id}/convites", async () => {
    const f = vi.fn(async () => resposta(200, [convite]));
    const lista = await criarHttpApi(f).convites("cli-001");
    expect(lista).toHaveLength(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/clientes/cli-001/convites");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("convite faz GET em /api/convites/{token} (token codificado) e 404 vira ApiError", async () => {
    const ok = vi.fn(async () => resposta(200, convite));
    await criarHttpApi(ok).convite("cv 1/x");
    expect(ok).toHaveBeenCalledWith("/api/convites/cv%201%2Fx", expect.anything());
    const nf = vi.fn(async () => resposta(404, { erro: "NAO_ENCONTRADO", mensagem: "Convite não encontrado" }));
    await expect(criarHttpApi(nf).convite("cv-x")).rejects.toMatchObject({ status: 404 });
  });

  it("confirmarConvite faz POST em /api/convites/{token}/confirmar", async () => {
    const f = vi.fn(async () => resposta(200, { ...convite, status: "CONFIRMADO" }));
    const c = await criarHttpApi(f).confirmarConvite(convite.token);
    expect(c.status).toBe("CONFIRMADO");
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith("/api/convites/cv-cli-001-inst-horizonte/confirmar", expect.objectContaining({ method: "POST" }));
  });

  it("confirmarConvite com 409 (já confirmado) é sucesso: busca o convite atual", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? resposta(409, { erro: "CONFLITO", mensagem: "Convite já confirmado" })
        : resposta(200, { ...convite, status: "CONFIRMADO" }),
    );
    const c = await criarHttpApi(f).confirmarConvite(convite.token);
    expect(c.status).toBe("CONFIRMADO");
    expect(f).toHaveBeenNthCalledWith(2, "/api/convites/cv-cli-001-inst-horizonte", expect.anything());
  });

  it("confirmarConvite com 410 (expirado) e 404 viram ApiError", async () => {
    const exp = vi.fn(async () => resposta(410, { erro: "EXPIRADO", mensagem: "Convite expirado" }));
    await expect(criarHttpApi(exp).confirmarConvite("cv-x")).rejects.toMatchObject({ status: 410, message: "Convite expirado" });
    const nf = vi.fn(async () => resposta(404, { erro: "NAO_ENCONTRADO", mensagem: "Convite não encontrado" }));
    await expect(criarHttpApi(nf).confirmarConvite("cv-x")).rejects.toMatchObject({ status: 404 });
  });
});

describe("httpApi — notas do assessor (editar cliente)", () => {
  it("registrarNota envia { transcricao, origem } e contextoAssessor lê as notas", async () => {
    const f = vi.fn(async (url: string) =>
      url.endsWith("/notas")
        ? resposta(200, { resumo: "r", recomendacoes: [{ necessidade: "PROTECAO_VEICULO", produto: "Seguro auto" }] })
        : resposta(200, { clienteId: "cli-003", anotacoes: [], recomendacoes: [] }),
    );
    const api = criarHttpApi(f);

    const r = await api.registrarNota("cli-003", "Bateu o carro.", "AUDIO");
    const c = await api.contextoAssessor("cli-003");

    expect(r.recomendacoes[0].produto).toBe("Seguro auto");
    expect(c.clienteId).toBe("cli-003");
    expect(f).toHaveBeenNthCalledWith(1, "/api/clientes/cli-003/notas",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ transcricao: "Bateu o carro.", origem: "AUDIO" }) }));
    expect(f).toHaveBeenNthCalledWith(2, "/api/clientes/cli-003/contexto", expect.anything());
  });
});

describe("httpApi · edição do cadastro por voz", () => {
  it("transcreverAudio manda multipart com o campo audio e deixa o navegador pôr o Content-Type", async () => {
    const f = vi.fn(async () => resposta(200, { texto: "Ela se mudou para Campinas.", modelo: "whisper-1" }));
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });

    const t = await criarHttpApi(f).transcreverAudio("cli-004", audio, "audio.webm");

    expect(t.texto).toBe("Ela se mudou para Campinas.");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/clientes/cli-004/edicao/transcricao");
    expect(init.method).toBe("POST");
    expect(init.headers).not.toHaveProperty("Content-Type");
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get("audio") as File).name).toBe("audio.webm");
  });

  it("transcreverAudio com 503 (sem Whisper no servidor) vira ApiError com a mensagem do backend", async () => {
    const f = vi.fn(async () => resposta(503, { erro: "INDISPONIVEL", mensagem: "Transcrição por voz não configurada" }));
    await expect(criarHttpApi(f).transcreverAudio("cli-004", new Blob(["x"]), "audio.webm")).rejects.toMatchObject({
      status: 503,
      erro: "INDISPONIVEL",
      message: "Transcrição por voz não configurada",
    });
  });

  it("proporEdicao faz POST com { transcricao } e editarCliente faz PATCH em /api/clientes/{id}", async () => {
    const f = vi.fn(async () => resposta(200, {}));
    const api = criarHttpApi(f);

    await api.proporEdicao("cli-004", "fez 69 anos");
    await api.editarCliente("cli-004", { idade: 69, cidade: "Campinas/SP" });

    const [url1, init1] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url1).toBe("/api/clientes/cli-004/edicao/proposta");
    expect(init1.method).toBe("POST");
    expect(JSON.parse(String(init1.body))).toEqual({ transcricao: "fez 69 anos" });
    const [url2, init2] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(url2).toBe("/api/clientes/cli-004");
    expect(init2.method).toBe("PATCH");
    expect(init2.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init2.body))).toEqual({ idade: 69, cidade: "Campinas/SP" });
  });
});
