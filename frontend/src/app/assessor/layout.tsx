import { CabecalhoApp } from "@/components/comum/cabecalho-app";

export default function AssessorLayout({ children }: LayoutProps<"/assessor">) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <CabecalhoApp />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-20 sm:px-8 sm:pt-14">{children}</main>
    </div>
  );
}
