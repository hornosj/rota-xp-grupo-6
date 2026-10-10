import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { Lancador } from "./lancador";

describe("Lancador", () => {
  it("tem links para o assessor, o radar e a visão 360 de cada cliente-âncora, sem palco nem app da cliente", () => {
    renderComQuery(<Lancador />);
    expect(screen.queryByRole("link", { name: /Palco/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cadastrar investidores/ })).toHaveAttribute("href", "/assessor/convites");
    expect(screen.getByRole("link", { name: /Radar de notícias/ })).toHaveAttribute("href", "/assessor/radar");
    expect(screen.getByRole("link", { name: /Abrir a fila de hoje/ })).toHaveAttribute("href", "/assessor/hoje");
    expect(screen.getByRole("link", { name: /Ver meus clientes/ })).toHaveAttribute("href", "/assessor");
    for (const id of ["cli-001", "cli-002", "cli-003", "cli-004", "cli-005", "cli-006"]) {
      expect(document.querySelector(`a[href="/assessor/clientes/${id}"]`)).not.toBeNull();
    }
    expect(document.querySelector('a[href^="/cliente"]')).toBeNull();
  });

  it("mostra quem ligar primeiro e os números da carteira", async () => {
    renderComQuery(<Lancador />);
    expect(await screen.findByRole("link", { name: /^1º\s*Patrícia Gomes/ })).toHaveAttribute("href", "/assessor/clientes/cli-004");
    await waitFor(() => expect(screen.getByLabelText("Números da carteira")).not.toHaveTextContent("—"));
    expect(screen.getByLabelText("Números da carteira")).toHaveTextContent("têm a XP como instituição principal");
  });

  it("tem o botão de notificações com alertas e aniversários", async () => {
    renderComQuery(<Lancador />);
    const botao = screen.getByTestId("botao-notificacoes");
    expect(botao).toHaveAttribute("href", "/assessor/notificacoes");
    expect(await within(botao).findByTestId("resumo-aniversarios")).toHaveTextContent("1 aniversário hoje");
    expect(botao).toHaveTextContent(/\d+ alertas não lidos/);
    expect(within(botao).getByTestId("contador-notificacoes")).toBeInTheDocument();
    // o sino da barra do topo também leva às notificações
    expect(screen.getByRole("link", { name: /^Notificações \(\d+ não lidas\)$/ })).toHaveAttribute("href", "/assessor/notificacoes");
  });
});
