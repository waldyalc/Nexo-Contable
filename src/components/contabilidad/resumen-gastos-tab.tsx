"use client";

import {
  IconArrowRight,
  IconBook2,
  IconChartPie,
  IconClipboardList,
  IconReportMoney,
  IconScale,
} from "@tabler/icons-react";
import Link from "next/link";

import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { Button } from "@/components/ui/button";

export type ClavePestanaContable =
  | "resumen"
  | "catalogo"
  | "balances"
  | "diario"
  | "mayor"
  | "balanza"
  | "estados"
  | "gastos"
  | "formas-pago"
  | "periodos";

interface MetricaResumenProps {
  icono: React.ReactNode;
  titulo: string;
  total: number;
  descripcion: string;
  ruta?: string;
  pestana?: ClavePestanaContable;
  etiqueta: string;
  onIrAPestana?: (pestana: ClavePestanaContable) => void;
}

function MetricaResumen({
  icono,
  titulo,
  total,
  descripcion,
  ruta,
  pestana,
  etiqueta,
  onIrAPestana,
}: MetricaResumenProps) {
  const accion =
    pestana && onIrAPestana ? (
      <Button variant="outline" onClick={() => onIrAPestana(pestana)}>
        {etiqueta}
        <IconArrowRight className="size-4" />
      </Button>
    ) : ruta ? (
      <Button render={<Link href={ruta} prefetch={false} />} variant="outline">
        {etiqueta}
        <IconArrowRight className="size-4" />
      </Button>
    ) : null;

  return (
    <div className="flex min-h-40 flex-col justify-between gap-4 rounded-[12px] border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
          <p className="font-display text-3xl font-semibold tabular-nums text-foreground">
            {total}
          </p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-[10px] bg-secondary text-primary">
          {icono}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{descripcion}</p>
        <div>{accion}</div>
      </div>
    </div>
  );
}

export interface ResumenContableTabProps {
  totalCuentasActivas: number;
  totalBorradores: number;
  totalContabilizados: number;
  onIrAPestana: (pestana: ClavePestanaContable) => void;
}

export function ResumenContableTab({
  totalCuentasActivas,
  totalBorradores,
  totalContabilizados,
  onIrAPestana,
}: ResumenContableTabProps) {
  return (
    <TarjetaLista className="p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-semibold text-foreground">
          Resumen contable
        </h2>
        <p className="text-sm text-muted-foreground">
          Estado operativo del libro mayor de la empresa activa, igual que en el
          sistema original.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricaResumen
          icono={<IconBook2 className="size-5" />}
          titulo="Cuentas activas de movimiento"
          total={totalCuentasActivas}
          descripcion="Cuentas de detalle disponibles para registrar operaciones."
          pestana="catalogo"
          etiqueta="Ver catálogo"
          onIrAPestana={onIrAPestana}
        />
        <MetricaResumen
          icono={<IconClipboardList className="size-5" />}
          titulo="Asientos borrador"
          total={totalBorradores}
          descripcion="Borradores pendientes de revisar y contabilizar."
          pestana="diario"
          etiqueta="Revisar diario"
          onIrAPestana={onIrAPestana}
        />
        <MetricaResumen
          icono={<IconScale className="size-5" />}
          titulo="Asientos contabilizados"
          total={totalContabilizados}
          descripcion="Movimientos que alimentan el mayor, la balanza y los estados."
          pestana="balanza"
          etiqueta="Ver balanza"
          onIrAPestana={onIrAPestana}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricaResumen
          icono={<IconChartPie className="size-5" />}
          titulo="Estados financieros"
          total={4}
          descripcion="Resultados, situación financiera, flujo y cambios en patrimonio."
          pestana="estados"
          etiqueta="Consultar estados"
          onIrAPestana={onIrAPestana}
        />
        <MetricaResumen
          icono={<IconReportMoney className="size-5" />}
          titulo="Gastos y compras"
          total={1}
          descripcion="El registro operativo de gastos vive en su módulo para preservar documentos fiscales, inventario y CxP."
          ruta="/gastos"
          etiqueta="Ir a gastos"
        />
      </div>
    </TarjetaLista>
  );
}

export function RegistrarGastosTab() {
  return (
    <TarjetaLista className="p-4">
      <div className="flex max-w-3xl flex-col gap-4">
        <div className="flex size-11 items-center justify-center rounded-[10px] bg-secondary text-primary">
          <IconReportMoney className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-base font-semibold text-foreground">
            Registrar gastos
          </h2>
          <p className="text-sm text-muted-foreground">
            Al igual que el sistema original, esta pestaña es un acceso directo
            al módulo operativo de Gastos y compras. Ahí se registran facturas
            de gasto, pagos, formas de pago e ITBIS con el motor fiscal
            completo.
          </p>
        </div>
        <div>
          <Button render={<Link href="/gastos" prefetch={false} />}>
            Ir a Gastos y compras
            <IconArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </TarjetaLista>
  );
}
