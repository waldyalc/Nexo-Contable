"use client";

import { IconMenu2 } from "@tabler/icons-react";
import { usePathname } from "next/navigation";

import { MigasDePan } from "@/components/pagina/migas-de-pan";
import { CompanySwitcher } from "@/components/shell/company-switcher";
import { iniciales, migasParaRuta } from "@/components/shell/navegacion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ContextoApp } from "@/lib/auth/sesion";

export interface TopbarProps {
  contexto: ContextoApp;
  onAbrirMenu: () => void;
}

/**
 * Barra superior sticky de 68 px: menú móvil, migas de pan, selector
 * "Mis empresas" y avatar del usuario.
 */
export function Topbar({ contexto, onAbrirMenu }: TopbarProps) {
  const pathname = usePathname();
  const migas = migasParaRuta(pathname);
  const nombreVisible =
    contexto.perfil.nombre.trim() === ""
      ? contexto.perfil.email
      : contexto.perfil.nombre;

  return (
    <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Abrir menú"
          onClick={onAbrirMenu}
        >
          <IconMenu2 className="size-5" />
        </Button>
        <MigasDePan items={migas} className="hidden min-w-0 sm:block" />
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <CompanySwitcher
          empresas={contexto.empresas}
          empresaActiva={contexto.empresaActiva}
          esAdminGlobal={contexto.esAdminGlobal}
        />

        <div className="flex min-w-0 items-center gap-2 border-l border-border pl-2 sm:pl-3">
          <Avatar size="sm">
            <AvatarFallback>{iniciales(nombreVisible)}</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="max-w-[150px] truncate text-sm leading-tight font-medium text-foreground">
              {nombreVisible}
            </span>
            <span className="max-w-[150px] truncate text-[11px] leading-tight text-muted-foreground">
              {contexto.perfil.email}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
