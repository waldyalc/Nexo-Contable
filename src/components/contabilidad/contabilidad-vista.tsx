"use client";

import {
  IconBook2,
  IconCalendarStats,
  IconScale,
  IconStack2,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import type {
  AsientoListado,
  CuentaContable,
  LineaAsiento,
  PeriodoContable,
} from "@/app/(app)/contabilidad/actions";
import { CatalogoCuentasTab } from "@/components/contabilidad/catalogo-cuentas-tab";
import { DiarioAsientosTab } from "@/components/contabilidad/diario-asientos-tab";
import { MayorBalanzaTab } from "@/components/contabilidad/mayor-balanza-tab";
import { PeriodosTab } from "@/components/contabilidad/periodos-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Moneda } from "@/lib/formato";
import { crearEmpresaReporte } from "@/lib/reportes/adaptadores";

export interface ContabilidadVistaProps {
  empresaNombre: string;
  empresaRazonSocial: string;
  empresaRnc: string;
  moneda: Moneda;
  cuentas: readonly CuentaContable[];
  asientos: readonly AsientoListado[];
  lineas: readonly LineaAsiento[];
  periodos: readonly PeriodoContable[];
}

export function ContabilidadVista({
  empresaNombre,
  empresaRazonSocial,
  empresaRnc,
  moneda,
  cuentas,
  asientos,
  lineas,
  periodos,
}: ContabilidadVistaProps) {
  const [pestana, setPestana] = useState("catalogo");
  const empresaReporte = useMemo(
    () =>
      crearEmpresaReporte({
        nombreComercial: empresaNombre,
        razonSocial: empresaRazonSocial,
        rnc: empresaRnc,
        moneda,
      }),
    [empresaNombre, empresaRazonSocial, empresaRnc, moneda],
  );

  return (
    <Tabs
      value={pestana}
      onValueChange={(valor) =>
        setPestana(typeof valor === "string" ? valor : "catalogo")
      }
      className="gap-3"
    >
      <div className="w-full overflow-x-auto pb-0.5">
        <TabsList className="w-fit">
          <TabsTrigger value="catalogo">
            <IconStack2 className="size-4" />
            Catálogo de cuentas
          </TabsTrigger>
          <TabsTrigger value="diario">
            <IconBook2 className="size-4" />
            Libro diario
          </TabsTrigger>
          <TabsTrigger value="mayor">
            <IconScale className="size-4" />
            Mayor y balanza
          </TabsTrigger>
          <TabsTrigger value="periodos">
            <IconCalendarStats className="size-4" />
            Períodos
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="catalogo">
        <CatalogoCuentasTab cuentas={cuentas} />
      </TabsContent>

      <TabsContent value="diario">
        <DiarioAsientosTab
          asientos={asientos}
          lineas={lineas}
          cuentas={cuentas}
          moneda={moneda}
          empresa={empresaReporte}
        />
      </TabsContent>

      <TabsContent value="mayor">
        <MayorBalanzaTab
          cuentas={cuentas}
          moneda={moneda}
          empresa={empresaReporte}
        />
      </TabsContent>

      <TabsContent value="periodos">
        <PeriodosTab periodos={periodos} />
      </TabsContent>

      <p className="text-xs text-muted-foreground">
        Trabajando en <span className="font-medium">{empresaNombre}</span> · Los
        asientos contabilizados solo se anulan mediante un asiento de reverso.
      </p>
    </Tabs>
  );
}
