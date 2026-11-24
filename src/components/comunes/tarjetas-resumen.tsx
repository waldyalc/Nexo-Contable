import type { Icon } from "@tabler/icons-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export interface DatoResumen {
  etiqueta: string;
  valor: string;
  detalle?: string;
  icono: Icon;
}

export interface TarjetasResumenProps {
  etiqueta: string;
  datos: readonly DatoResumen[];
}

/** Fila de tarjetas KPI de un módulo: etiqueta, monto tabular y detalle. */
export function TarjetasResumen({ etiqueta, datos }: TarjetasResumenProps) {
  return (
    <section
      aria-label={etiqueta}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {datos.map((dato) => {
        const Icono = dato.icono;

        return (
          <Card key={dato.etiqueta} size="sm" className="gap-1">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardDescription>{dato.etiqueta}</CardDescription>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-secondary text-primary">
                <Icono className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground tabular-nums">
                {dato.valor}
              </p>
              {dato.detalle ? (
                <p className="text-xs text-muted-foreground">{dato.detalle}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
