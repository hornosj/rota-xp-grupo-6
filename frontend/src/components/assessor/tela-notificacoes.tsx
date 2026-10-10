"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  BellOff,
  Cake,
  CalendarHeart,
  CheckCheck,
  CircleDot,
  Link2,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ChipSeveridade, ErroCarregar, TagNovo, Vazio } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAoVivo } from "@/lib/ao-vivo";
import { brl, data, dataHora, emDias } from "@/lib/formato";
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

const estiloCategoria: Record<CategoriaNotificacao, { icone: LucideIcon; cor: string }> = {
  RISCO: { icone: ShieldAlert, cor: "bg-amber-100 text-amber-700" },
  OPORTUNIDADE: { icone: TrendingUp, cor: "bg-emerald-100 text-emerald-700" },
  OPEN_FINANCE: { icone: Link2, cor: "bg-sky-100 text-sky-700" },
  DATA_ESPECIAL: { icone: CalendarHeart, cor: "bg-violet-100 text-violet-700" },
};

/** IDs de um conjunto local (ex.: lidas). Provisório até o backend guardar isso. */
export function useConjunto(c: ConjuntoLocal): ReadonlySet<string> {
  const ids = useSyncExternalStore(c.assinar, c.ler, c.noServidor);
  return useMemo(() => new Set(ids), [ids]);
}

export const useLidas = () => useConjunto(conjuntoLidas);

function iconeDe(n: Notificacao): { icone: LucideIcon; cor: string } {
  if (n.categoria === "DATA_ESPECIAL" && n.aniversario) return { icone: Cake, cor: "bg-violet-100 text-violet-700" };
  if (n.categoria === "RISCO" && n.severidade === "ALTA") return { icone: ShieldAlert, cor: "bg-red-600 text-white" };
  return estiloCategoria[n.categoria];
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">
            Alertas da carteira e datas especiais dos clientes
            {q.data && ` · ${naoLidas.length} não lida${naoLidas.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {aoVivo && <IndicadorAoVivo atualizando={q.isFetching} />}
          <Button
            variant="outline"
            disabled={!naoLidas.length}
            onClick={() => marcarLidas(naoLidas.map((n) => n.id))}
          >
            <CheckCheck /> Marcar todas como lidas
          </Button>
        </div>
      </div>

      {q.isError && <ErroCarregar erro={q.error} />}
      {!q.data && !q.isError && <EsqueletoNotificacoes />}

      {q.data && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar notificações">
              {FILTROS.map((f) => {
                const ativo = filtro === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltro(f)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                      ativo ? "border-slate-900 bg-slate-900 text-white" : "bg-white text-slate-600 hover:border-slate-400",
                    )}
                  >
                    {rotuloFiltro[f]}
                    <span className={cn("tabular-nums text-xs", ativo ? "text-slate-300" : "text-slate-400")}>
                      {contagem(f)}
                    </span>
                  </button>
                );
              })}
            </div>

            {!visiveis.length && (
              <Vazio className="flex flex-col items-center gap-2 bg-white py-10">
                <BellOff className="size-6 text-slate-300" />
                {filtro === "NAO_LIDAS" ? "Tudo em dia: nenhuma notificação não lida." : "Nenhuma notificação aqui."}
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
          </div>

          <ProximasDatas datas={q.data.proximasDatas} />
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, quantidade, children }: { titulo: string; quantidade: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-500">
        {titulo} <span className="font-normal tabular-nums">· {quantidade}</span>
      </h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

export function ItemNotificacao({ n, lida }: { n: Notificacao; lida: boolean }) {
  const { icone: Icone, cor } = iconeDe(n);
  const festa = ehAniversarioHoje(n);
  const quando =
    n.dataEvento != null
      ? `${data(n.dataEvento)} · ${emDias(n.emDias ?? 0)}`
      : `detectado em ${dataHora(n.criadaEm)}`;
  return (
    <li
      data-testid="notificacao"
      data-categoria={n.categoria}
      data-lida={lida}
      className={cn(
        "rounded-xl border bg-card p-4 shadow-xs transition-colors",
        !lida && n.severidade === "ALTA" && !festa && "border-red-300",
        !lida && festa && "border-violet-300 bg-linear-to-r from-violet-50 to-pink-50 ring-2 ring-violet-100",
        !lida && n.novo && "animate-entrada border-blue-300 ring-2 ring-blue-100",
        lida && "bg-slate-50/60 shadow-none",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", cor, lida && "opacity-60")}>
          <Icone className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {!lida && <CircleDot className="size-3 text-blue-600" aria-label="Não lida" />}
            <span className={cn("font-semibold", lida && "font-medium text-slate-600")}>{n.titulo}</span>
            {n.novo && !lida && <TagNovo />}
          </div>
          <p className="mt-0.5 text-sm">
            <Link
              href={`/assessor/clientes/${n.clienteId}`}
              onClick={() => marcarLidas([n.id])}
              className="font-medium text-slate-900 hover:underline"
            >
              {n.clienteNome}
            </Link>
            <span className="text-muted-foreground"> · {quando}</span>
          </p>
          <p className={cn("mt-1.5 text-sm text-slate-700", lida && "text-slate-500")}>{n.descricao}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {n.categoria !== "DATA_ESPECIAL" && <ChipSeveridade severidade={n.severidade} />}
            <span className="text-xs text-muted-foreground">
              {n.tipoAlerta ? rotuloTipoAlerta[n.tipoAlerta] : rotuloCategoria[n.categoria]}
            </span>
            <span className="ml-auto flex gap-1">
              <Link
                href={`/assessor/clientes/${n.clienteId}`}
                onClick={() => marcarLidas([n.id])}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Abrir cliente
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (lida ? marcarNaoLida(n.id) : marcarLidas([n.id]))}
              >
                {lida ? "Marcar como não lida" : "Marcar como lida"}
              </Button>
            </span>
          </div>
        </div>
        {n.valor != null && (
          <div className={cn("shrink-0 text-right text-lg font-bold tabular-nums", lida && "text-slate-500")}>
            {brl(n.valor, { inteiro: true })}
          </div>
        )}
      </div>
    </li>
  );
}

function ProximasDatas({ datas }: { datas: DataEspecial[] }) {
  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Próximas datas</CardTitle>
        <CardDescription>Aniversários e eventos de vida nos próximos {JANELA_PROXIMAS_DATAS} dias</CardDescription>
      </CardHeader>
      <CardContent>
        {!datas.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma data especial no período.</p>
        ) : (
          <ol className="flex flex-col gap-3" data-testid="proximas-datas">
            {datas.map((d) => {
              const Icone = d.aniversario ? Cake : CalendarHeart;
              const [, mes, dia] = d.data.split("-");
              return (
                <li key={d.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex w-11 shrink-0 flex-col items-center rounded-lg py-1 leading-tight",
                      d.emDias <= 7 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700",
                    )}
                  >
                    <span className="text-base font-bold tabular-nums">{dia}</span>
                    <span className="text-[10px] uppercase tracking-wide">{nomeMes(Number(mes))}</span>
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="flex items-center gap-1 font-medium">
                      <Icone className="size-3.5 shrink-0 text-violet-600" />
                      <span className="truncate">{d.titulo}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Link href={`/assessor/clientes/${d.clienteId}`} className="hover:underline">
                        {d.clienteNome}
                      </Link>{" "}
                      · {emDias(d.emDias)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const nomeMes = (m: number) => MESES[m - 1] ?? "";

export function EsqueletoNotificacoes() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" aria-label="Carregando">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-2/3 rounded-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
