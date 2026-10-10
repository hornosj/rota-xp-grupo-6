import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  fila: vi.fn(async () => [{ posicao: 1, clienteId: "cli-001" }]),
  visao360: vi.fn(async (id: string) => ({ cliente: { id } })),
  painel: vi.fn(async () => ({ totalClientes: 1 })),
  consentimentos: vi.fn(async () => []),
  conceder: vi.fn(async (id: string) => ({ cliente: { id }, cobertura: { percentual: 1 } })),
  revogar: vi.fn(async (id: string) => ({ cliente: { id }, cobertura: { percentual: 0.5 } })),
  mensagem: vi.fn(async () => ({ texto: "Oi", canal: "WHATSAPP", geradoPor: "stub" })),
  briefing: vi.fn(async (id: string) => ({ clienteId: id, bullets: [], perguntasSugeridas: [], geradoPor: "stub" })),
  demoEstado: vi.fn(async () => ({ dataReferencia: "2026-10-11", modoCopiloto: "stub" })),
  resetDemo: vi.fn(async () => undefined),
  noticiasRadar: vi.fn(async () => [{ noticia: { id: "not-001" } }]),
  processarRadar: vi.fn(async () => ({ coletadas: 20, novas: 2, lotes: 1 })),
  radarCliente: vi.fn(async (id: string) => [{ clienteId: id, noticiaId: "not-001" }]),
  radarCarteira: vi.fn(async () => [{ clienteId: "cli-005", noticiaId: "not-001" }]),
  motivoNoticia: vi.fn(async () => ({ texto: "Ligue hoje", geradoPor: "stub" })),
  criarConvite: vi.fn(async (id: string, inst: string) => ({ token: `cv-${id}-${inst}`, clienteId: id, instituicaoId: inst, status: "PENDENTE" })),
  convites: vi.fn(async (id: string) => [{ token: `cv-${id}-inst-horizonte`, clienteId: id, status: "PENDENTE" }]),
  convite: vi.fn(async (token: string) => ({ token, clienteId: "cli-001", status: "PENDENTE" })),
  confirmarConvite: vi.fn(async (token: string) => ({ token, clienteId: "cli-001", instituicaoId: "inst-horizonte", status: "CONFIRMADO" })),
}));
vi.mock("./api", () => ({ api: fake }));

import {
  chaves,
  useBriefing,
  useConceder,
  useConfirmarConvite,
  useConvite,
  useConvites,
  useCriarConvite,
  useFila,
  useMensagem,
  useMotivoNoticia,
  useNoticiasRadar,
  useProcessarRadar,
  useRadarCarteira,
  useRadarCliente,
  useResetDemo,
  useRevogar,
  useVisao360,
} from "./queries";

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

describe("queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useFila busca a fila; ao vivo usa o polling de fallback (15 s)", async () => {
    const { qc, wrapper } = montar();
    const { result } = renderHook(() => useFila({ aoVivo: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].clienteId).toBe("cli-001");
    const q = qc.getQueryCache().find({ queryKey: chaves.fila });
    expect((q?.options as { refetchInterval?: unknown }).refetchInterval).toBe(15000);
  });

  it("fora do modo ao vivo não faz polling", async () => {
    const { qc, wrapper } = montar();
    renderHook(() => useVisao360("cli-001"), { wrapper });
    await waitFor(() => expect(fake.visao360).toHaveBeenCalledWith("cli-001"));
    const q = qc.getQueryCache().find({ queryKey: chaves.visao360("cli-001") });
    expect((q?.options as { refetchInterval?: unknown }).refetchInterval).toBeFalsy();
  });

  it("useConceder invalida fila, 360, painel e consentimentos e grava a 360 nova", async () => {
    const { qc, wrapper } = montar();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useConceder(), { wrapper });
    await act(() => result.current.mutateAsync({ clienteId: "cli-001", instituicaoId: "inst-horizonte" }));
    expect(fake.conceder).toHaveBeenCalledWith("cli-001", "inst-horizonte");
    const chavesInvalidadas = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    for (const k of [chaves.fila, chaves.visao360("cli-001"), chaves.painel, chaves.consentimentos("cli-001")]) {
      expect(chavesInvalidadas).toContain(JSON.stringify(k));
    }
    expect(qc.getQueryData(chaves.visao360("cli-001"))).toMatchObject({ cobertura: { percentual: 1 } });
  });

  it("useRevogar também invalida", async () => {
    const { qc, wrapper } = montar();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useRevogar(), { wrapper });
    await act(() => result.current.mutateAsync({ clienteId: "cli-001", instituicaoId: "inst-aurora" }));
    expect(fake.revogar).toHaveBeenCalledWith("cli-001", "inst-aurora");
    expect(spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))).toContain(JSON.stringify(chaves.fila));
  });

  it("useMensagem chama a API com canal", async () => {
    const { wrapper } = montar();
    const { result } = renderHook(() => useMensagem(), { wrapper });
    const m = await act(() => result.current.mutateAsync({ clienteId: "cli-001", acaoId: "ac-1", canal: "WHATSAPP" }));
    expect(m.texto).toBe("Oi");
    expect(fake.mensagem).toHaveBeenCalledWith("cli-001", "ac-1", "WHATSAPP");
  });

  it("useBriefing só busca quando habilitado", async () => {
    const { wrapper } = montar();
    const b = renderHook(({ on }) => useBriefing("cli-001", { enabled: on }), { wrapper, initialProps: { on: false } });
    expect(fake.briefing).not.toHaveBeenCalled();
    b.rerender({ on: true });
    await waitFor(() => expect(fake.briefing).toHaveBeenCalledWith("cli-001"));
  });

  it("useResetDemo chama reset e limpa o cache", async () => {
    const { qc, wrapper } = montar();
    qc.setQueryData(chaves.fila, [{ x: 1 }]);
    const { result } = renderHook(() => useResetDemo(), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(fake.resetDemo).toHaveBeenCalled();
    expect(qc.getQueryState(chaves.fila)?.isInvalidated ?? true).toBe(true);
  });

  it("useConceder e useRevogar também invalidam o radar do cliente e o da carteira", async () => {
    for (const hook of [useConceder, useRevogar]) {
      const { qc, wrapper } = montar();
      const spy = vi.spyOn(qc, "invalidateQueries");
      const { result } = renderHook(() => hook(), { wrapper });
      await act(() => result.current.mutateAsync({ clienteId: "cli-001", instituicaoId: "inst-horizonte" }));
      const invalidadas = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(invalidadas).toContain(JSON.stringify(chaves.radarCliente("cli-001")));
      expect(invalidadas).toContain(JSON.stringify(chaves.radarCarteira));
    }
  });

  it("useRadarCliente, useRadarCarteira e useNoticiasRadar buscam da API", async () => {
    const { qc, wrapper } = montar();
    const c = renderHook(() => useRadarCliente("cli-005"), { wrapper });
    await waitFor(() => expect(c.result.current.data?.[0].clienteId).toBe("cli-005"));
    expect(fake.radarCliente).toHaveBeenCalledWith("cli-005");
    const k = renderHook(() => useRadarCarteira(), { wrapper });
    await waitFor(() => expect(k.result.current.isSuccess).toBe(true));
    expect(fake.radarCarteira).toHaveBeenCalledWith(20);
    const n = renderHook(() => useNoticiasRadar(), { wrapper });
    await waitFor(() => expect(n.result.current.data?.[0].noticia.id).toBe("not-001"));
    // as chaves do radar começam por "radar" (invalidação em bloco)
    for (const q of qc.getQueryCache().getAll()) expect(q.queryKey[0]).toBe("radar");
  });

  it("useProcessarRadar processa e invalida todas as consultas do radar", async () => {
    const { qc, wrapper } = montar();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useProcessarRadar(), { wrapper });
    const r = await act(() => result.current.mutateAsync());
    expect(r.novas).toBe(2);
    expect(fake.processarRadar).toHaveBeenCalled();
    expect(spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))).toContain(JSON.stringify(chaves.radar));
  });

  it("useMotivoNoticia pede o motivo do cliente para a notícia", async () => {
    const { wrapper } = montar();
    const { result } = renderHook(() => useMotivoNoticia(), { wrapper });
    const m = await act(() => result.current.mutateAsync({ clienteId: "cli-005", noticiaId: "not-001" }));
    expect(m).toEqual({ texto: "Ligue hoje", geradoPor: "stub" });
    expect(fake.motivoNoticia).toHaveBeenCalledWith("cli-005", "not-001");
  });

  it("useConvites busca os convites do cliente e faz polling no modo ao vivo", async () => {
    const { qc, wrapper } = montar();
    const { result } = renderHook(() => useConvites("cli-001", { aoVivo: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fake.convites).toHaveBeenCalledWith("cli-001");
    const q = qc.getQueryCache().find({ queryKey: chaves.convites("cli-001") });
    expect((q?.options as { refetchInterval?: unknown }).refetchInterval).toBe(15000);
  });

  it("useConvite busca pelo token (sem retry: 404/410 aparecem logo)", async () => {
    const { wrapper } = montar();
    const { result } = renderHook(() => useConvite("cv-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fake.convite).toHaveBeenCalledWith("cv-1");
    expect(result.current.data?.status).toBe("PENDENTE");
  });

  it("useCriarConvite cria e invalida os convites e a 360 do cliente", async () => {
    const { qc, wrapper } = montar();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCriarConvite(), { wrapper });
    const c = await act(() => result.current.mutateAsync({ clienteId: "cli-001", instituicaoId: "inst-horizonte" }));
    expect(c.token).toBe("cv-cli-001-inst-horizonte");
    expect(fake.criarConvite).toHaveBeenCalledWith("cli-001", "inst-horizonte");
    const invalidadas = spy.mock.calls.map((x) => JSON.stringify(x[0]?.queryKey));
    expect(invalidadas).toContain(JSON.stringify(chaves.convites("cli-001")));
    expect(invalidadas).toContain(JSON.stringify(chaves.visao360("cli-001")));
  });

  it("useConfirmarConvite confirma e invalida fila, 360, radar, painel e convites", async () => {
    const { qc, wrapper } = montar();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useConfirmarConvite(), { wrapper });
    const c = await act(() => result.current.mutateAsync("cv-cli-001-inst-horizonte"));
    expect(c.status).toBe("CONFIRMADO");
    expect(fake.confirmarConvite).toHaveBeenCalledWith("cv-cli-001-inst-horizonte");
    const invalidadas = spy.mock.calls.map((x) => JSON.stringify(x[0]?.queryKey));
    for (const k of [
      chaves.fila,
      chaves.visao360("cli-001"),
      chaves.radarCliente("cli-001"),
      chaves.radarCarteira,
      chaves.painel,
      chaves.convites("cli-001"),
    ]) {
      expect(invalidadas).toContain(JSON.stringify(k));
    }
    expect(qc.getQueryData(chaves.convite("cv-cli-001-inst-horizonte"))).toMatchObject({ status: "CONFIRMADO" });
  });
});
