"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

import type {
  DocumentoDetalleCompleto,
  DocumentoDetalleDocumento,
} from "@/lib/operaciones/consultas";
import {
  ETIQUETAS_TIPO_DOCUMENTO,
  type TipoDocumentoFinanciero,
} from "@/lib/operaciones/tipos";
import {
  detalleEmpresaReporte,
  formatearDinero,
  formatearFecha,
  formatearFechaHora,
  nombreEmpresaReporte,
} from "./exportar/formato";
import type { EmpresaReporte } from "./exportar/tipos";

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 30,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#172a25",
  },
  encabezado: {
    borderBottomWidth: 1,
    borderBottomColor: "#176b53",
    paddingBottom: 10,
    marginBottom: 12,
  },
  empresa: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#176b53",
    marginBottom: 2,
  },
  detalleEmpresa: {
    fontSize: 7.5,
    color: "#66736d",
    marginBottom: 8,
  },
  titulo: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#172a25",
  },
  subtitulo: {
    fontSize: 8,
    color: "#66736d",
    marginTop: 3,
  },
  seccion: {
    marginBottom: 12,
  },
  tituloSeccion: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#176b53",
    marginBottom: 5,
  },
  tarjeta: {
    borderWidth: 0.6,
    borderColor: "#d9e1dc",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  filaDatos: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dato: {
    paddingRight: 8,
  },
  etiquetaDato: {
    fontSize: 6.8,
    color: "#66736d",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  valorDato: {
    fontSize: 8.4,
    color: "#172a25",
  },
  concepto: {
    borderTopWidth: 0.5,
    borderTopColor: "#e6ebe7",
    paddingTop: 5,
    marginTop: 2,
    fontSize: 8,
    lineHeight: 1.35,
  },
  filaImporte: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.4,
    borderBottomColor: "#e6ebe7",
  },
  filaImporteDestacada: {
    borderTopWidth: 0.8,
    borderTopColor: "#176b53",
    borderBottomWidth: 0,
    marginTop: 2,
    paddingTop: 5,
  },
  etiquetaImporte: {
    fontSize: 8,
    color: "#172a25",
  },
  montoImporte: {
    fontSize: 8,
    textAlign: "right",
    color: "#172a25",
  },
  negrita: {
    fontWeight: "bold",
  },
  tabla: {
    borderWidth: 0.5,
    borderColor: "#d9e1dc",
  },
  filaTabla: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e6ebe7",
  },
  filaEncabezadoTabla: {
    flexDirection: "row",
    backgroundColor: "#176b53",
    borderBottomWidth: 0.5,
    borderBottomColor: "#176b53",
  },
  celda: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 7.4,
    lineHeight: 1.25,
  },
  celdaEncabezado: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#ffffff",
  },
  celdaDerecha: {
    textAlign: "right",
  },
  vacio: {
    borderWidth: 0.5,
    borderColor: "#d9e1dc",
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 7.8,
    color: "#66736d",
  },
  pie: {
    position: "absolute",
    bottom: 16,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#66736d",
  },
});

export interface FilaImporteDocumentoPdf {
  clave: string;
  etiqueta: string;
  monto: number;
  destacada: boolean;
}

function montoNegativo(monto: number): number {
  return monto === 0 ? 0 : -monto;
}

export function filasImportesDocumento(
  documento: DocumentoDetalleDocumento,
): FilaImporteDocumentoPdf[] {
  const filas: FilaImporteDocumentoPdf[] = [
    {
      clave: "subtotal",
      etiqueta: "Subtotal",
      monto: documento.subtotal,
      destacada: false,
    },
    {
      clave: "itbis",
      etiqueta: "ITBIS",
      monto: documento.impuesto,
      destacada: false,
    },
  ];

  if (documento.otrosImpuestos !== 0) {
    filas.push({
      clave: "otros-impuestos",
      etiqueta: "Otros impuestos",
      monto: documento.otrosImpuestos,
      destacada: false,
    });
  }

  filas.push(
    {
      clave: "retencion-isr",
      etiqueta: "Retención ISR",
      monto: montoNegativo(documento.retencionIsr),
      destacada: false,
    },
    {
      clave: "retencion-itbis",
      etiqueta: "Retención ITBIS",
      monto: montoNegativo(documento.retencionItbis),
      destacada: false,
    },
  );

  if (documento.otrasRetenciones !== 0) {
    filas.push({
      clave: "otras-retenciones",
      etiqueta: "Otras retenciones",
      monto: montoNegativo(documento.otrasRetenciones),
      destacada: false,
    });
  }

  filas.push(
    {
      clave: "total",
      etiqueta: "Total del documento",
      monto: documento.total,
      destacada: true,
    },
    {
      clave: "pagos",
      etiqueta: "Pagos aplicados",
      monto: documento.pagado,
      destacada: false,
    },
  );

  if (documento.acreditado !== 0) {
    filas.push({
      clave: "notas-credito",
      etiqueta: "Notas de crédito aplicadas",
      monto: documento.acreditado,
      destacada: false,
    });
  }

  filas.push({
    clave: "saldo",
    etiqueta: "Saldo pendiente",
    monto: documento.saldo,
    destacada: true,
  });

  return filas;
}

const PREFIJO_ARCHIVO: Record<TipoDocumentoFinanciero, string> = {
  sales_invoice: "factura-venta",
  purchase_invoice: "compra",
  sales_credit: "nota-credito-venta",
  purchase_credit: "nota-credito-compra",
};

export function nombreArchivoDocumentoPdf(
  detalle: DocumentoDetalleCompleto,
): string {
  const numero = detalle.documento.numero
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${PREFIJO_ARCHIVO[detalle.documento.tipo]}-${numero === "" ? "documento" : numero}.pdf`;
}

function tipoDocumento(documento: DocumentoDetalleDocumento): string {
  return ETIQUETAS_TIPO_DOCUMENTO[documento.tipo] ?? "Documento";
}

function comprobanteDocumento(documento: DocumentoDetalleDocumento): string {
  if (documento.ncf === "") return "Sin comprobante fiscal";
  const tipo =
    documento.tipoNcf === "" ? documento.ncf.slice(0, 3) : documento.tipoNcf;
  return `${tipo} · ${documento.ncf}`;
}

function Dato({
  etiqueta,
  valor,
  flex = 1,
}: {
  etiqueta: string;
  valor: string;
  flex?: number;
}) {
  return (
    <View style={[estilos.dato, { flexGrow: flex, flexBasis: 0 }]}>
      <Text style={estilos.etiquetaDato}>{etiqueta}</Text>
      <Text style={estilos.valorDato}>{valor}</Text>
    </View>
  );
}

function DocumentoComprobante({
  detalle,
  empresa,
  generadoEn,
}: {
  detalle: DocumentoDetalleCompleto;
  empresa: EmpresaReporte;
  generadoEn: Date;
}) {
  const { documento, tercero, pagos, asiento } = detalle;
  const titulo = `${tipoDocumento(documento)} ${documento.numero}`;
  const nombreEmpresa = nombreEmpresaReporte(empresa);
  const detalleEmpresa = detalleEmpresaReporte(empresa);
  const importes = filasImportesDocumento(documento);
  const totalDebito =
    asiento?.lineas.reduce((total, linea) => total + linea.debito, 0) ?? 0;
  const totalCredito =
    asiento?.lineas.reduce((total, linea) => total + linea.credito, 0) ?? 0;

  return (
    <Document title={titulo} author={nombreEmpresa} creator="Nexo Contable">
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <Text style={estilos.empresa}>{nombreEmpresa}</Text>
          {detalleEmpresa ? (
            <Text style={estilos.detalleEmpresa}>{detalleEmpresa}</Text>
          ) : null}
          <Text style={estilos.titulo}>{titulo}</Text>
          <Text style={estilos.subtitulo}>
            {comprobanteDocumento(documento)} · Generado:{" "}
            {formatearFechaHora(generadoEn)}
          </Text>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Datos del documento</Text>
          <View style={estilos.tarjeta}>
            <View style={estilos.filaDatos}>
              <Dato etiqueta="Número" valor={documento.numero} />
              <Dato
                etiqueta="NCF / e-CF"
                valor={comprobanteDocumento(documento)}
                flex={1.4}
              />
              <Dato etiqueta="Estado" valor={documento.estadoEtiqueta} />
            </View>
            <View style={estilos.filaDatos}>
              <Dato
                etiqueta="Emisión"
                valor={formatearFecha(documento.fechaEmision)}
              />
              <Dato
                etiqueta="Vencimiento"
                valor={
                  documento.fechaVencimiento === null
                    ? "—"
                    : formatearFecha(documento.fechaVencimiento)
                }
              />
              <Dato
                etiqueta="Tipo"
                valor={tipoDocumento(documento)}
                flex={1.4}
              />
            </View>
            <Text style={estilos.concepto}>{documento.concepto}</Text>
          </View>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Tercero</Text>
          <View style={estilos.tarjeta}>
            <View style={estilos.filaDatos}>
              <Dato etiqueta="Nombre" valor={tercero.nombre} flex={1.8} />
              <Dato
                etiqueta="RNC"
                valor={tercero.rnc === "" ? "—" : tercero.rnc}
              />
              <Dato etiqueta="Tipo" valor={tercero.tipoEtiqueta} />
            </View>
          </View>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Importes</Text>
          <View style={estilos.tarjeta}>
            {importes.map((fila) => (
              <View
                key={fila.clave}
                style={[
                  estilos.filaImporte,
                  fila.destacada ? estilos.filaImporteDestacada : undefined,
                ]}
                wrap={false}
              >
                <Text
                  style={[
                    estilos.etiquetaImporte,
                    fila.destacada ? estilos.negrita : undefined,
                  ]}
                >
                  {fila.etiqueta}
                </Text>
                <Text
                  style={[
                    estilos.montoImporte,
                    fila.destacada ? estilos.negrita : undefined,
                  ]}
                >
                  {formatearDinero(fila.monto, empresa.moneda)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Pagos aplicados</Text>
          {pagos.length === 0 ? (
            <Text style={estilos.vacio}>Sin pagos aplicados.</Text>
          ) : (
            <View style={estilos.tabla}>
              <View style={estilos.filaEncabezadoTabla} fixed>
                <Text style={[estilos.celdaEncabezado, { width: "22%" }]}>
                  Fecha
                </Text>
                <Text style={[estilos.celdaEncabezado, { width: "30%" }]}>
                  Método
                </Text>
                <Text style={[estilos.celdaEncabezado, { width: "26%" }]}>
                  Referencia
                </Text>
                <Text
                  style={[
                    estilos.celdaEncabezado,
                    estilos.celdaDerecha,
                    { width: "22%" },
                  ]}
                >
                  Monto
                </Text>
              </View>
              {pagos.map((pago) => (
                <View key={pago.id} style={estilos.filaTabla} wrap={false}>
                  <Text style={[estilos.celda, { width: "22%" }]}>
                    {formatearFecha(pago.fechaPago)}
                  </Text>
                  <Text style={[estilos.celda, { width: "30%" }]}>
                    {pago.metodoPago || "—"}
                  </Text>
                  <Text style={[estilos.celda, { width: "26%" }]}>
                    {pago.referencia || "—"}
                  </Text>
                  <Text
                    style={[
                      estilos.celda,
                      estilos.celdaDerecha,
                      { width: "22%" },
                    ]}
                  >
                    {formatearDinero(pago.monto, empresa.moneda)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Asiento contable generado</Text>
          {asiento === null ? (
            <Text style={estilos.vacio}>
              El documento no tiene asiento contable vinculado.
            </Text>
          ) : (
            <>
              <View style={[estilos.tarjeta, { marginBottom: 6 }]}>
                <View style={estilos.filaDatos}>
                  <Dato etiqueta="Asiento" valor={asiento.numero} />
                  <Dato
                    etiqueta="Fecha"
                    valor={formatearFecha(asiento.fecha)}
                  />
                  <Dato etiqueta="Estado" valor={asiento.estadoEtiqueta} />
                </View>
                <Text style={estilos.concepto}>{asiento.descripcion}</Text>
              </View>
              <View style={estilos.tabla}>
                <View style={estilos.filaEncabezadoTabla} fixed>
                  <Text style={[estilos.celdaEncabezado, { width: "30%" }]}>
                    Cuenta
                  </Text>
                  <Text style={[estilos.celdaEncabezado, { width: "38%" }]}>
                    Descripción
                  </Text>
                  <Text
                    style={[
                      estilos.celdaEncabezado,
                      estilos.celdaDerecha,
                      { width: "16%" },
                    ]}
                  >
                    Débito
                  </Text>
                  <Text
                    style={[
                      estilos.celdaEncabezado,
                      estilos.celdaDerecha,
                      { width: "16%" },
                    ]}
                  >
                    Crédito
                  </Text>
                </View>
                {asiento.lineas.map((linea) => (
                  <View key={linea.id} style={estilos.filaTabla} wrap={false}>
                    <Text style={[estilos.celda, { width: "30%" }]}>
                      {linea.cuentaCodigo} · {linea.cuentaNombre}
                    </Text>
                    <Text style={[estilos.celda, { width: "38%" }]}>
                      {linea.descripcion || "—"}
                    </Text>
                    <Text
                      style={[
                        estilos.celda,
                        estilos.celdaDerecha,
                        { width: "16%" },
                      ]}
                    >
                      {linea.debito === 0
                        ? "—"
                        : formatearDinero(linea.debito, empresa.moneda)}
                    </Text>
                    <Text
                      style={[
                        estilos.celda,
                        estilos.celdaDerecha,
                        { width: "16%" },
                      ]}
                    >
                      {linea.credito === 0
                        ? "—"
                        : formatearDinero(linea.credito, empresa.moneda)}
                    </Text>
                  </View>
                ))}
                <View style={estilos.filaTabla} wrap={false}>
                  <Text
                    style={[estilos.celda, estilos.negrita, { width: "30%" }]}
                  >
                    Totales
                  </Text>
                  <Text style={[estilos.celda, { width: "38%" }]}> </Text>
                  <Text
                    style={[
                      estilos.celda,
                      estilos.celdaDerecha,
                      estilos.negrita,
                      { width: "16%" },
                    ]}
                  >
                    {formatearDinero(totalDebito, empresa.moneda)}
                  </Text>
                  <Text
                    style={[
                      estilos.celda,
                      estilos.celdaDerecha,
                      estilos.negrita,
                      { width: "16%" },
                    ]}
                  >
                    {formatearDinero(totalCredito, empresa.moneda)}
                  </Text>
                </View>
              </View>
            </>
          )}
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

export async function documentoAPdf(
  detalle: DocumentoDetalleCompleto,
  empresa: EmpresaReporte,
  generadoEn: Date = new Date(),
): Promise<Blob> {
  return pdf(
    <DocumentoComprobante
      detalle={detalle}
      empresa={empresa}
      generadoEn={generadoEn}
    />,
  ).toBlob();
}
