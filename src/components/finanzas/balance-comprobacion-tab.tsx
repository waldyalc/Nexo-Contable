"use client";

import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type FilaBalanza,
  consultarBalanzaComprobacionAction,
} from "@/app/(app)/finanzas/actions";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { BotonDescargar } from "@/components/reportes/boton-descargar";
import { Button } from "@/components/ui/button";
import { type Moneda, formatearMoneda } from "@/lib/formato";
import {
  describirRangoFechas,
  nombreArchivoConPeriodo,
  tablaBalanzaComprobacionReporte,
} from "@/lib/reportes/adaptadores";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

const FILA_TOTALES = "__totales__";

export interface BalanceComprobacionTabProps {
  moneda: Moneda;
  empresa: EmpresaReporte;
  rangoInicial: RangoFechas;
}

export function BalanceComprobacionTab({
  moneda,
  empresa,
  rangoInicial,
}: BalanceComprobacionTabProps) {
  const [rango, setRango] = useState<RangoFechas>(rangoInicial);
  const [filas, setFilas] = useState<FilaBalanza[]>([]);
  const [consultado, setConsultado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [rangoConsultado, setRangoConsultado] =
    useState<RangoFechas>(rangoInicial);

  const totales = useMemo(
    () =>
      filas.reduce(
        (acumulado, fila) => ({
          saldoAnterior: acumulado.saldoAnterior + fila.saldoAnterior,
          debitos: acumulado.debitos + fila.debitos,
          creditos: acumulado.creditos + fila.creditos,
          saldoActual: acumulado.saldoActual + fila.saldoActual,
        }),
        { saldoAnterior: 0, debitos: 0, creditos: 0, saldoActual: 0 },
      ),
    [filas],
  );

  const filasConTotales = useMemo<FilaBalanza[]>(() => {
    if (filas.length === 0) return [];
    return [
      ...filas,
      {
        cuentaId: FILA_TOTALES,
        codigo: "",
        nombre: "Totales",
        clasificacion: "",
        naturaleza: "",
        saldoAnterior: totales.saldoAnterior,
        debitos: totales.debitos,
        creditos: totales.creditos,
        saldoActual: totales.saldoActual,
      },
    ];
  }, [filas, totales]);

  const cuadra = Math.abs(totales.debitos - totales.creditos) < 0.005;

  const subtitulo = useMemo(
    () => describirRangoFechas(rangoConsultado.desde, rangoConsultado.hasta),
    [rangoConsultado],
  );

  const tabla = useMemo(
    () =>
      tablaBalanzaComprobacionReporte({
        subtitulo,
        empresa,
        filas,
      }),
    [empresa, filas, subtitulo],
  );

  const archivo = nombreArchivoConPeriodo(
    "balance-de-comprobacion",
    rangoConsultado.desde,
    rangoConsultado.hasta,
  );

  function validarRango(): boolean {
    if (rango.desde === "" || rango.hasta === "") {
      toast.error("Selecciona el rango de fechas del reporte.");
      return false;
    }
    if (rango.desde > rango.hasta) {
      toast.error("La fecha inicial no puede superar la final.");
      return false;
    }
    return true;
  }

  async function consultar() {
    if (!validarRango()) return;

    setCargando(true);
    const resultado = await consultarBalanzaComprobacionAction({
      desde: rango.desde,
      hasta: rango.hasta,
    });
    setCargando(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    setFilas(resultado.filas);
    setConsultado(true);
    setRangoConsultado(rango);
  }

  function claseTotal(fila: FilaBalanza, base = ""): string {
    return fila.cuentaId === FILA_TOTALES
      ? `${base} font-semibold`.trim()
      : base;
  }

  return (
    <TarjetaLista>
      <BarraLista
        titulo="Balance de comprobación"
        descripcion={
          consultado ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">
                Débitos {formatearMoneda(totales.debitos, moneda)} · Créditos{" "}
                {formatearMoneda(totales.creditos, moneda)}
              </span>
              <PillEstado
                estado={cuadra ? "cuadrada" : "descuadrada"}
                tono={cuadra ? "exito" : "peligro"}
              >
                {cuadra ? "Cuadra" : "Descuadre"}
              </PillEstado>
            </span>
          ) : (
            "Consulta los saldos anteriores, débitos y créditos del período."
          )
        }
        acciones={
          <>
            <Button onClick={() => void consultar()} disabled={cargando}>
              {cargando ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconSearch className="size-4" />
              )}
              Consultar
            </Button>
            <BotonDescargar tabla={tabla} nombreArchivo={archivo} />
          </>
        }
        filtros={
          <DateRangePicker
            value={rango}
            onChange={setRango}
            className="w-full sm:w-64"
          />
        }
      >
        <TablaLista<FilaBalanza>
          filas={filasConTotales}
          claveFila={(fila) => fila.cuentaId}
          vacio={{
            titulo: consultado
              ? "No hay cuentas con movimientos en el período"
              : "Consulta el balance de comprobación",
            descripcion:
              "Selecciona el rango de fechas y presiona Consultar para ver los saldos del período.",
          }}
          columnas={[
            {
              clave: "codigo",
              encabezado: "Código",
              celda: (fila) => (
                <span className={claseTotal(fila, "font-medium tabular-nums")}>
                  {fila.codigo || "—"}
                </span>
              ),
            },
            {
              clave: "nombre",
              encabezado: "Cuenta",
              celda: (fila) => (
                <span className={claseTotal(fila)}>{fila.nombre}</span>
              ),
            },
            {
              clave: "saldoAnterior",
              encabezado: "Saldo anterior",
              alineacion: "derecha",
              celda: (fila) => (
                <span className={claseTotal(fila)}>
                  {formatearMoneda(fila.saldoAnterior, moneda)}
                </span>
              ),
            },
            {
              clave: "debitos",
              encabezado: "Débitos",
              alineacion: "derecha",
              celda: (fila) => (
                <span className={claseTotal(fila)}>
                  {formatearMoneda(fila.debitos, moneda)}
                </span>
              ),
            },
            {
              clave: "creditos",
              encabezado: "Créditos",
              alineacion: "derecha",
              celda: (fila) => (
                <span className={claseTotal(fila)}>
                  {formatearMoneda(fila.creditos, moneda)}
                </span>
              ),
            },
            {
              clave: "saldoActual",
              encabezado: "Saldo actual",
              alineacion: "derecha",
              celda: (fila) => (
                <span
                  className={claseTotal(
                    fila,
                    fila.cuentaId === FILA_TOTALES ? "" : "font-medium",
                  )}
                >
                  {formatearMoneda(fila.saldoActual, moneda)}
                </span>
              ),
            },
          ]}
        />
      </BarraLista>
    </TarjetaLista>
  );
}
