"use client";

import { useEffect, useState } from "react";

export const CLAVE_TEMA = "nexo-tema";

export type Tema = "light" | "dark";

export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  const oscuro = tema === "dark";
  raiz.classList.toggle("dark", oscuro);
  raiz.style.colorScheme = oscuro ? "dark" : "light";
}

/**
 * Tema de la aplicación. Por defecto es siempre claro; la preferencia
 * del sistema operativo no aplica — solo manda lo elegido en el menú
 * de perfil, persistido en localStorage.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    setTema(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  function cambiarTema(siguiente: Tema) {
    try {
      window.localStorage.setItem(CLAVE_TEMA, siguiente);
    } catch {
      // Sin almacenamiento disponible: el tema aplica solo en esta sesión.
    }

    aplicarTema(siguiente);
    setTema(siguiente);
  }

  return { tema, cambiarTema };
}
