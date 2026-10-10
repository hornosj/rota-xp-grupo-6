import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { CabecalhoCliente } from "./cabecalho-cliente";
import { CardFluxoCaixa } from "./card-fluxo-caixa";
import { CardPatrimonio } from "./card-patrimonio";
import { CardPrincipalidade } from "./card-principalidade";
import { DialogMensagem } from "./dialog-mensagem";
import { ListaAcoes } from "./lista-acoes";
import { ListaAlertas } from "./lista-alertas";
import { ListaFila } from "./lista-fila";
import { LinhaDoTempo } from "./linha-do-tempo";

describe("ListaFila", () => {
  it("mostra a fila na ordem recebida, com posição, prioridade, motivos e ação principal", async () => {
    const fila = await mockApi.fila();
    renderComQuery(<ListaFila itens={fila} />);
    const linhas = screen.getAllByTestId("item-fila");
    expect(linhas[0]).toHaveTextContent("Patrícia Gomes");
    expect(linhas[1]).toHaveTextContent("Dra. Marina Costa");
    expect(within(linhas[1]).getByTestId("posicao")).toHaveTextContent("2");
    expect(linhas[1]).toHaveTextContent("39,1");
    expect(linhas[1]).toHaveTextContent("R$ 61 mil parados em conta corrente");
    expect(linhas[1]).toHaveTextContent("Levar R$ 61 mil parados para liquidez diária");
    expect(linhas[1]).toHaveTextContent("Só investimentos");
    expect(within(linhas[1]).getByRole("link", { name: /Marina/ })).toHaveAttribute("href", "/assessor/clientes/cli-001");
    expect(screen.queryByText("NOVO")).not.toBeInTheDocument();
  });

  it("depois do consentimento: Marina em 1º com tag NOVO pulsante", async () => {
    await mockApi.conceder("cli-001", "inst-horizonte");
    const fila = await mockApi.fila();
    renderComQuery(<ListaFila itens={fila} sufixoLink="?aoVivo=1" />);
    const primeira = screen.getAllByTestId("item-fila")[0];
    expect(primeira).toHaveTextContent("Dra. Marina Costa");
    expect(primeira).toHaveTextContent("100");
    const tag = within(primeira).getByText("NOVO");
    expect(tag.className).toMatch(/animate-/);
    expect(within(primeira).getByRole("link", { name: /Marina/ })).toHaveAttribute("href", "/assessor/clientes/cli-001?aoVivo=1");
  });

  it("lista vazia mostra estado vazio", () => {
    renderComQuery(<ListaFila itens={[]} />);
    expect(screen.getByText(/Nenhum cliente na fila/)).toBeInTheDocument();
  });
});

describe("CardPrincipalidade", () => {
  it("desenha barras por instituição com segmentos proporcionais às contribuições", async () => {
    const v = await mockApi.visao360("cli-001");
    renderComQuery(<CardPrincipalidade principalidade={v.principalidade} />);
    expect(screen.getByText(v.principalidade.explicacao)).toBeInTheDocument();
    expect(screen.getAllByText("Só investimentos").length).toBeGreaterThan(0);
    // renda contribui 30 pontos de 100 → 30% da largura
    expect(screen.getByTestId("seg-inst-aurora-renda").style.width).toBe("30%");
    expect(screen.getByTestId("seg-inst-xp-investimentos").style.width).toBe("15%");
    expect(screen.queryByTestId("seg-inst-xp-renda")).not.toBeInTheDocument();
    expect(screen.getByTestId("score-inst-aurora")).toHaveTextContent("85");
    expect(screen.getByText("recebe 100% da renda")).toBeInTheDocument();
  });

  it("aguenta lista de scores vazia", () => {
    renderComQuery(
      <CardPrincipalidade
        principalidade={{ instituicaoPrincipalId: "", instituicaoPrincipalNome: "", posicaoXp: "AUSENTE", explicacao: "Sem dados", scores: [] }}
      />,
    );
    expect(screen.getByText("Sem dados")).toBeInTheDocument();
  });
});

describe("ListaAlertas", () => {
  it("ALTA primeiro com selo preto, ordena por severidade e destaca NOVO", async () => {
    await mockApi.conceder("cli-001", "inst-horizonte");
    const v = await mockApi.visao360("cli-001");
    renderComQuery(<ListaAlertas alertas={v.alertas} />);
    const itens = screen.getAllByTestId("alerta");
    expect(itens[0]).toHaveAttribute("data-severidade", "ALTA");
    expect(itens[0]).toHaveTextContent("R$ 400 mil acima da cobertura do FGC");
    expect(itens[0]).toHaveTextContent("NOVO");
    expect(within(itens[0]).getByText("Alta").className).toMatch(/bg-black/);
    for (const el of itens.slice(1)) {
      expect(el.getAttribute("data-severidade")).not.toBe("ALTA");
      expect(within(el).queryByText("Alta")).not.toBeInTheDocument();
    }
    expect(itens[0].textContent?.replace(/ /g, " ")).toContain("R$ 400.000");
  });

  it("vazio: mensagem positiva", () => {
    renderComQuery(<ListaAlertas alertas={[]} />);
    expect(screen.getByText(/Nenhum alerta/)).toBeInTheDocument();
  });
});

describe("Ações e DialogMensagem", () => {
  it("Gerar mensagem abre dialog com texto, badge geradoPor, copiar e WhatsApp", async () => {
    await mockApi.conceder("cli-001", "inst-horizonte");
    const v = await mockApi.visao360("cli-001");
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderComQuery(<ListaAcoes clienteId="cli-001" acoes={v.acoes} />);
    const principal = screen.getAllByTestId("acao")[0];
    expect(principal).toHaveTextContent("Distribuir R$ 400 mil");
    expect(principal).toHaveTextContent("Principal");
    await user.click(within(principal).getByRole("button", { name: /Gerar mensagem/ }));
    const texto = await screen.findByTestId("texto-mensagem");
    expect(texto).toHaveTextContent("Oi, Marina!");
    expect(texto).toHaveTextContent("Sofia");
    expect(screen.getByTestId("gerado-por")).toHaveTextContent("stub");
    const wa = screen.getByRole("link", { name: /Abrir no WhatsApp/ });
    expect(wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=Oi%2C%20Marina/);
    await user.click(screen.getByRole("button", { name: /Copiar/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Oi, Marina!")));
  });

  it("lista de ações vazia não quebra", () => {
    renderComQuery(<ListaAcoes clienteId="cli-006" acoes={[]} />);
    expect(screen.getByText(/Nenhuma ação sugerida/)).toBeInTheDocument();
  });

  it("dialog fechado não chama a API", () => {
    const spy = vi.spyOn(mockApi, "mensagem");
    renderComQuery(
      <DialogMensagem
        clienteId="cli-001"
        acao={{ id: "x", clienteId: "cli-001", tipo: "CONTATO_RELACIONAMENTO", titulo: "t", motivo: "m", alertaIds: [], principal: false }}
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Cabeçalho, patrimônio, fluxo e linha do tempo", () => {
  it("cabeçalho mostra cobertura e pendentes", async () => {
    const v = await mockApi.visao360("cli-001");
    renderComQuery(<CabecalhoCliente visao={v} />);
    expect(screen.getByText("Dra. Marina Costa")).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 instituições conectadas/)).toBeInTheDocument();
    expect(screen.getByText(/Banco Horizonte/)).toBeInTheDocument();
    expect(screen.getByText(/Arrojado/)).toBeInTheDocument();
  });

  it("patrimônio mostra total, share e pendente tracejado", async () => {
    const v = await mockApi.visao360("cli-001");
    renderComQuery(<CardPatrimonio patrimonio={v.patrimonio} cobertura={v.cobertura} />);
    expect(screen.getByTestId("total-visivel")).toHaveTextContent("R$ 985 mil");
    expect(screen.getByTestId("share-xp")).toHaveTextContent("91%");
    expect(screen.getByTestId("pendente-inst-horizonte")).toHaveTextContent(/não conectado/);
  });

  it("fluxo de caixa mostra aviso quando parcial", async () => {
    const v = await mockApi.visao360("cli-003");
    renderComQuery(<CardFluxoCaixa fluxo={v.fluxoCaixa} />);
    expect(screen.getByTestId("custo-vida").textContent?.replace(/ /g, " ")).toContain("R$ 9.000");
    expect(screen.getByTestId("reserva-meses")).toHaveTextContent("3");
    expect(screen.getByText(/estimado/)).toBeInTheDocument();
  });

  it("linha do tempo calcula aniversário a partir da data de referência", async () => {
    const v = await mockApi.visao360("cli-001");
    renderComQuery(<LinhaDoTempo cliente={v.cliente} dataReferencia="2026-10-10" />);
    expect(screen.getAllByText(/Sofia/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/em 5 dias/).length).toBeGreaterThan(0);
  });
});
