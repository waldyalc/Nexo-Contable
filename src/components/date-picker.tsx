"use client";

import { IconCalendar } from "@tabler/icons-react";
import { format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { hoySantoDomingo } from "@/lib/formato";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  /** Fecha en formato `yyyy-MM-dd` o cadena vacía. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  permitirLimpiar?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

function aFecha(valor: string): Date | undefined {
  if (!valor) return undefined;
  const fecha = parse(valor, "yyyy-MM-dd", new Date());
  return isValid(fecha) ? fecha : undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  permitirLimpiar = false,
  className,
  id,
  disabled = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const [abierto, setAbierto] = useState(false);
  const fecha = aFecha(value);

  function seleccionar(dia: Date | undefined) {
    if (!dia) return;
    onChange(format(dia, "yyyy-MM-dd"));
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
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "h-9 w-full justify-start gap-2 px-2.5 font-normal",
              className,
            )}
          />
        }
      >
        <IconCalendar className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", !fecha && "text-muted-foreground")}>
          {fecha ? format(fecha, "dd/MM/yyyy") : placeholder}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto gap-0 overflow-hidden p-0"
      >
        <Calendar
          mode="single"
          locale={es}
          captionLayout="label"
          selected={fecha}
          defaultMonth={fecha ?? new Date()}
          onSelect={seleccionar}
          className="p-3 [--cell-radius:10px]"
          classNames={{
            weekdays: "flex w-full items-center border-b border-border pb-2",
            weekday:
              "flex-1 text-center text-[11px] font-medium tracking-wider text-muted-foreground uppercase",
            week: "mt-1 flex h-9 w-full items-center",
            day: "relative flex size-9 items-center justify-center rounded-[10px] p-0 text-center select-none",
            today:
              "rounded-[10px] bg-muted text-foreground data-[selected=true]:rounded-[10px]",
            caption_label: "font-display text-sm font-semibold",
            button_previous: "text-foreground hover:bg-muted rounded-[10px]",
            button_next: "text-foreground hover:bg-muted rounded-[10px]",
          }}
          formatters={{
            formatCaption: (mes) =>
              format(mes, "MMMM 'de' yyyy", { locale: es }).replace(
                /^./,
                (letra) => letra.toUpperCase(),
              ),
          }}
        />

        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          {permitirLimpiar ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                onChange("");
                setAbierto(false);
              }}
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
            onClick={() =>
              seleccionar(parse(hoySantoDomingo(), "yyyy-MM-dd", new Date()))
            }
          >
            Hoy
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface DatePickerCampoProps {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  permitirLimpiar?: boolean;
  disabled?: boolean;
}

/**
 * `DatePicker` para formularios sin estado propio: guarda la fecha en un input
 * oculto con `name` (GET o `FormData`) y se sincroniza cuando vuelven los
 * searchParams con otro `defaultValue`.
 */
export function DatePickerCampo({
  id,
  name,
  defaultValue = "",
  placeholder,
  className,
  permitirLimpiar = false,
  disabled = false,
}: DatePickerCampoProps) {
  const [valor, setValor] = useState(defaultValue);

  useEffect(() => {
    setValor(defaultValue);
  }, [defaultValue]);

  return (
    <div className="relative w-full">
      <input type="hidden" name={name} value={valor} />
      <DatePicker
        id={id}
        value={valor}
        onChange={setValor}
        placeholder={placeholder}
        permitirLimpiar={permitirLimpiar}
        className={className}
        disabled={disabled}
      />
    </div>
  );
}
