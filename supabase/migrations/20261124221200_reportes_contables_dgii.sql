-- ---------------------------------------------------------------------------
-- Nexo Contable · Ola 1 · Reportes contables y DGII
--
-- Funciones de solo lectura STABLE SECURITY INVOKER con search_path = ''.
-- Al ser SECURITY INVOKER, las políticas RLS multi-empresa siguen aplicando
-- sobre asientos, cuentas y documentos; además se exige rol en la empresa.
--
-- Reportes:
--   1. Balanza de comprobación
--   2. Libro mayor por cuenta
--   3. Estado de resultados
--   4. Balance general
--   5. Flujo de efectivo por categoría
--   6. Antigüedad de saldos CxC / CxP
--   7. Resumen por empresa (KPIs)
--   8. Resumen de la firma (todas las empresas, solo admin_global)
--   9. Formato 606 (compras) con hoja de incluidos/excluidos
--  10. Formato 607 (ventas) con hoja de incluidos/excluidos
--
-- Depende de las migraciones 20261124220000, 20261124220100,
-- 20261124221000 y 20261124221100.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Balanza de comprobación
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
      and a.estado in ('posted', 'reversal')
      and a.fecha < p_desde
  ) ant on true
  left join lateral (
    select sum(l.debito) as debitos, sum(l.credito) as creditos
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
    where a.empresa_id = c.empresa_id
      and l.cuenta_id = c.id
      and a.estado in ('posted', 'reversal')
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
     and a.estado in ('posted', 'reversal')
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
    and a.estado in ('posted', 'reversal')
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
    and a.estado in ('posted', 'reversal')
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
    and a.estado in ('posted', 'reversal')
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
      and a.estado in ('posted', 'reversal')
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
-- 6. Antigüedad de saldos CxC / CxP
-- ---------------------------------------------------------------------------

create or replace function public.reporte_antiguedad_saldos(
  p_empresa_id uuid,
  p_tipo text,
  p_fecha_corte date default current_date
)
returns table (
  documento_id uuid,
  numero text,
  tercero_id uuid,
  tercero text,
  fecha_emision date,
  fecha_vencimiento date,
  dias_vencido integer,
  saldo numeric,
  bucket text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tipo text := lower(btrim(coalesce(p_tipo, '')));
  v_fecha date := coalesce(p_fecha_corte, current_date);
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_tipo not in ('cxc', 'cxp') then
    raise exception 'tipo de antigüedad inválido: % (use cxc o cxp)', p_tipo
      using errcode = '22023';
  end if;

  return query
  with docs as (
    select
      d.id,
      d.numero,
      d.tercero_id,
      d.fecha_emision,
      coalesce(d.fecha_vencimiento, d.fecha_emision) as vencimiento,
      round(
        d.total
        - coalesce((
            select sum(p.monto) from public.documento_pagos p
            where p.documento_id = d.id and p.estado = 'active'
          ), 0)
        - coalesce((
            select sum(nc.total) from public.documentos_financieros nc
            where nc.documento_acreditado_id = d.id and nc.estado = 'posted'
          ), 0),
        2
      ) as saldo
    from public.documentos_financieros d
    where d.empresa_id = p_empresa_id
      and d.estado = 'posted'
      and d.tipo = case when v_tipo = 'cxc' then 'sales_invoice' else 'purchase_invoice' end
      and d.fecha_emision <= v_fecha
  )
  select
    d.id,
    d.numero,
    d.tercero_id,
    t.nombre,
    d.fecha_emision,
    d.vencimiento,
    (v_fecha - d.vencimiento)::integer as dias_vencido,
    d.saldo,
    case
      when (v_fecha - d.vencimiento) <= 0 then 'corriente'
      when (v_fecha - d.vencimiento) <= 30 then '1_30'
      when (v_fecha - d.vencimiento) <= 60 then '31_60'
      when (v_fecha - d.vencimiento) <= 90 then '61_90'
      else 'mas_90'
    end as bucket
  from docs d
  join public.terceros t on t.id = d.tercero_id
  where d.saldo > 0
  order by dias_vencido desc, d.numero;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Resumen por empresa
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
      and a.estado in ('posted', 'reversal')
      and a.fecha <= p_hasta
  ) b on true
  left join lateral (
    select sum(l.credito - l.debito) as resultado
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
    join public.cuentas c on c.id = l.cuenta_id
    where a.empresa_id = e.id
      and a.estado in ('posted', 'reversal')
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
      and a.estado in ('posted', 'reversal')
      and a.fecha between p_desde and p_hasta
  ) cnt on true
  where e.id = p_empresa_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Resumen de la firma (solo admin_global)
-- ---------------------------------------------------------------------------

create or replace function public.reporte_resumen_firma(
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
  if not public.es_admin_global() then
    raise exception 'solo el administrador global puede ver el resumen de la firma'
      using errcode = '42501';
  end if;

  if p_desde > p_hasta then
    raise exception 'el rango de fechas es inválido' using errcode = '22023';
  end if;

  return query
  select r.*
  from public.empresas e
  cross join lateral public.reporte_resumen_empresa(e.id, p_desde, p_hasta) r
  where e.estado = 'active'
  order by e.nombre_comercial;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Formato DGII 606 (compras)
-- ---------------------------------------------------------------------------

create or replace function public.reporte_dgii_606(
  p_empresa_id uuid,
  p_periodo text
)
returns table (
  documento_id uuid,
  tercero_id uuid,
  rnc text,
  nombre text,
  tipo_identificacion text,
  tipo_comprobante text,
  ncf text,
  fecha_comprobante date,
  fecha_pago date,
  monto_facturado numeric,
  base_imponible numeric,
  itbis_facturado numeric,
  retencion_isr numeric,
  retencion_itbis numeric,
  total_retenido numeric,
  incluido boolean,
  motivo_exclusion text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_periodo text := btrim(coalesce(p_periodo, ''));
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_periodo !~ '^[0-9]{6}$' or right(v_periodo, 2)::integer not between 1 and 12 then
    raise exception 'periodo DGII inválido: % (use YYYYMM)', p_periodo using errcode = '22023';
  end if;

  return query
  with base as (
    select
      d.id,
      d.tercero_id,
      t.rnc_normalizado as rnc,
      t.nombre as tercero_nombre,
      coalesce(nullif(d.tipo_ncf, ''), left(d.ncf, 3)) as tipo_ncf,
      d.ncf,
      d.fecha_emision,
      d.estado,
      d.subtotal,
      d.impuesto,
      d.otros_impuestos,
      case when d.tipo = 'purchase_credit' then -1 else 1 end as signo,
      (
        select min(p.fecha_pago) from public.documento_pagos p
        where p.documento_id = d.id and p.estado = 'active'
      ) as fecha_pago,
      case
        when coalesce(d.detalles_fiscales ->> 'retencion_isr', '')
          ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (d.detalles_fiscales ->> 'retencion_isr')::numeric
        else 0
      end as ret_isr,
      case
        when coalesce(d.detalles_fiscales ->> 'retencion_itbis', '')
          ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (d.detalles_fiscales ->> 'retencion_itbis')::numeric
        else 0
      end as ret_itbis
    from public.documentos_financieros d
    join public.terceros t on t.id = d.tercero_id
    where d.empresa_id = p_empresa_id
      and d.tipo in ('purchase_invoice', 'purchase_credit')
      and to_char(d.fecha_emision, 'YYYYMM') = v_periodo
  ),
  calc as (
    select
      b.*,
      case
        when b.estado = 'draft' then 'Documento en borrador'
        when b.estado = 'void' then 'Documento anulado'
        when b.ncf = '' then 'Comprobante sin NCF'
        when b.ncf !~ '^(B(0[1-9]|1[0-7])[0-9]{8}|E(3[1-9]|4[0-7])[0-9]{10})$'
          then 'Comprobante no válido para 606'
        when b.rnc = '' then 'Proveedor sin RNC'
        else null
      end as motivo
    from base b
  )
  select
    c.id,
    c.tercero_id,
    c.rnc,
    c.tercero_nombre,
    case
      when length(c.rnc) = 9 then 'RNC'
      when length(c.rnc) = 11 then 'CEDULA'
      else 'OTRO'
    end,
    c.tipo_ncf,
    c.ncf,
    c.fecha_emision,
    c.fecha_pago,
    round(c.signo * (c.subtotal + c.impuesto + c.otros_impuestos), 2) as monto_facturado,
    round(c.signo * c.subtotal, 2) as base_imponible,
    round(c.signo * c.impuesto, 2) as itbis_facturado,
    round(c.signo * c.ret_isr, 2) as retencion_isr,
    round(c.signo * c.ret_itbis, 2) as retencion_itbis,
    round(c.signo * (c.ret_isr + c.ret_itbis), 2) as total_retenido,
    (c.motivo is null) as incluido,
    c.motivo
  from calc c
  order by c.fecha_emision, c.ncf, c.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Formato DGII 607 (ventas)
-- ---------------------------------------------------------------------------

create or replace function public.reporte_dgii_607(
  p_empresa_id uuid,
  p_periodo text
)
returns table (
  documento_id uuid,
  tercero_id uuid,
  rnc text,
  nombre text,
  tipo_identificacion text,
  tipo_comprobante text,
  ncf text,
  fecha_comprobante date,
  monto_facturado numeric,
  base_imponible numeric,
  itbis_facturado numeric,
  itbis_retenido numeric,
  retencion_renta numeric,
  otros_impuestos numeric,
  total numeric,
  metodo_pago text,
  incluido boolean,
  motivo_exclusion text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_periodo text := btrim(coalesce(p_periodo, ''));
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_periodo !~ '^[0-9]{6}$' or right(v_periodo, 2)::integer not between 1 and 12 then
    raise exception 'periodo DGII inválido: % (use YYYYMM)', p_periodo using errcode = '22023';
  end if;

  return query
  with base as (
    select
      d.id,
      d.tercero_id,
      t.rnc_normalizado as rnc,
      t.nombre as tercero_nombre,
      coalesce(nullif(d.tipo_ncf, ''), left(d.ncf, 3)) as tipo_ncf,
      d.ncf,
      d.fecha_emision,
      d.estado,
      d.subtotal,
      d.impuesto,
      d.otros_impuestos,
      d.total as total_documento,
      case when d.tipo = 'sales_credit' then -1 else 1 end as signo,
      (
        select p.metodo_pago from public.documento_pagos p
        where p.documento_id = d.id and p.estado = 'active'
        order by p.fecha_pago, p.creado_en
        limit 1
      ) as metodo_pago,
      case
        when coalesce(d.detalles_fiscales ->> 'retencion_itbis', '')
          ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (d.detalles_fiscales ->> 'retencion_itbis')::numeric
        else 0
      end as ret_itbis,
      case
        when coalesce(d.detalles_fiscales ->> 'retencion_isr', '')
          ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (d.detalles_fiscales ->> 'retencion_isr')::numeric
        else 0
      end as ret_isr
    from public.documentos_financieros d
    join public.terceros t on t.id = d.tercero_id
    where d.empresa_id = p_empresa_id
      and d.tipo in ('sales_invoice', 'sales_credit')
      and to_char(d.fecha_emision, 'YYYYMM') = v_periodo
  ),
  calc as (
    select
      b.*,
      case
        when b.estado = 'draft' then 'Documento en borrador'
        when b.estado = 'void' then 'Documento anulado'
        when b.ncf = '' then 'Comprobante sin NCF'
        when b.ncf !~ '^(B(0[1-9]|1[0-7])[0-9]{8}|E(3[1-9]|4[0-7])[0-9]{10})$'
          then 'Comprobante no válido para 607'
        when b.rnc = '' then 'Cliente sin RNC ni cédula'
        else null
      end as motivo
    from base b
  )
  select
    c.id,
    c.tercero_id,
    c.rnc,
    c.tercero_nombre,
    case
      when length(c.rnc) = 9 then 'RNC'
      when length(c.rnc) = 11 then 'CEDULA'
      else 'OTRO'
    end,
    c.tipo_ncf,
    c.ncf,
    c.fecha_emision,
    round(c.signo * (c.subtotal + c.impuesto + c.otros_impuestos), 2) as monto_facturado,
    round(c.signo * c.subtotal, 2) as base_imponible,
    round(c.signo * c.impuesto, 2) as itbis_facturado,
    round(c.signo * c.ret_itbis, 2) as itbis_retenido,
    round(c.signo * c.ret_isr, 2) as retencion_renta,
    round(c.signo * c.otros_impuestos, 2) as otros_impuestos,
    round(c.signo * c.total_documento, 2) as total,
    coalesce(c.metodo_pago, ''),
    (c.motivo is null) as incluido,
    c.motivo
  from calc c
  order by c.fecha_emision, c.ncf, c.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Permisos de ejecución (solo authenticated)
-- ---------------------------------------------------------------------------

revoke all on function public.reporte_balanza_comprobacion(uuid, date, date) from public, anon;
revoke all on function public.reporte_libro_mayor(uuid, uuid, date, date) from public, anon;
revoke all on function public.reporte_estado_resultados(uuid, date, date) from public, anon;
revoke all on function public.reporte_balance_general(uuid, date) from public, anon;
revoke all on function public.reporte_flujo_efectivo(uuid, date, date) from public, anon;
revoke all on function public.reporte_antiguedad_saldos(uuid, text, date) from public, anon;
revoke all on function public.reporte_resumen_empresa(uuid, date, date) from public, anon;
revoke all on function public.reporte_resumen_firma(date, date) from public, anon;
revoke all on function public.reporte_dgii_606(uuid, text) from public, anon;
revoke all on function public.reporte_dgii_607(uuid, text) from public, anon;

grant execute on function public.reporte_balanza_comprobacion(uuid, date, date) to authenticated;
grant execute on function public.reporte_libro_mayor(uuid, uuid, date, date) to authenticated;
grant execute on function public.reporte_estado_resultados(uuid, date, date) to authenticated;
grant execute on function public.reporte_balance_general(uuid, date) to authenticated;
grant execute on function public.reporte_flujo_efectivo(uuid, date, date) to authenticated;
grant execute on function public.reporte_antiguedad_saldos(uuid, text, date) to authenticated;
grant execute on function public.reporte_resumen_empresa(uuid, date, date) to authenticated;
grant execute on function public.reporte_resumen_firma(date, date) to authenticated;
grant execute on function public.reporte_dgii_606(uuid, text) to authenticated;
grant execute on function public.reporte_dgii_607(uuid, text) to authenticated;
