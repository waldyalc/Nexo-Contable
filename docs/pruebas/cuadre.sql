-- =============================================================================
-- Nexo Contable · Consultas de verificación contable
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase o con psql:
--
--   psql "$DATABASE_URL" -f docs/pruebas/cuadre.sql
--
-- Cada consulta devuelve SOLO filas problemáticas: si no devuelve nada, el
-- control pasó. Los montos se muestran como NUMERIC(14,2) en pesos dominicanos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cuadre global de todos los asientos contabilizados
-- -----------------------------------------------------------------------------
select
  count(distinct a.id)                        as asientos,
  coalesce(sum(l.debito), 0)::numeric(14, 2)  as total_debito,
  coalesce(sum(l.credito), 0)::numeric(14, 2) as total_credito,
  coalesce(sum(l.debito), 0) - coalesce(sum(l.credito), 0) as diferencia
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id
where a.estado in ('posted', 'reversed', 'reversal');

-- -----------------------------------------------------------------------------
-- 2. Cuadre por empresa (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
select
  a.empresa_id,
  e.nombre_comercial,
  sum(l.debito)::numeric(14, 2)  as total_debito,
  sum(l.credito)::numeric(14, 2) as total_credito,
  (sum(l.debito) - sum(l.credito))::numeric(14, 2) as diferencia
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id
join public.empresas e on e.id = a.empresa_id
where a.estado in ('posted', 'reversed', 'reversal')
group by a.empresa_id, e.nombre_comercial
having sum(l.debito) <> sum(l.credito);

-- -----------------------------------------------------------------------------
-- 3. Asientos individuales descuadrados (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
select
  a.id,
  a.empresa_id,
  a.numero,
  a.fecha,
  sum(l.debito)::numeric(14, 2)  as total_debito,
  sum(l.credito)::numeric(14, 2) as total_credito
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id
where a.estado in ('posted', 'reversed', 'reversal')
group by a.id, a.empresa_id, a.numero, a.fecha
having sum(l.debito) <> sum(l.credito);

-- -----------------------------------------------------------------------------
-- 4. Asientos contabilizados con menos de 2 líneas (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
select a.id, a.empresa_id, a.numero, count(l.id) as lineas
from public.asientos a
left join public.asiento_lineas l on l.asiento_id = a.id
where a.estado in ('posted', 'reversed', 'reversal')
group by a.id, a.empresa_id, a.numero
having count(l.id) < 2;

-- -----------------------------------------------------------------------------
-- 5. Líneas contabilizadas en cuentas de agrupación o con subcuentas
-- -----------------------------------------------------------------------------
select distinct
  a.empresa_id,
  a.numero,
  c.codigo,
  c.nombre,
  c.es_agrupacion
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id
join public.cuentas c on c.id = l.cuenta_id
where a.estado in ('posted', 'reversed', 'reversal')
  and (
    c.es_agrupacion = true
    or exists (select 1 from public.cuentas h where h.padre_id = c.id)
  );

-- -----------------------------------------------------------------------------
-- 6. Líneas contabilizadas en cuentas inactivas (debe devolver 0 filas)
-- -----------------------------------------------------------------------------
select distinct a.empresa_id, a.numero, c.codigo, c.nombre
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id
join public.cuentas c on c.id = l.cuenta_id
where a.estado in ('posted', 'reversed', 'reversal')
  and c.activa = false;

-- -----------------------------------------------------------------------------
-- 7. Líneas cuyo empresa_id no coincide con la empresa del asiento
-- -----------------------------------------------------------------------------
select l.id, l.asiento_id, l.empresa_id as empresa_linea, a.empresa_id as empresa_asiento
from public.asiento_lineas l
join public.asientos a on a.id = l.asiento_id
where l.empresa_id <> a.empresa_id;

-- -----------------------------------------------------------------------------
-- 8. Asientos contabilizados fuera de un periodo abierto
-- -----------------------------------------------------------------------------
select a.id, a.empresa_id, a.numero, a.fecha
from public.asientos a
where a.estado in ('posted', 'reversal')
  and not exists (
    select 1
    from public.periodos_contables pc
    where pc.empresa_id = a.empresa_id
      and pc.estado = 'open'
      and a.fecha between pc.fecha_inicio and pc.fecha_fin
  );

-- -----------------------------------------------------------------------------
-- 9. Documentos contabilizados sin asiento
-- -----------------------------------------------------------------------------
select d.id, d.empresa_id, d.tipo, d.numero, d.estado
from public.documentos_financieros d
where d.estado = 'posted'
  and d.asiento_id is null;

-- -----------------------------------------------------------------------------
-- 10. Documentos cuyos pagos activos exceden el total
-- -----------------------------------------------------------------------------
select
  d.empresa_id,
  d.numero,
  d.total::numeric(14, 2)                     as total_documento,
  coalesce(sum(p.monto), 0)::numeric(14, 2)   as pagos_activos
from public.documentos_financieros d
join public.documento_pagos p
  on p.documento_id = d.id and p.estado = 'active'
group by d.id, d.empresa_id, d.numero, d.total
having coalesce(sum(p.monto), 0) > d.total;

-- -----------------------------------------------------------------------------
-- 11. Documentos cuyo total no coincide con sus componentes
-- -----------------------------------------------------------------------------
select id, empresa_id, numero, subtotal, impuesto, otros_impuestos, retenciones, total
from public.documentos_financieros
where round(subtotal + impuesto + otros_impuestos - retenciones, 2) <> total;

-- -----------------------------------------------------------------------------
-- 12. Notas de crédito vigentes que exceden el saldo del documento acreditado
-- -----------------------------------------------------------------------------
with pagos as (
  select documento_id, sum(monto) as pagado
  from public.documento_pagos
  where estado = 'active'
  group by documento_id
),
notas as (
  select documento_acreditado_id, sum(total) as acreditado
  from public.documentos_financieros
  where estado = 'posted' and documento_acreditado_id is not null
  group by documento_acreditado_id
)
select
  d.id,
  d.empresa_id,
  d.numero,
  d.total,
  coalesce(no.acreditado, 0) as total_notas_credito,
  coalesce(pg.pagado, 0)     as total_pagos
from public.documentos_financieros d
left join pagos pg on pg.documento_id = d.id
left join notas no on no.documento_acreditado_id = d.id
where d.estado = 'posted'
  and coalesce(no.acreditado, 0) + coalesce(pg.pagado, 0) > d.total;

-- -----------------------------------------------------------------------------
-- 13. Inventario con cantidad o valor negativo
-- -----------------------------------------------------------------------------
select id, empresa_id, sku, nombre, cantidad_disponible, valor_total
from public.articulos_inventario
where cantidad_disponible < 0 or valor_total < 0;

-- -----------------------------------------------------------------------------
-- 14. Secuencias NCF/e-CF agotadas o cerca de agotarse (≤ 50 comprobantes)
-- -----------------------------------------------------------------------------
select
  empresa_id,
  tipo_comprobante,
  prefijo,
  numero_actual,
  numero_final,
  (numero_final - numero_actual) as disponibles
from public.secuencias_ncf
where activo = true
  and (numero_final - numero_actual) <= 50
order by disponibles asc;

-- -----------------------------------------------------------------------------
-- 15. Usuarios de Auth sin perfil en public.perfiles
-- -----------------------------------------------------------------------------
select u.id, u.email, u.created_at
from auth.users u
left join public.perfiles p on p.user_id = u.id
where p.user_id is null;

-- -----------------------------------------------------------------------------
-- 16. Empresas sin ningún periodo contable abierto
-- -----------------------------------------------------------------------------
select e.id, e.nombre_comercial, e.rnc
from public.empresas e
where not exists (
  select 1
  from public.periodos_contables pc
  where pc.empresa_id = e.id
    and pc.estado = 'open'
);

-- -----------------------------------------------------------------------------
-- 17. Perfiles sin ninguna empresa asignada (excluye admin_global)
-- -----------------------------------------------------------------------------
select p.user_id, p.email, p.rol_global
from public.perfiles p
where p.activo = true
  and p.rol_global <> 'admin_global'
  and not exists (
    select 1 from public.empresa_usuarios eu where eu.user_id = p.user_id
  );

-- -----------------------------------------------------------------------------
-- 18. Asientos de reverso que no apuntan a su asiento original
-- -----------------------------------------------------------------------------
select a.id, a.empresa_id, a.numero, a.reverso_de, a.estado
from public.asientos a
where a.estado = 'reversal'
  and (
    a.reverso_de is null
    or not exists (
      select 1
      from public.asientos original
      where original.id = a.reverso_de
        and original.revertido_por = a.id
        and original.estado = 'reversed'
    )
  );
