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
        <CardTitle>Notícias que mexem na carteira</CardTitle>
      </CardHeader>
      <CardContent>
        {radar.isError && <ErroCarregar erro={radar.error} />}
        {!radar.data && !radar.isError && (
          <div className="flex flex-col gap-3" aria-label="Carregando notícias">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
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
    <li data-testid="impacto-cliente" data-direcao={i.direcao} className="flex flex-col gap-3 rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
          <BadgeDirecao direcao={i.direcao} className="self-start" />
          <p className="text-lg leading-snug font-bold">{i.titulo}</p>
          <p className="text-sm text-muted-foreground">{i.fonte}</p>
        </div>
        <BarraPontos pontos={i.pontos} />
      </div>
      <p className="text-base leading-relaxed text-[#333]">{i.motivo}</p>
      <Chips itens={i.gatilhos} />

      {!motivo.data && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={motivo.isPending}
          onClick={() => motivo.mutate({ clienteId: i.clienteId, noticiaId: i.noticiaId })}
        >
          <PhoneCall /> Por que ligar?
        </Button>
      )}
      {motivo.isPending && (
        <div className="flex flex-col gap-2" aria-label="Gerando motivo">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}
      {motivo.isError && (
        <p className="rounded-2xl border-2 border-black p-4 text-base">
          Não foi possível gerar o motivo. {motivo.error instanceof Error ? motivo.error.message : ""}
        </p>
      )}
      {motivo.data && (
        <div className="flex flex-col gap-2">
          <p data-testid="texto-motivo" className="rounded-2xl bg-muted p-4 text-base leading-relaxed whitespace-pre-wrap">
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
