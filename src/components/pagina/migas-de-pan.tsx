import { IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

export interface MigaDePan {
  etiqueta: string;
  /** Si se omite, la miga se pinta como texto y no como enlace. */
  href?: string;
}

export interface MigasDePanProps {
  items: readonly MigaDePan[];
  className?: string;
}

export function MigasDePan({ items, className }: MigasDePanProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Migas de pan" className={cn("print:hidden", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, indice) => {
          const esActual = indice === items.length - 1;

          return (
            <Fragment key={item.href ?? `${item.etiqueta}-${indice}`}>
              <li className="flex min-w-0 items-center">
                {esActual ? (
                  <span
                    aria-current="page"
                    className="truncate font-medium text-foreground"
                  >
                    {item.etiqueta}
                  </span>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className="truncate transition-colors hover:text-foreground"
                  >
                    {item.etiqueta}
                  </Link>
                ) : (
                  <span className="truncate">{item.etiqueta}</span>
                )}
              </li>
              {esActual ? null : (
                <li
                  aria-hidden="true"
                  className="flex items-center text-border"
                >
                  <IconChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
