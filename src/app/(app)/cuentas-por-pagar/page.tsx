import { IconClipboardList } from "@tabler/icons-react";
import { Suspense } from "react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { CarteraVista } from "@/components/cartera/cartera-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { hoySantoDomingo } from "@/lib/formato";
import {
  cargarAntiguedad,
  cargarConfiguracionFiscal,
  cargarDocumentos,
  cargarMetodosPago,
  cargarSecuenciasNcf,
  cargarTerceros,
} from "@/lib/operaciones/consultas";
import type { DocumentoAcreditable } from "@/lib/operaciones/tipos";

import { cargarDocumentoDetalleGastosAction } from "../gastos/documento-detalle-action";

export const metadata = {
  title: "Cuentas por pagar · Nexo Contable",
};

type ParametrosBusqueda = Promise<
  Record<string, string | string[] | undefined>
>;

function fechaCorteValida(valor: string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (texto !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  return hoySantoDomingo();
}

function EsqueletoCartera() {
  return (
    <>
      <EsqueletoTabla
        titulo="Facturas proveedor"
        descripcion="Cargando el ciclo de cuentas por pagar…"
        acciones={4}
        filtros={3}
        filas={8}
        columnas={8}
      />
    </>
  );
}

function SinEmpresa() {
  return (
    <TarjetaLista>
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <IconClipboardList className="size-6" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">
          Sin empresa activa
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Selecciona una empresa para ver el ciclo de sus cuentas por pagar.
        </p>
      </div>
    </TarjetaLista>
  );
}

export default function CuentasPorPagarPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas por pagar"
        descripcion="Facturas proveedor, suplidores, notas de crédito, pagos y antigüedad."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Cuentas por pagar" }]}
      />
      <Suspense fallback={<EsqueletoCartera />}>
        <SeccionCartera searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SeccionCartera({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const [contexto, params] = await Promise.all([
    obtenerContextoApp(),
    searchParams,
  ]);
  const empresa = contexto.empresaActiva;

  if (!empresa) return <SinEmpresa />;

  const fechaCorte = fechaCorteValida(params.corte);
  const [saldos, documentos, terceros, metodosPago, secuencias, configuracion] =
    await Promise.all([
      cargarAntiguedad(empresa.id, "cxp", fechaCorte),
      cargarDocumentos(empresa.id, ["purchase_invoice", "purchase_credit"]),
      cargarTerceros(empresa.id),
      cargarMetodosPago(empresa.id),
      cargarSecuenciasNcf(empresa.id),
      cargarConfiguracionFiscal(empresa.id),
    ]);

  const acreditables: DocumentoAcreditable[] = documentos.documentos
    .filter(
      (documento) =>
        documento.tipo === "purchase_invoice" &&
        documento.estado === "posted" &&
        documento.saldo > 0,
    )
    .map((documento) => ({
      id: documento.id,
      numero: documento.numero,
      ncf: documento.ncf,
      tipo: documento.tipo,
      terceroId: documento.terceroId,
      tercero: documento.tercero,
      fechaEmision: documento.fechaEmision,
      total: documento.total,
      saldo: documento.saldo,
    }));

  const rncPorTercero: Record<string, string> = {};
  for (const tercero of terceros) {
    rncPorTercero[tercero.id] = tercero.rnc;
  }

  const moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";

  return (
    <CarteraVista
      key={empresa.id}
      empresaId={empresa.id}
      empresaReporte={{
        nombreComercial: empresa.nombreComercial,
        razonSocial: empresa.razonSocial,
        rnc: empresa.rnc,
        moneda,
      }}
      tipo="cxp"
      fechaCorte={fechaCorte}
      saldos={saldos}
      documentos={documentos.documentos}
      pagos={documentos.pagos}
      terceros={terceros}
      rncPorTercero={rncPorTercero}
      cuentas={documentos.cuentas}
      metodosPago={metodosPago}
      secuencias={secuencias}
      documentosAcreditables={acreditables}
      tasaItbisBps={configuracion.tasaItbisBps}
      cuentaItbisAdelantadoId={configuracion.cuentaItbisAdelantadoId}
      cuentaItbisPorPagarId={configuracion.cuentaItbisPorPagarId}
      cuentaRetencionIsrId={configuracion.cuentaRetencionIsrId}
      cuentaRetencionItbisId={configuracion.cuentaRetencionItbisId}
      cuentaCxcDefaultId={configuracion.cuentaCxcDefaultId}
      cuentaCxpDefaultId={configuracion.cuentaCxpDefaultId}
      moneda={moneda}
      cargarDetalleDocumento={cargarDocumentoDetalleGastosAction}
    />
  );
}
