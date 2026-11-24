"use client";

import { IconAlertTriangle, IconHome, IconRefresh } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ErrorModuloProps {
  error: unknown;
  reset: () => void;
}

export default function ErrorModulo({ error, reset }: ErrorModuloProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[55vh] items-center justify-center py-8">
      <section className="w-full max-w-lg rounded-[15px] border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <IconAlertTriangle className="size-6" aria-hidden="true" />
        </div>

        <h1 className="font-display mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
          Algo salió mal al cargar este módulo
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede ser un error temporal de conexión o de datos. Reintenta la carga
          o vuelve al Resumen para continuar trabajando.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" onClick={() => reset()}>
            <IconRefresh className="size-4" aria-hidden="true" />
            Reintentar
          </Button>
          <Button variant="outline" render={<Link href="/" />}>
            <IconHome className="size-4" aria-hidden="true" />
            Volver al Resumen
          </Button>
        </div>
      </section>
    </div>
  );
}
