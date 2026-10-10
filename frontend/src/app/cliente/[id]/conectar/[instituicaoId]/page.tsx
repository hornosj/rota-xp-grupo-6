import { Suspense } from "react";
import { EsqueletoJornada } from "@/components/cliente/jornada-cliente";
import { RotaConectar } from "@/components/cliente/rotas";

export default function ConectarPage() {
  return (
    <Suspense fallback={<EsqueletoJornada />}>
      <RotaConectar />
    </Suspense>
  );
}
