"use client";

import {
  IconChevronDown,
  IconFileSpreadsheet,
  IconFileText,
  IconLoader2,
  IconPrinter,
} from "@tabler/icons-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TablaReporte } from "@/lib/reportes/exportar/tipos";
import { cn } from "@/lib/utils";

type Formato = "excel" | "pdf";
type VarianteBoton = NonNullable<ComponentProps<typeof Button>["variant"]>;
type TamanoBoton = NonNullable<ComponentProps<typeof Button>["size"]>;

interface Props {
  tabla: TablaReporte;
  nombreArchivo: string;
  variant?: VarianteBoton;
  size?: TamanoBoton;
  className?: string;
}

const EXTENSION: Record<Formato, string> = { excel: "xlsx", pdf: "pdf" };

const MIME_EXCEL =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function generarBlob(
  tabla: TablaReporte,
  formato: Formato,
): Promise<Blob> {
  if (formato === "excel") {
    const { tablaAExcel } = await import("@/lib/reportes/exportar/excel");
    const buffer = await tablaAExcel(tabla);
    return new Blob([buffer], { type: MIME_EXCEL });
  }

  const { tablaAPdf } = await import("@/lib/reportes/exportar/pdf");
  return tablaAPdf(tabla);
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = "noopener";
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function BotonDescargar({
  tabla,
  nombreArchivo,
  variant = "outline",
  size = "default",
  className,
}: Props) {
  const [generando, setGenerando] = useState<Formato | null>(null);

  async function descargar(formato: Formato): Promise<void> {
    if (generando != null) return;

    setGenerando(formato);
    try {
      const blob = await generarBlob(tabla, formato);
      descargarBlob(blob, `${nombreArchivo}.${EXTENSION[formato]}`);
    } catch {
      toast.error("No se pudo descargar el reporte", {
        description: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className={cn("print:hidden", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant={variant}
              size={size}
              disabled={generando != null}
            />
          }
        >
          {generando != null ? "Generando…" : "Descargar"}
          {generando != null ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconChevronDown className="size-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            disabled={generando != null}
            onClick={() => void descargar("excel")}
          >
            <IconFileSpreadsheet className="size-4" />
            Descargar Excel
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={generando != null}
            onClick={() => void descargar("pdf")}
          >
            <IconFileText className="size-4" />
            Descargar PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={generando != null}
            onClick={() => window.print()}
          >
            <IconPrinter className="size-4" />
            Imprimir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
