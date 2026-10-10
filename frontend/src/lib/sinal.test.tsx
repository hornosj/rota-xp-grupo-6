import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// BroadcastChannel falso: entrega para as outras instâncias com o mesmo nome (como entre iframes).
class CanalFalso {
  static todos: CanalFalso[] = [];
  static enviadas: unknown[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public name: string) {
    CanalFalso.todos.push(this);
  }
  postMessage(data: unknown) {
    CanalFalso.enviadas.push(data);
    for (const c of CanalFalso.todos) if (c !== this && c.name === this.name) c.onmessage?.({ data });
  }
  close() {
    CanalFalso.todos = CanalFalso.todos.filter((c) => c !== this);
  }
}

const fake = vi.hoisted(() => ({
  fila: vi.fn(async () => [{ posicao: 1, clienteId: "cli-001" }]),
  briefing: vi.fn(async (id: string) => ({ clienteId: id, bullets: ["a"], perguntasSugeridas: ["p"], geradoPor: "live" })),
  resetDemo: vi.fn(async () => undefined),
  criarConvite: vi.fn(async (id: string, inst: string) => ({ token: "cv-1", clienteId: id, instituicaoId: inst, status: "PENDENTE" })),
  confirmarConvite: vi.fn(async (token: string) => ({ token, clienteId: "cli-001", instituicaoId: "inst-horizonte", status: "CONFIRMADO" })),
}));
vi.mock("./api", () => ({ api: fake }));

import { useBriefing, useConfirmarConvite, useCriarConvite, useFila, useResetDemo } from "./queries";
import { avisarDadosAlterados, ehChaveDeIa, ouvirDadosAlterados, SincronizarDados } from "./sinal";

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

describe("sinal de dados alterados (atualizar pelo clique)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    CanalFalso.todos = [];
    CanalFalso.enviadas = [];
    vi.stubGlobal("BroadcastChannel", CanalFalso);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("avisar entrega para quem está ouvindo em outro contexto", () => {
    const recebido = vi.fn();
    const parar = ouvirDadosAlterados(recebido);

    new CanalFalso("copiloto-dados").postMessage({ tipo: "dados-alterados" });
    avisarDadosAlterados();

    expect(recebido).toHaveBeenCalledTimes(2);
    parar();
  });

  it("sem BroadcastChannel não quebra", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(() => avisarDadosAlterados()).not.toThrow();
    expect(() => ouvirDadosAlterados(() => {})()).not.toThrow();
  });

  it("identifica as consultas de IA (nunca refazem sozinhas)", () => {
    expect(ehChaveDeIa(["briefing", "cli-001"])).toBe(true);
    expect(ehChaveDeIa(["fila"])).toBe(false);
    expect(ehChaveDeIa(["360", "cli-001"])).toBe(false);
  });

  it("SincronizarDados atualiza os dados ao receber o aviso, sem refazer a IA", async () => {
    const { qc, wrapper } = montar();
    function Tela() {
      useFila();
      useBriefing("cli-001", { enabled: true });
      return null;
    }
    render(
      <>
        <SincronizarDados />
        <Tela />
      </>,
      { wrapper },
    );
    await waitFor(() => expect(fake.fila).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fake.briefing).toHaveBeenCalledTimes(1));

    act(() => new CanalFalso("copiloto-dados").postMessage({ tipo: "dados-alterados" }));

    await waitFor(() => expect(fake.fila).toHaveBeenCalledTimes(2));
    expect(fake.briefing).toHaveBeenCalledTimes(1);
    void qc;
  });

  it("confirmar convite avisa as outras telas e não refaz um briefing aberto", async () => {
    const { wrapper } = montar();
    const { result } = renderHook(
      () => ({ b: useBriefing("cli-001", { enabled: true }), confirmar: useConfirmarConvite() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.b.isSuccess).toBe(true));

    await act(() => result.current.confirmar.mutateAsync("cv-1"));

    expect(CanalFalso.enviadas).toContainEqual({ tipo: "dados-alterados" });
    expect(fake.briefing).toHaveBeenCalledTimes(1);
  });

  it("enviar convite e resetar também avisam; o reset não chama a IA", async () => {
    const { wrapper } = montar();
    const { result } = renderHook(
      () => ({ b: useBriefing("cli-001", { enabled: true }), criar: useCriarConvite(), reset: useResetDemo() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.b.isSuccess).toBe(true));

    await act(() => result.current.criar.mutateAsync({ clienteId: "cli-001", instituicaoId: "inst-horizonte" }));
    await act(() => result.current.reset.mutateAsync());

    expect(CanalFalso.enviadas.length).toBe(2);
    expect(fake.briefing).toHaveBeenCalledTimes(1);
  });
});
