-- =============================================================================
-- Nexo Contable · Ajuste de autorización multi-empresa y reversos en reportes
-- =============================================================================
-- 1. `public.exigir_rol_empresa(uuid, text[])` autoriza automáticamente a
--    `admin_global` (además de los roles de empresa indicados en `p_roles`) y
--    otorga EXECUTE a `authenticated` para que los reportes SECURITY INVOKER
--    puedan invocarla respetando RLS.
-- 2. Todos los reportes contables incluyen `a.estado in ('posted', 'reversed',
--    'reversal')` para que un asiento revertido y su contrapartida de reverso
--    se neteen exactamente a 0.00 y conserven pista completa de auditoría.
-- =============================================================================

create or replace function public.exigir_rol_empresa(
  p_empresa_id uuid,
  p_roles text[]
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rol text;
begin
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Debe indicar al menos un rol permitido' using errcode = '22023';
  end if;

  v_rol := public.rol_en_empresa(p_empresa_id);

  if v_rol is null then
    raise exception 'Permiso denegado para la empresa % (rol requerido: %)',
      p_empresa_id, array_to_string(p_roles, ', ')
      using errcode = '42501';
  end if;

  if v_rol = 'admin_global' or v_rol = any (p_roles) then
    return v_rol;
  end if;

  raise exception 'Permiso denegado para la empresa % (rol requerido: %)',
    p_empresa_id, array_to_string(p_roles, ', ')
    using errcode = '42501';
end;
$$;

revoke all on function public.exigir_rol_empresa(uuid, text[]) from public, anon;
grant execute on function public.exigir_rol_empresa(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Balanza de comprobación (incluye 'reversed' para neteo exacto con 'reversal')
-- ---------------------------------------------------------------------------

create or replace function public.reporte_balanza_comprobacion(
  p_empresa_id uuid,
  p_desde date,
  p_hasta date
)
returns table (
  cuenta_id uuid,
  codigo text,
  nombre text,
  clasificacion text,
  naturaleza text,
  saldo_anterior numeric,
  debitos numeric,
  creditos numeric,
  saldo_actual numeric
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
  select
    c.id,
    c.codigo,
    c.nombre,
    c.clasificacion,
    c.naturaleza,
    round(coalesce(ant.saldo, 0), 2) as saldo_anterior,
    round(coalesce(mov.debitos, 0), 2) as debitos,
    round(coalesce(mov.creditos, 0), 2) as creditos,
    round(
      coalesce(ant.saldo, 0) + coalesce(mov.debitos, 0) - coalesce(mov.creditos, 0),
      2
    ) as saldo_actual
  from public.cuentas c
  left join lateral (
    select sum(l.debito - l.credito) as saldo
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
    where a.empresa_id = c.empresa_id
      and l.cuenta_id = c.id
      and a.estado in ('posted', 'reversed', 'reversal')
      and a.fecha < p_desde
  ) ant on true
  left join lateral (
    select sum(l.debito) as debitos, sum(l.credito) as creditos
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
    where a.empresa_id = c.empresa_id
      and l.cuenta_id = c.id
      and a.estado in ('posted', 'reversed', 'reversal')
      and a.fecha between p_desde and p_hasta
  ) mov on true
  where c.empresa_id = p_empresa_id
    and not c.es_agrupacion
    and (
      coalesce(ant.saldo, 0) <> 0
      or coalesce(mov.debitos, 0) <> 0
      or coalesce(mov.creditos, 0) <> 0
    )
  order by c.codigo;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Libro mayor por cuenta
-- ---------------------------------------------------------------------------

create or replace function public.reporte_libro_mayor(
  p_empresa_id uuid,
  p_cuenta_id uuid,
  p_desde date,
  p_hasta date
)
returns table (
  fecha date,
  asiento_id uuid,
  asiento_numero text,
  referencia text,
  descripcion text,
  debito numeric,
  credito numeric,
  saldo numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_codigo text;
  v_anterior numeric(14, 2);
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if p_desde > p_hasta then
    raise exception 'el rango de fechas es inválido' using errcode = '22023';
  end if;

  select c.codigo into v_codigo
    from public.cuentas c
   where c.id = p_cuenta_id and c.empresa_id = p_empresa_id;

  if not found then
    raise exception 'cuenta contable no encontrada' using errcode = '22023';
  end if;

  select coalesce(sum(l.debito - l.credito), 0)
    into v_anterior
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
   where a.empresa_id = p_empresa_id
     and l.cuenta_id = p_cuenta_id
     and a.estado in ('posted', 'reversed', 'reversal')
     and a.fecha < p_desde;

  return query
  select
    a.fecha,
    a.id,
    a.numero,
    coalesce(a.referencia, ''),
    l.descripcion,
    l.debito,
    l.credito,
    round(
      v_anterior + sum(l.debito - l.credito) over (
        order by a.fecha, a.numero, l.linea
      ),
      2
    ) as saldo
  from public.asiento_lineas l
  join public.asientos a on a.id = l.asiento_id
  where a.empresa_id = p_empresa_id
    and l.cuenta_id = p_cuenta_id
    and a.estado in ('posted', 'reversed', 'reversal')
    and a.fecha between p_desde and p_hasta
  order by a.fecha, a.numero, l.linea;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Estado de resultados
-- ---------------------------------------------------------------------------

create or replace function public.reporte_estado_resultados(
  p_empresa_id uuid,
  p_desde date,
  p_hasta date
)
returns table (
  clasificacion text,
  cuenta_id uuid,
  codigo text,
  nombre text,
  debitos numeric,
  creditos numeric,
  monto numeric
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
  select
    c.clasificacion,
    c.id,
    c.codigo,
    c.nombre,
    round(coalesce(sum(l.debito), 0), 2) as debitos,
    round(coalesce(sum(l.credito), 0), 2) as creditos,
    round(
      case
        when c.clasificacion = 'income'
          then coalesce(sum(l.credito), 0) - coalesce(sum(l.debito), 0)
        else coalesce(sum(l.debito), 0) - coalesce(sum(l.credito), 0)
      end,
      2
    ) as monto
  from public.cuentas c
  join public.asiento_lineas l on l.cuenta_id = c.id
  join public.asientos a on a.id = l.asiento_id
  where c.empresa_id = p_empresa_id
    and not c.es_agrupacion
    and c.clasificacion in ('income', 'cost', 'expense')
    and a.empresa_id = p_empresa_id
    and a.estado in ('posted', 'reversed', 'reversal')
    and a.fecha between p_desde and p_hasta
  group by c.id, c.clasificacion, c.codigo, c.nombre
  having (
    coalesce(sum(l.debito), 0) <> 0 or coalesce(sum(l.credito), 0) <> 0
  )
  order by c.clasificacion, c.codigo;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Balance general
-- ---------------------------------------------------------------------------

create or replace function public.reporte_balance_general(
  p_empresa_id uuid,
  p_fecha_corte date
)
returns table (
  clasificacion text,
  cuenta_id uuid,
  codigo text,
  nombre text,
  monto numeric
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

  return query
  select
    c.clasificacion,
    c.id,
    c.codigo,
    c.nombre,
    round(
      case
        when c.clasificacion = 'asset'
          then coalesce(sum(l.debito), 0) - coalesce(sum(l.credito), 0)
        else coalesce(sum(l.credito), 0) - coalesce(sum(l.debito), 0)
      end,
      2
    ) as monto
  from public.cuentas c
  join public.asiento_lineas l on l.cuenta_id = c.id
  join public.asientos a on a.id = l.asiento_id
  where c.empresa_id = p_empresa_id
    and not c.es_agrupacion
    and c.clasificacion in ('asset', 'liability', 'equity')
    and a.empresa_id = p_empresa_id
    and a.estado in ('posted', 'reversed', 'reversal')
    and a.fecha <= coalesce(p_fecha_corte, current_date)
  group by c.id, c.clasificacion, c.codigo, c.nombre
  having (
    coalesce(sum(l.debito), 0) <> 0 or coalesce(sum(l.credito), 0) <> 0
  )
  order by c.clasificacion, c.codigo;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Flujo de efectivo
-- ---------------------------------------------------------------------------

create or replace function public.reporte_flujo_efectivo(
  p_empresa_id uuid,
  p_desde date,
  p_hasta date
)
returns table (
  categoria text,
  monto numeric
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
  with asientos_efectivo as (
    select distinct a.id
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    join public.cuentas c on c.id = l.cuenta_id
    where a.empresa_id = p_empresa_id
      and a.estado in ('posted', 'reversed', 'reversal')
      and a.fecha between p_desde and p_hasta
      and c.es_equivalente_efectivo
  )
  select
    coalesce(c.categoria_flujo_efectivo, 'other') as categoria,
    round(sum(l.credito - l.debito), 2) as monto
  from asientos_efectivo ae
  join public.asientos a on a.id = ae.id
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  where not c.es_equivalente_efectivo
  group by coalesce(c.categoria_flujo_efectivo, 'other')
  having sum(l.credito - l.debito) <> 0
  order by
    case coalesce(c.categoria_flujo_efectivo, 'other')
      when 'operating' then 1
      when 'investing' then 2
      when 'financing' then 3
      else 4
    end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Resumen por empresa
-- ---------------------------------------------------------------------------

create or replace function public.reporte_resumen_empresa(
  p_empresa_id uuid,
  p_desde date,
  p_hasta date
)
returns table (
  empresa_id uuid,
  empresa text,
  ventas numeric,
  notas_credito_venta numeric,
  compras numeric,
  notas_credito_compra numeric,
  itbis_ventas numeric,
  itbis_compras numeric,
  total_activos numeric,
  total_pasivos numeric,
  total_patrimonio numeric,
  resultado numeric,
  efectivo numeric,
  documentos_pendientes integer,
  asientos integer
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
  select
    e.id,
    e.nombre_comercial,
    round(coalesce(dv.monto, 0), 2) as ventas,
    round(coalesce(ncv.monto, 0), 2) as notas_credito_venta,
    round(coalesce(dc.monto, 0), 2) as compras,
    round(coalesce(ncc.monto, 0), 2) as notas_credito_compra,
    round(coalesce(dv.impuesto, 0), 2) as itbis_ventas,
    round(coalesce(dc.impuesto, 0), 2) as itbis_compras,
    round(coalesce(b.activos, 0), 2) as total_activos,
    round(coalesce(b.pasivos, 0), 2) as total_pasivos,
    round(coalesce(b.patrimonio, 0), 2) as total_patrimonio,
    round(coalesce(r.resultado, 0), 2) as resultado,
    round(coalesce(b.efectivo, 0), 2) as efectivo,
    coalesce(pd.cantidad, 0)::integer as documentos_pendientes,
    coalesce(cnt.cantidad, 0)::integer as asientos
  from public.empresas e
  left join lateral (
    select sum(d.total) as monto, sum(d.impuesto) as impuesto
    from public.documentos_financieros d
    where d.empresa_id = e.id
      and d.tipo = 'sales_invoice'
      and d.estado = 'posted'
      and d.fecha_emision between p_desde and p_hasta
  ) dv on true
  left join lateral (
    select sum(d.total) as monto
    from public.documentos_financieros d
    where d.empresa_id = e.id
      and d.tipo = 'sales_credit'
      and d.estado = 'posted'
      and d.fecha_emision between p_desde and p_hasta
  ) ncv on true
  left join lateral (
    select sum(d.total) as monto, sum(d.impuesto) as impuesto
    from public.documentos_financieros d
    where d.empresa_id = e.id
      and d.tipo = 'purchase_invoice'
      and d.estado = 'posted'
      and d.fecha_emision between p_desde and p_hasta
  ) dc on true
  left join lateral (
    select sum(d.total) as monto
    from public.documentos_financieros d
    where d.empresa_id = e.id
      and d.tipo = 'purchase_credit'
      and d.estado = 'posted'
      and d.fecha_emision between p_desde and p_hasta
  ) ncc on true
  left join lateral (
    select
      coalesce(sum(l.debito - l.credito)
        filter (where c.clasificacion = 'asset'), 0) as activos,
      coalesce(sum(l.credito - l.debito)
        filter (where c.clasificacion = 'liability'), 0) as pasivos,
      coalesce(sum(l.credito - l.debito)
        filter (where c.clasificacion = 'equity'), 0) as patrimonio,
      coalesce(sum(
        case when c.es_equivalente_efectivo then l.debito - l.credito else 0 end
      ), 0) as efectivo
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
    join public.cuentas c on c.id = l.cuenta_id
    where a.empresa_id = e.id
      and a.estado in ('posted', 'reversed', 'reversal')
      and a.fecha <= p_hasta
  ) b on true
  left join lateral (
    select sum(l.credito - l.debito) as resultado
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
    join public.cuentas c on c.id = l.cuenta_id
    where a.empresa_id = e.id
      and a.estado in ('posted', 'reversed', 'reversal')
      and a.fecha between p_desde and p_hasta
      and c.clasificacion in ('income', 'cost', 'expense')
  ) r on true
  left join lateral (
    select count(*) as cantidad
    from public.documentos_financieros d
    where d.empresa_id = e.id
      and d.estado = 'posted'
      and d.tipo in ('sales_invoice', 'purchase_invoice')
      and (
        d.total
        - coalesce((
            select sum(p.monto) from public.documento_pagos p
            where p.documento_id = d.id and p.estado = 'active'
          ), 0)
        - coalesce((
            select sum(nc.total) from public.documentos_financieros nc
            where nc.documento_acreditado_id = d.id and nc.estado = 'posted'
          ), 0)
      ) > 0
  ) pd on true
  left join lateral (
    select count(*) as cantidad
    from public.asientos a
    where a.empresa_id = e.id
      and a.estado in ('posted', 'reversed', 'reversal')
      and a.fecha between p_desde and p_hasta
  ) cnt on true
  where e.id = p_empresa_id;
end;
$$;
