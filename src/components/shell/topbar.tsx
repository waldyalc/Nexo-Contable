"use client";

import { IconMenu2 } from "@tabler/icons-react";
import { usePathname } from "next/navigation";

import { MigasDePan } from "@/components/pagina/migas-de-pan";
import { AlternadorTema } from "@/components/shell/alternador-tema";
import { CompanySwitcher } from "@/components/shell/company-switcher";
import { migasParaRuta } from "@/components/shell/navegacion";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import type { ContextoApp } from "@/lib/auth/sesion";

export interface TopbarProps {
  contexto: ContextoApp;
  onAbrirMenu: () => void;
}

/**
 * Barra superior sticky de 68 px: menú móvil, migas de pan, selector
 * "Mis empresas" y menú desplegable del perfil del usuario.
 */
export function Topbar({ contexto, onAbrirMenu }: TopbarProps) {
  const pathname = usePathname();
  const migas = migasParaRuta(pathname);

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
        <AlternadorTema />

        <div className="border-l border-border pl-2 sm:pl-3">
          <UserMenu contexto={contexto} />
        </div>
      </div>
    </header>
  );
}
