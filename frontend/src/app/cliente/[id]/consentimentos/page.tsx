import { Suspense } from "react";
import { EsqueletoJornada } from "@/components/cliente/jornada-cliente";
import { RotaConsentimentos } from "@/components/cliente/rotas";

export default function ConsentimentosPage() {
  return (
    <Suspense fallback={<EsqueletoJornada />}>
      <RotaConsentimentos />
    </Suspense>
  );
}
