"use client";

import { IconChevronDown, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  ETIQUETAS_ROL,
  RUTAS_PERFIL_ADMIN,
  iniciales,
} from "@/components/shell/navegacion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ContextoApp } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface UserMenuProps {
  contexto: ContextoApp;
}

/**
 * Menú de perfil en la esquina superior derecha (estilo Alegra adaptado a Nexo):
 * concentra Configuración, Empresas, Usuarios, Auditoría, Mi perfil y Cerrar sesión.
 */
export function UserMenu({ contexto }: UserMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const nombreVisible =
    contexto.perfil.nombre.trim() === ""
      ? contexto.perfil.email
      : contexto.perfil.nombre;
  const rolVisible = ETIQUETAS_ROL[contexto.rolActivo ?? "usuario"];

  const itemsVisibles = RUTAS_PERFIL_ADMIN.filter(
    (item) =>
      !item.roles ||
      (contexto.rolActivo != null && item.roles.includes(contexto.rolActivo)),
  );

  async function cerrarSesion() {
    setSaliendo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setAbierto(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label="Abrir menú de perfil"
            className="h-10 gap-2 rounded-full border border-transparent px-1.5 hover:border-border hover:bg-muted/60 sm:rounded-[10px] sm:px-2"
          >
            <Avatar size="sm">
              <AvatarFallback>{iniciales(nombreVisible)}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 flex-col text-left sm:flex">
              <span className="max-w-[140px] truncate text-sm leading-tight font-medium text-foreground">
                {nombreVisible}
              </span>
              <span className="max-w-[140px] truncate text-[11px] leading-tight text-muted-foreground">
                {contexto.perfil.email}
              </span>
            </div>
            <IconChevronDown className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
          </Button>
        }
      />

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-lg"
      >
        <div className="border-b border-border px-4 py-3.5">
          <p className="font-display truncate text-sm font-bold text-foreground">
            {nombreVisible}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {contexto.perfil.email}
          </p>
          <span className="mt-2 inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
            {rolVisible}
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 p-2" aria-label="Menú de cuenta">
          {itemsVisibles.map((item) => {
            const activo =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icono = item.icono;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
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
        </nav>

        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            disabled={saliendo}
            onClick={cerrarSesion}
            className="h-9 w-full justify-start gap-2.5 rounded-[10px] px-2.5 text-sm font-medium text-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <IconLogout className="size-4 shrink-0" />
            {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
