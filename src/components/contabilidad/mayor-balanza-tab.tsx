"use client";

import {
  IconBook2,
  IconDownload,
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
  exportarContableAction,
} from "@/app/(app)/contabilidad/actions";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Moneda,
  formatearFecha,
  formatearMoneda,
  hoySantoDomingo,
} from "@/lib/formato";

const FILA_TOTALES = "__totales__";

interface FilaMayorVista extends FilaMayor {
  clave: string;
}

function rangoInicial(): RangoFechas {
  const hoy = hoySantoDomingo();
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
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

export interface MayorBalanzaTabProps {
  cuentas: readonly CuentaContable[];
  moneda: Moneda;
}

export function MayorBalanzaTab({ cuentas, moneda }: MayorBalanzaTabProps) {
  const [vista, setVista] = useState<"mayor" | "balanza">("mayor");
  const [cuentaId, setCuentaId] = useState("");
  const [rango, setRango] = useState<RangoFechas>(rangoInicial);
  const [filasMayor, setFilasMayor] = useState<FilaMayor[]>([]);
  const [filasBalanza, setFilasBalanza] = useState<FilaBalanza[]>([]);
  const [consultadoMayor, setConsultadoMayor] = useState(false);
  const [consultadoBalanza, setConsultadoBalanza] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);

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
  }

  async function exportar() {
    if (!validarRango()) return;

    if (vista === "mayor" && cuentaId === "") {
      toast.error("Selecciona la cuenta para exportar el mayor.");
      return;
    }

    setExportando(true);
    const resultado = await exportarContableAction({
      tipo: vista,
      cuentaId: vista === "mayor" ? cuentaId : undefined,
      desde: rango.desde,
      hasta: rango.hasta,
    });
    setExportando(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    descargarBase64(resultado.archivo, resultado.base64);
    toast.success("Reporte exportado a Excel.");
  }

  const saldoFinal = filasMayor.at(-1)?.saldo ?? 0;

  return (
    <Tabs
      value={vista}
      onValueChange={(valor) => {
        setVista(valor === "balanza" ? "balanza" : "mayor");
      }}
      className="gap-3"
    >
      <TabsList className="w-fit">
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
                <Button
                  variant="outline"
                  onClick={() => void exportar()}
                  disabled={exportando || filasMayor.length === 0}
                >
                  {exportando ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconDownload className="size-4" />
                  )}
                  Exportar Excel
                </Button>
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
                <Button
                  variant="outline"
                  onClick={() => void exportar()}
                  disabled={exportando || filasBalanza.length === 0}
                >
                  {exportando ? (
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
