"use client";

// Calculadora de deságio (FE1-11): para cada título com marcação a mercado, em quanto tempo a troca
// por um título com taxa melhor recupera o deságio da venda (break-even). Todo número vem do backend
// (DesagioService, PLAN §7.11); aqui só formatamos.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { ErroCarregar, Vazio } from "@/components/comum/marcadores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { DesagioDetalhado, Id, PosicaoDesagio, PremissasMercado } from "@/lib/api-types";
import { brl, data, duracaoMeses, numero } from "@/lib/formato";
import { cn } from "@/lib/utils";

// Valores iniciais (o assessor ajusta): o deságio do exemplo do PLAN §7.11 e uma taxa de oferta típica.
const DESAGIO_INICIAL = "3";
const TAXA_NOVA_INICIAL = "13,5";
const ESPERA_DIGITACAO_MS = 300;

/** Prefixo das consultas: entra na invalidação geral de dados (lib/sinal) após consentimento e reset. */
const chaveDesagio = (clienteId: Id) => ["desagio", clienteId] as const;

type ResultadoSimulacao = { simulacao: DesagioDetalhado } | { erro: string };

function usePosicoesDesagio(clienteId: Id) {
  return useQuery({ queryKey: [...chaveDesagio(clienteId), "posicoes"], queryFn: () => api.posicoesDesagio(clienteId) });
}

/** Uma simulação por posição elegível; uma falha não derruba as outras. */
function useSimulacoesDesagio(clienteId: Id, posicoes: PosicaoDesagio[], desagio: number | null, taxaNova: number | null) {
  const ids = posicoes.map((p) => p.posicaoId);
  return useQuery({
    queryKey: [...chaveDesagio(clienteId), "simulacoes", ids, desagio, taxaNova],
    queryFn: async () => {
      const pares = await Promise.all(
        ids.map(async (posicaoId): Promise<[Id, ResultadoSimulacao]> => {
          try {
            return [posicaoId, { simulacao: await api.simularDesagio({ clienteId, posicaoId, desagio: desagio!, taxaNova: taxaNova! }) }];
          } catch (e) {
            return [posicaoId, { erro: e instanceof Error ? e.message : "Erro inesperado" }];
          }
        }),
      );
      return Object.fromEntries(pares) as Record<Id, ResultadoSimulacao>;
    },
    enabled: ids.length > 0 && desagio != null && taxaNova != null,
    placeholderData: keepPreviousData,
  });
}

/** Fração → "11,2%", "10%" (até uma casa, como os textos do backend). */
const pct = (fracao: number) => `${numero(fracao * 100, 1)}%`;

function useAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

/** "3" ou "13,5" (percentual digitado) → fração; null se inválido. */
function lerPercentual(texto: string, min: number, max: number, incluiMin: boolean): number | null {
  const t = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  if ((incluiMin ? v < min : v <= min) || v >= max) return null;
  return Math.round(v * 1000) / 100000;
}

export function CardDesagio({ clienteId }: { clienteId: Id }) {
  const [desagioTexto, setDesagioTexto] = useState(DESAGIO_INICIAL);
  const [taxaTexto, setTaxaTexto] = useState(TAXA_NOVA_INICIAL);
  const desagio = lerPercentual(desagioTexto, 0, 100, true);
  const taxaNova = lerPercentual(taxaTexto, 0, 500, false);
  const desagioAtrasado = useAtrasado(desagio, ESPERA_DIGITACAO_MS);
  const taxaNovaAtrasada = useAtrasado(taxaNova, ESPERA_DIGITACAO_MS);
  const pronto = desagioAtrasado != null && taxaNovaAtrasada != null;

  const posicoes = usePosicoesDesagio(clienteId);
  const elegiveis = posicoes.data?.posicoes.filter((p) => p.elegivel) ?? [];
  const inelegiveis = posicoes.data?.posicoes.filter((p) => !p.elegivel) ?? [];
  const simulacoes = useSimulacoesDesagio(clienteId, elegiveis, desagioAtrasado, taxaNovaAtrasada);

  return (
    <Card data-testid="card-desagio">
      <CardHeader>
        <CardTitle>Calculadora de deságio</CardTitle>
        <p className="text-base text-muted-foreground">
          Se vender o título antes do vencimento para trocar por uma taxa melhor: em quanto tempo a perda se paga.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoPercentual
            rotulo="Deságio na venda"
            sufixo="%"
            valor={desagioTexto}
            onChange={setDesagioTexto}
            erro={desagio == null ? "Informe um deságio entre 0% e 100%." : undefined}
          />
          <CampoPercentual
            rotulo="Nova taxa"
            sufixo="% a.a."
            valor={taxaTexto}
            onChange={setTaxaTexto}
            erro={taxaNova == null ? "Informe a taxa anual do novo título." : undefined}
          />
        </div>

        {posicoes.isError && <ErroCarregar erro={posicoes.error} />}
        {!posicoes.data && !posicoes.isError && (
          <div className="flex flex-col gap-3" aria-label="Carregando posições">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        )}
        {posicoes.data && elegiveis.length === 0 && (
          <Vazio>Nenhum título com marcação a mercado na carteira visível.</Vazio>
        )}
        {elegiveis.length > 0 && (
          <ul className="flex flex-col gap-3">
            {elegiveis.map((p) => (
              <ItemPosicao
                key={p.posicaoId}
                posicao={p}
                resultado={pronto ? simulacoes.data?.[p.posicaoId] : undefined}
                carregando={pronto && simulacoes.isFetching && !simulacoes.data?.[p.posicaoId]}
                atualizando={simulacoes.isPlaceholderData}
                semEntrada={!pronto}
                erroGeral={simulacoes.isError ? simulacoes.error : undefined}
              />
            ))}
          </ul>
        )}

        {inelegiveis.length > 0 && <ListaSemDesagio posicoes={inelegiveis} />}
        {posicoes.data && elegiveis.length > 0 && <Ressalva premissas={posicoes.data.premissas} />}
      </CardContent>
    </Card>
  );
}

function CampoPercentual({
  rotulo,
  sufixo,
  valor,
  onChange,
  erro,
}: {
  rotulo: string;
  sufixo: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-bold">
        {rotulo}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className="h-12 w-full min-w-0 rounded-xl border-2 border-input bg-background px-4 text-base outline-none focus-visible:border-black focus-visible:ring-3 focus-visible:ring-black/15 aria-invalid:border-destructive"
        />
        <span className="shrink-0 text-base font-semibold">{sufixo}</span>
      </div>
      {erro && (
        <p id={`${id}-erro`} className="text-sm font-semibold text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}

function descricaoTaxa(p: PosicaoDesagio): string | undefined {
  if (!p.taxaTexto) return undefined;
  if (p.taxaDependeDePremissa && p.taxaAnualEstimada != null) return `${p.taxaTexto} (≈ ${pct(p.taxaAnualEstimada)} a.a.)`;
  return p.taxaTexto;
}

function ItemPosicao({
  posicao: p,
  resultado,
  carregando,
  atualizando,
  semEntrada,
  erroGeral,
}: {
  posicao: PosicaoDesagio;
  resultado?: ResultadoSimulacao;
  carregando: boolean;
  atualizando: boolean;
  /** deságio ou nova taxa inválidos */
  semEntrada: boolean;
  erroGeral?: unknown;
}) {
  const detalhes = [p.instituicaoNome, descricaoTaxa(p), p.vencimento && `vence em ${data(p.vencimento)}`].filter(Boolean);
  return (
    <li data-testid="posicao-desagio" className="flex flex-col gap-1.5 rounded-2xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-lg leading-snug font-bold">{p.nome}</p>
        <p className="text-lg font-extrabold">{brl(p.valorAtual, { inteiro: true })}</p>
      </div>
      <p className="text-sm text-muted-foreground">{detalhes.join(" · ")}</p>
      <div className={cn("mt-1.5 border-t pt-2.5 transition-opacity", atualizando && "opacity-60")}>
        {resultado && "simulacao" in resultado && <BreakEven s={resultado.simulacao} />}
        {resultado && "erro" in resultado && (
          <p className="text-sm text-muted-foreground">Não foi possível simular: {resultado.erro}</p>
        )}
        {!resultado && carregando && <Skeleton className="h-5 w-3/4" aria-label="Calculando break-even" />}
        {!resultado && !semEntrada && !carregando && erroGeral != null && (
          <p className="text-sm text-muted-foreground">
            Não foi possível simular{erroGeral instanceof Error ? `: ${erroGeral.message}` : "."}
          </p>
        )}
        {!resultado && semEntrada && (
          <p className="text-sm text-muted-foreground">Ajuste o deságio e a nova taxa para ver o break-even.</p>
        )}
      </div>
    </li>
  );
}

/** A linha que interessa: em quanto tempo a troca recupera o deságio, contra o tempo até o vencimento. */
function BreakEven({ s }: { s: DesagioDetalhado }) {
  const vence = duracaoMeses(s.entrada.prazoRestanteAnos * 12);
  return (
    <div data-testid="break-even" data-compensa={s.compensa} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {s.breakEvenMeses == null ? (
          <p className="text-base">
            <span className="font-bold">Não recupera o deságio:</span> a nova taxa ({pct(s.entrada.taxaNova)} a.a.) não
            supera a atual ({pct(s.entrada.taxaAntiga)} a.a.).
          </p>
        ) : (
          <p className="text-base">
            Break-even em <span className="font-extrabold">{duracaoMeses(s.breakEvenMeses)}</span>
            <span className="text-muted-foreground"> · vence em {vence}</span>
          </p>
        )}
        <ChipVeredito compensa={s.compensa} />
      </div>
      <p className="text-sm text-muted-foreground">
        Perda imediata {brl(s.perdaImediata, { inteiro: true })}
        {" · "}no vencimento {s.ganhoDaTroca >= 0 ? "+" : "−"}
        {brl(Math.abs(s.ganhoDaTroca), { inteiro: true })} vs. manter
        {s.desagioMaximoQueCompensa != null && ` · deságio máximo que compensa ${pct(s.desagioMaximoQueCompensa)}`}
      </p>
    </div>
  );
}

function ChipVeredito({ compensa }: { compensa: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap",
        compensa ? "bg-black text-white ring-1 ring-black" : "bg-white text-black ring-1 ring-black",
      )}
    >
      {compensa ? "Compensa" : "Não compensa"}
    </span>
  );
}

function ListaSemDesagio({ posicoes }: { posicoes: PosicaoDesagio[] }) {
  return (
    <div className="flex flex-col gap-1.5 border-t pt-4">
      <p className="text-sm font-bold">Sem deságio</p>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {posicoes.map((p) => (
          <li key={p.posicaoId}>
            {p.nome}
            {p.motivoInelegibilidade && ` — ${p.motivoInelegibilidade.replace(/\s*\(.*\)$/, "")}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ressalva({ premissas: m }: { premissas: PremissasMercado }) {
  return (
    <p className="text-sm text-muted-foreground">
      Simulação simplificada: ignora IR e supõe risco equivalente entre os títulos. Taxas pós-fixadas estimadas com
      CDI de {pct(m.cdiAnual)}, IPCA de {pct(m.ipcaAnual)} e Selic de {pct(m.selicAnual)} ao ano.
    </p>
  );
}
