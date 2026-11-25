"use client";

import { IconCopy, IconDice, IconEye, IconEyeOff } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { generarPasswordSegura } from "./generar-password";

export interface CampoPasswordProps {
  id: string;
  valor: string;
  onCambio: (valor: string) => void;
  deshabilitado?: boolean;
  invalido?: boolean;
  descritoPor?: string;
}

export function CampoPassword({
  id,
  valor,
  onCambio,
  deshabilitado = false,
  invalido = false,
  descritoPor,
}: CampoPasswordProps) {
  const [visible, setVisible] = useState(false);

  function generar() {
    try {
      onCambio(generarPasswordSegura(16));
      setVisible(true);
      toast.success(
        "Contraseña generada. Cópiala y compártela por un canal seguro.",
      );
    } catch {
      toast.error(
        "No se pudo generar una contraseña segura en este navegador.",
      );
    }
  }

  async function copiar() {
    if (valor === "") return;

    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard-no-disponible");
      }
      await navigator.clipboard.writeText(valor);
      toast.success("Contraseña copiada al portapapeles.");
    } catch {
      toast.error(
        "No se pudo copiar. Selecciona la contraseña y cópiala manualmente.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(evento) => onCambio(evento.target.value)}
          placeholder="Mínimo 12 caracteres"
          autoComplete="new-password"
          disabled={deshabilitado}
          aria-invalid={invalido}
          aria-describedby={descritoPor}
          className="pr-10 font-mono text-[13px]"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          disabled={deshabilitado}
          onClick={() => setVisible((actual) => !actual)}
        >
          {visible ? (
            <IconEyeOff className="size-4" />
          ) : (
            <IconEye className="size-4" />
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={deshabilitado}
          onClick={generar}
        >
          <IconDice className="size-4" />
          Generar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={deshabilitado || valor === ""}
          onClick={() => void copiar()}
        >
          <IconCopy className="size-4" />
          Copiar
        </Button>
      </div>
    </div>
  );
}
