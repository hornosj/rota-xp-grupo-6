import type { Metadata } from "next";
import { Suspense } from "react";
import { RotaConvite } from "@/components/convite/rota-convite";

export const metadata: Metadata = { title: "Convite Open Finance (simulado)" };

export default function ConvitePage() {
  return (
    <Suspense>
      <RotaConvite />
    </Suspense>
  );
}
