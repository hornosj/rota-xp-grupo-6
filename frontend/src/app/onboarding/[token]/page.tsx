import { Suspense } from "react";
import { EsqueletoOnboarding, RotaOnboarding } from "@/components/onboarding/wizard-onboarding";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<EsqueletoOnboarding />}>
      <RotaOnboarding />
    </Suspense>
  );
}
