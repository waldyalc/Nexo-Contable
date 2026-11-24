import type { SupabaseClient } from "@supabase/supabase-js";

import type { OpcionSelect } from "@/components/select-campo";
import { paginarConsulta } from "@/lib/supabase/paginar";
import type { Database } from "@/lib/supabase/types";

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
}

/**
 * Opciones `codigo · nombre` de las cuentas de movimiento activas de una
 * empresa, ordenadas por código. Todas las escrituras contables validan la
 * cuenta en el RPC, así que aquí solo se listan las que pueden moverse.
 */
export async function cargarOpcionesCuentas(
  supabase: SupabaseClient<Database>,
  empresaId: string,
): Promise<OpcionSelect[]> {
  const filas = await paginarConsulta<CuentaFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("cuentas")
      .select("id, codigo, nombre")
      .eq("empresa_id", empresaId)
      .eq("es_agrupacion", false)
      .eq("activa", true)
      .order("codigo", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta);
    return { data: (data as CuentaFila[] | null) ?? null, error };
  });

  return filas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
}
