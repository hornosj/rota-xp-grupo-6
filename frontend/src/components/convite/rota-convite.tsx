"use client";

import { useParams } from "next/navigation";
import { TelaConvite } from "./tela-convite";

export function RotaConvite() {
  const { token } = useParams<{ token: string }>();
  return <TelaConvite key={token} token={token} />;
}
