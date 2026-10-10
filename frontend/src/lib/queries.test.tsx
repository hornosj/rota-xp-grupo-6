import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  fila: vi.fn(async () => [{ posicao: 1, clienteId: "cli-001" }]),
  visao360: vi.fn(async (id: string) => ({ cliente: { id } })),
  jornada: vi.fn(async (id: string) => ({ clienteId: id })),
  painel: vi.fn(async () => ({ totalClientes: 1 })),
  consentimentos: vi.fn(async () => []),
  conceder: vi.fn(async (id: string) => ({ cliente: { id }, cobertura: { percentual: 1 } })),
  revogar: vi.fn(async (id: string) => ({ cliente: { id }, cobertura: { percentual: 0.5 } })),
  mensagem: vi.fn(async () => ({ texto: "Oi", canal: "WHATSAPP", geradoPor: "stub" })),
  briefing: vi.fn(async (id: string) => ({ clienteId: id, bullets: [], perguntasSugeridas: [], geradoPor: "stub" })),
  demoEstado: vi.fn(async () => ({ dataReferencia: "2026-10-11", modoCopiloto: "stub" })),
  resetDemo: vi.fn(async () => undefined),
}));
vi.mock("./api", () => ({ api: fake }));

import { chaves, useBriefing, useConceder, useFila, useJornada, useMensagem, useResetDemo, useRevogar, useVisao360 } from "./queries";

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

describe("queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useFila busca a fila; ao vivo usa refetchInterval de 2s", async () => {
    const { qc, wrapper } = montar();
    const { result } = renderHook(() => useFila({ aoVivo: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].clienteId).toBe("cli-001");
    const q = qc.getQueryCache().find({ queryKey: chaves.fila });
    expect((q?.options as { refetchInterval?: unknown }).refetchInterval).toBe(2000);
  });

  it("fora do modo ao vivo não faz polling", async () => {
    const { qc, wrapper } = montar();
    renderHook(() => useVisao360("cli-001"), { wrapper });
    await waitFor(() => expect(fake.visao360).toHaveBeenCalledWith("cli-001"));
    const q = qc.getQueryCache().find({ queryKey: chaves.visao360("cli-001") });
    expect((q?.options as { refetchInterval?: unknown }).refetchInterval).toBeFalsy();
  });

  it("useConceder invalida fila, 360, jornada, painel e consentimentos e grava a 360 nova", async () => {
    const { qc, wrapper } = montar();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useConceder(), { wrapper });
    await act(() => result.current.mutateAsync({ clienteId: "cli-001", instituicaoId: "inst-horizonte" }));
    expect(fake.conceder).toHaveBeenCalledWith("cli-001", "inst-horizonte");
    const chavesInvalidadas = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    for (const k of [chaves.fila, chaves.visao360("cli-001"), chaves.jornada("cli-001"), chaves.painel, chaves.consentimentos("cli-001")]) {
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

  it("useJornada e useBriefing (briefing só quando habilitado)", async () => {
    const { wrapper } = montar();
    const j = renderHook(() => useJornada("cli-003"), { wrapper });
    await waitFor(() => expect(j.result.current.data?.clienteId).toBe("cli-003"));
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
});
