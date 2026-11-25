import { IconReceiptTax } from "@tabler/icons-react";
import { Suspense } from "react";

import {
  EsqueletoPestanas,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";
import { ImpuestosVista } from "@/components/impuestos/impuestos-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Skeleton } from "@/components/ui/skeleton";
import { type EmpresaAsignada, obtenerContextoApp } from "@/lib/auth/sesion";
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

function EsqueletoDatosImpuestos() {
  return (
    <>
      <EsqueletoPestanas cantidad={4} />

      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-[15px] border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-1 px-4 py-3">
            <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
              Formatos DGII
            </h2>
            <Skeleton className="h-3 w-44 rounded-[6px]" />
          </div>
          <div className="border-t border-border px-4 py-2">
            <Skeleton className="h-9 w-52 rounded-[10px]" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
            <Skeleton className="h-9 w-64 rounded-[10px]" />
            <Skeleton className="h-9 w-28 rounded-[10px]" />
            <Skeleton className="h-9 w-64 rounded-[10px]" />
            <Skeleton className="h-9 w-28 rounded-[10px]" />
          </div>
        </div>

        <EsqueletoTabla
          titulo="606 · Compras y gastos"
          columnas={8}
          filas={6}
        />
        <EsqueletoTabla titulo="607 · Ventas" columnas={8} filas={6} />
      </div>
    </>
  );
}

interface SeccionImpuestosProps {
  empresa: EmpresaAsignada;
  periodo: string;
}

async function SeccionImpuestos({ empresa, periodo }: SeccionImpuestosProps) {
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
      key={empresa.id}
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

export default async function ImpuestosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;
  const params = await searchParams;
  const periodo = periodoValido(params.periodo);

  const encabezado = (
    <EncabezadoPagina
      titulo="Impuestos"
      descripcion={
        empresa
          ? "Formatos 606/607, secuencias NCF y e-CF, configuración fiscal y obligaciones de la DGII."
          : undefined
      }
      migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Impuestos" }]}
    />
  );

  if (!empresa) {
    return (
      <>
        {encabezado}
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

  return (
    <>
      {encabezado}
      <Suspense fallback={<EsqueletoDatosImpuestos />}>
        <SeccionImpuestos empresa={empresa} periodo={periodo} />
      </Suspense>
    </>
  );
}
