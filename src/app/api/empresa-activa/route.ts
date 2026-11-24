import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE_EMPRESA_ACTIVA } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/server";

const esquema = z.object({
  empresaId: z.string().uuid("Identificador de empresa inválido."),
});

/**
 * Cambia la empresa activa del usuario. La cookie solo se escribe después de
 * confirmar que la empresa existe y es visible para el usuario según RLS.
 */
export async function POST(request: Request) {
  const cuerpo: unknown = await request.json().catch(() => null);
  const resultado = esquema.safeParse(cuerpo);

  if (!resultado.success) {
    return NextResponse.json(
      { error: "Identificador de empresa inválido." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "La sesión expiró. Inicia sesión de nuevo." },
      { status: 401 },
    );
  }

  const { empresaId } = resultado.data;

  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "No tienes acceso a esa empresa." },
      { status: 404 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_EMPRESA_ACTIVA, empresaId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true, empresaId });
}
