import { Suspense } from "react";
import { RotaCliente360 } from "@/components/assessor/rota-cliente-360";
import { Esqueleto360 } from "@/components/assessor/tela-cliente-360";

export default function Cliente360Page() {
  return (
    <Suspense fallback={<Esqueleto360 />}>
      <RotaCliente360 />
    </Suspense>
  );
}
