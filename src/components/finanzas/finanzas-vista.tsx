"use client";

import {
  IconCoin,
  IconDownload,
  IconLoader2,
  IconReceipt,
  IconScale,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type FilaBalanceGeneral,
  type FilaEstadoResultados,
  type FilaFlujoEfectivo,
  consultarBalanceGeneralAction,
  consultarEstadoResultadosAction,
  consultarFlujoEfectivoAction,
  exportarEstadoFinancieroAction,
} from "@/app/(app)/finanzas/actions";
import { DatePicker } from "@/components/date-picker";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Moneda, formatearMoneda } from "@/lib/formato";

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

function descargarBase64(archivo: string, base64: string) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = archivo;
  enlace.click();
  URL.revokeObjectURL(url);
}

export interface FinanzasVistaProps {
  empresaId: string;
  empresaNombre: string;
  moneda: Moneda;
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
  moneda,
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
  const [exportandoEr, setExportandoEr] = useState(false);

  const [fechaCorte, setFechaCorte] = useState(fechaCorteInicial);
  const [filasBg, setFilasBg] =
    useState<readonly FilaBalanceGeneral[]>(balanceInicial);
  const [resultadoBg, setResultadoBg] = useState(resultadoBalanceInicial);
  const [cargandoBg, setCargandoBg] = useState(false);
  const [exportandoBg, setExportandoBg] = useState(false);

  const [rangoFe, setRangoFe] = useState<RangoFechas>(rangoInicial);
  const [filasFe, setFilasFe] =
    useState<readonly FilaFlujoEfectivo[]>(flujoInicial);
  const [resultadoFe, setResultadoFe] = useState(resultadoFlujoInicial);
  const [cargandoFe, setCargandoFe] = useState(false);
  const [exportandoFe, setExportandoFe] = useState(false);

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
  }

  async function exportarEr() {
    if (!validarRango(rangoEr)) return;
    setExportandoEr(true);
    const resultado = await exportarEstadoFinancieroAction({
      tipo: "estado_resultados",
      desde: rangoEr.desde,
      hasta: rangoEr.hasta,
    });
    setExportandoEr(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    descargarBase64(resultado.archivo, resultado.base64);
    toast.success("Estado de resultados exportado.");
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
  }

  async function exportarBg() {
    if (fechaCorte === "") {
      toast.error("Selecciona la fecha de corte.");
      return;
    }

    setExportandoBg(true);
    const resultado = await exportarEstadoFinancieroAction({
      tipo: "balance_general",
      fechaCorte,
    });
    setExportandoBg(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    descargarBase64(resultado.archivo, resultado.base64);
    toast.success("Balance general exportado.");
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
  }

  async function exportarFe() {
    if (!validarRango(rangoFe)) return;
    setExportandoFe(true);
    const resultado = await exportarEstadoFinancieroAction({
      tipo: "flujo_efectivo",
      desde: rangoFe.desde,
      hasta: rangoFe.hasta,
    });
    setExportandoFe(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    descargarBase64(resultado.archivo, resultado.base64);
    toast.success("Flujo de efectivo exportado.");
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
          <TabsTrigger value="balance">
            <IconScale className="size-4" />
            Balance general
          </TabsTrigger>
          <TabsTrigger value="flujo">
            <IconCoin className="size-4" />
            Flujo de efectivo
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
                <Button
                  variant="outline"
                  onClick={() => void exportarEr()}
                  disabled={exportandoEr}
                >
                  {exportandoEr ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconDownload className="size-4" />
                  )}
                  Exportar Excel
                </Button>
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

      <TabsContent value="balance">
        <TarjetaLista>
          <BarraLista
            titulo="Balance general"
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
                <Button
                  variant="outline"
                  onClick={() => void exportarBg()}
                  disabled={exportandoBg}
                >
                  {exportandoBg ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconDownload className="size-4" />
                  )}
                  Exportar Excel
                </Button>
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
                  "Registra asientos contabilizados para construir el balance general.",
              }}
            />
          </BarraLista>
        </TarjetaLista>
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
                <Button
                  variant="outline"
                  onClick={() => void exportarFe()}
                  disabled={exportandoFe}
                >
                  {exportandoFe ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconDownload className="size-4" />
                  )}
                  Exportar Excel
                </Button>
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
    </Tabs>
  );
}
