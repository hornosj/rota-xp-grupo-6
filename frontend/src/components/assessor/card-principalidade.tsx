"use client";

import { BadgePosicaoXp } from "@/components/comum/marcadores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Principalidade } from "@/lib/api-types";
import { numero, pct } from "@/lib/formato";
import { componentes } from "@/lib/rotulos";

const larg = (pontos: number) => `${Math.round(Math.max(0, Math.min(100, pontos)) * 100) / 100}%`;

/** Barra preta da nota, dividida por componente; os pontos de cada componente vêm escritos embaixo. */
export function CardPrincipalidade({ principalidade }: { principalidade: Principalidade }) {
  const scores = [...principalidade.scores].sort((a, b) => b.score - a.score);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Principalidade</CardTitle>
          <BadgePosicaoXp posicao={principalidade.posicaoXp} />
        </div>
        <CardDescription className="text-[17px] leading-relaxed text-[#333]">{principalidade.explicacao}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {scores.map((s) => {
          const presentes = componentes.filter((c) => (s.contribuicoes[c.chave] ?? 0) > 0);
          return (
            <div key={s.instituicaoId} className="flex flex-col gap-2.5 border-t py-5 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="text-lg font-bold">{s.nome}</span>
                  {s.instituicaoId === principalidade.instituicaoPrincipalId && (
                    <span className="rounded-md bg-black px-2 py-0.5 text-xs font-extrabold tracking-wide text-white uppercase">
                      principal
                    </span>
                  )}
                </span>
                <span data-testid={`score-${s.instituicaoId}`} className="text-3xl font-extrabold">
                  {numero(s.score)}
                  <span className="ml-0.5 text-base font-normal text-muted-foreground">/100</span>
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#e6e6e6]">
                {presentes.map((c) => (
                  <Tooltip key={c.chave}>
                    <TooltipTrigger
                      render={<div />}
                      data-testid={`seg-${s.instituicaoId}-${c.chave}`}
                      className="h-full border-r-2 border-white bg-black transition-all duration-700 last:border-r-0"
                      style={{ width: larg(s.contribuicoes[c.chave]) }}
                    />
                    <TooltipContent>
                      {c.rotulo}: {pct(s.participacoes[c.chave])} de participação · {numero(s.contribuicoes[c.chave])} pts
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              {presentes.length > 0 && (
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                  {presentes.map((c) => (
                    <span key={c.chave}>
                      {c.rotulo} <span className="font-extrabold">{numero(s.contribuicoes[c.chave])}</span>
                    </span>
                  ))}
                </p>
              )}
              {s.destaques.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {s.destaques.map((d) => (
                    <li key={d} className="rounded-full border border-[#bdbdbd] px-2.5 py-0.5 text-sm">
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
