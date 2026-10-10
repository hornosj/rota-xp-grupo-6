import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/mocks";
import { renderComQuery } from "@/test/utils";

vi.mock("@/lib/api", async () => ({ api: (await import("@/mocks")).mockApi }));

import { BotaoEdicaoVoz, edicaoDe } from "./dialog-edicao-voz";
import { TelaCliente360 } from "./tela-cliente-360";

afterEach(() => {
  vi.restoreAllMocks();
});

const FALA =
  "A Patrícia se mudou para Campinas/SP e agora é consultora educacional. Ela fez 69 anos. O perfil dela agora é moderado.";

describe("Editar cadastro por voz", () => {
  it("sem Whisper no servidor: digita, confere antes → depois, desmarca um campo e aplica só o resto", async () => {
    const user = userEvent.setup();
    const editar = vi.spyOn(mockApi, "editarCliente");
    renderComQuery(<TelaCliente360 clienteId="cli-004" />);

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
  });

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
  });

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
  });

  it("edicaoDe monta o PATCH só com as alterações marcadas, com a idade como número", () => {
    expect(
      edicaoDe([
        { campo: "IDADE", valorAtual: "68", valorNovo: "69" },
        { campo: "NOME", valorAtual: "Patrícia Gomes", valorNovo: "Patrícia Gomes Silva" },
      ]),
    ).toEqual({ idade: 69, nome: "Patrícia Gomes Silva" });
  });
});
