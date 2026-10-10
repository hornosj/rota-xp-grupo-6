import { describe, expect, it } from "vitest";
import { brl, brlCurto, data, diasAte, emDias, pct, primeiroNome, proximoAniversario } from "./formato";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("formato", () => {
  it("brl formata reais em pt-BR", () => {
    expect(nbsp(brl(61000))).toBe("R$ 61.000,00");
    expect(nbsp(brl(1234.5, { inteiro: true }))).toBe("R$ 1.235");
    expect(brl(undefined)).toBe("—");
  });
  it("brlCurto abrevia mil e mi", () => {
    expect(brlCurto(400000)).toBe("R$ 400 mil");
    expect(brlCurto(61000)).toBe("R$ 61 mil");
    expect(brlCurto(1635000)).toBe("R$ 1,6 mi");
  });
  it("pct converte fração em percentual", () => {
    expect(nbsp(pct(0.6667))).toBe("67%");
    expect(nbsp(pct(0.245, 1))).toBe("24,5%");
    expect(pct(null)).toBe("—");
  });
  it("data formata ISO sem deslocar o dia por fuso", () => {
    expect(data("2014-10-16")).toBe("16/10/2014");
    expect(data(undefined)).toBe("—");
  });
  it("diasAte conta dias a partir da referência", () => {
    expect(diasAte("2026-10-16", "2026-10-11")).toBe(5);
    expect(diasAte("2026-10-11", "2026-10-11")).toBe(0);
    expect(diasAte("2026-10-01", "2026-10-11")).toBe(-10);
  });
  it("proximoAniversario e emDias", () => {
    expect(proximoAniversario("2014-10-16", "2026-10-11")).toBe("2026-10-16");
    expect(proximoAniversario("2017-03-02", "2026-10-11")).toBe("2027-03-02");
    expect(emDias(5)).toBe("em 5 dias");
    expect(emDias(0)).toBe("hoje");
  });
  it("primeiroNome remove tratamento", () => {
    expect(primeiroNome("Dra. Marina Costa")).toBe("Marina");
    expect(primeiroNome("Carlos Andrade")).toBe("Carlos");
  });
});
