"use client";

import {
  IconBan,
  IconChevronDown,
  IconDots,
  IconDownload,
  IconFileInvoice,
  IconFileSpreadsheet,
  IconFileText,
  IconLoader2,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconUpload,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type ResultadoImportacionVentas,
  exportar607Action,
  importarVentasMasivasAction,
} from "@/app/(app)/facturacion/actions";
import {
  DocumentoFormDialog,
  type ModoDocumento,
} from "@/components/gastos/documento-form-dialog";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { MonthPicker } from "@/components/month-picker";
import {
  DialogoAnular,
  DialogoRegistrarPago,
} from "@/components/operaciones/dialogos-cartera";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { TercerosSheet } from "@/components/terceros/terceros-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { descargarBase64 } from "@/lib/dgii/descarga";
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodoMes,
} from "@/lib/formato";
import {
  type CuentaOpcion,
  type DocumentoAcreditable,
  type DocumentoListado,
  type MetodoPagoOpcion,
  type SecuenciaNcfListado,
  TIPOS_COMPROBANTE_DGII,
  type TerceroListado,
} from "@/lib/operaciones/tipos";

const OPCIONES_ESTADO = [
  { value: "contabilizada", label: "Contabilizada" },
  { value: "saldada", label: "Saldada" },
  { value: "anulada", label: "Anulada" },
];

const OPCIONES_TIPO_NCF = TIPOS_COMPROBANTE_DGII.map((tipo) => ({
  value: tipo,
  label: tipo,
}));

function etiquetaEstado(documento: DocumentoListado): string {
  if (documento.estado === "void") return "anulada";
  return documento.estadoCobro;
}

export interface FacturacionVistaProps {
  empresaId: string;
  documentos: readonly DocumentoListado[];
  terceros: readonly TerceroListado[];
  cuentas: readonly CuentaOpcion[];
  metodosPago: readonly MetodoPagoOpcion[];
  secuencias: readonly SecuenciaNcfListado[];
  documentosAcreditables: readonly DocumentoAcreditable[];
  tasaItbisBps: number;
  cuentaItbisAdelantadoId?: string | null;
  cuentaItbisPorPagarId?: string | null;
  cuentaRetencionIsrId?: string | null;
  cuentaRetencionItbisId?: string | null;
  cuentaCxcDefaultId?: string | null;
  cuentaCxpDefaultId?: string | null;
  periodoInicial: string;
  moneda: "DOP" | "USD";
}

/**
 * Vista de Facturación (607). Aquí sí vive «Extraer 607»; el menú «Acciones»
 * agrupa la nota de crédito y la carga masiva para no romper la jerarquía de
 * un botón primario y dos secundarios.
 */
export function FacturacionVista({
  empresaId,
  documentos,
  terceros,
  cuentas,
  metodosPago,
  secuencias,
  documentosAcreditables,
  tasaItbisBps,
  cuentaItbisAdelantadoId,
  cuentaItbisPorPagarId,
  cuentaRetencionIsrId,
  cuentaRetencionItbisId,
  cuentaCxcDefaultId,
  cuentaCxpDefaultId,
  periodoInicial,
  moneda,
}: FacturacionVistaProps) {
  const router = useRouter();
  const [mes, setMes] = useState(periodoInicial);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [formAbierto, setFormAbierto] = useState(false);
  const [modoForm, setModoForm] = useState<ModoDocumento>("venta");
  const [tercerosAbierto, setTercerosAbierto] = useState(false);
  const [exportarAbierto, setExportarAbierto] = useState(false);
  const [cargaAbierta, setCargaAbierta] = useState(false);
  const [cobroDocumento, setCobroDocumento] = useState<DocumentoListado | null>(
    null,
  );
  const [anularDocumento, setAnularDocumento] =
    useState<DocumentoListado | null>(null);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return documentos.filter((documento) => {
      if (mes !== "" && documento.fechaEmision.slice(0, 7) !== mes)
        return false;

      if (estadoFiltro === "contabilizada" && documento.estado !== "posted") {
        return false;
      }
      if (
        estadoFiltro === "saldada" &&
        etiquetaEstado(documento) !== "saldada"
      ) {
        return false;
      }
      if (estadoFiltro === "anulada" && documento.estado !== "void") {
        return false;
      }

      if (termino === "") return true;

      return (
        documento.numero.toLowerCase().includes(termino) ||
        documento.ncf.toLowerCase().includes(termino) ||
        documento.tercero.toLowerCase().includes(termino) ||
        documento.concepto.toLowerCase().includes(termino)
      );
    });
  }, [documentos, mes, busqueda, estadoFiltro]);

  const totalPeriodo = filtrados
    .filter((documento) => documento.estado === "posted")
    .reduce((total, documento) => total + documento.total, 0);

  const itbisPeriodo = filtrados
    .filter((documento) => documento.estado === "posted")
    .reduce((total, documento) => total + documento.impuesto, 0);

  const seriesActivas = secuencias.filter(
    (secuencia) =>
      secuencia.activo && secuencia.numeroActual < secuencia.numeroFinal,
  );

  function abrirFormulario(modo: ModoDocumento) {
    setModoForm(modo);
    setFormAbierto(true);
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Facturación"
        descripcion="Facturas de venta con NCF de serie B o e-CF electrónico y formato 607."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Facturación" }]}
      />

      <TarjetaLista>
        <BarraLista
          titulo="Facturas emitidas"
          descripcion={`${filtrados.length} de ${documentos.length} documentos · ${formatearMoneda(totalPeriodo, moneda)} · ITBIS ${formatearMoneda(itbisPeriodo, moneda)}`}
          acciones={
            <>
              <Button onClick={() => abrirFormulario("venta")}>
                <IconPlus className="size-4" />
                Nueva factura
              </Button>
              <Button
                variant="outline"
                onClick={() => setExportarAbierto(true)}
              >
                <IconDownload className="size-4" />
                Exportar 607
              </Button>
              <Button
                variant="outline"
                onClick={() => setTercerosAbierto(true)}
              >
                <IconUsers className="size-4" />
                Terceros
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" aria-label="Más acciones" />
                  }
                >
                  Acciones
                  <IconChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    onClick={() => abrirFormulario("nota_credito_venta")}
                  >
                    <IconReceipt2 className="size-4" />
                    Nueva nota de crédito
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCargaAbierta(true)}>
                    <IconUpload className="size-4" />
                    Carga masiva Excel/CSV (607)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
          filtros={
            <>
              <MonthPicker
                value={mes}
                onChange={setMes}
                permitirLimpiar
                placeholder="Mes de emisión"
                className="w-[190px]"
              />
              <div className="relative w-full sm:max-w-xs">
                <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar por número, NCF, cliente…"
                  aria-label="Buscar facturas"
                  className="h-9 pl-8"
                />
              </div>
              <SelectCampo
                id="facturacion-estado"
                opciones={OPCIONES_ESTADO}
                valor={estadoFiltro}
                onCambio={setEstadoFiltro}
                etiquetaVacia="Todas"
                className="w-[170px]"
                aria-label="Filtrar por estado"
              />
              <span className="ml-auto text-xs text-muted-foreground">
                {seriesActivas.length} secuencias NCF activas
              </span>
            </>
          }
        >
          <TablaLista<DocumentoListado>
            filas={filtrados}
            claveFila={(documento) => documento.id}
            ordenable
            paginacion={{ tamanoPagina: 15, etiqueta: "documentos" }}
            vacio={{
              titulo: "Sin facturas en este período",
              descripcion:
                "Emite tu primera factura o cambia el mes de emisión.",
              icono: <IconFileInvoice className="size-8" />,
              accion: (
                <Button onClick={() => abrirFormulario("venta")}>
                  <IconPlus className="size-4" />
                  Nueva factura
                </Button>
              ),
            }}
            columnas={[
              {
                clave: "documento",
                encabezado: "Documento",
                celda: (documento) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {documento.numero}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {documento.ncf === "" ? "Sin NCF" : documento.ncf}
                    </span>
                  </div>
                ),
              },
              {
                clave: "cliente",
                encabezado: "Cliente",
                celda: (documento) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{documento.tercero}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {documento.concepto}
                    </span>
                  </div>
                ),
              },
              {
                clave: "fecha",
                encabezado: "Emisión",
                celda: (documento) => formatearFecha(documento.fechaEmision),
              },
              {
                clave: "vencimiento",
                encabezado: "Vence",
                celda: (documento) =>
                  documento.fechaVencimiento
                    ? formatearFecha(documento.fechaVencimiento)
                    : "—",
              },
              {
                clave: "total",
                encabezado: "Total",
                alineacion: "derecha",
                celda: (documento) => formatearMoneda(documento.total, moneda),
              },
              {
                clave: "saldo",
                encabezado: "Saldo",
                alineacion: "derecha",
                celda: (documento) => formatearMoneda(documento.saldo, moneda),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (documento) => (
                  <PillEstado estado={etiquetaEstado(documento)} />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (documento) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${documento.numero}`}
                        />
                      }
                    >
                      <IconDots className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        disabled={
                          documento.estado !== "posted" || documento.saldo <= 0
                        }
                        onClick={() => setCobroDocumento(documento)}
                      >
                        <IconWallet className="size-4" />
                        Registrar cobro
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={documento.estado === "void"}
                        onClick={() => setAnularDocumento(documento)}
                      >
                        <IconBan className="size-4" />
                        Anular documento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <DocumentoFormDialog
        abierto={formAbierto}
        onOpenChange={setFormAbierto}
        empresaId={empresaId}
        modo={modoForm}
        terceros={terceros}
        cuentas={cuentas}
        secuencias={secuencias}
        documentosAcreditables={documentosAcreditables}
        tasaItbisBps={tasaItbisBps}
        cuentaItbisAdelantadoId={cuentaItbisAdelantadoId}
        cuentaItbisPorPagarId={cuentaItbisPorPagarId}
        cuentaRetencionIsrId={cuentaRetencionIsrId}
        cuentaRetencionItbisId={cuentaRetencionItbisId}
        cuentaCxcDefaultId={cuentaCxcDefaultId}
        cuentaCxpDefaultId={cuentaCxpDefaultId}
      />

      <TercerosSheet
        abierto={tercerosAbierto}
        onOpenChange={setTercerosAbierto}
        empresaId={empresaId}
        terceros={terceros}
        cuentas={cuentas}
        tipoInicial="customer"
      />

      <DialogoRegistrarPago
        abierto={cobroDocumento !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setCobroDocumento(null);
        }}
        empresaId={empresaId}
        documento={
          cobroDocumento
            ? {
                id: cobroDocumento.id,
                numero: cobroDocumento.numero,
                tercero: cobroDocumento.tercero,
                saldo: cobroDocumento.saldo,
              }
            : null
        }
        cuentas={cuentas}
        metodosPago={metodosPago}
        etiquetaAccion="Registrar cobro"
        onRegistrado={() => router.refresh()}
      />

      <DialogoAnular
        abierto={anularDocumento !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAnularDocumento(null);
        }}
        empresaId={empresaId}
        tipo="documento"
        referenciaId={anularDocumento?.id ?? null}
        identificador={anularDocumento?.numero ?? ""}
        onAnulado={() => router.refresh()}
      />

      <DialogoExportar607
        abierto={exportarAbierto}
        onOpenChange={setExportarAbierto}
        empresaId={empresaId}
        periodoInicial={mes === "" ? periodoInicial : mes}
      />

      <DialogoCargaMasiva607
        abierto={cargaAbierta}
        onOpenChange={setCargaAbierta}
        empresaId={empresaId}
        cuentas={cuentas}
        secuencias={seriesActivas}
        onImportado={() => router.refresh()}
      />
    </>
  );
}

interface DialogoExportar607Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  periodoInicial: string;
}

function DialogoExportar607({
  abierto,
  onOpenChange,
  empresaId,
  periodoInicial,
}: DialogoExportar607Props) {
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [generando, setGenerando] = useState<"excel" | "txt" | null>(null);

  useEffect(() => {
    setPeriodo(periodoInicial);
  }, [periodoInicial]);

  useEffect(() => {
    if (abierto) setPeriodo(periodoInicial);
  }, [abierto, periodoInicial]);

  async function descargar(formato: "excel" | "txt") {
    if (periodo === "") {
      toast.error("Selecciona el período del formato 607.");
      return;
    }

    setGenerando(formato);
    const resultado = await exportar607Action({
      empresaId,
      periodo: periodo.replace("-", ""),
      formato,
    });
    setGenerando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    descargarBase64(
      resultado.nombreArchivo,
      resultado.contenidoBase64,
      resultado.mime,
    );
    toast.success("Formato 607 generado", {
      description: formatearPeriodoMes(periodo) || periodo,
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar formato 607</DialogTitle>
          <DialogDescription>
            El Excel lleva dos hojas: «Incluidos 607» con totales y «Excluidos»
            con el motivo de cada descarte.
          </DialogDescription>
        </DialogHeader>

        <MonthPicker
          value={periodo}
          onChange={setPeriodo}
          placeholder="Período del 607"
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={generando !== null}
            onClick={() => void descargar("excel")}
          >
            {generando === "excel" ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconFileSpreadsheet className="size-4" />
            )}
            Excel (Incluidos + Excluidos)
          </Button>
          <Button
            type="button"
            disabled={generando !== null}
            onClick={() => void descargar("txt")}
          >
            {generando === "txt" ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconFileText className="size-4" />
            )}
            TXT DGII
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoCargaMasiva607Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  cuentas: readonly CuentaOpcion[];
  secuencias: readonly SecuenciaNcfListado[];
  onImportado: () => void;
}

async function archivoABase64(archivo: File): Promise<string> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let binario = "";
  const tamano = 0x8000;

  for (let indice = 0; indice < bytes.length; indice += tamano) {
    binario += String.fromCharCode(...bytes.subarray(indice, indice + tamano));
  }

  return btoa(binario);
}

function DialogoCargaMasiva607({
  abierto,
  onOpenChange,
  empresaId,
  cuentas,
  secuencias,
  onImportado,
}: DialogoCargaMasiva607Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cuentaId, setCuentaId] = useState("");
  const [cuentaControlId, setCuentaControlId] = useState("");
  const [cuentaImpuestoId, setCuentaImpuestoId] = useState("");
  const [tipoNcf, setTipoNcf] = useState(
    secuencias[0]?.tipoComprobante ?? "B02",
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacionVentas | null>(
    null,
  );

  const opcionesCuentas = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (cargando) return;

    if (archivo === null) {
      setError("Selecciona el archivo Excel o CSV.");
      return;
    }
    if (cuentaId === "" || cuentaControlId === "") {
      setError("Selecciona la cuenta de ingreso y la cuenta por cobrar.");
      return;
    }

    setError(null);
    setCargando(true);

    const respuesta = await importarVentasMasivasAction({
      empresaId,
      nombreArchivo: archivo.name,
      archivoBase64: await archivoABase64(archivo),
      cuentaId,
      cuentaControlId,
      cuentaImpuestoId: cuentaImpuestoId === "" ? null : cuentaImpuestoId,
      tipoNcf,
    });

    setCargando(false);

    if (!respuesta.ok) {
      setError(respuesta.error);
      return;
    }

    setResultado(respuesta.datos ?? { creados: 0, rechazados: [] });
    toast.success(respuesta.mensaje);
    onImportado();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          <DialogHeader>
            <DialogTitle>Carga masiva 607</DialogTitle>
            <DialogDescription>
              Excel (.xlsx) o CSV con columnas RNC, Tercero, NCF, Fecha,
              Concepto, Subtotal e ITBIS. Si falta el NCF, se consume la
              secuencia activa del tipo elegido.
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

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Archivo
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(evento) =>
                setArchivo(evento.target.files?.[0] ?? null)
              }
              className="h-9 cursor-pointer rounded-[10px] border border-border bg-card px-2 py-1 text-sm file:mr-2 file:rounded-[8px] file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              <span>Cuenta de ingreso</span>
              <SelectCampo
                id="carga-venta-cuenta"
                opciones={opcionesCuentas}
                valor={cuentaId}
                onCambio={setCuentaId}
                etiquetaVacia="Selecciona la cuenta"
                buscable
                aria-label="Cuenta de ingreso de la carga"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              <span>Cuenta por cobrar</span>
              <SelectCampo
                id="carga-venta-control"
                opciones={opcionesCuentas}
                valor={cuentaControlId}
                onCambio={setCuentaControlId}
                etiquetaVacia="Selecciona la cuenta"
                buscable
                aria-label="Cuenta por cobrar de la carga"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              <span>Cuenta de ITBIS</span>
              <SelectCampo
                id="carga-venta-impuesto"
                opciones={opcionesCuentas}
                valor={cuentaImpuestoId}
                onCambio={setCuentaImpuestoId}
                etiquetaVacia="Sin cuenta de impuesto"
                buscable
                aria-label="Cuenta de ITBIS de la carga"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              <span>Tipo de comprobante por defecto</span>
              <SelectCampo
                id="carga-venta-tipo-ncf"
                opciones={OPCIONES_TIPO_NCF}
                valor={tipoNcf}
                onCambio={setTipoNcf}
                etiquetaVacia="Selecciona el tipo"
                aria-label="Tipo de comprobante por defecto"
              />
            </div>
          </div>

          {resultado ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5 text-sm">
              <p className="font-medium text-foreground">
                {resultado.creados} facturas registradas ·{" "}
                {resultado.rechazados.length} rechazadas
              </p>
              {resultado.rechazados.length > 0 ? (
                <ul className="max-h-40 list-inside list-disc overflow-y-auto text-xs text-muted-foreground">
                  {resultado.rechazados.map((rechazo) => (
                    <li key={`${rechazo.fila}-${rechazo.motivo}`}>
                      Fila {rechazo.fila}: {rechazo.motivo}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={cargando}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={cargando}>
              {cargando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  <IconUpload className="size-4" />
                  Procesar archivo
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
