"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ErroCarregar, Vazio } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImpactoNoticia, NoticiaClassificada, ResultadoProcessamento } from "@/lib/api-types";
import { useAoVivo } from "@/lib/ao-vivo";
import { dataHora, pct } from "@/lib/formato";
import { useNoticiasRadar, useProcessarRadar, useRadarCarteira } from "@/lib/queries";
import { rotuloEmissor } from "@/lib/rotulos";
import { cn } from "@/lib/utils";
import { BadgeDirecao, BadgeOrigem, BarraPontos, Chips } from "./marcadores-radar";

function resumoProcessamento(r: ResultadoProcessamento) {
  const novas = r.novas === 1 ? "1 notícia nova" : `${r.novas} notícias novas`;
  const lotes = r.lotes === 1 ? "1 lote" : `${r.lotes} lotes`;
  return `Radar processado: ${novas} em ${lotes}`;
}

export function TelaRadar() {
  const aoVivo = useAoVivo();
  const carteira = useRadarCarteira(20, { aoVivo });
  const noticias = useNoticiasRadar();
  const processar = useProcessarRadar();

  function processarAgora() {
    processar.mutate(undefined, {
      onSuccess: (r) => toast.success(resumoProcessamento(r)),
      onError: (e) => toast.error(`Não foi possível processar o radar. ${e instanceof Error ? e.message : ""}`.trim()),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Radar de notícias</h1>
          <p className="text-muted-foreground">Notícias que mexem na carteira visível dos seus clientes, por impacto</p>
        </div>
        <div className="flex items-center gap-3">
          {aoVivo && <IndicadorAoVivo atualizando={carteira.isFetching} />}
          <Button variant="outline" onClick={processarAgora} disabled={processar.isPending}>
            <RefreshCw className={cn(processar.isPending && "animate-spin")} /> Processar agora
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Impactos na carteira" className="flex flex-col gap-3">
          {carteira.isError && <ErroCarregar erro={carteira.error} />}
          {!carteira.data && !carteira.isError && <EsqueletoLista />}
          {carteira.data && <ListaImpactos itens={carteira.data} />}
        </section>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-lg">Últimas notícias classificadas</CardTitle>
          </CardHeader>
          <CardContent>
            {noticias.isError && <ErroCarregar erro={noticias.error} />}
            {!noticias.data && !noticias.isError && <EsqueletoLista />}
            {noticias.data && <ListaNoticias noticias={noticias.data} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ListaImpactos({ itens }: { itens: ImpactoNoticia[] }) {
  if (!itens.length) return <Vazio>Nenhuma notícia mexe na carteira agora.</Vazio>;
  return (
    <ol className="flex flex-col gap-3">
      {itens.map((i) => (
        <li
          key={`${i.clienteId}|${i.noticiaId}`}
          data-testid="impacto"
          data-direcao={i.direcao}
          className="rounded-xl border bg-card p-4 shadow-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/assessor/clientes/${i.clienteId}`} className="text-lg font-semibold hover:underline">
              {i.clienteNome}
            </Link>
            <BadgeDirecao direcao={i.direcao} />
          </div>
          <p className="mt-1 font-medium">{i.titulo}</p>
          <p className="text-xs text-muted-foreground">{i.fonte}</p>
          <BarraPontos className="mt-2" pontos={i.pontos} direcao={i.direcao} />
          <p className="mt-2 text-sm">{i.motivo}</p>
          <Chips className="mt-2" itens={i.gatilhos} />
        </li>
      ))}
    </ol>
  );
}

function ListaNoticias({ noticias }: { noticias: NoticiaClassificada[] }) {
  if (!noticias.length) return <Vazio>Nenhuma notícia coletada ainda.</Vazio>;
  return (
    <ul className="flex flex-col divide-y">
      {noticias.map(({ noticia: n, classificacao: c }) => (
        <li key={n.id} data-testid="noticia" className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">
              {n.url ? (
                <a href={n.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {n.titulo} <ExternalLink className="inline size-3 text-muted-foreground" />
                </a>
              ) : (
                n.titulo
              )}
            </p>
            <BadgeDirecao direcao={c.direcao} />
          </div>
          <p className="text-xs text-muted-foreground">
            {n.fonte}
            {n.publicadaEm && ` · ${dataHora(n.publicadaEm)}`}
          </p>
          {c.resumoImpacto && <p className="text-sm text-slate-700">{c.resumoImpacto}</p>}
          <Chips itens={[...c.emissores.map(rotuloEmissor), ...c.indexadores, ...c.produtos]} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Relevância <span data-testid="relevancia" className="font-semibold text-foreground">{pct(c.relevancia)}</span>
            </span>
            <BadgeOrigem origem={c.origem} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EsqueletoLista() {
  return (
    <div className="flex flex-col gap-3" aria-label="Carregando">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export { EsqueletoLista as EsqueletoRadar };
