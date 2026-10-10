"use client";

import { useState } from "react";
import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ErroCarregar, Sobretitulo, Vazio } from "@/components/comum/marcadores";
import { Skeleton } from "@/components/ui/skeleton";
import type { ItemFila, TipoAcao } from "@/lib/api-types";
import { useAoVivo } from "@/lib/ao-vivo";
import { diaPorExtenso } from "@/lib/formato";
import { useDemoEstado, useFila } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { DestaqueFila } from "./destaque-fila";
import { ListaFila } from "./lista-fila";

/** Filtros da fila pelo tipo da próxima ação (derivado do contrato, sem campo novo). */
const CATEGORIAS: { id: string; rotulo: string; tipos: TipoAcao[] }[] = [
  { id: "protecao", rotulo: "Proteção", tipos: ["DIVERSIFICAR_FGC", "REDUZIR_CONCENTRACAO"] },
  { id: "parado", rotulo: "Dinheiro parado", tipos: ["APLICAR_SALDO_PARADO"] },
  { id: "vencimentos", rotulo: "Vencimentos", tipos: ["REINVESTIR_VENCIMENTO", "RENOVAR_CONSENTIMENTO"] },
  { id: "aporte", rotulo: "Aporte e reserva", tipos: ["APORTE_PROGRAMADO", "MONTAR_RESERVA"] },
  { id: "relacionamento", rotulo: "Relacionamento", tipos: ["CONTATO_RELACIONAMENTO", "CONVIDAR_CONEXAO"] },
];

const daCategoria = (item: ItemFila, id: string) =>
  !!item.acaoPrincipal && !!CATEGORIAS.find((c) => c.id === id)?.tipos.includes(item.acaoPrincipal.tipo);

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "h-11 rounded-full border-2 border-black px-4.5 text-[15px] font-semibold transition",
        ativo ? "bg-black font-bold text-white" : "bg-white hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function TelaHoje() {
  const aoVivo = useAoVivo();
  const fila = useFila({ aoVivo });
  const demo = useDemoEstado();
  const [filtro, setFiltro] = useState<string | null>(null);
  const sufixo = aoVivo ? "?aoVivo=1" : "";
  const comMotivo = fila.data?.filter((i) => i.prioridade > 0).length ?? 0;
  const [primeiro, ...resto] = fila.data ?? [];
  const categorias = CATEGORIAS.map((c) => ({ ...c, total: resto.filter((i) => daCategoria(i, c.id)).length })).filter(
    (c) => c.total > 0,
  );
  const visiveis = filtro ? resto.filter((i) => daCategoria(i, filtro)) : resto;

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          {demo.data && <Sobretitulo>{diaPorExtenso(demo.data.dataReferencia)}</Sobretitulo>}
          <h1 className="text-5xl leading-none font-extrabold tracking-tight sm:text-[56px]">
            {!fila.data
              ? "Hoje"
              : comMotivo === 0
                ? "Nenhum motivo para ligar hoje."
                : `${comMotivo} ${comMotivo === 1 ? "motivo" : "motivos"} para ligar hoje.`}
          </h1>
        </div>
        {aoVivo && <IndicadorAoVivo atualizando={fila.isFetching} />}
      </div>

      {fila.isError && <ErroCarregar erro={fila.error} />}
      {!fila.data && !fila.isError && <EsqueletoFila />}
      {fila.data && !primeiro && <Vazio>Nenhum cliente na fila hoje. Bom trabalho!</Vazio>}

      {primeiro && <DestaqueFila item={primeiro} sufixoLink={sufixo} />}

      {resto.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-extrabold tracking-tight">Na sequência</h2>
            {categorias.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de ação">
                <Filtro ativo={filtro === null} onClick={() => setFiltro(null)}>
                  Todos
                </Filtro>
                {categorias.map((c) => (
                  <Filtro key={c.id} ativo={filtro === c.id} onClick={() => setFiltro(filtro === c.id ? null : c.id)}>
                    {c.rotulo} · {c.total}
                  </Filtro>
                ))}
              </div>
            )}
          </div>
          <ListaFila itens={visiveis} sufixoLink={sufixo} />
        </section>
      )}
    </div>
  );
}

export function EsqueletoFila() {
  return (
    <div className="flex flex-col gap-4" aria-label="Carregando">
      <Skeleton className="h-96 w-full rounded-[28px]" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}
