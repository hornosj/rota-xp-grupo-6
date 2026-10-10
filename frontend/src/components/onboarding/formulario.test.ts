import { describe, expect, it } from "vitest";
import { fixtures } from "@/test/api-fixtures";
import { estadoInicial, idade, mascaraCelular, mascaraCpf, montarCadastro, validarEtapa } from "./formulario";

const ctx = { hoje: "2026-10-11", questionario: fixtures.formularioOnboarding().questionario };

describe("máscaras", () => {
  it("CPF", () => {
    expect(mascaraCpf("123")).toBe("123");
    expect(mascaraCpf("1234567")).toBe("123.456.7");
    expect(mascaraCpf("12345678900")).toBe("123.456.789-00");
    expect(mascaraCpf("123.456.789-001234")).toBe("123.456.789-00");
  });

  it("celular com 8 ou 9 dígitos", () => {
    expect(mascaraCelular("1")).toBe("(1");
    expect(mascaraCelular("119")).toBe("(11) 9");
    expect(mascaraCelular("1133334444")).toBe("(11) 3333-4444");
    expect(mascaraCelular("11988887777")).toBe("(11) 98888-7777");
  });
});

it("idade completa na data de referência", () => {
  expect(idade("1988-10-11", "2026-10-11")).toBe(38);
  expect(idade("1988-10-12", "2026-10-11")).toBe(37);
  expect(idade("2008-10-12", "2026-10-11")).toBe(17);
});

describe("validarEtapa", () => {
  it("dados pessoais", () => {
    const f = estadoInicial("Carla");
    expect(Object.keys(validarEtapa("dados", f, ctx)).sort()).toEqual(["celular", "cpf", "dataNascimento", "email", "nome"]);
    const ok = { ...f, nome: "Carla Mendes", cpf: "123.456.789-00", dataNascimento: "1988-05-20", email: "c@x.com", celular: "(11) 98888-7777" };
    expect(validarEtapa("dados", ok, ctx)).toEqual({});
    expect(validarEtapa("dados", { ...ok, dataNascimento: "2010-01-01" }, ctx).dataNascimento).toMatch(/18 anos/);
  });

  it("família é opcional, mas o que foi adicionado precisa estar completo", () => {
    const f = estadoInicial("Carla");
    expect(validarEtapa("familia", f, ctx)).toEqual({});
    const comPendencias = {
      ...f,
      dependentes: [{ nome: "", parentesco: "", dataNascimento: "2030-01-01" }],
      eventosVida: [{ tipo: "FERIAS" as const, descricao: "Japão", data: "2026-01-01" }],
    };
    expect(Object.keys(validarEtapa("familia", comPendencias, ctx)).sort()).toEqual([
      "dependentes.0.dataNascimento",
      "dependentes.0.nome",
      "dependentes.0.parentesco",
      "eventosVida.0.data",
    ]);
  });

  it("perfil exige todas as perguntas; instituições exigem produto", () => {
    const f = estadoInicial("Carla");
    expect(Object.keys(validarEtapa("perfil", f, ctx))).toHaveLength(5);
    expect(validarEtapa("instituicoes", f, ctx)).toEqual({});
    const semProduto = { ...f, instituicoes: { "inst-ipe": { produtos: [], compartilharAgora: true } } };
    expect(validarEtapa("instituicoes", semProduto, ctx)).toEqual({ "instituicoes.inst-ipe": "Marque ao menos um produto" });
    expect(validarEtapa("revisao", f, ctx).aceiteTermos).toBeDefined();
  });
});

it("montarCadastro gera o corpo do POST /onboarding/{token}", () => {
  const f = {
    ...estadoInicial(" Carla  Mendes "),
    respostas: { objetivo: "c", prazo: "d" },
    instituicoes: { "inst-aurora": { produtos: ["CONTA" as const], compartilharAgora: false } },
    aceiteTermos: true,
  };
  const c = montarCadastro(f);
  expect(c.nome).toBe("Carla  Mendes");
  expect(c.respostasSuitability).toEqual([
    { perguntaId: "objetivo", opcaoId: "c" },
    { perguntaId: "prazo", opcaoId: "d" },
  ]);
  expect(c.instituicoes).toEqual([{ instituicaoId: "inst-aurora", produtos: ["CONTA"], compartilharAgora: false }]);
});
