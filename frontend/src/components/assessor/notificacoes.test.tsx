import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { carregarNotificacoes } from "@/lib/notificacoes";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { SinoNotificacoes } from "./sino-notificacoes";
import { TelaNotificacoes } from "./tela-notificacoes";

describe("carregarNotificacoes", () => {
  it("junta alertas da carteira com aniversários de dependentes, sem duplicar eventos de vida", async () => {
    const r = await carregarNotificacoes(mockApi);
    expect(r.dataReferencia).toBe("2026-10-10");
    expect(r.notificacoes.some((n) => n.tipoAlerta === "EVENTO_VIDA_PROXIMO")).toBe(false);

    const sofia = r.notificacoes.filter((n) => n.titulo.includes("Sofia"));
    expect(sofia).toHaveLength(1);
    expect(sofia[0]).toMatchObject({
      clienteId: "cli-001",
      categoria: "DATA_ESPECIAL",
      emDias: 5,
      aniversario: { de: "DEPENDENTE", nome: "Sofia", idade: 12 },
      titulo: "Aniversário de Sofia (filha, 12 anos) em 5 dias",
    });

    expect(r.notificacoes.some((n) => n.categoria === "OPORTUNIDADE" && n.clienteId === "cli-001")).toBe(true);
    expect(r.proximasDatas.every((d) => d.emDias >= 0 && d.emDias <= 30)).toBe(true);
  });

  it("aniversário do cliente hoje vem primeiro", async () => {
    const r = await carregarNotificacoes(mockApi);
    const primeira = r.notificacoes[0]!;
    expect(primeira).toMatchObject({
      clienteId: "cli-002",
      emDias: 0,
      aniversario: { de: "CLIENTE", idade: 61 },
      titulo: "Aniversário de Carlos (61 anos) hoje",
    });
  });
});

describe("TelaNotificacoes", () => {
  it("lista, filtra por categoria e marca como lida", async () => {
    const user = userEvent.setup();
    renderComQuery(<TelaNotificacoes />);
    const itens = await screen.findAllByTestId("notificacao");
    expect(itens.length).toBeGreaterThan(1);
    expect(screen.getByTestId("proximas-datas")).toHaveTextContent("Aniversário de Sofia");

    await user.click(screen.getByRole("button", { name: /Datas especiais/ }));
    const datas = screen.getAllByTestId("notificacao");
    expect(datas.every((d) => d.dataset.categoria === "DATA_ESPECIAL")).toBe(true);
    const sofia = datas.find((d) => d.textContent?.includes("Sofia"))!;
    expect(sofia).toHaveAttribute("data-lida", "false");

    await user.click(within(sofia).getByRole("button", { name: "Marcar como lida" }));
    const lida = screen.getAllByTestId("notificacao").find((d) => d.textContent?.includes("Sofia"))!;
    expect(lida).toHaveAttribute("data-lida", "true");
    expect(screen.getByRole("heading", { name: /Lidas/ })).toBeInTheDocument();

    await user.click(within(lida).getByRole("button", { name: "Marcar como não lida" }));
    expect(screen.getAllByTestId("notificacao").find((d) => d.textContent?.includes("Sofia"))).toHaveAttribute(
      "data-lida",
      "false",
    );
  });

  it("aniversário do cliente aparece em destaque e sem botão de parabéns", async () => {
    renderComQuery(<TelaNotificacoes />);
    const itens = await screen.findAllByTestId("notificacao");
    expect(itens[0]).toHaveTextContent("Aniversário de Carlos (61 anos) hoje");
    expect(screen.queryByText(/enviar os parabéns/)).not.toBeInTheDocument();
  });

  it("marcar todas como lidas zera o contador do sino", async () => {
    const user = userEvent.setup();
    renderComQuery(
      <>
        <SinoNotificacoes />
        <TelaNotificacoes />
      </>,
    );
    await screen.findAllByTestId("notificacao");
    await waitFor(() => expect(screen.getByTestId("contador-notificacoes")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Marcar todas como lidas/ }));
    expect(screen.queryByTestId("contador-notificacoes")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tudo em dia.");

    await user.click(screen.getByRole("button", { name: /Não lidas/ }));
    expect(screen.getByText("Nenhuma notificação não lida.")).toBeInTheDocument();
  });
});
