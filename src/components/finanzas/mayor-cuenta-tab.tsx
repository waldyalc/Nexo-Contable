"use client";

import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type CuentaContable,
  type FilaMayor,
  consultarLibroMayorAction,
} from "@/app/(app)/finanzas/actions";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { BotonDescargar } from "@/components/reportes/boton-descargar";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { type Moneda, formatearFecha, formatearMoneda } from "@/lib/formato";
import {
  describirRangoFechas,
  nombreArchivoConPeriodo,
  tablaLibroMayorReporte,
} from "@/lib/reportes/adaptadores";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

interface FilaMayorVista extends FilaMayor {
  clave: string;
}

export interface MayorCuentaTabProps {
  cuentas: readonly CuentaContable[];
  moneda: Moneda;
  empresa: EmpresaReporte;
  rangoInicial: RangoFechas;
}

export function MayorCuentaTab({
  cuentas,
  moneda,
  empresa,
  rangoInicial,
}: MayorCuentaTabProps) {
  const [cuentaId, setCuentaId] = useState("");
  const [rango, setRango] = useState<RangoFechas>(rangoInicial);
  const [filas, setFilas] = useState<FilaMayor[]>([]);
  const [consultado, setConsultado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [rangoConsultado, setRangoConsultado] =
    useState<RangoFechas>(rangoInicial);
  const [cuentaConsultadaId, setCuentaConsultadaId] = useState("");

  const opcionesCuenta = useMemo(() => {
    const cuentasConHijas = new Set<string>();
    for (const cuenta of cuentas) {
      if (cuenta.padreId) cuentasConHijas.add(cuenta.padreId);
    }

    return cuentas
      .filter(
        (cuenta) =>
          !cuenta.esAgrupacion &&
          cuenta.activa &&
          !cuentasConHijas.has(cuenta.id),
      )
      .map((cuenta) => ({
        value: cuenta.id,
        label: `${cuenta.codigo} · ${cuenta.nombre}`,
      }));
  }, [cuentas]);

  const filasVista = useMemo<FilaMayorVista[]>(
    () =>
      filas.map((fila, indice) => ({
        ...fila,
        clave: `${fila.asientoId}-${indice}`,
      })),
    [filas],
  );

  const cuentaConsultada = useMemo(
    () => cuentas.find((cuenta) => cuenta.id === cuentaConsultadaId),
    [cuentas, cuentaConsultadaId],
  );

  const subtitulo = useMemo(() => {
    const periodo = describirRangoFechas(
      rangoConsultado.desde,
      rangoConsultado.hasta,
    );
    const cuenta = cuentaConsultada
      ? `${cuentaConsultada.codigo} · ${cuentaConsultada.nombre}`
      : "Cuenta no seleccionada";
    return `${periodo} · Cuenta: ${cuenta}`;
  }, [cuentaConsultada, rangoConsultado]);

  const tabla = useMemo(
    () =>
      tablaLibroMayorReporte({
        subtitulo,
        empresa,
        filas,
      }),
    [empresa, filas, subtitulo],
  );

  const archivo = nombreArchivoConPeriodo(
    `mayor-de-cuenta-${cuentaConsultada?.codigo ?? "cuenta"}`,
    rangoConsultado.desde,
    rangoConsultado.hasta,
  );

  const saldoFinal = filas.at(-1)?.saldo ?? 0;

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

    if (cuentaId === "") {
      toast.error("Selecciona la cuenta para el mayor de cuenta.");
      return;
    }

    setCargando(true);
    const resultado = await consultarLibroMayorAction({
      cuentaId,
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
    setCuentaConsultadaId(cuentaId);
  }

  return (
    <TarjetaLista>
      <BarraLista
        titulo="Mayor de cuenta"
        descripcion={
          consultado
            ? `Saldo final: ${formatearMoneda(saldoFinal, moneda)} · ${filas.length} movimientos`
            : "Selecciona una cuenta y el rango de fechas para consultar sus movimientos."
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
          <>
            <SelectCampo
              opciones={opcionesCuenta}
              valor={cuentaId}
              onCambio={setCuentaId}
              buscable
              etiquetaVacia="Selecciona una cuenta…"
              className="w-full sm:w-80"
              aria-label="Cuenta del mayor"
            />
            <DateRangePicker
              value={rango}
              onChange={setRango}
              className="w-full sm:w-64"
            />
          </>
        }
      >
        <TablaLista<FilaMayorVista>
          filas={filasVista}
          claveFila={(fila) => fila.clave}
          paginacion={{ tamanoPagina: 20, etiqueta: "movimientos" }}
          vacio={{
            titulo: consultado
              ? "La cuenta no tiene movimientos en el período"
              : "Consulta el mayor de cuenta",
            descripcion:
              "Elige una cuenta y presiona Consultar para ver sus débitos, créditos y saldo acumulado.",
          }}
          columnas={[
            {
              clave: "fecha",
              encabezado: "Fecha",
              celda: (fila) => formatearFecha(fila.fecha),
            },
            {
              clave: "asiento",
              encabezado: "Asiento",
              celda: (fila) => (
                <span className="font-medium tabular-nums">
                  {fila.asientoNumero}
                </span>
              ),
            },
            {
              clave: "descripcion",
              encabezado: "Descripción",
              celda: (fila) => (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{fila.descripcion || "—"}</span>
                  {fila.referencia ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {fila.referencia}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              clave: "debito",
              encabezado: "Débito",
              alineacion: "derecha",
              celda: (fila) =>
                fila.debito > 0 ? formatearMoneda(fila.debito, moneda) : "—",
            },
            {
              clave: "credito",
              encabezado: "Crédito",
              alineacion: "derecha",
              celda: (fila) =>
                fila.credito > 0 ? formatearMoneda(fila.credito, moneda) : "—",
            },
            {
              clave: "saldo",
              encabezado: "Saldo",
              alineacion: "derecha",
              celda: (fila) => (
                <span className="font-medium">
                  {formatearMoneda(fila.saldo, moneda)}
                </span>
              ),
            },
          ]}
        />
      </BarraLista>
    </TarjetaLista>
  );
}
