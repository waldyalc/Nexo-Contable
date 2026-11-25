"use client";

import {
  IconBan,
  IconDots,
  IconEye,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconWallet,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { MonthPicker } from "@/components/month-picker";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { estadoDocumentoCartera } from "@/lib/cartera/utilidades";
import {
  formatearFecha,
  formatearMoneda,
  formatearRnc,
  normalizarRnc,
} from "@/lib/formato";
import type { DocumentoListado } from "@/lib/operaciones/tipos";

const OPCIONES_ESTADO = [
  { value: "contabilizada", label: "Contabilizada" },
  { value: "saldada", label: "Saldada" },
  { value: "pendiente", label: "Pendiente" },
  { value: "vencida", label: "Vencida" },
  { value: "anulada", label: "Anulada" },
  { value: "borrador", label: "Borrador" },
];

function esNotaCredito(documento: DocumentoListado): boolean {
  return (
    documento.tipo === "sales_credit" || documento.tipo === "purchase_credit"
  );
}

export interface DocumentosCarteraTabProps {
  tipo: "cxc" | "cxp";
  documentos: readonly DocumentoListado[];
  rncPorTercero: Readonly<Record<string, string>>;
  moneda: "DOP" | "USD";
  esNotas: boolean;
  onVerDetalle: (documento: DocumentoListado) => void;
  onRegistrarPago: (documento: DocumentoListado) => void;
  onAnularDocumento: (documento: DocumentoListado) => void;
  onCrearDocumento: () => void;
}

/** Lista restaurada de facturas o notas de crédito del ciclo CxC/CxP. */
export function DocumentosCarteraTab({
  tipo,
  documentos,
  rncPorTercero,
  moneda,
  esNotas,
  onVerDetalle,
  onRegistrarPago,
  onAnularDocumento,
  onCrearDocumento,
}: DocumentosCarteraTabProps) {
  const esCobrar = tipo === "cxc";
  const [mes, setMes] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const digitos = normalizarRnc(termino);

    return documentos.filter((documento) => {
      if (mes !== "" && documento.fechaEmision.slice(0, 7) !== mes) {
        return false;
      }

      const estado = estadoDocumentoCartera(documento).clave;
      if (estadoFiltro === "contabilizada" && documento.estado !== "posted") {
        return false;
      }
      if (
        estadoFiltro !== "" &&
        estadoFiltro !== "contabilizada" &&
        estado !== estadoFiltro
      ) {
        return false;
      }

      if (termino === "") return true;

      const rnc = normalizarRnc(rncPorTercero[documento.terceroId] ?? "");
      return (
        documento.numero.toLowerCase().includes(termino) ||
        documento.ncf.toLowerCase().includes(termino) ||
        documento.tercero.toLowerCase().includes(termino) ||
        documento.concepto.toLowerCase().includes(termino) ||
        (digitos !== "" && rnc.includes(digitos))
      );
    });
  }, [documentos, mes, busqueda, estadoFiltro, rncPorTercero]);

  const totalFiltrado = filtrados
    .filter((documento) => documento.estado === "posted")
    .reduce((total, documento) => total + documento.total, 0);
  const etiquetaTercero = esCobrar ? "Cliente" : "Suplidor";
  const titulo = esNotas
    ? "Notas de crédito"
    : esCobrar
      ? "Facturas"
      : "Facturas proveedor";
  const etiquetaEntidad = esNotas ? "notas" : "facturas";

  return (
    <TarjetaLista data-lista={esNotas ? "notas-credito" : "facturas-cartera"}>
      <BarraLista
        titulo={titulo}
        descripcion={`${filtrados.length} de ${documentos.length} ${etiquetaEntidad} · ${formatearMoneda(totalFiltrado, moneda)}`}
        filtros={
          <>
            <MonthPicker
              value={mes}
              onChange={setMes}
              permitirLimpiar
              placeholder="Mes de emisión"
              className="w-[190px]"
            />
            <div className="relative w-full sm:max-w-xs">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder={`Buscar por número, NCF, ${esCobrar ? "cliente" : "suplidor"}…`}
                aria-label={`Buscar ${titulo.toLowerCase()}`}
                className="h-9 pl-8"
              />
            </div>
            <SelectCampo
              id={esNotas ? "cartera-estado-notas" : "cartera-estado-facturas"}
              opciones={OPCIONES_ESTADO}
              valor={estadoFiltro}
              onCambio={setEstadoFiltro}
              etiquetaVacia="Todas"
              className="w-[170px]"
              aria-label="Filtrar por estado"
            />
          </>
        }
      >
        <TablaLista<DocumentoListado>
          filas={filtrados}
          claveFila={(documento) => documento.id}
          ordenable
          paginacion={{ tamanoPagina: 15, etiqueta: etiquetaEntidad }}
          vacio={{
            titulo: esNotas
              ? "Sin notas de crédito"
              : "Sin facturas registradas",
            descripcion:
              "Registra una operación desde los botones superiores o amplía los filtros.",
            icono: <IconReceipt2 className="size-8" />,
            accion: (
              <Button variant="outline" onClick={onCrearDocumento}>
                <IconPlus className="size-4" />
                {esNotas ? "Nueva nota de crédito" : "Nueva factura"}
              </Button>
            ),
          }}
          columnas={[
            {
              clave: "documento",
              encabezado: "Documento",
              celda: (documento) => {
                const credito = esNotaCredito(documento);
                const tipoEtiqueta = credito ? "Nota de crédito" : "Factura";
                return (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {documento.numero}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {documento.ncf === "" ? "Sin NCF" : documento.ncf} ·{" "}
                      {tipoEtiqueta}
                    </span>
                    <span className="truncate text-xs text-muted-foreground/80">
                      {documento.concepto}
                      {documento.documentoAcreditadoId !== null
                        ? " · Nota vinculada"
                        : ""}
                    </span>
                  </div>
                );
              },
            },
            {
              clave: "tercero",
              encabezado: "Tercero",
              celda: (documento) => {
                const rnc = formatearRnc(
                  rncPorTercero[documento.terceroId] ?? "",
                );
                return (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {documento.tercero}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {etiquetaTercero} · {rnc === "" ? "Sin RNC" : rnc}
                    </span>
                  </div>
                );
              },
            },
            {
              clave: "fecha",
              encabezado: "Fecha / vencimiento",
              celda: (documento) => (
                <div className="flex min-w-0 flex-col">
                  <span>{formatearFecha(documento.fechaEmision)}</span>
                  <span className="text-xs text-muted-foreground">
                    Vence{" "}
                    {documento.fechaVencimiento
                      ? formatearFecha(documento.fechaVencimiento)
                      : "—"}
                  </span>
                </div>
              ),
            },
            {
              clave: "total",
              encabezado: "Total",
              alineacion: "derecha",
              celda: (documento) => formatearMoneda(documento.total, moneda),
            },
            {
              clave: "retenciones",
              encabezado: "Retenciones",
              alineacion: "derecha",
              celda: (documento) =>
                formatearMoneda(documento.retenciones, moneda),
            },
            {
              clave: "saldo",
              encabezado: "Saldo",
              alineacion: "derecha",
              celda: (documento) => (
                <span className="font-medium">
                  {formatearMoneda(documento.saldo, moneda)}
                </span>
              ),
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (documento) => {
                const estado = estadoDocumentoCartera(documento);
                return (
                  <PillEstado estado={estado.clave}>
                    {estado.etiqueta}
                  </PillEstado>
                );
              },
            },
            {
              clave: "acciones",
              encabezado: "",
              ordenable: false,
              alineacion: "derecha",
              celda: (documento) => {
                const credito = esNotaCredito(documento);
                const puedeRegistrarPago =
                  !credito &&
                  documento.estado === "posted" &&
                  documento.saldo > 0;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${documento.numero}`}
                        />
                      }
                    >
                      <IconDots className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => onVerDetalle(documento)}>
                        <IconEye className="size-4" />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!puedeRegistrarPago}
                        onClick={() => onRegistrarPago(documento)}
                      >
                        <IconWallet className="size-4" />
                        {esCobrar ? "Registrar cobro" : "Registrar pago"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={documento.estado !== "posted"}
                        onClick={() => onAnularDocumento(documento)}
                      >
                        <IconBan className="size-4" />
                        Anular documento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              },
            },
          ]}
        />
      </BarraLista>
    </TarjetaLista>
  );
}
