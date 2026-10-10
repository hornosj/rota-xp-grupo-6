import { Link2, Link2Off, MapPin } from "lucide-react";
import { ChipPerfil } from "@/components/comum/marcadores";
import type { Visao360 } from "@/lib/api-types";
import { dataHora, pct } from "@/lib/formato";
import { rotuloProdutoDeclarado } from "@/lib/rotulos";

export function CabecalhoCliente({ visao }: { visao: Visao360 }) {
  const { cliente, cobertura } = visao;
  const completo = cobertura.pendentes.length === 0;
  return (
    <header className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{cliente.nome}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span>{cliente.idade} anos</span>·<span>{cliente.profissao}</span>·
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {cliente.cidade}
          </span>
          <ChipPerfil perfil={cliente.perfil} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Atualizado em {dataHora(visao.atualizadoEm)}</p>
      </div>
      <div className="min-w-64 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          {completo ? <Link2 className="size-4 text-emerald-600" /> : <Link2Off className="size-4 text-amber-600" />}
          <span className="font-semibold">
            {cobertura.instituicoesConectadas} de {cobertura.instituicoesDeclaradas} instituições conectadas
          </span>
          <span className="ml-auto text-sm font-bold tabular-nums">{pct(cobertura.percentual)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={completo ? "h-full bg-emerald-500 transition-all duration-700" : "h-full bg-amber-500 transition-all duration-700"}
            style={{ width: `${Math.round(cobertura.percentual * 100)}%` }}
          />
        </div>
        {cobertura.pendentes.length > 0 && (
          <ul className="mt-2 text-sm text-slate-700">
            {cobertura.pendentes.map((p) => (
              <li key={p.instituicaoId}>
                Pendente: <span className="font-medium">{p.nome}</span>{" "}
                <span className="text-muted-foreground">({p.produtos.map((x) => rotuloProdutoDeclarado[x]).join(", ")})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
