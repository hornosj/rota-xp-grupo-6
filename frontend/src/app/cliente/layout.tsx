export default function ClienteLayout({ children }: LayoutProps<"/cliente">) {
  return (
    <div className="flex min-h-screen justify-center bg-slate-100">
      <div className="relative min-h-screen w-full max-w-[420px] bg-white shadow-sm">{children}</div>
    </div>
  );
}
