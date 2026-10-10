import type { Metadata } from "next";
import { Palco } from "@/components/palco/palco";

export const metadata: Metadata = { title: "Palco · Copiloto do Assessor" };

export default function PalcoPage() {
  return <Palco />;
}
