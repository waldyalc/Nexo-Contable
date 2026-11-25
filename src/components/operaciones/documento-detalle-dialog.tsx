"use client";

import {
  IconDownload,
  IconLoader2,
  IconPrinter,
  IconReceipt2,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { PillEstado } from "@/components/listas/pill-estado";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatearFecha, formatearMoneda, formatearRnc } from "@/lib/formato";
import type {
  CargadorDocumentoDetalle,
  DocumentoDetalleCompleto,
  DocumentoDetalleDocumento,
} from "@/lib/operaciones/consultas";
import {
  type DocumentoListado,
  ETIQUETAS_TIPO_DOCUMENTO,
} from "@/lib/operaciones/tipos";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";
import { cn } from "@/lib/utils";

const CSS_IMPRESION_DOCUMENTO = `
@media print {
  body:has(> [data-documento-detalle-print-root]) > *:not([data-documento-detalle-print-root]) {
    display: none !important;
  }

  body:has(> [data-documento-detalle-print-root]) > [data-documento-detalle-print-root] {
    display: block !important;
  }
}
`;

export interface DocumentoDetalleDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  documento: DocumentoListado | null;
  empresa: EmpresaReporte;
  cargarDetalle: CargadorDocumentoDetalle;
}

function tipoDocumento(documento: {
  tipo: DocumentoListado["tipo"];
}): string {
  return ETIQUETAS_TIPO_DOCUMENTO[documento.tipo] ?? "Documento";
}

function comprobanteDocumento(documento: {
  ncf: string;
  tipoNcf: string;
}): string {
  if (documento.ncf === "") return "Sin comprobante fiscal";
  const tipo =
    documento.tipoNcf === "" ? documento.ncf.slice(0, 3) : documento.tipoNcf;
  return `${tipo} · ${documento.ncf}`;
}

function nombreEmpresa(empresa: EmpresaReporte): string {
  const comercial = empresa.nombreComercial.trim();
  if (comercial !== "") return comercial;
  const razonSocial = empresa.razonSocial?.trim() ?? "";
  return razonSocial === "" ? "Empresa" : razonSocial;
}

function detalleEmpresa(empresa: EmpresaReporte): string {
  const partes: string[] = [];
  const razonSocial = empresa.razonSocial?.trim() ?? "";
  if (razonSocial !== "" && razonSocial !== nombreEmpresa(empresa)) {
    partes.push(`Razón social: ${razonSocial}`);
  }
  const rnc = formatearRnc(empresa.rnc ?? "");
  if (rnc !== "") partes.push(`RNC: ${rnc}`);
  return partes.join(" · ");
}

function DatoDetalle({
  etiqueta,
  valor,
  className,
}: {
  etiqueta: string;
  valor: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">
        {valor}
      </dd>
    </div>
  );
}

function FilaImporte({
  etiqueta,
  monto,
  moneda,
  destacada = false,
}: {
  etiqueta: string;
  monto: number;
  moneda: EmpresaReporte["moneda"];
  destacada?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border px-3 py-2 text-sm last:border-b-0",
        destacada && "bg-muted/50 font-semibold print:bg-white",
      )}
    >
      <span className={destacada ? "text-foreground" : "text-muted-foreground"}>
        {etiqueta}
      </span>
      <span className="shrink-0 text-right tabular-nums">
        {formatearMoneda(monto, moneda)}
      </span>
    </div>
  );
}

function montoNegativo(monto: number): number {
  return monto === 0 ? 0 : -monto;
}

function ImportesDocumento({
  documento,
  moneda,
}: {
  documento: DocumentoDetalleDocumento;
  moneda: EmpresaReporte["moneda"];
}) {
  const filas: {
    clave: string;
    etiqueta: string;
    monto: number;
    destacada: boolean;
  }[] = [
    {
      clave: "subtotal",
      etiqueta: "Subtotal",
      monto: documento.subtotal,
      destacada: false,
    },
    {
      clave: "itbis",
      etiqueta: "ITBIS",
      monto: documento.impuesto,
      destacada: false,
    },
  ];

  if (documento.otrosImpuestos !== 0) {
    filas.push({
      clave: "otros-impuestos",
      etiqueta: "Otros impuestos",
      monto: documento.otrosImpuestos,
      destacada: false,
    });
  }

  filas.push(
    {
      clave: "retencion-isr",
      etiqueta: "Retención ISR",
      monto: montoNegativo(documento.retencionIsr),
      destacada: false,
    },
    {
      clave: "retencion-itbis",
      etiqueta: "Retención ITBIS",
      monto: montoNegativo(documento.retencionItbis),
      destacada: false,
    },
  );

  if (documento.otrasRetenciones !== 0) {
    filas.push({
      clave: "otras-retenciones",
      etiqueta: "Otras retenciones",
      monto: montoNegativo(documento.otrasRetenciones),
      destacada: false,
    });
  }

  filas.push(
    {
      clave: "total",
      etiqueta: "Total del documento",
      monto: documento.total,
      destacada: true,
    },
    {
      clave: "pagos",
      etiqueta: "Pagos aplicados",
      monto: documento.pagado,
      destacada: false,
    },
  );

  if (documento.acreditado !== 0) {
    filas.push({
      clave: "notas-credito",
      etiqueta: "Notas de crédito aplicadas",
      monto: documento.acreditado,
      destacada: false,
    });
  }

  filas.push({
    clave: "saldo",
    etiqueta: "Saldo pendiente",
    monto: documento.saldo,
    destacada: true,
  });

  return (
    <div className="overflow-hidden rounded-[10px] border border-border">
      {filas.map((fila) => (
        <FilaImporte
          key={fila.clave}
          etiqueta={fila.etiqueta}
          monto={fila.monto}
          moneda={moneda}
          destacada={fila.destacada}
        />
      ))}
    </div>
  );
}

function ContenidoDocumentoDetalle({
  detalle,
  empresa,
}: {
  detalle: DocumentoDetalleCompleto;
  empresa: EmpresaReporte;
}) {
  const { documento, tercero, pagos, asiento } = detalle;
  const moneda = empresa.moneda;
  const totalDebito =
    asiento?.lineas.reduce((total, linea) => total + linea.debito, 0) ?? 0;
  const totalCredito =
    asiento?.lineas.reduce((total, linea) => total + linea.credito, 0) ?? 0;
  const empresaDetalle = detalleEmpresa(empresa);

  return (
    <div className="flex flex-col gap-5">
      <div className="border-b border-border pb-3">
        <p className="font-display text-base font-semibold text-primary">
          {nombreEmpresa(empresa)}
        </p>
        {empresaDetalle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {empresaDetalle}
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {tipoDocumento(documento)} {documento.numero}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {comprobanteDocumento(documento)}
            </p>
          </div>
          <PillEstado estado={documento.estadoEtiqueta} />
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-[10px] border border-border p-3 sm:grid-cols-4">
          <DatoDetalle
            etiqueta="Emisión"
            valor={formatearFecha(documento.fechaEmision)}
          />
          <DatoDetalle
            etiqueta="Vencimiento"
            valor={
              documento.fechaVencimiento === null
                ? "—"
                : formatearFecha(documento.fechaVencimiento)
            }
          />
          <DatoDetalle etiqueta="Número" valor={documento.numero} />
          <DatoDetalle
            etiqueta="NCF / e-CF"
            valor={comprobanteDocumento(documento)}
          />
        </dl>

        <div className="rounded-[10px] border border-border p-3">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Concepto
          </p>
          <p className="mt-1 text-sm text-foreground">{documento.concepto}</p>
          {documento.estado === "void" && documento.motivoAnulacion !== "" ? (
            <p className="mt-2 text-xs text-destructive">
              Motivo de anulación: {documento.motivoAnulacion}
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-display text-sm font-semibold text-foreground">
          Tercero
        </h4>
        <dl className="grid grid-cols-1 gap-3 rounded-[10px] border border-border p-3 sm:grid-cols-3">
          <DatoDetalle etiqueta="Nombre" valor={tercero.nombre} />
          <DatoDetalle
            etiqueta="RNC"
            valor={tercero.rnc === "" ? "—" : formatearRnc(tercero.rnc)}
          />
          <DatoDetalle etiqueta="Tipo" valor={tercero.tipoEtiqueta} />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-display text-sm font-semibold text-foreground">
          Importes
        </h4>
        <ImportesDocumento documento={documento} moneda={moneda} />
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-display text-sm font-semibold text-foreground">
          Pagos aplicados
        </h4>
        {pagos.length === 0 ? (
          <div className="rounded-[10px] border border-border px-3 py-4 text-sm text-muted-foreground">
            Sin pagos aplicados.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>{formatearFecha(pago.fechaPago)}</TableCell>
                    <TableCell>{pago.metodoPago || "—"}</TableCell>
                    <TableCell>{pago.referencia || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearMoneda(pago.monto, moneda)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-display text-sm font-semibold text-foreground">
          Asiento contable generado
        </h4>
        {asiento === null ? (
          <div className="rounded-[10px] border border-border px-3 py-4 text-sm text-muted-foreground">
            El documento no tiene asiento contable vinculado.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border p-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground tabular-nums">
                  {asiento.numero}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatearFecha(asiento.fecha)} · {asiento.descripcion}
                </p>
              </div>
              <PillEstado estado={asiento.estadoEtiqueta} />
            </div>

            <div className="overflow-hidden rounded-[10px] border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asiento.lineas.map((linea) => (
                    <TableRow key={linea.id}>
                      <TableCell>
                        <span className="font-medium">
                          {linea.cuentaCodigo}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          · {linea.cuentaNombre}
                        </span>
                      </TableCell>
                      <TableCell>{linea.descripcion || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {linea.debito === 0
                          ? "—"
                          : formatearMoneda(linea.debito, moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {linea.credito === 0
                          ? "—"
                          : formatearMoneda(linea.credito, moneda)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold print:bg-white">
                    <TableCell>Totales</TableCell>
                    <TableCell> </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearMoneda(totalDebito, moneda)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearMoneda(totalCredito, moneda)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EsqueletoDocumentoDetalle() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-label="Cargando detalle del documento"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-52 rounded-[8px]" />
          <Skeleton className="h-3 w-36 rounded-[6px]" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["emision", "vencimiento", "numero", "ncf"].map((campo) => (
          <div key={campo} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16 rounded-[6px]" />
            <Skeleton className="h-4 w-full rounded-[6px]" />
          </div>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-[10px]" />
      <Skeleton className="h-36 w-full rounded-[10px]" />
    </div>
  );
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = "noopener";
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function DocumentoDetalleDialog({
  abierto,
  onOpenChange,
  empresaId,
  documento,
  empresa,
  cargarDetalle,
}: DocumentoDetalleDialogProps) {
  const [detalle, setDetalle] = useState<DocumentoDetalleCompleto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!abierto || documento === null) return;

    let activo = true;
    setCargando(true);
    setError(null);
    setDetalle(null);

    cargarDetalle(empresaId, documento.id)
      .then((resultado) => {
        if (!activo) return;
        if (resultado.ok) {
          setDetalle(resultado.detalle);
          setError(null);
        } else {
          setError(resultado.error);
        }
      })
      .catch(() => {
        if (!activo) return;
        setError("No pudimos cargar el detalle del documento.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [abierto, cargarDetalle, documento, empresaId]);

  async function descargarPdf(): Promise<void> {
    if (detalle === null || generandoPdf) return;

    setGenerandoPdf(true);
    try {
      const { documentoAPdf, nombreArchivoDocumentoPdf } = await import(
        "@/lib/reportes/documento-pdf"
      );
      const blob = await documentoAPdf(detalle, empresa);
      descargarBlob(blob, nombreArchivoDocumentoPdf(detalle));
    } catch {
      toast.error("No se pudo generar el PDF", {
        description: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setGenerandoPdf(false);
    }
  }

  function imprimir(): void {
    if (detalle === null) return;
    window.print();
  }

  const tituloDocumento = documento
    ? `${tipoDocumento(documento)} ${documento.numero}`
    : "Detalle del documento";

  return (
    <>
      <Dialog open={abierto} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl print:hidden">
          <DialogHeader>
            <DialogTitle>{tituloDocumento}</DialogTitle>
            <DialogDescription>
              Detalle imprimible del comprobante, sus pagos aplicados y el
              asiento contable generado.
            </DialogDescription>
          </DialogHeader>

          {cargando ? <EsqueletoDocumentoDetalle /> : null}

          {!cargando && error !== null ? (
            <div
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-4 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          {!cargando && error === null && detalle !== null ? (
            <ContenidoDocumentoDetalle detalle={detalle} empresa={empresa} />
          ) : null}

          {!cargando && error === null && detalle === null ? (
            <div className="flex flex-col items-center gap-2 rounded-[10px] border border-border px-4 py-8 text-center">
              <IconReceipt2 className="size-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Selecciona un documento para ver su detalle.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={detalle === null || cargando}
              onClick={imprimir}
            >
              <IconPrinter className="size-4" />
              Imprimir
            </Button>
            <Button
              type="button"
              disabled={detalle === null || cargando || generandoPdf}
              onClick={() => void descargarPdf()}
            >
              {generandoPdf ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconDownload className="size-4" />
              )}
              {generandoPdf ? "Generando…" : "Descargar PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {montado && abierto && detalle !== null
        ? createPortal(
            <div
              data-documento-detalle-print-root
              className="hidden print:block print:bg-white print:text-foreground"
            >
              <style>{CSS_IMPRESION_DOCUMENTO}</style>
              <ContenidoDocumentoDetalle detalle={detalle} empresa={empresa} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
