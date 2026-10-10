import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
afterEach(() => vi.restoreAllMocks());

import AssessorLayout from "@/app/assessor/layout";
import { CardRadarCliente } from "./card-radar-cliente";
import { TelaCliente360 } from "./tela-cliente-360";
import { TelaRadar } from "./tela-radar";

describe("TelaRadar (/assessor/radar)", () => {
  it("lista os impactos da carteira por pontos, com link para a 360, motivo, gatilhos e barra de pontos", async () => {
    renderComQuery(<TelaRadar />);
    const itens = await screen.findAllByTestId("impacto");
    const primeiro = itens[0];
    expect(primeiro).toHaveTextContent("Roberto Lima");
    expect(primeiro).toHaveTextContent("Agro Sul Sementes adia pagamento de juros de CRA");
    expect(primeiro).toHaveTextContent("Curadoria (fictícia)");
    expect(primeiro).toHaveTextContent("R$ 900 mil em CRA da Agro Sul Sementes S.A. (44,4% do patrimônio visível)");
    expect(primeiro).toHaveTextContent("emissor: Agro Sul Sementes S.A.");
    expect(within(primeiro).getByTestId("pontos")).toHaveTextContent("90");
    expect(within(primeiro).getByTestId("barra-pontos").style.width).toBe("90%");
    expect(within(primeiro).getByRole("link", { name: "Roberto Lima" })).toHaveAttribute("href", "/assessor/clientes/cli-005");

    const pontos = itens.map((i) => Number(within(i).getByTestId("pontos").textContent?.replace(",", ".")));
    expect([...pontos].sort((a, b) => b - a)).toEqual(pontos);
  });

  it("preto e branco: NEGATIVA preenchida de preto, POSITIVA contornada, sem cores", async () => {
    renderComQuery(<TelaRadar />);
    const itens = await screen.findAllByTestId("impacto");
    const negativa = itens.find((i) => i.getAttribute("data-direcao") === "NEGATIVA")!;
    expect(within(negativa).getByTestId("direcao")).toHaveTextContent("Negativa");
    expect(within(negativa).getByTestId("direcao").className).toMatch(/bg-black/);
    const positiva = itens.find((i) => i.getAttribute("data-direcao") === "POSITIVA")!;
    expect(within(positiva).getByTestId("direcao")).toHaveTextContent("Positiva");
    expect(within(positiva).getByTestId("direcao").className).toMatch(/ring-black/);
    expect(within(positiva).getByTestId("direcao").className).not.toMatch(/bg-black/);
    for (const i of itens) expect(i.innerHTML).not.toMatch(/(red|emerald|green|amber|sky|violet)-\d/);
  });

  it("'Processar agora' chama o processamento, mostra toast com novas/lotes e recarrega o radar", async () => {
    const user = userEvent.setup();
    const processar = vi.spyOn(mockApi, "processarRadar");
    const carteira = vi.spyOn(mockApi, "radarCarteira");
    renderComQuery(<TelaRadar />);
    await screen.findAllByTestId("impacto");
    const chamadasAntes = carteira.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /Processar agora/ }));
    await waitFor(() => expect(processar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/0 notícias novas.*0 lotes/)));
    await waitFor(() => expect(carteira.mock.calls.length).toBeGreaterThan(chamadasAntes));
  });

  it("falha no processamento mostra toast de erro", async () => {
    const user = userEvent.setup();
    vi.spyOn(mockApi, "processarRadar").mockRejectedValueOnce(new Error("fora do ar"));
    renderComQuery(<TelaRadar />);
    await screen.findAllByTestId("impacto");
    await user.click(screen.getByRole("button", { name: /Processar agora/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("fora do ar")));
  });

  it("seção de últimas notícias classificadas: tags de emissor/indexador/produto, relevância e origem", async () => {
    renderComQuery(<TelaRadar />);
    const noticias = await screen.findAllByTestId("noticia");
    expect(noticias).toHaveLength(20);
    const primeira = noticias[0];
    expect(primeira).toHaveTextContent("Banco Horizonte nega problemas de liquidez após boatos");
    // emissor mostrado pelo nome, não pelo id
    expect(within(primeira).getByText("Banco Horizonte")).toBeInTheDocument();
    expect(primeira).not.toHaveTextContent("emi-horizonte");
    expect(within(primeira).getByText("CDB")).toBeInTheDocument();
    expect(within(primeira).getByText("LCA")).toBeInTheDocument();
    expect(within(primeira).getByTestId("relevancia")).toHaveTextContent("60%");
    expect(within(primeira).getByTestId("origem")).toHaveTextContent("Referência");
    expect(within(primeira).getByTestId("direcao").className).toMatch(/bg-black/);
    const selic = noticias.find((n) => n.textContent?.includes("Copom sinaliza fim do ciclo"))!;
    expect(within(selic).getByText("SELIC")).toBeInTheDocument();
    expect(within(selic).getByText("CDI")).toBeInTheDocument();
  });

  it("carteira sem impactos: estado vazio", async () => {
    vi.spyOn(mockApi, "radarCarteira").mockResolvedValue([]);
    renderComQuery(<TelaRadar />);
    expect(await screen.findByText(/Nenhuma notícia mexe na carteira agora/)).toBeInTheDocument();
  });
});

describe("CardRadarCliente (360)", () => {
  it("cliente sem notícias relevantes: estado vazio", async () => {
    renderComQuery(<CardRadarCliente clienteId="cli-101" />);
    expect(screen.getByText("Notícias que mexem na carteira")).toBeInTheDocument();
    expect(await screen.findByText("Nenhuma notícia relevante para a carteira visível.")).toBeInTheDocument();
  });

  it("Roberto: notícia da Agro Sul no topo; 'Por que ligar?' mostra o motivo, a origem do texto e copia", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderComQuery(<CardRadarCliente clienteId="cli-005" />);
    const itens = await screen.findAllByTestId("impacto-cliente");
    const primeiro = itens[0];
    expect(primeiro).toHaveTextContent("Agro Sul Sementes adia pagamento de juros de CRA");
    expect(primeiro).toHaveAttribute("data-direcao", "NEGATIVA");
    expect(primeiro).toHaveTextContent("R$ 900 mil em CRA da Agro Sul Sementes S.A.");
    expect(within(primeiro).getByTestId("pontos")).toHaveTextContent("90");

    await user.click(within(primeiro).getByRole("button", { name: /Por que ligar\?/ }));
    const texto = await within(primeiro).findByTestId("texto-motivo");
    expect(texto).toHaveTextContent(/^Roberto tem R\$ 900 mil em CRA da Agro Sul/);
    expect(within(primeiro).getByTestId("gerado-por")).toHaveTextContent("stub");
    await user.click(within(primeiro).getByRole("button", { name: /Copiar/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Roberto tem R\$ 900 mil/)));
    expect(toast.success).toHaveBeenCalled();
  });

  it("Marina: notícias do Banco Horizonte só aparecem depois do consentimento", async () => {
    const { unmount } = renderComQuery(<CardRadarCliente clienteId="cli-001" />);
    await screen.findAllByTestId("impacto-cliente");
    expect(screen.queryByText(/rebaixa rating do Banco Horizonte/)).not.toBeInTheDocument();
    unmount();

    await mockApi.conceder("cli-001", "inst-horizonte");
    renderComQuery(<CardRadarCliente clienteId="cli-001" />);
    const itens = await screen.findAllByTestId("impacto-cliente");
    expect(itens[0]).toHaveTextContent("Agência rebaixa rating do Banco Horizonte de A para BBB");
  });

  it("erro ao buscar o motivo aparece no item", async () => {
    const user = userEvent.setup();
    vi.spyOn(mockApi, "motivoNoticia").mockRejectedValueOnce(new Error("A notícia não mexe na carteira"));
    renderComQuery(<CardRadarCliente clienteId="cli-005" />);
    const [primeiro] = await screen.findAllByTestId("impacto-cliente");
    await user.click(within(primeiro).getByRole("button", { name: /Por que ligar\?/ }));
    expect(await within(primeiro).findByText(/Não foi possível gerar o motivo/)).toBeInTheDocument();
  });

  it("faz parte da 360 do cliente", async () => {
    renderComQuery(<TelaCliente360 clienteId="cli-005" />);
    expect(await screen.findByText("Notícias que mexem na carteira")).toBeInTheDocument();
    expect((await screen.findAllByTestId("impacto-cliente")).length).toBeGreaterThan(0);
  });
});

describe("Layout do assessor", () => {
  it("tem link 'Radar de notícias' na navegação", () => {
    renderComQuery(
      <AssessorLayout params={Promise.resolve({})}>
        <p>conteúdo</p>
      </AssessorLayout>,
    );
    expect(screen.getByRole("link", { name: "Radar de notícias" })).toHaveAttribute("href", "/assessor/radar");
  });
});
