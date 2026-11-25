import { IconFileInvoice } from "@tabler/icons-react";

import { FacturacionVista } from "@/components/facturacion/facturacion-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { periodoActualSantoDomingo } from "@/lib/formato";
import {
  cargarConfiguracionFiscal,
  cargarCuentas,
  cargarDocumentos,
  cargarMetodosPago,
  cargarSecuenciasNcf,
  cargarTerceros,
} from "@/lib/operaciones/consultas";
import type { DocumentoAcreditable } from "@/lib/operaciones/tipos";

export const metadata = {
  title: "Facturación · Nexo Contable",
};

export default async function FacturacionPage() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <>
        <EncabezadoPagina
          titulo="Facturación"
          migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Facturación" }]}
        />
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
      </>
    );
  }

  const [
    documentos,
    terceros,
    cuentas,
    metodosPago,
    secuencias,
    configuracion,
  ] = await Promise.all([
    cargarDocumentos(empresa.id, ["sales_invoice", "sales_credit"]),
    cargarTerceros(empresa.id),
    cargarCuentas(empresa.id),
    cargarMetodosPago(empresa.id),
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

  return (
    <FacturacionVista
      key={empresa.id}
      empresaId={empresa.id}
      documentos={documentos.documentos}
      terceros={terceros}
      cuentas={cuentas}
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
      periodoInicial={periodoActualSantoDomingo()}
      moneda={empresa.monedaFuncional === "USD" ? "USD" : "DOP"}
    />
  );
}
