"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { type Moneda, aNumero, formatearMoneda } from "@/lib/formato";

export interface PuntoIngresoGasto {
  periodo: string;
  ingresos: number;
  gastos: number;
}

export interface GraficoIngresosGastosProps {
  datos: readonly PuntoIngresoGasto[];
  moneda?: Moneda;
}

const formatoCompacto = new Intl.NumberFormat("es-DO", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Barras comparativas de ingresos y gastos por mes con la paleta de Nexo:
 * verde bosque para ingresos y ámbar para gastos/compras.
 */
export function GraficoIngresosGastos({
  datos,
  moneda = "DOP",
}: GraficoIngresosGastosProps) {
  if (datos.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-muted-foreground">
        Aún no hay movimientos para graficar.
      </div>
    );
  }

  return (
    <div className="h-64 w-full" aria-label="Ingresos y gastos por mes">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[...datos]}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barGap={4}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="periodo"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(valor: number) => formatoCompacto.format(valor)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(valor: unknown) =>
              formatearMoneda(
                typeof valor === "number" ? valor : aNumero(String(valor)),
                moneda,
              )
            }
            labelStyle={{
              color: "var(--foreground)",
              fontSize: 12,
              fontWeight: 600,
            }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Bar
            dataKey="ingresos"
            name="Ingresos"
            fill="#176b53"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="gastos"
            name="Gastos y compras"
            fill="#d39c48"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
