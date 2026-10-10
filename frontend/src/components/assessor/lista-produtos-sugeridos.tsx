import { ShieldCheck } from "lucide-react";
import type { RecomendacaoProduto } from "@/lib/api-types";

/** Produtos do catálogo sugeridos pelas notas do assessor, com o trecho da nota que justifica. */
export function ListaProdutosSugeridos({ recomendacoes }: { recomendacoes: RecomendacaoProduto[] }) {
  return (
    <ul data-testid="produtos-sugeridos" className="flex flex-col gap-2">
      {recomendacoes.map((r) => (
        <li key={r.necessidade} className="rounded-md border bg-background p-2.5">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4 text-emerald-600" />
            {r.produto}
          </div>
          {r.descricao && <p className="mt-0.5 text-xs text-muted-foreground">{r.descricao}</p>}
          {r.motivo && (
            <p data-testid="motivo" className="mt-1 text-xs text-slate-700">
              Por quê: “{r.motivo}”
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
