"use client";

import { useState } from "react";
import { Check, Copy, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { BadgeGeradoPor, ErroCarregar, Vazio } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id, ImpactoNoticia } from "@/lib/api-types";
import { useMotivoNoticia, useRadarCliente } from "@/lib/queries";
import { BadgeDirecao, BarraPontos, Chips } from "./marcadores-radar";

export function CardRadarCliente({ clienteId, aoVivo }: { clienteId: Id; aoVivo?: boolean }) {
  const radar = useRadarCliente(clienteId, { aoVivo });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notícias que mexem na carteira</CardTitle>
      </CardHeader>
      <CardContent>
        {radar.isError && <ErroCarregar erro={radar.error} />}
        {!radar.data && !radar.isError && (
          <div className="flex flex-col gap-2" aria-label="Carregando notícias">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {radar.data && radar.data.length === 0 && <Vazio>Nenhuma notícia relevante para a carteira visível.</Vazio>}
        {radar.data && radar.data.length > 0 && (
          <ul className="flex flex-col gap-3">
            {radar.data.map((i) => (
              <ItemImpacto key={i.noticiaId} impacto={i} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ItemImpacto({ impacto: i }: { impacto: ImpactoNoticia }) {
  const motivo = useMotivoNoticia();
  const [copiado, setCopiado] = useState(false);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Motivo copiado");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <li data-testid="impacto-cliente" data-direcao={i.direcao} className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{i.titulo}</p>
          <p className="text-xs text-muted-foreground">{i.fonte}</p>
        </div>
        <BadgeDirecao direcao={i.direcao} />
      </div>
      <BarraPontos className="mt-2" pontos={i.pontos} direcao={i.direcao} />
      <p className="mt-1 text-sm">{i.motivo}</p>
      <Chips className="mt-2" itens={i.gatilhos} />

      {!motivo.data && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={motivo.isPending}
          onClick={() => motivo.mutate({ clienteId: i.clienteId, noticiaId: i.noticiaId })}
        >
          <PhoneCall /> Por que ligar?
        </Button>
      )}
      {motivo.isPending && (
        <div className="mt-3 flex flex-col gap-2" aria-label="Gerando motivo">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}
      {motivo.isError && (
        <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm">
          Não foi possível gerar o motivo. {motivo.error instanceof Error ? motivo.error.message : ""}
        </p>
      )}
      {motivo.data && (
        <div className="mt-3 flex flex-col gap-2">
          <p data-testid="texto-motivo" className="rounded-lg border bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {motivo.data.texto}
          </p>
          <div className="flex items-center justify-between gap-2">
            <BadgeGeradoPor geradoPor={motivo.data.geradoPor} />
            <Button variant="ghost" size="sm" onClick={() => copiar(motivo.data.texto)}>
              {copiado ? <Check /> : <Copy />} Copiar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
