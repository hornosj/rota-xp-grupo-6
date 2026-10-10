import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-base";
import { mockApi } from ".";
import { extrairCampos } from "./edicao";

// Mesmas frases do CopilotoStubTest (backend): o modo mock entende a fala do mesmo jeito.
describe("edição por voz no mock · frases do assessor", () => {
  it("entende cidade, profissão, idade e nome", () => {
    expect(
      extrairCampos(
        "A Juliana se mudou para Campinas/SP e agora é diretora financeira na Embraer. Ela fez 35 anos semana passada. " +
          "O nome completo dela é Juliana Prado Lima.",
      ),
    ).toEqual({
      nome: "Juliana Prado Lima",
      idade: "35",
      profissao: "diretora financeira na Embraer",
      cidade: "Campinas/SP",
      perfil: null,
    });
  });

  it("não confunde campos parecidos e vale o último perfil citado", () => {
    expect(
      extrairCampos(
        "Ela tem 10 anos de carreira. O perfil dela mudou de moderado para arrojado. " +
          "O nome dela agora é Juliana Prado Lima, e ela continua morando aqui.",
      ),
    ).toEqual({ nome: "Juliana Prado Lima", idade: null, profissao: null, cidade: null, perfil: "arrojado" });
  });

  it("vale a última correção e aceita artigo antes da cidade", () => {
    const c = extrairCampos("Ela vai se mudar para Santos. Aliás, ela se mudou para o Rio de Janeiro. Ela passou a ser gerente de projetos.");
    expect(c.cidade).toBe("Rio de Janeiro");
    expect(c.profissao).toBe("gerente de projetos");
  });
});

describe("edição por voz no mock · API", () => {
  it("propõe só o que mudou, com antes e depois, e avisa que o perfil não muda por voz", async () => {
    const p = await mockApi.proporEdicao(
      "cli-004",
      "A Patrícia se mudou para Campinas/SP e agora é consultora educacional. Ela fez 69 anos. O perfil dela agora é moderado.",
    );
    expect(p.alteracoes).toEqual([
      { campo: "IDADE", valorAtual: "68", valorNovo: "69" },
      { campo: "PROFISSAO", valorAtual: "Professora aposentada", valorNovo: "Consultora educacional" },
      { campo: "CIDADE", valorAtual: "Bauru/SP", valorNovo: "Campinas/SP" },
    ]);
    expect(p.avisos).toEqual([
      "O perfil de investidor não muda por voz: para ir de Conservador para Moderado, é preciso refazer o questionário de suitability.",
    ]);
    expect(p.geradoPor).toBe("stub");
  });

  it("editarCliente grava, aparece na 360 e na fila, e o reset volta ao original", async () => {
    const v = await mockApi.editarCliente("cli-004", { nome: "patrícia gomes silva", cidade: "campinas/sp" });
    expect(v.cliente).toMatchObject({ nome: "Patrícia Gomes Silva", cidade: "Campinas/SP", idade: 68 });
    expect((await mockApi.visao360("cli-004")).cliente.cidade).toBe("Campinas/SP");
    expect((await mockApi.fila()).map((i) => i.nome)).toContain("Patrícia Gomes Silva");

    await mockApi.resetDemo();
    expect((await mockApi.visao360("cli-004")).cliente).toMatchObject({ nome: "Patrícia Gomes", cidade: "Bauru/SP" });
  });

  it("valor inválido ou edição vazia é 400 e transcrever é 503 (no mock não há Whisper)", async () => {
    await expect(mockApi.editarCliente("cli-004", { idade: 12 })).rejects.toMatchObject({ status: 400 });
    await expect(mockApi.editarCliente("cli-004", {})).rejects.toBeInstanceOf(ApiError);
    await expect(mockApi.proporEdicao("cli-004", "  ")).rejects.toMatchObject({ status: 400 });
    await expect(mockApi.transcreverAudio("cli-004", new Blob(["x"]), "audio.webm")).rejects.toMatchObject({ status: 503 });
    expect((await mockApi.demoEstado()).transcricao).toEqual({ disponivel: false });
  });
});
