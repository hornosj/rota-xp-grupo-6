"use client";

import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ErroCarregar, Sobretitulo, Vazio } from "@/components/comum/marcadores";
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

/** "5 notícias mexem com 4 clientes." */
function manchete(itens: ImpactoNoticia[] | undefined) {
  if (!itens) return "Radar de notícias";
  const noticias = new Set(itens.map((i) => i.noticiaId)).size;
  const clientes = new Set(itens.map((i) => i.clienteId)).size;
  if (noticias === 0) return "Nada no radar por enquanto.";
  return `${noticias} ${noticias === 1 ? "notícia mexe" : "notícias mexem"} com ${clientes} ${clientes === 1 ? "cliente" : "clientes"}.`;
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
    <div className="flex flex-col gap-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Sobretitulo>Radar de notícias</Sobretitulo>
          <h1 className="text-5xl leading-none font-extrabold tracking-tight sm:text-[56px]">{manchete(carteira.data)}</h1>
          <p className="text-lg text-muted-foreground">Notícias que mexem na carteira visível dos seus clientes, por impacto.</p>
        </div>
        <div className="flex items-center gap-3">
          {aoVivo && <IndicadorAoVivo atualizando={carteira.isFetching} />}
          <Button variant="outline" onClick={processarAgora} disabled={processar.isPending}>
            <RefreshCw className={cn(processar.isPending && "animate-spin")} /> Processar agora
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Impactos na carteira" className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
          <h2 className="text-3xl font-extrabold tracking-tight">Na carteira</h2>
          {carteira.isError && <ErroCarregar erro={carteira.error} />}
          {!carteira.data && !carteira.isError && <EsqueletoLista />}
          {carteira.data && <ListaImpactos itens={carteira.data} />}
        </section>

        <Card className="min-w-0 flex-[1_1_380px]">
          <CardHeader>
            <CardTitle>Últimas notícias classificadas</CardTitle>
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
    <ol className="border-t-2 border-black">
      {itens.map((i) => (
        <li key={`${i.clienteId}|${i.noticiaId}`} data-testid="impacto" data-direcao={i.direcao} className="border-b py-6">
          <div className="grid gap-x-5 gap-y-4 px-1 sm:grid-cols-[minmax(0,1fr)_9rem] sm:px-2">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link href={`/assessor/clientes/${i.clienteId}`} className="text-xl font-bold hover:underline">
                  {i.clienteNome}
                </Link>
                <BadgeDirecao direcao={i.direcao} />
              </div>
              <p className="text-lg leading-snug font-semibold">{i.titulo}</p>
              <p className="text-sm text-muted-foreground">{i.fonte}</p>
              <p className="text-[17px] leading-relaxed text-[#333]">{i.motivo}</p>
              <Chips itens={i.gatilhos} />
            </div>
            <BarraPontos pontos={i.pontos} className="items-start sm:items-end" />
          </div>
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
        <li key={n.id} data-testid="noticia" className="flex flex-col gap-2 py-5 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base leading-snug font-bold">
              {n.url ? (
                <a href={n.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {n.titulo} <ArrowUpRight className="inline size-4" aria-hidden />
                </a>
              ) : (
                n.titulo
              )}
            </p>
            <BadgeDirecao direcao={c.direcao} />
          </div>
          <p className="text-sm text-muted-foreground">
            {n.fonte}
            {n.publicadaEm && ` · ${dataHora(n.publicadaEm)}`}
          </p>
          {c.resumoImpacto && <p className="text-[15px] leading-relaxed text-[#333]">{c.resumoImpacto}</p>}
          <Chips itens={[...c.emissores.map(rotuloEmissor), ...c.indexadores, ...c.produtos]} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Relevância <span data-testid="relevancia" className="font-bold text-foreground">{pct(c.relevancia)}</span>
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
    <div className="flex flex-col gap-4" aria-label="Carregando">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export { EsqueletoLista as EsqueletoRadar };
