// Reescopo: o sistema é só do assessor. O cliente só aparece no convite (/convite/[token]).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : [p];
  });
}

describe("rotas e limpeza do reescopo", () => {
  it("não existem mais as telas e componentes do app do cliente nem a jornada", () => {
    for (const p of ["app/cliente", "components/cliente", "mocks/jornada.ts"]) {
      expect(existsSync(join(SRC, p)), p).toBe(false);
    }
    const fixtures = readdirSync(join(SRC, "mocks/fixtures-contrato"));
    expect(fixtures.filter((f) => f.startsWith("jornada"))).toEqual([]);
  });

  it("existem as rotas do assessor, do palco e do convite", () => {
    for (const p of [
      "app/page.tsx",
      "app/palco/page.tsx",
      "app/assessor/page.tsx",
      "app/assessor/hoje/page.tsx",
      "app/assessor/radar/page.tsx",
      "app/assessor/clientes/[id]/page.tsx",
      "app/convite/[token]/page.tsx",
    ]) {
      expect(existsSync(join(SRC, p)), p).toBe(true);
    }
  });

  it("nenhum código referencia jornada, missões, diagnósticos, níveis ou o app do cliente", () => {
    const proibidos = [/useJornada/, /components\/cliente/, /\bJornada\b/, /\bMissao\b/, /\bDiagnostico\b/, /NivelJornada/, /["'`]\/cliente\//];
    const fontes = arquivos(SRC).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("api-types.gen.ts") && !f.endsWith("rotas.test.ts"),
    );
    const achados = fontes.flatMap((f) => {
      const txt = readFileSync(f, "utf8");
      return proibidos.filter((re) => re.test(txt)).map((re) => `${f.slice(SRC.length + 1)} ${re}`);
    });
    expect(achados).toEqual([]);
  });
});
