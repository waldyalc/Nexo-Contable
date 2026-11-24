import { IconCompass, IconHome } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFoundRaiz() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-[15px] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-[12px] bg-primary font-display text-xl font-bold text-primary-foreground">
          N
        </div>

        <div className="mx-auto mt-5 flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
          <IconCompass className="size-6" aria-hidden="true" />
        </div>

        <p className="mt-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Error 404 · Nexo Contable
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La dirección no existe o el contenido fue movido. Regresa al Resumen
          para seguir trabajando en tu contabilidad.
        </p>

        <div className="mt-6 flex justify-center">
          <Button render={<Link href="/" />}>
            <IconHome className="size-4" aria-hidden="true" />
            Volver al Resumen
          </Button>
        </div>
      </section>
    </main>
  );
}
