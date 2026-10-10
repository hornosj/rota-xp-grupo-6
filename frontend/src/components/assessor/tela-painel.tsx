"use client";

import Link from "next/link";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErroCarregar } from "@/components/comum/marcadores";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PosicaoXp } from "@/lib/api-types";
import { useAoVivo } from "@/lib/ao-vivo";
import { brlCurto, pct } from "@/lib/formato";
import { usePainel } from "@/lib/queries";
import { rotuloPosicaoXp } from "@/lib/rotulos";

const ORDEM: PosicaoXp[] = ["PRINCIPAL", "SECUNDARIA", "SO_INVESTIMENTOS", "AUSENTE"];

function Kpi({ rotulo, valor, testId, detalhe }: { rotulo: string; valor: string; testId?: string; detalhe?: string }) {
  return (
    <Card>
      <CardContent className="pt-1">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <p data-testid={testId} className="mt-1 text-3xl font-bold tabular-nums">
          {valor}
        </p>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export function TelaPainel() {
  const aoVivo = useAoVivo();
  const painel = usePainel({ aoVivo });
  if (painel.isError) return <ErroCarregar erro={painel.error} />;
  if (!painel.data) {
    return (
      <div className="grid gap-4 md:grid-cols-4" aria-label="Carregando">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  const p = painel.data;
  const dados = ORDEM.map((k) => ({ posicao: rotuloPosicaoXp[k], clientes: p.distribuicaoPosicaoXp[k] ?? 0 }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minha carteira</h1>
          <p className="text-muted-foreground">Onde a XP está na vida financeira dos seus clientes</p>
        </div>
        <Link href="/assessor/hoje" className={buttonVariants({ size: "lg" })}>
          Ver fila de hoje
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Clientes" valor={String(p.totalClientes)} testId="kpi-total-clientes" />
        <Kpi
          rotulo="XP é a instituição principal"
          valor={pct(p.pctClientesXpPrincipal)}
          testId="kpi-xp-principal"
          detalhe={`${p.distribuicaoPosicaoXp.PRINCIPAL ?? 0} clientes`}
        />
        <Kpi rotulo="Patrimônio na XP" valor={brlCurto(p.patrimonioNaXp)} />
        <Kpi rotulo="Fora da XP (visível)" valor={brlCurto(p.patrimonioForaXpVisivel)} detalhe="oportunidade identificada via Open Finance" />
        <Kpi rotulo="Cobertura média" valor={pct(p.coberturaMedia)} detalhe="instituições declaradas conectadas" />
        <Kpi rotulo="Consentimentos expirando (15 dias)" valor={String(p.consentimentosExpirando15d)} />
        <Kpi rotulo="Clientes com alerta alto" valor={String(p.clientesComAlertaAlto)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Posição da XP por cliente</CardTitle>
          <CardDescription>Quantos clientes têm a XP como principal, secundária ou só para investimentos</CardDescription>
        </CardHeader>
        <CardContent>
          <div data-testid="distribuicao" className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 224 }}>
              <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }} barCategoryGap={10}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="posicao" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "#334155" }} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} formatter={(v) => [`${v} clientes`, "Clientes"]} />
                <Bar dataKey="clientes" fill="#2a78d6" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="clientes" position="right" style={{ fill: "#0f172a", fontSize: 13, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ul className="sr-only">
              {dados.map((d) => (
                <li key={d.posicao}>
                  {d.posicao}: {d.clientes}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
