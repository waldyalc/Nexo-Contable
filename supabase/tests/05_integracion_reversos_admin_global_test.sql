-- =============================================================================
-- Nexo Contable · pgTAP 05 · Integración admin_global y neteo de reversos
-- =============================================================================

begin;

select plan(8);

insert into auth.users (id, email) values
  ('91111111-1111-1111-1111-111111111111', 'admin-global-int@ejemplo.test');

insert into public.perfiles (user_id, email, nombre, rol_global, debe_definir_password) values
  ('91111111-1111-1111-1111-111111111111', 'admin-global-int@ejemplo.test', 'Admin Integración', 'admin_global', false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _ctx (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ctx to authenticated;

insert into _ctx (clave, id) values
  ('emp', public.crear_empresa('Integración SRL', 'Integración SRL', '199999999'));

select ok(
  public.crear_periodo_contable(
    (select id from _ctx where clave = 'emp'),
    '2026', '2026-01-01', '2026-12-31'
  ) is not null,
  'admin_global puede crear periodo contable'
);

insert into _ctx (clave, id) values
  ('cta_gasto', public.crear_cuenta((select id from _ctx where clave = 'emp'), '5101', 'Gasto', 'expense', 'debit')),
  ('cta_cxp', public.crear_cuenta((select id from _ctx where clave = 'emp'), '2101', 'CxP', 'liability', 'credit')),
  ('cta_banco', public.crear_cuenta((select id from _ctx where clave = 'emp'), '1101', 'Banco', 'asset', 'debit', null, false, true, 'operating')),
  ('prov', public.guardar_tercero((select id from _ctx where clave = 'emp'), null, 'supplier', 'Proveedor Int', '130999999'));

select ok(
  public.guardar_metodo_pago(
    (select id from _ctx where clave = 'emp'),
    'Transferencia',
    (select id from _ctx where clave = 'cta_banco')
  ) is not null,
  'admin_global puede ejecutar RPCs operativas (guardar_metodo_pago) sin asignación explícita'
);

insert into _ctx (clave, id) values
  ('doc', public.emitir_documento_financiero(
    p_empresa_id => (select id from _ctx where clave = 'emp'),
    p_tipo => 'purchase_invoice',
    p_numero => 'INT-001',
    p_tercero_id => (select id from _ctx where clave = 'prov'),
    p_fecha_emision => '2026-06-15',
    p_concepto => 'Factura que será anulada',
    p_subtotal => 1000.00,
    p_impuesto => 0.00,
    p_retenciones => 0.00,
    p_otros_impuestos => 0.00,
    p_cuenta_id => (select id from _ctx where clave = 'cta_gasto'),
    p_cuenta_control_id => (select id from _ctx where clave = 'cta_cxp')
  ));

select is(
  (select monto from public.reporte_estado_resultados(
    (select id from _ctx where clave = 'emp'), '2026-01-01', '2026-12-31'
  ) where codigo = '5101'),
  1000.00::numeric,
  'antes de anular el gasto refleja 1000.00'
);

select ok(
  public.anular_documento(
    (select id from _ctx where clave = 'emp'),
    (select id from _ctx where clave = 'doc'),
    '2026-06-16',
    'Error de digitación'
  ) is not null,
  'admin_global puede anular el documento generando reverso'
);

select is(
  (select saldo_actual from public.reporte_balanza_comprobacion(
    (select id from _ctx where clave = 'emp'), '2026-01-01', '2026-12-31'
  ) where codigo = '5101'),
  0.00::numeric,
  'balanza netea exactamente a 0.00 tras reverso (no saldo negativo fantasma)'
);

select is(
  (select monto from public.reporte_estado_resultados(
    (select id from _ctx where clave = 'emp'), '2026-01-01', '2026-12-31'
  ) where codigo = '5101'),
  0.00::numeric,
  'estado de resultados netea exactamente a 0.00 tras reverso'
);

select is(
  (select resultado from public.reporte_resumen_empresa(
    (select id from _ctx where clave = 'emp'), '2026-01-01', '2026-12-31'
  )),
  0.00::numeric,
  'resumen empresa netea resultado exactamente a 0.00 tras reverso'
);

select ok(
  exists (
    select 1 from public.reporte_resumen_firma('2026-01-01', '2026-12-31')
    where empresa_id = (select id from _ctx where clave = 'emp')
  ),
  'admin_global puede consultar reporte_resumen_firma sin 42501'
);

select * from finish();

rollback;
