import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-base";
import type { DesagioDetalhado } from "@/lib/api-types";
import simulacaoReal from "./fixtures-desagio/simulacao-cli-001-inv-001-03.json";
import { posicoesDesagioMock, simularDesagioMock } from "./desagio";

const antes = (id: string) => posicoesDesagioMock(id, "Cliente", false);
const depois = (id: string) => posicoesDesagioMock(id, "Cliente", true);

describe("deságio no modo mock", () => {
  it("reproduz a simulação real do backend (CDB Banco Ipê 2028, 3% → 13,5% a.a.)", () => {
    const s = simularDesagioMock({ clienteId: "cli-001", posicaoId: "inv-001-03", desagio: 0.03, taxaNova: 0.135 }, antes);
    expect(s).toEqual(simulacaoReal as DesagioDetalhado);
  });

  it("break-even pela fórmula do PLAN §7.11 (D=3%, 12% → 14% a.a. ≈ 1,7 ano)", () => {
    const s = simularDesagioMock({ valorAtual: 100000, taxaAntiga: 0.12, prazoRestanteAnos: 3, desagio: 0.03, taxaNova: 0.14 }, antes);
    expect(s.breakEvenAnos).toBe(1.72);
    expect(s.breakEvenMeses).toBe(21);
    expect(s.compensa).toBe(true);
    expect(s.desagioMaximoQueCompensa).toBe(0.051714);
  });

  it("taxa nova que não supera a atual: nunca recupera e não compensa", () => {
    const s = simularDesagioMock({ clienteId: "cli-001", posicaoId: "inv-001-03", desagio: 0.03, taxaNova: 0.11 }, antes);
    expect(s.breakEvenMeses).toBeUndefined();
    expect(s.compensa).toBe(false);
    expect(s.explicacao).toContain("nunca é recuperada");
  });

  it("a posição do Horizonte só existe depois do consentimento", () => {
    const pedido = { clienteId: "cli-001", posicaoId: "inv-001-06", desagio: 0.02, taxaNova: 0.13 };
    expect(() => simularDesagioMock(pedido, antes)).toThrowError(ApiError);
    expect(simularDesagioMock(pedido, depois).entrada.valorAtual).toBe(650000);
  });

  it("posição inelegível e pedido incompleto dão 400", () => {
    const erro = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return e as ApiError;
      }
      throw new Error("deveria falhar");
    };
    const liquidez = erro(() => simularDesagioMock({ clienteId: "cli-001", posicaoId: "inv-001-04", desagio: 0.03, taxaNova: 0.14 }, antes));
    expect(liquidez.status).toBe(400);
    expect(liquidez.message).toContain("liquidez diária");
    const incompleto = erro(() => simularDesagioMock({ desagio: 0.03, taxaNova: 0.14 }, antes));
    expect(incompleto.status).toBe(400);
    expect(incompleto.message).toContain("valorAtual");
  });

  it("cliente sem fixture aparece sem posições", () => {
    const p = posicoesDesagioMock("cli-101", "Fernanda Ribeiro", false);
    expect(p.posicoes).toEqual([]);
    expect(p.clienteNome).toBe("Fernanda Ribeiro");
  });
});
