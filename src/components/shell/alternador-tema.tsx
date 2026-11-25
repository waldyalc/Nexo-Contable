"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const CLAVE_TEMA = "nexo-tema";

type Tema = "light" | "dark";

function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  const oscuro = tema === "dark";
  raiz.classList.toggle("dark", oscuro);
  raiz.style.colorScheme = oscuro ? "dark" : "light";
}

export function AlternadorTema() {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    setTema(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiarSistema = (evento: MediaQueryListEvent) => {
      let guardado: string | null = null;
      try {
        guardado = window.localStorage.getItem(CLAVE_TEMA);
      } catch {
        guardado = null;
      }

      if (guardado !== null) return;

      const siguiente: Tema = evento.matches ? "dark" : "light";
      aplicarTema(siguiente);
      setTema(siguiente);
    };

    media.addEventListener("change", alCambiarSistema);
    return () => media.removeEventListener("change", alCambiarSistema);
  }, []);

  function alternar() {
    const siguiente: Tema = tema === "dark" ? "light" : "dark";

    try {
      window.localStorage.setItem(CLAVE_TEMA, siguiente);
    } catch {
      aplicarTema(siguiente);
      setTema(siguiente);
      return;
    }

    aplicarTema(siguiente);
    setTema(siguiente);
  }

  const oscuro = tema === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={oscuro}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      onClick={alternar}
    >
      {oscuro ? (
        <IconSun className="size-4" />
      ) : (
        <IconMoon className="size-4" />
      )}
    </Button>
  );
}
