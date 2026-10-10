import { BadgePosicaoXp, ChipPerfil } from "@/components/comum/marcadores";
import type { Visao360 } from "@/lib/api-types";
import { brlCurto, dataHora, pct } from "@/lib/formato";
import { rotuloProdutoDeclarado } from "@/lib/rotulos";

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:px-6">
      <dt className="text-[15px] text-muted-foreground">{rotulo}</dt>
      <dd className="text-3xl font-extrabold tracking-tight">{valor}</dd>
      {detalhe && <dd className="text-sm text-muted-foreground">{detalhe}</dd>}
    </div>
  );
}

export function CabecalhoCliente({ visao }: { visao: Visao360 }) {
  const { cliente, cobertura, patrimonio, principalidade } = visao;
  return (
    <header className="flex flex-wrap items-end justify-between gap-7">
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-4xl leading-none font-extrabold tracking-tight sm:text-[56px]">{cliente.nome}</h1>
        <p className="text-lg text-[#333] sm:text-xl">
          {cliente.idade} anos · {cliente.profissao} · {cliente.cidade}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ChipPerfil perfil={cliente.perfil} />
          <BadgePosicaoXp posicao={principalidade.posicaoXp} />
          <span className="text-sm text-muted-foreground">Atualizado em {dataHora(visao.atualizadoEm)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <dl className="flex flex-wrap divide-x divide-[#d9d9d9] overflow-hidden rounded-[20px] border-2 border-black">
          <Numero rotulo="Patrimônio visível" valor={brlCurto(patrimonio.totalVisivel)} />
          <Numero rotulo="Na XP" valor={pct(patrimonio.shareOfWalletXp)} />
          <Numero
            rotulo="Cobertura"
            valor={pct(cobertura.percentual)}
            detalhe={`${cobertura.instituicoesConectadas} de ${cobertura.instituicoesDeclaradas} instituições conectadas`}
          />
        </dl>
        {cobertura.pendentes.length > 0 && (
          <ul className="text-[15px]">
            {cobertura.pendentes.map((p) => (
              <li key={p.instituicaoId}>
                Pendente: <span className="font-bold">{p.nome}</span>{" "}
                <span className="text-muted-foreground">({p.produtos.map((x) => rotuloProdutoDeclarado[x]).join(", ")})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
