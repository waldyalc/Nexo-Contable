import { IconFileInvoice } from "@tabler/icons-react";
import { Suspense } from "react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { FacturacionVista } from "@/components/facturacion/facturacion-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { periodoActualSantoDomingo } from "@/lib/formato";
import {
  cargarArticulosDocumento,
  cargarConfiguracionFiscal,
  cargarCuentas,
  cargarDocumentos,
  cargarMetodosPago,
  cargarSecuenciasNcf,
  cargarTerceros,
} from "@/lib/operaciones/consultas";
import type { DocumentoAcreditable } from "@/lib/operaciones/tipos";

import { cargarDocumentoDetalleFacturacionAction } from "./documento-detalle-action";

export const metadata = {
  title: "Facturación · Nexo Contable",
};

export default function FacturacionPage() {
  return (
    <>
      <EncabezadoPagina
        titulo="Facturación"
        descripcion="Facturas de venta con NCF de serie B o e-CF electrónico y formato 607."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Facturación" }]}
      />
      <Suspense
        fallback={
          <EsqueletoTabla
            titulo="Facturas emitidas"
            descripcion="Cargando documentos…"
            acciones={4}
            filtros={3}
            filas={8}
            columnas={8}
          />
        }
      >
        <FacturacionContenido />
      </Suspense>
    </>
  );
}

async function FacturacionContenido() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <TarjetaLista>
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <IconFileInvoice className="size-6" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Sin empresa activa
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Selecciona o crea una empresa para emitir facturas con NCF.
          </p>
        </div>
      </TarjetaLista>
    );
  }

  const [
    documentos,
    terceros,
    cuentas,
    metodosPago,
    articulos,
    secuencias,
    configuracion,
  ] = await Promise.all([
    cargarDocumentos(empresa.id, ["sales_invoice", "sales_credit"]),
    cargarTerceros(empresa.id),
    cargarCuentas(empresa.id),
    cargarMetodosPago(empresa.id),
    cargarArticulosDocumento(empresa.id),
    cargarSecuenciasNcf(empresa.id),
    cargarConfiguracionFiscal(empresa.id),
  ]);

  const acreditables: DocumentoAcreditable[] = documentos.documentos
    .filter(
      (documento) =>
        documento.tipo === "sales_invoice" &&
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

  const moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";

  return (
    <FacturacionVista
      key={empresa.id}
      empresaId={empresa.id}
      empresa={{
        nombreComercial: empresa.nombreComercial,
        razonSocial: empresa.razonSocial,
        rnc: empresa.rnc,
        moneda,
      }}
      documentos={documentos.documentos}
      terceros={terceros}
      cuentas={cuentas}
      metodosPago={metodosPago}
      articulos={articulos}
      secuencias={secuencias}
      documentosAcreditables={acreditables}
      tasaItbisBps={configuracion.tasaItbisBps}
      cuentaItbisAdelantadoId={configuracion.cuentaItbisAdelantadoId}
      cuentaItbisPorPagarId={configuracion.cuentaItbisPorPagarId}
      cuentaRetencionIsrId={configuracion.cuentaRetencionIsrId}
      cuentaRetencionItbisId={configuracion.cuentaRetencionItbisId}
      cuentaCxcDefaultId={configuracion.cuentaCxcDefaultId}
      cuentaCxpDefaultId={configuracion.cuentaCxpDefaultId}
      periodoInicial={periodoActualSantoDomingo()}
      moneda={moneda}
      cargarDetalleDocumento={cargarDocumentoDetalleFacturacionAction}
    />
  );
}
