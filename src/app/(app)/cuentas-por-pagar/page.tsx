import { IconClipboardList } from "@tabler/icons-react";
import { Suspense } from "react";

import {
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";
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
  cargarTerceros,
} from "@/lib/operaciones/consultas";
import type { PagoListado } from "@/lib/operaciones/tipos";

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
      <EsqueletoTarjetas
        cantidad={6}
        className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      />
      <EsqueletoTabla
        titulo="Antigüedad de saldos"
        descripcion="Cargando documentos por pagar…"
        acciones={1}
        filtros={1}
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
          Selecciona una empresa para ver la antigüedad de sus cuentas por
          pagar.
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
        descripcion="Saldos de proveedores por antigüedad, pagos y anulaciones por reverso."
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
  const [saldos, cuentas, metodosPago, documentos, terceros] =
    await Promise.all([
      cargarAntiguedad(empresa.id, "cxp", fechaCorte),
      cargarCuentas(empresa.id),
      cargarMetodosPago(empresa.id),
      cargarDocumentos(empresa.id, ["purchase_invoice"]),
      cargarTerceros(empresa.id),
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
      rncPorTercero={rncPorTercero}
      pagosPorDocumento={pagosPorDocumento}
      cuentas={cuentas}
      metodosPago={metodosPago}
      moneda={moneda}
    />
  );
}
