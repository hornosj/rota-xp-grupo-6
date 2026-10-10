"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CategoriaCusto, ConglomeradoFgc, Diagnostico } from "@/lib/api-types";
import { brl, brlCurto, numero } from "@/lib/formato";
import { rotuloCategoriaCusto } from "@/lib/rotulos";

const ehNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Texto do detalhe do FGC (§9.3). Usa `detalhes` quando houver; senão o `resumo`. */
export function textoFgc(d: Diagnostico): { texto: string; protegido: boolean } {
  const det = d.detalhes ?? {};
  const valor = det.valorSemCobertura;
  const inst = typeof det.instituicao === "string" ? det.instituicao : undefined;
  if (ehNumero(valor)) {
    if (valor <= 0) return { texto: "Todo o seu patrimônio está protegido pelo FGC.", protegido: true };
    return {
      texto: `${brlCurto(valor)} do seu patrimônio estão acima da cobertura do FGC${inst ? ` no ${inst}` : ""}. Sua assessora já foi avisada.`,
      protegido: false,
    };
  }
  const resumo = d.resumo ?? "";
  const semCobertura = /sem cobertura|acima/i.test(resumo);
  return { texto: semCobertura ? `${resumo}. Sua assessora já foi avisada.` : resumo, protegido: !semCobertura };
}

/** Pares categoria → valor de `detalhes.categorias` (DetalhesCustoDeVida), com rótulo pt-BR, do maior para o menor. */
export function categoriasDeCusto(det: Record<string, unknown> | undefined): { nome: string; valor: number }[] {
  const fonte = det?.categorias;
  if (!ehObjeto(fonte)) return [];
  return Object.entries(fonte)
    .filter((par): par is [string, number] => ehNumero(par[1]))
    .map(([chave, valor]) => ({ nome: rotuloCategoriaCusto[chave as CategoriaCusto] ?? chave, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function CorpoCusto({ d }: { d: Diagnostico }) {
  const cats = categoriasDeCusto(d.detalhes);
  const total = ehNumero(d.detalhes?.total) ? (d.detalhes!.total as number) : cats.reduce((s, c) => s + c.valor, 0);
  const max = Math.max(1, ...cats.map((c) => c.valor));
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs text-muted-foreground">Seu custo de vida mensal</p>
        <p className="text-3xl font-bold tabular-nums">{brl(total, { inteiro: true })}</p>
      </div>
      {cats.length > 0 && (
        <ul className="flex flex-col gap-2">
          {cats.map((c) => (
            <li key={c.nome} className="text-sm">
              <div className="flex justify-between">
                <span>{c.nome}</span>
                <span className="font-medium tabular-nums">{brl(c.valor, { inteiro: true })}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-slate-700" style={{ width: `${(c.valor / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {d.detalhes?.parcial === true && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          Valor parcial: falta conectar algum cartão ou conta que você usa.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Média dos últimos 3 meses, com base nas contas e cartões conectados.</p>
    </div>
  );
}

function CorpoReserva({ d }: { d: Diagnostico }) {
  const det = d.detalhes ?? {};
  const meses = ehNumero(det.meses) ? det.meses : undefined;
  const meta = ehNumero(det.metaMeses) ? det.metaMeses : 6;
  const liquidez = ehNumero(det.liquidezImediata) ? det.liquidezImediata : undefined;
  const p = meses != null ? Math.min(1, meses / meta) : 0;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-3xl font-bold tabular-nums">
        {meses != null ? numero(meses) : "—"} <span className="text-base font-normal text-muted-foreground">meses</span>
      </p>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={p >= 1 ? "h-full bg-emerald-500" : "h-full bg-amber-500"} style={{ width: `${p * 100}%` }} />
      </div>
      <p className="text-sm text-slate-700">
        {p >= 1
          ? `Parabéns! Sua reserva cobre mais de ${meta} meses do seu custo de vida.`
          : `A meta é ${meta} meses do seu custo de vida.`}
        {liquidez != null && ` Você tem ${brl(liquidez, { inteiro: true })} com resgate imediato.`}
      </p>
    </div>
  );
}

/** PATRIMONIO_COMPLETO: { instituicoes (contagem), total (R$) } — DetalhesPatrimonioCompleto. */
function CorpoPatrimonio({ d }: { d: Diagnostico }) {
  const det = d.detalhes ?? {};
  const total = ehNumero(det.total) ? det.total : undefined;
  const instituicoes = ehNumero(det.instituicoes) ? det.instituicoes : undefined;
  return (
    <div className="flex flex-col gap-2">
      {total != null && <p className="text-3xl font-bold tabular-nums">{brl(total, { inteiro: true })}</p>}
      {instituicoes != null && (
        <p className="text-sm text-slate-700">
          Somando {instituicoes} {instituicoes === 1 ? "instituição" : "instituições"} conectadas.
        </p>
      )}
      {total == null && d.resumo && <p className="text-lg font-semibold">{d.resumo}</p>}
    </div>
  );
}

/** Conglomerados de PROTECAO_FGC (DetalhesProtecaoFgc.conglomerados), maior valor descoberto primeiro. */
function conglomeradosFgc(d: Diagnostico): ConglomeradoFgc[] {
  const lista = d.detalhes?.conglomerados;
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((c): c is ConglomeradoFgc => ehObjeto(c) && ehNumero(c.valor) && ehNumero(c.descoberto) && typeof c.nome === "string")
    .sort((a, b) => b.descoberto - a.descoberto || b.valor - a.valor);
}

export function CorpoFgc({ d, comConglomerados }: { d: Diagnostico; comConglomerados?: boolean }) {
  const { texto, protegido } = textoFgc(d);
  const conglomerados = comConglomerados ? conglomeradosFgc(d) : [];
  return (
    <div className="flex flex-col gap-3">
      <div
        data-testid="detalhe-fgc"
        className={protegido ? "flex gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900" : "flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-950"}
      >
        {protegido ? <ShieldCheck className="size-6 shrink-0" /> : <ShieldAlert className="size-6 shrink-0" />}
        <p className="text-[15px] leading-relaxed">{texto}</p>
      </div>
      {conglomerados.length > 0 && (
        <ul className="text-sm">
          {conglomerados.map((c) => (
            <li
              key={c.conglomeradoId}
              data-testid={`fgc-${c.conglomeradoId}`}
              className="flex items-baseline justify-between gap-2 border-b py-1.5 last:border-0"
            >
              <span>
                {c.nome} <span className="text-muted-foreground tabular-nums">{brl(c.valor, { inteiro: true })}</span>
              </span>
              {c.descoberto > 0 ? (
                <span className="font-medium text-amber-700 tabular-nums">{brl(c.descoberto, { inteiro: true })} sem cobertura</span>
              ) : (
                <span className="font-medium text-emerald-700">protegido</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DetalheDiagnostico({ diagnostico, onFechar }: { diagnostico: Diagnostico | null; onFechar: () => void }) {
  return (
    <Dialog open={!!diagnostico} onOpenChange={(o) => !o && onFechar()}>
      {diagnostico && (
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-lg">{diagnostico.titulo}</DialogTitle>
            <DialogDescription>Diagnóstico desbloqueado com o Open Finance</DialogDescription>
          </DialogHeader>
          {diagnostico.tipo === "PROTECAO_FGC" && <CorpoFgc d={diagnostico} comConglomerados />}
          {diagnostico.tipo === "CUSTO_DE_VIDA" && <CorpoCusto d={diagnostico} />}
          {diagnostico.tipo === "RESERVA_EMERGENCIA" && <CorpoReserva d={diagnostico} />}
          {diagnostico.tipo === "PATRIMONIO_COMPLETO" && <CorpoPatrimonio d={diagnostico} />}
        </DialogContent>
      )}
    </Dialog>
  );
}
