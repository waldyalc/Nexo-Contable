"use client";

import { type ReactNode, useState } from "react";

import { PaletaComandos } from "@/components/shell/paleta-comandos";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Topbar } from "@/components/shell/topbar";
import type { ContextoApp } from "@/lib/auth/sesion";

export interface AppShellProps {
  contexto: ContextoApp;
  children: ReactNode;
}

/**
 * Shell de la aplicación autenticada: sidebar fija, topbar sticky y el
 * lienzo `#f6f7f5` con el contenido de cada módulo.
 */
export function AppShell({ contexto, children }: AppShellProps) {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [paletaAbierta, setPaletaAbierta] = useState(false);

  return (
    <div className="nexo-shell flex min-h-screen bg-background print:block print:bg-white">
      <div className="nexo-shell-navegacion contents print:hidden">
        <SidebarNav
          contexto={contexto}
          menuMovilAbierto={menuMovilAbierto}
          onMenuMovilChange={setMenuMovilAbierto}
        />
      </div>

      <div className="nexo-shell-contenido flex min-w-0 flex-1 flex-col print:block">
        <Topbar
          contexto={contexto}
          onAbrirMenu={() => setMenuMovilAbierto(true)}
          onAbrirPaleta={() => setPaletaAbierta(true)}
        />
        <main className="nexo-shell-main mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 lg:px-6 print:block print:max-w-none print:px-0 print:py-0">
          {children}
        </main>
      </div>

      <PaletaComandos
        abierto={paletaAbierta}
        onAbiertoChange={setPaletaAbierta}
        rolActivo={contexto.rolActivo}
        empresa={contexto.empresaActiva}
      />
    </div>
  );
}
