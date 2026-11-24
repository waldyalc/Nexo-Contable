import { IconShoppingCart } from "@tabler/icons-react";

import { GastosVista } from "@/components/gastos/gastos-vista";
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
  title: "Gastos y compras · Nexo Contable",
};

export default async function GastosPage() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <>
        <EncabezadoPagina
          titulo="Gastos y compras"
          migas={[
            { etiqueta: "Operaciones" },
            { etiqueta: "Gastos y compras" },
          ]}
        />
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
    cargarDocumentos(empresa.id, ["purchase_invoice", "purchase_credit"]),
    cargarTerceros(empresa.id),
    cargarCuentas(empresa.id),
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

  return (
    <GastosVista
      empresaId={empresa.id}
      documentos={documentos.documentos}
      terceros={terceros}
      cuentas={cuentas}
      metodosPago={metodosPago}
      secuencias={secuencias}
      documentosAcreditables={acreditables}
      tasaItbisBps={configuracion.tasaItbisBps}
      cuentaCxpDefaultId={configuracion.cuentaCxpDefaultId}
      periodoInicial={periodoActualSantoDomingo()}
      moneda={empresa.monedaFuncional === "USD" ? "USD" : "DOP"}
    />
  );
}
