"use client";

import {
  IconAdjustments,
  IconBook2,
  IconCoin,
  IconLoader2,
  IconReceipt,
  IconReportAnalytics,
  IconScale,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type CuentaContable,
  type FilaBalanceGeneral,
  type FilaEstadoResultados,
  type FilaFlujoEfectivo,
  consultarBalanceGeneralAction,
  consultarEstadoResultadosAction,
  consultarFlujoEfectivoAction,
} from "@/app/(app)/finanzas/actions";
import { DatePicker } from "@/components/date-picker";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BalanceComprobacionTab } from "@/components/finanzas/balance-comprobacion-tab";
import { CambiosPatrimonioTab } from "@/components/finanzas/cambios-patrimonio-tab";
import { MayorCuentaTab } from "@/components/finanzas/mayor-cuenta-tab";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { BotonDescargar } from "@/components/reportes/boton-descargar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Moneda, formatearFecha, formatearMoneda } from "@/lib/formato";
import {
  crearEmpresaReporte,
  describirRangoFechas,
  nombreArchivoConCorte,
  nombreArchivoConPeriodo,
  tablaAgrupadaReporte,
} from "@/lib/reportes/adaptadores";

const ETIQUETA_CLASIFICACION: Record<string, string> = {
  asset: "ACTIVOS",
  liability: "PASIVOS",
  equity: "PATRIMONIO",
  income: "INGRESOS",
  cost: "COSTOS",
  expense: "GASTOS",
};

const ETIQUETA_FLUJO: Record<string, string> = {
  operating: "Actividades de operación",
  investing: "Actividades de inversión",
  financing: "Actividades de financiamiento",
  other: "Otras actividades",
};

const ORDEN_ESTADO_RESULTADOS = ["income", "cost", "expense"] as const;
const ORDEN_BALANCE_GENERAL = ["asset", "liability", "equity"] as const;
const ORDEN_FLUJO = ["operating", "investing", "financing", "other"] as const;

type TipoFila = "grupo" | "detalle" | "subtotal" | "total";

interface FilaAgrupada {
  clave: string;
  tipo: TipoFila;
  codigo: string;
  nombre: string;
  monto: number;
}

export interface FinanzasVistaProps {
  empresaId: string;
  empresaNombre: string;
  empresaRazonSocial: string;
  empresaRnc: string;
  moneda: Moneda;
  cuentas: readonly CuentaContable[];
  rangoInicial: RangoFechas;
  fechaCorteInicial: string;
  estadoResultadosInicial: readonly FilaEstadoResultados[];
  resultadoInicial: number;
  balanceInicial: readonly FilaBalanceGeneral[];
  resultadoBalanceInicial: number;
  flujoInicial: readonly FilaFlujoEfectivo[];
  resultadoFlujoInicial: number;
}

export function FinanzasVista(props: FinanzasVistaProps) {
  return <FinanzasVistaContenido key={props.empresaId} {...props} />;
}

function FinanzasVistaContenido({
  empresaNombre,
  empresaRazonSocial,
  empresaRnc,
  moneda,
  cuentas,
  rangoInicial,
  fechaCorteInicial,
  estadoResultadosInicial,
  resultadoInicial,
  balanceInicial,
  resultadoBalanceInicial,
  flujoInicial,
  resultadoFlujoInicial,
}: FinanzasVistaProps) {
  const [pestana, setPestana] = useState("resultados");

  const [rangoEr, setRangoEr] = useState<RangoFechas>(rangoInicial);
  const [filasEr, setFilasEr] = useState<readonly FilaEstadoResultados[]>(
    estadoResultadosInicial,
  );
  const [resultadoEr, setResultadoEr] = useState(resultadoInicial);
  const [cargandoEr, setCargandoEr] = useState(false);
  const [rangoErConsultado, setRangoErConsultado] =
    useState<RangoFechas>(rangoInicial);

  const [fechaCorte, setFechaCorte] = useState(fechaCorteInicial);
  const [filasBg, setFilasBg] =
    useState<readonly FilaBalanceGeneral[]>(balanceInicial);
  const [resultadoBg, setResultadoBg] = useState(resultadoBalanceInicial);
  const [cargandoBg, setCargandoBg] = useState(false);
  const [fechaCorteConsultada, setFechaCorteConsultada] =
    useState(fechaCorteInicial);

  const [rangoFe, setRangoFe] = useState<RangoFechas>(rangoInicial);
  const [filasFe, setFilasFe] =
    useState<readonly FilaFlujoEfectivo[]>(flujoInicial);
  const [resultadoFe, setResultadoFe] = useState(resultadoFlujoInicial);
  const [cargandoFe, setCargandoFe] = useState(false);
  const [rangoFeConsultado, setRangoFeConsultado] =
    useState<RangoFechas>(rangoInicial);

  const filasErVista = useMemo(() => {
    if (filasEr.length === 0) return [];
    const filas: FilaAgrupada[] = [];
    let totalIngresos = 0;
    let totalCostos = 0;
    let totalGastos = 0;

    for (const clasificacion of ORDEN_ESTADO_RESULTADOS) {
      const grupo = filasEr.filter(
        (fila) => fila.clasificacion === clasificacion,
      );
      const subtotal = grupo.reduce(
        (acumulado, fila) => acumulado + fila.monto,
        0,
      );

      if (clasificacion === "income") totalIngresos = subtotal;
      if (clasificacion === "cost") totalCostos = subtotal;
      if (clasificacion === "expense") totalGastos = subtotal;

      filas.push({
        clave: `grupo-${clasificacion}`,
        tipo: "grupo",
        codigo: "",
        nombre: ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion,
        monto: 0,
      });

      for (const cuenta of grupo) {
        filas.push({
          clave: `cuenta-${clasificacion}-${cuenta.cuentaId}`,
          tipo: "detalle",
          codigo: cuenta.codigo,
          nombre: cuenta.nombre,
          monto: cuenta.monto,
        });
      }

      filas.push({
        clave: `subtotal-${clasificacion}`,
        tipo: "subtotal",
        codigo: "",
        nombre: `Subtotal ${ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion}`,
        monto: subtotal,
      });
    }

    filas.push({
      clave: "resultado",
      tipo: "total",
      codigo: "",
      nombre: "Resultado neto",
      monto: totalIngresos - totalCostos - totalGastos,
    });

    return filas;
  }, [filasEr]);

  const totalesBg = useMemo(() => {
    const sumar = (clasificacion: string) =>
      filasBg
        .filter((fila) => fila.clasificacion === clasificacion)
        .reduce((acumulado, fila) => acumulado + fila.monto, 0);

    const activos = sumar("asset");
    const pasivos = sumar("liability");
    const patrimonio = sumar("equity");
    const ecuacion = pasivos + patrimonio + resultadoBg;

    return {
      activos,
      pasivos,
      patrimonio,
      ecuacion,
      diferencia: activos - ecuacion,
      cuadra: Math.abs(activos - ecuacion) < 0.005,
    };
  }, [filasBg, resultadoBg]);

  const filasBgVista = useMemo(() => {
    if (filasBg.length === 0) return [];
    const filas: FilaAgrupada[] = [];

    for (const clasificacion of ORDEN_BALANCE_GENERAL) {
      const grupo = filasBg.filter(
        (fila) => fila.clasificacion === clasificacion,
      );
      const subtotal = grupo.reduce(
        (acumulado, fila) => acumulado + fila.monto,
        0,
      );

      filas.push({
        clave: `grupo-${clasificacion}`,
        tipo: "grupo",
        codigo: "",
        nombre: ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion,
        monto: 0,
      });

      for (const cuenta of grupo) {
        filas.push({
          clave: `cuenta-${clasificacion}-${cuenta.cuentaId}`,
          tipo: "detalle",
          codigo: cuenta.codigo,
          nombre: cuenta.nombre,
          monto: cuenta.monto,
        });
      }

      filas.push({
        clave: `subtotal-${clasificacion}`,
        tipo: "subtotal",
        codigo: "",
        nombre: `Total ${ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion}`,
        monto: subtotal,
      });
    }

    filas.push({
      clave: "resultado",
      tipo: "detalle",
      codigo: "",
      nombre: "Resultado del período",
      monto: resultadoBg,
    });
    filas.push({
      clave: "ecuacion",
      tipo: "subtotal",
      codigo: "",
      nombre: "Pasivo + Patrimonio + Resultado",
      monto: totalesBg.ecuacion,
    });
    filas.push({
      clave: "diferencia",
      tipo: "total",
      codigo: "",
      nombre: "Diferencia (activos − pasivo − patrimonio − resultado)",
      monto: totalesBg.diferencia,
    });

    return filas;
  }, [filasBg, resultadoBg, totalesBg]);

  const filasFeVista = useMemo(() => {
    if (filasFe.length === 0) return [];
    const filas: FilaAgrupada[] = [];

    for (const categoria of ORDEN_FLUJO) {
      const monto = filasFe
        .filter((fila) => fila.categoria === categoria)
        .reduce((acumulado, fila) => acumulado + fila.monto, 0);

      if (monto === 0) continue;

      filas.push({
        clave: `flujo-${categoria}`,
        tipo: "detalle",
        codigo: "",
        nombre: ETIQUETA_FLUJO[categoria] ?? categoria,
        monto,
      });
    }

    filas.push({
      clave: "flujo-total",
      tipo: "total",
      codigo: "",
      nombre: "Flujo neto del período",
      monto: filasFe.reduce((acumulado, fila) => acumulado + fila.monto, 0),
    });

    return filas;
  }, [filasFe]);

  const empresaReporte = useMemo(
    () =>
      crearEmpresaReporte({
        nombreComercial: empresaNombre,
        razonSocial: empresaRazonSocial,
        rnc: empresaRnc,
        moneda,
      }),
    [empresaNombre, empresaRazonSocial, empresaRnc, moneda],
  );

  const tablaEstadoResultados = useMemo(
    () =>
      tablaAgrupadaReporte({
        titulo: "Estado de resultados",
        subtitulo: describirRangoFechas(
          rangoErConsultado.desde,
          rangoErConsultado.hasta,
        ),
        empresa: empresaReporte,
        filas: filasErVista,
      }),
    [empresaReporte, filasErVista, rangoErConsultado],
  );

  const tablaBalanceGeneral = useMemo(
    () =>
      tablaAgrupadaReporte({
        titulo: "Estado de situación financiera",
        subtitulo: `Fecha de corte: ${formatearFecha(fechaCorteConsultada)}`,
        empresa: empresaReporte,
        filas: filasBgVista,
      }),
    [empresaReporte, fechaCorteConsultada, filasBgVista],
  );

  const tablaFlujoEfectivo = useMemo(
    () =>
      tablaAgrupadaReporte({
        titulo: "Flujo de efectivo",
        subtitulo: describirRangoFechas(
          rangoFeConsultado.desde,
          rangoFeConsultado.hasta,
        ),
        empresa: empresaReporte,
        filas: filasFeVista,
      }),
    [empresaReporte, filasFeVista, rangoFeConsultado],
  );

  const archivoEstadoResultados = nombreArchivoConPeriodo(
    "estado-de-resultados",
    rangoErConsultado.desde,
    rangoErConsultado.hasta,
  );
  const archivoBalanceGeneral = nombreArchivoConCorte(
    "estado-de-situacion-financiera",
    fechaCorteConsultada,
  );
  const archivoFlujoEfectivo = nombreArchivoConPeriodo(
    "flujo-de-efectivo",
    rangoFeConsultado.desde,
    rangoFeConsultado.hasta,
  );

  function validarRango(rango: RangoFechas): boolean {
    if (rango.desde === "" || rango.hasta === "") {
      toast.error("Selecciona el rango de fechas.");
      return false;
    }
    if (rango.desde > rango.hasta) {
      toast.error("La fecha inicial no puede superar la final.");
      return false;
    }
    return true;
  }

  async function consultarEr() {
    if (!validarRango(rangoEr)) return;
    setCargandoEr(true);
    const resultado = await consultarEstadoResultadosAction(rangoEr);
    setCargandoEr(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    setFilasEr(resultado.filas);
    setResultadoEr(resultado.resultado);
    setRangoErConsultado(rangoEr);
  }

  async function consultarBg() {
    if (fechaCorte === "") {
      toast.error("Selecciona la fecha de corte.");
      return;
    }

    setCargandoBg(true);
    const resultado = await consultarBalanceGeneralAction({ fechaCorte });
    setCargandoBg(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    setFilasBg(resultado.filas);
    setResultadoBg(resultado.resultado);
    setFechaCorteConsultada(fechaCorte);
  }

  async function consultarFe() {
    if (!validarRango(rangoFe)) return;
    setCargandoFe(true);
    const resultado = await consultarFlujoEfectivoAction(rangoFe);
    setCargandoFe(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    setFilasFe(resultado.filas);
    setResultadoFe(resultado.resultado);
    setRangoFeConsultado(rangoFe);
  }

  function claseFila(tipo: TipoFila): string {
    if (tipo === "grupo") {
      return "text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";
    }
    if (tipo === "subtotal") return "font-semibold";
    if (tipo === "total") return "font-semibold text-foreground";
    return "";
  }

  const columnasAgrupadas = [
    {
      clave: "codigo",
      encabezado: "Código",
      celda: (fila: FilaAgrupada) => (fila.tipo === "grupo" ? "" : fila.codigo),
    },
    {
      clave: "nombre",
      encabezado: "Concepto",
      celda: (fila: FilaAgrupada) => (
        <span className={claseFila(fila.tipo)}>{fila.nombre}</span>
      ),
    },
    {
      clave: "monto",
      encabezado: "Monto",
      alineacion: "derecha" as const,
      celda: (fila: FilaAgrupada) =>
        fila.tipo === "grupo" ? (
          ""
        ) : (
          <span className={claseFila(fila.tipo)}>
            {formatearMoneda(fila.monto, moneda)}
          </span>
        ),
    },
  ];

  return (
    <Tabs
      value={pestana}
      onValueChange={(valor) =>
        setPestana(typeof valor === "string" ? valor : "resultados")
      }
      className="gap-3"
    >
      <div className="w-full overflow-x-auto pb-0.5">
        <TabsList className="w-fit">
          <TabsTrigger value="resultados">
            <IconReceipt className="size-4" />
            Estado de resultados
          </TabsTrigger>
          <TabsTrigger value="situacion">
            <IconScale className="size-4" />
            Estado de situación financiera
          </TabsTrigger>
          <TabsTrigger value="balance">
            <IconAdjustments className="size-4" />
            Balance de comprobación
          </TabsTrigger>
          <TabsTrigger value="flujo">
            <IconCoin className="size-4" />
            Flujo de efectivo
          </TabsTrigger>
          <TabsTrigger value="patrimonio">
            <IconReportAnalytics className="size-4" />
            Cambios en el patrimonio
          </TabsTrigger>
          <TabsTrigger value="mayor">
            <IconBook2 className="size-4" />
            Mayor de cuenta
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="resultados">
        <TarjetaLista>
          <BarraLista
            titulo="Estado de resultados"
            descripcion={`Resultado neto: ${formatearMoneda(resultadoEr, moneda)} · ${empresaNombre}`}
            acciones={
              <>
                <Button
                  onClick={() => void consultarEr()}
                  disabled={cargandoEr}
                >
                  {cargandoEr ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconSearch className="size-4" />
                  )}
                  Consultar
                </Button>
                <BotonDescargar
                  tabla={tablaEstadoResultados}
                  nombreArchivo={archivoEstadoResultados}
                />
              </>
            }
            filtros={
              <DateRangePicker
                value={rangoEr}
                onChange={setRangoEr}
                className="w-full sm:w-64"
              />
            }
          >
            <TablaLista<FilaAgrupada>
              filas={filasErVista}
              claveFila={(fila) => fila.clave}
              columnas={columnasAgrupadas}
              vacio={{
                titulo: "Sin movimientos en el período",
                descripcion:
                  "Cambia el rango o registra ingresos, costos y gastos para ver el estado de resultados.",
              }}
            />
          </BarraLista>
        </TarjetaLista>
      </TabsContent>

      <TabsContent value="situacion">
        <TarjetaLista>
          <BarraLista
            titulo="Estado de situación financiera"
            descripcion={
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">
                  Activos {formatearMoneda(totalesBg.activos, moneda)} = Pasivo
                  + Patrimonio + Resultado{" "}
                  {formatearMoneda(totalesBg.ecuacion, moneda)}
                </span>
                <PillEstado
                  estado={totalesBg.cuadra ? "cuadra" : "descuadra"}
                  tono={totalesBg.cuadra ? "exito" : "peligro"}
                >
                  {totalesBg.cuadra ? "Cuadra" : "Descuadre"}
                </PillEstado>
              </span>
            }
            acciones={
              <>
                <Button
                  onClick={() => void consultarBg()}
                  disabled={cargandoBg}
                >
                  {cargandoBg ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconSearch className="size-4" />
                  )}
                  Consultar
                </Button>
                <BotonDescargar
                  tabla={tablaBalanceGeneral}
                  nombreArchivo={archivoBalanceGeneral}
                />
              </>
            }
            filtros={
              <div className="w-full sm:w-56">
                <DatePicker
                  value={fechaCorte}
                  onChange={setFechaCorte}
                  placeholder="Fecha de corte"
                />
              </div>
            }
          >
            <TablaLista<FilaAgrupada>
              filas={filasBgVista}
              claveFila={(fila) => fila.clave}
              columnas={columnasAgrupadas}
              vacio={{
                titulo: "Sin saldos a la fecha de corte",
                descripcion:
                  "Registra asientos contabilizados para construir el estado de situación financiera.",
              }}
            />
          </BarraLista>
        </TarjetaLista>
      </TabsContent>

      <TabsContent value="balance">
        <BalanceComprobacionTab
          moneda={moneda}
          empresa={empresaReporte}
          rangoInicial={rangoInicial}
        />
      </TabsContent>

      <TabsContent value="flujo">
        <TarjetaLista>
          <BarraLista
            titulo="Flujo de efectivo"
            descripcion={`Flujo neto: ${formatearMoneda(resultadoFe, moneda)} · ${empresaNombre}`}
            acciones={
              <>
                <Button
                  onClick={() => void consultarFe()}
                  disabled={cargandoFe}
                >
                  {cargandoFe ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconSearch className="size-4" />
                  )}
                  Consultar
                </Button>
                <BotonDescargar
                  tabla={tablaFlujoEfectivo}
                  nombreArchivo={archivoFlujoEfectivo}
                />
              </>
            }
            filtros={
              <DateRangePicker
                value={rangoFe}
                onChange={setRangoFe}
                className="w-full sm:w-64"
              />
            }
          >
            <TablaLista<FilaAgrupada>
              filas={filasFeVista}
              claveFila={(fila) => fila.clave}
              columnas={columnasAgrupadas}
              vacio={{
                titulo: "Sin movimientos de efectivo",
                descripcion:
                  "Marca tus cuentas de bancos y caja como equivalentes de efectivo para ver el flujo.",
              }}
            />
          </BarraLista>
        </TarjetaLista>
      </TabsContent>

      <TabsContent value="patrimonio">
        <CambiosPatrimonioTab
          moneda={moneda}
          empresa={empresaReporte}
          rangoInicial={rangoInicial}
        />
      </TabsContent>

      <TabsContent value="mayor">
        <MayorCuentaTab
          cuentas={cuentas}
          moneda={moneda}
          empresa={empresaReporte}
          rangoInicial={rangoInicial}
        />
      </TabsContent>
    </Tabs>
  );
}
