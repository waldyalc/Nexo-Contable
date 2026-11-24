import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TarjetaListaProps {
  children: ReactNode;
  className?: string;
  /** Identificador para pruebas e2e, por ejemplo `data-lista="facturas"`. */
  "data-lista"?: string;
}

/**
 * Contenedor blanco de listas y tablas: radio 15 px, borde `--border`
 * y la sombra suave de las tarjetas de Nexo.
 */
export function TarjetaLista({
  children,
  className,
  "data-lista": dataLista,
}: TarjetaListaProps) {
  return (
    <div
      data-lista={dataLista}
      className={cn(
        "overflow-hidden rounded-[15px] border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
