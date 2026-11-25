import { formatearFecha, formatearRnc } from "@/lib/formato";
import type { SaldoAntiguedad } from "@/lib/operaciones/tipos";

import type {
  ColumnaReporte,
  EmpresaReporte,
  FilaReporte,
  TablaReporte,
} from "./exportar/tipos";

export type TipoCartera = "cxc" | "cxp";

export interface EntradaAntiguedadCartera {
  tipo: TipoCartera;
  fechaCorte: string;
  saldos: readonly SaldoAntiguedad[];
  rncPorTercero: Readonly<Record<string, string>>;
  empresa: EmpresaReporte;
}

const COLUMNAS_ANTIGUEDAD: ColumnaReporte[] = [
  { clave: "tercero", titulo: "Tercero", tipo: "texto" },
  { clave: "rnc", titulo: "RNC", tipo: "texto" },
  { clave: "documento", titulo: "Documento", tipo: "texto" },
  { clave: "emision", titulo: "Emisión", tipo: "fecha" },
  { clave: "vencimiento", titulo: "Vence", tipo: "fecha" },
  { clave: "dias", titulo: "Días vencido", tipo: "texto" },
  { clave: "corriente", titulo: "Corriente", tipo: "dinero" },
  { clave: "1_30", titulo: "1–30 días", tipo: "dinero" },
  { clave: "31_60", titulo: "31–60 días", tipo: "dinero" },
  { clave: "61_90", titulo: "61–90 días", tipo: "dinero" },
  { clave: "mas_90", titulo: ">90 días", tipo: "dinero" },
  { clave: "saldo", titulo: "Saldo pendiente", tipo: "dinero" },
];

function columnasAntiguedad(tipo: TipoCartera): ColumnaReporte[] {
  return COLUMNAS_ANTIGUEDAD.map((columna) =>
    columna.clave === "tercero"
      ? { ...columna, titulo: tipo === "cxc" ? "Cliente" : "Proveedor" }
      : columna,
  );
}

function montoBucket(saldo: SaldoAntiguedad, bucket: string): number | null {
  return saldo.bucket === bucket ? saldo.saldo : null;
}

function celdasBuckets(saldo: SaldoAntiguedad): Record<string, number | null> {
  return {
    corriente: montoBucket(saldo, "corriente"),
    "1_30": montoBucket(saldo, "1_30"),
    "31_60": montoBucket(saldo, "31_60"),
    "61_90": montoBucket(saldo, "61_90"),
    mas_90: montoBucket(saldo, "mas_90"),
  };
}

export function adaptarAntiguedadCartera({
  tipo,
  fechaCorte,
  saldos,
  rncPorTercero,
  empresa,
}: EntradaAntiguedadCartera): TablaReporte {
  const totales = {
    corriente: 0,
    "1_30": 0,
    "31_60": 0,
    "61_90": 0,
    mas_90: 0,
    saldo: 0,
  };

  const filas: FilaReporte[] = saldos.map((saldo) => {
    totales.saldo += saldo.saldo;

    const buckets = celdasBuckets(saldo);
    totales.corriente += buckets.corriente ?? 0;
    totales["1_30"] += buckets["1_30"] ?? 0;
    totales["31_60"] += buckets["31_60"] ?? 0;
    totales["61_90"] += buckets["61_90"] ?? 0;
    totales.mas_90 += buckets.mas_90 ?? 0;

    const rnc = rncPorTercero[saldo.terceroId] ?? "";

    return {
      celdas: {
        tercero: saldo.tercero,
        rnc: rnc === "" ? null : formatearRnc(rnc),
        documento: saldo.numero,
        emision: saldo.fechaEmision,
        vencimiento: saldo.fechaVencimiento,
        dias: saldo.diasVencido,
        ...buckets,
        saldo: saldo.saldo,
      },
    };
  });

  filas.push({
    celdas: {
      tercero: "Total general",
      rnc: null,
      documento: null,
      emision: null,
      vencimiento: null,
      dias: null,
      corriente: totales.corriente,
      "1_30": totales["1_30"],
      "31_60": totales["31_60"],
      "61_90": totales["61_90"],
      mas_90: totales.mas_90,
      saldo: totales.saldo,
    },
    estilo: "total",
  });

  return {
    titulo:
      tipo === "cxc"
        ? "Antigüedad de saldos — Cuentas por cobrar"
        : "Antigüedad de saldos — Cuentas por pagar",
    subtitulo: `Al ${formatearFecha(fechaCorte)}`,
    empresa,
    columnas: columnasAntiguedad(tipo),
    filas,
  };
}
