"use client";

import { IconCalendar } from "@tabler/icons-react";
import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { hoySantoDomingo } from "@/lib/formato";
import { cn } from "@/lib/utils";

const SEMANA_EMPIEZA_LUNES = { weekStartsOn: 1 as const };

export interface RangoFechas {
  /** Fecha inicial en `yyyy-MM-dd` o cadena vacía. */
  desde: string;
  /** Fecha final en `yyyy-MM-dd` o cadena vacía. */
  hasta: string;
}

export interface DateRangePickerProps {
  value: RangoFechas;
  onChange: (value: RangoFechas) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

function aFecha(valor: string): Date | undefined {
  if (!valor) return undefined;
  const fecha = parse(valor, "yyyy-MM-dd", new Date());
  return isValid(fecha) ? fecha : undefined;
}

function aIso(fecha: Date): string {
  return format(fecha, "yyyy-MM-dd");
}

interface Atajo {
  etiqueta: string;
  rango: (hoy: Date) => RangoFechas;
}

const ATAJOS: readonly Atajo[] = [
  {
    etiqueta: "Hoy",
    rango: (hoy) => ({ desde: aIso(hoy), hasta: aIso(hoy) }),
  },
  {
    etiqueta: "Ayer",
    rango: (hoy) => {
      const ayer = subDays(hoy, 1);
      return { desde: aIso(ayer), hasta: aIso(ayer) };
    },
  },
  {
    etiqueta: "Esta semana",
    rango: (hoy) => ({
      desde: aIso(startOfWeek(hoy, SEMANA_EMPIEZA_LUNES)),
      hasta: aIso(endOfWeek(hoy, SEMANA_EMPIEZA_LUNES)),
    }),
  },
  {
    etiqueta: "Este mes",
    rango: (hoy) => ({
      desde: aIso(startOfMonth(hoy)),
      hasta: aIso(endOfMonth(hoy)),
    }),
  },
  {
    etiqueta: "Mes anterior",
    rango: (hoy) => {
      const anterior = subMonths(hoy, 1);
      return {
        desde: aIso(startOfMonth(anterior)),
        hasta: aIso(endOfMonth(anterior)),
      };
    },
  },
  {
    etiqueta: "Este trimestre",
    rango: (hoy) => ({
      desde: aIso(startOfQuarter(hoy)),
      hasta: aIso(endOfQuarter(hoy)),
    }),
  },
  {
    etiqueta: "Este año",
    rango: (hoy) => ({
      desde: aIso(startOfYear(hoy)),
      hasta: aIso(endOfYear(hoy)),
    }),
  },
];

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Seleccionar rango",
  className,
  id,
  disabled = false,
}: DateRangePickerProps) {
  const [abierto, setAbierto] = useState(false);
  const desde = aFecha(value.desde);
  const hasta = aFecha(value.hasta);

  const etiqueta =
    desde && hasta
      ? `${format(desde, "dd/MM/yyyy")} – ${format(hasta, "dd/MM/yyyy")}`
      : desde
        ? `${format(desde, "dd/MM/yyyy")} – …`
        : "";

  function seleccionar(rango: { from?: Date; to?: Date } | undefined) {
    if (!rango?.from) {
      onChange({ desde: "", hasta: "" });
      return;
    }

    onChange({
      desde: aIso(rango.from),
      hasta: rango.to ? aIso(rango.to) : "",
    });

    if (rango.to) setAbierto(false);
  }

  function aplicarAtajo(atajo: Atajo) {
    onChange(atajo.rango(parse(hoySantoDomingo(), "yyyy-MM-dd", new Date())));
    setAbierto(false);
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start gap-2 px-2.5 font-normal",
              className,
            )}
          />
        }
      >
        <IconCalendar className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", !etiqueta && "text-muted-foreground")}>
          {etiqueta || placeholder}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
            {ATAJOS.map((atajo) => (
              <button
                key={atajo.etiqueta}
                type="button"
                onClick={() => aplicarAtajo(atajo)}
                className="rounded-[10px] px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20"
              >
                {atajo.etiqueta}
              </button>
            ))}
          </div>

          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={2}
            selected={{ from: desde, to: hasta }}
            defaultMonth={desde ?? new Date()}
            onSelect={seleccionar}
            className="p-3 [--cell-radius:10px] [--cell-size:36px]"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
