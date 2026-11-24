/**
 * Divide arreglos grandes de IDs en lotes de 200 para evitar límites de
 * longitud de URL en filtros `.in(...)` de PostgREST.
 */
export async function consultarEnLotes<TId, TRes>(
  ids: readonly TId[],
  ejecutarLote: (lote: TId[]) => Promise<TRes[]>,
  tamanoLote = 200,
): Promise<TRes[]> {
  if (ids.length === 0) return [];
  const resultados: TRes[] = [];
  for (let i = 0; i < ids.length; i += tamanoLote) {
    const lote = ids.slice(i, i + tamanoLote);
    const parcial = await ejecutarLote(lote);
    resultados.push(...parcial);
  }
  return resultados;
}
