"use client";

import {
  IconCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconFileText,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconReceiptTax,
} from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  exportarFormatoDgiiAction,
  guardarConfiguracionFiscalAction,
  guardarMetodoPagoAction,
  guardarObligacionFiscalAction,
  guardarReglaFiscalAction,
  guardarSecuenciaNcfAction,
  marcarObligacionPresentadaAction,
} from "@/app/(app)/impuestos/actions";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { MonthPicker } from "@/components/month-picker";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { descargarBase64 } from "@/lib/dgii/descarga";
import type { Fila606, Fila607 } from "@/lib/dgii/exportar-606-607";
import {
  aNumero,
  formatearFecha,
  formatearMoneda,
  formatearPeriodoMes,
} from "@/lib/formato";
import {
  type EstadoConfiguracionFiscal,
  type EstadoFormularioMetodoPago,
  type EstadoFormularioObligacion,
  type EstadoFormularioPresentar,
  type EstadoFormularioRegla,
  type EstadoFormularioSecuencia,
  estadoInicialConfiguracion,
  estadoInicialMetodoPago,
  estadoInicialObligacion,
  estadoInicialPresentar,
  estadoInicialRegla,
  estadoInicialSecuencia,
} from "@/lib/operaciones/impuestos-dialogos";
import {
  type ConfiguracionFiscalListado,
  type CuentaOpcion,
  ETIQUETAS_ESTADO_OBLIGACION,
  FORMULARIOS_FISCALES,
  type MetodoPagoOpcion,
  type ObligacionFiscalListado,
  type ReglaFiscalListado,
  type SecuenciaNcfListado,
  TIPOS_COMPROBANTE_DGII,
  mesDesdePeriodoDgii,
  periodoDgiiDesdeMes,
} from "@/lib/operaciones/tipos";

export interface ImpuestosVistaProps {
  empresaId: string;
  periodo: string;
  reporte606: readonly Fila606[];
  reporte607: readonly Fila607[];
  secuencias: readonly SecuenciaNcfListado[];
  configuracion: ConfiguracionFiscalListado;
  reglas: readonly ReglaFiscalListado[];
  metodosPago: readonly MetodoPagoOpcion[];
  obligaciones: readonly ObligacionFiscalListado[];
  cuentas: readonly CuentaOpcion[];
  moneda: "DOP" | "USD";
}

const OPCIONES_TIPO_COMPROBANTE = TIPOS_COMPROBANTE_DGII.map((tipo) => ({
  value: tipo,
  label: tipo,
}));

const OPCIONES_TIPO_REGLA = [
  { value: "itbis", label: "ITBIS" },
  { value: "isr", label: "ISR" },
  { value: "retencion_itbis", label: "Retención ITBIS" },
  { value: "retencion_isr", label: "Retención ISR" },
  { value: "otro", label: "Otro" },
];

const OPCIONES_ESTADO_OBLIGACION = [
  { value: "pending", label: "Pendiente" },
  { value: "filed", label: "Presentada" },
  { value: "paid", label: "Pagada" },
  { value: "overdue", label: "Vencida" },
];

export function ImpuestosVista({
  empresaId,
  periodo,
  reporte606,
  reporte607,
  secuencias,
  configuracion,
  reglas,
  metodosPago,
  obligaciones,
  cuentas,
  moneda,
}: ImpuestosVistaProps) {
  const router = useRouter();
  const pathname = usePathname();

  function cambiarPeriodo(valor: string) {
    const parametros = new URLSearchParams();
    if (valor !== "") parametros.set("periodo", valor);
    const cadena = parametros.toString();
    router.push(cadena === "" ? pathname : `${pathname}?${cadena}`);
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Impuestos"
        descripcion="Formatos 606/607, secuencias NCF y e-CF, configuración fiscal y obligaciones de la DGII."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Impuestos" }]}
      />

      <Tabs defaultValue="formatos">
        <TabsList>
          <TabsTrigger value="formatos">Formatos 606 / 607</TabsTrigger>
          <TabsTrigger value="secuencias">Secuencias NCF y e-CF</TabsTrigger>
          <TabsTrigger value="configuracion">
            Reglas y configuración
          </TabsTrigger>
          <TabsTrigger value="obligaciones">Obligaciones fiscales</TabsTrigger>
        </TabsList>

        <TabsContent value="formatos">
          <PanelFormatos
            key={empresaId}
            empresaId={empresaId}
            periodo={periodo}
            reporte606={reporte606}
            reporte607={reporte607}
            moneda={moneda}
            onCambiarPeriodo={cambiarPeriodo}
          />
        </TabsContent>

        <TabsContent value="secuencias">
          <PanelSecuencias
            key={empresaId}
            empresaId={empresaId}
            secuencias={secuencias}
            onCambio={() => router.refresh()}
          />
        </TabsContent>

        <TabsContent value="configuracion">
          <PanelConfiguracion
            key={empresaId}
            empresaId={empresaId}
            configuracion={configuracion}
            reglas={reglas}
            metodosPago={metodosPago}
            cuentas={cuentas}
            moneda={moneda}
            onCambio={() => router.refresh()}
          />
        </TabsContent>

        <TabsContent value="obligaciones">
          <PanelObligaciones
            key={empresaId}
            empresaId={empresaId}
            obligaciones={obligaciones}
            periodo={periodo}
            moneda={moneda}
            onCambio={() => router.refresh()}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface PanelFormatosProps {
  empresaId: string;
  periodo: string;
  reporte606: readonly Fila606[];
  reporte607: readonly Fila607[];
  moneda: "DOP" | "USD";
  onCambiarPeriodo: (periodo: string) => void;
}

function PanelFormatos({
  empresaId,
  periodo,
  reporte606,
  reporte607,
  moneda,
  onCambiarPeriodo,
}: PanelFormatosProps) {
  const [descargando, setDescargando] = useState<string | null>(null);

  const incluidos606 = useMemo(
    () => reporte606.filter((fila) => fila.incluido),
    [reporte606],
  );
  const excluidos606 = useMemo(
    () => reporte606.filter((fila) => !fila.incluido),
    [reporte606],
  );
  const incluidos607 = useMemo(
    () => reporte607.filter((fila) => fila.incluido),
    [reporte607],
  );
  const excluidos607 = useMemo(
    () => reporte607.filter((fila) => !fila.incluido),
    [reporte607],
  );

  async function descargar(formato: "606" | "607", tipo: "excel" | "txt") {
    if (periodo === "") {
      toast.error("Selecciona el período del formato.");
      return;
    }

    setDescargando(`${formato}-${tipo}`);
    const resultado = await exportarFormatoDgiiAction({
      empresaId,
      formato,
      periodo: periodoDgiiDesdeMes(periodo),
      tipo,
    });
    setDescargando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    descargarBase64(
      resultado.nombreArchivo,
      resultado.contenidoBase64,
      resultado.mime,
    );
    toast.success(`Formato ${formato} generado`);
  }

  return (
    <div className="flex flex-col gap-4">
      <TarjetaLista>
        <BarraLista
          titulo="Formatos DGII"
          descripcion={`Período ${formatearPeriodoMes(periodo) || periodo}`}
          filtros={
            <MonthPicker
              value={periodo}
              onChange={onCambiarPeriodo}
              permitirLimpiar
              placeholder="Período fiscal"
              className="w-[200px]"
            />
          }
        >
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-9 whitespace-nowrap"
              disabled={descargando !== null}
              onClick={() => void descargar("606", "excel")}
            >
              {descargando === "606-excel" ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconFileSpreadsheet className="size-4" />
              )}
              Excel 606 (Incluidos + Excluidos)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 whitespace-nowrap"
              disabled={descargando !== null}
              onClick={() => void descargar("606", "txt")}
            >
              {descargando === "606-txt" ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconFileText className="size-4" />
              )}
              TXT 606
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 whitespace-nowrap"
              disabled={descargando !== null}
              onClick={() => void descargar("607", "excel")}
            >
              {descargando === "607-excel" ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconFileSpreadsheet className="size-4" />
              )}
              Excel 607 (Incluidos + Excluidos)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 whitespace-nowrap"
              disabled={descargando !== null}
              onClick={() => void descargar("607", "txt")}
            >
              {descargando === "607-txt" ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconFileText className="size-4" />
              )}
              TXT 607
            </Button>
          </div>
        </BarraLista>
      </TarjetaLista>

      <TarjetaLista>
        <BarraLista
          titulo="606 · Compras y gastos"
          descripcion={`${incluidos606.length} incluidos · ${excluidos606.length} excluidos`}
        >
          <TablaLista<Fila606>
            filas={reporte606}
            claveFila={(fila) => `${fila.documento_id}-606`}
            ordenable
            paginacion={{ tamanoPagina: 10, etiqueta: "registros" }}
            vacio={{
              titulo: "Sin registros 606",
              descripcion: "No hay compras en el período seleccionado.",
              icono: <IconDownload className="size-8" />,
            }}
            columnas={[
              {
                clave: "rnc",
                encabezado: "RNC",
                celda: (fila) => fila.rnc,
              },
              {
                clave: "tercero",
                encabezado: "Proveedor",
                celda: (fila) => fila.nombre,
              },
              {
                clave: "ncf",
                encabezado: "NCF",
                celda: (fila) => (
                  <span className="font-mono text-xs">{fila.ncf}</span>
                ),
              },
              {
                clave: "fecha",
                encabezado: "Fecha",
                celda: (fila) => formatearFecha(fila.fecha_comprobante),
              },
              {
                clave: "monto",
                encabezado: "Monto",
                alineacion: "derecha",
                celda: (fila) => formatearMoneda(fila.monto_facturado, moneda),
              },
              {
                clave: "itbis",
                encabezado: "ITBIS",
                alineacion: "derecha",
                celda: (fila) => formatearMoneda(fila.itbis_facturado, moneda),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (fila) =>
                  fila.incluido ? (
                    <PillEstado estado="saldada">Incluido</PillEstado>
                  ) : (
                    <PillEstado estado="anulada">
                      {fila.motivo_exclusion === ""
                        ? "Excluido"
                        : fila.motivo_exclusion}
                    </PillEstado>
                  ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <TarjetaLista>
        <BarraLista
          titulo="607 · Ventas"
          descripcion={`${incluidos607.length} incluidos · ${excluidos607.length} excluidos`}
        >
          <TablaLista<Fila607>
            filas={reporte607}
            claveFila={(fila) => `${fila.documento_id}-607`}
            ordenable
            paginacion={{ tamanoPagina: 10, etiqueta: "registros" }}
            vacio={{
              titulo: "Sin registros 607",
              descripcion: "No hay ventas en el período seleccionado.",
              icono: <IconDownload className="size-8" />,
            }}
            columnas={[
              {
                clave: "rnc",
                encabezado: "RNC",
                celda: (fila) => fila.rnc,
              },
              {
                clave: "tercero",
                encabezado: "Cliente",
                celda: (fila) => fila.nombre,
              },
              {
                clave: "ncf",
                encabezado: "NCF",
                celda: (fila) => (
                  <span className="font-mono text-xs">{fila.ncf}</span>
                ),
              },
              {
                clave: "fecha",
                encabezado: "Fecha",
                celda: (fila) => formatearFecha(fila.fecha_comprobante),
              },
              {
                clave: "total",
                encabezado: "Total",
                alineacion: "derecha",
                celda: (fila) => formatearMoneda(fila.total, moneda),
              },
              {
                clave: "itbis",
                encabezado: "ITBIS",
                alineacion: "derecha",
                celda: (fila) => formatearMoneda(fila.itbis_facturado, moneda),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (fila) =>
                  fila.incluido ? (
                    <PillEstado estado="saldada">Incluido</PillEstado>
                  ) : (
                    <PillEstado estado="anulada">
                      {fila.motivo_exclusion === ""
                        ? "Excluido"
                        : fila.motivo_exclusion}
                    </PillEstado>
                  ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <p className="text-xs text-muted-foreground">
        Los registros excluidos no entran al TXT ni al conteo de la cabecera; se
        listan en la segunda hoja del Excel para corregirlos antes de presentar.
      </p>
    </div>
  );
}

interface PanelSecuenciasProps {
  empresaId: string;
  secuencias: readonly SecuenciaNcfListado[];
  onCambio: () => void;
}

function PanelSecuencias({
  empresaId,
  secuencias,
  onCambio,
}: PanelSecuenciasProps) {
  const [abierto, setAbierto] = useState(false);
  const [edicion, setEdicion] = useState<SecuenciaNcfListado | null>(null);

  const activas = secuencias.filter((secuencia) => secuencia.activo).length;

  return (
    <>
      <TarjetaLista>
        <BarraLista
          titulo="Secuencias NCF y e-CF"
          descripcion={`${secuencias.length} secuencias · ${activas} activas · serie B (B01–B17) y electrónica E (E31–E47)`}
          acciones={
            <Button
              onClick={() => {
                setEdicion(null);
                setAbierto(true);
              }}
            >
              <IconPlus className="size-4" />
              Nueva secuencia
            </Button>
          }
        >
          <TablaLista<SecuenciaNcfListado>
            filas={secuencias}
            claveFila={(secuencia) => secuencia.id}
            ordenable
            paginacion={{ tamanoPagina: 10, etiqueta: "secuencias" }}
            vacio={{
              titulo: "Sin secuencias NCF",
              descripcion:
                "Crea la primera secuencia autorizada por la DGII para emitir facturas.",
              icono: <IconReceiptTax className="size-8" />,
            }}
            columnas={[
              {
                clave: "tipo",
                encabezado: "Tipo",
                celda: (secuencia) => (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {secuencia.tipoComprobante}
                    </span>
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      Serie {secuencia.serie}
                    </span>
                  </div>
                ),
              },
              {
                clave: "prefijo",
                encabezado: "Prefijo",
                celda: (secuencia) => (
                  <span className="font-mono text-xs">{secuencia.prefijo}</span>
                ),
              },
              {
                clave: "rango",
                encabezado: "Rango",
                celda: (secuencia) =>
                  `${secuencia.numeroInicial} – ${secuencia.numeroFinal}`,
              },
              {
                clave: "consumido",
                encabezado: "Consumido / disponible",
                celda: (secuencia) => {
                  const total =
                    secuencia.numeroFinal - secuencia.numeroInicial + 1;
                  const consumido = Math.max(
                    secuencia.numeroActual - secuencia.numeroInicial + 1,
                    0,
                  );
                  const disponible = Math.max(total - consumido, 0);
                  const porcentaje =
                    total === 0 ? 0 : Math.min((consumido / total) * 100, 100);

                  return (
                    <div className="flex min-w-40 flex-col gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {consumido} usados · {disponible} disponibles
                      </span>
                      <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </span>
                    </div>
                  );
                },
              },
              {
                clave: "vencimiento",
                encabezado: "Vence",
                celda: (secuencia) =>
                  secuencia.fechaVencimiento
                    ? formatearFecha(secuencia.fechaVencimiento)
                    : "Sin vencimiento",
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (secuencia) => (
                  <PillEstado
                    estado={secuencia.activo ? "activa" : "inactiva"}
                  />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (secuencia) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar secuencia ${secuencia.prefijo}`}
                    onClick={() => {
                      setEdicion(secuencia);
                      setAbierto(true);
                    }}
                  >
                    <IconPencil className="size-4" />
                  </Button>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <DialogoSecuencia
        abierto={abierto}
        onOpenChange={setAbierto}
        empresaId={empresaId}
        secuencia={edicion}
        onGuardado={onCambio}
      />
    </>
  );
}

interface DialogoSecuenciaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  secuencia: SecuenciaNcfListado | null;
  onGuardado: () => void;
}

function DialogoSecuencia({
  abierto,
  onOpenChange,
  empresaId,
  secuencia,
  onGuardado,
}: DialogoSecuenciaProps) {
  const [form, setForm] = useState<EstadoFormularioSecuencia>(() =>
    estadoInicialSecuencia(secuencia),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setForm(estadoInicialSecuencia(secuencia));
    setGuardando(false);
    setError(null);
  }, [abierto, secuencia]);

  function actualizar<C extends keyof EstadoFormularioSecuencia>(
    campo: C,
    valor: EstadoFormularioSecuencia[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    setError(null);
    setGuardando(true);

    const resultado = await guardarSecuenciaNcfAction({
      empresaId,
      id: secuencia?.id ?? null,
      tipoComprobante: form.tipoComprobante,
      prefijo: form.prefijo,
      numeroInicial: Number(form.numeroInicial),
      numeroFinal: Number(form.numeroFinal),
      fechaVencimiento: form.vencimiento === "" ? null : form.vencimiento,
      activo: form.activo,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {secuencia ? "Editar secuencia NCF" : "Nueva secuencia NCF"}
            </DialogTitle>
            <DialogDescription>
              Serie B (B01–B17) y serie electrónica E (E31–E47). El prefijo debe
              comenzar con el tipo de comprobante.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormGrid>
            <FormField
              htmlFor="secuencia-tipo"
              label="Tipo de comprobante"
              required
            >
              <SelectCampo
                id="secuencia-tipo"
                opciones={OPCIONES_TIPO_COMPROBANTE}
                valor={form.tipoComprobante}
                onCambio={(valor) => actualizar("tipoComprobante", valor)}
                requerido
                deshabilitado={secuencia !== null}
                aria-label="Tipo de comprobante"
              />
            </FormField>

            <FormField htmlFor="secuencia-prefijo" label="Prefijo" required>
              <Input
                id="secuencia-prefijo"
                value={form.prefijo}
                onChange={(evento) =>
                  actualizar("prefijo", evento.target.value.toUpperCase())
                }
                placeholder="B02"
                className="font-mono text-xs uppercase"
                disabled={secuencia !== null}
              />
            </FormField>

            <FormField
              htmlFor="secuencia-inicial"
              label="Número inicial"
              required
            >
              <Input
                id="secuencia-inicial"
                type="number"
                min="1"
                value={form.numeroInicial}
                onChange={(evento) =>
                  actualizar("numeroInicial", evento.target.value)
                }
                className="tabular-nums"
                disabled={secuencia !== null}
              />
            </FormField>

            <FormField htmlFor="secuencia-final" label="Número final" required>
              <Input
                id="secuencia-final"
                type="number"
                min="1"
                value={form.numeroFinal}
                onChange={(evento) =>
                  actualizar("numeroFinal", evento.target.value)
                }
                className="tabular-nums"
              />
            </FormField>

            <FormField htmlFor="secuencia-vencimiento" label="Vencimiento">
              <DatePicker
                id="secuencia-vencimiento"
                value={form.vencimiento}
                onChange={(valor) => actualizar("vencimiento", valor)}
                permitirLimpiar
              />
            </FormField>

            <label
              htmlFor="secuencia-activo"
              className="flex cursor-pointer items-center gap-2.5 self-end rounded-[10px] border border-border bg-muted/50 px-3 py-2.5"
            >
              <Checkbox
                id="secuencia-activo"
                checked={form.activo}
                onCheckedChange={(valor) => actualizar("activo", valor)}
              />
              <span className="text-sm font-medium text-foreground">
                Activa
              </span>
            </label>
          </FormGrid>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>{secuencia ? "Guardar cambios" : "Crear secuencia"}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PanelConfiguracionProps {
  empresaId: string;
  configuracion: ConfiguracionFiscalListado;
  reglas: readonly ReglaFiscalListado[];
  metodosPago: readonly MetodoPagoOpcion[];
  cuentas: readonly CuentaOpcion[];
  moneda: "DOP" | "USD";
  onCambio: () => void;
}

function PanelConfiguracion({
  empresaId,
  configuracion,
  reglas,
  metodosPago,
  cuentas,
  moneda,
  onCambio,
}: PanelConfiguracionProps) {
  const [form, setForm] = useState<EstadoConfiguracionFiscal>(() =>
    estadoInicialConfiguracion(configuracion),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reglaAbierta, setReglaAbierta] = useState(false);
  const [reglaEdicion, setReglaEdicion] = useState<ReglaFiscalListado | null>(
    null,
  );
  const [metodoAbierto, setMetodoAbierto] = useState(false);
  const [metodoEdicion, setMetodoEdicion] = useState<MetodoPagoOpcion | null>(
    null,
  );

  useEffect(() => {
    setForm(estadoInicialConfiguracion(configuracion));
    setGuardando(false);
    setError(null);
    setReglaAbierta(false);
    setReglaEdicion(null);
    setMetodoAbierto(false);
    setMetodoEdicion(null);
  }, [configuracion]);

  function actualizar<C extends keyof EstadoConfiguracionFiscal>(
    campo: C,
    valor: EstadoConfiguracionFiscal[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  const opcionesCuentas = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));

  function aBps(valor: string): number {
    return Math.round(aNumero(valor) * 100);
  }

  function vacioONull(valor: string): string | null {
    return valor === "" ? null : valor;
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    setError(null);
    setGuardando(true);

    const resultado = await guardarConfiguracionFiscalAction({
      empresaId,
      tasaItbisBps: aBps(form.tasaItbis),
      retencionIsrServiciosBps: aBps(form.retencionIsr),
      retencionItbisServiciosBps: aBps(form.retencionItbis),
      cuentaItbisAdelantadoId: vacioONull(form.cuentaItbisAdelantado),
      cuentaItbisPorPagarId: vacioONull(form.cuentaItbisPorPagar),
      cuentaRetencionIsrId: vacioONull(form.cuentaRetencionIsr),
      cuentaRetencionItbisId: vacioONull(form.cuentaRetencionItbis),
      cuentaCxcDefaultId: vacioONull(form.cuentaCxc),
      cuentaCxpDefaultId: vacioONull(form.cuentaCxp),
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onCambio();
  }

  const nombresCuentas = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));

  return (
    <div className="flex flex-col gap-4">
      <TarjetaLista>
        <BarraLista
          titulo="Configuración fiscal"
          descripcion="Tasas de ITBIS y retenciones, y cuentas contables por defecto."
        >
          <form
            className="flex flex-col gap-4 px-4 py-4"
            onSubmit={guardar}
            noValidate
          >
            {error ? (
              <p
                role="alert"
                className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <FormGrid>
              <FormField htmlFor="fiscal-itbis" label="ITBIS (%)" required>
                <Input
                  id="fiscal-itbis"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.tasaItbis}
                  onChange={(evento) =>
                    actualizar("tasaItbis", evento.target.value)
                  }
                  className="tabular-nums"
                />
              </FormField>

              <FormField
                htmlFor="fiscal-ret-isr"
                label="Retención ISR servicios (%)"
                required
              >
                <Input
                  id="fiscal-ret-isr"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.retencionIsr}
                  onChange={(evento) =>
                    actualizar("retencionIsr", evento.target.value)
                  }
                  className="tabular-nums"
                />
              </FormField>

              <FormField
                htmlFor="fiscal-ret-itbis"
                label="Retención ITBIS servicios (%)"
                required
              >
                <Input
                  id="fiscal-ret-itbis"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.retencionItbis}
                  onChange={(evento) =>
                    actualizar("retencionItbis", evento.target.value)
                  }
                  className="tabular-nums"
                />
              </FormField>

              <FormField
                htmlFor="fiscal-itbis-adelantado"
                label="ITBIS adelantado"
              >
                <SelectCampo
                  id="fiscal-itbis-adelantado"
                  opciones={opcionesCuentas}
                  valor={form.cuentaItbisAdelantado}
                  onCambio={(valor) =>
                    actualizar("cuentaItbisAdelantado", valor)
                  }
                  etiquetaVacia="Sin cuenta"
                  buscable
                  aria-label="Cuenta de ITBIS adelantado"
                />
              </FormField>

              <FormField htmlFor="fiscal-itbis-pagar" label="ITBIS por pagar">
                <SelectCampo
                  id="fiscal-itbis-pagar"
                  opciones={opcionesCuentas}
                  valor={form.cuentaItbisPorPagar}
                  onCambio={(valor) => actualizar("cuentaItbisPorPagar", valor)}
                  etiquetaVacia="Sin cuenta"
                  buscable
                  aria-label="Cuenta de ITBIS por pagar"
                />
              </FormField>

              <FormField
                htmlFor="fiscal-ret-isr-cuenta"
                label="Retención ISR por pagar"
              >
                <SelectCampo
                  id="fiscal-ret-isr-cuenta"
                  opciones={opcionesCuentas}
                  valor={form.cuentaRetencionIsr}
                  onCambio={(valor) => actualizar("cuentaRetencionIsr", valor)}
                  etiquetaVacia="Sin cuenta"
                  buscable
                  aria-label="Cuenta de retención ISR"
                />
              </FormField>

              <FormField
                htmlFor="fiscal-ret-itbis-cuenta"
                label="Retención ITBIS por pagar"
              >
                <SelectCampo
                  id="fiscal-ret-itbis-cuenta"
                  opciones={opcionesCuentas}
                  valor={form.cuentaRetencionItbis}
                  onCambio={(valor) =>
                    actualizar("cuentaRetencionItbis", valor)
                  }
                  etiquetaVacia="Sin cuenta"
                  buscable
                  aria-label="Cuenta de retención ITBIS"
                />
              </FormField>

              <FormField
                htmlFor="fiscal-cxc"
                label="Cuenta por cobrar por defecto"
              >
                <SelectCampo
                  id="fiscal-cxc"
                  opciones={opcionesCuentas}
                  valor={form.cuentaCxc}
                  onCambio={(valor) => actualizar("cuentaCxc", valor)}
                  etiquetaVacia="Sin cuenta"
                  buscable
                  aria-label="Cuenta por cobrar por defecto"
                />
              </FormField>

              <FormField
                htmlFor="fiscal-cxp"
                label="Cuenta por pagar por defecto"
              >
                <SelectCampo
                  id="fiscal-cxp"
                  opciones={opcionesCuentas}
                  valor={form.cuentaCxp}
                  onCambio={(valor) => actualizar("cuentaCxp", valor)}
                  etiquetaVacia="Sin cuenta"
                  buscable
                  aria-label="Cuenta por pagar por defecto"
                />
              </FormField>
            </FormGrid>

            <div className="flex justify-end">
              <Button type="submit" className="h-9" disabled={guardando}>
                {guardando ? (
                  <>
                    <IconLoader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <IconCheck className="size-4" />
                    Guardar configuración
                  </>
                )}
              </Button>
            </div>
          </form>
        </BarraLista>
      </TarjetaLista>

      <TarjetaLista>
        <BarraLista
          titulo="Reglas fiscales"
          descripcion={`${reglas.length} reglas configuradas`}
          acciones={
            <Button
              variant="outline"
              onClick={() => {
                setReglaEdicion(null);
                setReglaAbierta(true);
              }}
            >
              <IconPlus className="size-4" />
              Nueva regla
            </Button>
          }
        >
          <TablaLista<ReglaFiscalListado>
            filas={reglas}
            claveFila={(regla) => regla.id}
            paginacion={{ tamanoPagina: 10, etiqueta: "reglas" }}
            vacio={{
              titulo: "Sin reglas fiscales",
              descripcion: "Agrega las tasas que uses en tus documentos.",
              icono: <IconReceiptTax className="size-8" />,
            }}
            columnas={[
              {
                clave: "codigo",
                encabezado: "Código",
                celda: (regla) => (
                  <span className="font-mono text-xs">{regla.codigo}</span>
                ),
              },
              {
                clave: "nombre",
                encabezado: "Nombre",
                celda: (regla) => regla.nombre,
              },
              {
                clave: "tipo",
                encabezado: "Tipo",
                celda: (regla) => regla.tipo,
              },
              {
                clave: "tasa",
                encabezado: "Tasa",
                alineacion: "derecha",
                celda: (regla) => `${(regla.tasaBps / 100).toFixed(2)} %`,
              },
              {
                clave: "cuenta",
                encabezado: "Cuenta",
                celda: (regla) => {
                  const cuenta = regla.cuentaId
                    ? nombresCuentas.get(regla.cuentaId)
                    : undefined;
                  return cuenta ? `${cuenta.codigo} · ${cuenta.nombre}` : "—";
                },
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (regla) => (
                  <PillEstado estado={regla.activa ? "activa" : "inactiva"} />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (regla) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar regla ${regla.codigo}`}
                    onClick={() => {
                      setReglaEdicion(regla);
                      setReglaAbierta(true);
                    }}
                  >
                    <IconPencil className="size-4" />
                  </Button>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <TarjetaLista>
        <BarraLista
          titulo="Métodos de pago"
          descripcion={`${metodosPago.length} métodos configurados`}
          acciones={
            <Button
              variant="outline"
              onClick={() => {
                setMetodoEdicion(null);
                setMetodoAbierto(true);
              }}
            >
              <IconPlus className="size-4" />
              Nuevo método
            </Button>
          }
        >
          <TablaLista<MetodoPagoOpcion>
            filas={metodosPago}
            claveFila={(metodo) => metodo.id}
            paginacion={{ tamanoPagina: 10, etiqueta: "métodos" }}
            vacio={{
              titulo: "Sin métodos de pago",
              descripcion:
                "Crea efectivo, transferencia o cheque con su cuenta.",
              icono: <IconReceiptTax className="size-8" />,
            }}
            columnas={[
              {
                clave: "nombre",
                encabezado: "Método",
                celda: (metodo) => metodo.nombre,
              },
              {
                clave: "cuenta",
                encabezado: "Cuenta contable",
                celda: (metodo) => {
                  const cuenta = nombresCuentas.get(metodo.cuentaId);
                  return cuenta ? `${cuenta.codigo} · ${cuenta.nombre}` : "—";
                },
              },
              {
                clave: "cxp",
                encabezado: "Deja CxP",
                celda: (metodo) => (metodo.dejaCxpProveedor ? "Sí" : "No"),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (metodo) => (
                  <PillEstado estado={metodo.activo ? "activa" : "inactiva"} />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (metodo) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar método ${metodo.nombre}`}
                    onClick={() => {
                      setMetodoEdicion(metodo);
                      setMetodoAbierto(true);
                    }}
                  >
                    <IconPencil className="size-4" />
                  </Button>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <DialogoRegla
        abierto={reglaAbierta}
        onOpenChange={setReglaAbierta}
        empresaId={empresaId}
        regla={reglaEdicion}
        cuentas={cuentas}
        onGuardado={onCambio}
      />

      <DialogoMetodoPago
        abierto={metodoAbierto}
        onOpenChange={setMetodoAbierto}
        empresaId={empresaId}
        metodo={metodoEdicion}
        cuentas={cuentas}
        moneda={moneda}
        onGuardado={onCambio}
      />
    </div>
  );
}

interface DialogoReglaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  regla: ReglaFiscalListado | null;
  cuentas: readonly CuentaOpcion[];
  onGuardado: () => void;
}

function DialogoRegla({
  abierto,
  onOpenChange,
  empresaId,
  regla,
  cuentas,
  onGuardado,
}: DialogoReglaProps) {
  const [form, setForm] = useState<EstadoFormularioRegla>(() =>
    estadoInicialRegla(regla),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setForm(estadoInicialRegla(regla));
    setGuardando(false);
    setError(null);
  }, [abierto, regla]);

  function actualizar<C extends keyof EstadoFormularioRegla>(
    campo: C,
    valor: EstadoFormularioRegla[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  const opcionesCuentas = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    setError(null);
    setGuardando(true);

    const resultado = await guardarReglaFiscalAction({
      empresaId,
      id: regla?.id ?? null,
      codigo: form.codigo,
      nombre: form.nombre,
      tipo: form.tipo,
      tasaBps: Math.round(aNumero(form.tasa) * 100),
      cuentaId: form.cuentaId === "" ? null : form.cuentaId,
      activa: form.activa,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {regla ? "Editar regla fiscal" : "Nueva regla fiscal"}
            </DialogTitle>
            <DialogDescription>
              Código, tipo y tasa en porcentaje. El motor la usa para calcular
              impuestos y retenciones.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormGrid>
            <FormField htmlFor="regla-codigo" label="Código" required>
              <Input
                id="regla-codigo"
                value={form.codigo}
                onChange={(evento) =>
                  actualizar("codigo", evento.target.value.toUpperCase())
                }
                placeholder="ITBIS18"
                className="font-mono text-xs uppercase"
              />
            </FormField>

            <FormField
              htmlFor="regla-nombre"
              label="Nombre"
              required
              className="sm:col-span-2"
            >
              <Input
                id="regla-nombre"
                value={form.nombre}
                onChange={(evento) => actualizar("nombre", evento.target.value)}
                placeholder="ITBIS 18%"
              />
            </FormField>

            <FormField htmlFor="regla-tipo" label="Tipo" required>
              <SelectCampo
                id="regla-tipo"
                opciones={OPCIONES_TIPO_REGLA}
                valor={form.tipo}
                onCambio={(valor) => actualizar("tipo", valor)}
                requerido
                aria-label="Tipo de regla fiscal"
              />
            </FormField>

            <FormField htmlFor="regla-tasa" label="Tasa (%)" required>
              <Input
                id="regla-tasa"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.tasa}
                onChange={(evento) => actualizar("tasa", evento.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField htmlFor="regla-cuenta" label="Cuenta contable">
              <SelectCampo
                id="regla-cuenta"
                opciones={opcionesCuentas}
                valor={form.cuentaId}
                onCambio={(valor) => actualizar("cuentaId", valor)}
                etiquetaVacia="Sin cuenta"
                buscable
                aria-label="Cuenta de la regla fiscal"
              />
            </FormField>

            <label
              htmlFor="regla-activa"
              className="flex cursor-pointer items-center gap-2.5 self-end rounded-[10px] border border-border bg-muted/50 px-3 py-2.5"
            >
              <Checkbox
                id="regla-activa"
                checked={form.activa}
                onCheckedChange={(valor) => actualizar("activa", valor)}
              />
              <span className="text-sm font-medium text-foreground">
                Activa
              </span>
            </label>
          </FormGrid>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>{regla ? "Guardar cambios" : "Crear regla"}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoMetodoPagoProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  metodo: MetodoPagoOpcion | null;
  cuentas: readonly CuentaOpcion[];
  moneda: "DOP" | "USD";
  onGuardado: () => void;
}

function DialogoMetodoPago({
  abierto,
  onOpenChange,
  empresaId,
  metodo,
  cuentas,
  moneda,
  onGuardado,
}: DialogoMetodoPagoProps) {
  const [form, setForm] = useState<EstadoFormularioMetodoPago>(() =>
    estadoInicialMetodoPago(metodo),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setForm(estadoInicialMetodoPago(metodo));
    setGuardando(false);
    setError(null);
  }, [abierto, metodo]);

  function actualizar<C extends keyof EstadoFormularioMetodoPago>(
    campo: C,
    valor: EstadoFormularioMetodoPago[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  const opcionesCuentas = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.cuentaId === "") {
      setError("Selecciona la cuenta contable del método de pago.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await guardarMetodoPagoAction({
      empresaId,
      id: metodo?.id ?? null,
      nombre: form.nombre,
      cuentaId: form.cuentaId,
      dejaCxpProveedor: form.dejaCxp,
      activo: form.activo,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {metodo ? "Editar método de pago" : "Nuevo método de pago"}
            </DialogTitle>
            <DialogDescription>
              Se usa al registrar cobros y pagos en {moneda}. La cuenta debe ser
              de movimiento.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormField htmlFor="metodo-nombre" label="Nombre" required>
            <Input
              id="metodo-nombre"
              value={form.nombre}
              onChange={(evento) => actualizar("nombre", evento.target.value)}
              placeholder="Transferencia bancaria"
            />
          </FormField>

          <FormField htmlFor="metodo-cuenta" label="Cuenta contable" required>
            <SelectCampo
              id="metodo-cuenta"
              opciones={opcionesCuentas}
              valor={form.cuentaId}
              onCambio={(valor) => actualizar("cuentaId", valor)}
              etiquetaVacia="Selecciona la cuenta"
              buscable
              requerido
              aria-label="Cuenta del método de pago"
            />
          </FormField>

          <label
            htmlFor="metodo-cxp"
            className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5"
          >
            <Checkbox
              id="metodo-cxp"
              checked={form.dejaCxp}
              onCheckedChange={(valor) => actualizar("dejaCxp", valor)}
            />
            <span className="text-sm font-medium text-foreground">
              Deja cuenta por pagar al proveedor
            </span>
          </label>

          <label
            htmlFor="metodo-activo"
            className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5"
          >
            <Checkbox
              id="metodo-activo"
              checked={form.activo}
              onCheckedChange={(valor) => actualizar("activo", valor)}
            />
            <span className="text-sm font-medium text-foreground">Activo</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>{metodo ? "Guardar cambios" : "Crear método"}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PanelObligacionesProps {
  empresaId: string;
  obligaciones: readonly ObligacionFiscalListado[];
  periodo: string;
  moneda: "DOP" | "USD";
  onCambio: () => void;
}

function PanelObligaciones({
  empresaId,
  obligaciones,
  periodo,
  moneda,
  onCambio,
}: PanelObligacionesProps) {
  const [abierto, setAbierto] = useState(false);
  const [presentar, setPresentar] = useState<ObligacionFiscalListado | null>(
    null,
  );

  return (
    <>
      <TarjetaLista>
        <BarraLista
          titulo="Obligaciones fiscales"
          descripcion="606, 607, IT-1, IR-17 e IR-3 con su fecha límite y estado."
          acciones={
            <Button onClick={() => setAbierto(true)}>
              <IconPlus className="size-4" />
              Nueva obligación
            </Button>
          }
        >
          <TablaLista<ObligacionFiscalListado>
            filas={obligaciones}
            claveFila={(obligacion) => obligacion.id}
            ordenable
            paginacion={{ tamanoPagina: 10, etiqueta: "obligaciones" }}
            vacio={{
              titulo: "Sin obligaciones registradas",
              descripcion:
                "Agrega los formularios que debes presentar y su fecha límite.",
              icono: <IconReceiptTax className="size-8" />,
            }}
            columnas={[
              {
                clave: "formulario",
                encabezado: "Formulario",
                celda: (obligacion) => (
                  <span className="font-medium text-foreground">
                    {obligacion.codigoFormulario}
                  </span>
                ),
              },
              {
                clave: "periodo",
                encabezado: "Periodo",
                celda: (obligacion) =>
                  formatearPeriodoMes(
                    mesDesdePeriodoDgii(obligacion.periodo),
                  ) || obligacion.periodo,
              },
              {
                clave: "limite",
                encabezado: "Fecha límite",
                celda: (obligacion) => formatearFecha(obligacion.fechaLimite),
              },
              {
                clave: "monto",
                encabezado: "Declarado",
                alineacion: "derecha",
                celda: (obligacion) =>
                  formatearMoneda(obligacion.montoDeclarado, moneda),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (obligacion) => (
                  <PillEstado
                    estado={
                      obligacion.estado === "filed"
                        ? "saldada"
                        : obligacion.estado === "paid"
                          ? "saldada"
                          : obligacion.estado === "overdue"
                            ? "vencida"
                            : "pendiente"
                    }
                  >
                    {ETIQUETAS_ESTADO_OBLIGACION[obligacion.estado] ??
                      obligacion.estado}
                  </PillEstado>
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (obligacion) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      obligacion.estado === "filed" ||
                      obligacion.estado === "paid"
                    }
                    onClick={() => setPresentar(obligacion)}
                  >
                    <IconCheck className="size-4" />
                    Marcar presentada
                  </Button>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <DialogoObligacion
        abierto={abierto}
        onOpenChange={setAbierto}
        empresaId={empresaId}
        periodoInicial={periodo}
        onGuardado={onCambio}
      />

      <DialogoPresentar
        abierto={presentar !== null}
        onOpenChange={(valor) => {
          if (!valor) setPresentar(null);
        }}
        empresaId={empresaId}
        obligacion={presentar}
        moneda={moneda}
        onGuardado={onCambio}
      />
    </>
  );
}

interface DialogoObligacionProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  periodoInicial: string;
  onGuardado: () => void;
}

function DialogoObligacion({
  abierto,
  onOpenChange,
  empresaId,
  periodoInicial,
  onGuardado,
}: DialogoObligacionProps) {
  const [form, setForm] = useState<EstadoFormularioObligacion>(() =>
    estadoInicialObligacion(periodoInicial),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setForm(estadoInicialObligacion(periodoInicial));
    setGuardando(false);
    setError(null);
  }, [abierto, periodoInicial]);

  function actualizar<C extends keyof EstadoFormularioObligacion>(
    campo: C,
    valor: EstadoFormularioObligacion[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  const opcionesFormulario = FORMULARIOS_FISCALES.map((formulario) => ({
    value: formulario.value,
    label: formulario.label,
  }));

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.periodo === "") {
      setError("Selecciona el período de la obligación.");
      return;
    }
    if (form.fechaLimite === "") {
      setError("Selecciona la fecha límite de presentación.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await guardarObligacionFiscalAction({
      empresaId,
      codigoFormulario: form.codigoFormulario,
      periodo: periodoDgiiDesdeMes(form.periodo),
      fechaLimite: form.fechaLimite,
      estado: "pending",
      montoDeclarado: aNumero(form.monto),
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>Nueva obligación fiscal</DialogTitle>
            <DialogDescription>
              Formularios 606, 607, IT-1, IR-17 e IR-3 con su período y fecha
              límite.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormField
            htmlFor="obligacion-formulario"
            label="Formulario"
            required
          >
            <SelectCampo
              id="obligacion-formulario"
              opciones={opcionesFormulario}
              valor={form.codigoFormulario}
              onCambio={(valor) => actualizar("codigoFormulario", valor)}
              requerido
              aria-label="Formulario fiscal"
            />
          </FormField>

          <FormField htmlFor="obligacion-periodo" label="Período" required>
            <MonthPicker
              id="obligacion-periodo"
              value={form.periodo}
              onChange={(valor) => actualizar("periodo", valor)}
              placeholder="Período fiscal"
            />
          </FormField>

          <FormField htmlFor="obligacion-limite" label="Fecha límite" required>
            <DatePicker
              id="obligacion-limite"
              value={form.fechaLimite}
              onChange={(valor) => actualizar("fechaLimite", valor)}
            />
          </FormField>

          <FormField htmlFor="obligacion-monto" label="Monto declarado">
            <Input
              id="obligacion-monto"
              type="number"
              min="0"
              step="0.01"
              value={form.monto}
              onChange={(evento) => actualizar("monto", evento.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Crear obligación"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoPresentarProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  obligacion: ObligacionFiscalListado | null;
  moneda: "DOP" | "USD";
  onGuardado: () => void;
}

function DialogoPresentar({
  abierto,
  onOpenChange,
  empresaId,
  obligacion,
  moneda,
  onGuardado,
}: DialogoPresentarProps) {
  const [form, setForm] = useState<EstadoFormularioPresentar>(() =>
    estadoInicialPresentar(obligacion),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setForm(estadoInicialPresentar(obligacion));
    setGuardando(false);
    setError(null);
  }, [abierto, obligacion]);

  function actualizar<C extends keyof EstadoFormularioPresentar>(
    campo: C,
    valor: EstadoFormularioPresentar[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  const opcionesEstado = OPCIONES_ESTADO_OBLIGACION.filter(
    (opcion) => opcion.value === "filed" || opcion.value === "paid",
  ).map((opcion) => ({ value: opcion.value, label: opcion.label }));

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || obligacion === null) return;

    setError(null);
    setGuardando(true);

    const resultado = await marcarObligacionPresentadaAction({
      empresaId,
      obligacionId: obligacion.id,
      estado: form.estado,
      montoDeclarado: aNumero(form.monto),
      referenciaPresentacion: form.referencia,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>Marcar obligación presentada</DialogTitle>
            <DialogDescription>
              {obligacion
                ? `${obligacion.codigoFormulario} · ${obligacion.periodo} · límite ${formatearFecha(obligacion.fechaLimite)}`
                : "Selecciona una obligación."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormField htmlFor="presentar-estado" label="Estado" required>
            <SelectCampo
              id="presentar-estado"
              opciones={opcionesEstado}
              valor={form.estado}
              onCambio={(valor) =>
                actualizar("estado", valor === "paid" ? "paid" : "filed")
              }
              requerido
              aria-label="Estado de la presentación"
            />
          </FormField>

          <FormField
            htmlFor="presentar-monto"
            label={`Monto declarado (${moneda})`}
          >
            <Input
              id="presentar-monto"
              type="number"
              min="0"
              step="0.01"
              value={form.monto}
              onChange={(evento) => actualizar("monto", evento.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <FormField htmlFor="presentar-referencia" label="Referencia">
            <Input
              id="presentar-referencia"
              value={form.referencia}
              onChange={(evento) =>
                actualizar("referencia", evento.target.value)
              }
              placeholder="Número de acuse o comprobante"
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || obligacion === null}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <IconCheck className="size-4" />
                  Marcar presentada
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
