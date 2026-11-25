"use client";

import {
  IconBook2,
  IconLoader2,
  IconScale,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type CuentaContable,
  type FilaBalanza,
  type FilaMayor,
  consultarBalanzaAction,
  consultarLibroMayorAction,
} from "@/app/(app)/contabilidad/actions";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { BotonDescargar } from "@/components/reportes/boton-descargar";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Moneda,
  formatearFecha,
  formatearMoneda,
  hoySantoDomingo,
} from "@/lib/formato";
import {
  describirRangoFechas,
  nombreArchivoConPeriodo,
  tablaBalanzaComprobacionReporte,
  tablaLibroMayorReporte,
} from "@/lib/reportes/adaptadores";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

const FILA_TOTALES = "__totales__";

interface FilaMayorVista extends FilaMayor {
  clave: string;
}

function rangoInicial(): RangoFechas {
  const hoy = hoySantoDomingo();
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
}

export interface MayorBalanzaTabProps {
  cuentas: readonly CuentaContable[];
  moneda: Moneda;
  empresa: EmpresaReporte;
  vistaInicial?: "mayor" | "balanza";
  ocultarSelector?: boolean;
}

export function MayorBalanzaTab({
  cuentas,
  moneda,
  empresa,
  vistaInicial = "mayor",
  ocultarSelector = false,
}: MayorBalanzaTabProps) {
  const ambitoCuentas = useMemo(
    () =>
      cuentas
        .map((cuenta) => cuenta.id)
        .sort()
        .join("|") || "sin-cuentas",
    [cuentas],
  );

  return (
    <MayorBalanzaContenido
      key={ambitoCuentas}
      cuentas={cuentas}
      moneda={moneda}
      empresa={empresa}
      vistaInicial={vistaInicial}
      ocultarSelector={ocultarSelector}
    />
  );
}

function MayorBalanzaContenido({
  cuentas,
  moneda,
  empresa,
  vistaInicial = "mayor",
  ocultarSelector = false,
}: MayorBalanzaTabProps) {
  const [vista, setVista] = useState<"mayor" | "balanza">(vistaInicial);
  const [cuentaId, setCuentaId] = useState("");
  const [rango, setRango] = useState<RangoFechas>(rangoInicial);
  const [filasMayor, setFilasMayor] = useState<FilaMayor[]>([]);
  const [filasBalanza, setFilasBalanza] = useState<FilaBalanza[]>([]);
  const [consultadoMayor, setConsultadoMayor] = useState(false);
  const [consultadoBalanza, setConsultadoBalanza] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [rangoMayorConsultado, setRangoMayorConsultado] =
    useState<RangoFechas>(rangoInicial);
  const [cuentaMayorConsultadaId, setCuentaMayorConsultadaId] = useState("");
  const [rangoBalanzaConsultado, setRangoBalanzaConsultado] =
    useState<RangoFechas>(rangoInicial);

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

  const totalesBalanza = useMemo(() => {
    return filasBalanza.reduce(
      (acumulado, fila) => ({
        saldoAnterior: acumulado.saldoAnterior + fila.saldoAnterior,
        debitos: acumulado.debitos + fila.debitos,
        creditos: acumulado.creditos + fila.creditos,
        saldoActual: acumulado.saldoActual + fila.saldoActual,
      }),
      { saldoAnterior: 0, debitos: 0, creditos: 0, saldoActual: 0 },
    );
  }, [filasBalanza]);

  const filasBalanzaConTotales = useMemo<FilaBalanza[]>(() => {
    if (filasBalanza.length === 0) return [];
    return [
      ...filasBalanza,
      {
        cuentaId: FILA_TOTALES,
        codigo: "",
        nombre: "Totales",
        clasificacion: "",
        naturaleza: "",
        saldoAnterior: totalesBalanza.saldoAnterior,
        debitos: totalesBalanza.debitos,
        creditos: totalesBalanza.creditos,
        saldoActual: totalesBalanza.saldoActual,
      },
    ];
  }, [filasBalanza, totalesBalanza]);

  const filasMayorVista = useMemo<FilaMayorVista[]>(
    () =>
      filasMayor.map((fila, indice) => ({
        ...fila,
        clave: `${fila.asientoId}-${indice}`,
      })),
    [filasMayor],
  );

  const cuadraBalanza =
    Math.abs(totalesBalanza.debitos - totalesBalanza.creditos) < 0.005;

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

    if (vista === "mayor" && cuentaId === "") {
      toast.error("Selecciona la cuenta para el libro mayor.");
      return;
    }

    setCargando(true);

    if (vista === "mayor") {
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

      setFilasMayor(resultado.filas);
      setConsultadoMayor(true);
      setRangoMayorConsultado(rango);
      setCuentaMayorConsultadaId(cuentaId);
      return;
    }

    const resultado = await consultarBalanzaAction({
      desde: rango.desde,
      hasta: rango.hasta,
    });
    setCargando(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    setFilasBalanza(resultado.filas);
    setConsultadoBalanza(true);
    setRangoBalanzaConsultado(rango);
  }

  const cuentaMayorConsultada = useMemo(
    () => cuentas.find((cuenta) => cuenta.id === cuentaMayorConsultadaId),
    [cuentas, cuentaMayorConsultadaId],
  );

  const subtituloMayor = useMemo(() => {
    const periodo = describirRangoFechas(
      rangoMayorConsultado.desde,
      rangoMayorConsultado.hasta,
    );
    const cuenta = cuentaMayorConsultada
      ? `${cuentaMayorConsultada.codigo} · ${cuentaMayorConsultada.nombre}`
      : "Cuenta no disponible";
    return `${periodo} · Cuenta: ${cuenta}`;
  }, [cuentaMayorConsultada, rangoMayorConsultado]);

  const tablaMayor = useMemo(
    () =>
      tablaLibroMayorReporte({
        subtitulo: subtituloMayor,
        empresa,
        filas: filasMayor,
      }),
    [empresa, filasMayor, subtituloMayor],
  );

  const subtituloBalanza = useMemo(
    () =>
      describirRangoFechas(
        rangoBalanzaConsultado.desde,
        rangoBalanzaConsultado.hasta,
      ),
    [rangoBalanzaConsultado],
  );

  const tablaBalanza = useMemo(
    () =>
      tablaBalanzaComprobacionReporte({
        subtitulo: subtituloBalanza,
        empresa,
        filas: filasBalanza,
      }),
    [empresa, filasBalanza, subtituloBalanza],
  );

  const archivoMayor = nombreArchivoConPeriodo(
    `libro-mayor-${cuentaMayorConsultada?.codigo ?? "cuenta"}`,
    rangoMayorConsultado.desde,
    rangoMayorConsultado.hasta,
  );
  const archivoBalanza = nombreArchivoConPeriodo(
    "balanza-de-comprobacion",
    rangoBalanzaConsultado.desde,
    rangoBalanzaConsultado.hasta,
  );

  const saldoFinal = filasMayor.at(-1)?.saldo ?? 0;

  return (
    <Tabs
      value={vista}
      onValueChange={(valor) => {
        setVista(valor === "balanza" ? "balanza" : "mayor");
      }}
      className="gap-3"
    >
      <TabsList className={ocultarSelector ? "hidden" : "w-fit"}>
        <TabsTrigger value="mayor">
          <IconBook2 className="size-4" />
          Libro mayor
        </TabsTrigger>
        <TabsTrigger value="balanza">
          <IconScale className="size-4" />
          Balanza de comprobación
        </TabsTrigger>
      </TabsList>

      <TabsContent value="mayor">
        <TarjetaLista>
          <BarraLista
            titulo="Libro mayor"
            descripcion={
              consultadoMayor
                ? `Saldo final: ${formatearMoneda(saldoFinal, moneda)} · ${filasMayor.length} movimientos`
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
                {consultadoMayor ? (
                  <BotonDescargar
                    tabla={tablaMayor}
                    nombreArchivo={archivoMayor}
                  />
                ) : null}
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
                  aria-label="Cuenta del libro mayor"
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
              filas={filasMayorVista}
              claveFila={(fila) => fila.clave}
              paginacion={{ tamanoPagina: 20, etiqueta: "movimientos" }}
              vacio={{
                titulo: consultadoMayor
                  ? "La cuenta no tiene movimientos en el período"
                  : "Consulta el libro mayor",
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
                      <span className="truncate">
                        {fila.descripcion || "—"}
                      </span>
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
                    fila.debito > 0
                      ? formatearMoneda(fila.debito, moneda)
                      : "—",
                },
                {
                  clave: "credito",
                  encabezado: "Crédito",
                  alineacion: "derecha",
                  celda: (fila) =>
                    fila.credito > 0
                      ? formatearMoneda(fila.credito, moneda)
                      : "—",
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
      </TabsContent>

      <TabsContent value="balanza">
        <TarjetaLista>
          <BarraLista
            titulo="Balanza de comprobación"
            descripcion={
              consultadoBalanza ? (
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">
                    Débitos {formatearMoneda(totalesBalanza.debitos, moneda)} ·
                    Créditos {formatearMoneda(totalesBalanza.creditos, moneda)}
                  </span>
                  <PillEstado
                    estado={cuadraBalanza ? "cuadrada" : "descuadrada"}
                    tono={cuadraBalanza ? "exito" : "peligro"}
                  >
                    {cuadraBalanza ? "Cuadra" : "Descuadre"}
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
                {consultadoBalanza ? (
                  <BotonDescargar
                    tabla={tablaBalanza}
                    nombreArchivo={archivoBalanza}
                  />
                ) : null}
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
              filas={filasBalanzaConTotales}
              claveFila={(fila) => fila.cuentaId}
              vacio={{
                titulo: consultadoBalanza
                  ? "No hay cuentas con movimientos en el período"
                  : "Consulta la balanza de comprobación",
                descripcion:
                  "Selecciona el rango de fechas y presiona Consultar para ver los saldos del período.",
              }}
              columnas={[
                {
                  clave: "codigo",
                  encabezado: "Código",
                  celda: (fila) => (
                    <span
                      className={
                        fila.cuentaId === FILA_TOTALES
                          ? "font-semibold"
                          : "font-medium tabular-nums"
                      }
                    >
                      {fila.codigo || "—"}
                    </span>
                  ),
                },
                {
                  clave: "nombre",
                  encabezado: "Cuenta",
                  celda: (fila) => (
                    <span
                      className={
                        fila.cuentaId === FILA_TOTALES ? "font-semibold" : ""
                      }
                    >
                      {fila.nombre}
                    </span>
                  ),
                },
                {
                  clave: "saldoAnterior",
                  encabezado: "Saldo anterior",
                  alineacion: "derecha",
                  celda: (fila) => (
                    <span
                      className={
                        fila.cuentaId === FILA_TOTALES ? "font-semibold" : ""
                      }
                    >
                      {formatearMoneda(fila.saldoAnterior, moneda)}
                    </span>
                  ),
                },
                {
                  clave: "debitos",
                  encabezado: "Débitos",
                  alineacion: "derecha",
                  celda: (fila) => (
                    <span
                      className={
                        fila.cuentaId === FILA_TOTALES ? "font-semibold" : ""
                      }
                    >
                      {formatearMoneda(fila.debitos, moneda)}
                    </span>
                  ),
                },
                {
                  clave: "creditos",
                  encabezado: "Créditos",
                  alineacion: "derecha",
                  celda: (fila) => (
                    <span
                      className={
                        fila.cuentaId === FILA_TOTALES ? "font-semibold" : ""
                      }
                    >
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
                      className={
                        fila.cuentaId === FILA_TOTALES
                          ? "font-semibold"
                          : "font-medium"
                      }
                    >
                      {formatearMoneda(fila.saldoActual, moneda)}
                    </span>
                  ),
                },
              ]}
            />
          </BarraLista>
        </TarjetaLista>
      </TabsContent>
    </Tabs>
  );
}
