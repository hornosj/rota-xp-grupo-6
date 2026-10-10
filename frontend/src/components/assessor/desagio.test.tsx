// Calculadora de deságio na 360, com as posições REAIS do backend (src/mocks/fixtures-desagio).
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { estadoFixtures } from "@/test/api-fixtures";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/test/api-fixtures")).apiFixtures }));

import { CardDesagio } from "./card-desagio";

afterEach(() => {
  estadoFixtures.conectado = false;
});

async function itemDe(nome: string) {
  const itens = await screen.findAllByTestId("posicao-desagio");
  const item = itens.find((i) => i.textContent?.includes(nome));
  if (!item) throw new Error(`posição ${nome} não encontrada`);
  return item;
}

describe("calculadora de deságio", () => {
  it("mostra embaixo de cada título o break-even com 3% de deságio e nova taxa de 13,5% a.a.", async () => {
    renderComQuery(<CardDesagio clienteId="cli-001" />);

    const cdb = await itemDe("CDB Banco Ipê 2028");
    expect(cdb).toHaveTextContent("112% do CDI (≈ 11,2% a.a.)");
    const beCdb = await within(cdb).findByTestId("break-even");
    expect(beCdb).toHaveTextContent("Break-even em 1 ano e 6 meses");
    expect(beCdb).toHaveTextContent("vence em 1 ano e 8 meses");
    expect(beCdb).toHaveTextContent("Compensa");
    expect(beCdb).toHaveTextContent("Perda imediata R$ 4.800");

    const tesouro = await itemDe("Tesouro IPCA+ 2035");
    expect(await within(tesouro).findByTestId("break-even")).toHaveTextContent("Break-even em 1 ano e 4 meses");

    // fundos, ações e liquidez diária não entram na conta
    expect(screen.getAllByTestId("posicao-desagio")).toHaveLength(2);
    expect(screen.getByText(/CDB Liquidez Diária Banco Ipê — liquidez diária/)).toBeInTheDocument();
    expect(screen.getByText(/Carteira de ações — produto sem marcação a mercado por taxa$/)).toBeInTheDocument();
  });

  it("recalcula quando o assessor muda a nova taxa", async () => {
    const user = userEvent.setup();
    renderComQuery(<CardDesagio clienteId="cli-001" />);
    const cdb = await itemDe("CDB Banco Ipê 2028");
    await within(cdb).findByTestId("break-even");

    const taxa = screen.getByLabelText("Nova taxa");
    await user.clear(taxa);
    await user.type(taxa, "11");

    await waitFor(() =>
      expect(within(cdb).getByTestId("break-even")).toHaveTextContent(
        "Não recupera o deságio: a nova taxa (11% a.a.) não supera a atual (11,2% a.a.)",
      ),
    );
    expect(within(cdb).getByTestId("break-even")).toHaveAttribute("data-compensa", "false");
    expect(within(cdb).getByTestId("break-even")).toHaveTextContent("Não compensa");
  });

  it("valor inválido avisa no campo e não simula", async () => {
    const user = userEvent.setup();
    renderComQuery(<CardDesagio clienteId="cli-001" />);
    await screen.findAllByTestId("break-even");

    const desagio = screen.getByLabelText("Deságio na venda");
    await user.clear(desagio);
    await user.type(desagio, "abc");

    expect(desagio).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Informe um deságio entre 0% e 100%.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryAllByTestId("break-even")).toHaveLength(0));
  });

  it("o CDB do Banco Horizonte entra na calculadora depois do consentimento", async () => {
    estadoFixtures.conectado = true;
    renderComQuery(<CardDesagio clienteId="cli-001" />);
    const horizonte = await itemDe("CDB Banco Horizonte 2028");
    expect(horizonte).toHaveTextContent("R$ 650.000");
    expect(await within(horizonte).findByTestId("break-even")).toHaveTextContent("Break-even em");
    expect(screen.getAllByTestId("posicao-desagio")).toHaveLength(3);
  });
});
