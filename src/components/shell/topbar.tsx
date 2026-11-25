"use client";

import { IconMenu2, IconSearch } from "@tabler/icons-react";
import { usePathname } from "next/navigation";

import { MigasDePan } from "@/components/pagina/migas-de-pan";
import { CompanySwitcher } from "@/components/shell/company-switcher";
import { migasParaRuta } from "@/components/shell/navegacion";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import type { ContextoApp } from "@/lib/auth/sesion";

export interface TopbarProps {
  contexto: ContextoApp;
  onAbrirMenu: () => void;
  onAbrirPaleta: () => void;
}

/**
 * Barra superior sticky de 68 px: menú móvil, migas de pan, selector
 * "Mis empresas" y menú desplegable del perfil del usuario.
 */
export function Topbar({ contexto, onAbrirMenu, onAbrirPaleta }: TopbarProps) {
  const pathname = usePathname();
  const migas = migasParaRuta(pathname);

  return (
    <header className="nexo-shell-topbar sticky top-0 z-30 flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md lg:px-6 print:hidden">
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
        <Button
          type="button"
          variant="outline"
          aria-label="Abrir búsqueda global"
          aria-keyshortcuts="Control+K Meta+K"
          className="h-9 gap-2 border-border bg-muted/40 px-2.5 text-muted-foreground hover:text-foreground"
          onClick={onAbrirPaleta}
        >
          <IconSearch className="size-4 shrink-0" />
          <span className="hidden text-sm md:inline">Buscar…</span>
          <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-flex">
            Ctrl K
          </kbd>
        </Button>

        <CompanySwitcher
          empresas={contexto.empresas}
          empresaActiva={contexto.empresaActiva}
          esAdminGlobal={contexto.esAdminGlobal}
        />
        <div className="border-l border-border pl-2 sm:pl-3">
          <UserMenu contexto={contexto} />
        </div>
      </div>
    </header>
  );
}
