"use client";

import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ESPERA_BUSQUEDA_MS = 350;

function normalizarBusqueda(valor: string): string {
  return valor.trim();
}

export interface BuscadorListaProps {
  /** Texto visible cuando el campo está vacío. */
  placeholder?: string;
  /** Nombre del parámetro de búsqueda en la URL (`q` por defecto). */
  parametro?: string;
  /** Valor inicial calculado por la página servidora; la URL sigue siendo la fuente final. */
  valorInicial?: string;
  /** Ruta base alternativa; por defecto usa la ruta actual. */
  base?: string;
  /** Parámetro de paginación que se elimina al cambiar la búsqueda (`pagina`; `null` lo desactiva). */
  parametroPagina?: string | null;
  ariaLabel?: string;
  className?: string;
}

/**
 * Buscador de listas sincronizado con la URL: escribe sin bloquear la UI,
 * espera 350 ms, conserva el resto de filtros de la query y reinicia la página.
 */
export function BuscadorLista({
  placeholder = "Buscar…",
  parametro = "q",
  valorInicial,
  base,
  parametroPagina = "pagina",
  ariaLabel = "Buscar",
  className,
}: BuscadorListaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ruta = base ?? pathname;
  const valorUrl = searchParams.get(parametro) ?? "";
  const inicial = valorInicial ?? valorUrl;
  const [texto, setTexto] = useState(inicial);
  const [pendiente, iniciarTransicion] = useTransition();
  const enviado = useRef(normalizarBusqueda(inicial));
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const construirUrl = useCallback(
    (valor: string): string => {
      const params = new URLSearchParams(searchParams.toString());

      if (valor === "") {
        params.delete(parametro);
      } else {
        params.set(parametro, valor);
      }

      if (parametroPagina !== null) {
        params.delete(parametroPagina);
      }

      const consulta = params.toString();
      return consulta === "" ? ruta : `${ruta}?${consulta}`;
    },
    [searchParams, parametro, parametroPagina, ruta],
  );

  // La URL manda cuando cambia por atrás/adelante o por otro filtro de la página.
  useEffect(() => {
    const valorNormalizado = normalizarBusqueda(valorUrl);
    if (valorNormalizado === enviado.current) return;

    enviado.current = valorNormalizado;
    setTexto(valorUrl);
  }, [valorUrl]);

  useEffect(() => {
    const valor = normalizarBusqueda(texto);
    if (valor === enviado.current) return;

    temporizador.current = setTimeout(() => {
      enviado.current = valor;
      iniciarTransicion(() => {
        router.replace(construirUrl(valor), { scroll: false });
      });
    }, ESPERA_BUSQUEDA_MS);

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [texto, construirUrl, router]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (temporizador.current) clearTimeout(temporizador.current);

    const valor = normalizarBusqueda(texto);
    if (valor === enviado.current) return;

    enviado.current = valor;
    iniciarTransicion(() => {
      router.replace(construirUrl(valor), { scroll: false });
    });
  }

  return (
    <form
      onSubmit={enviar}
      className={cn("relative w-full sm:max-w-xs", className)}
    >
      <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-busy={pendiente}
        className="h-9 pl-8"
      />
      {pendiente ? (
        <IconLoader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </form>
  );
}
