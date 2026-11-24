import {
  IconBuilding,
  IconBuildingStore,
  IconCoin,
  IconPlus,
  IconReceipt,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import Link from "next/link";

import { PillEstado } from "@/components/listas/pill-estado";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ETIQUETAS_ROL } from "@/components/shell/navegacion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import {
  type Moneda,
  formatearFecha,
  formatearMoneda,
  formatearRnc,
} from "@/lib/formato";

export const metadata = {
  title: "Resumen · Nexo Contable",
};

const ETIQUETAS_REGIMEN: Record<string, string> = {
  ordinario: "Ordinario",
  simplificado: "Simplificado",
  renta_presuntiva: "Renta presuntiva",
  zona_franca: "Zona franca",
};

interface Kpi {
  etiqueta: string;
  icono: Icon;
}

const KPIS: readonly Kpi[] = [
  { etiqueta: "Ingresos del mes", icono: IconTrendingUp },
  { etiqueta: "Gastos del mes", icono: IconTrendingDown },
  { etiqueta: "Utilidad del mes", icono: IconReceipt },
  { etiqueta: "Efectivo y bancos", icono: IconCoin },
];

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {etiqueta}
      </dt>
      <dd className="truncate text-sm text-foreground">{valor}</dd>
    </div>
  );
}

export default async function DashboardPage() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;
  const moneda: Moneda = empresa?.monedaFuncional === "USD" ? "USD" : "DOP";

  return (
    <>
      <EncabezadoPagina
        titulo="Resumen"
        descripcion={
          empresa
            ? `${empresa.nombreComercial} · ${ETIQUETAS_ROL[empresa.rol]}`
            : "Bienvenido a Nexo Contable."
        }
        migas={[{ etiqueta: "General" }, { etiqueta: "Resumen" }]}
        acciones={
          contexto.esAdminGlobal ? (
            <Button variant="outline" render={<Link href="/empresas" />}>
              <IconBuilding className="size-4" />
              Gestionar empresas
            </Button>
          ) : undefined
        }
      />

      {empresa ? (
        <>
          <section
            aria-label="Indicadores del mes"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            {KPIS.map((kpi) => {
              const Icono = kpi.icono;

              return (
                <Card key={kpi.etiqueta} size="sm" className="gap-1">
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardDescription>{kpi.etiqueta}</CardDescription>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-secondary text-primary">
                      <Icono className="size-4" />
                    </span>
                  </CardHeader>
                  <CardContent>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground tabular-nums">
                      {formatearMoneda(0, moneda)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <TarjetaLista>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="font-display truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                    Empresa activa
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {empresa.razonSocial}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {empresa.esPrincipal ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      Principal
                    </span>
                  ) : null}
                  <PillEstado
                    estado={empresa.estado === "active" ? "activa" : "inactiva"}
                  />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-3">
                <Dato
                  etiqueta="RNC"
                  valor={empresa.rnc === "" ? "—" : formatearRnc(empresa.rnc)}
                />
                <Dato
                  etiqueta="Régimen fiscal"
                  valor={
                    ETIQUETAS_REGIMEN[empresa.regimenFiscal] ??
                    empresa.regimenFiscal
                  }
                />
                <Dato etiqueta="Moneda" valor={empresa.monedaFuncional} />
                <Dato
                  etiqueta="Inicio de operaciones"
                  valor={
                    empresa.fechaInicio
                      ? formatearFecha(empresa.fechaInicio)
                      : "—"
                  }
                />
                <Dato etiqueta="Tu rol" valor={ETIQUETAS_ROL[empresa.rol]} />
                <Dato
                  etiqueta="Empresas asignadas"
                  valor={String(contexto.empresas.length)}
                />
              </dl>
            </TarjetaLista>

            <TarjetaLista>
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
                  Tus empresas
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cambia de empresa desde el selector superior.
                </p>
              </div>
              <ul className="divide-y divide-border">
                {contexto.empresas.map((asignada) => (
                  <li
                    key={asignada.id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {asignada.nombreComercial}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ETIQUETAS_ROL[asignada.rol]}
                    </span>
                  </li>
                ))}
              </ul>
            </TarjetaLista>
          </div>

          <p className="text-xs text-muted-foreground">
            Los indicadores se completarán al registrar facturas, gastos y
            movimientos bancarios en los módulos de operaciones.
          </p>
        </>
      ) : (
        <TarjetaLista>
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <IconBuildingStore className="size-6" />
            </span>
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
              Aún no hay una empresa activa
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {contexto.esAdminGlobal
                ? "Crea la primera empresa de tu firma para comenzar a contabilizar facturas, gastos y comprobantes DGII."
                : "Tu usuario todavía no tiene empresas asignadas. Solicita acceso al administrador de tu firma."}
            </p>
            {contexto.esAdminGlobal ? (
              <Button render={<Link href="/empresas?nueva=1" />}>
                <IconPlus className="size-4" />
                Crear empresa
              </Button>
            ) : null}
          </div>
        </TarjetaLista>
      )}
    </>
  );
}
