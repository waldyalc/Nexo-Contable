"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

import {
  detalleEmpresaReporte,
  formatearFechaHora,
  nombreEmpresaReporte,
  textoCelda,
} from "./formato";
import type {
  ColumnaReporte,
  EmpresaReporte,
  FilaReporte,
  TablaReporte,
} from "./tipos";

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#172a25",
  },
  encabezado: {
    borderBottomWidth: 1,
    borderBottomColor: "#e6ebe7",
    paddingBottom: 10,
    marginBottom: 12,
  },
  empresa: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#176b53",
    marginBottom: 2,
  },
  detalleEmpresa: {
    fontSize: 7.5,
    color: "#66736d",
    marginBottom: 7,
  },
  titulo: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#172a25",
  },
  subtitulo: {
    fontSize: 8,
    color: "#66736d",
    marginTop: 3,
  },
  generado: {
    fontSize: 7,
    color: "#66736d",
    marginTop: 3,
  },
  tabla: {
    borderWidth: 0.5,
    borderColor: "#e6ebe7",
  },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: "#176b53",
    borderBottomWidth: 0.5,
    borderBottomColor: "#176b53",
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e6ebe7",
  },
  filaGrupo: {
    backgroundColor: "#e8f4ee",
  },
  filaTotal: {
    borderTopWidth: 1,
    borderTopColor: "#176b53",
  },
  celda: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7.5,
    lineHeight: 1.2,
  },
  celdaEncabezado: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#ffffff",
  },
  celdaDerecha: {
    textAlign: "right",
  },
  negrita: {
    fontWeight: "bold",
  },
  pie: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#66736d",
  },
});

function esColumnaNumerica(columna: ColumnaReporte): boolean {
  return columna.tipo === "dinero" || columna.tipo === "porcentaje";
}

function pesoColumna(columna: ColumnaReporte, indice: number): number {
  if (indice === 0) return 2.3;
  if (columna.tipo === "dinero") return 1.35;
  if (columna.tipo === "fecha" || columna.tipo === "porcentaje") return 1.1;
  return 1;
}

function esFilaDestacada(fila: FilaReporte): boolean {
  return (
    fila.estilo === "grupo" ||
    fila.estilo === "subtotal" ||
    fila.estilo === "total"
  );
}

function Fila({
  fila,
  columnas,
  moneda,
}: {
  fila: FilaReporte;
  columnas: readonly ColumnaReporte[];
  moneda: EmpresaReporte["moneda"];
}) {
  return (
    <View
      style={[
        estilos.fila,
        fila.estilo === "grupo" ? estilos.filaGrupo : undefined,
        fila.estilo === "total" ? estilos.filaTotal : undefined,
      ]}
      wrap={false}
    >
      {columnas.map((columna, indice) => (
        <Text
          key={columna.clave}
          style={[
            estilos.celda,
            esColumnaNumerica(columna) ? estilos.celdaDerecha : undefined,
            esFilaDestacada(fila) ? estilos.negrita : undefined,
            { flexGrow: pesoColumna(columna, indice), flexBasis: 0 },
            indice === 0 && fila.nivel != null && fila.nivel > 0
              ? { paddingLeft: 4 + fila.nivel * 10 }
              : undefined,
          ]}
        >
          {textoCelda(fila.celdas[columna.clave] ?? null, columna.tipo, moneda)}
        </Text>
      ))}
    </View>
  );
}

interface EntradaFila {
  id: string;
  fila: FilaReporte;
}

function prepararFilas(filas: readonly FilaReporte[]): EntradaFila[] {
  const repetidos = new Map<string, number>();

  return filas.map((fila) => {
    const huella = JSON.stringify({
      celdas: fila.celdas,
      estilo: fila.estilo ?? "normal",
      nivel: fila.nivel ?? 0,
    });
    const repeticion = (repetidos.get(huella) ?? 0) + 1;
    repetidos.set(huella, repeticion);

    return { id: `${huella}|${repeticion}`, fila };
  });
}

interface DocumentoProps {
  tabla: TablaReporte;
  generadoEn: Date;
}

function Documento({ tabla, generadoEn }: DocumentoProps) {
  const horizontal = tabla.columnas.length > 6;
  const nombreEmpresa = nombreEmpresaReporte(tabla.empresa);
  const detalleEmpresa = detalleEmpresaReporte(tabla.empresa);
  const filas = prepararFilas(tabla.filas);

  return (
    <Document
      title={tabla.titulo}
      author={nombreEmpresa}
      creator="Nexo Contable"
    >
      <Page
        size="A4"
        orientation={horizontal ? "landscape" : "portrait"}
        style={estilos.pagina}
      >
        <View style={estilos.encabezado}>
          <Text style={estilos.empresa}>{nombreEmpresa}</Text>
          {detalleEmpresa ? (
            <Text style={estilos.detalleEmpresa}>{detalleEmpresa}</Text>
          ) : null}
          <Text style={estilos.titulo}>{tabla.titulo}</Text>
          {tabla.subtitulo ? (
            <Text style={estilos.subtitulo}>{tabla.subtitulo}</Text>
          ) : null}
          <Text style={estilos.generado}>
            Generado: {formatearFechaHora(generadoEn)}
          </Text>
        </View>

        <View style={estilos.tabla}>
          <View style={estilos.filaEncabezado} fixed>
            {tabla.columnas.map((columna, indice) => (
              <Text
                key={columna.clave}
                style={[
                  estilos.celdaEncabezado,
                  esColumnaNumerica(columna) ? estilos.celdaDerecha : undefined,
                  { flexGrow: pesoColumna(columna, indice), flexBasis: 0 },
                ]}
              >
                {columna.titulo}
              </Text>
            ))}
          </View>

          {filas.map((entrada) => (
            <Fila
              key={entrada.id}
              fila={entrada.fila}
              columnas={tabla.columnas}
              moneda={tabla.empresa.moneda}
            />
          ))}
        </View>

        <View fixed style={estilos.pie}>
          <Text>Generado por Nexo Contable</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function tablaAPdf(
  tabla: TablaReporte,
  generadoEn: Date = new Date(),
): Promise<Blob> {
  return pdf(<Documento tabla={tabla} generadoEn={generadoEn} />).toBlob();
}
