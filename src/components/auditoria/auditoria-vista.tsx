"use client";

import {
  IconChevronLeft,
  IconChevronRight,
  IconHistory,
  IconSearch,
  IconShieldLock,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DateRangePicker } from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ZONA_HORARIA } from "@/lib/formato";

export interface AuditoriaRegistro {
  id: number;
  actorId: string | null;
  accion: string;
  entidad: string;
  entidadId: string;
  detalles: unknown;
  creadoEn: string;
}

export interface AuditoriaFiltros {
  desde: string;
  hasta: string;
  entidad: string;
  busqueda: string;
}

export interface AuditoriaPaginacion {
  pagina: number;
  totalPaginas: number;
  total: number;
}

export interface AuditoriaVistaProps {
  registros: readonly AuditoriaRegistro[];
  actores: Record<string, string>;
  entidades: readonly string[];
  filtros: AuditoriaFiltros;
  paginacion: AuditoriaPaginacion;
}

function formatearFechaHora(valor: string): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat("es-DO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(fecha);
}

function tieneDetalles(detalles: unknown): boolean {
  if (detalles === null || detalles === undefined) return false;
  if (typeof detalles === "object") return Object.keys(detalles).length > 0;
  return true;
}

export function AuditoriaVista({
  registros,
  actores,
  entidades,
  filtros,
  paginacion,
}: AuditoriaVistaProps) {
  const router = useRouter();
  const [rango, setRango] = useState({
    desde: filtros.desde,
    hasta: filtros.hasta,
  });
  const [entidad, setEntidad] = useState(filtros.entidad);
  const [busqueda, setBusqueda] = useState(filtros.busqueda);
  const [detalle, setDetalle] = useState<AuditoriaRegistro | null>(null);

  const opcionesEntidades = useMemo(
    () => entidades.map((valor) => ({ value: valor, label: valor })),
    [entidades],
  );

  function construirUrl(siguiente: {
    desde: string;
    hasta: string;
    entidad: string;
    busqueda: string;
    pagina: number;
  }): string {
    const params = new URLSearchParams();
    if (siguiente.desde !== "") params.set("desde", siguiente.desde);
    if (siguiente.hasta !== "") params.set("hasta", siguiente.hasta);
    if (siguiente.entidad !== "") params.set("entidad", siguiente.entidad);
    if (siguiente.busqueda !== "") params.set("q", siguiente.busqueda);
    if (siguiente.pagina > 1) params.set("pagina", String(siguiente.pagina));
    const consulta = params.toString();
    return consulta === "" ? "/auditoria" : `/auditoria?${consulta}`;
  }

  function aplicar(cambios: Partial<AuditoriaFiltros>) {
    const siguiente = {
      desde: cambios.desde ?? rango.desde,
      hasta: cambios.hasta ?? rango.hasta,
      entidad: cambios.entidad ?? entidad,
      busqueda: cambios.busqueda ?? busqueda,
      pagina: 1,
    };
    router.replace(construirUrl(siguiente), { scroll: false });
  }

  function urlPagina(pagina: number): string {
    return construirUrl({
      desde: rango.desde,
      hasta: rango.hasta,
      entidad,
      busqueda,
      pagina,
    });
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoría"
        descripcion="Registro append-only de las operaciones de la empresa activa."
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Auditoría" }]}
        acciones={
          <span className="flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-sm text-muted-foreground">
            <IconShieldLock className="size-4" />
            Solo lectura
          </span>
        }
      />

      <TarjetaLista data-lista="auditoria">
        <BarraLista
          titulo="Bitácora de la empresa"
          descripcion={`${paginacion.total} registros · página ${paginacion.pagina} de ${paginacion.totalPaginas}`}
          filtros={
            <>
              <div className="w-[260px]">
                <DateRangePicker
                  value={rango}
                  onChange={(siguiente) => {
                    setRango(siguiente);
                    aplicar({
                      desde: siguiente.desde,
                      hasta: siguiente.hasta,
                    });
                  }}
                  placeholder="Rango de fechas"
                />
              </div>

              <SelectCampo
                id="filtro-entidad-auditoria"
                opciones={opcionesEntidades}
                valor={entidad}
                onCambio={(valor) => {
                  setEntidad(valor);
                  aplicar({ entidad: valor });
                }}
                etiquetaVacia="Todas las entidades"
                className="w-[190px]"
                aria-label="Filtrar auditoría por entidad"
              />

              <form
                className="flex items-center gap-2"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  aplicar({ busqueda });
                }}
              >
                <div className="relative w-full sm:w-64">
                  <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder="Buscar acción o identificador…"
                    aria-label="Buscar en la auditoría"
                    className="h-9 pl-8"
                  />
                </div>
                <Button type="submit" variant="outline">
                  Buscar
                </Button>
              </form>
            </>
          }
        >
          <TablaLista<AuditoriaRegistro>
            filas={registros}
            claveFila={(registro) => String(registro.id)}
            vacio={{
              titulo: "Sin registros de auditoría",
              descripcion:
                "Ajusta el rango de fechas o los filtros para ampliar la búsqueda.",
              icono: <IconHistory className="size-8" />,
            }}
            columnas={[
              {
                clave: "fecha",
                encabezado: "Fecha y hora",
                celda: (registro) => (
                  <span className="text-sm whitespace-nowrap tabular-nums">
                    {formatearFechaHora(registro.creadoEn)}
                  </span>
                ),
              },
              {
                clave: "actor",
                encabezado: "Actor",
                celda: (registro) => (
                  <span className="text-sm text-foreground">
                    {registro.actorId === null
                      ? "Sistema"
                      : (actores[registro.actorId] ?? registro.actorId)}
                  </span>
                ),
              },
              {
                clave: "accion",
                encabezado: "Acción",
                celda: (registro) => (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {registro.accion}
                  </span>
                ),
              },
              {
                clave: "entidad",
                encabezado: "Entidad",
                celda: (registro) => registro.entidad,
              },
              {
                clave: "entidad-id",
                encabezado: "Entidad ID",
                celda: (registro) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {registro.entidadId === "" ? "—" : registro.entidadId}
                  </span>
                ),
              },
              {
                clave: "detalles",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (registro) =>
                  tieneDetalles(registro.detalles) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetalle(registro)}
                    >
                      Ver detalles
                    </Button>
                  ) : null,
              },
            ]}
          />
        </BarraLista>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground tabular-nums">
            {paginacion.total === 0
              ? "Sin registros"
              : `Registros ${(paginacion.pagina - 1) * 50 + 1}–${Math.min(
                  paginacion.pagina * 50,
                  paginacion.total,
                )} de ${paginacion.total}`}
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={paginacion.pagina <= 1}
              render={
                <Link href={urlPagina(Math.max(paginacion.pagina - 1, 1))} />
              }
            >
              <IconChevronLeft />
            </Button>
            <span className="min-w-28 text-center text-muted-foreground tabular-nums">
              Página {paginacion.pagina} de {paginacion.totalPaginas}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página siguiente"
              disabled={paginacion.pagina >= paginacion.totalPaginas}
              render={
                <Link
                  href={urlPagina(
                    Math.min(paginacion.pagina + 1, paginacion.totalPaginas),
                  )}
                />
              }
            >
              <IconChevronRight />
            </Button>
          </div>
        </div>
      </TarjetaLista>

      <Dialog
        open={detalle !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDetalle(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del registro</DialogTitle>
            <DialogDescription>
              {detalle
                ? `${detalle.accion} · ${detalle.entidad} · ${formatearFechaHora(detalle.creadoEn)}`
                : "Selecciona un registro."}
            </DialogDescription>
          </DialogHeader>

          <pre className="max-h-[50vh] overflow-auto rounded-[10px] border border-border bg-muted/40 p-3 text-xs text-foreground">
            {detalle === null ? "" : JSON.stringify(detalle.detalles, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
