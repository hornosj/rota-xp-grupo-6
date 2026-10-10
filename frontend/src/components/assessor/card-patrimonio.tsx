import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Cobertura, Patrimonio } from "@/lib/api-types";
import { brl, brlCurto, pct } from "@/lib/formato";
import { rotuloProduto } from "@/lib/rotulos";

export function CardPatrimonio({ patrimonio, cobertura }: { patrimonio: Patrimonio; cobertura: Cobertura }) {
  const max = Math.max(1, ...patrimonio.porInstituicao.map((p) => p.total));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Patrimônio visível</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total visível</p>
            <p data-testid="total-visivel" className="text-2xl font-bold tabular-nums" title={brl(patrimonio.totalVisivel)}>
              {brlCurto(patrimonio.totalVisivel)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Na XP · fora</p>
            <p className="text-lg font-semibold tabular-nums">
              {brlCurto(patrimonio.naXp)} <span className="text-muted-foreground">· {brlCurto(patrimonio.foraXp)}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Share of wallet XP</p>
            <p data-testid="share-xp" className="text-2xl font-bold tabular-nums">
              {pct(patrimonio.shareOfWalletXp)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {patrimonio.porInstituicao.map((p) => (
            <div key={p.instituicaoId} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-2 text-sm">
              <span className="truncate font-medium">{p.nome}</span>
              <div className="h-4 overflow-hidden rounded bg-slate-100">
                <div
                  className={p.ehXp ? "h-full bg-slate-900 transition-all duration-700" : "h-full bg-slate-400 transition-all duration-700"}
                  style={{ width: `${(p.total / max) * 100}%` }}
                  title={`Investimentos ${brl(p.investimentos)} · Saldo em conta ${brl(p.saldoContas)}`}
                />
              </div>
              <span className="text-right tabular-nums">{brlCurto(p.total)}</span>
            </div>
          ))}
          {cobertura.pendentes.map((p) => (
            <div
              key={p.instituicaoId}
              data-testid={`pendente-${p.instituicaoId}`}
              className="grid grid-cols-[9rem_1fr_6rem] items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="truncate">{p.nome}</span>
              <div className="h-4 rounded border-2 border-dashed border-slate-300" />
              <span className="text-right text-xs">não conectado</span>
            </div>
          ))}
        </div>

        {patrimonio.porProduto.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t pt-3">
            {patrimonio.porProduto.map((p) => (
              <span key={p.produto} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {rotuloProduto[p.produto] ?? p.produto} <span className="font-semibold">{brlCurto(p.total)}</span>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
