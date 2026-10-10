import { Suspense } from "react";
import { EsqueletoJornada } from "@/components/cliente/jornada-cliente";
import { RotaJornada } from "@/components/cliente/rotas";

export default function JornadaPage() {
  return (
    <Suspense fallback={<EsqueletoJornada />}>
      <RotaJornada />
    </Suspense>
  );
}
