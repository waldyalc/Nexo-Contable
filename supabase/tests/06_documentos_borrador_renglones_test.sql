begin;

select no_plan();

-- ---------------------------------------------------------------------------
-- 06 · Borradores, proformas, renglones e inventario de documentos
-- Datos 100% sintéticos; nunca datos reales de clientes.
-- ---------------------------------------------------------------------------

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'sintetico.borrador.a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'sintetico.borrador.b@example.test');

insert into public.perfiles (user_id, email, nombre, rol_global) values
  ('11111111-1111-1111-1111-111111111111', 'sintetico.borrador.a@example.test', 'Usuario Borrador A', 'usuario'),
  ('22222222-2222-2222-2222-222222222222', 'sintetico.borrador.b@example.test', 'Usuario Borrador B', 'usuario')
on conflict (user_id) do nothing;

insert into public.empresas (id, nombre_comercial, razon_social, rnc, rnc_normalizado) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Empresa Borrador A', 'Empresa Borrador A SRL', '505050505', '505050505'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Empresa Borrador B', 'Empresa Borrador B SRL', '606060606', '606060606');

insert into public.empresa_usuarios (user_id, empresa_id, rol, es_principal) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin_empresa', true),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin_empresa', true);

insert into public.periodos_contables (empresa_id, nombre, fecha_inicio, fecha_fin, estado)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Periodo borradores',
  date_trunc('month', current_date)::date - 90,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  'open'
);

insert into public.cuentas (
  id, empresa_id, codigo, nombre, clasificacion, naturaleza,
  nivel, es_agrupacion, activa, es_equivalente_efectivo, categoria_flujo_efectivo
) values
  ('d0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '4101', 'Ingresos', 'income', 'credit', 1, false, true, false, 'operating'),
  ('d0000002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1202', 'Cuentas por cobrar', 'asset', 'debit', 1, false, true, false, 'operating'),
  ('d0000003-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2202', 'ITBIS por pagar', 'liability', 'credit', 1, false, true, false, 'operating'),
  ('d0000004-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1105', 'Inventario', 'asset', 'debit', 1, false, true, false, 'operating'),
  ('d0000005-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5101', 'Costo de venta', 'cost', 'debit', 1, false, true, false, 'operating'),
  ('d0000006-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1101', 'Banco', 'asset', 'debit', 1, false, true, true, 'operating'),
  ('d0000007-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5102', 'Gasto general', 'expense', 'debit', 1, false, true, false, 'operating'),
  ('d0000008-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2101', 'Cuentas por pagar', 'liability', 'credit', 1, false, true, false, 'operating');

insert into public.terceros (id, empresa_id, tipo, nombre, rnc, rnc_normalizado, activo) values
  ('e0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'customer', 'Cliente Borrador', '141414141', '141414141', true),
  ('e0000002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'supplier', 'Proveedor Borrador', '131313131', '131313131', true);

insert into public.articulos_inventario (
  id, empresa_id, sku, nombre, cantidad_disponible, costo_promedio,
  valor_total, precio_venta, cuenta_inventario_id, cuenta_costo_id, cuenta_ingreso_id, activo
) values (
  'f0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ART-BOR-001', 'Artículo borrador', 10, 5, 50, 50,
  'd0000004-0000-0000-0000-000000000004',
  'd0000005-0000-0000-0000-000000000005',
  'd0000001-0000-0000-0000-000000000001', true
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

select public.guardar_metodo_pago(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Crédito proveedor',
  'd0000008-0000-0000-0000-000000000008', true
);

select public.guardar_secuencia_ncf(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B01', 'B01', 1, 100, null, true
);

-- Proforma: borrador sin NCF, sin asiento y sin consumo de secuencia.
insert into _ids (clave, id)
select 'proforma', public.guardar_documento_borrador(
  p_empresa_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  p_tipo := 'sales_invoice',
  p_tercero_id := 'e0000001-0000-0000-0000-000000000001',
  p_fecha_emision := current_date,
  p_concepto := 'Factura proforma de prueba',
  p_cuenta_id := 'd0000001-0000-0000-0000-000000000001',
  p_cuenta_control_id := 'd0000002-0000-0000-0000-000000000002',
  p_subtotal := 100,
  p_impuesto := 18,
  p_numero := 'FV-PROFORMA-0001',
  p_fecha_vencimiento := current_date + 30,
  p_cuenta_impuesto_id := 'd0000003-0000-0000-0000-000000000003',
  p_proforma := true
);

select is(
  (select estado from public.documentos_financieros where id = (select id from _ids where clave = 'proforma')),
  'draft',
  'la factura proforma se guarda como borrador'
);

select is(
  (select ncf from public.documentos_financieros where id = (select id from _ids where clave = 'proforma')),
  '',
  'la proforma queda sin NCF al guardarse'
);

select is(
  (select asiento_id from public.documentos_financieros where id = (select id from _ids where clave = 'proforma')),
  null::uuid,
  'guardar borrador no crea asiento contable'
);

select is(
  (select numero_actual from public.secuencias_ncf
    where empresa_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and tipo_comprobante = 'B01'),
  0::bigint,
  'guardar una proforma no consume la secuencia NCF'
);

select throws_ok(
  format(
    'select public.contabilizar_documento_financiero(%L::uuid, %L::uuid)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'proforma')
  ),
  '22023',
  null,
  'una proforma sin comprobante no se puede contabilizar'
);

select is(
  public.asignar_ncf_documento_borrador(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'proforma'),
    'B01'
  ),
  (select id from _ids where clave = 'proforma'),
  'asignar comprobante devuelve el documento proforma'
);

select is(
  (select ncf from public.documentos_financieros where id = (select id from _ids where clave = 'proforma')),
  'B0100000001',
  'asignar comprobante consume el próximo NCF autorizado'
);

select is(
  public.contabilizar_documento_financiero(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'proforma')
  ),
  (select id from _ids where clave = 'proforma'),
  'la proforma con NCF se puede contabilizar'
);

select is(
  (select count(*)::integer from public.asiento_lineas al
    join public.documentos_financieros d on d.asiento_id = al.asiento_id
    where d.id = (select id from _ids where clave = 'proforma')),
  3,
  'la proforma contabilizada crea CxC, ingreso e ITBIS'
);

-- Edición de borrador: no crea asiento ni cambia estado antes de contabilizar.
insert into _ids (clave, id)
select 'venta_lineas', public.guardar_documento_borrador(
  p_empresa_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  p_tipo := 'sales_invoice',
  p_tercero_id := 'e0000001-0000-0000-0000-000000000001',
  p_fecha_emision := current_date,
  p_concepto := 'Venta con inventario',
  p_cuenta_id := 'd0000001-0000-0000-0000-000000000001',
  p_cuenta_control_id := 'd0000002-0000-0000-0000-000000000002',
  p_subtotal := 0,
  p_impuesto := 18,
  p_numero := 'FV-LINEAS-0001',
  p_tipo_ncf := 'B01',
  p_fecha_vencimiento := current_date + 30,
  p_cuenta_impuesto_id := 'd0000003-0000-0000-0000-000000000003',
  p_lineas := jsonb_build_array(jsonb_build_object(
    'item_id', 'f0000001-0000-0000-0000-000000000001',
    'quantity', 2,
    'unit_price', 50
  ))
);

select is(
  (select ncf from public.documentos_financieros where id = (select id from _ids where clave = 'venta_lineas')),
  'B0100000002',
  'una venta normal reserva su NCF al guardar el borrador'
);

select is(
  (select subtotal from public.documentos_financieros where id = (select id from _ids where clave = 'venta_lineas')),
  100.00::numeric,
  'el subtotal del borrador sale de la suma de renglones'
);

select is(
  public.guardar_documento_borrador(
    p_empresa_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    p_documento_id := (select id from _ids where clave = 'venta_lineas'),
    p_tipo := 'sales_invoice',
    p_tercero_id := 'e0000001-0000-0000-0000-000000000001',
    p_fecha_emision := current_date,
    p_concepto := 'Venta con inventario editada',
    p_cuenta_id := 'd0000001-0000-0000-0000-000000000001',
    p_cuenta_control_id := 'd0000002-0000-0000-0000-000000000002',
    p_subtotal := 100,
    p_impuesto := 18,
    p_numero := 'FV-LINEAS-0001',
    p_ncf := 'B0100000002',
    p_fecha_vencimiento := current_date + 30,
    p_cuenta_impuesto_id := 'd0000003-0000-0000-0000-000000000003'
  ),
  (select id from _ids where clave = 'venta_lineas'),
  'se puede editar el borrador sin contabilizarlo'
);

select is(
  (select asiento_id from public.documentos_financieros where id = (select id from _ids where clave = 'venta_lineas')),
  null::uuid,
  'editar el borrador sigue sin crear asiento'
);

-- Al editar sin renglones el detalle se elimina; lo restauramos antes de contabilizar.
select public.guardar_documento_borrador(
  p_empresa_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  p_documento_id := (select id from _ids where clave = 'venta_lineas'),
  p_tipo := 'sales_invoice',
  p_tercero_id := 'e0000001-0000-0000-0000-000000000001',
  p_fecha_emision := current_date,
  p_concepto := 'Venta con inventario editada',
  p_cuenta_id := 'd0000001-0000-0000-0000-000000000001',
  p_cuenta_control_id := 'd0000002-0000-0000-0000-000000000002',
  p_subtotal := 0,
  p_impuesto := 18,
  p_numero := 'FV-LINEAS-0001',
  p_ncf := 'B0100000002',
  p_fecha_vencimiento := current_date + 30,
  p_cuenta_impuesto_id := 'd0000003-0000-0000-0000-000000000003',
  p_lineas := jsonb_build_array(jsonb_build_object(
    'item_id', 'f0000001-0000-0000-0000-000000000001',
    'quantity', 2,
    'unit_price', 50
  ))
);

select public.contabilizar_documento_financiero(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select id from _ids where clave = 'venta_lineas')
);

select is(
  (select cantidad_disponible from public.articulos_inventario
    where id = 'f0000001-0000-0000-0000-000000000001'),
  8.0000::numeric,
  'contabilizar una venta con artículo descuenta inventario'
);

select is(
  (select count(*)::integer from public.movimientos_inventario m
    join public.documentos_financieros d on d.asiento_id = m.asiento_id
    where d.id = (select id from _ids where clave = 'venta_lineas') and m.tipo = 'out'),
  1,
  'el movimiento de inventario queda enlazado al asiento del documento'
);

select is(
  (select coalesce(sum(al.debito), 0) - coalesce(sum(al.credito), 0)
    from public.asiento_lineas al
    join public.documentos_financieros d on d.asiento_id = al.asiento_id
    where d.id = (select id from _ids where clave = 'venta_lineas')),
  0.00::numeric,
  'el asiento con ingreso, ITBIS, costo e inventario queda cuadrado'
);

select throws_ok(
  format(
    'select public.guardar_documento_borrador(
      p_empresa_id := %L::uuid,
      p_documento_id := %L::uuid,
      p_tipo := ''sales_invoice'',
      p_tercero_id := ''e0000001-0000-0000-0000-000000000001''::uuid,
      p_fecha_emision := current_date,
      p_concepto := ''No debe editarse'',
      p_cuenta_id := ''d0000001-0000-0000-0000-000000000001''::uuid,
      p_cuenta_control_id := ''d0000002-0000-0000-0000-000000000002''::uuid,
      p_subtotal := 100,
      p_numero := ''FV-LINEAS-0001'',
      p_fecha_vencimiento := current_date
    )',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'venta_lineas')
  ),
  '22023',
  null,
  'un documento contabilizado ya no se puede editar como borrador'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  format(
    'select public.contabilizar_documento_financiero(%L::uuid, %L::uuid)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'venta_lineas')
  ),
  '42501',
  null,
  'un usuario de otra empresa no puede contabilizar el documento'
);

select finish();
rollback;
