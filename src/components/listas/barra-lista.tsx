import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface BarraListaProps {
  titulo: ReactNode;
  descripcion?: ReactNode;
  /** Acciones del encabezado: 1 botón primario y secundarios `outline`. */
  acciones?: ReactNode;
  /** Filtros de la franja inferior: `MonthPicker`, buscador, `SelectCampo`… */
  filtros?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Cabecera de una lista: título + acciones en la primera fila y una franja
 * separada para filtros. Los botones siempre miden 36 px y no se parten.
 */
export function BarraLista({
  titulo,
  descripcion,
  acciones,
  filtros,
  children,
  className,
}: BarraListaProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-display truncate text-base font-semibold tracking-[-0.02em] text-foreground">
            {titulo}
          </h2>
          {descripcion ? (
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>

        {acciones ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&_button]:h-9 [&_button]:whitespace-nowrap [&_button]:shrink-0">
            {acciones}
          </div>
        ) : null}
      </div>

      {filtros ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
          {filtros}
        </div>
      ) : null}

      {children}
    </div>
  );
}
