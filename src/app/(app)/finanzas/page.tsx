import {
  IconBuildingStore,
  IconLock,
  IconReportAnalytics,
} from "@tabler/icons-react";
import Link from "next/link";

import type {
  FilaBalanceGeneral,
  FilaEstadoResultados,
  FilaFlujoEfectivo,
} from "@/app/(app)/finanzas/actions";
import { FinanzasVista } from "@/components/finanzas/finanzas-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { type Moneda, aNumero, hoySantoDomingo } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Finanzas · Nexo Contable",
};

const ROLES_FINANZAS = new Set(["admin_global", "admin_empresa", "contador"]);

function calcularResultado(filas: readonly FilaEstadoResultados[]): number {
  return filas.reduce((acumulado, fila) => {
    if (fila.clasificacion === "income") return acumulado + fila.monto;
    if (fila.clasificacion === "cost") return acumulado - fila.monto;
    if (fila.clasificacion === "expense") return acumulado - fila.monto;
    return acumulado;
  }, 0);
}

function EstadoSinEmpresa() {
  return (
    <TarjetaLista>
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <IconBuildingStore className="size-6" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
          Selecciona una empresa
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Los estados financieros se calculan por empresa. Elige o crea una
          empresa para consultar sus resultados, balance y flujo de efectivo.
        </p>
        <Button render={<Link href="/empresas" />}>
          <IconReportAnalytics className="size-4" />
          Gestionar empresas
        </Button>
      </div>
    </TarjetaLista>
  );
}

function EstadoSinAcceso() {
  return (
    <TarjetaLista>
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <IconLock className="size-6" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
          Módulo restringido
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Los estados financieros están disponibles para administradores y
          contadores. Solicita acceso al administrador de tu firma.
        </p>
      </div>
    </TarjetaLista>
  );
}

export default async function FinanzasPage() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;
  const rol = contexto.esAdminGlobal ? "admin_global" : (empresa?.rol ?? null);
  const autorizado = rol !== null && ROLES_FINANZAS.has(rol);
  const hoy = hoySantoDomingo();
  const rangoInicial = { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };

  const encabezado = (
    <EncabezadoPagina
      titulo="Finanzas"
      descripcion={
        empresa
          ? `${empresa.nombreComercial} · Estados financieros y exportación a Excel`
          : "Estados financieros de la empresa activa."
      }
      migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Finanzas" }]}
    />
  );

  if (!empresa) {
    return (
      <>
        {encabezado}
        <EstadoSinEmpresa />
      </>
    );
  }

  if (!autorizado) {
    return (
      <>
        {encabezado}
        <EstadoSinAcceso />
      </>
    );
  }

  const moneda: Moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";
  const supabase = await createClient();

  const [resultadosRespuesta, balanceRespuesta, flujoRespuesta] =
    await Promise.all([
      supabase.rpc("reporte_estado_resultados", {
        p_empresa_id: empresa.id,
        p_desde: rangoInicial.desde,
        p_hasta: rangoInicial.hasta,
      }),
      supabase.rpc("reporte_balance_general", {
        p_empresa_id: empresa.id,
        p_fecha_corte: hoy,
      }),
      supabase.rpc("reporte_flujo_efectivo", {
        p_empresa_id: empresa.id,
        p_desde: rangoInicial.desde,
        p_hasta: rangoInicial.hasta,
      }),
    ]);

  const estadoResultados: FilaEstadoResultados[] = (
    resultadosRespuesta.data ?? []
  ).map((fila) => ({
    clasificacion: fila.clasificacion,
    cuentaId: fila.cuenta_id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    debitos: aNumero(fila.debitos),
    creditos: aNumero(fila.creditos),
    monto: aNumero(fila.monto),
  }));

  const balanceGeneral: FilaBalanceGeneral[] = (
    balanceRespuesta.data ?? []
  ).map((fila) => ({
    clasificacion: fila.clasificacion,
    cuentaId: fila.cuenta_id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    monto: aNumero(fila.monto),
  }));

  const flujoEfectivo: FilaFlujoEfectivo[] = (flujoRespuesta.data ?? []).map(
    (fila) => ({
      categoria: fila.categoria,
      monto: aNumero(fila.monto),
    }),
  );

  const resultado = calcularResultado(estadoResultados);
  const resultadoFlujo = flujoEfectivo.reduce(
    (acumulado, fila) => acumulado + fila.monto,
    0,
  );

  const error =
    resultadosRespuesta.error?.message ??
    balanceRespuesta.error?.message ??
    flujoRespuesta.error?.message ??
    null;

  return (
    <>
      {encabezado}
      {error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <FinanzasVista
        key={empresa.id}
        empresaId={empresa.id}
        empresaNombre={empresa.nombreComercial}
        moneda={moneda}
        rangoInicial={rangoInicial}
        fechaCorteInicial={hoy}
        estadoResultadosInicial={estadoResultados}
        resultadoInicial={resultado}
        balanceInicial={balanceGeneral}
        resultadoBalanceInicial={resultado}
        flujoInicial={flujoEfectivo}
        resultadoFlujoInicial={resultadoFlujo}
      />
    </>
  );
}
