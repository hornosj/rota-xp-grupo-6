"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { BadgeGeradoPor, ErroCarregar } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "@/lib/api-types";
import { useBriefing } from "@/lib/queries";

export function CardBriefing({ clienteId }: { clienteId: Id }) {
  const [pedido, setPedido] = useState(false);
  const briefing = useBriefing(clienteId, { enabled: pedido });
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Briefing pré-reunião</CardTitle>
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
          <div className="flex flex-col gap-3 text-sm">
            <ul data-testid="briefing-bullets" className="list-disc space-y-1 pl-5">
              {briefing.data.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {briefing.data.perguntasSugeridas.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Perguntas sugeridas</p>
                <ol data-testid="briefing-perguntas" className="list-decimal space-y-1 pl-5">
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
