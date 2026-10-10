import { Suspense } from "react";
import { EsqueletoRadar, TelaRadar } from "@/components/assessor/tela-radar";

export default function RadarPage() {
  return (
    <Suspense fallback={<EsqueletoRadar />}>
      <TelaRadar />
    </Suspense>
  );
}
