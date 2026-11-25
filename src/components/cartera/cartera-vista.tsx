"use client";

import {
  IconBan,
  IconClipboardList,
  IconHistory,
  IconReceipt2,
  IconWallet,
} from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { DatePicker } from "@/components/date-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import {
  DialogoAnular,
  DialogoRegistrarPago,
} from "@/components/operaciones/dialogos-cartera";
import { BotonDescargar } from "@/components/reportes/boton-descargar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatearFecha,
  formatearMoneda,
  formatearRnc,
  normalizarRnc,
} from "@/lib/formato";
import {
  BUCKETS_ANTIGUEDAD,
  type CuentaOpcion,
  type MetodoPagoOpcion,
  type PagoListado,
  type SaldoAntiguedad,
} from "@/lib/operaciones/tipos";
import { adaptarAntiguedadCartera } from "@/lib/reportes/adaptadores-cartera";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

export interface CarteraVistaProps {
  empresaId: string;
  empresaReporte: EmpresaReporte;
  tipo: "cxc" | "cxp";
  fechaCorte: string;
  saldos: readonly SaldoAntiguedad[];
  rncPorTercero: Readonly<Record<string, string>>;
  pagosPorDocumento: Readonly<Record<string, PagoListado[]>>;
  cuentas: readonly CuentaOpcion[];
  metodosPago: readonly MetodoPagoOpcion[];
  moneda: "DOP" | "USD";
}

/**
 * Cartera reutilizable para Cuentas por cobrar (cxc) y por pagar (cxp):
 * KPIs por antigüedad, saldo pendiente, historial de pagos y acciones de
 * cobro/pago y anulación por reverso.
 */
export function CarteraVista({
  empresaId,
  empresaReporte,
  tipo,
  fechaCorte,
  saldos,
  rncPorTercero,
  pagosPorDocumento,
  cuentas,
  metodosPago,
  moneda,
}: CarteraVistaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const esCobrar = tipo === "cxc";
  const [documentoPago, setDocumentoPago] = useState<SaldoAntiguedad | null>(
    null,
  );
  const [historial, setHistorial] = useState<SaldoAntiguedad | null>(null);
  const [pagoAnular, setPagoAnular] = useState<PagoListado | null>(null);

  const termino = (searchParams.get("q") ?? "").trim().toLowerCase();
  const digitosTermino = normalizarRnc(termino);
  const busquedaActiva = termino !== "";

  const saldosFiltrados = useMemo(() => {
    if (!busquedaActiva) return saldos;

    return saldos.filter((saldo) => {
      const rnc = rncPorTercero[saldo.terceroId] ?? "";
      const coincideNombre = saldo.tercero.toLowerCase().includes(termino);
      const coincideRnc =
        digitosTermino !== "" && normalizarRnc(rnc).includes(digitosTermino);
      return coincideNombre || coincideRnc;
    });
  }, [saldos, rncPorTercero, termino, digitosTermino, busquedaActiva]);

  const totales = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const saldo of saldosFiltrados) {
      mapa.set(saldo.bucket, (mapa.get(saldo.bucket) ?? 0) + saldo.saldo);
    }
    return mapa;
  }, [saldosFiltrados]);

  const total = saldosFiltrados.reduce((suma, saldo) => suma + saldo.saldo, 0);

  const tablaAntiguedad = useMemo(
    () =>
      adaptarAntiguedadCartera({
        tipo,
        fechaCorte,
        saldos: saldosFiltrados,
        rncPorTercero,
        empresa: empresaReporte,
      }),
    [tipo, fechaCorte, saldosFiltrados, rncPorTercero, empresaReporte],
  );

  function cambiarFecha(valor: string) {
    const parametros = new URLSearchParams(searchParams.toString());
    if (valor === "") {
      parametros.delete("corte");
    } else {
      parametros.set("corte", valor);
    }
    const cadena = parametros.toString();
    router.push(cadena === "" ? pathname : `${pathname}?${cadena}`);
  }

  const pagosDelHistorial = historial
    ? (pagosPorDocumento[historial.documentoId] ?? [])
    : [];
  const descripcionDocumentos = busquedaActiva
    ? `${saldosFiltrados.length} de ${saldos.length} documentos con saldo al ${formatearFecha(fechaCorte)}`
    : `${saldos.length} documentos con saldo al ${formatearFecha(fechaCorte)}`;
  const nombreArchivo = `antiguedad-${tipo}-${fechaCorte}`;

  return (
    <>
      <section
        aria-label="Antigüedad de saldos"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <TarjetaLista className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Fecha de corte
            </span>
            <DatePicker
              value={fechaCorte}
              onChange={cambiarFecha}
              aria-label="Fecha de corte de la antigüedad"
            />
          </div>
        </TarjetaLista>

        {BUCKETS_ANTIGUEDAD.map((bucket) => (
          <TarjetaLista key={bucket.clave} className="px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {bucket.etiqueta}
              </span>
              <span className="font-display text-lg font-bold tracking-[-0.02em] text-foreground tabular-nums">
                {formatearMoneda(totales.get(bucket.clave) ?? 0, moneda)}
              </span>
            </div>
          </TarjetaLista>
        ))}

        <TarjetaLista className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Total pendiente
            </span>
            <span className="font-display text-lg font-bold tracking-[-0.02em] text-primary tabular-nums">
              {formatearMoneda(total, moneda)}
            </span>
          </div>
        </TarjetaLista>
      </section>

      <TarjetaLista>
        <BarraLista
          titulo="Antigüedad de saldos"
          descripcion={descripcionDocumentos}
          acciones={
            <BotonDescargar
              tabla={tablaAntiguedad}
              nombreArchivo={nombreArchivo}
              variant="outline"
            />
          }
          filtros={
            <BuscadorLista
              placeholder={
                esCobrar ? "Buscar cliente o RNC…" : "Buscar proveedor o RNC…"
              }
              ariaLabel={
                esCobrar
                  ? "Buscar cuentas por cobrar"
                  : "Buscar cuentas por pagar"
              }
              parametroPagina={null}
            />
          }
        >
          <TablaLista<SaldoAntiguedad>
            filas={saldosFiltrados}
            claveFila={(saldo) => saldo.documentoId}
            ordenable
            paginacion={{ tamanoPagina: 15, etiqueta: "documentos" }}
            vacio={{
              titulo: busquedaActiva
                ? "Sin coincidencias"
                : "Sin saldos pendientes",
              descripcion: busquedaActiva
                ? "Prueba con otro nombre, RNC o cédula."
                : "Todos los documentos del corte están saldados o aún no hay movimiento.",
              icono: esCobrar ? (
                <IconReceipt2 className="size-8" />
              ) : (
                <IconClipboardList className="size-8" />
              ),
            }}
            columnas={[
              {
                clave: "documento",
                encabezado: "Documento",
                celda: (saldo) => (
                  <span className="font-medium text-foreground">
                    {saldo.numero}
                  </span>
                ),
              },
              {
                clave: "tercero",
                encabezado: esCobrar ? "Cliente" : "Proveedor",
                celda: (saldo) => {
                  const rnc = formatearRnc(
                    rncPorTercero[saldo.terceroId] ?? "",
                  );
                  return (
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {saldo.tercero}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {rnc === "" ? "Sin RNC" : rnc}
                      </span>
                    </div>
                  );
                },
              },
              {
                clave: "emision",
                encabezado: "Emisión",
                celda: (saldo) => formatearFecha(saldo.fechaEmision),
              },
              {
                clave: "vencimiento",
                encabezado: "Vence",
                celda: (saldo) => formatearFecha(saldo.fechaVencimiento),
              },
              {
                clave: "dias",
                encabezado: "Días vencido",
                alineacion: "derecha",
                celda: (saldo) => (
                  <PillEstado
                    estado={saldo.diasVencido > 0 ? "vencida" : "pendiente"}
                  >
                    {saldo.diasVencido > 0
                      ? `${saldo.diasVencido} días`
                      : "Al día"}
                  </PillEstado>
                ),
              },
              {
                clave: "saldo",
                encabezado: "Saldo pendiente",
                alineacion: "derecha",
                celda: (saldo) => formatearMoneda(saldo.saldo, moneda),
              },
              {
                clave: "historial",
                encabezado: "Historial",
                celda: (saldo) => {
                  const pagos = pagosPorDocumento[saldo.documentoId] ?? [];
                  return (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistorial(saldo)}
                    >
                      <IconHistory className="size-4" />
                      {pagos.length === 0
                        ? "Sin pagos"
                        : `${pagos.length} ${pagos.length === 1 ? "pago" : "pagos"}`}
                    </Button>
                  );
                },
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (saldo) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDocumentoPago(saldo)}
                  >
                    <IconWallet className="size-4" />
                    {esCobrar ? "Registrar cobro" : "Registrar pago"}
                  </Button>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <DialogoRegistrarPago
        abierto={documentoPago !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDocumentoPago(null);
        }}
        empresaId={empresaId}
        documento={
          documentoPago
            ? {
                id: documentoPago.documentoId,
                numero: documentoPago.numero,
                tercero: documentoPago.tercero,
                saldo: documentoPago.saldo,
              }
            : null
        }
        cuentas={cuentas}
        metodosPago={metodosPago}
        etiquetaAccion={esCobrar ? "Registrar cobro" : "Registrar pago"}
        onRegistrado={() => router.refresh()}
      />

      <Dialog
        open={historial !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setHistorial(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Historial de pagos · {historial?.numero ?? ""}
            </DialogTitle>
            <DialogDescription>
              {historial
                ? `${historial.tercero} · saldo ${formatearMoneda(historial.saldo, moneda)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {pagosDelHistorial.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este documento todavía no tiene pagos registrados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pagosDelHistorial.map((pago) => (
                <li
                  key={pago.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground tabular-nums">
                      {formatearMoneda(pago.monto, moneda)} ·{" "}
                      {formatearFecha(pago.fechaPago)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {pago.metodoPago} · {pago.cuenta}
                      {pago.referencia === "" ? "" : ` · ${pago.referencia}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PillEstado
                      estado={
                        pago.estado === "cancelled" ? "anulada" : "saldada"
                      }
                    >
                      {pago.estado === "cancelled" ? "Anulado" : "Activo"}
                    </PillEstado>
                    {pago.estado === "active" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setHistorial(null);
                          setPagoAnular(pago);
                        }}
                      >
                        <IconBan className="size-4" />
                        Anular
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <DialogoAnular
        abierto={pagoAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPagoAnular(null);
        }}
        empresaId={empresaId}
        tipo="pago"
        referenciaId={pagoAnular?.id ?? null}
        identificador={
          pagoAnular
            ? `${formatearMoneda(pagoAnular.monto, moneda)} del ${formatearFecha(pagoAnular.fechaPago)}`
            : ""
        }
        onAnulado={() => router.refresh()}
      />
    </>
  );
}
