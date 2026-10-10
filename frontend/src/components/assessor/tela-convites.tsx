"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, Link2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ChipPerfil, ErroCarregar, Vazio } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-base";
import type { ConviteOnboarding, StatusConvite } from "@/lib/api-types";
import { dataHora } from "@/lib/formato";
import { useConvites, useCriarConvite } from "@/lib/queries";
import { cn } from "@/lib/utils";

const INTERVALO_CONVITES_MS = 3000;

const statusConvite: Record<StatusConvite, { rotulo: string; cor: string }> = {
  PENDENTE: { rotulo: "Link gerado", cor: "bg-slate-100 text-slate-700 ring-slate-200" },
  ABERTO: { rotulo: "Em preenchimento", cor: "bg-amber-100 text-amber-900 ring-amber-200" },
  CONCLUIDO: { rotulo: "Cadastro concluído", cor: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
};

/** Origem da página, sem quebrar a hidratação (no servidor é vazia). */
function useOrigem() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

function LinhaConvite({ convite, origem }: { convite: ConviteOnboarding; origem: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = `${origem}${convite.link}`;
  const st = statusConvite[convite.status];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success(`Link de cadastro de ${convite.nome} copiado`);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <li data-testid={`convite-${convite.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{convite.nome}</p>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", st.cor)}>{st.rotulo}</span>
          {convite.perfil && <ChipPerfil perfil={convite.perfil} />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Gerado em {dataHora(convite.criadoEm)}
          {convite.concluidoEm && <> · concluído em {dataHora(convite.concluidoEm)}</>}
        </p>
        {convite.status !== "CONCLUIDO" && (
          <p className="mt-1 truncate font-mono text-xs text-slate-500" title={url}>
            {url}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {convite.status === "CONCLUIDO" && convite.clienteId ? (
          <Link href={`/assessor/clientes/${convite.clienteId}`} className={buttonVariants({ size: "lg" })}>
            Ver visão 360
          </Link>
        ) : (
          <>
            <Button variant="outline" size="lg" onClick={copiar} aria-label={`Copiar link de cadastro de ${convite.nome}`}>
              {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Copiar link"}
            </Button>
            <a
              href={convite.link}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "lg" })}
              aria-label={`Abrir cadastro de ${convite.nome}`}
            >
              <ExternalLink /> Abrir cadastro
            </a>
          </>
        )}
      </div>
    </li>
  );
}

export function TelaConvites() {
  const convites = useConvites({ intervaloMs: INTERVALO_CONVITES_MS });
  const criar = useCriarConvite();
  const origem = useOrigem();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) {
      setErro("Informe o nome do investidor");
      return;
    }
    setErro(null);
    try {
      const c = await criar.mutateAsync(nome);
      setNome("");
      toast.success(`Link de cadastro gerado para ${c.nome}`);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível gerar o link agora");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cadastrar investidores</h1>
        <p className="text-muted-foreground">
          Gere um link de cadastro e envie ao investidor. Ele preenche os dados, o perfil e escolhe o que compartilhar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5" /> Novo investidor
          </CardTitle>
          <CardDescription>O nome aparece na boas-vindas do cadastro. O resto o investidor preenche.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={gerar} className="flex flex-col gap-2 sm:flex-row sm:items-start" noValidate>
            <div className="flex-1">
              <label htmlFor="nome-investidor" className="sr-only">
                Nome do investidor
              </label>
              <input
                id="nome-investidor"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do investidor"
                autoComplete="off"
                aria-invalid={!!erro}
                aria-describedby={erro ? "erro-nome-investidor" : undefined}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              />
              {erro && (
                <p id="erro-nome-investidor" className="mt-1 text-xs text-destructive">
                  {erro}
                </p>
              )}
            </div>
            <Button type="submit" size="lg" disabled={criar.isPending}>
              <Link2 /> Gerar link de cadastro
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Convites</CardTitle>
          <CardDescription>O status atualiza sozinho quando o investidor abre ou conclui o cadastro.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {convites.isError ? (
            <ErroCarregar erro={convites.error} className="mx-4" />
          ) : !convites.data ? (
            <div className="flex flex-col gap-2 px-4" aria-label="Carregando">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : !convites.data.length ? (
            <Vazio className="mx-4">Nenhum convite ainda. Gere o primeiro link acima.</Vazio>
          ) : (
            <ul className="divide-y border-t">
              {convites.data.map((c) => (
                <LinhaConvite key={c.id} convite={c} origem={origem} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
