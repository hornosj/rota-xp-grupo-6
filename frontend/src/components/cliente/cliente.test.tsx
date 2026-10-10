import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { AnelCompletude } from "./anel-completude";
import { CardDiagnostico } from "./card-diagnostico";
import { CardMissao } from "./card-missao";
import { ChipNivel } from "./chip-nivel";
import { FluxoConectar } from "./fluxo-conectar";
import { JornadaCliente } from "./jornada-cliente";
import { ListaConsentimentos } from "./lista-consentimentos";
import { MolduraCelular } from "./moldura-celular";

describe("peças da jornada", () => {
  it("anel mostra o percentual visível", () => {
    renderComQuery(<AnelCompletude completude={0.6667} />);
    expect(screen.getByTestId("anel-percentual")).toHaveTextContent("67%");
    expect(screen.getByText("Seu patrimônio: 67% visível")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67");
  });

  it("chip de nível mostra número, nome e como subir", async () => {
    const j = await mockApi.jornada("cli-001");
    renderComQuery(<ChipNivel nivel={j.nivel} />);
    expect(screen.getByText(/Nível 2/)).toBeInTheDocument();
    expect(screen.getByText("Visão Clara")).toBeInTheDocument();
    expect(screen.getByText(/Conecte o Banco Horizonte/)).toBeInTheDocument();
  });

  it("missão disponível tem CTA para conectar; concluída não", async () => {
    const j = await mockApi.jornada("cli-001");
    const { unmount } = renderComQuery(<CardMissao clienteId="cli-001" missao={j.missoes[0]} />);
    expect(screen.getByRole("link", { name: /Conectar/ })).toHaveAttribute("href", "/cliente/cli-001/conectar/inst-horizonte");
    unmount();
    renderComQuery(<CardMissao clienteId="cli-001" missao={{ ...j.missoes[0], status: "CONCLUIDA", progresso: 1 }} />);
    expect(screen.queryByRole("link", { name: /Conectar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Concluída/)).toBeInTheDocument();
  });

  it("diagnóstico bloqueado mostra cadeado e requisito; desbloqueado mostra resumo", async () => {
    const j = await mockApi.jornada("cli-001");
    const fgc = j.diagnosticos.find((d) => d.tipo === "PROTECAO_FGC")!;
    const custo = j.diagnosticos.find((d) => d.tipo === "CUSTO_DE_VIDA")!;
    const onAbrir = vi.fn();
    const { unmount } = renderComQuery(<CardDiagnostico diagnostico={fgc} onAbrir={onAbrir} />);
    const card = screen.getByTestId("diagnostico-PROTECAO_FGC");
    expect(card).toHaveAttribute("data-desbloqueado", "false");
    expect(within(card).getByLabelText("Bloqueado")).toBeInTheDocument();
    expect(card).toHaveTextContent(fgc.requisito);
    unmount();
    renderComQuery(<CardDiagnostico diagnostico={custo} onAbrir={onAbrir} />);
    const c2 = screen.getByTestId("diagnostico-CUSTO_DE_VIDA");
    expect(c2).toHaveAttribute("data-desbloqueado", "true");
    expect(c2).toHaveTextContent("R$ 24 mil por mês");
    await userEvent.click(c2);
    expect(onAbrir).toHaveBeenCalledWith(custo);
  });

  it("moldura de celular renderiza o conteúdo", () => {
    renderComQuery(
      <MolduraCelular>
        <p>conteúdo</p>
      </MolduraCelular>,
    );
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });
});

describe("JornadaCliente (tela /cliente/[id])", () => {
  it("Marina antes: 67%, nível 2, missão Horizonte e FGC bloqueado", async () => {
    renderComQuery(<JornadaCliente clienteId="cli-001" />);
    expect(await screen.findByText(/Olá, Marina/)).toBeInTheDocument();
    expect(await screen.findByTestId("anel-percentual")).toHaveTextContent("67%");
    expect(screen.getByText("Visão Clara")).toBeInTheDocument();
    expect(screen.getByText(/descubra se você está protegida pelo FGC/)).toBeInTheDocument();
    expect(screen.getByTestId("diagnostico-PROTECAO_FGC")).toHaveAttribute("data-desbloqueado", "false");
  });

  it("detalhe do custo de vida lista categorias e reserva", async () => {
    const user = userEvent.setup();
    renderComQuery(<JornadaCliente clienteId="cli-001" />);
    await user.click(await screen.findByTestId("diagnostico-CUSTO_DE_VIDA"));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Financiamento imobiliário");
    expect(dialogo.textContent?.replace(/ /g, " ")).toContain("R$ 6.500");
  });

  it("Juliana: custo de vida bloqueado e missão de cartão", async () => {
    renderComQuery(<JornadaCliente clienteId="cli-003" />);
    expect(await screen.findByTestId("diagnostico-CUSTO_DE_VIDA")).toHaveAttribute("data-desbloqueado", "false");
    expect(screen.getByText(/Conecte seu cartão do Banco Aurora/)).toBeInTheDocument();
  });

  it("cliente inexistente mostra erro sem quebrar", async () => {
    renderComQuery(<JornadaCliente clienteId="cli-999" />);
    expect(await screen.findByText(/Não foi possível carregar/)).toBeInTheDocument();
  });
});

describe("FluxoConectar (4 passos)", () => {
  it("conecta o Banco Horizonte: nível 3 e Proteção FGC com R$ 400 mil", async () => {
    const user = userEvent.setup();
    renderComQuery(<FluxoConectar clienteId="cli-001" instituicaoId="inst-horizonte" atrasoMs={0} />);

    // passo 1
    expect(await screen.findByText(/Passo 1 de 4/)).toBeInTheDocument();
    expect(screen.getByText(/revogar a qualquer momento/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Começar/ }));

    // passo 2: escopos do consentimento pendente + 12 meses
    expect(screen.getByText(/Passo 2 de 4/)).toBeInTheDocument();
    expect(screen.getByText("Investimentos")).toBeInTheDocument();
    expect(screen.getByText(/12 meses/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar para o Banco Horizonte" }));

    // passo 3: ambiente simulado do banco
    expect(screen.getByText(/Passo 3 de 4/)).toBeInTheDocument();
    expect(screen.getByText(/Você está no ambiente do Banco Horizonte/)).toBeInTheDocument();
    expect(screen.getAllByText(/simulação/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Confirmar compartilhamento/ }));

    // passo 4: sucesso
    expect(await screen.findByText(/Passo 4 de 4/)).toBeInTheDocument();
    expect(await screen.findByText(/Diagnóstico desbloqueado: Proteção FGC/)).toBeInTheDocument();
    expect(await screen.findByText(/nível 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Patrimônio Completo/)).toBeInTheDocument();
    expect(screen.getByTestId("detalhe-fgc")).toHaveTextContent(/R\$ 400 mil/);
    expect(screen.getByTestId("detalhe-fgc")).toHaveTextContent(/Sua assessora já foi avisada/);
    expect(screen.getByTestId("confete")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver minha jornada/ })).toHaveAttribute("href", "/cliente/cli-001");

    // o assessor vê a mudança (estado compartilhado do mock)
    const fila = await mockApi.fila();
    expect(fila[0].clienteId).toBe("cli-001");
  });

  it("instituição já conectada mostra aviso", async () => {
    renderComQuery(<FluxoConectar clienteId="cli-001" instituicaoId="inst-aurora" atrasoMs={0} />);
    expect(await screen.findByText(/já está conectad/)).toBeInTheDocument();
  });
});

describe("ListaConsentimentos", () => {
  it("lista com status, revoga um ativo e não oferece revogar o interno", async () => {
    const user = userEvent.setup();
    renderComQuery(<ListaConsentimentos clienteId="cli-001" />);
    const aurora = await screen.findByTestId("consentimento-inst-aurora");
    expect(aurora).toHaveTextContent("Ativo");
    expect(within(screen.getByTestId("consentimento-inst-xp")).queryByRole("button", { name: /Revogar/ })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("consentimento-inst-horizonte")).getByRole("link", { name: /Conectar/ })).toHaveAttribute(
      "href",
      "/cliente/cli-001/conectar/inst-horizonte",
    );
    await user.click(within(aurora).getByRole("button", { name: /Revogar/ }));
    await user.click(await screen.findByRole("button", { name: /Sim, revogar/ }));
    await waitFor(() => expect(screen.getByTestId("consentimento-inst-aurora")).toHaveTextContent("Revogado"));
  });
});
