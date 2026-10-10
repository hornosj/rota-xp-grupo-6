import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { DirecaoNoticia, OrigemClassificacao } from "@/lib/api-types";
import { numero } from "@/lib/formato";
import { rotuloDirecao, rotuloOrigem } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

// Preto e branco, como os outros marcadores: negativa preenchida de preto, positiva contornada, neutra em cinza.
const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap";

const direcao: Record<DirecaoNoticia, { classe: string; Icone: typeof Minus }> = {
  NEGATIVA: { classe: "bg-black text-white ring-1 ring-black", Icone: ArrowDownRight },
  POSITIVA: { classe: "bg-white text-black ring-1 ring-black", Icone: ArrowUpRight },
  NEUTRA: { classe: "bg-muted text-muted-foreground", Icone: Minus },
};

export function BadgeDirecao({ direcao: d, className }: { direcao: DirecaoNoticia; className?: string }) {
  const { classe, Icone } = direcao[d];
  return (
    <span data-testid="direcao" className={cn(base, classe, className)}>
      <Icone className="size-3.5" aria-hidden /> {rotuloDirecao[d]}
    </span>
  );
}

export function BadgeOrigem({ origem }: { origem: OrigemClassificacao }) {
  return (
    <span data-testid="origem" title="De onde veio a classificação" className={cn(base, "font-semibold ring-1 ring-black")}>
      {rotuloOrigem[origem]}
    </span>
  );
}

/** Pontos 0–100 com a barra embaixo, como a prioridade da fila. */
export function BarraPontos({ pontos, className }: { pontos: number; className?: string }) {
  const largura = Math.max(0, Math.min(100, pontos));
  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      <span className="text-base text-muted-foreground">
        <span data-testid="pontos" className="text-2xl font-extrabold text-foreground">
          {numero(pontos)}
        </span>{" "}
        pts
      </span>
      <span aria-hidden className="h-1.5 w-32 overflow-hidden rounded-full bg-[#e6e6e6]">
        <span
          data-testid="barra-pontos"
          className="block h-full bg-black transition-all duration-700"
          style={{ width: `${largura}%` }}
        />
      </span>
    </div>
  );
}

export function Chips({ itens, className }: { itens: string[]; className?: string }) {
  if (!itens.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {itens.map((g) => (
        <span key={g} className="rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-semibold">
          {g}
        </span>
      ))}
    </div>
  );
}
