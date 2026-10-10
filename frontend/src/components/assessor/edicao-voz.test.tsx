import { screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { useVisao360 } from "@/lib/queries";
import { CabecalhoCliente } from "./cabecalho-cliente";
import { BotaoEdicaoVoz, edicaoDe } from "./dialog-edicao-voz";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Só o cabeçalho, ligado à mesma consulta da 360 (a tela inteira pesa demais para a suíte em paralelo). */
function Cabecalho360({ clienteId }: { clienteId: string }) {
  const v = useVisao360(clienteId);
  return v.data ? <CabecalhoCliente visao={v.data} /> : null;
}

const FALA =
  "A Patrícia se mudou para Campinas/SP e agora é consultora educacional. Ela fez 69 anos. O perfil dela agora é moderado.";

describe("Editar cadastro por voz", () => {
  it("sem Whisper no servidor: digita, confere antes → depois, desmarca um campo e aplica só o resto", async () => {
    const user = userEvent.setup();
    const editar = vi.spyOn(mockApi, "editarCliente");
    renderComQuery(<Cabecalho360 clienteId="cli-004" />);

    await user.click(await screen.findByRole("button", { name: /Editar por voz/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText(/não está configurada no servidor/)).toBeInTheDocument();
    await user.click(within(dialogo).getByLabelText("O que mudou"));
    await user.paste(FALA);
    await user.click(within(dialogo).getByRole("button", { name: /Ver alterações/ }));

    expect(await within(dialogo).findAllByRole("checkbox")).toHaveLength(3);
    expect(dialogo).toHaveTextContent("68 anos");
    expect(dialogo).toHaveTextContent("69 anos");
    expect(dialogo).toHaveTextContent("Bauru/SP");
    expect(dialogo).toHaveTextContent("Consultora educacional");
    expect(dialogo).toHaveTextContent(/questionário de suitability/);
    expect(within(dialogo).getByTestId("gerado-por")).toHaveTextContent("stub");

    await user.click(within(dialogo).getByRole("checkbox", { name: /Idade/ }));
    await user.click(within(dialogo).getByRole("button", { name: "Aplicar 2 alterações" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(editar).toHaveBeenCalledWith("cli-004", { profissao: "Consultora educacional", cidade: "Campinas/SP" });
    expect(await screen.findByText("68 anos · Consultora educacional · Campinas/SP")).toBeInTheDocument();
  }, 15_000); // vários cliques e esperas: passa de 5 s com a suíte inteira rodando

  it("sem Whisper no servidor, mas com ditado no navegador: grava pela voz e preenche o que mudou", async () => {
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
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeReconhecimento;
    try {
      const user = userEvent.setup();
      const { cliente } = await mockApi.visao360("cli-004");
      renderComQuery(<BotaoEdicaoVoz cliente={cliente} />);

      await user.click(screen.getByRole("button", { name: /Editar por voz/ }));
      const dialogo = await screen.findByRole("dialog");
      expect(await within(dialogo).findByText(/ditado do navegador/)).toBeInTheDocument();
      expect(dialogo).not.toHaveTextContent(/não está configurada no servidor/);

      await user.click(within(dialogo).getByRole("button", { name: /Gravar áudio/ }));
      const rec = FakeReconhecimento.ultima!;
      expect(rec.lang).toBe("pt-BR");
      act(() => rec.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "Ela fez 69 anos" }], { isFinal: true })] }));
      await user.click(within(dialogo).getByRole("button", { name: /Parar/ }));

      expect(within(dialogo).getByLabelText("O que mudou")).toHaveValue("Ela fez 69 anos");
      await user.click(within(dialogo).getByRole("button", { name: /Ver alterações/ }));
      expect(await within(dialogo).findByRole("checkbox", { name: /Idade/ })).toBeChecked();
    } finally {
      delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    }
  }, 15_000);

  it("fala sem mudança de cadastro, mas com contexto de vida: salva como nota de contexto e sugere produto", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { cliente } = await mockApi.visao360("cli-004");
    renderComQuery(<BotaoEdicaoVoz cliente={cliente} />);

    await user.click(screen.getByRole("button", { name: /Editar por voz/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(await within(dialogo).findByLabelText("O que mudou"));
    await user.paste("A Patrícia bateu o carro.");
    await user.click(within(dialogo).getByRole("button", { name: /Ver alterações/ }));

    expect(await within(dialogo).findByText(/Não encontrei mudança de nome/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: /Salvar como nota de contexto/ }));

    expect(await within(dialogo).findByText("Seguro auto")).toBeInTheDocument();
    const ctx = await mockApi.contextoAssessor("cli-004");
    expect(ctx.anotacoes[0]).toMatchObject({ texto: "A Patrícia bateu o carro.", origem: "TEXTO" });
    expect(within(dialogo).queryByRole("button", { name: /Salvar como nota de contexto/ })).not.toBeInTheDocument();
  }, 15_000);

  it("com Whisper: envia um arquivo de áudio e mostra a transcrição para revisar antes da proposta", async () => {
    vi.spyOn(mockApi, "demoEstado").mockResolvedValue({
      dataReferencia: "2026-10-10",
      modoCopiloto: "mock",
      transcricao: { disponivel: true, modelo: "whisper-1" },
    });
    const transcrever = vi
      .spyOn(mockApi, "transcreverAudio")
      .mockResolvedValue({ texto: "Ela se mudou para Campinas.", modelo: "whisper-1" });
    const user = userEvent.setup();
    const { cliente } = await mockApi.visao360("cli-004");
    renderComQuery(<BotaoEdicaoVoz cliente={cliente} />);

    await user.click(screen.getByRole("button", { name: /Editar por voz/ }));
    const dialogo = await screen.findByRole("dialog");
    // jsdom não tem MediaRecorder: o botão de gravar fica desabilitado e explica o porquê.
    expect(within(dialogo).getByRole("button", { name: "Gravar áudio" })).toBeDisabled();
    expect(dialogo).toHaveTextContent(/Este navegador não grava áudio/);

    const audio = new File([new Uint8Array([1, 2, 3])], "recado.m4a", { type: "audio/mp4" });
    await user.upload(within(dialogo).getByLabelText("Arquivo de áudio"), audio);

    expect(await within(dialogo).findByLabelText("O que mudou")).toHaveValue("Ela se mudou para Campinas.");
    expect(transcrever).toHaveBeenCalledWith("cli-004", audio, "recado.m4a");
    expect(dialogo).toHaveTextContent("Transcrito por whisper-1");

    await user.click(within(dialogo).getByRole("button", { name: /Ver alterações/ }));
    expect(await within(dialogo).findByRole("checkbox", { name: /Cidade/ })).toBeChecked();
  }, 15_000);

  it("erro do Whisper aparece na tela e o assessor pode digitar", async () => {
    vi.spyOn(mockApi, "demoEstado").mockResolvedValue({
      dataReferencia: "2026-10-10",
      modoCopiloto: "mock",
      transcricao: { disponivel: true },
    });
    const user = userEvent.setup();
    const { cliente } = await mockApi.visao360("cli-004");
    renderComQuery(<BotaoEdicaoVoz cliente={cliente} />);

    await user.click(screen.getByRole("button", { name: /Editar por voz/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.upload(within(dialogo).getByLabelText("Arquivo de áudio"), new File(["x"], "a.webm", { type: "audio/webm" }));

    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(/indisponível no modo mock/);
    await user.click(within(dialogo).getByRole("button", { name: /Prefiro digitar/ }));
    expect(within(dialogo).getByLabelText("O que mudou")).toBeInTheDocument();
  }, 15_000);

  it("edicaoDe monta o PATCH só com as alterações marcadas, com a idade como número", () => {
    expect(
      edicaoDe([
        { campo: "IDADE", valorAtual: "68", valorNovo: "69" },
        { campo: "NOME", valorAtual: "Patrícia Gomes", valorNovo: "Patrícia Gomes Silva" },
      ]),
    ).toEqual({ idade: 69, nome: "Patrícia Gomes Silva" });
  });
});
