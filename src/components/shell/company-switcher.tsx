"use client";

import {
  IconBuilding,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { iniciales } from "@/components/shell/navegacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EmpresaAsignada } from "@/lib/auth/sesion";
import { cn } from "@/lib/utils";

const POR_PAGINA = 6;

function MonogramaEmpresa({ nombre }: { nombre: string }) {
  return (
    <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-secondary text-[11px] font-bold text-secondary-foreground">
      {iniciales(nombre)}
    </span>
  );
}

export interface CompanySwitcherProps {
  empresas: readonly EmpresaAsignada[];
  empresaActiva: EmpresaAsignada | null;
  esAdminGlobal: boolean;
}

/**
 * Popover "Mis empresas" estilo Alegra: búsqueda instantánea, empresa
 * principal, check en la activa, paginador de 6 en 6 y pie de gestión.
 */
export function CompanySwitcher({
  empresas,
  empresaActiva,
  esAdminGlobal,
}: CompanySwitcherProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (termino === "") return empresas;

    return empresas.filter(
      (empresa) =>
        empresa.nombreComercial.toLowerCase().includes(termino) ||
        empresa.razonSocial.toLowerCase().includes(termino) ||
        empresa.rnc.includes(termino),
    );
  }, [empresas, busqueda]);

  const totalPaginas = Math.max(Math.ceil(filtradas.length / POR_PAGINA), 1);
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const visibles = filtradas.slice(
    paginaSegura * POR_PAGINA,
    paginaSegura * POR_PAGINA + POR_PAGINA,
  );

  async function seleccionar(empresa: EmpresaAsignada) {
    if (empresa.id === empresaActiva?.id) {
      setAbierto(false);
      return;
    }

    setCambiandoId(empresa.id);

    try {
      const respuesta = await fetch("/api/empresa-activa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresa.id }),
      });

      if (!respuesta.ok) {
        const datos: unknown = await respuesta.json().catch(() => null);
        const mensaje =
          datos != null &&
          typeof datos === "object" &&
          "error" in datos &&
          typeof datos.error === "string"
            ? datos.error
            : "No pudimos cambiar de empresa.";
        toast.error(mensaje);
        return;
      }

      setAbierto(false);
      toast.success("Empresa activa actualizada", {
        description: empresa.nombreComercial,
      });
      router.refresh();
    } catch {
      toast.error("No pudimos cambiar de empresa. Revisa tu conexión.");
    } finally {
      setCambiandoId(null);
    }
  }

  function irA(ruta: string) {
    setAbierto(false);
    router.push(ruta);
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-9 max-w-[260px] gap-2 border-border bg-card px-2"
            aria-label="Mis empresas"
          />
        }
      >
        {empresaActiva ? (
          <MonogramaEmpresa nombre={empresaActiva.nombreComercial} />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-muted text-muted-foreground">
            <IconBuilding className="size-4" />
          </span>
        )}
        <span className="max-w-[180px] truncate text-sm font-medium">
          {empresaActiva?.nombreComercial ?? "Mis empresas"}
        </span>
        <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <PopoverTitle className="text-sm font-semibold">
            Mis empresas
          </PopoverTitle>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Actualizar empresas"
              onClick={() => router.refresh()}
            >
              <IconRefresh className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Cerrar"
              onClick={() => setAbierto(false)}
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPagina(0);
              }}
              placeholder="Buscar..."
              aria-label="Buscar empresa"
              className="h-9 pl-8"
            />
          </div>
        </div>

        <div className="px-1 pb-1">
          {visibles.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {empresas.length === 0
                ? "Aún no tienes empresas asignadas."
                : "Sin resultados para tu búsqueda."}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {visibles.map((empresa) => {
                const activa = empresa.id === empresaActiva?.id;

                return (
                  <li key={empresa.id}>
                    <button
                      type="button"
                      onClick={() => void seleccionar(empresa)}
                      disabled={cambiandoId !== null}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60",
                        activa && "bg-secondary/60 hover:bg-secondary/70",
                      )}
                    >
                      <MonogramaEmpresa nombre={empresa.nombreComercial} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-foreground">
                            {empresa.nombreComercial}
                          </span>
                          {empresa.esPrincipal ? (
                            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                              Principal
                            </span>
                          ) : null}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {empresa.razonSocial}
                        </span>
                      </span>
                      {cambiandoId === empresa.id ? (
                        <IconLoader2 className="size-4 shrink-0 animate-spin text-primary" />
                      ) : activa ? (
                        <IconCheck className="size-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {totalPaginas > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {paginaSegura + 1} de {totalPaginas}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Página anterior de empresas"
                disabled={paginaSegura === 0}
                onClick={() => setPagina((valor) => Math.max(valor - 1, 0))}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Página siguiente de empresas"
                disabled={paginaSegura >= totalPaginas - 1}
                onClick={() =>
                  setPagina((valor) => Math.min(valor + 1, totalPaginas - 1))
                }
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-0.5 border-t border-border p-2">
          {esAdminGlobal ? (
            <Button
              type="button"
              variant="ghost"
              className="h-9 justify-start gap-2 text-primary hover:text-primary"
              onClick={() => irA("/empresas?nueva=1")}
            >
              <IconPlus className="size-4" />
              Agregar empresa
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-9 justify-start gap-2"
            onClick={() => irA("/empresas")}
          >
            <IconBuilding className="size-4" />
            Gestionar empresas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
