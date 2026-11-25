"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/formularios/form-card";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { asignarNcfDocumentoBorradorAction } from "@/lib/operaciones/documentos-borrador-actions";
import type {
  DocumentoListado,
  SecuenciaNcfListado,
} from "@/lib/operaciones/tipos";

const BASE = [
  { value: "B01", label: "B01 · Crédito fiscal" },
  { value: "B02", label: "B02 · Consumo" },
  { value: "B14", label: "B14 · Regímenes especiales" },
  { value: "B15", label: "B15 · Gubernamental" },
];

export function DialogoAsignarComprobante({
  abierto,
  onOpenChange,
  empresaId,
  documento,
  secuencias,
  onAsignado,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  documento: DocumentoListado | null;
  secuencias: readonly SecuenciaNcfListado[];
  onAsignado: () => void;
}) {
  const [tipo, setTipo] = useState("B01");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const opciones = useMemo(() => {
    const salida = [...BASE];
    for (const secuencia of secuencias) {
      if (!secuencia.activo || secuencia.serie !== "E") continue;
      if (secuencia.numeroActual >= secuencia.numeroFinal) continue;
      if (
        !salida.some((opcion) => opcion.value === secuencia.tipoComprobante)
      ) {
        salida.push({
          value: secuencia.tipoComprobante,
          label: `${secuencia.tipoComprobante} · Comprobante electrónico`,
        });
      }
    }
    return salida;
  }, [secuencias]);

  async function asignar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!documento || guardando) return;
    setGuardando(true);
    setError(null);
    const resultado = await asignarNcfDocumentoBorradorAction({
      empresaId,
      documentoId: documento.id,
      tipoComprobante: tipo,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    toast.success(resultado.mensaje);
    onOpenChange(false);
    onAsignado();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar comprobante</DialogTitle>
          <DialogDescription>
            Factura proforma {documento?.numero ?? ""}. Se consumirá el próximo
            número autorizado de la secuencia seleccionada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={asignar} className="flex flex-col gap-4">
          <FormField
            label="Tipo de comprobante"
            htmlFor="asignar-tipo-ncf"
            required
          >
            <SelectCampo
              id="asignar-tipo-ncf"
              opciones={opciones}
              valor={tipo}
              onCambio={setTipo}
              requerido
              aria-label="Tipo de comprobante"
            />
          </FormField>
          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Asignando…
                </>
              ) : (
                "Asignar comprobante"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
