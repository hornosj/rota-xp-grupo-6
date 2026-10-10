/** Onboarding do investidor: tela cheia e responsivo (coluna única no celular, com etapas ao lado no desktop). */
export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
