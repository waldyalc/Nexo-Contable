import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ElementoEsqueleto {
  id: string;
  indice: number;
}

function serieEsqueleto(
  cantidad: number,
  prefijo: string,
): ElementoEsqueleto[] {
  return Array.from({ length: Math.max(0, cantidad) }, (_, indice) => ({
    id: `${prefijo}-${indice + 1}`,
    indice,
  }));
}

export interface EsqueletoEncabezadoProps {
  titulo: string;
  descripcion?: string;
  acciones?: number;
  className?: string;
}

export function EsqueletoEncabezado({
  titulo,
  descripcion,
  acciones = 0,
  className,
}: EsqueletoEncabezadoProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-display truncate text-xl font-semibold tracking-[-0.03em] text-foreground">
          {titulo}
        </h1>
        {descripcion ? (
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>

      {acciones > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {serieEsqueleto(acciones, "accion-encabezado").map((accion) => (
            <Skeleton key={accion.id} className="h-9 w-32 rounded-[10px]" />
          ))}
        </div>
      ) : null}
    </header>
  );
}

export interface EsqueletoFiltrosProps {
  campos?: number;
  className?: string;
}

export function EsqueletoFiltros({
  campos = 4,
  className,
}: EsqueletoFiltrosProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      {serieEsqueleto(campos, "campo-filtro").map((campo) => (
        <div key={campo.id} className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3 w-20 rounded-[6px]" />
          <Skeleton className="h-9 w-full rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}

export interface EsqueletoTarjetasProps {
  cantidad?: number;
  className?: string;
}

export function EsqueletoTarjetas({
  cantidad = 4,
  className,
}: EsqueletoTarjetasProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {serieEsqueleto(cantidad, "tarjeta-resumen").map((tarjeta) => (
        <Card key={tarjeta.id} size="sm" className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-24 rounded-[6px]" />
            <Skeleton className="size-8 shrink-0 rounded-[8px] bg-secondary/80" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-32 rounded-[8px]" />
            <Skeleton className="mt-1.5 h-3 w-28 rounded-[6px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export interface EsqueletoTablaProps {
  filas?: number;
  columnas?: number;
  className?: string;
  titulo?: string;
  descripcion?: string;
  acciones?: number;
  filtros?: number;
}

export function EsqueletoTabla({
  filas = 8,
  columnas = 6,
  className,
  titulo,
  descripcion,
  acciones = 0,
  filtros = 0,
}: EsqueletoTablaProps) {
  const mostrarBarra =
    titulo !== undefined ||
    descripcion !== undefined ||
    acciones > 0 ||
    filtros > 0;
  const columnasEsqueleto = serieEsqueleto(columnas, "columna-tabla");
  const filasEsqueleto = serieEsqueleto(filas, "fila-tabla");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[15px] border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {mostrarBarra ? (
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              {titulo ? (
                <h2 className="font-display truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                  {titulo}
                </h2>
              ) : (
                <Skeleton className="h-4 w-36 rounded-[6px]" />
              )}
              {descripcion ? (
                <p className="text-sm text-muted-foreground">{descripcion}</p>
              ) : (
                <Skeleton className="h-3 w-56 rounded-[6px]" />
              )}
            </div>

            {acciones > 0 ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {serieEsqueleto(acciones, "accion-tabla").map((accion) => (
                  <Skeleton
                    key={accion.id}
                    className="h-9 w-32 rounded-[10px]"
                  />
                ))}
              </div>
            ) : null}
          </div>

          {filtros > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
              {serieEsqueleto(filtros, "filtro-tabla").map((filtro) => (
                <Skeleton
                  key={filtro.id}
                  className={cn(
                    "h-9 rounded-[10px]",
                    filtro.indice === 0 ? "w-52" : "w-40",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="h-12 border-border bg-muted/40 hover:bg-muted/40">
            {columnasEsqueleto.map((columna) => (
              <TableHead key={columna.id} className="h-12">
                <Skeleton className="h-3 w-16 rounded-[6px]" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filasEsqueleto.map((fila) => (
            <TableRow key={fila.id} className="h-14">
              {columnasEsqueleto.map((columna) => (
                <TableCell key={columna.id}>
                  <Skeleton
                    className={cn(
                      "h-4 rounded-[6px]",
                      columna.indice === 0 ? "w-28" : "w-full max-w-32",
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export interface EsqueletoGraficoProps {
  alto?: number;
  className?: string;
  titulo?: string;
  descripcion?: string;
}

export function EsqueletoGrafico({
  alto = 260,
  className,
  titulo,
  descripcion,
}: EsqueletoGraficoProps) {
  return (
    <Card className={className}>
      <CardHeader>
        {titulo ? (
          <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
            {titulo}
          </h2>
        ) : (
          <Skeleton className="h-4 w-40 rounded-[6px]" />
        )}
        {descripcion ? (
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        ) : (
          <Skeleton className="h-3 w-52 rounded-[6px]" />
        )}
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full rounded-[10px]" style={{ height: alto }} />
      </CardContent>
    </Card>
  );
}

export interface EsqueletoListaProps {
  filas?: number;
  className?: string;
  titulo?: string;
  descripcion?: string;
  conIconos?: boolean;
}

export function EsqueletoLista({
  filas = 5,
  className,
  titulo,
  descripcion,
  conIconos = true,
}: EsqueletoListaProps) {
  const mostrarEncabezado = titulo !== undefined || descripcion !== undefined;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[15px] border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {mostrarEncabezado ? (
        <div className="border-b border-border px-4 py-3">
          {titulo ? (
            <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
              {titulo}
            </h2>
          ) : (
            <Skeleton className="h-4 w-36 rounded-[6px]" />
          )}
          {descripcion ? (
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          ) : (
            <Skeleton className="mt-1 h-3 w-52 rounded-[6px]" />
          )}
        </div>
      ) : null}

      {serieEsqueleto(filas, "fila-lista").map((fila) => (
        <div
          key={fila.id}
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          {conIconos ? (
            <Skeleton className="size-9 shrink-0 rounded-[10px]" />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-2/5 rounded-[6px]" />
            <Skeleton className="h-3 w-3/5 rounded-[6px]" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0 rounded-[6px]" />
        </div>
      ))}
    </div>
  );
}

export interface EsqueletoReporteProps {
  titulo: string;
  descripcion?: string;
  filtros?: number;
  acciones?: number;
  filas?: number;
  columnas?: number;
  className?: string;
}

export function EsqueletoReporte({
  titulo,
  descripcion,
  filtros = 4,
  acciones = 2,
  filas = 10,
  columnas = 6,
  className,
}: EsqueletoReporteProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <EsqueletoEncabezado
        titulo={titulo}
        descripcion={descripcion}
        acciones={acciones}
      />
      {filtros > 0 ? <EsqueletoFiltros campos={filtros} /> : null}
      <EsqueletoTabla filas={filas} columnas={columnas} />
    </div>
  );
}

export interface EsqueletoPestanasProps {
  cantidad?: number;
  className?: string;
}

export function EsqueletoPestanas({
  cantidad = 3,
  className,
}: EsqueletoPestanasProps) {
  return (
    <div className={cn("w-full overflow-x-auto pb-0.5", className)}>
      <div className="inline-flex h-9 w-fit items-center rounded-[10px] bg-muted p-[3px]">
        {serieEsqueleto(cantidad, "pestana").map((pestana) => (
          <Skeleton
            key={pestana.id}
            className={cn(
              "mx-0.5 h-[calc(100%-2px)] rounded-lg",
              pestana.indice === 0
                ? "w-36 bg-card shadow-xs"
                : "w-28 bg-muted-foreground/10",
            )}
          />
        ))}
      </div>
    </div>
  );
}
