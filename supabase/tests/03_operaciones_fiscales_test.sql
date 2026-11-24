begin;

select no_plan();

-- ---------------------------------------------------------------------------
-- 03 · Operaciones fiscales: NCF, documentos financieros, pagos y DGII
-- Datos 100% sintéticos; nunca datos reales de clientes.
-- ---------------------------------------------------------------------------

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'sintetico.fiscal.a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'sintetico.fiscal.b@example.test');

insert into public.perfiles (user_id, email, nombre, rol_global) values
  ('11111111-1111-1111-1111-111111111111', 'sintetico.fiscal.a@example.test', 'Usuario Fiscal A', 'usuario'),
  ('22222222-2222-2222-2222-222222222222', 'sintetico.fiscal.b@example.test', 'Usuario Fiscal B', 'usuario')
on conflict (user_id) do nothing;

insert into public.empresas (id, nombre_comercial, razon_social, rnc, rnc_normalizado) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Empresa Fiscal A', 'Empresa Fiscal A SRL', '101010101', '101010101'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Empresa Fiscal B', 'Empresa Fiscal B SRL', '202020202', '202020202');

insert into public.empresa_usuarios (user_id, empresa_id, rol, es_principal) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin_empresa', true),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin_empresa', true);

insert into public.periodos_contables (empresa_id, nombre, fecha_inicio, fecha_fin, estado)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Periodo de pruebas',
  date_trunc('month', current_date)::date - 90,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  'open'
);

insert into public.cuentas (
  id, empresa_id, codigo, nombre, clasificacion, naturaleza,
  nivel, es_agrupacion, activa, es_equivalente_efectivo, categoria_flujo_efectivo
) values
  ('d0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '5101', 'Gasto general', 'expense', 'debit', 1, false, true, false, 'operating'),
  ('d0000002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '1201', 'ITBIS adelantado', 'asset', 'debit', 1, false, true, false, 'operating'),
  ('d0000003-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '2201', 'Retención ISR por pagar', 'liability', 'credit', 1, false, true, false, 'operating'),
  ('d0000004-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '2101', 'Cuentas por pagar', 'liability', 'credit', 1, false, true, false, 'operating'),
  ('d0000005-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '1101', 'Banco', 'asset', 'debit', 1, false, true, true, 'operating'),
  ('d0000006-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '4101', 'Ingresos', 'income', 'credit', 1, false, true, false, 'operating'),
  ('d0000007-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '1202', 'Cuentas por cobrar', 'asset', 'debit', 1, false, true, false, 'operating'),
  ('d0000008-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '2202', 'ITBIS por pagar', 'liability', 'credit', 1, false, true, false, 'operating');

insert into public.terceros (id, empresa_id, tipo, nombre, rnc, rnc_normalizado, activo) values
  ('e0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'supplier', 'Proveedor Sintético', '131313131', '131313131', true),
  ('e0000002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'customer', 'Cliente Sintético', '141414141', '141414141', true),
  ('e0000003-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'supplier', 'Proveedor sin RNC', '', '', true);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Configuración fiscal
-- ---------------------------------------------------------------------------

select ok(
  public.guardar_metodo_pago(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Transferencia',
    'd0000005-0000-0000-0000-000000000005'
  ) is not null,
  'guardar_metodo_pago crea el método de pago'
);

select is(
  public.guardar_configuracion_fiscal('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'guardar_configuracion_fiscal devuelve la empresa'
);

select is(
  (select tasa_itbis_bps from public.configuracion_fiscal
    where empresa_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1800,
  'la tasa de ITBIS por defecto es 1800 bps'
);

select ok(
  public.guardar_regla_fiscal(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ITBIS18', 'ITBIS 18%', 'itbis', 1800,
    'd0000008-0000-0000-0000-000000000008'
  ) is not null,
  'guardar_regla_fiscal crea la regla de ITBIS'
);

-- ---------------------------------------------------------------------------
-- Secuencias NCF: series B y E, numeración atómica y agotamiento
-- ---------------------------------------------------------------------------

select ok(
  public.guardar_secuencia_ncf(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B01', 'B01', 1, 100, null, true
  ) is not null,
  'crea la secuencia B01'
);

select is(
  public.consumir_siguiente_ncf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B01'),
  'B0100000001',
  'el primer NCF de la serie B usa 8 dígitos'
);

select is(
  public.consumir_siguiente_ncf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B01'),
  'B0100000002',
  'el segundo NCF de la serie B es correlativo'
);

select ok(
  public.guardar_secuencia_ncf(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'E31', 'E31', 1, 100, null, true
  ) is not null,
  'crea la secuencia electrónica E31'
);

select is(
  public.consumir_siguiente_ncf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'E31'),
  'E310000000001',
  'el primer NCF electrónico usa 10 dígitos de secuencia'
);

select is(
  length(public.consumir_siguiente_ncf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'E31')),
  13,
  'el NCF electrónico tiene 13 caracteres'
);

select ok(
  public.guardar_secuencia_ncf(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B02', 'B02', 1, 2, null, true
  ) is not null,
  'crea una secuencia B02 limitada para probar agotamiento'
);

select is(
  public.consumir_siguiente_ncf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B02'),
  'B0200000001',
  'consume el primer NCF de la secuencia limitada'
);

select is(
  public.consumir_siguiente_ncf('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B02'),
  'B0200000002',
  'consume el último NCF de la secuencia limitada'
);

select throws_ok(
  $$select public.consumir_siguiente_ncf(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'B02'
    )$$,
  '22023',
  null,
  'rechaza consumir una secuencia agotada'
);

select throws_ok(
  $$select public.guardar_secuencia_ncf(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'B01', 'B01', 50, 150, null, true
    )$$,
  '22023',
  null,
  'rechaza un rango NCF que se solapa con otra secuencia'
);

-- ---------------------------------------------------------------------------
-- Factura de compra, pago y anulación por reverso
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'compra', public.emitir_documento_financiero(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purchase_invoice',
  'e0000001-0000-0000-0000-000000000001', current_date, 'Servicios de prueba',
  'd0000001-0000-0000-0000-000000000001', 'd0000004-0000-0000-0000-000000000004',
  1000, 180, 100, 0, 'FC-PRUEBA-0001', 'B01', 'B0100000099', current_date + 30,
  'd0000002-0000-0000-0000-000000000002', 'd0000003-0000-0000-0000-000000000003',
  null, '{}'::jsonb, 100, 0
);

select ok(
  (select id from _ids where clave = 'compra') is not null,
  'emite la factura de compra contabilizada'
);

select is(
  (select total from public.documentos_financieros where id = (select id from _ids where clave = 'compra')),
  1080.00::numeric,
  'total = subtotal + ITBIS - retención (1,180 - 100)'
);

select is(
  (select count(*) from public.asiento_lineas
    where asiento_id = (
      select asiento_id from public.documentos_financieros
      where id = (select id from _ids where clave = 'compra')
    )),
  4::bigint,
  'la factura de compra genera 4 líneas de asiento'
);

select is(
  (select sum(debito) - sum(credito) from public.asiento_lineas
    where asiento_id = (
      select asiento_id from public.documentos_financieros
      where id = (select id from _ids where clave = 'compra')
    )),
  0.00::numeric,
  'el asiento de la factura de compra está cuadrado'
);

insert into _ids (clave, id)
select 'pago', public.registrar_pago_documento(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select id from _ids where clave = 'compra'),
  current_date, 500, 'Transferencia', 'd0000005-0000-0000-0000-000000000005', 'PAGO-1'
);

select ok(
  (select id from _ids where clave = 'pago') is not null,
  'registra un pago parcial de la factura de compra'
);

select is(
  (
    select round(d.total - coalesce((
      select sum(p.monto) from public.documento_pagos p
      where p.documento_id = d.id and p.estado = 'active'
    ), 0), 2)
    from public.documentos_financieros d
    where d.id = (select id from _ids where clave = 'compra')
  ),
  580.00::numeric,
  'el saldo pendiente después del pago es 580'
);

select throws_ok(
  format(
    'select public.registrar_pago_documento(%L::uuid, %L::uuid, current_date, 581, %L, %L::uuid)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'compra'),
    'Transferencia',
    'd0000005-0000-0000-0000-000000000005'
  ),
  '22023',
  null,
  'rechaza un pago mayor al saldo pendiente'
);

select throws_ok(
  format(
    'select public.anular_documento(%L::uuid, %L::uuid)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'compra')
  ),
  '22023',
  null,
  'no anula un documento con pagos activos'
);

select ok(
  public.anular_pago_documento(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'pago'),
    current_date, 'Pago mal registrado'
  ) is not null,
  'anula el pago mediante asiento de reverso'
);

select throws_ok(
  format(
    'select public.anular_pago_documento(%L::uuid, %L::uuid)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'pago')
  ),
  '22023',
  null,
  'rechaza anular dos veces el mismo pago'
);

select ok(
  public.anular_documento(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'compra'),
    current_date, 'Documento de prueba'
  ) is not null,
  'anula el documento sin pagos activos'
);

select is(
  (select estado from public.documentos_financieros
    where id = (select id from _ids where clave = 'compra')),
  'void',
  'el documento anulado queda en estado void'
);

select is(
  (select estado from public.asientos
    where id = (
      select asiento_id from public.documentos_financieros
      where id = (select id from _ids where clave = 'compra')
    )),
  'reversed',
  'el asiento original queda marcado como reversed'
);

select is(
  (select count(*) from (
    select a.id
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    where a.empresa_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    group by a.id
    having sum(l.debito) <> sum(l.credito)
  ) descuadrados),
  0::bigint,
  'ningún asiento de la empresa queda descuadrado'
);

-- ---------------------------------------------------------------------------
-- Factura de venta con NCF propio y nota de crédito
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'venta', public.emitir_documento_financiero(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sales_invoice',
  'e0000002-0000-0000-0000-000000000002', current_date, 'Venta de servicios',
  'd0000006-0000-0000-0000-000000000006', 'd0000007-0000-0000-0000-000000000007',
  2000, 360, 0, 0, null, 'B01', '', current_date + 30,
  'd0000008-0000-0000-0000-000000000008', null, null, '{}'::jsonb, 0, 0
);

select is(
  (select ncf from public.documentos_financieros where id = (select id from _ids where clave = 'venta')),
  'B0100000003',
  'la factura de venta consume el siguiente NCF de la serie B01'
);

select is(
  (select total from public.documentos_financieros where id = (select id from _ids where clave = 'venta')),
  2360.00::numeric,
  'la factura de venta suma ITBIS al total'
);

select throws_ok(
  format(
    'select public.emitir_documento_financiero(%L::uuid, %L, %L::uuid, current_date, %L, %L::uuid, %L::uuid, 100, 0, 0, 0, null, %L, %L, null, null, null, null, %L::jsonb)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sales_invoice',
    'e0000002-0000-0000-0000-000000000002', 'NCF duplicado',
    'd0000006-0000-0000-0000-000000000006', 'd0000007-0000-0000-0000-000000000007',
    'B01', 'B0100000003', '{}'
  ),
  '23505',
  null,
  'rechaza un NCF de venta duplicado'
);

select ok(
  public.guardar_secuencia_ncf(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B04', 'B04', 1, 50, null, true
  ) is not null,
  'crea la secuencia B04 para notas de crédito'
);

insert into _ids (clave, id)
select 'nota_credito', public.emitir_documento_financiero(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sales_credit',
  'e0000002-0000-0000-0000-000000000002', current_date, 'Nota de crédito parcial',
  'd0000006-0000-0000-0000-000000000006', 'd0000007-0000-0000-0000-000000000007',
  500, 0, 0, 0, null, 'B04', '', null,
  'd0000008-0000-0000-0000-000000000008', null,
  (select id from _ids where clave = 'venta'), '{}'::jsonb, 0, 0
);

select is(
  (select ncf from public.documentos_financieros
    where id = (select id from _ids where clave = 'nota_credito')),
  'B0400000001',
  'la nota de crédito consume un NCF propio de la serie B04'
);

select throws_ok(
  format(
    'select public.emitir_documento_financiero(%L::uuid, %L, %L::uuid, current_date, %L, %L::uuid, %L::uuid, 5000, 0, 0, 0, null, %L, %L, null, %L::uuid, null, %L::uuid, %L::jsonb)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sales_credit',
    'e0000002-0000-0000-0000-000000000002', 'Nota de crédito excesiva',
    'd0000006-0000-0000-0000-000000000006', 'd0000007-0000-0000-0000-000000000007',
    'B04', '', 'd0000008-0000-0000-0000-000000000008',
    (select id from _ids where clave = 'venta'), '{}'
  ),
  '22023',
  null,
  'rechaza una nota de crédito mayor al saldo pendiente'
);

-- ---------------------------------------------------------------------------
-- Obligaciones fiscales
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'obligacion', public.guardar_obligacion_fiscal(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '606', to_char(current_date, 'YYYYMM'),
  current_date + 10, 'pending', 0, ''
);

select ok(
  (select id from _ids where clave = 'obligacion') is not null,
  'guardar_obligacion_fiscal crea la obligación del 606'
);

select public.marcar_obligacion_presentada(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select id from _ids where clave = 'obligacion'),
  'filed', 1234.56, 'REF-606-001'
);

select is(
  (select estado from public.obligaciones_fiscales
    where id = (select id from _ids where clave = 'obligacion')),
  'filed',
  'marcar_obligacion_presentada actualiza el estado'
);

select is(
  (select monto_declarado from public.obligaciones_fiscales
    where id = (select id from _ids where clave = 'obligacion')),
  1234.56::numeric,
  'marcar_obligacion_presentada guarda el monto declarado'
);

-- ---------------------------------------------------------------------------
-- Formatos DGII 606 y 607 (incluidos y excluidos)
-- ---------------------------------------------------------------------------

select ok(
  public.emitir_documento_financiero(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purchase_invoice',
    'e0000001-0000-0000-0000-000000000001', current_date, 'Compra válida 606',
    'd0000001-0000-0000-0000-000000000001', 'd0000004-0000-0000-0000-000000000004',
    1000, 180, 100, 0, 'FC-606-0001', 'B01', 'B0100000098', current_date + 30,
    'd0000002-0000-0000-0000-000000000002', 'd0000003-0000-0000-0000-000000000003',
    null, '{}'::jsonb, 100, 0
  ) is not null,
  'emite la factura de compra incluida en el 606'
);

select ok(
  public.emitir_documento_financiero(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purchase_invoice',
    'e0000003-0000-0000-0000-000000000003', current_date, 'Compra sin NCF',
    'd0000001-0000-0000-0000-000000000001', 'd0000004-0000-0000-0000-000000000004',
    100, 0, 0, 0, 'FC-606-0002', '', '', null, null, null,
    null, '{}'::jsonb, null, null
  ) is not null,
  'emite una compra sin NCF para la hoja de excluidos'
);

select is(
  (select count(*) from public.reporte_dgii_606(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  1::bigint,
  'el 606 incluye una sola compra válida'
);

select is(
  (select monto_facturado from public.reporte_dgii_606(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  1180.00::numeric,
  'el 606 reporta el monto facturado con ITBIS'
);

select is(
  (select retencion_isr from public.reporte_dgii_606(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  100.00::numeric,
  'el 606 reporta la retención de ISR'
);

select is(
  (select count(*) from public.reporte_dgii_606(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where not incluido and motivo_exclusion = 'Comprobante sin NCF'),
  1::bigint,
  'el 606 identifica la compra sin NCF como excluida'
);

select is(
  (select count(*) from public.reporte_dgii_607(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  2::bigint,
  'el 607 incluye la factura de venta y su nota de crédito'
);

select is(
  (select sum(monto_facturado) from public.reporte_dgii_607(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  1860.00::numeric,
  'el 607 netea la nota de crédito en el monto facturado'
);

-- ---------------------------------------------------------------------------
-- Aislamiento multi-empresa (usuario B no ve ni opera la empresa A)
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.documentos_financieros),
  0::bigint,
  'el usuario de la empresa B no ve documentos de la empresa A'
);

select is(
  (select count(*) from public.secuencias_ncf),
  0::bigint,
  'el usuario de la empresa B no ve secuencias NCF de la empresa A'
);

select throws_ok(
  $$select public.emitir_documento_financiero(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'sales_invoice',
      'e0000002-0000-0000-0000-000000000002'::uuid, current_date, 'Intento ajeno',
      'd0000006-0000-0000-0000-000000000006'::uuid,
      'd0000007-0000-0000-0000-000000000007'::uuid, 100
    )$$,
  '42501',
  null,
  'un usuario ajeno no puede emitir documentos en otra empresa'
);

select throws_ok(
  $$select public.consumir_siguiente_ncf(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'B01'
    )$$,
  '42501',
  null,
  'un usuario ajeno no puede consumir NCF de otra empresa'
);

select * from finish();

rollback;
