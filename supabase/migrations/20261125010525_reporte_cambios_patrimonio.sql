-- =============================================================================
-- Nexo Contable · Reporte de cambios en el patrimonio
-- =============================================================================
-- Función de solo lectura STABLE SECURITY INVOKER con search_path = ''.
-- Como el resto de reportes contables, respeta RLS multi-empresa y exige rol
-- en la empresa. Incluye asientos 'posted', 'reversed' y 'reversal' para que
-- los reversos conserven pista de auditoría y neteen exactamente a 0.00.
--
-- Convención de signos:
--   · Las cuentas de patrimonio se presentan con saldo acreedor positivo
--     (créditos - débitos), igual que en el balance general.
--   · La fila "Resultado del período" resume ingresos - costos - gastos con el
--     mismo criterio del estado de resultados. Sus débitos y créditos son los
--     movimientos brutos de esas cuentas del período; el movimiento neto es el
--     resultado contable del período.
-- =============================================================================

create or replace function public.reporte_cambios_patrimonio(
  p_empresa_id uuid,
  p_desde date,
  p_hasta date
)
returns table (
  tipo_fila text,
  cuenta_id uuid,
  codigo text,
  nombre text,
  saldo_inicial numeric,
  debitos numeric,
  creditos numeric,
  movimiento_neto numeric,
  saldo_final numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if p_desde > p_hasta then
    raise exception 'el rango de fechas es inválido' using errcode = '22023';
  end if;

  return query
  with cuentas_patrimonio as (
    select
      c.id,
      c.codigo,
      c.nombre,
      round(
        coalesce(
          sum(l.credito - l.debito) filter (where a.fecha < p_desde),
          0
        ),
        2
      ) as saldo_inicial,
      round(
        coalesce(
          sum(l.debito) filter (where a.fecha between p_desde and p_hasta),
          0
        ),
        2
      ) as debitos,
      round(
        coalesce(
          sum(l.credito) filter (where a.fecha between p_desde and p_hasta),
          0
        ),
        2
      ) as creditos,
      round(
        coalesce(
          sum(l.credito - l.debito) filter (where a.fecha <= p_hasta),
          0
        ),
        2
      ) as saldo_final
    from public.cuentas c
    left join public.asiento_lineas l on l.cuenta_id = c.id
    left join public.asientos a
      on a.id = l.asiento_id
      and a.empresa_id = c.empresa_id
      and a.estado in ('posted', 'reversed', 'reversal')
    where c.empresa_id = p_empresa_id
      and not c.es_agrupacion
      and c.clasificacion = 'equity'
    group by c.id, c.codigo, c.nombre
  ),
  patrimonio as (
    select
      cp.id,
      cp.codigo,
      cp.nombre,
      cp.saldo_inicial,
      cp.debitos,
      cp.creditos,
      round(cp.creditos - cp.debitos, 2) as movimiento_neto,
      cp.saldo_final
    from cuentas_patrimonio cp
    where cp.saldo_inicial <> 0
      or cp.debitos <> 0
      or cp.creditos <> 0
      or cp.saldo_final <> 0
  ),
  resultado_periodo as (
    select
      round(coalesce(sum(l.debito), 0), 2) as debitos,
      round(coalesce(sum(l.credito), 0), 2) as creditos
    from public.cuentas c
    join public.asiento_lineas l on l.cuenta_id = c.id
    join public.asientos a on a.id = l.asiento_id
    where c.empresa_id = p_empresa_id
      and not c.es_agrupacion
      and c.clasificacion in ('income', 'cost', 'expense')
      and a.empresa_id = p_empresa_id
      and a.estado in ('posted', 'reversed', 'reversal')
      and a.fecha between p_desde and p_hasta
  ),
  filas as (
    select
      1 as orden,
      'cuenta'::text as tipo_fila,
      p.id as cuenta_id,
      p.codigo,
      p.nombre,
      p.saldo_inicial,
      p.debitos,
      p.creditos,
      p.movimiento_neto,
      p.saldo_final
    from patrimonio p

    union all

    select
      2 as orden,
      'resultado'::text as tipo_fila,
      null::uuid as cuenta_id,
      ''::text as codigo,
      'Resultado del período'::text as nombre,
      0::numeric as saldo_inicial,
      rp.debitos,
      rp.creditos,
      round(rp.creditos - rp.debitos, 2) as movimiento_neto,
      round(rp.creditos - rp.debitos, 2) as saldo_final
    from resultado_periodo rp
  ),
  combinado as (
    select
      f.orden,
      f.tipo_fila,
      f.cuenta_id,
      f.codigo,
      f.nombre,
      f.saldo_inicial,
      f.debitos,
      f.creditos,
      f.movimiento_neto,
      f.saldo_final
    from filas f

    union all

    select
      3 as orden,
      'total'::text as tipo_fila,
      null::uuid as cuenta_id,
      ''::text as codigo,
      'Total cambios en el patrimonio'::text as nombre,
      round(coalesce(sum(f.saldo_inicial), 0), 2) as saldo_inicial,
      round(coalesce(sum(f.debitos), 0), 2) as debitos,
      round(coalesce(sum(f.creditos), 0), 2) as creditos,
      round(coalesce(sum(f.movimiento_neto), 0), 2) as movimiento_neto,
      round(coalesce(sum(f.saldo_final), 0), 2) as saldo_final
    from filas f
  )
  select
    combinado.tipo_fila,
    combinado.cuenta_id,
    combinado.codigo,
    combinado.nombre,
    combinado.saldo_inicial,
    combinado.debitos,
    combinado.creditos,
    combinado.movimiento_neto,
    combinado.saldo_final
  from combinado
  order by combinado.orden, combinado.codigo;
end;
$$;

revoke all on function public.reporte_cambios_patrimonio(uuid, date, date)
  from public, anon;
grant execute on function public.reporte_cambios_patrimonio(uuid, date, date)
  to authenticated;
