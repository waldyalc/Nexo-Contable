"use client";

import { IconLoader2, IconRefresh } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import {
  type FilaBalanceGeneral,
  type FilaCambioPatrimonio,
  type FilaEstadoResultados,
  type FilaFlujoEfectivo,
  consultarBalanceGeneralContableAction,
  consultarCambiosPatrimonioAction,
  consultarEstadoResultadosContableAction,
  consultarFlujoEfectivoContableAction,
} from "@/app/(app)/contabilidad/actions";
import { DatePicker } from "@/components/date-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Moneda, formatearMoneda, hoySantoDomingo } from "@/lib/formato";
import { cn } from "@/lib/utils";

const NOMBRES_CLASIFICACION: Record<string, string> = {
  income: "Ingresos",
  cost: "Costos",
  expense: "Gastos",
  asset: "Activos",
  liability: "Pasivos",
  equity: "Patrimonio",
};

const NOMBRES_FLUJO: Record<string, string> = {
  operating: "Operación",
  investing: "Inversión",
  financing: "Financiamiento",
};

function inicioMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

function ErrorReporte({ mensaje }: { mensaje: string }) {
  return (
    <div className="border-t border-border px-4 py-6 text-sm text-destructive">
      {mensaje}
    </div>
  );
}

function PanelCargando() {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-10 text-sm text-muted-foreground">
      <IconLoader2 className="size-4 animate-spin" />
      Consultando estado financiero…
    </div>
  );
}

function Monto({ valor, moneda }: { valor: number; moneda: Moneda }) {
  return (
    <span className={cn("tabular-nums", valor < 0 && "text-destructive")}>
      {formatearMoneda(valor, moneda)}
    </span>
  );
}

export interface EstadosFinancierosTabProps {
  moneda: Moneda;
}

export function EstadosFinancierosTab({ moneda }: EstadosFinancierosTabProps) {
  return (
    <Tabs defaultValue="income" className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <TabsList className="w-max">
          <TabsTrigger value="income">Resultados</TabsTrigger>
          <TabsTrigger value="position">Situación financiera</TabsTrigger>
          <TabsTrigger value="cashflow">Flujo de efectivo</TabsTrigger>
          <TabsTrigger value="equity">Cambios en patrimonio</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="income">
        <ResultadosTab moneda={moneda} />
      </TabsContent>
      <TabsContent value="position">
        <PosicionTab moneda={moneda} />
      </TabsContent>
      <TabsContent value="cashflow">
        <FlujoTab moneda={moneda} />
      </TabsContent>
      <TabsContent value="equity">
        <PatrimonioTab moneda={moneda} />
      </TabsContent>
    </Tabs>
  );
}

function FiltroRango({
  desde,
  hasta,
  alDesde,
  alHasta,
  cargando,
}: {
  desde: string;
  hasta: string;
  alDesde: (valor: string) => void;
  alHasta: (valor: string) => void;
  cargando: boolean;
}) {
  return (
    <>
      <DatePicker
        value={desde}
        onChange={alDesde}
        aria-label="Fecha inicial del estado financiero"
      />
      <DatePicker
        value={hasta}
        onChange={alHasta}
        aria-label="Fecha final del estado financiero"
      />
      <Button type="button" variant="outline" disabled={cargando}>
        {cargando ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconRefresh className="size-4" />
        )}
        Actualizar
      </Button>
    </>
  );
}

function ResultadosTab({ moneda }: { moneda: Moneda }) {
  const hoy = hoySantoDomingo();
  const [desde, setDesde] = useState(inicioMes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [filas, setFilas] = useState<FilaEstadoResultados[]>([]);
  const [resultado, setResultado] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    void consultarEstadoResultadosContableAction({ desde, hasta }).then(
      (respuesta) => {
        if (!activo) return;
        setCargando(false);
        if (!respuesta.ok) {
          setError(respuesta.error);
          setFilas([]);
          return;
        }
        setError(null);
        setFilas(respuesta.filas);
        setResultado(respuesta.resultado);
      },
    );
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, FilaEstadoResultados[]>();
    for (const fila of filas) {
      const lista = mapa.get(fila.clasificacion) ?? [];
      lista.push(fila);
      mapa.set(fila.clasificacion, lista);
    }
    return ["income", "cost", "expense"]
      .filter((clave) => mapa.has(clave))
      .map((clave) => ({
        clave,
        nombre: NOMBRES_CLASIFICACION[clave] ?? clave,
        filas: mapa.get(clave) ?? [],
        total: (mapa.get(clave) ?? []).reduce(
          (acumulado, fila) => acumulado + fila.monto,
          0,
        ),
      }));
  }, [filas]);

  return (
    <TarjetaLista>
      <BarraLista
        titulo="Estado de resultados"
        descripcion="Ingresos menos costos y gastos del período seleccionado."
        filtros={
          <FiltroRango
            desde={desde}
            hasta={hasta}
            alDesde={setDesde}
            alHasta={setHasta}
            cargando={cargando}
          />
        }
      />
      {error ? <ErrorReporte mensaje={error} /> : null}
      {cargando ? <PanelCargando /> : null}
      {!error && !cargando ? (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {grupos.map((grupo) => (
            <div
              key={grupo.clave}
              className="overflow-hidden rounded-[12px] border border-border"
            >
              <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                <h3 className="font-display text-sm font-semibold">
                  {grupo.nombre}
                </h3>
                <Monto valor={grupo.total} moneda={moneda} />
              </div>
              <TablaLista<FilaEstadoResultados>
                filas={grupo.filas}
                claveFila={(fila) => `${grupo.clave}-${fila.cuentaId}`}
                columnas={[
                  {
                    clave: "cuenta",
                    encabezado: "Cuenta",
                    celda: (fila) => `${fila.codigo} · ${fila.nombre}`,
                  },
                  {
                    clave: "debitos",
                    encabezado: "Débitos",
                    alineacion: "derecha",
                    celda: (fila) => (
                      <Monto valor={fila.debitos} moneda={moneda} />
                    ),
                  },
                  {
                    clave: "creditos",
                    encabezado: "Créditos",
                    alineacion: "derecha",
                    celda: (fila) => (
                      <Monto valor={fila.creditos} moneda={moneda} />
                    ),
                  },
                  {
                    clave: "monto",
                    encabezado: "Monto",
                    alineacion: "derecha",
                    celda: (fila) => (
                      <Monto valor={fila.monto} moneda={moneda} />
                    ),
                  },
                ]}
              />
            </div>
          ))}
          <div className="flex items-center justify-between rounded-[12px] bg-secondary px-4 py-3">
            <span className="font-display font-semibold text-secondary-foreground">
              Resultado neto del período
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-secondary-foreground">
              {formatearMoneda(resultado, moneda)}
            </span>
          </div>
        </div>
      ) : null}
    </TarjetaLista>
  );
}

function PosicionTab({ moneda }: { moneda: Moneda }) {
  const hoy = hoySantoDomingo();
  const [fechaCorte, setFechaCorte] = useState(hoy);
  const [filas, setFilas] = useState<FilaBalanceGeneral[]>([]);
  const [resultado, setResultado] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    void consultarBalanceGeneralContableAction({ fechaCorte }).then(
      (respuesta) => {
        if (!activo) return;
        setCargando(false);
        if (!respuesta.ok) {
          setError(respuesta.error);
          setFilas([]);
          return;
        }
        setError(null);
        setFilas(respuesta.filas);
        setResultado(respuesta.resultado);
      },
    );
    return () => {
      activo = false;
    };
  }, [fechaCorte]);

  const grupos = useMemo(
    () =>
      ["asset", "liability", "equity"].map((clave) => {
        const propias = filas.filter((fila) => fila.clasificacion === clave);
        const base = propias.reduce(
          (acumulado, fila) => acumulado + fila.monto,
          0,
        );
        return {
          clave,
          nombre: NOMBRES_CLASIFICACION[clave] ?? clave,
          filas: propias,
          total: clave === "equity" ? base + resultado : base,
        };
      }),
    [filas, resultado],
  );
  const activo = grupos.find((grupo) => grupo.clave === "asset")?.total ?? 0;
  const pasivo =
    grupos.find((grupo) => grupo.clave === "liability")?.total ?? 0;
  const patrimonio =
    grupos.find((grupo) => grupo.clave === "equity")?.total ?? 0;

  return (
    <TarjetaLista>
      <BarraLista
        titulo="Balance general"
        descripcion="Situación financiera a la fecha de corte."
        filtros={
          <>
            <DatePicker
              value={fechaCorte}
              onChange={setFechaCorte}
              aria-label="Fecha de corte del balance general"
            />
            <Button type="button" variant="outline" disabled={cargando}>
              {cargando ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconRefresh className="size-4" />
              )}
              Actualizar
            </Button>
          </>
        }
      />
      {error ? <ErrorReporte mensaje={error} /> : null}
      {cargando ? <PanelCargando /> : null}
      {!error && !cargando ? (
        <div className="grid gap-4 border-t border-border p-4 xl:grid-cols-2">
          {grupos.map((grupo) => (
            <div
              key={grupo.clave}
              className="overflow-hidden rounded-[12px] border border-border"
            >
              <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                <h3 className="font-display text-sm font-semibold">
                  {grupo.nombre}
                </h3>
                <Monto valor={grupo.total} moneda={moneda} />
              </div>
              <TablaLista<FilaBalanceGeneral>
                filas={grupo.filas}
                claveFila={(fila) => `${grupo.clave}-${fila.cuentaId}`}
                columnas={[
                  {
                    clave: "cuenta",
                    encabezado: "Cuenta",
                    celda: (fila) => `${fila.codigo} · ${fila.nombre}`,
                  },
                  {
                    clave: "monto",
                    encabezado: "Monto",
                    alineacion: "derecha",
                    celda: (fila) => (
                      <Monto valor={fila.monto} moneda={moneda} />
                    ),
                  },
                ]}
              />
              {grupo.clave === "equity" ? (
                <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
                  <span>Resultado del período</span>
                  <Monto valor={resultado} moneda={moneda} />
                </div>
              ) : null}
            </div>
          ))}
          <div className="flex items-center justify-between rounded-[12px] bg-secondary px-4 py-3 xl:col-span-2">
            <span className="font-display font-semibold text-secondary-foreground">
              Ecuación contable: activo − pasivo − patrimonio
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-secondary-foreground">
              {formatearMoneda(activo - pasivo - patrimonio, moneda)}
            </span>
          </div>
        </div>
      ) : null}
    </TarjetaLista>
  );
}

function FlujoTab({ moneda }: { moneda: Moneda }) {
  const hoy = hoySantoDomingo();
  const [desde, setDesde] = useState(inicioMes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [filas, setFilas] = useState<FilaFlujoEfectivo[]>([]);
  const [resultado, setResultado] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    void consultarFlujoEfectivoContableAction({ desde, hasta }).then(
      (respuesta) => {
        if (!activo) return;
        setCargando(false);
        if (!respuesta.ok) {
          setError(respuesta.error);
          setFilas([]);
          return;
        }
        setError(null);
        setFilas(respuesta.filas);
        setResultado(respuesta.resultado);
      },
    );
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  return (
    <TarjetaLista>
      <BarraLista
        titulo="Flujo de efectivo"
        descripcion="Movimiento de efectivo y equivalentes por categoría."
        filtros={
          <FiltroRango
            desde={desde}
            hasta={hasta}
            alDesde={setDesde}
            alHasta={setHasta}
            cargando={cargando}
          />
        }
      />
      {error ? <ErrorReporte mensaje={error} /> : null}
      {cargando ? <PanelCargando /> : null}
      {!error && !cargando ? (
        <>
          <TablaLista<FilaFlujoEfectivo>
            filas={filas}
            claveFila={(fila) => fila.categoria}
            vacio={{
              titulo: "No hay movimiento de efectivo en el período",
              descripcion:
                "Registra cobros, pagos o transferencias en cuentas equivalentes a efectivo.",
            }}
            columnas={[
              {
                clave: "categoria",
                encabezado: "Categoría",
                celda: (fila) =>
                  NOMBRES_FLUJO[fila.categoria] ?? fila.categoria,
              },
              {
                clave: "monto",
                encabezado: "Monto",
                alineacion: "derecha",
                celda: (fila) => <Monto valor={fila.monto} moneda={moneda} />,
              },
            ]}
          />
          <div className="flex items-center justify-between border-t border-border bg-secondary px-4 py-3">
            <span className="font-display font-semibold text-secondary-foreground">
              Flujo neto
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-secondary-foreground">
              {formatearMoneda(resultado, moneda)}
            </span>
          </div>
        </>
      ) : null}
    </TarjetaLista>
  );
}

function PatrimonioTab({ moneda }: { moneda: Moneda }) {
  const hoy = hoySantoDomingo();
  const [desde, setDesde] = useState(inicioMes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [filas, setFilas] = useState<FilaCambioPatrimonio[]>([]);
  const [resultado, setResultado] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    void consultarCambiosPatrimonioAction({ desde, hasta }).then(
      (respuesta) => {
        if (!activo) return;
        setCargando(false);
        if (!respuesta.ok) {
          setError(respuesta.error);
          setFilas([]);
          return;
        }
        setError(null);
        setFilas(respuesta.filas);
        setResultado(respuesta.resultado);
      },
    );
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  return (
    <TarjetaLista>
      <BarraLista
        titulo="Cambios en el patrimonio"
        descripcion="Movimientos netos de cuentas de patrimonio más el resultado del período."
        filtros={
          <FiltroRango
            desde={desde}
            hasta={hasta}
            alDesde={setDesde}
            alHasta={setHasta}
            cargando={cargando}
          />
        }
      />
      {error ? <ErrorReporte mensaje={error} /> : null}
      {cargando ? <PanelCargando /> : null}
      {!error && !cargando ? (
        <>
          <TablaLista<FilaCambioPatrimonio>
            filas={filas}
            claveFila={(fila) => fila.cuentaId ?? "resultado-periodo"}
            vacio={{
              titulo: "No hay movimientos de patrimonio",
              descripcion:
                "Los aportes, retiros y resultados contabilizados aparecerán aquí.",
            }}
            columnas={[
              {
                clave: "cuenta",
                encabezado: "Concepto",
                celda: (fila) => (
                  <span
                    className={fila.esResultado ? "font-semibold" : undefined}
                  >
                    {fila.codigo === ""
                      ? fila.nombre
                      : `${fila.codigo} · ${fila.nombre}`}
                  </span>
                ),
              },
              {
                clave: "movimiento",
                encabezado: "Movimiento neto",
                alineacion: "derecha",
                celda: (fila) => (
                  <Monto valor={fila.movimiento} moneda={moneda} />
                ),
              },
            ]}
          />
          <div className="flex items-center justify-between border-t border-border bg-secondary px-4 py-3">
            <span className="font-display font-semibold text-secondary-foreground">
              Cambio neto en patrimonio
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-secondary-foreground">
              {formatearMoneda(resultado, moneda)}
            </span>
          </div>
        </>
      ) : null}
    </TarjetaLista>
  );
}
