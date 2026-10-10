import { Suspense } from "react";
import { EsqueletoFila, TelaHoje } from "@/components/assessor/tela-hoje";

export default function HojePage() {
  return (
    <Suspense fallback={<EsqueletoFila />}>
      <TelaHoje />
    </Suspense>
  );
}
