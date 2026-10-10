"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SinoNotificacoes } from "@/components/assessor/sino-notificacoes";
import { useFila } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Marca "copiloto" com o quadradinho; `complemento` aparece ao lado (ex.: "Cadastro de investidor"). */
export function Marca({ complemento }: { complemento?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-2xl font-extrabold tracking-tight">copiloto</span>
      <span aria-hidden className="size-2 bg-current" />
      {complemento && <span className="ml-2 hidden text-[15px] font-normal text-white/80 sm:inline">{complemento}</span>}
    </span>
  );
}

const LINKS = [
  { href: "/assessor/hoje", rotulo: "Hoje", contador: true },
  { href: "/assessor", rotulo: "Meus clientes", contador: false },
  { href: "/assessor/radar", rotulo: "Radar de notícias", contador: false },
  { href: "/assessor/convites", rotulo: "Cadastrar investidores", contador: false },
] as const;

function ativo(href: string, caminho: string) {
  if (href === "/assessor") return caminho === "/assessor" || caminho.startsWith("/assessor/clientes");
  return caminho.startsWith(href);
}

function Navegacao({ caminho }: { caminho: string }) {
  const fila = useFila();
  const comMotivo = fila.data?.filter((i) => i.prioridade > 0).length;
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-wrap gap-x-7 text-base">
      {LINKS.map((l) => {
        const atual = ativo(l.href, caminho);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 py-6 text-white/80 transition hover:text-white",
              atual && "font-bold text-white shadow-[inset_0_-4px_0_#fff]",
            )}
          >
            {l.rotulo}
            {l.contador && comMotivo != null && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[13px] font-extrabold text-black">{comMotivo}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** O caminho só existe em tempo de execução: fica atrás do Suspense para não bloquear o pré-render. */
function NavegacaoAtual() {
  return <Navegacao caminho={usePathname()} />;
}

function SinoAtual() {
  return <SinoNotificacoes atual={usePathname().startsWith("/assessor/notificacoes")} />;
}

/** Barra preta do topo: marca, navegação do assessor e quem está logado. */
export function CabecalhoApp() {
  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex min-h-18 w-full max-w-7xl flex-wrap items-center gap-x-10 gap-y-1 px-4 sm:px-8">
        <Link href="/" aria-label="Copiloto do Assessor: início" className="py-3">
          <Marca />
        </Link>
        <Suspense fallback={<Navegacao caminho="" />}>
          <NavegacaoAtual />
        </Suspense>
        <Suspense fallback={<SinoNotificacoes />}>
          <SinoAtual />
        </Suspense>
        <span className="hidden items-center gap-2.5 text-[15px] text-white/80 md:flex">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-white font-extrabold text-black">
            B
          </span>
          Bruno · ass-001
        </span>
      </div>
    </header>
  );
}
