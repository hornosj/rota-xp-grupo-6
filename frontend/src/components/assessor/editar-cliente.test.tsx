import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { CardContextoAssessor } from "./card-contexto-assessor";
import { DialogEditarCliente } from "./dialog-editar-cliente";

/** Imita o webkitSpeechRecognition do Chrome (jsdom não tem). */
class FakeReconhecimento {
  static ultima: FakeReconhecimento | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => {
    FakeReconhecimento.ultima = this;
  });
  stop = vi.fn(() => this.onend?.());

  falar(transcript: string, isFinal = true) {
    const resultado = Object.assign([{ transcript }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [resultado] });
  }
}

beforeEach(async () => {
  window.localStorage.clear();
  await mockApi.resetDemo();
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  FakeReconhecimento.ultima = null;
});

describe("DialogEditarCliente", () => {
  it("sem suporte a voz: avisa e deixa digitar; salvar mostra o produto recomendado", async () => {
    const user = userEvent.setup();
    renderComQuery(<DialogEditarCliente clienteId="cli-003" nome="Juliana" />);

    await user.click(screen.getByRole("button", { name: /Editar cliente/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Chrome ou Edge/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Gravar áudio/ })).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Nota sobre/), "A Juliana bateu o carro semana passada.");
    await user.click(within(dialog).getByRole("button", { name: /Salvar nota/ }));

    expect(await within(dialog).findByText("Seguro auto")).toBeInTheDocument();
    expect(within(dialog).getByText(/bateu o carro semana passada/, { selector: "[data-testid=motivo]" })).toBeInTheDocument();
    const ctx = await mockApi.contextoAssessor("cli-003");
    expect(ctx.anotacoes[0]).toMatchObject({ texto: "A Juliana bateu o carro semana passada.", origem: "TEXTO" });
  });

  it("grava áudio pelo navegador em pt-BR e salva como AUDIO", async () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeReconhecimento;
    const user = userEvent.setup();
    renderComQuery(<DialogEditarCliente clienteId="cli-003" nome="Juliana" />);
    await user.click(screen.getByRole("button", { name: /Editar cliente/ }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: /Gravar áudio/ }));
    const rec = FakeReconhecimento.ultima!;
    expect(rec.start).toHaveBeenCalled();
    expect(rec.lang).toBe("pt-BR");
    expect(within(dialog).getByText(/Gravando/)).toBeInTheDocument();

    act(() => rec.falar("ela bateu o carro"));
    await user.click(within(dialog).getByRole("button", { name: /Parar/ }));
    expect(rec.stop).toHaveBeenCalled();
    expect(within(dialog).getByLabelText(/Nota sobre/)).toHaveValue("ela bateu o carro");

    await user.click(within(dialog).getByRole("button", { name: /Salvar nota/ }));
    await within(dialog).findByText("Seguro auto");
    expect((await mockApi.contextoAssessor("cli-003")).anotacoes[0].origem).toBe("AUDIO");
  });

  it("usar exemplo preenche uma nota para a demo", async () => {
    const user = userEvent.setup();
    renderComQuery(<DialogEditarCliente clienteId="cli-003" nome="Juliana" />);
    await user.click(screen.getByRole("button", { name: /Editar cliente/ }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: /Usar exemplo/ }));

    expect(within(dialog).getByLabelText(/Nota sobre/)).toHaveValue(
      "Bateu o carro semana passada e está sem seguro. Quer juntar dinheiro para a faculdade do filho.",
    );
  });

  it("nota vazia não é enviada", async () => {
    const user = userEvent.setup();
    renderComQuery(<DialogEditarCliente clienteId="cli-003" nome="Juliana" />);
    await user.click(screen.getByRole("button", { name: /Editar cliente/ }));
    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: /Salvar nota/ })).toBeDisabled();
  });
});

describe("CardContextoAssessor", () => {
  it("vazio orienta a usar Editar cliente", async () => {
    renderComQuery(<CardContextoAssessor clienteId="cli-003" />);
    expect(await screen.findByText(/Nenhuma nota ainda/)).toBeInTheDocument();
  });

  it("mostra produtos sugeridos e notas com a origem", async () => {
    await mockApi.registrarNota("cli-003", "A Juliana bateu o carro semana passada.", "AUDIO");
    renderComQuery(<CardContextoAssessor clienteId="cli-003" />);

    const produtos = await screen.findByTestId("produtos-sugeridos");
    expect(produtos).toHaveTextContent("Seguro auto");
    const nota = screen.getAllByTestId("anotacao")[0];
    expect(nota).toHaveTextContent("A Juliana bateu o carro semana passada.");
    expect(within(nota).getByLabelText("Nota de áudio")).toBeInTheDocument();
    await waitFor(() => expect(nota).toHaveTextContent("10/10/2026"));
  });

  it("momento delicado aparece primeiro com orientação; quem já tem seguro vê revisão", async () => {
    await mockApi.registrarNota("cli-004", "ó a Patrícia bateu o carro e o carro dela tá com seguro", "AUDIO");
    await mockApi.registrarNota("cli-004", "ela perdeu o filho", "AUDIO");
    renderComQuery(<CardContextoAssessor clienteId="cli-004" />);

    const itens = within(await screen.findByTestId("produtos-sugeridos")).getAllByRole("listitem");
    expect(itens[0]).toHaveTextContent("Momento delicado");
    expect(itens[0]).toHaveTextContent(/acolha antes de ofertar/i);
    expect(itens[1]).toHaveTextContent("Revisão do seguro auto");
    expect(within(itens[1]).getByText("Já tem")).toBeInTheDocument();
  });
});
