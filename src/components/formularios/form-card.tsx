import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FormCardProps {
  children: ReactNode;
  className?: string;
}

/** Tarjeta de formulario: radio 15 px, borde del tema y fondo blanco. */
export function FormCard({ children, className }: FormCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-[15px] border border-border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface FormGridProps {
  children: ReactNode;
  className?: string;
}

/** Rejilla de campos: 3 columnas desde 1024 px y 24 px de separación. */
export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface FormFieldProps {
  htmlFor?: string;
  label: ReactNode;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Campo con etiqueta de 14 px, asterisco del color primario y error inline. */
export function FormField({
  htmlFor,
  label,
  required = false,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-sm leading-5 font-medium text-foreground"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-xs font-normal text-primary">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="text-xs leading-4 text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface FormActionsProps {
  children: ReactNode;
  className?: string;
}

/** Fila de botones fuera de la tarjeta, alineada a la derecha. */
export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 [&_button]:h-9 [&_button]:whitespace-nowrap",
        className,
      )}
    >
      {children}
    </div>
  );
}
