import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { ChipPerfil } from "@/components/comum/marcadores";
import type { Visao360 } from "@/lib/api-types";
import { dataHora } from "@/lib/formato";
import { CoberturaConvites } from "./cobertura-convites";

/** `acoes`: botões abaixo do nome (ex.: "Editar cliente"). */
export function CabecalhoCliente({ visao, aoVivo, acoes }: { visao: Visao360; aoVivo?: boolean; acoes?: ReactNode }) {
  const { cliente } = visao;
  return (
    <header className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{cliente.nome}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span>{cliente.idade} anos</span>·<span>{cliente.profissao}</span>·
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {cliente.cidade}
          </span>
          <ChipPerfil perfil={cliente.perfil} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Atualizado em {dataHora(visao.atualizadoEm)}</p>
        {acoes && <div className="mt-3 flex flex-wrap gap-2">{acoes}</div>}
      </div>
      <CoberturaConvites visao={visao} aoVivo={aoVivo} />
    </header>
  );
}
