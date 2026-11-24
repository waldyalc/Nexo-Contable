"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  GRUPOS_NAVEGACION,
  filtrarGruposPorRol,
} from "@/components/shell/navegacion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ContextoApp } from "@/lib/auth/sesion";
import { cn } from "@/lib/utils";

interface ContenidoSidebarProps {
  contexto: ContextoApp;
  onNavegar?: () => void;
}

function ContenidoSidebar({ contexto, onNavegar }: ContenidoSidebarProps) {
  const pathname = usePathname();
  const grupos = filtrarGruposPorRol(GRUPOS_NAVEGACION, contexto.rolActivo);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-border px-4 pr-12">
        <span className="font-display flex size-9 items-center justify-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground shadow-[0_6px_16px_rgba(23,107,83,0.22)]">
          N
        </span>
        <span className="font-display truncate text-base font-bold tracking-[-0.03em] text-foreground">
          Nexo Contable
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="mb-4 flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {grupo.titulo}
            </p>
            {grupo.items.map((item) => {
              const activo =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icono = item.icono;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={onNavegar}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm font-medium transition-colors",
                    activo
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icono
                    className={cn(
                      "size-4 shrink-0",
                      activo ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="truncate">{item.etiqueta}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

export interface SidebarNavProps {
  contexto: ContextoApp;
  menuMovilAbierto: boolean;
  onMenuMovilChange: (abierto: boolean) => void;
}

/** Sidebar fija de 248 px en escritorio y `Sheet` deslizante en móvil. */
export function SidebarNav({
  contexto,
  menuMovilAbierto,
  onMenuMovilChange,
}: SidebarNavProps) {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-border lg:flex lg:flex-col">
        <ContenidoSidebar contexto={contexto} />
      </aside>

      <Sheet open={menuMovilAbierto} onOpenChange={onMenuMovilChange}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SheetDescription className="sr-only">
            Navegación principal de Nexo Contable
          </SheetDescription>
          <ContenidoSidebar
            contexto={contexto}
            onNavegar={() => onMenuMovilChange(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
