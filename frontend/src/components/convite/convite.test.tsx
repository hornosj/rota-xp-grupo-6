// Tela do convite (/convite/[token]): o único ponto em que o cliente aparece.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { conviteMarina, estadoFixtures } from "@/test/api-fixtures";
import { navegacao } from "@/test/navegacao";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/test/api-fixtures")).apiFixtures }));

import { RotaConvite } from "./rota-convite";
import { TelaConvite } from "./tela-convite";

afterEach(() => {
  estadoFixtures.conectado = false;
  estadoFixtures.convites = [];
});

const TOKEN = "cv-cli-001-inst-horizonte";

describe("TelaConvite", () => {
  it("pendente: ambiente simulado do banco, escopos em português, 12 meses e revogável", async () => {
    estadoFixtures.convites = [conviteMarina()];
    renderComQuery(<TelaConvite token={TOKEN} />);
    expect(await screen.findByRole("heading", { name: /Banco Horizonte/ })).toBeInTheDocument();
    expect(screen.getByText(/Ambiente simulado — demonstração/)).toBeInTheDocument();
    expect(screen.getByTestId("logo-banco")).toHaveTextContent("BH");
    expect(screen.getByTestId("escopos")).toHaveTextContent("Investimentos");
    expect(screen.getByText(/12 meses/)).toBeInTheDocument();
    expect(screen.getByText(/Você pode revogar quando quiser/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar compartilhamento/ })).toBeEnabled();
  });

  it("confirmar mostra o sucesso e conecta a instituição", async () => {
    estadoFixtures.convites = [conviteMarina()];
    const user = userEvent.setup();
    renderComQuery(<TelaConvite token={TOKEN} />);
    await user.click(await screen.findByRole("button", { name: /Confirmar compartilhamento/ }));
    expect(
      await screen.findByText("Pronto! Sua assessora já consegue ver seus dados do Banco Horizonte."),
    ).toBeInTheDocument();
    expect(estadoFixtures.conectado).toBe(true);
    expect(screen.queryByRole("button", { name: /Confirmar compartilhamento/ })).not.toBeInTheDocument();
  });

  it("já confirmado: mostra o sucesso direto, sem botão", async () => {
    estadoFixtures.convites = [conviteMarina({ status: "CONFIRMADO" })];
    renderComQuery(<TelaConvite token={TOKEN} />);
    expect(
      await screen.findByText("Pronto! Sua assessora já consegue ver seus dados do Banco Horizonte."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
  });

  it("expirado: avisa e pede um novo link, sem botão", async () => {
    estadoFixtures.convites = [conviteMarina({ status: "EXPIRADO" })];
    renderComQuery(<TelaConvite token={TOKEN} />);
    expect(await screen.findByText(/Este convite expirou/)).toBeInTheDocument();
    expect(screen.getByText(/novo link/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
  });

  it("410 ao confirmar (expirou enquanto a tela estava aberta): mostra o aviso de expirado", async () => {
    estadoFixtures.convites = [conviteMarina()];
    const user = userEvent.setup();
    renderComQuery(<TelaConvite token={TOKEN} />);
    const botao = await screen.findByRole("button", { name: /Confirmar compartilhamento/ });
    estadoFixtures.convites[0].status = "EXPIRADO";
    await user.click(botao);
    expect(await screen.findByText(/Este convite expirou/)).toBeInTheDocument();
    expect(estadoFixtures.conectado).toBe(false);
  });

  it("token desconhecido (404): convite não encontrado", async () => {
    renderComQuery(<TelaConvite token="cv-nao-existe" />);
    expect(await screen.findByText(/Convite não encontrado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
  });

  it("a rota lê o token da URL", async () => {
    estadoFixtures.convites = [conviteMarina()];
    navegacao.params = { token: TOKEN };
    renderComQuery(<RotaConvite />);
    expect(await screen.findByRole("heading", { name: /Banco Horizonte/ })).toBeInTheDocument();
  });
});
