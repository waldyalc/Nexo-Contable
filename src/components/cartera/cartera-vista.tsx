"use client";

import { IconPlus, IconReceipt2, IconUsers } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AntiguedadCarteraTab } from "@/components/cartera/antiguedad-cartera-tab";
import { DocumentosCarteraTab } from "@/components/cartera/documentos-cartera-tab";
import { PagosCarteraTab } from "@/components/cartera/pagos-cartera-tab";
import { TerceroFormDialog } from "@/components/cartera/tercero-form-dialog";
import { TercerosCarteraTab } from "@/components/cartera/terceros-cartera-tab";
import {
  DocumentoFormDialog,
  type ModoDocumento,
} from "@/components/gastos/documento-form-dialog";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import {
  DialogoAnular,
  DialogoRegistrarPago,
  type DocumentoPago,
} from "@/components/operaciones/dialogos-cartera";
import { DocumentoDetalleDialog } from "@/components/operaciones/documento-detalle-dialog";
import { TercerosSheet } from "@/components/terceros/terceros-sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  enriquecerPagosCartera,
  tercerosDeCartera,
  ultimaFacturaCartera,
} from "@/lib/cartera/utilidades";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import type { CargadorDocumentoDetalle } from "@/lib/operaciones/consultas";
import type {
  CuentaOpcion,
  DocumentoAcreditable,
  DocumentoListado,
  MetodoPagoOpcion,
  PagoListado,
  SaldoAntiguedad,
  SecuenciaNcfListado,
  TerceroListado,
} from "@/lib/operaciones/tipos";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

type PestanaCartera =
  | "facturas"
  | "terceros"
  | "notas"
  | "pagos"
  | "antiguedad";

export interface CarteraVistaProps {
  empresaId: string;
  empresaReporte: EmpresaReporte;
  tipo: "cxc" | "cxp";
  fechaCorte: string;
  saldos: readonly SaldoAntiguedad[];
  documentos: readonly DocumentoListado[];
  pagos: readonly PagoListado[];
  terceros: readonly TerceroListado[];
  rncPorTercero: Readonly<Record<string, string>>;
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
  moneda: "DOP" | "USD";
  cargarDetalleDocumento: CargadorDocumentoDetalle;
}

/**
 * Ciclo completo de cartera del Nexo original: facturas, terceros, notas,
 * cobros/pagos y antigüedad. La creación usa el motor actual (documentos ya
 * nacen contabilizados); las anulaciones siempre son reversos auditables.
 */
export function CarteraVista({
  empresaId,
  empresaReporte,
  tipo,
  fechaCorte,
  saldos,
  documentos,
  pagos,
  terceros,
  rncPorTercero,
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
  moneda,
  cargarDetalleDocumento,
}: CarteraVistaProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const esCobrar = tipo === "cxc";
  const modoFactura: ModoDocumento = esCobrar ? "venta" : "compra";
  const modoNota: ModoDocumento = esCobrar
    ? "nota_credito_venta"
    : "nota_credito_compra";

  const [pestana, setPestana] = useState<PestanaCartera>(() =>
    searchParams.has("q") || searchParams.has("corte")
      ? "antiguedad"
      : "facturas",
  );
  const [formAbierto, setFormAbierto] = useState(false);
  const [modoForm, setModoForm] = useState<ModoDocumento>(modoFactura);
  const [tercerosAbierto, setTercerosAbierto] = useState(false);
  const [terceroFormAbierto, setTerceroFormAbierto] = useState(false);
  const [terceroEditando, setTerceroEditando] = useState<TerceroListado | null>(
    null,
  );
  const [documentoPago, setDocumentoPago] = useState<DocumentoPago | null>(
    null,
  );
  const [documentoAnular, setDocumentoAnular] =
    useState<DocumentoListado | null>(null);
  const [detalleDocumento, setDetalleDocumento] =
    useState<DocumentoListado | null>(null);
  const [pagoAnular, setPagoAnular] = useState<PagoListado | null>(null);

  const tipoFactura = esCobrar ? "sales_invoice" : "purchase_invoice";
  const tipoNota = esCobrar ? "sales_credit" : "purchase_credit";

  const facturas = useMemo(
    () => documentos.filter((documento) => documento.tipo === tipoFactura),
    [documentos, tipoFactura],
  );
  const notas = useMemo(
    () => documentos.filter((documento) => documento.tipo === tipoNota),
    [documentos, tipoNota],
  );
  const tercerosCiclo = useMemo(
    () => tercerosDeCartera(terceros, tipo),
    [terceros, tipo],
  );
  const pagosCartera = useMemo(
    () => enriquecerPagosCartera(pagos, documentos, rncPorTercero),
    [pagos, documentos, rncPorTercero],
  );
  const pagosPorDocumento = useMemo(() => {
    const porDocumento: Record<string, PagoListado[]> = {};
    for (const pago of pagosCartera) {
      const lista = porDocumento[pago.documentoId] ?? [];
      lista.push(pago);
      porDocumento[pago.documentoId] = lista;
    }
    return porDocumento;
  }, [pagosCartera]);
  const ultimaFactura = useMemo(
    () =>
      esCobrar ? null : ultimaFacturaCartera(documentos, "purchase_invoice"),
    [documentos, esCobrar],
  );

  function abrirFormulario(modo: ModoDocumento) {
    setModoForm(modo);
    setFormAbierto(true);
  }

  function abrirCrearTercero() {
    setTerceroEditando(null);
    setTerceroFormAbierto(true);
  }

  function abrirEditarTercero(tercero: TerceroListado) {
    setTerceroEditando(tercero);
    setTerceroFormAbierto(true);
  }

  function registrarPagoDocumento(documento: DocumentoListado) {
    setDocumentoPago({
      id: documento.id,
      numero: documento.numero,
      tercero: documento.tercero,
      saldo: documento.saldo,
    });
  }

  function registrarPagoSaldo(saldo: SaldoAntiguedad) {
    setDocumentoPago({
      id: saldo.documentoId,
      numero: saldo.numero,
      tercero: saldo.tercero,
      saldo: saldo.saldo,
    });
  }

  return (
    <>
      <Tabs
        value={pestana}
        onValueChange={(valor) => {
          if (
            valor === "facturas" ||
            valor === "terceros" ||
            valor === "notas" ||
            valor === "pagos" ||
            valor === "antiguedad"
          ) {
            setPestana(valor);
          }
        }}
        className="gap-3"
      >
        <TarjetaLista data-lista="ciclo-cartera">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="font-display truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                {esCobrar ? "Facturas pendientes" : "Facturas de proveedores"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Saldos calculados con cobros, pagos y notas aplicadas
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&_button]:h-9 [&_button]:whitespace-nowrap [&_button]:shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={abrirCrearTercero}
              >
                <IconPlus className="size-4" />
                Tercero
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTercerosAbierto(true)}
              >
                <IconUsers className="size-4" />
                Terceros
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => abrirFormulario(modoNota)}
              >
                <IconReceipt2 className="size-4" />
                Nota de crédito
              </Button>
              <Button
                type="button"
                onClick={() => abrirFormulario(modoFactura)}
              >
                <IconPlus className="size-4" />
                Nueva factura
              </Button>
            </div>
          </div>

          <div className="w-full overflow-x-auto border-t border-border px-4 py-2">
            <TabsList className="w-fit">
              <TabsTrigger value="facturas">
                {esCobrar ? "Facturas" : "Facturas proveedor"}
              </TabsTrigger>
              <TabsTrigger value="terceros">
                {esCobrar ? "Clientes" : "Suplidores"}
              </TabsTrigger>
              <TabsTrigger value="notas">Notas de crédito</TabsTrigger>
              <TabsTrigger value="pagos">
                {esCobrar ? "Cobros" : "Pagos"}
              </TabsTrigger>
              <TabsTrigger value="antiguedad">Antigüedad</TabsTrigger>
            </TabsList>
          </div>
        </TarjetaLista>

        {!esCobrar ? (
          <TarjetaLista className="px-4 py-3" data-lista="ultima-factura-cxp">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Último número de factura usado
              </span>
              <span className="font-display text-lg font-bold tracking-[-0.02em] text-foreground tabular-nums">
                {ultimaFactura?.numero ?? "—"}
              </span>
              {ultimaFactura && ultimaFactura.ncf !== "" ? (
                <span className="text-xs text-muted-foreground">
                  NCF {ultimaFactura.ncf} · {ultimaFactura.tercero}
                </span>
              ) : null}
            </div>
          </TarjetaLista>
        ) : null}

        <TabsContent value="facturas" className="flex flex-col gap-3">
          <DocumentosCarteraTab
            tipo={tipo}
            documentos={facturas}
            rncPorTercero={rncPorTercero}
            moneda={moneda}
            esNotas={false}
            onVerDetalle={setDetalleDocumento}
            onRegistrarPago={registrarPagoDocumento}
            onAnularDocumento={setDocumentoAnular}
            onCrearDocumento={() => abrirFormulario(modoFactura)}
          />
        </TabsContent>

        <TabsContent value="terceros" className="flex flex-col gap-3">
          <TercerosCarteraTab
            tipo={tipo}
            terceros={tercerosCiclo}
            onEditar={abrirEditarTercero}
            onCrear={abrirCrearTercero}
          />
        </TabsContent>

        <TabsContent value="notas" className="flex flex-col gap-3">
          <DocumentosCarteraTab
            tipo={tipo}
            documentos={notas}
            rncPorTercero={rncPorTercero}
            moneda={moneda}
            esNotas
            onVerDetalle={setDetalleDocumento}
            onRegistrarPago={registrarPagoDocumento}
            onAnularDocumento={setDocumentoAnular}
            onCrearDocumento={() => abrirFormulario(modoNota)}
          />
        </TabsContent>

        <TabsContent value="pagos" className="flex flex-col gap-3">
          <PagosCarteraTab
            tipo={tipo}
            pagos={pagosCartera}
            moneda={moneda}
            onVerDocumento={setDetalleDocumento}
            onAnularPago={setPagoAnular}
          />
        </TabsContent>

        <TabsContent value="antiguedad" className="flex flex-col gap-3">
          <AntiguedadCarteraTab
            tipo={tipo}
            fechaCorte={fechaCorte}
            saldos={saldos}
            rncPorTercero={rncPorTercero}
            pagosPorDocumento={pagosPorDocumento}
            moneda={moneda}
            empresaReporte={empresaReporte}
            onRegistrarPago={registrarPagoSaldo}
            onAnularPago={setPagoAnular}
          />
        </TabsContent>
      </Tabs>

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
        tipoInicial={esCobrar ? "customer" : "supplier"}
      />

      <TerceroFormDialog
        abierto={terceroFormAbierto}
        onOpenChange={setTerceroFormAbierto}
        empresaId={empresaId}
        tercero={terceroEditando}
        tipoInicial={esCobrar ? "customer" : "supplier"}
        onGuardado={() => router.refresh()}
      />

      <DocumentoDetalleDialog
        abierto={detalleDocumento !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDetalleDocumento(null);
        }}
        empresaId={empresaId}
        documento={detalleDocumento}
        empresa={empresaReporte}
        cargarDetalle={cargarDetalleDocumento}
      />

      <DialogoRegistrarPago
        abierto={documentoPago !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDocumentoPago(null);
        }}
        empresaId={empresaId}
        documento={documentoPago}
        cuentas={cuentas}
        metodosPago={metodosPago}
        etiquetaAccion={esCobrar ? "Registrar cobro" : "Registrar pago"}
        onRegistrado={() => router.refresh()}
      />

      <DialogoAnular
        abierto={documentoAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDocumentoAnular(null);
        }}
        empresaId={empresaId}
        tipo="documento"
        referenciaId={documentoAnular?.id ?? null}
        identificador={documentoAnular?.numero ?? ""}
        onAnulado={() => router.refresh()}
      />

      <DialogoAnular
        abierto={pagoAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPagoAnular(null);
        }}
        empresaId={empresaId}
        tipo="pago"
        referenciaId={pagoAnular?.id ?? null}
        identificador={
          pagoAnular
            ? `${formatearMoneda(pagoAnular.monto, moneda)} del ${formatearFecha(pagoAnular.fechaPago)}`
            : ""
        }
        onAnulado={() => router.refresh()}
      />
    </>
  );
}
