"use client";

import { type ReactNode, useState } from "react";

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

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav
        contexto={contexto}
        menuMovilAbierto={menuMovilAbierto}
        onMenuMovilChange={setMenuMovilAbierto}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          contexto={contexto}
          onAbrirMenu={() => setMenuMovilAbierto(true)}
        />
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
