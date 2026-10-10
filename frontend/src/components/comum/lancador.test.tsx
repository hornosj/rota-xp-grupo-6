import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderComQuery } from "@/test/utils";
import { Lancador } from "./lancador";

describe("Lancador", () => {
  it("tem links para o assessor e a visão 360 de cada cliente-âncora, sem palco nem app da cliente", () => {
    renderComQuery(<Lancador />);
    expect(screen.queryByRole("link", { name: /Palco/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cadastrar investidores/ })).toHaveAttribute("href", "/assessor/convites");
    expect(screen.getByRole("link", { name: /Fila Hoje/ })).toHaveAttribute("href", "/assessor/hoje");
    expect(screen.getByRole("link", { name: /Meus clientes/ })).toHaveAttribute("href", "/assessor");
    for (const id of ["cli-001", "cli-002", "cli-003", "cli-004", "cli-005", "cli-006"]) {
      expect(document.querySelector(`a[href="/assessor/clientes/${id}"]`)).not.toBeNull();
      expect(document.querySelector(`a[href="/cliente/${id}"]`)).toBeNull();
    }
  });
});
