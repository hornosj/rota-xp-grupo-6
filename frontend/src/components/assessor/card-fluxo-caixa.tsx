import { TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FluxoCaixa } from "@/lib/api-types";
import { brl, numero } from "@/lib/formato";

function Numero({ rotulo, valor, testId, detalhe }: { rotulo: string; valor: React.ReactNode; testId?: string; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[15px] text-muted-foreground">{rotulo}</p>
      <p data-testid={testId} className="text-[28px] leading-tight font-extrabold">
        {valor}
      </p>
      {detalhe && <p className="text-sm text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

export function CardFluxoCaixa({ fluxo }: { fluxo: FluxoCaixa }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de caixa mensal</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-5">
          <Numero rotulo="Renda" valor={brl(fluxo.rendaMensal, { inteiro: true })} />
          <Numero rotulo="Custo de vida" valor={brl(fluxo.custoVidaMensal, { inteiro: true })} testId="custo-vida" />
          <Numero rotulo="Capacidade de aporte" valor={brl(fluxo.capacidadeAporteMensal, { inteiro: true })} />
          <Numero
            rotulo="Reserva de emergência"
            valor={
              <>
                <span data-testid="reserva-meses">{numero(fluxo.reservaEmergenciaMeses)}</span> meses
              </>
            }
            detalhe={`Liquidez imediata ${brl(fluxo.liquidezImediata, { inteiro: true })}`}
          />
        </div>
        {fluxo.fontesRenda.length > 0 && (
          <ul className="flex flex-col gap-1 border-t pt-4 text-base">
            {fluxo.fontesRenda.map((f) => (
              <li key={`${f.pagadorNome}-${f.instituicaoId}`} className="flex justify-between gap-3">
                <span>
                  Renda: {f.pagadorNome} <span className="text-muted-foreground">· dia {f.diaDoMes}</span>
                </span>
                <span className="font-bold">{brl(f.valorMensal, { inteiro: true })}</span>
              </li>
            ))}
          </ul>
        )}
        {fluxo.parcial && (
          <p className="flex items-start gap-2.5 rounded-2xl border-2 border-black p-3.5 text-base">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <span>Custo de vida estimado (dados parciais). {fluxo.observacao}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
