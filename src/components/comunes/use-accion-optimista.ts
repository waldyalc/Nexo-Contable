"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

export type ResultadoAccionOptimista =
  | { ok: true; mensaje?: string }
  | { ok: false; error: string };

interface EjecucionAccionOptimista<
  TEntrada,
  TResultado extends ResultadoAccionOptimista,
> {
  clave: string;
  entrada: TEntrada;
  aplicarOptimista: () => void;
  accion: (entrada: TEntrada) => Promise<TResultado>;
  alExito?: (
    resultado: { ok: true; mensaje?: string },
    entrada: TEntrada,
  ) => void;
  mostrarExito?: boolean;
  mensajeErrorInesperado?: string;
}

/**
 * Ejecuta una Server Action dentro de una transición y coordina tres cosas:
 * el cambio optimista inmediato, el bloqueo de disparos repetidos por clave y
 * el aviso claro con sonner si la operación falla (useOptimistic revierte solo).
 */
export function useAccionOptimista() {
  const [clavesEnCurso, setClavesEnCurso] = useState<readonly string[]>([]);
  const clavesRef = useRef<readonly string[]>([]);
  const [, startTransition] = useTransition();

  function registrarClave(clave: string): boolean {
    if (clavesRef.current.includes(clave)) return false;

    clavesRef.current = [...clavesRef.current, clave];
    setClavesEnCurso(clavesRef.current);
    return true;
  }

  function liberarClave(clave: string) {
    clavesRef.current = clavesRef.current.filter((actual) => actual !== clave);
    setClavesEnCurso(clavesRef.current);
  }

  function enCurso(clave: string): boolean {
    return clavesEnCurso.includes(clave);
  }

  function ejecutar<TEntrada, TResultado extends ResultadoAccionOptimista>({
    clave,
    entrada,
    aplicarOptimista,
    accion,
    alExito,
    mostrarExito = false,
    mensajeErrorInesperado = "No pudimos completar la acción. Inténtalo de nuevo.",
  }: EjecucionAccionOptimista<TEntrada, TResultado>) {
    if (!registrarClave(clave)) return;

    startTransition(async () => {
      try {
        aplicarOptimista();
        const resultado = await accion(entrada);

        if (!resultado.ok) {
          toast.error(resultado.error);
          return;
        }

        if (mostrarExito) {
          toast.success(resultado.mensaje ?? "Acción completada.");
        }
        alExito?.(resultado, entrada);
      } catch {
        toast.error(mensajeErrorInesperado);
      } finally {
        liberarClave(clave);
      }
    });
  }

  return { ejecutar, enCurso };
}
