import { Vazio } from "@/components/comum/marcadores";
import type { Cliente } from "@/lib/api-types";
import { data, diasAte, emDias, mesCurto, proximoAniversario } from "@/lib/formato";
import { cn } from "@/lib/utils";

const PARENTESCO: Record<string, string> = {
  FILHA: "Filha",
  FILHO: "Filho",
  CONJUGE: "Cônjuge",
  MAE: "Mãe",
  PAI: "Pai",
  OUTRO: "Outro",
};

const rotuloParentesco = (p: string) => PARENTESCO[p.toUpperCase()] ?? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();

interface Marco {
  chave: string;
  titulo: string;
  detalhe: string;
  data: string;
  dias: number;
}

export function LinhaDoTempo({ cliente, dataReferencia }: { cliente: Cliente; dataReferencia?: string }) {
  const marcos: Marco[] = [
    ...cliente.dependentes.map((d) => {
      const prox = proximoAniversario(d.dataNascimento, dataReferencia);
      const idade = Number(prox.slice(0, 4)) - Number(d.dataNascimento.slice(0, 4));
      const dias = diasAte(prox, dataReferencia);
      return {
        chave: `dep-${d.nome}`,
        titulo: `Aniversário de ${d.nome}, ${idade} anos`,
        detalhe: `${rotuloParentesco(d.parentesco)} · ${emDias(dias)}`,
        data: prox,
        dias,
      };
    }),
    ...cliente.eventosVida
      // aniversários de dependentes já aparecem acima
      .filter((e) => !(e.tipo === "ANIVERSARIO" && cliente.dependentes.some((d) => e.descricao.includes(d.nome))))
      .map((e) => {
        const dias = diasAte(e.data, dataReferencia);
        return { chave: e.id, titulo: e.descricao, detalhe: `${data(e.data)} · ${emDias(dias)}`, data: e.data, dias };
      }),
  ].sort((a, b) => a.dias - b.dias);

  if (!marcos.length) return <Vazio>Sem eventos de vida ou dependentes cadastrados.</Vazio>;

  return (
    <ol className="flex flex-col gap-4">
      {marcos.map((m) => {
        const proximo = m.dias >= 0 && m.dias <= 7;
        return (
          <li key={m.chave} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3.5">
            <span
              aria-hidden
              className={cn(
                "flex flex-col items-center rounded-2xl py-1.5 leading-tight",
                proximo ? "bg-black text-white" : "border-2 border-black",
              )}
            >
              <span className="text-[22px] font-extrabold">{m.data.slice(8, 10)}</span>
              <span className="text-xs font-bold uppercase">{mesCurto(m.data)}</span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-bold">{m.titulo}</span>
              <span className="text-base text-[#333]">{m.detalhe}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
