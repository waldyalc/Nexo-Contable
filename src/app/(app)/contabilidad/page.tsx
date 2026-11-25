import { IconBook2, IconBuildingStore, IconLock } from "@tabler/icons-react";
import Link from "next/link";
import { Suspense } from "react";

import type {
  AsientoListado,
  CuentaContable,
  LineaAsiento,
  PeriodoContable,
} from "@/app/(app)/contabilidad/actions";
import {
  EsqueletoPestanas,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";
import { ContabilidadVista } from "@/components/contabilidad/contabilidad-vista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { type EmpresaAsignada, obtenerContextoApp } from "@/lib/auth/sesion";
import type { Moneda } from "@/lib/formato";
import { consultarEnLotes } from "@/lib/supabase/lotes";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Contabilidad · Nexo Contable",
};

const ROLES_CONTABLES = new Set(["admin_global", "admin_empresa", "contador"]);

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
  padre_id: string | null;
  clasificacion: string;
  naturaleza: string;
  nivel: number;
  es_agrupacion: boolean;
  activa: boolean;
  es_equivalente_efectivo: boolean;
  categoria_flujo_efectivo: string;
}

interface AsientoFila {
  id: string;
  numero: string;
  fecha: string;
  tipo_operacion: string;
  descripcion: string;
  referencia: string;
  estado: string;
  reverso_de: string | null;
  revertido_por: string | null;
}

interface LineaFila {
  id: string;
  asiento_id: string;
  cuenta_id: string;
  descripcion: string;
  debito: number | string;
  credito: number | string;
}

interface PeriodoFila {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
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
          La contabilidad se organiza por empresa. Elige o crea una empresa para
          consultar su catálogo de cuentas, libro diario y períodos.
        </p>
        <Button render={<Link href="/empresas" />}>
          <IconBook2 className="size-4" />
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
          El módulo de contabilidad está disponible para administradores y
          contadores. Solicita acceso al administrador de tu firma.
        </p>
      </div>
    </TarjetaLista>
  );
}

interface ContabilidadContenidoProps {
  empresa: EmpresaAsignada;
  moneda: Moneda;
}

function EsqueletoContabilidad() {
  return (
    <div className="flex flex-col gap-3">
      <EsqueletoPestanas cantidad={4} />
      <EsqueletoTabla
        titulo="Contabilidad"
        descripcion="Cargando catálogo, asientos y períodos…"
        acciones={1}
        filtros={3}
        filas={10}
        columnas={6}
      />
    </div>
  );
}

async function ContabilidadContenido({
  empresa,
  moneda,
}: ContabilidadContenidoProps) {
  const supabase = await createClient();

  const [cuentasFilas, asientosFilas, periodosFilas] = await Promise.all([
    paginarConsulta<CuentaFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("cuentas")
        .select(
          "id, codigo, nombre, padre_id, clasificacion, naturaleza, nivel, es_agrupacion, activa, es_equivalente_efectivo, categoria_flujo_efectivo",
        )
        .eq("empresa_id", empresa.id)
        .order("codigo", { ascending: true })
        .range(desde, hasta);
      return { data: (data as CuentaFila[] | null) ?? null, error };
    }),
    (async () => {
      const { data, error } = await supabase
        .from("asientos")
        .select(
          "id, numero, fecha, tipo_operacion, descripcion, referencia, estado, reverso_de, revertido_por",
        )
        .eq("empresa_id", empresa.id)
        .order("fecha", { ascending: false })
        .order("numero", { ascending: false })
        .limit(200);
      return {
        filas: (data as AsientoFila[] | null) ?? [],
        error,
      };
    })(),
    paginarConsulta<PeriodoFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("periodos_contables")
        .select("id, nombre, fecha_inicio, fecha_fin, estado")
        .eq("empresa_id", empresa.id)
        .order("fecha_inicio", { ascending: false })
        .range(desde, hasta);
      return { data: (data as PeriodoFila[] | null) ?? null, error };
    }),
  ]);

  const asientos = asientosFilas.filas;
  const idsAsientos = asientos.map((asiento) => asiento.id);

  const lineasFilas = await consultarEnLotes(idsAsientos, async (lote) =>
    paginarConsulta<LineaFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("asiento_lineas")
        .select("id, asiento_id, cuenta_id, descripcion, debito, credito")
        .eq("empresa_id", empresa.id)
        .in("asiento_id", lote)
        .order("asiento_id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as LineaFila[] | null) ?? null, error };
    }),
  );

  const cuentas: CuentaContable[] = cuentasFilas.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    padreId: fila.padre_id,
    clasificacion: fila.clasificacion,
    naturaleza: fila.naturaleza,
    nivel: fila.nivel,
    esAgrupacion: fila.es_agrupacion,
    activa: fila.activa,
    esEquivalenteEfectivo: fila.es_equivalente_efectivo,
    categoriaFlujoEfectivo: fila.categoria_flujo_efectivo,
  }));

  const asientosListado: AsientoListado[] = asientos.map((fila) => ({
    id: fila.id,
    numero: fila.numero,
    fecha: fila.fecha,
    tipoOperacion: fila.tipo_operacion,
    descripcion: fila.descripcion,
    referencia: fila.referencia,
    estado: fila.estado,
    reversoDe: fila.reverso_de,
    revertidoPor: fila.revertido_por,
  }));

  const lineas: LineaAsiento[] = lineasFilas.map((fila) => ({
    id: fila.id,
    asientoId: fila.asiento_id,
    cuentaId: fila.cuenta_id,
    descripcion: fila.descripcion,
    debito: Number(fila.debito),
    credito: Number(fila.credito),
  }));

  const periodos: PeriodoContable[] = periodosFilas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    estado: fila.estado,
  }));

  return (
    <>
      <ContabilidadVista
        key={empresa.id}
        empresaNombre={empresa.nombreComercial}
        empresaRazonSocial={empresa.razonSocial}
        empresaRnc={empresa.rnc}
        moneda={moneda}
        cuentas={cuentas}
        asientos={asientosListado}
        lineas={lineas}
        periodos={periodos}
      />
      {asientosFilas.error ? (
        <p className="text-xs text-muted-foreground">
          No pudimos cargar todos los asientos recientes:{" "}
          {asientosFilas.error.message}
        </p>
      ) : null}
    </>
  );
}

export default async function ContabilidadPage() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;
  const rol = contexto.esAdminGlobal ? "admin_global" : (empresa?.rol ?? null);
  const autorizado = rol !== null && ROLES_CONTABLES.has(rol);

  const encabezado = (
    <EncabezadoPagina
      titulo="Contabilidad"
      descripcion={
        empresa
          ? `${empresa.nombreComercial} · Catálogo, diario, mayor y períodos contables`
          : "Catálogo de cuentas, libro diario, mayor y períodos contables."
      }
      migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Contabilidad" }]}
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

  return (
    <>
      {encabezado}
      <Suspense fallback={<EsqueletoContabilidad />}>
        <ContabilidadContenido empresa={empresa} moneda={moneda} />
      </Suspense>
    </>
  );
}
