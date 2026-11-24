import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "./types";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

/** Rutas accesibles sin sesión (login y retorno de Google OAuth). */
const PUBLIC_PATHS = ["/login", "/auth/callback"];

/** Rutas que exigen sesión pero quedan fuera del shell de la aplicación. */
const RUTAS_AUTENTICADAS = ["/definir-password"];

function coincideRuta(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => coincideRuta(pathname, p));
  const requiereSesion = RUTAS_AUTENTICADAS.some((p) =>
    coincideRuta(pathname, p),
  );

  // Toda ruta que no sea pública exige sesión: el primer ingreso pasa por
  // `/definir-password` antes de entrar al shell multi-empresa.
  if (!isAuthenticated && (!isPublic || requiereSesion)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // Un usuario con sesión que vuelve al login entra directo a la aplicación;
  // `obtenerContextoApp()` lo manda a `/definir-password` si aún no tiene clave.
  if (isAuthenticated && coincideRuta(pathname, "/login")) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return supabaseResponse;
}
