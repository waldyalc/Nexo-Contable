import { IconShoppingCart } from "@tabler/icons-react";
import { Suspense } from "react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { GastosVista } from "@/components/gastos/gastos-vista";
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

import { cargarDocumentoDetalleGastosAction } from "./documento-detalle-action";

export const metadata = {
  title: "Gastos y compras · Nexo Contable",
};

export default function GastosPage() {
  return (
    <>
      <EncabezadoPagina
        titulo="Gastos y compras"
        descripcion="Comprobantes de compra con su NCF, retenciones y formato 606."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Gastos y compras" }]}
      />
      <Suspense
        fallback={
          <EsqueletoTabla
            titulo="Compras registradas"
            descripcion="Cargando comprobantes…"
            acciones={4}
            filtros={3}
            filas={8}
            columnas={8}
          />
        }
      >
        <GastosContenido />
      </Suspense>
    </>
  );
}

async function GastosContenido() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <TarjetaLista>
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <IconShoppingCart className="size-6" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Sin empresa activa
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Selecciona o crea una empresa para registrar compras y gastos.
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
    cargarDocumentos(empresa.id, ["purchase_invoice", "purchase_credit"]),
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

  const moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";

  return (
    <GastosVista
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
      cargarDetalleDocumento={cargarDocumentoDetalleGastosAction}
    />
  );
}
