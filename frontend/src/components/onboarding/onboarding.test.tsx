// Wizard do investidor contra as respostas REAIS do backend (contract/fixtures/onboarding-*.json).
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { apiFixtures, fixtures } from "@/test/api-fixtures";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/test/api-fixtures")).apiFixtures }));

import { WizardOnboarding } from "./wizard-onboarding";

const continuar = () => userEvent.click(screen.getByRole("button", { name: "Continuar" }));

describe("WizardOnboarding", () => {
  it("percorre as etapas, valida e envia o cadastro montado", async () => {
    const espiao = vi.spyOn(apiFixtures, "concluirOnboarding");
    renderComQuery(<WizardOnboarding token="TOKEN-EXEMPLO" />);

    // 0. boas-vindas com o nome do convite
    expect(await screen.findByText("Olá, Carla!")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Começar" }));

    // 1. dados — erros antes de preencher
    expect(screen.getByText("1 de 7")).toBeInTheDocument();
    await continuar();
    expect(screen.getByText("Informe os 11 dígitos do CPF")).toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(screen.getByLabelText("Nome completo"));
    await userEvent.type(screen.getByLabelText("Nome completo"), "Carla Mendes Rocha");
    await userEvent.type(screen.getByLabelText("CPF"), "12345678900");
    expect(screen.getByLabelText("CPF")).toHaveValue("123.456.789-00");
    await userEvent.type(screen.getByLabelText("Data de nascimento"), "1988-05-20");
    await userEvent.type(screen.getByLabelText("E-mail"), "carla@exemplo.com");
    await userEvent.type(screen.getByLabelText("Celular"), "11988887777");
    await continuar();

    // 2. profissão e cidade
    await userEvent.type(screen.getByLabelText("Profissão"), "Engenheira civil");
    await userEvent.type(screen.getByLabelText("Cidade"), "Campinas");
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "SP");
    await continuar();

    // 3. família (opcional): um dependente
    await userEvent.click(screen.getByRole("button", { name: /Adicionar dependente/ }));
    const dep = screen.getByTestId("dependente-0");
    await userEvent.type(within(dep).getByLabelText("Nome"), "Lia");
    await userEvent.selectOptions(within(dep).getByLabelText("Parentesco"), "FILHA");
    await userEvent.type(within(dep).getByLabelText("Nascimento"), "2019-10-14");
    await continuar();

    // 4. perfil: perguntas vindas do backend
    const perguntas = fixtures.formularioOnboarding().questionario;
    await continuar();
    expect(screen.getAllByText("Escolha uma opção")).toHaveLength(perguntas.length);
    for (const p of perguntas) await userEvent.click(screen.getByRole("radio", { name: p.opcoes[2].texto }));
    await continuar();

    // 5. instituições: Aurora (conta) e Ipê (investimentos)
    await userEvent.click(within(screen.getByTestId("instituicao-inst-aurora")).getByRole("checkbox"));
    await continuar();
    expect(screen.getByText("Marque ao menos um produto")).toBeInTheDocument();
    await userEvent.click(within(screen.getByTestId("instituicao-inst-aurora")).getByRole("button", { name: "conta" }));
    await userEvent.click(within(screen.getByTestId("instituicao-inst-ipe")).getByRole("checkbox"));
    await userEvent.click(within(screen.getByTestId("instituicao-inst-ipe")).getByRole("button", { name: "investimentos" }));
    await continuar();

    // 6. compartilhamento: espelha "Meus dados compartilhados"; Ipê fica para depois
    expect(screen.getByText("Plataforma XP · dados próprios")).toBeInTheDocument();
    expect(screen.getByTestId("compartilhar-inst-aurora")).toHaveTextContent("Contas e saldos");
    await userEvent.click(screen.getByRole("switch", { name: "Compartilhar Banco Ipê agora" }));
    expect(screen.getByTestId("compartilhar-inst-ipe")).toHaveTextContent("Conectar depois");
    await continuar();

    // 7. revisão: aceite obrigatório
    expect(screen.getByText("123.456.789-00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
    expect(screen.getByText("É preciso aceitar para concluir")).toBeInTheDocument();
    expect(espiao).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Li e aceito/ }));
    await userEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));

    expect(espiao).toHaveBeenCalledWith("TOKEN-EXEMPLO", {
      nome: "Carla Mendes Rocha",
      cpf: "123.456.789-00",
      dataNascimento: "1988-05-20",
      email: "carla@exemplo.com",
      celular: "(11) 98888-7777",
      profissao: "Engenheira civil",
      cidade: "Campinas",
      uf: "SP",
      dependentes: [{ nome: "Lia", parentesco: "FILHA", dataNascimento: "2019-10-14" }],
      eventosVida: [],
      respostasSuitability: perguntas.map((p) => ({ perguntaId: p.id, opcaoId: p.opcoes[2].id })),
      instituicoes: [
        { instituicaoId: "inst-aurora", produtos: ["CONTA"], compartilharAgora: true },
        { instituicaoId: "inst-ipe", produtos: ["INVESTIMENTOS"], compartilharAgora: false },
      ],
      aceiteTermos: true,
    });

    // tela final com o resultado real do backend
    const fim = await screen.findByTestId("onboarding-concluido");
    expect(within(fim).getByTestId("perfil-resultado")).toHaveTextContent("Arrojado");
    expect(fim).toHaveTextContent("pendente");
    expect(within(fim).queryByRole("link")).not.toBeInTheDocument();
  });

  it("voltar mantém o que foi preenchido", async () => {
    renderComQuery(<WizardOnboarding token="TOKEN-EXEMPLO" />);
    await userEvent.click(await screen.findByRole("button", { name: "Começar" }));
    await userEvent.type(screen.getByLabelText("CPF"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await userEvent.click(screen.getByRole("button", { name: "Começar" }));
    expect(screen.getByLabelText("CPF")).toHaveValue("123");
  });

  it("link inexistente", async () => {
    renderComQuery(<WizardOnboarding token="nao-existe" />);
    expect(await screen.findByText("Link inválido")).toBeInTheDocument();
  });

  it("convite já concluído não reabre o formulário", async () => {
    const concluido = fixtures.resultadoOnboarding().convite;
    vi.spyOn(apiFixtures, "formularioOnboarding").mockResolvedValueOnce({ ...fixtures.formularioOnboarding(), convite: concluido });
    renderComQuery(<WizardOnboarding token="TOKEN-EXEMPLO" />);
    expect(await screen.findByText("Cadastro já concluído")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar" })).not.toBeInTheDocument();
  });
});
