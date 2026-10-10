// Testes de contrato: as telas renderizadas com as respostas REAIS do backend
// (contract/fixtures, copiadas por `npm run sync:fixtures`), não com os mocks escritos à mão.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { estadoFixtures, fixtures } from "@/test/api-fixtures";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/test/api-fixtures")).apiFixtures }));

import { TelaCliente360 } from "./assessor/tela-cliente-360";
import { TelaHoje } from "./assessor/tela-hoje";
import { TelaPainel } from "./assessor/tela-painel";
import { DetalheDiagnostico } from "./cliente/detalhe-diagnostico";
import { FluxoConectar } from "./cliente/fluxo-conectar";
import { JornadaCliente } from "./cliente/jornada-cliente";

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

describe("contrato real · jornada da cliente", () => {
  it("antes: 67%, nível 2, Proteção FGC bloqueada", async () => {
    renderComQuery(<JornadaCliente clienteId="cli-001" />);
    expect(await screen.findByTestId("anel-percentual")).toHaveTextContent("67%");
    expect(screen.getByText(/Nível 2 de 4/)).toBeInTheDocument();
    expect(screen.getByText("Visão Clara")).toBeInTheDocument();
    expect(screen.getByTestId("diagnostico-PROTECAO_FGC")).toHaveAttribute("data-desbloqueado", "false");
    expect(screen.getByRole("link", { name: /Conectar agora/ })).toHaveAttribute("href", "/cliente/cli-001/conectar/inst-horizonte");
    expect(await screen.findByText("Olá, Marina!")).toBeInTheDocument();
  });

  it("depois: 100%, nível 3, Proteção FGC com R$ 400 mil", async () => {
    estadoFixtures.conectado = true;
    const user = userEvent.setup();
    renderComQuery(<JornadaCliente clienteId="cli-001" />);
    expect(await screen.findByTestId("anel-percentual")).toHaveTextContent("100%");
    expect(screen.getByText(/Nível 3 de 4/)).toBeInTheDocument();
    expect(screen.getByText("Patrimônio Completo")).toBeInTheDocument();
    const fgc = screen.getByTestId("diagnostico-PROTECAO_FGC");
    expect(fgc).toHaveAttribute("data-desbloqueado", "true");
    expect(fgc).toHaveTextContent("R$ 400 mil sem cobertura no Banco Horizonte");
    await user.click(fgc);
    expect(await screen.findByTestId("detalhe-fgc")).toHaveTextContent(
      "R$ 400 mil do seu patrimônio estão acima da cobertura do FGC no Banco Horizonte. Sua assessora já foi avisada.",
    );
  });

  it("cli-003: missão de cartão e missão de reserva (sem instituicaoId)", async () => {
    renderComQuery(<JornadaCliente clienteId="cli-003" />);
    expect(await screen.findByText("Conecte o cartão do Banco Aurora e descubra seu custo de vida real")).toBeInTheDocument();
    expect(screen.getByText("Monte sua reserva de emergência")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Conectar agora/ })).toHaveLength(1);
    for (const d of screen.getAllByTestId(/^diagnostico-/)) expect(d).toHaveAttribute("data-desbloqueado", "false");
  });
});

describe("contrato real · detalhes dos diagnósticos", () => {
  const diag = (tipo: string) => fixtures.jornadaDepois().diagnosticos.find((d) => d.tipo === tipo)!;

  it("custo de vida: categorias com rótulos em português", () => {
    renderComQuery(<DetalheDiagnostico diagnostico={diag("CUSTO_DE_VIDA")} onFechar={() => {}} />);
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent("R$ 24.000");
    for (const rotulo of ["Cartões", "Contas recorrentes", "Parcelas", "Consumo"]) {
      expect(within(dialogo).getByText(rotulo)).toBeInTheDocument();
    }
    expect(dialogo).not.toHaveTextContent("CONTAS_RECORRENTES");
    expect(within(dialogo).getByText("R$ 9.000")).toBeInTheDocument();
  });

  it("custo de vida parcial: avisa que faltam dados", () => {
    const d = diag("CUSTO_DE_VIDA");
    renderComQuery(<DetalheDiagnostico diagnostico={{ ...d, detalhes: { ...d.detalhes, parcial: true } }} onFechar={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveTextContent(/parcial/i);
  });

  it("reserva de emergência: meses, meta e liquidez", () => {
    renderComQuery(<DetalheDiagnostico diagnostico={diag("RESERVA_EMERGENCIA")} onFechar={() => {}} />);
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent("6,5");
    expect(dialogo).toHaveTextContent("6 meses");
    expect(dialogo).toHaveTextContent("R$ 155.000");
  });

  it("patrimônio completo: instituições é contagem, não dinheiro", () => {
    renderComQuery(<DetalheDiagnostico diagnostico={diag("PATRIMONIO_COMPLETO")} onFechar={() => {}} />);
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent("R$ 1.635.000");
    expect(dialogo).toHaveTextContent(/3 instituições/);
    expect(dialogo).not.toHaveTextContent("R$ 3");
    expect(dialogo).not.toHaveTextContent("instituicoes");
  });

  it("proteção FGC: lista os conglomerados com o valor descoberto", () => {
    renderComQuery(<DetalheDiagnostico diagnostico={diag("PROTECAO_FGC")} onFechar={() => {}} />);
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByTestId("detalhe-fgc")).toHaveTextContent("R$ 400 mil do seu patrimônio estão acima da cobertura");
    const horizonte = within(dialogo).getByTestId("fgc-cong-horizonte");
    expect(horizonte).toHaveTextContent("Banco Horizonte");
    expect(horizonte).toHaveTextContent("R$ 650.000");
    expect(horizonte).toHaveTextContent("R$ 400.000 sem cobertura");
    expect(within(dialogo).getByTestId("fgc-cong-ipe")).toHaveTextContent("protegido");
  });
});

describe("contrato real · fluxo de conexão do Banco Horizonte", () => {
  it("4 passos → nível 3, 100% visível e Proteção FGC desbloqueada com R$ 400 mil", async () => {
    const user = userEvent.setup();
    renderComQuery(<FluxoConectar clienteId="cli-001" instituicaoId="inst-horizonte" atrasoMs={0} />);
    await user.click(await screen.findByRole("button", { name: "Começar" }));
    await user.click(screen.getByRole("button", { name: "Continuar para o Banco Horizonte" }));
    expect(screen.getByText("Você está no ambiente do Banco Horizonte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar compartilhamento" }));
    expect(await screen.findByText("Banco Horizonte conectado!")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/100% visível/)).toBeInTheDocument());
    expect(screen.getByText("Nível 3: Patrimônio Completo")).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico desbloqueado: Proteção FGC")).toBeInTheDocument();
    expect(screen.getByTestId("detalhe-fgc")).toHaveTextContent(
      "R$ 400 mil do seu patrimônio estão acima da cobertura do FGC no Banco Horizonte",
    );
  });
});
