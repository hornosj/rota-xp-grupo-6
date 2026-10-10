import { cn } from "@/lib/utils";
import type { GeradoPor, PerfilInvestidor, PosicaoXp, Severidade } from "@/lib/api-types";
import { rotuloPerfil, rotuloPosicaoXp, rotuloSeveridade } from "@/lib/rotulos";

// Preto e branco: o que importa vai preenchido de preto; o resto, contornado ou em cinza.
const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap";

const corPosicao: Record<PosicaoXp, string> = {
  PRINCIPAL: "bg-black text-white ring-1 ring-black",
  SECUNDARIA: "bg-white text-black ring-1 ring-black",
  SO_INVESTIMENTOS: "bg-white text-black ring-1 ring-black",
  AUSENTE: "bg-muted text-muted-foreground",
};

export function BadgePosicaoXp({ posicao, className }: { posicao: PosicaoXp; className?: string }) {
  return <span className={cn(base, corPosicao[posicao], className)}>{rotuloPosicaoXp[posicao]}</span>;
}

export function ChipPerfil({ perfil, className }: { perfil: PerfilInvestidor; className?: string }) {
  return <span className={cn(base, "font-semibold ring-1 ring-black", className)}>{rotuloPerfil[perfil]}</span>;
}

/** ALTA preenchido de preto, MÉDIA contornado, BAIXA em cinza. */
const corSeveridade: Record<Severidade, string> = {
  ALTA: "bg-black text-white ring-2 ring-black",
  MEDIA: "bg-white text-black ring-2 ring-black",
  BAIXA: "bg-muted text-muted-foreground ring-2 ring-muted",
};

export function ChipSeveridade({ severidade }: { severidade: Severidade }) {
  return (
    <span className={cn(base, "rounded-md px-2 text-xs tracking-wide uppercase", corSeveridade[severidade])}>
      {rotuloSeveridade[severidade]}
    </span>
  );
}

/** Tag NOVO pulsante. */
export function TagNovo({ className }: { className?: string }) {
  return (
    <span className={cn(base, "animate-novo bg-black text-[11px] font-extrabold tracking-wider text-white", className)}>
      NOVO
    </span>
  );
}

const rotuloGerado: Record<GeradoPor, string> = {
  stub: "stub (modelo)",
  cache: "cache (IA gravada)",
  live: "live (IA ao vivo)",
};

export function BadgeGeradoPor({ geradoPor }: { geradoPor: GeradoPor }) {
  return (
    <span data-testid="gerado-por" className={cn(base, "font-semibold ring-1 ring-black")}>
      gerado por {rotuloGerado[geradoPor] ?? geradoPor}
    </span>
  );
}

/** Rótulo pequeno em caixa alta acima de títulos. */
export function Sobretitulo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm font-bold tracking-[0.12em] uppercase", className)}>{children}</p>;
}

export function Vazio({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border-2 border-dashed p-6 text-center text-base text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function ErroCarregar({ erro, className }: { erro: unknown; className?: string }) {
  const msg = erro instanceof Error ? erro.message : "Erro inesperado";
  return (
    <div className={cn("rounded-2xl border-2 border-black p-6 text-base", className)}>
      <p className="font-bold">Não foi possível carregar os dados.</p>
      <p className="mt-1 text-muted-foreground">{msg}</p>
    </div>
  );
}
