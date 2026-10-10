import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { avisarDadosAlterados } from "@/lib/sinal";
import { mockApi } from "@/mocks";
import { navegacao } from "@/test/navegacao";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { TelaCliente360 } from "./assessor/tela-cliente-360";
import { TelaHoje } from "./assessor/tela-hoje";
import { TelaPainel } from "./assessor/tela-painel";

describe("TelaHoje", () => {
  it("Marina sobe para 1º com NOVO na hora em que o outro iframe avisa (sem esperar o polling)", async () => {
    navegacao.search = "aoVivo=1";
    renderComQuery(<TelaHoje />);
    expect(await screen.findByText(/Ao vivo/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId("item-fila")[1]).toHaveTextContent("Dra. Marina Costa"));
    expect(within(screen.getAllByTestId("item-fila")[1]).getByRole("link")).toHaveAttribute("href", "/assessor/clientes/cli-001?aoVivo=1");

    // a cliente confirma no "outro iframe": o hook de lá grava e avisa as outras telas
    await mockApi.conceder("cli-001", "inst-horizonte");
    avisarDadosAlterados();

    await waitFor(
      () => {
        const primeira = screen.getAllByTestId("item-fila")[0];
        expect(primeira).toHaveTextContent("Dra. Marina Costa");
        expect(primeira).toHaveTextContent("NOVO");
      },
      { timeout: 1500 },   // bem abaixo dos 15 s do polling de segurança
    );
  });

  it("filtra a sequência pelo tipo da próxima ação e gera a mensagem direto do destaque", async () => {
    const user = userEvent.setup();
    renderComQuery(<TelaHoje />);
    await screen.findAllByTestId("item-fila");
    await user.click(screen.getByRole("button", { name: /Dinheiro parado/ }));
    const [destaque, ...linhas] = screen.getAllByTestId("item-fila");
    expect(destaque).toHaveTextContent("Patrícia Gomes");
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas[0]).toHaveTextContent("Dra. Marina Costa");
    for (const l of linhas) expect(l).toHaveTextContent(/parados/);

    await user.click(within(destaque).getByRole("button", { name: /Gerar mensagem/ }));
    expect(await screen.findByTestId("texto-mensagem")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Patrícia Gomes");
  });

  it("sem ao vivo: sem indicador", async () => {
    renderComQuery(<TelaHoje />);
    await screen.findAllByTestId("item-fila");
    expect(screen.queryByText(/Ao vivo/)).not.toBeInTheDocument();
  });
});

describe("TelaCliente360", () => {
  it("mostra todos os cards da 360 da Marina e gera o briefing", async () => {
    const user = userEvent.setup();
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    expect(await screen.findByRole("heading", { name: "Dra. Marina Costa" })).toBeInTheDocument();
    for (const titulo of ["Principalidade", "Patrimônio visível", "Fluxo de caixa mensal", "Alertas", "Ações sugeridas", "Eventos de vida", "Briefing pré-reunião"]) {
      expect(screen.getByText(titulo)).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: /Gerar briefing/ }));
    expect(await screen.findByTestId("briefing-bullets")).toHaveTextContent("Banco Aurora é a instituição principal");
    expect(screen.getByTestId("briefing-perguntas")).toHaveTextContent("Banco Horizonte");
  });

  it("cliente inexistente: mensagem de erro", async () => {
    renderComQuery(<TelaCliente360 clienteId="cli-999" />);
    expect(await screen.findByText(/Não foi possível carregar/)).toBeInTheDocument();
  });
});

describe("TelaPainel", () => {
  it("mostra KPIs da carteira e a distribuição da posição XP", async () => {
    const p = await mockApi.painel();
    renderComQuery(<TelaPainel />);
    expect(await screen.findByTestId("kpi-total-clientes")).toHaveTextContent(String(p.totalClientes));
    expect(screen.getByTestId("kpi-xp-principal")).toHaveTextContent("%");
    expect(screen.getByText(/Clientes com alerta alto/)).toBeInTheDocument();
    expect(screen.getByTestId("distribuicao")).toHaveTextContent("Só investimentos");
  });
});
