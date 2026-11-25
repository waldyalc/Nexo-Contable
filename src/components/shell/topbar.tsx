"use client";

import { CompanySwitcher } from "@/components/shell/company-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import type { ContextoApp } from "@/lib/auth/sesion";
import { IconMenu2, IconSearch } from "@tabler/icons-react";

export interface TopbarProps {
  contexto: ContextoApp;
  onAbrirMenu: () => void;
  onAbrirPaleta: () => void;
}

/**
 * Barra superior sticky de 68 px: menú móvil, búsqueda global amplia a la
 * izquierda en escritorio, selector "Mis empresas" separado y menú del perfil.
 * Las migas de pan viven dentro del encabezado de cada página.
 */
export function Topbar({ contexto, onAbrirMenu, onAbrirPaleta }: TopbarProps) {
  return (
    <header className="nexo-shell-topbar sticky top-0 z-30 grid h-[68px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur-md sm:gap-3 md:flex lg:gap-4 lg:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
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
      </div>

      <div className="flex items-center justify-center md:min-w-0 md:flex-1 md:justify-start">
        <Button
          type="button"
          variant="outline"
          aria-label="Abrir búsqueda global"
          aria-keyshortcuts="Control+K Meta+K"
          className="h-9 gap-2 border-border bg-muted/40 px-3 text-muted-foreground hover:text-foreground md:w-full md:max-w-72 md:justify-between lg:max-w-80 xl:max-w-[26rem]"
          onClick={onAbrirPaleta}
        >
          <span className="flex min-w-0 items-center gap-2">
            <IconSearch className="size-4 shrink-0" />
            <span className="hidden truncate text-sm md:inline">Buscar…</span>
          </span>
          <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
            Ctrl K
          </kbd>
        </Button>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3 md:shrink-0">
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
