"use client";

import {
  IconCalendarPlus,
  IconDots,
  IconLoader2,
  IconLock,
  IconLockOpen,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  type PeriodoContable,
  cerrarPeriodoAction,
  crearPeriodoAction,
  reabrirPeriodoAction,
} from "@/app/(app)/contabilidad/actions";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatearFecha, hoySantoDomingo } from "@/lib/formato";

export interface PeriodosTabProps {
  periodos: readonly PeriodoContable[];
}

export function PeriodosTab({ periodos }: PeriodosTabProps) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    if (!dialogo) return;
    const hoy = hoySantoDomingo();
    const anio = hoy.slice(0, 4);
    setNombre(`Período fiscal ${anio}`);
    setFechaInicio(`${anio}-01-01`);
    setFechaFin(`${anio}-12-31`);
    setError(null);
    setGuardando(false);
  }, [dialogo]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (nombre.trim() === "" || fechaInicio === "" || fechaFin === "") {
      setError("Completa el nombre, la fecha inicial y la fecha final.");
      return;
    }

    if (fechaFin < fechaInicio) {
      setError("La fecha final no puede ser anterior a la fecha inicial.");
      return;
    }

    setError(null);
    setGuardando(true);
    const resultado = await crearPeriodoAction({
      nombre,
      fechaInicio,
      fechaFin,
    });
    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    setDialogo(false);
    router.refresh();
  }

  async function alternarEstado(periodo: PeriodoContable) {
    setProcesando(periodo.id);
    const resultado =
      periodo.estado === "open"
        ? await cerrarPeriodoAction(periodo.id)
        : await reabrirPeriodoAction(periodo.id);
    setProcesando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    router.refresh();
  }

  return (
    <>
      <TarjetaLista>
        <BarraLista
          titulo="Períodos contables"
          descripcion="Solo se contabiliza dentro de un período abierto. Cerrar un período impide nuevos asientos en sus fechas."
          acciones={
            <Button onClick={() => setDialogo(true)}>
              <IconCalendarPlus className="size-4" />
              Nuevo período
            </Button>
          }
        >
          <TablaLista<PeriodoContable>
            filas={periodos}
            claveFila={(periodo) => periodo.id}
            paginacion={{ tamanoPagina: 12, etiqueta: "períodos" }}
            vacio={{
              titulo: "Sin períodos contables",
              descripcion:
                "Crea el período fiscal para habilitar la contabilización de asientos.",
              accion: (
                <Button onClick={() => setDialogo(true)}>
                  <IconCalendarPlus className="size-4" />
                  Nuevo período
                </Button>
              ),
            }}
            columnas={[
              {
                clave: "nombre",
                encabezado: "Período",
                celda: (periodo) => (
                  <span className="font-medium">{periodo.nombre}</span>
                ),
              },
              {
                clave: "inicio",
                encabezado: "Fecha inicial",
                celda: (periodo) => formatearFecha(periodo.fechaInicio),
              },
              {
                clave: "fin",
                encabezado: "Fecha final",
                celda: (periodo) => formatearFecha(periodo.fechaFin),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (periodo) => (
                  <PillEstado
                    estado={periodo.estado === "open" ? "abierto" : "cerrado"}
                  />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (periodo) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${periodo.nombre}`}
                          disabled={procesando === periodo.id}
                        />
                      }
                    >
                      {procesando === periodo.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconDots className="size-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => void alternarEstado(periodo)}
                      >
                        {periodo.estado === "open" ? (
                          <IconLock className="size-4" />
                        ) : (
                          <IconLockOpen className="size-4" />
                        )}
                        {periodo.estado === "open"
                          ? "Cerrar período"
                          : "Reabrir período"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent>
          <form className="flex flex-col gap-4" onSubmit={guardar}>
            <DialogHeader>
              <DialogTitle>Nuevo período contable</DialogTitle>
              <DialogDescription>
                Define el rango de fechas en el que se podrán contabilizar
                asientos de la empresa activa.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <p
                role="alert"
                className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <FormGrid className="sm:grid-cols-1 lg:grid-cols-1">
              <FormField htmlFor="periodo-nombre" label="Nombre" required>
                <Input
                  id="periodo-nombre"
                  value={nombre}
                  onChange={(evento) => setNombre(evento.target.value)}
                  placeholder="Ej. Período fiscal 2026"
                />
              </FormField>

              <FormField
                htmlFor="periodo-inicio"
                label="Fecha inicial"
                required
              >
                <DatePicker
                  id="periodo-inicio"
                  value={fechaInicio}
                  onChange={setFechaInicio}
                />
              </FormField>

              <FormField htmlFor="periodo-fin" label="Fecha final" required>
                <DatePicker
                  id="periodo-fin"
                  value={fechaFin}
                  onChange={setFechaFin}
                />
              </FormField>
            </FormGrid>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={guardando}
                onClick={() => setDialogo(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconCalendarPlus className="size-4" />
                )}
                Crear período
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
