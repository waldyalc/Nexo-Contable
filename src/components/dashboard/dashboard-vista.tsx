"use client";

import {
  IconArrowLeftRight,
  IconBuildingBank,
  IconCoin,
  IconFileInvoice,
  IconLoader2,
  IconReceipt,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GraficoIngresosGastos,
  type PuntoIngresoGasto,
} from "@/components/dashboard/grafico-ingresos-gastos";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Moneda,
  formatearCantidad,
  formatearFecha,
  formatearMoneda,
  hoySantoDomingo,
} from "@/lib/formato";

export interface ResumenEmpresa {
  ventas: number;
  notasCreditoVenta: number;
  compras: number;
  notasCreditoCompra: number;
  itbisVentas: number;
  itbisCompras: number;
  totalActivos: number;
  totalPasivos: number;
  totalPatrimonio: number;
  resultado: number;
  efectivo: number;
  documentosPendientes: number;
  asientos: number;
}

export interface ResumenFirma extends ResumenEmpresa {
  empresaId: string;
  empresa: string;
}

export interface AsientoReciente {
  id: string;
  numero: string;
  fecha: string;
  descripcion: string;
  estado: string;
}

export interface FilaEstadoResultadosDashboard {
  codigo: string;
  nombre: string;
  clasificacion: string;
  monto: number;
}

export interface EmpresaResumen {
  id: string;
  nombreComercial: string;
}

export interface DashboardVistaProps {
  rango: RangoFechas;
  resumen: ResumenEmpresa | null;
  estadoResultados: readonly FilaEstadoResultadosDashboard[];
  serieMensual: readonly PuntoIngresoGasto[];
  ultimosAsientos: readonly AsientoReciente[];
  firma: readonly ResumenFirma[] | null;
  empresas: readonly EmpresaResumen[];
  empresaActivaId: string | null;
  esAdminGlobal: boolean;
  moneda: Moneda;
  error: string | null;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  draft: "borrador",
  posted: "contabilizado",
  reversed: "anulado",
  reversal: "reverso",
};

function rangoEsteMes(): RangoFechas {
  const hoy = hoySantoDomingo();
  return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
}

function rangoEsteAnio(): RangoFechas {
  const hoy = hoySantoDomingo();
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
}

interface Kpi {
  etiqueta: string;
  valor: string;
  detalle: string;
  icono: Icon;
}

export function DashboardVista({
  rango,
  resumen,
  estadoResultados,
  serieMensual,
  ultimosAsientos,
  firma,
  empresas,
  empresaActivaId,
  esAdminGlobal,
  moneda,
  error,
}: DashboardVistaProps) {
  const router = useRouter();
  const [rangoLocal, setRangoLocal] = useState<RangoFechas>(rango);
  const [vista, setVista] = useState<"empresa" | "firma">("empresa");
  const [cambiando, setCambiando] = useState<string | null>(null);

  useEffect(() => {
    setRangoLocal(rango);
  }, [rango]);

  const nombreEmpresaActiva =
    empresas.find((empresa) => empresa.id === empresaActivaId)
      ?.nombreComercial ?? "";

  function cambiarRango(nuevo: RangoFechas) {
    setRangoLocal(nuevo);
    if (nuevo.desde === "" || nuevo.hasta === "" || nuevo.desde > nuevo.hasta) {
      return;
    }
    router.push(`/dashboard?desde=${nuevo.desde}&hasta=${nuevo.hasta}`);
  }

  async function cambiarEmpresa(empresaId: string) {
    if (empresaId === empresaActivaId) {
      toast.info("Ya estás trabajando en esta empresa.");
      return;
    }

    setCambiando(empresaId);

    try {
      const respuesta = await fetch("/api/empresa-activa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId }),
      });

      if (!respuesta.ok) {
        toast.error("No pudimos cambiar de empresa.");
        return;
      }

      toast.success("Empresa activa actualizada");
      router.refresh();
    } catch {
      toast.error("No pudimos cambiar de empresa. Revisa tu conexión.");
    } finally {
      setCambiando(null);
    }
  }

  const netoVentas = resumen ? resumen.ventas - resumen.notasCreditoVenta : 0;
  const netoCompras = resumen
    ? resumen.compras - resumen.notasCreditoCompra
    : 0;

  const kpis: Kpi[] = [
    {
      etiqueta: "Ventas",
      valor: formatearMoneda(netoVentas, moneda),
      detalle: resumen
        ? `ITBIS ${formatearMoneda(resumen.itbisVentas, moneda)}`
        : "Sin datos",
      icono: IconTrendingUp,
    },
    {
      etiqueta: "Compras y gastos",
      valor: formatearMoneda(netoCompras, moneda),
      detalle: resumen
        ? `ITBIS ${formatearMoneda(resumen.itbisCompras, moneda)}`
        : "Sin datos",
      icono: IconTrendingDown,
    },
    {
      etiqueta: "Resultado neto",
      valor: formatearMoneda(resumen?.resultado ?? 0, moneda),
      detalle: "Ingresos − costos − gastos",
      icono: IconReceipt,
    },
    {
      etiqueta: "Efectivo y bancos",
      valor: formatearMoneda(resumen?.efectivo ?? 0, moneda),
      detalle: "Saldos al cierre del rango",
      icono: IconCoin,
    },
    {
      etiqueta: "Activos totales",
      valor: formatearMoneda(resumen?.totalActivos ?? 0, moneda),
      detalle: resumen
        ? `Pasivo ${formatearMoneda(resumen.totalPasivos, moneda)}`
        : "Sin datos",
      icono: IconBuildingBank,
    },
    {
      etiqueta: "Documentos pendientes",
      valor: formatearCantidad(resumen?.documentosPendientes ?? 0, 0),
      detalle: resumen
        ? `${formatearCantidad(resumen.asientos, 0)} asientos en el rango`
        : "Sin datos",
      icono: IconFileInvoice,
    },
  ];

  const agrupadoEstadoResultados = useMemo(() => {
    const grupos = new Map<string, number>();
    for (const fila of estadoResultados) {
      grupos.set(
        fila.clasificacion,
        (grupos.get(fila.clasificacion) ?? 0) + fila.monto,
      );
    }
    return grupos;
  }, [estadoResultados]);

  const filasFirma = useMemo<ResumenFirma[]>(() => {
    if (!firma || firma.length === 0) return [];
    const totales = firma.reduce<ResumenFirma>(
      (acumulado, fila) => {
        acumulado.empresaId = "__total__";
        acumulado.empresa = "Total firma";
        acumulado.ventas += fila.ventas;
        acumulado.notasCreditoVenta += fila.notasCreditoVenta;
        acumulado.compras += fila.compras;
        acumulado.notasCreditoCompra += fila.notasCreditoCompra;
        acumulado.itbisVentas += fila.itbisVentas;
        acumulado.itbisCompras += fila.itbisCompras;
        acumulado.totalActivos += fila.totalActivos;
        acumulado.totalPasivos += fila.totalPasivos;
        acumulado.totalPatrimonio += fila.totalPatrimonio;
        acumulado.resultado += fila.resultado;
        acumulado.efectivo += fila.efectivo;
        acumulado.documentosPendientes += fila.documentosPendientes;
        acumulado.asientos += fila.asientos;
        return acumulado;
      },
      {
        empresaId: "__total__",
        empresa: "Total firma",
        ventas: 0,
        notasCreditoVenta: 0,
        compras: 0,
        notasCreditoCompra: 0,
        itbisVentas: 0,
        itbisCompras: 0,
        totalActivos: 0,
        totalPasivos: 0,
        totalPatrimonio: 0,
        resultado: 0,
        efectivo: 0,
        documentosPendientes: 0,
        asientos: 0,
      },
    );
    return firma.length > 1 ? [...firma, totales] : [...firma];
  }, [firma]);

  const contenidoEmpresa = (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Indicadores del período"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {kpis.map((kpi) => {
          const Icono = kpi.icono;
          return (
            <Card key={kpi.etiqueta} size="sm" className="gap-1">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardDescription>{kpi.etiqueta}</CardDescription>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-secondary text-primary">
                  <Icono className="size-4" />
                </span>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground tabular-nums">
                  {kpi.valor}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {kpi.detalle}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <TarjetaLista>
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
              Ingresos vs. gastos
            </h2>
            <p className="text-sm text-muted-foreground">
              Últimos 6 meses de la empresa activa.
            </p>
          </div>
          <div className="px-3 py-4">
            <GraficoIngresosGastos datos={serieMensual} moneda={moneda} />
          </div>
        </TarjetaLista>

        <TarjetaLista>
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
              Composición del resultado
            </h2>
            <p className="text-sm text-muted-foreground">
              Según el estado de resultados del rango.
            </p>
          </div>
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-muted-foreground">Ingresos</dt>
              <dd className="text-sm font-medium text-foreground tabular-nums">
                {formatearMoneda(
                  agrupadoEstadoResultados.get("income") ?? 0,
                  moneda,
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-muted-foreground">Costos</dt>
              <dd className="text-sm font-medium text-foreground tabular-nums">
                {formatearMoneda(
                  agrupadoEstadoResultados.get("cost") ?? 0,
                  moneda,
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-muted-foreground">Gastos</dt>
              <dd className="text-sm font-medium text-foreground tabular-nums">
                {formatearMoneda(
                  agrupadoEstadoResultados.get("expense") ?? 0,
                  moneda,
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
              <dt className="text-sm font-semibold text-foreground">
                Resultado neto
              </dt>
              <dd className="font-display text-base font-semibold text-foreground tabular-nums">
                {formatearMoneda(resumen?.resultado ?? 0, moneda)}
              </dd>
            </div>
          </dl>
        </TarjetaLista>
      </div>

      <TarjetaLista>
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
            Últimos asientos
          </h2>
          <p className="text-sm text-muted-foreground">
            Movimientos contables más recientes de la empresa.
          </p>
        </div>
        <TablaLista<AsientoReciente>
          filas={ultimosAsientos}
          claveFila={(asiento) => asiento.id}
          vacio={{
            titulo: "Sin asientos recientes",
            descripcion:
              "Cuando contabilices facturas, gastos o asientos manuales aparecerán aquí.",
          }}
          columnas={[
            {
              clave: "numero",
              encabezado: "Asiento",
              celda: (asiento) => (
                <span className="font-medium tabular-nums">
                  {asiento.numero}
                </span>
              ),
            },
            {
              clave: "fecha",
              encabezado: "Fecha",
              celda: (asiento) => formatearFecha(asiento.fecha),
            },
            {
              clave: "descripcion",
              encabezado: "Descripción",
              celda: (asiento) => (
                <span className="block max-w-md truncate">
                  {asiento.descripcion || "—"}
                </span>
              ),
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (asiento) => (
                <PillEstado
                  estado={ETIQUETA_ESTADO[asiento.estado] ?? asiento.estado}
                />
              ),
            },
          ]}
        />
      </TarjetaLista>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            value={rangoLocal}
            onChange={cambiarRango}
            className="w-full sm:w-64"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => cambiarRango(rangoEsteMes())}
          >
            Este mes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cambiarRango(rangoEsteAnio())}
          >
            Este año
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {nombreEmpresaActiva ? `Empresa activa: ${nombreEmpresaActiva}` : ""}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {esAdminGlobal ? (
        <Tabs
          value={vista}
          onValueChange={(valor) =>
            setVista(valor === "firma" ? "firma" : "empresa")
          }
          className="gap-3"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="empresa">Mi empresa</TabsTrigger>
            <TabsTrigger value="firma">Vista de firma</TabsTrigger>
          </TabsList>

          <TabsContent value="empresa">{contenidoEmpresa}</TabsContent>

          <TabsContent value="firma">
            <TarjetaLista>
              <BarraLista
                titulo="Resumen de la firma"
                descripcion={`${empresas.length} empresas · comparativo del rango seleccionado`}
              >
                <TablaLista<ResumenFirma>
                  filas={filasFirma}
                  claveFila={(fila) => fila.empresaId}
                  ordenable
                  paginacion={{ tamanoPagina: 10, etiqueta: "empresas" }}
                  vacio={{
                    titulo: "Sin empresas activas",
                    descripcion:
                      "Crea o activa empresas para ver el consolidado de la firma.",
                  }}
                  columnas={[
                    {
                      clave: "empresa",
                      encabezado: "Empresa",
                      celda: (fila) => (
                        <span
                          className={
                            fila.empresaId === "__total__"
                              ? "font-semibold"
                              : "font-medium"
                          }
                        >
                          {fila.empresa}
                        </span>
                      ),
                    },
                    {
                      clave: "ventas",
                      encabezado: "Ventas netas",
                      alineacion: "derecha",
                      celda: (fila) => (
                        <span
                          className={
                            fila.empresaId === "__total__"
                              ? "font-semibold"
                              : ""
                          }
                        >
                          {formatearMoneda(
                            fila.ventas - fila.notasCreditoVenta,
                            moneda,
                          )}
                        </span>
                      ),
                    },
                    {
                      clave: "compras",
                      encabezado: "Compras netas",
                      alineacion: "derecha",
                      celda: (fila) => (
                        <span
                          className={
                            fila.empresaId === "__total__"
                              ? "font-semibold"
                              : ""
                          }
                        >
                          {formatearMoneda(
                            fila.compras - fila.notasCreditoCompra,
                            moneda,
                          )}
                        </span>
                      ),
                    },
                    {
                      clave: "resultado",
                      encabezado: "Resultado",
                      alineacion: "derecha",
                      celda: (fila) => (
                        <span
                          className={
                            fila.empresaId === "__total__"
                              ? "font-semibold"
                              : "font-medium"
                          }
                        >
                          {formatearMoneda(fila.resultado, moneda)}
                        </span>
                      ),
                    },
                    {
                      clave: "efectivo",
                      encabezado: "Efectivo",
                      alineacion: "derecha",
                      celda: (fila) => (
                        <span
                          className={
                            fila.empresaId === "__total__"
                              ? "font-semibold"
                              : ""
                          }
                        >
                          {formatearMoneda(fila.efectivo, moneda)}
                        </span>
                      ),
                    },
                    {
                      clave: "pendientes",
                      encabezado: "Pendientes",
                      alineacion: "derecha",
                      celda: (fila) =>
                        formatearCantidad(fila.documentosPendientes, 0),
                    },
                    {
                      clave: "acciones",
                      encabezado: "",
                      ordenable: false,
                      alineacion: "derecha",
                      celda: (fila) => {
                        if (fila.empresaId === "__total__") return null;

                        if (fila.empresaId === empresaActivaId) {
                          return (
                            <PillEstado estado="activa">Activa</PillEstado>
                          );
                        }

                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cambiando === fila.empresaId}
                            onClick={() => void cambiarEmpresa(fila.empresaId)}
                          >
                            {cambiando === fila.empresaId ? (
                              <IconLoader2 className="size-3.5 animate-spin" />
                            ) : (
                              <IconArrowLeftRight className="size-3.5" />
                            )}
                            Cambiar
                          </Button>
                        );
                      },
                    },
                  ]}
                />
              </BarraLista>
            </TarjetaLista>
          </TabsContent>
        </Tabs>
      ) : (
        contenidoEmpresa
      )}
    </>
  );
}
