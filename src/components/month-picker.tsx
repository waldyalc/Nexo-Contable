"use client";

import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { periodoActualSantoDomingo } from "@/lib/formato";
import { cn } from "@/lib/utils";

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

const NOMBRES_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export interface MonthPickerProps {
  /** Periodo en formato `YYYY-MM` o cadena vacía. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  permitirLimpiar?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
}

function partesPeriodo(periodo: string): { anio: number; mes: number } | null {
  const coincidencia = /^(\d{4})-(\d{2})$/.exec(periodo.trim());
  if (!coincidencia) return null;

  const [, anio, mes] = coincidencia;
  if (!anio || !mes) return null;

  const numeroMes = Number(mes);
  if (numeroMes < 1 || numeroMes > 12) return null;
  return { anio: Number(anio), mes: numeroMes };
}

function periodoActual(): { anio: number; mes: number } {
  const [anioTexto, mesTexto] = periodoActualSantoDomingo().split("-");
  const ahora = new Date();

  return {
    anio: Number(anioTexto) || ahora.getFullYear(),
    mes: Number(mesTexto) || ahora.getMonth() + 1,
  };
}

export function MonthPicker({
  value,
  onChange,
  placeholder = "Seleccionar mes",
  permitirLimpiar = false,
  className,
  id,
  disabled = false,
}: MonthPickerProps) {
  const [abierto, setAbierto] = useState(false);
  const seleccionado = partesPeriodo(value);
  const [anioVisible, setAnioVisible] = useState(
    seleccionado?.anio ?? periodoActual().anio,
  );

  useEffect(() => {
    if (abierto) {
      setAnioVisible(seleccionado?.anio ?? periodoActual().anio);
    }
  }, [abierto, seleccionado?.anio]);

  const etiqueta = seleccionado
    ? `${NOMBRES_MES[seleccionado.mes - 1] ?? ""} de ${seleccionado.anio}`
    : "";

  function elegir(numeroMes: number) {
    onChange(`${anioVisible}-${String(numeroMes).padStart(2, "0")}`);
    setAbierto(false);
  }

  function irAlMesActual() {
    const actual = periodoActual();
    onChange(`${actual.anio}-${String(actual.mes).padStart(2, "0")}`);
    setAbierto(false);
  }

  function limpiar() {
    onChange("");
    setAbierto(false);
  }

  const mostrarLimpiar = permitirLimpiar && value !== "";

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={etiqueta ? `Periodo: ${etiqueta}` : placeholder}
              className={cn(
                "h-9 w-full justify-start gap-2 px-2.5 font-normal",
                mostrarLimpiar && "pr-9",
              )}
            />
          }
        >
          <IconCalendar className="size-4 shrink-0 text-muted-foreground" />
          <span
            className={cn("truncate", !seleccionado && "text-muted-foreground")}
          >
            {seleccionado ? etiqueta : placeholder}
          </span>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[284px] gap-2 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Año anterior"
              onClick={() => setAnioVisible((anio) => anio - 1)}
            >
              <IconChevronLeft />
            </Button>
            <span className="font-display text-sm font-semibold tabular-nums">
              {anioVisible}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Año siguiente"
              onClick={() => setAnioVisible((anio) => anio + 1)}
            >
              <IconChevronRight />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {MESES.map((mes, indice) => {
              const numeroMes = indice + 1;
              const activo =
                seleccionado?.anio === anioVisible &&
                seleccionado.mes === numeroMes;

              return (
                <button
                  key={mes}
                  type="button"
                  onClick={() => elegir(numeroMes)}
                  aria-pressed={activo}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-[10px] text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
                    activo
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {mes}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            {permitirLimpiar ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={limpiar}
              >
                Borrar
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={irAlMesActual}
            >
              Este mes
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {mostrarLimpiar ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Limpiar mes"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <IconX />
        </Button>
      ) : null}
    </div>
  );
}

export interface MonthPickerCampoProps {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  permitirLimpiar?: boolean;
  disabled?: boolean;
}

/**
 * `MonthPicker` para formularios sin estado propio: guarda el periodo en un
 * input oculto con `name` (GET o `FormData`) y se sincroniza cuando vuelven
 * los searchParams con otro `defaultValue`.
 */
export function MonthPickerCampo({
  id,
  name,
  defaultValue = "",
  placeholder,
  className,
  permitirLimpiar = false,
  disabled = false,
}: MonthPickerCampoProps) {
  const [valor, setValor] = useState(defaultValue);

  useEffect(() => {
    setValor(defaultValue);
  }, [defaultValue]);

  return (
    <div className={cn("relative w-full", className)}>
      <input type="hidden" name={name} value={valor} />
      <MonthPicker
        id={id}
        value={valor}
        onChange={setValor}
        placeholder={placeholder}
        permitirLimpiar={permitirLimpiar}
        disabled={disabled}
      />
    </div>
  );
}
