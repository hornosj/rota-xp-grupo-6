"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ChipPerfil, ErroCarregar, Sobretitulo, Vazio } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-base";
import type { ConviteOnboarding, StatusConvite } from "@/lib/api-types";
import { dataHora } from "@/lib/formato";
import { useConvites, useCriarConvite } from "@/lib/queries";
import { cn } from "@/lib/utils";

const INTERVALO_CONVITES_MS = 3000;

/** Concluído preenchido de preto, em preenchimento contornado, link gerado em cinza; `passos` de 3. */
const statusConvite: Record<StatusConvite, { rotulo: string; cor: string; passos: number }> = {
  PENDENTE: { rotulo: "Link gerado", cor: "bg-muted text-muted-foreground", passos: 0 },
  ABERTO: { rotulo: "Em preenchimento", cor: "bg-white text-black ring-1 ring-black", passos: 2 },
  CONCLUIDO: { rotulo: "Cadastro concluído", cor: "bg-black text-white", passos: 3 },
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
    <li data-testid={`convite-${convite.id}`} className="flex flex-wrap items-center justify-between gap-4 border-t px-6 py-6 sm:px-7">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-lg font-bold">{convite.nome}</p>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[13px] font-bold", st.cor)}>{st.rotulo}</span>
          {convite.perfil && <ChipPerfil perfil={convite.perfil} />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("h-1.5 w-12 rounded-full", i < st.passos ? "bg-black" : "bg-[#e0e0e0]")} />
            ))}
          </span>
          <span className="text-[15px] text-muted-foreground">
            Gerado em {dataHora(convite.criadoEm)}
            {convite.concluidoEm && <> · concluído em {dataHora(convite.concluidoEm)}</>}
          </span>
        </div>
        {convite.status !== "CONCLUIDO" && (
          <p className="truncate font-mono text-sm text-muted-foreground" title={url}>
            {url}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2.5">
        {convite.status === "CONCLUIDO" && convite.clienteId ? (
          <Link href={`/assessor/clientes/${convite.clienteId}`} className={buttonVariants()}>
            Ver visão 360
          </Link>
        ) : (
          <>
            <Button variant="outline" onClick={copiar} aria-label={`Copiar link de cadastro de ${convite.nome}`}>
              {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Copiar link"}
            </Button>
            <a
              href={convite.link}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants()}
              aria-label={`Abrir cadastro de ${convite.nome}`}
            >
              Abrir cadastro <ArrowUpRight />
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
    <div className="flex flex-wrap items-start gap-8">
      <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-7">
        <div className="flex flex-col gap-3">
          <Sobretitulo>Captação</Sobretitulo>
          <h1 className="text-5xl leading-none font-extrabold tracking-tight">Cadastrar investidores</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Gere um link e envie ao investidor. Ele preenche os dados, responde o perfil e escolhe o que compartilhar pelo
            Open Finance.
          </p>
        </div>

        <form onSubmit={gerar} className="flex flex-col gap-3 rounded-3xl bg-black p-7 text-white" noValidate>
          <label htmlFor="nome-investidor" className="text-[17px] font-bold">
            Nome do investidor
          </label>
          <input
            id="nome-investidor"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Carla Mendes"
            autoComplete="off"
            aria-invalid={!!erro}
            aria-describedby={erro ? "erro-nome-investidor" : "dica-nome-investidor"}
            className="h-14 w-full rounded-2xl bg-white px-4 text-lg text-black outline-none placeholder:text-[#6b6b6b] focus-visible:ring-4 focus-visible:ring-white/40"
          />
          {erro ? (
            <p id="erro-nome-investidor" role="alert" className="text-[15px] font-bold underline underline-offset-4">
              {erro}
            </p>
          ) : (
            <p id="dica-nome-investidor" className="text-[15px] text-white/85">
              O nome aparece na boas-vindas. O resto o investidor preenche.
            </p>
          )}
          <Button type="submit" variant="inverso" size="lg" className="mt-1" disabled={criar.isPending}>
            <Link2 /> Gerar link de cadastro
          </Button>
        </form>

        <ol className="flex flex-col gap-3.5">
          {["Seus dados: nome, CPF, contato e família", "Perfil de investidor: 5 perguntas rápidas", "O que compartilhar pelo Open Finance"].map(
            (t, i) => (
              <li key={t} className="flex items-baseline gap-3.5 text-[17px]">
                <span className="text-2xl font-extrabold">{String(i + 1).padStart(2, "0")}</span>
                {t}
              </li>
            ),
          )}
        </ol>
      </section>

      <section className="min-w-0 flex-[999_1_600px] overflow-hidden rounded-3xl border">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 py-6 sm:px-7">
          <h2 className="text-2xl font-extrabold tracking-tight">Convites</h2>
          <p className="text-[15px] text-muted-foreground">O status atualiza sozinho quando o investidor abre ou conclui.</p>
        </div>
        {convites.isError ? (
          <ErroCarregar erro={convites.error} className="mx-6 mb-6" />
        ) : !convites.data ? (
          <div className="flex flex-col gap-2 px-6 pb-6" aria-label="Carregando">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : !convites.data.length ? (
          <Vazio className="mx-6 mb-6">Nenhum convite ainda. Gere o primeiro link ao lado.</Vazio>
        ) : (
          <ul>
            {convites.data.map((c) => (
              <LinhaConvite key={c.id} convite={c} origem={origem} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
