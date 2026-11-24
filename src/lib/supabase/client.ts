import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en las variables de entorno.",
    );
  }
  const cliente = createBrowserClient<Database>(url, key);
  // `@supabase/ssr@0.6` declara tres genéricos y `supabase-js@2.119` cinco:
  // el cast conserva el esquema completo (`Functions`, `Tables`) para `rpc`/`from`.
  return cliente as unknown as SupabaseClient<Database>;
}
