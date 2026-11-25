import { formatearFecha } from "@/lib/formato";

import type { EmpresaReporte, TablaReporte } from "./exportar/tipos";

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DatosEmpresaReporte {
  nombreComercial: string;
  razonSocial?: string | null;
  rnc?: string | null;
  moneda: EmpresaReporte["moneda"];
}

function textoOpcional(valor: string | null | undefined): string | null {
  const limpio = valor?.trim() ?? "";
  return limpio === "" ? null : limpio;
}

export function crearEmpresaReporte(
  datos: DatosEmpresaReporte,
): EmpresaReporte {
  return {
    nombreComercial: datos.nombreComercial,
    razonSocial: textoOpcional(datos.razonSocial),
    rnc: textoOpcional(datos.rnc),
    moneda: datos.moneda,
  };
}

function fechaLegible(fecha: string): string {
  return formatearFecha(fecha) || fecha;
}

export function describirRangoFechas(desde: string, hasta: string): string {
  const inicio = desde.trim();
  const fin = hasta.trim();

  if (inicio !== "" && fin !== "") {
    return `Del ${fechaLegible(inicio)} al ${fechaLegible(fin)}`;
  }

  if (inicio !== "") return `Desde el ${fechaLegible(inicio)}`;
  if (fin !== "") return `Hasta el ${fechaLegible(fin)}`;
  return "Todos los períodos";
}

export function slugArchivo(texto: string): string {
  const slug = texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  return slug === "" ? "reporte" : slug;
}

function partesFecha(fecha: string): {
  anio: string;
  mes: string;
  dia: string;
} | null {
  const coincidencia = FECHA_ISO.exec(fecha.trim());
  if (!coincidencia) return null;

  const [, anio, mes, dia] = coincidencia;
  if (!anio || !mes || !dia) return null;
  return { anio, mes, dia };
}

function esMesCompleto(desde: string, hasta: string): boolean {
  const inicio = partesFecha(desde);
  const fin = partesFecha(hasta);
  if (!inicio || !fin) return false;
  if (inicio.anio !== fin.anio || inicio.mes !== fin.mes) return false;
  if (inicio.dia !== "01") return false;

  const ultimoDia = new Date(
    Date.UTC(Number(fin.anio), Number(fin.mes), 0),
  ).getUTCDate();

  return Number(fin.dia) === ultimoDia;
}

function sufijoPeriodoArchivo(desde: string, hasta: string): string {
  const inicio = partesFecha(desde);
  const fin = partesFecha(hasta);

  if (inicio && fin) {
    if (esMesCompleto(desde, hasta)) return `${inicio.anio}-${inicio.mes}`;
    return `${desde}-al-${hasta}`;
  }

  if (inicio) return `desde-${desde}`;
  if (fin) return `hasta-${hasta}`;
  return "todos-los-periodos";
}

export function nombreArchivoConPeriodo(
  base: string,
  desde: string,
  hasta: string,
): string {
  return `${slugArchivo(base)}-${sufijoPeriodoArchivo(desde, hasta)}`;
}

export function nombreArchivoConCorte(
  base: string,
  fechaCorte: string,
): string {
  const corte = partesFecha(fechaCorte);
  return `${slugArchivo(base)}-${corte ? fechaCorte : "sin-fecha"}`;
}

function redondearCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export type TipoFilaAgrupadaReporte =
  | "grupo"
  | "detalle"
  | "subtotal"
  | "total";

export interface FilaAgrupadaReporte {
  tipo: TipoFilaAgrupadaReporte;
  codigo: string;
  nombre: string;
  monto: number;
}

export function tablaAgrupadaReporte(entrada: {
  titulo: string;
  subtitulo?: string;
  empresa: EmpresaReporte;
  filas: readonly FilaAgrupadaReporte[];
}): TablaReporte {
  return {
    titulo: entrada.titulo,
    subtitulo: entrada.subtitulo,
    empresa: entrada.empresa,
    columnas: [
      { clave: "codigo", titulo: "Código", tipo: "texto" },
      { clave: "concepto", titulo: "Concepto", tipo: "texto" },
      { clave: "monto", titulo: "Monto", tipo: "dinero" },
    ],
    filas: entrada.filas.map((fila) => ({
      celdas: {
        codigo: fila.tipo === "grupo" ? null : fila.codigo || null,
        concepto: fila.nombre,
        monto: fila.tipo === "grupo" ? null : fila.monto,
      },
      nivel: fila.tipo === "detalle" && fila.codigo !== "" ? 1 : 0,
      estilo: fila.tipo === "detalle" ? "normal" : fila.tipo,
    })),
  };
}

export interface FilaDiarioReporte {
  numero: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  debitos: number;
  creditos: number;
  estado: string;
}

export function tablaLibroDiarioReporte(entrada: {
  subtitulo?: string;
  empresa: EmpresaReporte;
  filas: readonly FilaDiarioReporte[];
}): TablaReporte {
  const totalDebitos = redondearCentavos(
    entrada.filas.reduce((acumulado, fila) => acumulado + fila.debitos, 0),
  );
  const totalCreditos = redondearCentavos(
    entrada.filas.reduce((acumulado, fila) => acumulado + fila.creditos, 0),
  );

  return {
    titulo: "Libro diario",
    subtitulo: entrada.subtitulo,
    empresa: entrada.empresa,
    columnas: [
      { clave: "asiento", titulo: "Asiento", tipo: "texto" },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "descripcion", titulo: "Descripción", tipo: "texto" },
      { clave: "referencia", titulo: "Referencia", tipo: "texto" },
      { clave: "debitos", titulo: "Débitos", tipo: "dinero" },
      { clave: "creditos", titulo: "Créditos", tipo: "dinero" },
      { clave: "estado", titulo: "Estado", tipo: "texto" },
    ],
    filas: [
      ...entrada.filas.map((fila) => ({
        celdas: {
          asiento: fila.numero,
          fecha: fila.fecha,
          descripcion: fila.descripcion,
          referencia: fila.referencia || null,
          debitos: fila.debitos,
          creditos: fila.creditos,
          estado: fila.estado,
        },
      })),
      ...(entrada.filas.length > 0
        ? [
            {
              celdas: {
                asiento: null,
                fecha: null,
                descripcion: "Totales",
                referencia: null,
                debitos: totalDebitos,
                creditos: totalCreditos,
                estado: null,
              },
              estilo: "total" as const,
            },
          ]
        : []),
    ],
  };
}

export interface FilaMayorReporte {
  fecha: string;
  asientoNumero: string;
  referencia: string;
  descripcion: string;
  debito: number;
  credito: number;
  saldo: number;
}

export function tablaLibroMayorReporte(entrada: {
  subtitulo?: string;
  empresa: EmpresaReporte;
  filas: readonly FilaMayorReporte[];
}): TablaReporte {
  return {
    titulo: "Libro mayor",
    subtitulo: entrada.subtitulo,
    empresa: entrada.empresa,
    columnas: [
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "asiento", titulo: "Asiento", tipo: "texto" },
      { clave: "descripcion", titulo: "Descripción", tipo: "texto" },
      { clave: "debito", titulo: "Débito", tipo: "dinero" },
      { clave: "credito", titulo: "Crédito", tipo: "dinero" },
      { clave: "saldo", titulo: "Saldo", tipo: "dinero" },
    ],
    filas: entrada.filas.map((fila) => ({
      celdas: {
        fecha: fila.fecha,
        asiento: fila.asientoNumero,
        descripcion: [fila.descripcion, fila.referencia]
          .filter((parte) => parte !== "")
          .join(" · "),
        debito: fila.debito === 0 ? null : fila.debito,
        credito: fila.credito === 0 ? null : fila.credito,
        saldo: fila.saldo,
      },
    })),
  };
}

export interface FilaBalanzaReporte {
  codigo: string;
  nombre: string;
  saldoAnterior: number;
  debitos: number;
  creditos: number;
  saldoActual: number;
}

export function tablaBalanzaComprobacionReporte(entrada: {
  subtitulo?: string;
  empresa: EmpresaReporte;
  filas: readonly FilaBalanzaReporte[];
}): TablaReporte {
  const totales = entrada.filas.reduce(
    (acumulado, fila) => ({
      saldoAnterior: acumulado.saldoAnterior + fila.saldoAnterior,
      debitos: acumulado.debitos + fila.debitos,
      creditos: acumulado.creditos + fila.creditos,
      saldoActual: acumulado.saldoActual + fila.saldoActual,
    }),
    { saldoAnterior: 0, debitos: 0, creditos: 0, saldoActual: 0 },
  );

  return {
    titulo: "Balanza de comprobación",
    subtitulo: entrada.subtitulo,
    empresa: entrada.empresa,
    columnas: [
      { clave: "codigo", titulo: "Código", tipo: "texto" },
      { clave: "cuenta", titulo: "Cuenta", tipo: "texto" },
      { clave: "saldoAnterior", titulo: "Saldo anterior", tipo: "dinero" },
      { clave: "debitos", titulo: "Débitos", tipo: "dinero" },
      { clave: "creditos", titulo: "Créditos", tipo: "dinero" },
      { clave: "saldoActual", titulo: "Saldo actual", tipo: "dinero" },
    ],
    filas: [
      ...entrada.filas.map((fila) => ({
        celdas: {
          codigo: fila.codigo,
          cuenta: fila.nombre,
          saldoAnterior: fila.saldoAnterior,
          debitos: fila.debitos,
          creditos: fila.creditos,
          saldoActual: fila.saldoActual,
        },
      })),
      ...(entrada.filas.length > 0
        ? [
            {
              celdas: {
                codigo: null,
                cuenta: "Totales",
                saldoAnterior: redondearCentavos(totales.saldoAnterior),
                debitos: redondearCentavos(totales.debitos),
                creditos: redondearCentavos(totales.creditos),
                saldoActual: redondearCentavos(totales.saldoActual),
              },
              estilo: "total" as const,
            },
          ]
        : []),
    ],
  };
}
