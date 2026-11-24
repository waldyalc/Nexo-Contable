import { IconFileSearch, IconHome } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFoundApp() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center py-8">
      <section className="w-full max-w-lg rounded-[15px] border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <IconFileSearch className="size-6" aria-hidden="true" />
        </div>

        <p className="mt-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Error 404
        </p>
        <h1 className="font-display mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">
          Página no encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El módulo o recurso que buscas no existe, fue movido o ya no está
          disponible para tu empresa activa.
        </p>

        <div className="mt-6 flex justify-center">
          <Button render={<Link href="/" />}>
            <IconHome className="size-4" aria-hidden="true" />
            Volver al Resumen
          </Button>
        </div>
      </section>
    </div>
  );
}
