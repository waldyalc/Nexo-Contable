"use client";

import {
  IconBan,
  IconCheck,
  IconChevronDown,
  IconDots,
  IconDownload,
  IconEye,
  IconFileSpreadsheet,
  IconFileText,
  IconLoader2,
  IconPencil,
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
  type ResultadoImportacion,
  exportar606Action,
  importarComprasMasivasAction,
} from "@/app/(app)/gastos/actions";
import {
  DocumentoFormDialog,
  type ModoDocumento,
} from "@/components/gastos/documento-form-dialog";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { MonthPicker } from "@/components/month-picker";
import { DialogoAsignarComprobante } from "@/components/operaciones/dialogo-asignar-comprobante";
import {
  DialogoAnular,
  DialogoRegistrarPago,
} from "@/components/operaciones/dialogos-cartera";
import { DocumentoDetalleDialog } from "@/components/operaciones/documento-detalle-dialog";
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
import type { CargadorDocumentoDetalle } from "@/lib/operaciones/consultas";
import { contabilizarDocumentoBorradorAction } from "@/lib/operaciones/documentos-borrador-actions";
import type {
  ArticuloDocumento,
  CuentaOpcion,
  DocumentoAcreditable,
  DocumentoListado,
  MetodoPagoOpcion,
  SecuenciaNcfListado,
  TerceroListado,
} from "@/lib/operaciones/tipos";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

const OPCIONES_ESTADO = [
  { value: "borrador", label: "Borrador" },
  { value: "contabilizada", label: "Contabilizada" },
  { value: "saldada", label: "Saldada" },
  { value: "anulada", label: "Anulada" },
];

function etiquetaEstado(documento: DocumentoListado): string {
  if (documento.estado === "void") return "anulada";
  if (documento.estado === "draft") return "borrador";
  return documento.estadoCobro;
}

export interface GastosVistaProps {
  empresaId: string;
  empresa: EmpresaReporte;
  documentos: readonly DocumentoListado[];
  terceros: readonly TerceroListado[];
  cuentas: readonly CuentaOpcion[];
  metodosPago: readonly MetodoPagoOpcion[];
  articulos: readonly ArticuloDocumento[];
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
  cargarDetalleDocumento: CargadorDocumentoDetalle;
}

/**
 * Vista de Gastos y compras (606). La barra lleva **una** acción primaria, dos
 * secundarias y el resto en el menú «Acciones»; «Extraer 607» nunca aparece
 * aquí porque pertenece a Facturación e Impuestos.
 */
export function GastosVista({
  empresaId,
  empresa,
  documentos,
  terceros,
  cuentas,
  metodosPago,
  articulos,
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
  cargarDetalleDocumento,
}: GastosVistaProps) {
  const router = useRouter();
  const [mes, setMes] = useState(periodoInicial);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [formAbierto, setFormAbierto] = useState(false);
  const [modoForm, setModoForm] = useState<ModoDocumento>("compra");
  const [tercerosAbierto, setTercerosAbierto] = useState(false);
  const [exportarAbierto, setExportarAbierto] = useState(false);
  const [cargaAbierta, setCargaAbierta] = useState(false);
  const [pagoDocumento, setPagoDocumento] = useState<DocumentoListado | null>(
    null,
  );
  const [anularDocumento, setAnularDocumento] =
    useState<DocumentoListado | null>(null);
  const [detalleDocumento, setDetalleDocumento] =
    useState<DocumentoListado | null>(null);
  const [documentoEdicion, setDocumentoEdicion] =
    useState<DocumentoListado | null>(null);
  const [documentoComprobante, setDocumentoComprobante] =
    useState<DocumentoListado | null>(null);
  const [contabilizandoId, setContabilizandoId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return documentos.filter((documento) => {
      if (mes !== "" && documento.fechaEmision.slice(0, 7) !== mes)
        return false;

      if (estadoFiltro === "borrador" && documento.estado !== "draft") {
        return false;
      }
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

  function abrirFormulario(
    modo: ModoDocumento,
    documento: DocumentoListado | null = null,
  ) {
    setModoForm(modo);
    setDocumentoEdicion(documento);
    setFormAbierto(true);
  }

  async function contabilizarBorrador(documento: DocumentoListado) {
    if (contabilizandoId !== null) return;
    setContabilizandoId(documento.id);
    const resultado = await contabilizarDocumentoBorradorAction({
      empresaId,
      documentoId: documento.id,
    });
    setContabilizandoId(null);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.mensaje);
    router.refresh();
  }

  return (
    <>
      <TarjetaLista>
        <BarraLista
          titulo="Compras registradas"
          descripcion={`${filtrados.length} de ${documentos.length} comprobantes · ${formatearMoneda(totalPeriodo, moneda)}`}
          acciones={
            <>
              <Button onClick={() => abrirFormulario("compra")}>
                <IconPlus className="size-4" />
                Nueva compra
              </Button>
              <Button
                variant="outline"
                onClick={() => setExportarAbierto(true)}
              >
                <IconDownload className="size-4" />
                Exportar 606
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
                    onClick={() => abrirFormulario("nota_credito_compra")}
                  >
                    <IconReceipt2 className="size-4" />
                    Nueva nota de crédito
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCargaAbierta(true)}>
                    <IconUpload className="size-4" />
                    Carga masiva Excel/CSV (606)
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
                  placeholder="Buscar por número, NCF, tercero…"
                  aria-label="Buscar compras"
                  className="h-9 pl-8"
                />
              </div>
              <SelectCampo
                id="gastos-estado"
                opciones={OPCIONES_ESTADO}
                valor={estadoFiltro}
                onCambio={setEstadoFiltro}
                etiquetaVacia="Todas"
                className="w-[170px]"
                aria-label="Filtrar por estado"
              />
            </>
          }
        >
          <TablaLista<DocumentoListado>
            filas={filtrados}
            claveFila={(documento) => documento.id}
            ordenable
            paginacion={{ tamanoPagina: 15, etiqueta: "comprobantes" }}
            vacio={{
              titulo: "Sin compras en este período",
              descripcion:
                "Registra la primera compra o cambia el mes de emisión.",
              icono: <IconReceipt2 className="size-8" />,
              accion: (
                <Button onClick={() => abrirFormulario("compra")}>
                  <IconPlus className="size-4" />
                  Nueva compra
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
                clave: "tercero",
                encabezado: "Proveedor",
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
                        onClick={() => setDetalleDocumento(documento)}
                      >
                        <IconEye className="size-4" />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={documento.estado !== "draft"}
                        onClick={() =>
                          abrirFormulario(
                            documento.tipo === "purchase_invoice"
                              ? "compra"
                              : "nota_credito_compra",
                            documento,
                          )
                        }
                      >
                        <IconPencil className="size-4" />
                        Editar borrador
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          documento.estado !== "draft" ||
                          contabilizandoId === documento.id
                        }
                        onClick={() => void contabilizarBorrador(documento)}
                      >
                        <IconCheck className="size-4" />
                        {contabilizandoId === documento.id
                          ? "Contabilizando…"
                          : "Contabilizar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          documento.estado !== "posted" || documento.saldo <= 0
                        }
                        onClick={() => setPagoDocumento(documento)}
                      >
                        <IconWallet className="size-4" />
                        Registrar pago
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={documento.estado !== "posted"}
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
        onOpenChange={(abierto) => {
          setFormAbierto(abierto);
          if (!abierto) setDocumentoEdicion(null);
        }}
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
        metodosPago={metodosPago}
        articulos={articulos}
        rncEmpresa={empresa.rnc ?? ""}
        documentoInicial={documentoEdicion}
      />

      <DialogoAsignarComprobante
        abierto={documentoComprobante !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDocumentoComprobante(null);
        }}
        empresaId={empresaId}
        documento={documentoComprobante}
        secuencias={secuencias}
        onAsignado={() => router.refresh()}
      />

      <TercerosSheet
        abierto={tercerosAbierto}
        onOpenChange={setTercerosAbierto}
        empresaId={empresaId}
        terceros={terceros}
        cuentas={cuentas}
        tipoInicial="supplier"
      />

      <DocumentoDetalleDialog
        abierto={detalleDocumento !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDetalleDocumento(null);
        }}
        empresaId={empresaId}
        documento={detalleDocumento}
        empresa={empresa}
        cargarDetalle={cargarDetalleDocumento}
      />

      <DialogoRegistrarPago
        abierto={pagoDocumento !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPagoDocumento(null);
        }}
        empresaId={empresaId}
        documento={
          pagoDocumento
            ? {
                id: pagoDocumento.id,
                numero: pagoDocumento.numero,
                tercero: pagoDocumento.tercero,
                saldo: pagoDocumento.saldo,
              }
            : null
        }
        cuentas={cuentas}
        metodosPago={metodosPago}
        etiquetaAccion="Registrar pago"
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

      <DialogoExportar606
        abierto={exportarAbierto}
        onOpenChange={setExportarAbierto}
        empresaId={empresaId}
        periodoInicial={mes === "" ? periodoInicial : mes}
      />

      <DialogoCargaMasiva606
        abierto={cargaAbierta}
        onOpenChange={setCargaAbierta}
        empresaId={empresaId}
        cuentas={cuentas}
        onImportado={() => router.refresh()}
      />
    </>
  );
}

interface DialogoExportar606Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  periodoInicial: string;
}

function DialogoExportar606({
  abierto,
  onOpenChange,
  empresaId,
  periodoInicial,
}: DialogoExportar606Props) {
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
      toast.error("Selecciona el período del formato 606.");
      return;
    }

    setGenerando(formato);
    const resultado = await exportar606Action({
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
    toast.success("Formato 606 generado", {
      description: formatarPeriodo(periodo),
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar formato 606</DialogTitle>
          <DialogDescription>
            El Excel lleva dos hojas: «Incluidos 606» con totales y «Excluidos»
            con el motivo de cada descarte.
          </DialogDescription>
        </DialogHeader>

        <MonthPicker
          value={periodo}
          onChange={setPeriodo}
          placeholder="Período del 606"
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

function formatarPeriodo(periodo: string): string {
  return formatearPeriodoMes(periodo) || periodo;
}

interface DialogoCargaMasiva606Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  cuentas: readonly CuentaOpcion[];
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

function DialogoCargaMasiva606({
  abierto,
  onOpenChange,
  empresaId,
  cuentas,
  onImportado,
}: DialogoCargaMasiva606Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cuentaId, setCuentaId] = useState("");
  const [cuentaControlId, setCuentaControlId] = useState("");
  const [cuentaImpuestoId, setCuentaImpuestoId] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

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
      setError("Selecciona la cuenta de gasto y la cuenta por pagar.");
      return;
    }

    setError(null);
    setCargando(true);

    const respuesta = await importarComprasMasivasAction({
      empresaId,
      nombreArchivo: archivo.name,
      archivoBase64: await archivoABase64(archivo),
      cuentaId,
      cuentaControlId,
      cuentaImpuestoId: cuentaImpuestoId === "" ? null : cuentaImpuestoId,
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
            <DialogTitle>Carga masiva 606</DialogTitle>
            <DialogDescription>
              Excel (.xlsx) o CSV con columnas RNC, Tercero, Tipo Comprobante,
              NCF, Fecha, Concepto, Subtotal e ITBIS. Cada fila se valida antes
              de emitir.
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
              <span>Cuenta de gasto</span>
              <SelectCampo
                id="carga-cuenta-gasto"
                opciones={opcionesCuentas}
                valor={cuentaId}
                onCambio={setCuentaId}
                etiquetaVacia="Selecciona la cuenta"
                buscable
                aria-label="Cuenta de gasto de la carga"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              <span>Cuenta por pagar</span>
              <SelectCampo
                id="carga-cuenta-control"
                opciones={opcionesCuentas}
                valor={cuentaControlId}
                onCambio={setCuentaControlId}
                etiquetaVacia="Selecciona la cuenta"
                buscable
                aria-label="Cuenta por pagar de la carga"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
              <span>Cuenta de ITBIS</span>
              <SelectCampo
                id="carga-cuenta-impuesto"
                opciones={opcionesCuentas}
                valor={cuentaImpuestoId}
                onCambio={setCuentaImpuestoId}
                etiquetaVacia="Sin cuenta de impuesto"
                buscable
                aria-label="Cuenta de ITBIS de la carga"
              />
            </div>
          </div>

          {resultado ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5 text-sm">
              <p className="font-medium text-foreground">
                {resultado.creados} compras registradas ·{" "}
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
