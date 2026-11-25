"use client";

import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type FilaCambiosPatrimonio,
  consultarCambiosPatrimonioAction,
} from "@/app/(app)/finanzas/actions";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { BotonDescargar } from "@/components/reportes/boton-descargar";
import { Button } from "@/components/ui/button";
import { type Moneda, formatearMoneda } from "@/lib/formato";
import {
  describirRangoFechas,
  nombreArchivoConPeriodo,
  tablaCambiosPatrimonioReporte,
} from "@/lib/reportes/adaptadores";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

interface FilaCambiosPatrimonioVista extends FilaCambiosPatrimonio {
  clave: string;
}

export interface CambiosPatrimonioTabProps {
  moneda: Moneda;
  empresa: EmpresaReporte;
  rangoInicial: RangoFechas;
}

export function CambiosPatrimonioTab({
  moneda,
  empresa,
  rangoInicial,
}: CambiosPatrimonioTabProps) {
  const [rango, setRango] = useState<RangoFechas>(rangoInicial);
  const [filas, setFilas] = useState<FilaCambiosPatrimonio[]>([]);
  const [consultado, setConsultado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [rangoConsultado, setRangoConsultado] =
    useState<RangoFechas>(rangoInicial);

  const filasVista = useMemo<FilaCambiosPatrimonioVista[]>(
    () =>
      filas.map((fila, indice) => ({
        ...fila,
        clave: `${fila.tipoFila}-${fila.cuentaId ?? fila.nombre}-${indice}`,
      })),
    [filas],
  );

  const total = useMemo(
    () => filas.find((fila) => fila.tipoFila === "total"),
    [filas],
  );

  const subtitulo = useMemo(
    () => describirRangoFechas(rangoConsultado.desde, rangoConsultado.hasta),
    [rangoConsultado],
  );

  const tabla = useMemo(
    () =>
      tablaCambiosPatrimonioReporte({
        subtitulo,
        empresa,
        filas,
      }),
    [empresa, filas, subtitulo],
  );

  const archivo = nombreArchivoConPeriodo(
    "cambios-en-el-patrimonio",
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
    const resultado = await consultarCambiosPatrimonioAction({
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

  function claseFila(fila: FilaCambiosPatrimonioVista): string {
    if (fila.tipoFila === "resultado" || fila.tipoFila === "total") {
      return "font-semibold";
    }
    return "";
  }

  function celdaMonto(fila: FilaCambiosPatrimonioVista, valor: number) {
    return (
      <span className={claseFila(fila)}>{formatearMoneda(valor, moneda)}</span>
    );
  }

  return (
    <TarjetaLista>
      <BarraLista
        titulo="Cambios en el patrimonio"
        descripcion={
          consultado
            ? `Cambio neto: ${formatearMoneda(total?.movimientoNeto ?? 0, moneda)} · Patrimonio final: ${formatearMoneda(total?.saldoFinal ?? 0, moneda)}`
            : "Consulta los movimientos de las cuentas de patrimonio y el resultado del período."
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
        <TablaLista<FilaCambiosPatrimonioVista>
          filas={filasVista}
          claveFila={(fila) => fila.clave}
          vacio={{
            titulo: consultado
              ? "Sin movimientos de patrimonio en el período"
              : "Consulta los cambios en el patrimonio",
            descripcion:
              "Selecciona el rango de fechas y presiona Consultar para ver saldos iniciales, movimientos y resultado del período.",
          }}
          columnas={[
            {
              clave: "codigo",
              encabezado: "Código",
              celda: (fila) => (
                <span
                  className={`${claseFila(fila)} font-medium tabular-nums`.trim()}
                >
                  {fila.codigo || "—"}
                </span>
              ),
            },
            {
              clave: "nombre",
              encabezado: "Cuenta",
              celda: (fila) => (
                <span className={claseFila(fila)}>{fila.nombre}</span>
              ),
            },
            {
              clave: "saldoInicial",
              encabezado: "Saldo inicial",
              alineacion: "derecha",
              celda: (fila) => celdaMonto(fila, fila.saldoInicial),
            },
            {
              clave: "debitos",
              encabezado: "Débitos",
              alineacion: "derecha",
              celda: (fila) => celdaMonto(fila, fila.debitos),
            },
            {
              clave: "creditos",
              encabezado: "Créditos",
              alineacion: "derecha",
              celda: (fila) => celdaMonto(fila, fila.creditos),
            },
            {
              clave: "movimientoNeto",
              encabezado: "Movimiento neto",
              alineacion: "derecha",
              celda: (fila) => celdaMonto(fila, fila.movimientoNeto),
            },
            {
              clave: "saldoFinal",
              encabezado: "Saldo final",
              alineacion: "derecha",
              celda: (fila) => celdaMonto(fila, fila.saldoFinal),
            },
          ]}
        />
      </BarraLista>
    </TarjetaLista>
  );
}
