import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TonoPill = "exito" | "pendiente" | "peligro" | "neutro";

const TONO_POR_ESTADO: Record<string, TonoPill> = {
  saldada: "exito",
  saldado: "exito",
  activa: "exito",
  activo: "exito",
  pagada: "exito",
  pagado: "exito",
  contabilizado: "exito",
  contabilizada: "exito",
  abierto: "exito",
  aprobada: "exito",
  aprobado: "exito",
  pendiente: "pendiente",
  parcial: "pendiente",
  vencida: "peligro",
  vencido: "peligro",
  anulada: "peligro",
  anulado: "peligro",
  rechazada: "peligro",
  rechazado: "peligro",
  borrador: "neutro",
  inactiva: "neutro",
  inactivo: "neutro",
  cerrado: "neutro",
  cerrada: "neutro",
};

const CLASES_TONO: Record<TonoPill, string> = {
  exito: "bg-secondary text-secondary-foreground",
  pendiente: "bg-[var(--warning)]/15 text-[var(--warning)]",
  peligro: "bg-destructive/10 text-destructive",
  neutro: "bg-muted text-muted-foreground",
};

const CLASES_PUNTO: Record<TonoPill, string> = {
  exito: "bg-primary",
  pendiente: "bg-[var(--warning)]",
  peligro: "bg-destructive",
  neutro: "bg-muted-foreground/60",
};

export interface PillEstadoProps {
  /** Estado del documento: `saldada`, `pendiente`, `anulada`, `borrador`… */
  estado: string;
  /** Fuerza un tono concreto en lugar de deducirlo del estado. */
  tono?: TonoPill;
  children?: ReactNode;
  className?: string;
}

/**
 * Etiqueta de estado con punto indicador. El tono se deduce del nombre del
 * estado; los estados desconocidos se muestran en gris.
 */
export function PillEstado({
  estado,
  tono,
  children,
  className,
}: PillEstadoProps) {
  const clave = estado.trim().toLowerCase();
  const tonoFinal = tono ?? TONO_POR_ESTADO[clave] ?? "neutro";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        CLASES_TONO[tonoFinal],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          CLASES_PUNTO[tonoFinal],
        )}
      />
      {children ?? estado}
    </span>
  );
}
