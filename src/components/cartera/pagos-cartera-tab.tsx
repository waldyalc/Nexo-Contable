"use client";

import {
  IconBan,
  IconDots,
  IconEye,
  IconReceipt2,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { PagoCarteraListado } from "@/lib/cartera/utilidades";
import {
  formatearFecha,
  formatearMoneda,
  formatearRnc,
  normalizarRnc,
} from "@/lib/formato";
import type { DocumentoListado, PagoListado } from "@/lib/operaciones/tipos";

const OPCIONES_ESTADO_PAGO = [
  { value: "active", label: "Activos" },
  { value: "cancelled", label: "Cancelados" },
];

export interface PagosCarteraTabProps {
  tipo: "cxc" | "cxp";
  pagos: readonly PagoCarteraListado[];
  moneda: "DOP" | "USD";
  onVerDocumento: (documento: DocumentoListado) => void;
  onAnularPago: (pago: PagoListado) => void;
}

/** Movimientos de cobro/pago restaurados con documento, tercero y estado. */
export function PagosCarteraTab({
  tipo,
  pagos,
  moneda,
  onVerDocumento,
  onAnularPago,
}: PagosCarteraTabProps) {
  const esCobrar = tipo === "cxc";
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const digitos = normalizarRnc(termino);

    return pagos.filter((pago) => {
      if (estadoFiltro !== "" && pago.estado !== estadoFiltro) return false;
      if (termino === "") return true;

      return (
        pago.documento.numero.toLowerCase().includes(termino) ||
        pago.documento.ncf.toLowerCase().includes(termino) ||
        pago.documento.tercero.toLowerCase().includes(termino) ||
        pago.metodoPago.toLowerCase().includes(termino) ||
        pago.referencia.toLowerCase().includes(termino) ||
        (digitos !== "" && normalizarRnc(pago.terceroRnc).includes(digitos))
      );
    });
  }, [pagos, busqueda, estadoFiltro]);

  const totalActivo = filtrados
    .filter((pago) => pago.estado === "active")
    .reduce((total, pago) => total + pago.monto, 0);
  const titulo = esCobrar ? "Cobros" : "Pagos";

  return (
    <TarjetaLista data-lista="pagos-cartera">
      <BarraLista
        titulo={titulo}
        descripcion={`${filtrados.length} de ${pagos.length} movimientos · activos ${formatearMoneda(totalActivo, moneda)}`}
        filtros={
          <>
            <div className="relative w-full sm:max-w-xs">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar documento, tercero, método o referencia…"
                aria-label={`Buscar ${titulo.toLowerCase()}`}
                className="h-9 pl-8"
              />
            </div>
            <SelectCampo
              id="cartera-estado-pagos"
              opciones={OPCIONES_ESTADO_PAGO}
              valor={estadoFiltro}
              onCambio={setEstadoFiltro}
              etiquetaVacia="Todos"
              className="w-[160px]"
              aria-label="Filtrar por estado de pago"
            />
          </>
        }
      >
        <TablaLista<PagoCarteraListado>
          filas={filtrados}
          claveFila={(pago) => pago.id}
          ordenable
          paginacion={{
            tamanoPagina: 15,
            etiqueta: esCobrar ? "cobros" : "pagos",
          }}
          vacio={{
            titulo: "Sin movimientos de pago",
            descripcion:
              "Los cobros o pagos aparecen aquí al aplicarlos a una factura.",
            icono: <IconReceipt2 className="size-8" />,
          }}
          columnas={[
            {
              clave: "fecha",
              encabezado: "Fecha",
              celda: (pago) => formatearFecha(pago.fechaPago),
            },
            {
              clave: "documento",
              encabezado: "Documento",
              celda: (pago) => (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">
                    {pago.documento.numero}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {pago.documento.ncf === "" ? "Sin NCF" : pago.documento.ncf}
                  </span>
                </div>
              ),
            },
            {
              clave: "tercero",
              encabezado: "Tercero",
              celda: (pago) => {
                const rnc = formatearRnc(pago.terceroRnc);
                return (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {pago.documento.tercero}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {rnc === "" ? "Sin RNC" : rnc}
                    </span>
                  </div>
                );
              },
            },
            {
              clave: "metodo",
              encabezado: "Método",
              celda: (pago) => pago.metodoPago,
            },
            {
              clave: "referencia",
              encabezado: "Referencia",
              celda: (pago) => (
                <span className="block max-w-48 truncate">
                  {pago.referencia === "" ? "—" : pago.referencia}
                </span>
              ),
            },
            {
              clave: "importe",
              encabezado: "Importe",
              alineacion: "derecha",
              celda: (pago) => (
                <span className="font-medium">
                  {formatearMoneda(pago.monto, moneda)}
                </span>
              ),
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (pago) => (
                <PillEstado
                  estado={pago.estado === "cancelled" ? "anulado" : "activo"}
                >
                  {pago.estado === "cancelled" ? "Cancelado" : "Activo"}
                </PillEstado>
              ),
            },
            {
              clave: "acciones",
              encabezado: "",
              ordenable: false,
              alineacion: "derecha",
              celda: (pago) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones del pago ${pago.documento.numero}`}
                      />
                    }
                  >
                    <IconDots className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => onVerDocumento(pago.documento)}
                    >
                      <IconEye className="size-4" />
                      Ver documento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={pago.estado === "cancelled"}
                      onClick={() => onAnularPago(pago)}
                    >
                      <IconBan className="size-4" />
                      Anular pago
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            },
          ]}
        />
      </BarraLista>
    </TarjetaLista>
  );
}
