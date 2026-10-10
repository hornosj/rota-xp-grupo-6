import { CalendarHeart, Cake } from "lucide-react";
import { Vazio } from "@/components/comum/marcadores";
import type { Cliente } from "@/lib/api-types";
import { data, diasAte, emDias, proximoAniversario } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Marco {
  chave: string;
  titulo: string;
  data: string;
  dias: number;
  aniversario: boolean;
}

export function LinhaDoTempo({ cliente, dataReferencia }: { cliente: Cliente; dataReferencia?: string }) {
  const marcos: Marco[] = [
    ...cliente.dependentes.map((d) => {
      const prox = proximoAniversario(d.dataNascimento, dataReferencia);
      const idade = Number(prox.slice(0, 4)) - Number(d.dataNascimento.slice(0, 4));
      return {
        chave: `dep-${d.nome}`,
        titulo: `Aniversário de ${d.nome} (${d.parentesco}, ${idade} anos)`,
        data: prox,
        dias: diasAte(prox, dataReferencia),
        aniversario: true,
      };
    }),
    ...cliente.eventosVida
      // aniversários de dependentes já aparecem acima
      .filter((e) => !(e.tipo === "ANIVERSARIO" && cliente.dependentes.some((d) => e.descricao.includes(d.nome))))
      .map((e) => ({
        chave: e.id,
        titulo: e.descricao,
        data: e.data,
        dias: diasAte(e.data, dataReferencia),
        aniversario: e.tipo === "ANIVERSARIO",
      })),
  ].sort((a, b) => a.dias - b.dias);

  if (!marcos.length) return <Vazio>Sem eventos de vida ou dependentes cadastrados.</Vazio>;

  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {marcos.map((m) => {
        const proximo = m.dias >= 0 && m.dias <= 7;
        const Icone = m.aniversario ? Cake : CalendarHeart;
        return (
          <li key={m.chave} className="mb-3 ml-5 last:mb-0">
            <span
              className={cn(
                "absolute -left-3 flex size-6 items-center justify-center rounded-full ring-4 ring-white",
                proximo ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500",
              )}
            >
              <Icone className="size-3.5" />
            </span>
            <p className={cn("text-sm", proximo && "font-semibold")}>{m.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {data(m.data)} · {emDias(m.dias)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
