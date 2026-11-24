import { IconReceiptTax } from "@tabler/icons-react";

import { ImpuestosVista } from "@/components/impuestos/impuestos-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { periodoActualSantoDomingo } from "@/lib/formato";
import {
  cargarConfiguracionFiscal,
  cargarCuentas,
  cargarMetodosPago,
  cargarObligaciones,
  cargarReglasFiscales,
  cargarReporteDgii,
  cargarSecuenciasNcf,
} from "@/lib/operaciones/consultas";
import { periodoDgiiDesdeMes } from "@/lib/operaciones/tipos";

export const metadata = {
  title: "Impuestos · Nexo Contable",
};

function periodoValido(valor: string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (texto !== undefined && /^\d{4}-\d{2}$/.test(texto)) return texto;
  return periodoActualSantoDomingo();
}

export default async function ImpuestosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;
  const params = await searchParams;
  const periodo = periodoValido(params.periodo);

  if (!empresa) {
    return (
      <>
        <EncabezadoPagina
          titulo="Impuestos"
          migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Impuestos" }]}
        />
        <TarjetaLista>
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <IconReceiptTax className="size-6" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Sin empresa activa
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Selecciona una empresa para ver sus formatos 606/607 y sus
              obligaciones fiscales.
            </p>
          </div>
        </TarjetaLista>
      </>
    );
  }

  const [
    reporte,
    secuencias,
    configuracion,
    reglas,
    metodosPago,
    obligaciones,
    cuentas,
  ] = await Promise.all([
    cargarReporteDgii(empresa.id, periodoDgiiDesdeMes(periodo)),
    cargarSecuenciasNcf(empresa.id),
    cargarConfiguracionFiscal(empresa.id),
    cargarReglasFiscales(empresa.id),
    cargarMetodosPago(empresa.id),
    cargarObligaciones(empresa.id),
    cargarCuentas(empresa.id),
  ]);

  return (
    <ImpuestosVista
      empresaId={empresa.id}
      periodo={periodo}
      reporte606={reporte.filas606}
      reporte607={reporte.filas607}
      secuencias={secuencias}
      configuracion={configuracion}
      reglas={reglas}
      metodosPago={metodosPago}
      obligaciones={obligaciones}
      cuentas={cuentas}
      moneda={empresa.monedaFuncional === "USD" ? "USD" : "DOP"}
    />
  );
}
