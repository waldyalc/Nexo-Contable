"use client";

import {
  IconPencil,
  IconPlus,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { BarraLista } from "@/components/listas/barra-lista";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearRnc, normalizarRnc } from "@/lib/formato";
import type { TerceroListado } from "@/lib/operaciones/tipos";

const ETIQUETAS_TIPO = {
  customer: "Cliente",
  supplier: "Suplidor",
  both: "Cliente y suplidor",
} as const;

export interface TercerosCarteraTabProps {
  tipo: "cxc" | "cxp";
  terceros: readonly TerceroListado[];
  onEditar: (tercero: TerceroListado) => void;
  onCrear: () => void;
}

/** Lista de clientes o suplidores restaurada desde el ciclo original. */
export function TercerosCarteraTab({
  tipo,
  terceros,
  onEditar,
  onCrear,
}: TercerosCarteraTabProps) {
  const esCobrar = tipo === "cxc";
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (termino === "") return terceros;
    const digitos = normalizarRnc(termino);

    return terceros.filter(
      (tercero) =>
        tercero.nombre.toLowerCase().includes(termino) ||
        tercero.correo.toLowerCase().includes(termino) ||
        tercero.telefono.toLowerCase().includes(termino) ||
        (digitos !== "" && normalizarRnc(tercero.rnc).includes(digitos)),
    );
  }, [terceros, busqueda]);

  const titulo = esCobrar ? "Clientes" : "Suplidores";

  return (
    <TarjetaLista data-lista="terceros-cartera">
      <BarraLista
        titulo={titulo}
        descripcion={`${filtrados.length} de ${terceros.length} terceros del ciclo`}
        filtros={
          <div className="relative w-full sm:max-w-xs">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder={`Buscar ${titulo.toLowerCase()} por nombre o RNC…`}
              aria-label={`Buscar ${titulo.toLowerCase()}`}
              className="h-9 pl-8"
            />
          </div>
        }
      >
        <TablaLista<TerceroListado>
          filas={filtrados}
          claveFila={(tercero) => tercero.id}
          ordenable
          paginacion={{ tamanoPagina: 15, etiqueta: "terceros" }}
          vacio={{
            titulo: esCobrar ? "Sin clientes" : "Sin suplidores",
            descripcion: "Usa “Tercero” para registrar uno.",
            icono: <IconUsers className="size-8" />,
            accion: (
              <Button variant="outline" onClick={onCrear}>
                <IconPlus className="size-4" />
                Nuevo tercero
              </Button>
            ),
          }}
          columnas={[
            {
              clave: "nombre",
              encabezado: esCobrar ? "Cliente" : "Suplidor",
              celda: (tercero) => (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">
                    {tercero.nombre}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {ETIQUETAS_TIPO[tercero.tipo]}
                  </span>
                </div>
              ),
            },
            {
              clave: "rnc",
              encabezado: "RNC",
              celda: (tercero) => {
                const rnc = formatearRnc(tercero.rnc);
                return rnc === "" ? "—" : rnc;
              },
            },
            {
              clave: "correo",
              encabezado: "Correo",
              celda: (tercero) => (
                <span className="block max-w-64 truncate">
                  {tercero.correo === "" ? "—" : tercero.correo}
                </span>
              ),
            },
            {
              clave: "telefono",
              encabezado: "Teléfono",
              celda: (tercero) =>
                tercero.telefono === "" ? "—" : tercero.telefono,
            },
            {
              clave: "acciones",
              encabezado: "",
              ordenable: false,
              alineacion: "derecha",
              celda: (tercero) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditar(tercero)}
                >
                  <IconPencil className="size-4" />
                  Modificar
                </Button>
              ),
            },
          ]}
        />
      </BarraLista>
    </TarjetaLista>
  );
}
