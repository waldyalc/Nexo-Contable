import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

interface PerfilAcceso {
  debe_definir_password: boolean | null;
  activo: boolean | null;
}

function redirigir(request: Request, ruta: string) {
  return NextResponse.redirect(new URL(ruta, request.url));
}

/**
 * Retorno de Google OAuth: intercambia el `code` por una sesión, valida que el
 * perfil exista y esté activo y decide entre `/definir-password` y `/dashboard`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const siguiente = searchParams.get("next");

  if (!code) {
    return redirigir(request, "/login?error=auth");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirigir(request, "/login?error=auth");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signOut();
    return redirigir(request, "/login?error=no-autorizado");
  }

  const { data } = await supabase
    .from("perfiles")
    .select("debe_definir_password, activo")
    .eq("user_id", user.id)
    .maybeSingle();

  const perfil = data as PerfilAcceso | null;

  if (!perfil || perfil.activo === false) {
    await supabase.auth.signOut();
    return redirigir(request, "/login?error=no-autorizado");
  }

  if (perfil.debe_definir_password) {
    return redirigir(request, "/definir-password");
  }

  const destino =
    siguiente?.startsWith("/") && !siguiente.startsWith("//")
      ? siguiente
      : "/dashboard";

  return redirigir(request, destino);
}
