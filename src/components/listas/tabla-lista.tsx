"use client";

import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconChevronLeft,
  IconChevronRight,
  IconInbox,
} from "@tabler/icons-react";
import {
  type ColumnDef,
  type Header,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { type ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type AlineacionColumna = "izquierda" | "derecha" | "centro";

export interface ColumnaLista<T> {
  clave: string;
  encabezado: string;
  celda: (fila: T) => ReactNode;
  /** Las columnas de montos usan `derecha` y cifras tabulares. */
  alineacion?: AlineacionColumna;
  /** Permite desactivar el orden en una columna concreta. */
  ordenable?: boolean;
  className?: string;
}

export interface VacioLista {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  accion?: ReactNode;
}

export interface PaginacionLista {
  tamanoPagina?: number;
  /** Sustantivo del contador: "facturas", "registros"… */
  etiqueta?: string;
}

export interface TablaListaProps<T> {
  columnas: readonly ColumnaLista<T>[];
  filas: readonly T[];
  claveFila: (fila: T) => string;
  vacio?: VacioLista;
  /** Activa el ordenamiento por clic en los encabezados. */
  ordenable?: boolean;
  /** Paginación local en el cliente; sin esta prop la tabla muestra todas las filas. */
  paginacion?: PaginacionLista;
  className?: string;
}

const ALINEACION: Record<AlineacionColumna, string> = {
  izquierda: "text-left",
  derecha: "text-right tabular-nums",
  centro: "text-center",
};

function EstadoVacio({ titulo, descripcion, icono, accion }: VacioLista) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="text-muted-foreground/60">
        {icono ?? <IconInbox className="size-8" />}
      </div>
      <p className="font-display text-base font-semibold text-foreground">
        {titulo}
      </p>
      {descripcion ? (
        <p className="max-w-sm text-sm text-muted-foreground">{descripcion}</p>
      ) : null}
      {accion ? <div className="pt-2">{accion}</div> : null}
    </div>
  );
}

/**
 * Tabla de lista de Nexo sobre `@tanstack/react-table`:
 * encabezados de 48 px en mayúsculas, montos con `tabular-nums`, ordenamiento
 * opcional, estado vacío y paginación local opcional.
 */
export function TablaLista<T>({
  columnas,
  filas,
  claveFila,
  vacio,
  ordenable = false,
  paginacion,
  className,
}: TablaListaProps<T>) {
  const [orden, setOrden] = useState<SortingState>([]);

  const columnasPorClave = useMemo(
    () => new Map(columnas.map((columna) => [columna.clave, columna])),
    [columnas],
  );

  const columnasTabla = useMemo<ColumnDef<T>[]>(
    () =>
      columnas.map((columna) => ({
        id: columna.clave,
        accessorFn: (fila: T) => fila,
        header: columna.encabezado,
        enableSorting: ordenable && columna.ordenable !== false,
        cell: ({ row }) => columna.celda(row.original),
      })),
    [columnas, ordenable],
  );

  const tabla = useReactTable({
    data: [...filas],
    columns: columnasTabla,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (fila) => claveFila(fila),
    ...(paginacion
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: {
            pagination: { pageSize: paginacion.tamanoPagina ?? 25 },
          },
        }
      : {}),
  });

  const filasVisibles = tabla.getRowModel().rows;
  const total = filas.length;
  const { pageIndex, pageSize } = tabla.getState().pagination;
  const totalPaginas = Math.max(tabla.getPageCount(), 1);
  const inicio = total === 0 ? 0 : pageIndex * pageSize + 1;
  const fin = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className={cn("flex flex-col", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
            {tabla.getHeaderGroups().map((grupo) => (
              <HeaderFila
                key={grupo.id}
                headers={grupo.headers}
                columnas={columnasPorClave}
              />
            ))}
          </TableRow>
        </TableHeader>

        {filasVisibles.length > 0 ? (
          <TableBody>
            {filasVisibles.map((fila) => (
              <TableRow key={fila.id}>
                {fila.getVisibleCells().map((celda) => {
                  const columna = columnasPorClave.get(celda.column.id);
                  return (
                    <TableCell
                      key={celda.id}
                      className={cn(
                        "h-14",
                        ALINEACION[columna?.alineacion ?? "izquierda"],
                        columna?.className,
                      )}
                    >
                      {flexRender(
                        celda.column.columnDef.cell,
                        celda.getContext(),
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        ) : null}
      </Table>

      {filasVisibles.length === 0 ? (
        <div className="px-4 py-6">
          <EstadoVacio
            titulo={vacio?.titulo ?? "Sin registros"}
            descripcion={vacio?.descripcion}
            icono={vacio?.icono}
            accion={vacio?.accion}
          />
        </div>
      ) : null}

      {paginacion && total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground tabular-nums">
            Mostrando {inicio}–{fin} de {total}{" "}
            {paginacion.etiqueta ?? "registros"}
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={!tabla.getCanPreviousPage()}
              onClick={() => tabla.previousPage()}
            >
              <IconChevronLeft />
            </Button>
            <span className="min-w-28 text-center text-muted-foreground tabular-nums">
              Página {pageIndex + 1} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página siguiente"
              disabled={!tabla.getCanNextPage()}
              onClick={() => tabla.nextPage()}
            >
              <IconChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderFila<T>({
  headers,
  columnas,
}: {
  headers: Header<T, unknown>[];
  columnas: Map<string, ColumnaLista<T>>;
}) {
  return (
    <>
      {headers.map((header) => {
        const columna = columnas.get(header.column.id);
        const ordenActual = header.column.getIsSorted();

        return (
          <TableHead
            key={header.id}
            colSpan={header.colSpan}
            className={cn(
              "h-12",
              ALINEACION[columna?.alineacion ?? "izquierda"],
              columna?.className,
            )}
          >
            {header.isPlaceholder ? null : header.column.getCanSort() ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={header.column.getToggleSortingHandler()}
                className="-ml-2 h-8 gap-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
                {ordenActual === "asc" ? (
                  <IconArrowUp className="size-3.5" />
                ) : ordenActual === "desc" ? (
                  <IconArrowDown className="size-3.5" />
                ) : (
                  <IconArrowsSort className="size-3.5 opacity-50" />
                )}
              </Button>
            ) : (
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </span>
            )}
          </TableHead>
        );
      })}
    </>
  );
}
