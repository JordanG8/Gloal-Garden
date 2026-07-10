import Link from "next/link";
import { Sprout } from "lucide-react";

/**
 * Shared frame for every account screen: a deep-green brand panel on desktop,
 * a quiet centered column for the form itself. All the whitespace lives here
 * so the individual forms stay minimal.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[5fr_7fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-16 xl:p-20">
        <Link href="/" className="inline-flex items-center gap-3 w-fit">
          <Sprout className="w-6 h-6" strokeWidth={1.75} />
          <span className="font-heading text-xl tracking-tight">Global Garden</span>
        </Link>

        <div>
          <h2 className="font-heading text-4xl xl:text-5xl leading-[1.12] font-medium max-w-md">
            Food grows better when a whole street looks after it.
          </h2>
          <p className="mt-8 text-primary-foreground/70 max-w-sm leading-relaxed">
            Map public plants, water the thirsty ones, and share the harvest
            with your neighbors.
          </p>
        </div>

        <p className="text-[11px] uppercase tracking-[0.25em] text-primary-foreground/50">
          A neighborhood accountability garden
        </p>
      </aside>

      <section className="flex min-h-screen flex-col">
        <div className="p-6 md:p-8 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2 text-primary">
            <Sprout className="w-5 h-5" strokeWidth={1.75} />
            <span className="font-heading text-lg tracking-tight">Global Garden</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-20 pt-8 md:px-12 lg:py-24">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </section>
    </main>
  );
}
