"use client";

import { BadgePosicaoXp } from "@/components/comum/marcadores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Principalidade } from "@/lib/api-types";
import { numero, pct } from "@/lib/formato";
import { componentes } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

const larg = (pontos: number) => `${Math.round(Math.max(0, Math.min(100, pontos)) * 100) / 100}%`;

export function CardPrincipalidade({ principalidade }: { principalidade: Principalidade }) {
  const scores = [...principalidade.scores].sort((a, b) => b.score - a.score);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Principalidade</CardTitle>
          <BadgePosicaoXp posicao={principalidade.posicaoXp} className="text-sm" />
        </div>
        <CardDescription className="text-base text-foreground">{principalidade.explicacao}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {scores.map((s) => (
          <div key={s.instituicaoId}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className={cn("font-medium", s.ehXp && "text-slate-900")}>
                {s.nome}
                {s.instituicaoId === principalidade.instituicaoPrincipalId && (
                  <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">
                    principal
                  </span>
                )}
              </span>
              <span data-testid={`score-${s.instituicaoId}`} className="text-xl font-bold tabular-nums">
                {numero(s.score)}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-md bg-slate-100">
              {componentes
                .filter((c) => (s.contribuicoes[c.chave] ?? 0) > 0)
                .map((c) => (
                  <Tooltip key={c.chave}>
                    <TooltipTrigger
                      render={<div />}
                      data-testid={`seg-${s.instituicaoId}-${c.chave}`}
                      className="h-full border-r border-white/60 transition-all duration-700 last:border-r-0"
                      style={{ width: larg(s.contribuicoes[c.chave]), backgroundColor: c.cor }}
                    />
                    <TooltipContent>
                      {c.rotulo}: {pct(s.participacoes[c.chave])} de participação · {numero(s.contribuicoes[c.chave])} pts
                    </TooltipContent>
                  </Tooltip>
                ))}
            </div>
            {s.destaques.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {s.destaques.map((d) => (
                  <span key={d} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-3">
          {componentes.map((c) => (
            <span key={c.chave} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: c.cor }} />
              {c.rotulo}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
