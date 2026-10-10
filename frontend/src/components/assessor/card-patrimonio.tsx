import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Cobertura, Patrimonio } from "@/lib/api-types";
import { brl, brlCurto, pct } from "@/lib/formato";
import { rotuloProduto } from "@/lib/rotulos";

/** XP em preto; as demais instituições em cinzas de luminosidade bem diferente. */
const CINZAS = ["#6b6b6b", "#a3a3a3", "#cfcfcf", "#e6e6e6"];

export function CardPatrimonio({ patrimonio, cobertura }: { patrimonio: Patrimonio; cobertura: Cobertura }) {
  let outras = 0;
  const instituicoes = [...patrimonio.porInstituicao]
    .sort((a, b) => Number(b.ehXp) - Number(a.ehXp) || b.total - a.total)
    .map((p) => ({ ...p, cor: p.ehXp ? "#000000" : CINZAS[Math.min(outras++, CINZAS.length - 1)] }));
  const descricao = instituicoes.map((p) => `${p.nome} ${brlCurto(p.total)}`).join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patrimônio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[15px] text-muted-foreground">Total visível</p>
            <p data-testid="total-visivel" className="text-4xl font-extrabold tracking-tight" title={brl(patrimonio.totalVisivel)}>
              {brlCurto(patrimonio.totalVisivel)}
            </p>
          </div>
          <div className="text-right">
            <p data-testid="share-xp" className="text-3xl font-extrabold">
              {pct(patrimonio.shareOfWalletXp)}
            </p>
            <p className="text-sm text-muted-foreground">na XP (share of wallet)</p>
          </div>
        </div>

        {instituicoes.length > 0 && (
          <div className="flex h-4 gap-0.5 overflow-hidden rounded" role="img" aria-label={descricao}>
            {instituicoes.map((p) => (
              <span key={p.instituicaoId} style={{ flexGrow: p.total, flexBasis: 0, backgroundColor: p.cor }} />
            ))}
          </div>
        )}

        <ul className="flex flex-col gap-3 text-[17px]">
          {instituicoes.map((p) => (
            <li key={p.instituicaoId} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="size-3.5 shrink-0" style={{ backgroundColor: p.cor }} />
                <span className="truncate">{p.nome}</span>
              </span>
              <span className="font-extrabold" title={`Investimentos ${brl(p.investimentos)} · Saldo em conta ${brl(p.saldoContas)}`}>
                {brlCurto(p.total)}
              </span>
            </li>
          ))}
          {cobertura.pendentes.map((p) => (
            <li
              key={p.instituicaoId}
              data-testid={`pendente-${p.instituicaoId}`}
              className="flex items-center justify-between gap-3 text-muted-foreground"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="size-3.5 shrink-0 border-[1.5px] border-dashed border-black" />
                <span className="truncate">{p.nome}</span>
              </span>
              <span className="text-[15px]">não conectado</span>
            </li>
          ))}
        </ul>

        {patrimonio.porProduto.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {patrimonio.porProduto.map((p) => (
              <span key={p.produto} className="rounded-full border border-[#bdbdbd] px-3 py-1 text-sm">
                {rotuloProduto[p.produto] ?? p.produto} <span className="font-extrabold">{brlCurto(p.total)}</span>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
