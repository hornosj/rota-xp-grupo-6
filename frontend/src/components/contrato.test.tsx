// Testes de contrato: as telas renderizadas com as respostas REAIS do backend
// (contract/fixtures, copiadas por `npm run sync:fixtures`), não com os mocks escritos à mão.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { estadoFixtures, fixtures } from "@/test/api-fixtures";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/test/api-fixtures")).apiFixtures }));

import { TelaCliente360 } from "./assessor/tela-cliente-360";
import { TelaHoje } from "./assessor/tela-hoje";
import { TelaPainel } from "./assessor/tela-painel";

afterEach(() => {
  estadoFixtures.conectado = false;
});

describe("contrato real · fila do assessor", () => {
  it("antes: Marina em 2º, sem NOVO", async () => {
    renderComQuery(<TelaHoje />);
    const itens = await screen.findAllByTestId("item-fila");
    expect(itens).toHaveLength(fixtures.filaAntes().length);
    expect(itens[0]).toHaveTextContent("Patrícia Gomes");
    expect(itens[1]).toHaveTextContent("Dra. Marina Costa");
    expect(itens[1]).not.toHaveTextContent("NOVO");
    expect(itens[1]).toHaveTextContent("39,1");
    expect(itens[1]).toHaveTextContent("Levar R$ 61 mil parados para liquidez diária");
  });

  it("depois: Marina em 1º com NOVO e o motivo do FGC", async () => {
    estadoFixtures.conectado = true;
    renderComQuery(<TelaHoje />);
    const itens = await screen.findAllByTestId("item-fila");
    expect(itens[0]).toHaveTextContent("Dra. Marina Costa");
    expect(itens[0]).toHaveTextContent("NOVO");
    expect(itens[0]).toHaveTextContent("R$ 400 mil acima da cobertura do FGC");
    expect(within(itens[0]).getByTestId("posicao")).toHaveTextContent("1");
    expect(itens[1]).toHaveTextContent("Patrícia Gomes");
  });
});

describe("contrato real · 360 da Marina", () => {
  it("antes: principalidade Aurora 85 × XP 15, Horizonte pendente", async () => {
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    expect(await screen.findByRole("heading", { name: "Dra. Marina Costa" })).toBeInTheDocument();
    expect(screen.getByTestId("score-inst-aurora")).toHaveTextContent("85");
    expect(screen.getByTestId("score-inst-xp")).toHaveTextContent("15");
    expect(screen.getByText(/2 de 3 instituições conectadas/)).toBeInTheDocument();
    expect(screen.getByTestId("pendente-inst-horizonte")).toHaveTextContent("não conectado");
    expect(screen.getByTestId("total-visivel")).toHaveTextContent("R$ 985 mil");
    expect(screen.queryByText("R$ 400 mil acima da cobertura do FGC")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("alerta")).toHaveLength(3);
    expect(screen.getByTestId("reserva-meses")).toHaveTextContent("6,5");
  });

  it("depois: alerta ALTA de R$ 400 mil acima do FGC, NOVO, e Horizonte no patrimônio", async () => {
    estadoFixtures.conectado = true;
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    await screen.findByRole("heading", { name: "Dra. Marina Costa" });
    const alertas = screen.getAllByTestId("alerta");
    expect(alertas[0]).toHaveAttribute("data-severidade", "ALTA");
    expect(alertas[0]).toHaveTextContent("R$ 400 mil acima da cobertura do FGC");
    expect(alertas[0]).toHaveTextContent("NOVO");
    expect(alertas[0]).toHaveTextContent("R$ 400.000");
    expect(screen.getByText(/3 de 3 instituições conectadas/)).toBeInTheDocument();
    expect(screen.queryByTestId("pendente-inst-horizonte")).not.toBeInTheDocument();
    expect(screen.getByTestId("total-visivel")).toHaveTextContent("R$ 1,6 mi");
    expect(screen.getByTestId("score-inst-horizonte")).toHaveTextContent("6,3");
    // ação sem impactoEstimado (omitido pelo backend) renderiza normalmente
    expect(screen.getByText("Reduzir exposição sem garantia ao Banco Horizonte")).toBeInTheDocument();
  });

  it("gera a mensagem (fixture real) e o briefing", async () => {
    estadoFixtures.conectado = true;
    const user = userEvent.setup();
    renderComQuery(<TelaCliente360 clienteId="cli-001" />);
    await screen.findByRole("heading", { name: "Dra. Marina Costa" });
    const primeiraAcao = screen.getAllByTestId("acao")[0];
    expect(primeiraAcao).toHaveTextContent("Distribuir R$ 400 mil entre emissores");
    await user.click(within(primeiraAcao).getByRole("button", { name: /Gerar mensagem/ }));
    expect(await screen.findByTestId("texto-mensagem")).toHaveTextContent(/R\$ 400 mil no Banco Horizonte/);
    expect(screen.getByTestId("gerado-por")).toHaveTextContent("stub");

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Gerar briefing/ }));
    expect(await screen.findByTestId("briefing-bullets")).toHaveTextContent("Banco Aurora é a instituição principal");
    expect(screen.getByTestId("briefing-perguntas")).toHaveTextContent("aniversário da Sofia");
  });
});

describe("contrato real · painel", () => {
  it("KPIs e distribuição", async () => {
    renderComQuery(<TelaPainel />);
    expect(await screen.findByTestId("kpi-total-clientes")).toHaveTextContent("36");
    expect(screen.getByTestId("kpi-xp-principal")).toHaveTextContent("22%");
    expect(screen.getByTestId("distribuicao")).toHaveTextContent("Só investimentos");
  });
});
