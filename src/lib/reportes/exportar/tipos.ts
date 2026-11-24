export type TipoColumna = "texto" | "dinero" | "porcentaje" | "fecha";

export type EstiloFila = "normal" | "grupo" | "subtotal" | "total";

export type ValorCelda = string | number | null;

export interface ColumnaReporte {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
  grupo?: string;
}

export interface FilaReporte {
  celdas: Record<string, ValorCelda>;
  nivel?: number;
  estilo?: EstiloFila;
}

export interface EmpresaReporte {
  nombreComercial: string;
  razonSocial: string | null;
  rnc: string | null;
  moneda: "DOP" | "USD";
}

export interface TablaReporte {
  titulo: string;
  subtitulo?: string;
  empresa: EmpresaReporte;
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
}
