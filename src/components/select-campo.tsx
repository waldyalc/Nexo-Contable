"use client";

import { useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OpcionSelect {
  value: string;
  label: string;
}

/** Valor reservado para la opción vacía ("Todas", "Sin asignar"…). */
export const VALOR_NINGUNO = "__ninguno";

function CampoFormulario({
  name,
  valor,
  requerido,
}: {
  name: string;
  valor: string;
  requerido: boolean;
}) {
  if (requerido) {
    return (
      <input
        type="text"
        name={name}
        value={valor}
        required
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        className="sr-only"
        onChange={() => undefined}
      />
    );
  }

  return <input type="hidden" name={name} value={valor} />;
}

interface CampoProps {
  id?: string;
  items: readonly OpcionSelect[];
  actual: string;
  etiqueta: string;
  requerido: boolean;
  deshabilitado: boolean;
  className?: string;
  ariaLabel?: string;
  onCambio: (valor: string | null) => void;
}

function SelectSimple({
  id,
  items,
  actual,
  etiqueta,
  requerido,
  deshabilitado,
  className,
  ariaLabel,
  onCambio,
}: CampoProps) {
  return (
    <Select
      items={items}
      value={actual === "" ? null : actual}
      onValueChange={onCambio}
      required={requerido}
      disabled={deshabilitado}
    >
      <SelectTrigger
        id={id}
        className={className ?? "w-full"}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={etiqueta} />
      </SelectTrigger>
      <SelectContent>
        {items.map((opcion) => (
          <SelectItem key={opcion.value} value={opcion.value}>
            {opcion.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ComboboxBuscable({
  id,
  items,
  actual,
  etiqueta,
  requerido,
  deshabilitado,
  className,
  ariaLabel,
  onCambio,
}: CampoProps) {
  return (
    <Combobox
      items={items}
      value={
        actual === ""
          ? null
          : (items.find((opcion) => opcion.value === actual) ?? null)
      }
      onValueChange={(opcion) => onCambio(opcion?.value ?? null)}
      itemToStringLabel={(opcion) => opcion.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <ComboboxInput
        id={id}
        className={className ?? "w-full"}
        placeholder={etiqueta}
        disabled={deshabilitado}
        showClear={!requerido && etiqueta !== ""}
        aria-label={ariaLabel}
      />
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(opcion: OpcionSelect) => (
            <ComboboxItem key={opcion.value} value={opcion}>
              {opcion.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export interface SelectCampoProps {
  id?: string;
  name?: string;
  opciones: readonly OpcionSelect[];
  valorInicial?: string | null;
  valor?: string | null;
  onCambio?: (valor: string) => void;
  etiquetaVacia?: string;
  buscable?: boolean;
  requerido?: boolean;
  deshabilitado?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function SelectCampo({
  id,
  name,
  opciones,
  valorInicial,
  valor,
  onCambio,
  etiquetaVacia,
  buscable = false,
  requerido = false,
  deshabilitado = false,
  className,
  "aria-label": ariaLabel,
}: SelectCampoProps) {
  const [interno, setInterno] = useState(valorInicial ?? "");
  const actual = valor === undefined ? interno : (valor ?? "");
  const items =
    etiquetaVacia == null
      ? [...opciones]
      : [{ value: VALOR_NINGUNO, label: etiquetaVacia }, ...opciones];

  function cambiar(siguiente: string | null) {
    const limpio =
      siguiente == null || siguiente === VALOR_NINGUNO ? "" : siguiente;
    if (valor === undefined) setInterno(limpio);
    onCambio?.(limpio);
  }

  const campo: CampoProps = {
    id,
    items,
    actual,
    etiqueta: etiquetaVacia ?? (buscable ? "Buscar…" : "Selecciona…"),
    requerido,
    deshabilitado,
    className,
    ariaLabel,
    onCambio: cambiar,
  };

  return (
    <>
      {buscable ? <ComboboxBuscable {...campo} /> : <SelectSimple {...campo} />}
      {name == null ? null : (
        <CampoFormulario
          name={name}
          valor={actual}
          requerido={buscable && requerido}
        />
      )}
    </>
  );
}
