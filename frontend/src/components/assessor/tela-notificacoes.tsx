"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { BellOff, Cake, CheckCheck } from "lucide-react";
import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ChipSeveridade, ErroCarregar, Sobretitulo, TagNovo, Vazio } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAoVivo } from "@/lib/ao-vivo";
import { brl, data, dataHora, emDias, mesCurto } from "@/lib/formato";
import {
  JANELA_PROXIMAS_DATAS,
  ehAniversarioHoje,
  lidas as conjuntoLidas,
  marcarLidas,
  marcarNaoLida,
  rotuloCategoria,
  type CategoriaNotificacao,
  type ConjuntoLocal,
  type DataEspecial,
  type Notificacao,
} from "@/lib/notificacoes";
import { useNotificacoes } from "@/lib/queries";
import { rotuloTipoAlerta } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

type Filtro = "TODAS" | "NAO_LIDAS" | CategoriaNotificacao;

const FILTROS: Filtro[] = ["TODAS", "NAO_LIDAS", "RISCO", "OPORTUNIDADE", "OPEN_FINANCE", "DATA_ESPECIAL"];

const rotuloFiltro: Record<Filtro, string> = {
  TODAS: "Todas",
  NAO_LIDAS: "Não lidas",
  ...rotuloCategoria,
};

/** IDs de um conjunto local (ex.: lidas). Provisório até o backend guardar isso. */
export function useConjunto(c: ConjuntoLocal): ReadonlySet<string> {
  const ids = useSyncExternalStore(c.assinar, c.ler, c.noServidor);
  return useMemo(() => new Set(ids), [ids]);
}

export const useLidas = () => useConjunto(conjuntoLidas);

function manchete(naoLidas: number | undefined) {
  if (naoLidas == null) return "Notificações";
  if (naoLidas === 0) return "Tudo em dia.";
  return `${naoLidas} ${naoLidas === 1 ? "notificação não lida." : "notificações não lidas."}`;
}

function BotaoFiltro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "h-11 rounded-full border-2 border-black px-4.5 text-[15px] font-semibold transition",
        ativo ? "bg-black font-bold text-white" : "bg-white hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function TelaNotificacoes() {
  const aoVivo = useAoVivo();
  const q = useNotificacoes({ aoVivo });
  const lidas = useLidas();
  const [filtro, setFiltro] = useState<Filtro>("TODAS");

  const todas = useMemo(() => q.data?.notificacoes ?? [], [q.data]);
  const naoLidas = todas.filter((n) => !lidas.has(n.id));

  const contagem = (f: Filtro) =>
    f === "TODAS" ? todas.length : f === "NAO_LIDAS" ? naoLidas.length : todas.filter((n) => n.categoria === f).length;

  const visiveis = todas.filter((n) =>
    filtro === "TODAS" ? true : filtro === "NAO_LIDAS" ? !lidas.has(n.id) : n.categoria === filtro,
  );
  const pendentes = visiveis.filter((n) => !lidas.has(n.id));
  const jaLidas = visiveis.filter((n) => lidas.has(n.id));

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Sobretitulo>Notificações</Sobretitulo>
          <h1 className="text-5xl leading-none font-extrabold tracking-tight sm:text-[56px]">
            {manchete(q.data ? naoLidas.length : undefined)}
          </h1>
          <p className="text-lg text-muted-foreground">Alertas da carteira e aniversários dos clientes e dependentes.</p>
        </div>
        <div className="flex items-center gap-3">
          {aoVivo && <IndicadorAoVivo atualizando={q.isFetching} />}
          <Button variant="outline" disabled={!naoLidas.length} onClick={() => marcarLidas(naoLidas.map((n) => n.id))}>
            <CheckCheck /> Marcar todas como lidas
          </Button>
        </div>
      </div>

      {q.isError && <ErroCarregar erro={q.error} />}
      {!q.data && !q.isError && <EsqueletoNotificacoes />}

      {q.data && (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-label="Notificações" className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar notificações">
              {FILTROS.map((f) => (
                <BotaoFiltro key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>
                  {rotuloFiltro[f]} · {contagem(f)}
                </BotaoFiltro>
              ))}
            </div>

            {!visiveis.length && (
              <Vazio className="flex flex-col items-center gap-2 py-10">
                <BellOff className="size-6" />
                {filtro === "NAO_LIDAS" ? "Nenhuma notificação não lida." : "Nenhuma notificação aqui."}
              </Vazio>
            )}

            {pendentes.length > 0 && (
              <Secao titulo="Não lidas" quantidade={pendentes.length}>
                {pendentes.map((n) => (
                  <ItemNotificacao key={n.id} n={n} lida={false} />
                ))}
              </Secao>
            )}
            {jaLidas.length > 0 && (
              <Secao titulo="Lidas" quantidade={jaLidas.length}>
                {jaLidas.map((n) => (
                  <ItemNotificacao key={n.id} n={n} lida />
                ))}
              </Secao>
            )}
          </section>

          <ProximasDatas datas={q.data.proximasDatas} />
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, quantidade, children }: { titulo: string; quantidade: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-3xl font-extrabold tracking-tight">
        {titulo} <span className="text-muted-foreground">· {quantidade}</span>
      </h2>
      <ol className="border-t-2 border-black">{children}</ol>
    </section>
  );
}

export function ItemNotificacao({ n, lida }: { n: Notificacao; lida: boolean }) {
  const hoje = ehAniversarioHoje(n);
  const quando =
    n.dataEvento != null ? `${data(n.dataEvento)} · ${emDias(n.emDias ?? 0)}` : `detectado em ${dataHora(n.criadaEm)}`;
  return (
    <li
      data-testid="notificacao"
      data-categoria={n.categoria}
      data-lida={lida}
      className={cn("border-b py-6", !lida && n.novo && "animate-entrada")}
    >
      <div className="grid gap-x-5 gap-y-3 px-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {!lida && <span aria-label="Não lida" className="size-2.5 shrink-0 rounded-full bg-black" />}
            {n.categoria === "DATA_ESPECIAL" ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tracking-wide uppercase ring-2 ring-black",
                  hoje && "bg-black text-white",
                )}
              >
                {n.aniversario && <Cake className="size-3.5" />}
                {hoje ? "Hoje" : n.aniversario ? "Aniversário" : "Data especial"}
              </span>
            ) : (
              <ChipSeveridade severidade={n.severidade} />
            )}
            <span className={cn("text-lg font-bold", lida && "text-muted-foreground")}>{n.titulo}</span>
            {n.novo && !lida && <TagNovo />}
          </div>
          <p className="text-base">
            <Link
              href={`/assessor/clientes/${n.clienteId}`}
              onClick={() => marcarLidas([n.id])}
              className="font-bold hover:underline"
            >
              {n.clienteNome}
            </Link>
            <span className="text-muted-foreground"> · {quando}</span>
          </p>
          <p className={cn("text-[17px] leading-relaxed text-[#333]", lida && "text-muted-foreground")}>{n.descricao}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm text-muted-foreground">
              {n.tipoAlerta ? rotuloTipoAlerta[n.tipoAlerta] : rotuloCategoria[n.categoria]}
            </span>
            <Link
              href={`/assessor/clientes/${n.clienteId}`}
              onClick={() => marcarLidas([n.id])}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Abrir cliente
            </Link>
            <Button variant="ghost" size="sm" onClick={() => (lida ? marcarNaoLida(n.id) : marcarLidas([n.id]))}>
              {lida ? "Marcar como não lida" : "Marcar como lida"}
            </Button>
          </div>
        </div>
        {n.valor != null && (
          <p className={cn("text-2xl font-extrabold tracking-tight sm:text-right", lida && "text-muted-foreground")}>
            {brl(n.valor, { inteiro: true })}
          </p>
        )}
      </div>
    </li>
  );
}

function ProximasDatas({ datas }: { datas: DataEspecial[] }) {
  return (
    <Card className="min-w-0 flex-[1_1_340px]">
      <CardHeader>
        <CardTitle>Próximas datas</CardTitle>
        <p className="text-base text-muted-foreground">
          Aniversários e eventos de vida nos próximos {JANELA_PROXIMAS_DATAS} dias
        </p>
      </CardHeader>
      <CardContent>
        {!datas.length ? (
          <Vazio>Nenhuma data especial no período.</Vazio>
        ) : (
          <ol className="flex flex-col gap-4" data-testid="proximas-datas">
            {datas.map((d) => (
              <li key={d.id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex flex-col items-center rounded-2xl py-1.5 leading-tight",
                    d.emDias <= 7 ? "bg-black text-white" : "border-2 border-black",
                  )}
                >
                  <span className="text-[22px] font-extrabold">{d.data.slice(8, 10)}</span>
                  <span className="text-xs font-bold uppercase">{mesCurto(d.data)}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-bold">{d.titulo}</span>
                  <span className="text-sm text-[#333]">
                    <Link href={`/assessor/clientes/${d.clienteId}`} className="hover:underline">
                      {d.clienteNome}
                    </Link>{" "}
                    · {emDias(d.emDias)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function EsqueletoNotificacoes() {
  return (
    <div className="flex flex-wrap items-start gap-6" aria-label="Carregando">
      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
        <Skeleton className="h-11 w-2/3 rounded-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 min-w-0 flex-[1_1_340px] rounded-2xl" />
    </div>
  );
}
