"use client";

import {
  IconBook2,
  IconCalendarStats,
  IconChartPie,
  IconCreditCard,
  IconFileImport,
  IconHome2,
  IconReceipt2,
  IconScale,
  IconStack2,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import type {
  AsientoListado,
  BalanceInicialListado,
  CuentaContable,
  LineaAsiento,
  MetodoPagoContable,
  PeriodoContable,
} from "@/app/(app)/contabilidad/actions";
import { BalancesInicialesTab } from "@/components/contabilidad/balances-iniciales-tab";
import { CatalogoCuentasTab } from "@/components/contabilidad/catalogo-cuentas-tab";
import { DiarioAsientosTab } from "@/components/contabilidad/diario-asientos-tab";
import { EstadosFinancierosTab } from "@/components/contabilidad/estados-financieros-tab";
import { FormasPagoTab } from "@/components/contabilidad/formas-pago-tab";
import { MayorBalanzaTab } from "@/components/contabilidad/mayor-balanza-tab";
import { PeriodosTab } from "@/components/contabilidad/periodos-tab";
import {
  type ClavePestanaContable,
  RegistrarGastosTab,
  ResumenContableTab,
} from "@/components/contabilidad/resumen-gastos-tab";
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
  metodosPago: readonly MetodoPagoContable[];
  balancesIniciales: readonly BalanceInicialListado[];
  totalBorradores: number;
  totalContabilizados: number;
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
  metodosPago,
  balancesIniciales,
  totalBorradores,
  totalContabilizados,
}: ContabilidadVistaProps) {
  const [pestana, setPestana] = useState<ClavePestanaContable>("resumen");
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

  const cuentasActivasMovimiento = useMemo(() => {
    const padres = new Set<string>();
    for (const cuenta of cuentas) {
      if (cuenta.padreId) padres.add(cuenta.padreId);
    }
    return cuentas.filter(
      (cuenta) =>
        cuenta.activa && !cuenta.esAgrupacion && !padres.has(cuenta.id),
    ).length;
  }, [cuentas]);

  return (
    <Tabs
      value={pestana}
      onValueChange={(valor) =>
        setPestana(
          typeof valor === "string"
            ? (valor as ClavePestanaContable)
            : "resumen",
        )
      }
      className="gap-3"
    >
      <div className="w-full overflow-x-auto pb-0.5">
        <TabsList className="w-max">
          <TabsTrigger value="resumen">
            <IconHome2 className="size-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="catalogo">
            <IconStack2 className="size-4" />
            Catálogo de cuentas
          </TabsTrigger>
          <TabsTrigger value="balances">
            <IconFileImport className="size-4" />
            Balances iniciales
          </TabsTrigger>
          <TabsTrigger value="diario">
            <IconBook2 className="size-4" />
            Diario
          </TabsTrigger>
          <TabsTrigger value="mayor">
            <IconBook2 className="size-4" />
            Mayor general
          </TabsTrigger>
          <TabsTrigger value="balanza">
            <IconScale className="size-4" />
            Balanza de comprobación
          </TabsTrigger>
          <TabsTrigger value="estados">
            <IconChartPie className="size-4" />
            Estados financieros
          </TabsTrigger>
          <TabsTrigger value="gastos">
            <IconReceipt2 className="size-4" />
            Registrar gastos
          </TabsTrigger>
          <TabsTrigger value="formas-pago">
            <IconCreditCard className="size-4" />
            Formas de pago
          </TabsTrigger>
          <TabsTrigger value="periodos">
            <IconCalendarStats className="size-4" />
            Periodo contable
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="resumen">
        <ResumenContableTab
          totalCuentasActivas={cuentasActivasMovimiento}
          totalBorradores={totalBorradores}
          totalContabilizados={totalContabilizados}
          onIrAPestana={setPestana}
        />
      </TabsContent>

      <TabsContent value="catalogo">
        <CatalogoCuentasTab cuentas={cuentas} />
      </TabsContent>

      <TabsContent value="balances">
        <BalancesInicialesTab
          balances={balancesIniciales}
          periodos={periodos}
          moneda={moneda}
        />
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
          vistaInicial="mayor"
          ocultarSelector
        />
      </TabsContent>

      <TabsContent value="balanza">
        <MayorBalanzaTab
          cuentas={cuentas}
          moneda={moneda}
          empresa={empresaReporte}
          vistaInicial="balanza"
          ocultarSelector
        />
      </TabsContent>

      <TabsContent value="estados">
        <EstadosFinancierosTab moneda={moneda} />
      </TabsContent>

      <TabsContent value="gastos">
        <RegistrarGastosTab />
      </TabsContent>

      <TabsContent value="formas-pago">
        <FormasPagoTab metodos={metodosPago} cuentas={cuentas} />
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
