// 360 · Enviar convite (FE1-12): com as respostas no formato real do backend.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFixtures, conviteMarina, estadoFixtures } from "@/test/api-fixtures";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/test/api-fixtures")).apiFixtures }));

import { TelaCliente360 } from "./tela-cliente-360";

afterEach(() => {
  estadoFixtures.conectado = false;
  estadoFixtures.convites = [];
});

const LINK = "http://localhost:3000/convite/cv-9612a1d93c";

async function cobertura() {
  await screen.findByRole("heading", { name: "Dra. Marina Costa" });
  return screen.getByTestId("cobertura");
}

describe("360 · Enviar convite", () => {
  it("cria o convite e abre a mensagem da ação CONVIDAR_CONEXAO com o link", async () => {
    const criar = vi.spyOn(apiFixtures, "criarConvite");
    const mensagem = vi.spyOn(apiFixtures, "mensagem");
    const user = userEvent.setup();
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    const card = await cobertura();
    const linha = within(card).getByTestId("pendente-cobertura-inst-horizonte");
    expect(linha).toHaveTextContent("Banco Horizonte");
    await user.click(within(linha).getByRole("button", { name: /Enviar convite/ }));

    expect(criar).toHaveBeenCalledWith("cli-001", "inst-horizonte");
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByTestId("texto-mensagem")).toHaveTextContent(LINK);
    expect(mensagem).toHaveBeenCalledWith("cli-001", "acao-cli-001-convidar_conexao-inst-horizonte", "WHATSAPP");
    // o status do convite aparece na cobertura
    await waitFor(() => expect(within(linha).getByTestId("status-convite")).toHaveTextContent(/Convite pendente · expira em 13\/10/));
  });

  it("convite já pendente: mostra o status antes de enviar de novo", async () => {
    estadoFixtures.convites = [conviteMarina()];
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    const card = await cobertura();
    expect(await within(card).findByTestId("status-convite")).toHaveTextContent("Convite pendente · expira em 13/10");
  });

  it("depois da confirmação: 3 de 3, sem botão, e o convite aparece como Confirmado", async () => {
    estadoFixtures.convites = [conviteMarina({ status: "CONFIRMADO" })];
    estadoFixtures.conectado = true;
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    const card = await cobertura();
    expect(card).toHaveTextContent(/3 de 3 instituições conectadas/);
    expect(within(card).queryByRole("button", { name: /Enviar convite/ })).not.toBeInTheDocument();
    expect(await within(card).findByTestId("status-convite")).toHaveTextContent(/Banco Horizonte.*Confirmado/);
  });

  it("409 (já conectado enquanto a tela estava aberta): só recarrega, sem abrir a mensagem", async () => {
    const user = userEvent.setup();
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    const card = await cobertura();
    const botao = within(card).getByRole("button", { name: /Enviar convite/ });
    estadoFixtures.conectado = true; // outra aba conectou
    await user.click(botao);
    await waitFor(() => expect(screen.getByTestId("cobertura")).toHaveTextContent(/3 de 3 instituições conectadas/));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
