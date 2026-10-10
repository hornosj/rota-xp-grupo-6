import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { TelaConvites } from "./tela-convites";

describe("TelaConvites (Cadastrar investidores)", () => {
  it("gera o link pelo nome e acompanha o status do investidor", async () => {
    renderComQuery(<TelaConvites />);
    expect(await screen.findByText(/Nenhum convite ainda/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Gerar link de cadastro/ }));
    expect(screen.getByText("Informe o nome do investidor")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nome do investidor"), "Carla Mendes");
    await userEvent.click(screen.getByRole("button", { name: /Gerar link de cadastro/ }));

    const linha = await screen.findByTestId("convite-conv-001");
    expect(linha).toHaveTextContent("Carla Mendes");
    expect(linha).toHaveTextContent("Link gerado");
    expect(screen.getByLabelText("Nome do investidor")).toHaveValue("");
    const abrir = within(linha).getByRole("link", { name: "Abrir cadastro de Carla Mendes" });
    const token = abrir.getAttribute("href")!.replace("/onboarding/", "");
    expect(abrir).toHaveAttribute("target", "_blank");

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await userEvent.click(within(linha).getByRole("button", { name: "Copiar link de cadastro de Carla Mendes" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/onboarding/${token}`);

    // o investidor abre o link (outro dispositivo) → polling mostra "Em preenchimento"
    await mockApi.formularioOnboarding(token);
    await waitFor(() => expect(screen.getByTestId("convite-conv-001")).toHaveTextContent("Em preenchimento"), {
      timeout: 5000,
    });
  });

  it("convite concluído mostra o perfil e leva à visão 360", async () => {
    const c = await mockApi.criarConvite("Bruno Lima");
    await mockApi.concluirOnboarding(c.token, {
      nome: "Bruno Lima",
      cpf: "111.222.333-44",
      dataNascimento: "1980-01-01",
      email: "b@x.com",
      celular: "11999990000",
      profissao: "Advogado",
      cidade: "Santos",
      uf: "SP",
      dependentes: [],
      eventosVida: [],
      respostasSuitability: ["objetivo", "prazo", "queda", "experiencia", "reserva"].map((perguntaId) => ({ perguntaId, opcaoId: "a" })),
      instituicoes: [],
      aceiteTermos: true,
    });
    renderComQuery(<TelaConvites />);
    const linha = await screen.findByTestId("convite-conv-001");
    expect(linha).toHaveTextContent("Cadastro concluído");
    expect(linha).toHaveTextContent("Conservador");
    expect(within(linha).getByRole("link", { name: "Ver visão 360" })).toHaveAttribute("href", "/assessor/clientes/cli-201");
  });
});
