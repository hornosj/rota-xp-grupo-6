"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { BadgeGeradoPor, ErroCarregar, Sobretitulo } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "@/lib/api-types";
import { useBriefing } from "@/lib/queries";

export function CardBriefing({ clienteId }: { clienteId: Id }) {
  const [pedido, setPedido] = useState(false);
  const briefing = useBriefing(clienteId, { enabled: pedido });
  return (
    <Card id="briefing" className="scroll-mt-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Briefing pré-reunião</CardTitle>
          {briefing.data && <BadgeGeradoPor geradoPor={briefing.data.geradoPor} />}
        </div>
      </CardHeader>
      <CardContent>
        {!pedido && (
          <Button variant="outline" onClick={() => setPedido(true)}>
            <NotebookPen /> Gerar briefing
          </Button>
        )}
        {pedido && briefing.isPending && (
          <div className="flex flex-col gap-2" aria-label="Gerando briefing">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}
        {briefing.isError && <ErroCarregar erro={briefing.error} />}
        {briefing.data && (
          <div className="flex flex-col gap-4 text-base leading-relaxed">
            <ul data-testid="briefing-bullets" className="list-disc space-y-1.5 pl-5 marker:text-black">
              {briefing.data.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {briefing.data.perguntasSugeridas.length > 0 && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <Sobretitulo className="text-[13px]">Perguntas sugeridas</Sobretitulo>
                <ol data-testid="briefing-perguntas" className="list-decimal space-y-1.5 pl-5 marker:font-bold">
                  {briefing.data.perguntasSugeridas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
