import { TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FluxoCaixa } from "@/lib/api-types";
import { brl, numero } from "@/lib/formato";

function Numero({ rotulo, valor, testId, destaque }: { rotulo: string; valor: string; testId?: string; destaque?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p data-testid={testId} className={`text-xl font-bold tabular-nums ${destaque ?? ""}`}>
        {valor}
      </p>
    </div>
  );
}

export function CardFluxoCaixa({ fluxo }: { fluxo: FluxoCaixa }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fluxo de caixa mensal</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Numero rotulo="Renda" valor={brl(fluxo.rendaMensal, { inteiro: true })} />
          <Numero rotulo="Custo de vida" valor={brl(fluxo.custoVidaMensal, { inteiro: true })} testId="custo-vida" />
          <Numero
            rotulo="Capacidade de aporte"
            valor={brl(fluxo.capacidadeAporteMensal, { inteiro: true })}
            destaque={fluxo.capacidadeAporteMensal > 0 ? "text-emerald-700" : ""}
          />
          <div>
            <p className="text-xs text-muted-foreground">Reserva de emergência</p>
            <p className="text-xl font-bold tabular-nums">
              <span data-testid="reserva-meses">{numero(fluxo.reservaEmergenciaMeses)}</span>{" "}
              <span className="text-sm font-normal text-muted-foreground">meses</span>
            </p>
            <p className="text-xs text-muted-foreground">Liquidez imediata {brl(fluxo.liquidezImediata, { inteiro: true })}</p>
          </div>
        </div>
        {fluxo.fontesRenda.length > 0 && (
          <div className="border-t pt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Fontes de renda</p>
            <ul className="text-sm">
              {fluxo.fontesRenda.map((f) => (
                <li key={`${f.pagadorNome}-${f.instituicaoId}`} className="flex justify-between gap-2">
                  <span>
                    {f.pagadorNome} <span className="text-muted-foreground">· dia {f.diaDoMes}</span>
                  </span>
                  <span className="tabular-nums">{brl(f.valorMensal, { inteiro: true })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {fluxo.parcial && (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>Custo de vida estimado (dados parciais). {fluxo.observacao}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
