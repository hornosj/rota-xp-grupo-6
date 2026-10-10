import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderComQuery } from "@/test/utils";
import { Lancador } from "./lancador";

describe("Lancador", () => {
  it("tem links para palco, assessor e cada cliente-âncora", () => {
    renderComQuery(<Lancador />);
    expect(screen.getByRole("link", { name: /Palco/ })).toHaveAttribute("href", "/palco");
    expect(screen.getByRole("link", { name: /Fila Hoje/ })).toHaveAttribute("href", "/assessor/hoje");
    expect(screen.getByRole("link", { name: /Painel da carteira/ })).toHaveAttribute("href", "/assessor");
    for (const id of ["cli-001", "cli-002", "cli-003", "cli-004", "cli-005", "cli-006"]) {
      expect(document.querySelector(`a[href="/assessor/clientes/${id}"]`)).not.toBeNull();
      expect(document.querySelector(`a[href="/cliente/${id}"]`)).not.toBeNull();
    }
  });
});
