import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { obtenerContextoApp } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const contexto = await obtenerContextoApp();

  return <AppShell contexto={contexto}>{children}</AppShell>;
}
