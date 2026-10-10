import type { DirecaoNoticia, OrigemClassificacao } from "@/lib/api-types";
import { numero } from "@/lib/formato";
import { rotuloDirecao, rotuloOrigem } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/** Vermelho só para notícia NEGATIVA; verde para POSITIVA. */
const corDirecao: Record<DirecaoNoticia, { chip: string; barra: string }> = {
  NEGATIVA: { chip: "bg-red-600 text-white", barra: "bg-red-600" },
  POSITIVA: { chip: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200", barra: "bg-emerald-600" },
  NEUTRA: { chip: "bg-slate-100 text-slate-700", barra: "bg-slate-500" },
};

export function BadgeDirecao({ direcao }: { direcao: DirecaoNoticia }) {
  return (
    <span data-testid="direcao" className={cn(base, corDirecao[direcao].chip)}>
      {rotuloDirecao[direcao]}
    </span>
  );
}

const corOrigem: Record<OrigemClassificacao, string> = {
  REFERENCIA: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  REGRAS: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  LLM: "bg-violet-100 text-violet-800 ring-1 ring-violet-200",
};

export function BadgeOrigem({ origem }: { origem: OrigemClassificacao }) {
  return (
    <span data-testid="origem" title="De onde veio a classificação" className={cn(base, corOrigem[origem])}>
      {rotuloOrigem[origem]}
    </span>
  );
}

/** Barra 0–100 com o número ao lado. */
export function BarraPontos({ pontos, direcao, className }: { pontos: number; direcao: DirecaoNoticia; className?: string }) {
  const largura = Math.max(0, Math.min(100, pontos));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          data-testid="barra-pontos"
          className={cn("h-full rounded-full transition-all duration-700", corDirecao[direcao].barra)}
          style={{ width: `${largura}%` }}
        />
      </div>
      <span className="w-16 text-right text-sm text-muted-foreground">
        <span data-testid="pontos" className="text-lg font-bold text-foreground tabular-nums">
          {numero(pontos)}
        </span>{" "}
        pts
      </span>
    </div>
  );
}

export function Chips({ itens, className }: { itens: string[]; className?: string }) {
  if (!itens.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {itens.map((g) => (
        <span key={g} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {g}
        </span>
      ))}
    </div>
  );
}
