"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAoVivo } from "@/lib/ao-vivo";
import { FluxoConectar } from "./fluxo-conectar";
import { JornadaCliente } from "./jornada-cliente";
import { ListaConsentimentos } from "./lista-consentimentos";

export function RotaJornada() {
  const { id } = useParams<{ id: string }>();
  const aoVivo = useAoVivo();
  return <JornadaCliente key={id} clienteId={id} aoVivo={aoVivo} />;
}

export function RotaConectar() {
  const { id, instituicaoId } = useParams<{ id: string; instituicaoId: string }>();
  return <FluxoConectar key={`${id}-${instituicaoId}`} clienteId={id} instituicaoId={instituicaoId} />;
}

export function RotaConsentimentos() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href={`/cliente/${id}`} aria-label="Voltar" className="rounded-full p-1 hover:bg-slate-100">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold">Meus dados compartilhados</h1>
      </div>
      <p className="text-sm text-slate-600">
        Pela LGPD e pelo Open Finance, você decide quem vê seus dados, por quanto tempo, e pode revogar quando quiser.
      </p>
      <ListaConsentimentos clienteId={id} />
    </div>
  );
}
