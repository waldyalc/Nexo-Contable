import type { ReactNode } from "react";

import { type MigaDePan, MigasDePan } from "@/components/pagina/migas-de-pan";
import { cn } from "@/lib/utils";

export interface EncabezadoPaginaProps {
  titulo: ReactNode;
  descripcion?: ReactNode;
  /** Ruta de navegación; la última miga se pinta como página actual. */
  migas?: readonly MigaDePan[];
  /** Botones a la derecha del título (1 primario + secundarios). */
  acciones?: ReactNode;
  className?: string;
}

/**
 * Encabezado de pantalla de Nexo: migas opcionales, título en Manrope,
 * descripción y un contenedor de acciones con botones uniformes de 36 px.
 */
export function EncabezadoPagina({
  titulo,
  descripcion,
  migas,
  acciones,
  className,
}: EncabezadoPaginaProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {migas && migas.length > 0 ? <MigasDePan items={migas} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display truncate text-xl font-semibold tracking-[-0.03em] text-foreground">
            {titulo}
          </h1>
          {descripcion ? (
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>

        {acciones ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&_button]:h-9 [&_button]:whitespace-nowrap">
            {acciones}
          </div>
        ) : null}
      </div>
    </header>
  );
}
