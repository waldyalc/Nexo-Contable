import { IconClipboardList } from "@tabler/icons-react";

import { CarteraVista } from "@/components/cartera/cartera-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { hoySantoDomingo } from "@/lib/formato";
import {
  cargarAntiguedad,
  cargarCuentas,
  cargarDocumentos,
  cargarMetodosPago,
} from "@/lib/operaciones/consultas";
import type { PagoListado } from "@/lib/operaciones/tipos";

export const metadata = {
  title: "Cuentas por pagar · Nexo Contable",
};

function fechaCorteValida(valor: string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (texto !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  return hoySantoDomingo();
}

export default async function CuentasPorPagarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;
  const params = await searchParams;
  const fechaCorte = fechaCorteValida(params.corte);

  if (!empresa) {
    return (
      <>
        <EncabezadoPagina
          titulo="Cuentas por pagar"
          migas={[
            { etiqueta: "Operaciones" },
            { etiqueta: "Cuentas por pagar" },
          ]}
        />
        <TarjetaLista>
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <IconClipboardList className="size-6" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Sin empresa activa
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Selecciona una empresa para ver la antigüedad de sus cuentas por
              pagar.
            </p>
          </div>
        </TarjetaLista>
      </>
    );
  }

  const [saldos, cuentas, metodosPago, documentos] = await Promise.all([
    cargarAntiguedad(empresa.id, "cxp", fechaCorte),
    cargarCuentas(empresa.id),
    cargarMetodosPago(empresa.id),
    cargarDocumentos(empresa.id, ["purchase_invoice"]),
  ]);

  const ids = new Set(saldos.map((saldo) => saldo.documentoId));
  const porDocumento = new Map<string, PagoListado[]>();

  for (const pago of documentos.pagos) {
    if (!ids.has(pago.documentoId)) continue;
    const lista = porDocumento.get(pago.documentoId) ?? [];
    lista.push(pago);
    porDocumento.set(pago.documentoId, lista);
  }

  const pagosPorDocumento: Record<string, PagoListado[]> = {};
  for (const [documentoId, pagos] of porDocumento) {
    pagosPorDocumento[documentoId] = pagos;
  }

  return (
    <CarteraVista
      empresaId={empresa.id}
      tipo="cxp"
      fechaCorte={fechaCorte}
      saldos={saldos}
      pagosPorDocumento={pagosPorDocumento}
      cuentas={cuentas}
      metodosPago={metodosPago}
      moneda={empresa.monedaFuncional === "USD" ? "USD" : "DOP"}
    />
  );
}
