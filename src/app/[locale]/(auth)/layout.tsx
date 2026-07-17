export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-cream shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        {children}
      </div>
    </div>
  );
}
