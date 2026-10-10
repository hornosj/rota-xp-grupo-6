"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BadgePosicaoXp, ErroCarregar, Sobretitulo } from "@/components/comum/marcadores";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ItemFila, PainelCarteira, PosicaoXp } from "@/lib/api-types";
import { useAoVivo } from "@/lib/ao-vivo";
import { brlCurto, numero, pct } from "@/lib/formato";
import { useFila, usePainel } from "@/lib/queries";
import { rotuloPosicaoXp } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

const ORDEM: PosicaoXp[] = ["PRINCIPAL", "SECUNDARIA", "SO_INVESTIMENTOS", "AUSENTE"];

/** Tons de cinza com luminosidades bem distintas (preto = XP principal). */
const TOM: Record<PosicaoXp, string> = {
  PRINCIPAL: "bg-black",
  SECUNDARIA: "bg-[#6b6b6b]",
  SO_INVESTIMENTOS: "bg-[#cfcfcf]",
  AUSENTE: "border-[1.5px] border-dashed border-black",
};

function Kpi({ rotulo, valor, testId, escuro }: { rotulo: string; valor: string; testId?: string; escuro?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-3xl p-6", escuro ? "bg-black text-white" : "border")}>
      <p className={cn("text-base", escuro ? "text-white/85" : "text-muted-foreground")}>{rotulo}</p>
      <p data-testid={testId} className="text-4xl font-extrabold">
        {valor}
      </p>
    </div>
  );
}

function PosicaoXpCarteira({ p }: { p: PainelCarteira }) {
  const total = ORDEM.reduce((s, k) => s + (p.distribuicaoPosicaoXp[k] ?? 0), 0);
  // a maior oportunidade: a categoria (fora "XP principal") com mais clientes
  const maior = ORDEM.filter((k) => k !== "PRINCIPAL").reduce((a, b) =>
    (p.distribuicaoPosicaoXp[b] ?? 0) > (p.distribuicaoPosicaoXp[a] ?? 0) ? b : a,
  );
  const descricao = ORDEM.map((k) => `${p.distribuicaoPosicaoXp[k] ?? 0} ${rotuloPosicaoXp[k]}`).join(", ");
  return (
    <section data-testid="distribuicao" className="flex flex-col gap-6 rounded-3xl border p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight">Posição da XP por cliente</h2>
        <p className="text-base text-muted-foreground">principalidade calculada a partir do Open Finance</p>
      </div>
      <div className="flex h-6 gap-[3px] overflow-hidden rounded-md" role="img" aria-label={descricao}>
        {ORDEM.filter((k) => (p.distribuicaoPosicaoXp[k] ?? 0) > 0).map((k) => (
          <span key={k} className={TOM[k]} style={{ flexGrow: p.distribuicaoPosicaoXp[k], flexBasis: 0 }} />
        ))}
        {total === 0 && <span className="flex-1 bg-muted" />}
      </div>
      <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ORDEM.map((k) => (
          <div key={k} className="flex flex-col gap-1.5">
            <dt className="flex items-center gap-2 text-base">
              <span aria-hidden className={cn("size-3.5 shrink-0", TOM[k])} />
              {rotuloPosicaoXp[k]}
            </dt>
            <dd className="text-5xl font-extrabold tracking-tight">{p.distribuicaoPosicaoXp[k] ?? 0}</dd>
            {k === "PRINCIPAL" && (
              <dd data-testid="kpi-xp-principal" className="text-base text-muted-foreground">
                {pct(p.pctClientesXpPrincipal)} dos clientes
              </dd>
            )}
            {k === maior && (p.distribuicaoPosicaoXp[k] ?? 0) > 0 && (
              <dd className="text-base font-bold underline underline-offset-4">a maior oportunidade</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

function OndeAgir({ itens }: { itens: ItemFila[] }) {
  const top = itens.filter((i) => i.prioridade > 0).slice(0, 5);
  if (!top.length) return null;
  const colunas = "grid grid-cols-[2fr_1.4fr_3fr_0.8fr] items-center gap-4 px-6";
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight">Onde agir primeiro</h2>
        <Link href="/assessor/hoje" className="text-base font-bold underline underline-offset-4">
          Ver todos na fila
        </Link>
      </div>
      <div className="overflow-x-auto rounded-3xl border">
        <div className="min-w-[760px]">
          <div className={cn(colunas, "bg-muted py-3.5 text-[13px] font-bold tracking-[0.08em] uppercase")}>
            <span>Cliente</span>
            <span>Posição da XP</span>
            <span>Principal motivo</span>
            <span className="text-right">Prioridade</span>
          </div>
          <ul>
            {top.map((i) => (
              <li key={i.clienteId} className="border-t">
                <Link href={`/assessor/clientes/${i.clienteId}`} className={cn(colunas, "py-4.5 text-[17px] hover:bg-muted/60")}>
                  <span className="font-bold">{i.nome}</span>
                  <span>
                    <BadgePosicaoXp posicao={i.posicaoXp} />
                  </span>
                  <span className="text-muted-foreground">{i.motivos[0]?.texto ?? "—"}</span>
                  <span className="text-right text-xl font-extrabold">{numero(i.prioridade)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function TelaPainel() {
  const aoVivo = useAoVivo();
  const painel = usePainel({ aoVivo });
  const fila = useFila({ aoVivo });
  if (painel.isError) return <ErroCarregar erro={painel.error} />;
  if (!painel.data) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-label="Carregando">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-3xl" />
        ))}
      </div>
    );
  }
  const p = painel.data;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-3">
          <Sobretitulo>Sua carteira</Sobretitulo>
          <h1 className="text-5xl leading-none font-extrabold tracking-tight sm:text-[56px]">Meus clientes</h1>
          <p className="text-lg text-muted-foreground">
            Onde a XP está na vida financeira dos seus {p.totalClientes} clientes.
          </p>
        </div>
        <Link href="/assessor/hoje" className={buttonVariants({ size: "lg" })}>
          Ver fila de hoje <ArrowRight />
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2.5 rounded-3xl bg-black p-8 text-white">
          <p className="text-lg font-semibold">Patrimônio na XP</p>
          <p className="text-6xl leading-none font-extrabold tracking-tight sm:text-7xl">{brlCurto(p.patrimonioNaXp)}</p>
          <p className="text-base text-white/85">somando os {p.totalClientes} clientes</p>
        </div>
        <div className="flex flex-col gap-2.5 rounded-3xl border-2 border-black p-8">
          <p className="text-lg font-semibold">Fora da XP, visível pelo Open Finance</p>
          <p className="text-6xl leading-none font-extrabold tracking-tight sm:text-7xl">{brlCurto(p.patrimonioForaXpVisivel)}</p>
          <p className="text-base text-muted-foreground">
            oportunidade identificada · cobertura média de {pct(p.coberturaMedia)}
          </p>
        </div>
      </section>

      <PosicaoXpCarteira p={p} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Clientes" valor={String(p.totalClientes)} testId="kpi-total-clientes" />
        <Kpi rotulo="Cobertura média" valor={pct(p.coberturaMedia)} />
        <Kpi rotulo="Consentimentos expirando em 15 dias" valor={String(p.consentimentosExpirando15d)} />
        <Kpi rotulo="Clientes com alerta alto" valor={String(p.clientesComAlertaAlto)} escuro />
      </section>

      {fila.data && <OndeAgir itens={fila.data} />}
    </div>
  );
}
