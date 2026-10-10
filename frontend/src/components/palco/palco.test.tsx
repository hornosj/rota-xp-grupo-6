// /palco: assessora à esquerda; à direita o celular da Marina com o WhatsApp simulado.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { Palco } from "./palco";

const TOKEN = "cv-cli-001-inst-horizonte";

describe("Palco", () => {
  it("assessora à esquerda com abas (fila e 360 da Marina); nada no celular nem para confirmar antes do convite", async () => {
    const user = userEvent.setup();
    renderComQuery(<Palco />);
    expect(screen.getByTitle("Tela do assessor").getAttribute("src")).toBe("/assessor/hoje?aoVivo=1");
    await user.click(screen.getByRole("tab", { name: /360 da Marina/ }));
    await waitFor(() =>
      expect(screen.getByTitle("Tela do assessor").getAttribute("src")).toBe("/assessor/clientes/cli-001?aoVivo=1"),
    );
    const celular = screen.getByTestId("celular");
    expect(within(celular).getByText("Assessora XP")).toBeInTheDocument();
    expect(within(celular).queryAllByTestId("bolha-assessora")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Simular confirmação/ })).toBeDisabled();
    // não existe mais app do cliente
    expect(document.querySelector('iframe[src^="/cliente"]')).toBeNull();
  });

  it("com convite pendente: a mensagem da assessora (com o link) aparece e o link abre o convite dentro do celular", async () => {
    const user = userEvent.setup();
    await mockApi.criarConvite("cli-001", "inst-horizonte");
    renderComQuery(<Palco />);
    const bolha = await screen.findByTestId("bolha-assessora");
    await waitFor(() => expect(bolha).toHaveTextContent(/Para eu enxergar seu patrimônio completo/));
    const link = within(bolha).getByRole("link", { name: new RegExp(`/convite/${TOKEN}`) });
    await waitFor(() => expect(screen.getByRole("button", { name: /Simular confirmação/ })).toBeEnabled());

    await user.click(link);
    const tela = await screen.findByTitle("Convite no celular");
    expect(tela.getAttribute("src")).toBe(`/convite/${TOKEN}`);
    await user.click(screen.getByRole("button", { name: /Voltar ao WhatsApp/ }));
    expect(screen.queryByTitle("Convite no celular")).not.toBeInTheDocument();
  });

  it("Simular confirmação confirma o último convite pendente e mostra Confirmado ✓", async () => {
    const user = userEvent.setup();
    const confirmar = vi.spyOn(mockApi, "confirmarConvite");
    await mockApi.criarConvite("cli-001", "inst-horizonte");
    renderComQuery(<Palco />);
    const botao = screen.getByRole("button", { name: /Simular confirmação/ });
    await waitFor(() => expect(botao).toBeEnabled());
    await user.click(botao);
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(TOKEN));
    expect(await screen.findByText("Confirmado ✓")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Simular confirmação/ })).toBeDisabled());
    const fila = await mockApi.fila();
    expect(fila[0].clienteId).toBe("cli-001");
  });

  it("Resetar demo limpa a conversa e recarrega os iframes", async () => {
    const user = userEvent.setup();
    const reset = vi.spyOn(mockApi, "resetDemo");
    const c = await mockApi.criarConvite("cli-001", "inst-horizonte");
    await mockApi.confirmarConvite(c.token);
    renderComQuery(<Palco />);
    expect(await screen.findByText("Confirmado ✓")).toBeInTheDocument();
    const assessor = screen.getByTitle("Tela do assessor");

    await user.click(screen.getByRole("button", { name: /Resetar demo/ }));
    await waitFor(() => expect(reset).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Confirmado ✓")).not.toBeInTheDocument());
    expect(screen.queryAllByTestId("bolha-assessora")).toHaveLength(0);
    await waitFor(() => expect(screen.getByTitle("Tela do assessor")).not.toBe(assessor));
    const fila = await mockApi.fila();
    expect(fila.findIndex((i) => i.clienteId === "cli-001")).toBe(1);
  });
});
