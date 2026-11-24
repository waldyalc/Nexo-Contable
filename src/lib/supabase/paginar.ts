/**
 * Pagina lecturas en lotes de 1,000 filas para evitar el truncamiento
 * silencioso de PostgREST (max_rows = 1000).
 */
export async function paginarConsulta<T>(
  ejecutarPagina: (
    desde: number,
    hasta: number,
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  tamanoLote = 1000,
): Promise<T[]> {
  const acumulado: T[] = [];
  let desde = 0;

  while (true) {
    const hasta = desde + tamanoLote - 1;
    const { data, error } = await ejecutarPagina(desde, hasta);
    if (error) {
      throw new Error(error.message);
    }
    const filas = data ?? [];
    acumulado.push(...filas);
    if (filas.length < tamanoLote) {
      break;
    }
    desde += tamanoLote;
  }

  return acumulado;
}
