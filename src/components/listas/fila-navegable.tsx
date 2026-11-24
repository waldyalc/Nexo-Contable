"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Elementos dentro de la fila que ganan el clic y no disparan la navegación. */
const SELECTOR_INTERACTIVO =
  'a, button, input, select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="menu"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"], [role="tab"], [role="combobox"], [contenteditable="true"], [data-no-row-click]';

/**
 * Indica si el evento nació dentro de un control interactivo. Es estructural,
 * no `instanceof HTMLElement`: los iconos SVG también deben contar. La fila
 * misma lleva `role="link"`; cuando `closest()` llega hasta ella se excluye
 * para que los clics en celdas vacías sí naveguen.
 */
export function dentroDeInteractivo(objetivo: unknown, fila: unknown): boolean {
  if (typeof objetivo !== "object" || objetivo === null) return false;
  const closest = (objetivo as { closest?: unknown }).closest;
  if (typeof closest !== "function") return false;

  const interactivo = closest.call(objetivo, SELECTOR_INTERACTIVO);
  return interactivo !== null && interactivo !== fila;
}

export interface FilaNavegableProps {
  /** Destino de la ficha. Vacío o `null` deja una fila normal. */
  href?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * Fila de tabla que navega a `href` con clic o Enter. `Ctrl`/`Cmd`+clic y el
 * clic medio abren en pestaña nueva sin interceptar botones, enlaces ni inputs.
 */
export function FilaNavegable({
  href,
  className,
  children,
}: FilaNavegableProps) {
  const router = useRouter();

  if (!href) {
    return <TableRow className={className}>{children}</TableRow>;
  }

  const navegar = (pestanaNueva: boolean) => {
    if (pestanaNueva) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };

  const alClick = (evento: MouseEvent<HTMLTableRowElement>) => {
    if (
      evento.button !== 0 ||
      dentroDeInteractivo(evento.target, evento.currentTarget)
    ) {
      return;
    }
    if (window.getSelection()?.toString()) return;
    navegar(evento.metaKey || evento.ctrlKey);
  };

  const alClickAuxiliar = (evento: MouseEvent<HTMLTableRowElement>) => {
    if (
      evento.button !== 1 ||
      dentroDeInteractivo(evento.target, evento.currentTarget)
    ) {
      return;
    }
    evento.preventDefault();
    navegar(true);
  };

  const alTeclar = (evento: KeyboardEvent<HTMLTableRowElement>) => {
    if (
      evento.key !== "Enter" ||
      dentroDeInteractivo(evento.target, evento.currentTarget)
    ) {
      return;
    }
    navegar(evento.metaKey || evento.ctrlKey);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: una fila <tr> no puede ser un <a>; role="link" expone la navegación completa.
    <TableRow
      role="link"
      tabIndex={0}
      data-href={href}
      className={cn(
        "cursor-pointer focus-visible:bg-secondary/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      onClick={alClick}
      onAuxClick={alClickAuxiliar}
      onKeyDown={alTeclar}
    >
      {children}
    </TableRow>
  );
}
