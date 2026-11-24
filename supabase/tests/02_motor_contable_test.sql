-- =============================================================================
-- Nexo Contable · pgTAP 02 · Motor contable de partida doble
-- =============================================================================
-- Datos 100% sintéticos.
-- Verifica:
--   · importar_catalogo_cuentas() idempotente, con jerarquía y nivel.
--   · Rechazo de asientos descuadrados, con menos de 2 líneas, con cuentas de
--     agrupación o inactivas y en periodos cerrados.
--   · Numeración secuencial JE-YYYY-00001 por empresa y año.
--   · Reverso de asiento: invierte débitos/créditos y marca el original.
--   · Inmutabilidad: no se borra ni edita un asiento contabilizado.
--   · Terceros: RNC normalizado, único por empresa y activación.
--   · Permisos: el rol cliente no contabiliza; el contador sí.
-- =============================================================================

begin;

select plan(36);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

-- ---------------------------------------------------------------------------
-- Usuarios sintéticos
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@ejemplo.test'),
  ('66666666-6666-6666-6666-666666666666', 'contador@ejemplo.test'),
  ('77777777-7777-7777-7777-777777777777', 'cliente@ejemplo.test');

insert into public.perfiles (user_id, email, nombre, rol_global) values
  ('11111111-1111-1111-1111-111111111111', 'admin@ejemplo.test', 'Admin Global', 'admin_global'),
  ('66666666-6666-6666-6666-666666666666', 'contador@ejemplo.test', 'Contador Demo', 'usuario'),
  ('77777777-7777-7777-7777-777777777777', 'cliente@ejemplo.test', 'Cliente Demo', 'usuario');

-- ---------------------------------------------------------------------------
-- Empresa, roles y periodos
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id) values
  ('empresa', public.crear_empresa(
    'Empresa Demo A SRL', 'Empresa Demo A SRL', '4-04-00000-4', 'SRL',
    'Calle Demo 10', '809-000-0010', 'empresa-a@ejemplo.test',
    'Representante A', 'Comercio', '2026-01-01'
  ));

select public.asignar_usuario_empresa(
  '66666666-6666-6666-6666-666666666666',
  (select id from _ids where clave = 'empresa'),
  'contador',
  true
);
select public.asignar_usuario_empresa(
  '77777777-7777-7777-7777-777777777777',
  (select id from _ids where clave = 'empresa'),
  'cliente',
  false
);

insert into _ids (clave, id) values
  ('periodo_2026', public.crear_periodo_contable(
    (select id from _ids where clave = 'empresa'),
    'Ejercicio 2026', '2026-01-01', '2026-12-31'
  )),
  ('periodo_2025', public.crear_periodo_contable(
    (select id from _ids where clave = 'empresa'),
    'Ejercicio 2025', '2025-01-01', '2025-12-31'
  ));

select public.cerrar_periodo_contable(
  (select id from _ids where clave = 'empresa'),
  (select id from _ids where clave = 'periodo_2025')
);

-- ---------------------------------------------------------------------------
-- Catálogo de cuentas (subconjunto sintético del catálogo base)
-- ---------------------------------------------------------------------------

select is(
  public.importar_catalogo_cuentas(
    (select id from _ids where clave = 'empresa'),
    '[
      {"code":"1","name":"ACTIVOS","classification":"asset","normal_balance":"debit","parent_code":"","is_header":true},
      {"code":"11","name":"ACTIVOS CORRIENTES","classification":"asset","normal_balance":"debit","parent_code":"1","is_header":true},
      {"code":"1101","name":"CAJA GENERAL","classification":"asset","normal_balance":"debit","parent_code":"11","is_header":false},
      {"code":"1102","name":"BANCO PRINCIPAL","classification":"asset","normal_balance":"debit","parent_code":"11","is_header":false},
      {"code":"4","name":"INGRESOS","classification":"income","normal_balance":"credit","parent_code":"","is_header":true},
      {"code":"41","name":"INGRESOS OPERACIONALES","classification":"income","normal_balance":"credit","parent_code":"4","is_header":true},
      {"code":"4101","name":"VENTAS","classification":"income","normal_balance":"credit","parent_code":"41","is_header":false},
      {"code":"6","name":"GASTOS","classification":"expense","normal_balance":"debit","parent_code":"","is_header":true},
      {"code":"61","name":"GASTOS GENERALES","classification":"expense","normal_balance":"debit","parent_code":"6","is_header":true},
      {"code":"6101","name":"GASTO GENERAL","classification":"expense","normal_balance":"debit","parent_code":"61","is_header":false}
    ]'::jsonb
  ),
  10,
  'importar_catalogo_cuentas inserta las 10 cuentas del catálogo'
);

select is(
  (select count(*)::bigint from public.cuentas
   where empresa_id = (select id from _ids where clave = 'empresa')),
  10::bigint,
  'El catálogo queda con 10 cuentas'
);

select is(
  (select nivel from public.cuentas
   where empresa_id = (select id from _ids where clave = 'empresa')
     and codigo = '1101'),
  3,
  'La cuenta 1101 queda en nivel 3'
);

select is(
  (select padre.codigo
   from public.cuentas c
   join public.cuentas padre on padre.id = c.padre_id
   where c.empresa_id = (select id from _ids where clave = 'empresa')
     and c.codigo = '1101'),
  '11'::text,
  'La cuenta 1101 cuelga de la cuenta 11'
);

select is(
  public.importar_catalogo_cuentas(
    (select id from _ids where clave = 'empresa'),
    '[
      {"code":"1","name":"ACTIVOS","classification":"asset","normal_balance":"debit","parent_code":"","is_header":true},
      {"code":"11","name":"ACTIVOS CORRIENTES","classification":"asset","normal_balance":"debit","parent_code":"1","is_header":true},
      {"code":"1101","name":"CAJA GENERAL","classification":"asset","normal_balance":"debit","parent_code":"11","is_header":false},
      {"code":"1102","name":"BANCO PRINCIPAL","classification":"asset","normal_balance":"debit","parent_code":"11","is_header":false},
      {"code":"4","name":"INGRESOS","classification":"income","normal_balance":"credit","parent_code":"","is_header":true},
      {"code":"41","name":"INGRESOS OPERACIONALES","classification":"income","normal_balance":"credit","parent_code":"4","is_header":true},
      {"code":"4101","name":"VENTAS","classification":"income","normal_balance":"credit","parent_code":"41","is_header":false},
      {"code":"6","name":"GASTOS","classification":"expense","normal_balance":"debit","parent_code":"","is_header":true},
      {"code":"61","name":"GASTOS GENERALES","classification":"expense","normal_balance":"debit","parent_code":"6","is_header":true},
      {"code":"6101","name":"GASTO GENERAL","classification":"expense","normal_balance":"debit","parent_code":"61","is_header":false}
    ]'::jsonb
  ),
  0,
  'Reimportar el catálogo no inserta duplicados'
);

select is(
  (select count(*)::bigint from public.cuentas
   where empresa_id = (select id from _ids where clave = 'empresa')),
  10::bigint,
  'El catálogo sigue teniendo 10 cuentas tras la reimportación'
);

insert into _ids (clave, id) values
  ('cuenta_agrupacion', (select id from public.cuentas
    where empresa_id = (select id from _ids where clave = 'empresa')
      and codigo = '11')),
  ('cuenta_caja', (select id from public.cuentas
    where empresa_id = (select id from _ids where clave = 'empresa')
      and codigo = '1101')),
  ('cuenta_banco', (select id from public.cuentas
    where empresa_id = (select id from _ids where clave = 'empresa')
      and codigo = '1102')),
  ('cuenta_ventas', (select id from public.cuentas
    where empresa_id = (select id from _ids where clave = 'empresa')
      and codigo = '4101')),
  ('cuenta_gasto', (select id from public.cuentas
    where empresa_id = (select id from _ids where clave = 'empresa')
      and codigo = '6101')),
  ('cuenta_inactiva', public.crear_cuenta(
    (select id from _ids where clave = 'empresa'),
    '1103', 'CAJA CHICA', 'asset', 'debit',
    (select id from _ids where clave = 'cuenta_agrupacion')
  ));

select public.actualizar_cuenta(
  (select id from _ids where clave = 'empresa'),
  (select id from _ids where clave = 'cuenta_inactiva'),
  'CAJA CHICA', false
);

-- ---------------------------------------------------------------------------
-- Asientos cuadrados y numeración secuencial
-- ---------------------------------------------------------------------------

insert into _ids (clave, id) values
  ('asiento_1', public.crear_asiento_manual(
    (select id from _ids where clave = 'empresa'),
    '2026-02-01',
    'Venta de contado demo',
    'FAC-001',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'descripcion', 'Caja', 'debito', 1000, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'descripcion', 'Ventas', 'debito', 0, 'credito', 1000
      )
    ),
    true
  )),
  ('asiento_2', public.crear_asiento_manual(
    (select id from _ids where clave = 'empresa'),
    '2026-02-02',
    'Venta de contado demo 2',
    'FAC-002',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_banco'),
        'debito', 250, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 250
      )
    ),
    true
  ));

select is(
  (select numero from public.asientos
   where id = (select id from _ids where clave = 'asiento_1')),
  'JE-2026-00001'::text,
  'El primer asiento del año usa JE-2026-00001'
);

select is(
  (select numero from public.asientos
   where id = (select id from _ids where clave = 'asiento_2')),
  'JE-2026-00002'::text,
  'El segundo asiento del año usa JE-2026-00002'
);

-- ---------------------------------------------------------------------------
-- Rechazos del motor
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L, %L, %L, %L, %L::jsonb, true)',
    (select id from _ids where clave = 'empresa'),
    '2026-02-03', 'Asiento descuadrado', '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 100, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 90
      )
    )::text
  ),
  '23514',
  null,
  'Se rechaza un asiento descuadrado'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L, %L, %L, %L, %L::jsonb, true)',
    (select id from _ids where clave = 'empresa'),
    '2026-02-03', 'Asiento de una sola línea', '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 100, 'credito', 0
      )
    )::text
  ),
  '23514',
  null,
  'Se rechaza un asiento con menos de 2 líneas'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L, %L, %L, %L, %L::jsonb, true)',
    (select id from _ids where clave = 'empresa'),
    '2026-02-03', 'Asiento a cuenta de agrupación', '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_agrupacion'),
        'debito', 100, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 100
      )
    )::text
  ),
  '23514',
  null,
  'Se rechaza contabilizar en una cuenta de agrupación'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L, %L, %L, %L, %L::jsonb, true)',
    (select id from _ids where clave = 'empresa'),
    '2026-02-03', 'Asiento a cuenta inactiva', '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_inactiva'),
        'debito', 100, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 100
      )
    )::text
  ),
  '23514',
  null,
  'Se rechaza contabilizar en una cuenta inactiva'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L, %L, %L, %L, %L::jsonb, true)',
    (select id from _ids where clave = 'empresa'),
    '2025-06-15', 'Asiento en periodo cerrado', '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 100, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 100
      )
    )::text
  ),
  '23514',
  null,
  'Se rechaza contabilizar en un periodo cerrado'
);

-- ---------------------------------------------------------------------------
-- Borradores y contabilización
-- ---------------------------------------------------------------------------

insert into _ids (clave, id) values
  ('asiento_draft_2027', public.crear_asiento_manual(
    (select id from _ids where clave = 'empresa'),
    '2027-01-15',
    'Borrador fuera de periodo',
    '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 75, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 75
      )
    ),
    false
  ));

select is(
  (select estado from public.asientos
   where id = (select id from _ids where clave = 'asiento_draft_2027')),
  'draft'::text,
  'El asiento creado con p_contabilizar = false queda en borrador'
);

select is(
  (select numero from public.asientos
   where id = (select id from _ids where clave = 'asiento_draft_2027')),
  'JE-2027-00001'::text,
  'El borrador de 2027 usa la secuencia de su año'
);

select throws_ok(
  format(
    'select public.contabilizar_asiento_borrador(%L, %L)',
    (select id from _ids where clave = 'empresa'),
    (select id from _ids where clave = 'asiento_draft_2027')
  ),
  '23514',
  null,
  'No se contabiliza un borrador fuera de un periodo abierto'
);

insert into _ids (clave, id) values
  ('asiento_draft_2026', public.crear_asiento_manual(
    (select id from _ids where clave = 'empresa'),
    '2026-03-01',
    'Borrador contabilizable',
    '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_gasto'),
        'debito', 40, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 0, 'credito', 40
      )
    ),
    false
  ));

select is(
  (select numero from public.asientos
   where id = (select id from _ids where clave = 'asiento_draft_2026')),
  'JE-2026-00003'::text,
  'El borrador de 2026 continúa la secuencia del año'
);

select lives_ok(
  format(
    'select public.contabilizar_asiento_borrador(%L, %L)',
    (select id from _ids where clave = 'empresa'),
    (select id from _ids where clave = 'asiento_draft_2026')
  ),
  'El borrador dentro del periodo abierto se contabiliza'
);

select is(
  (select estado from public.asientos
   where id = (select id from _ids where clave = 'asiento_draft_2026')),
  'posted'::text,
  'El borrador contabilizado queda en estado posted'
);

-- ---------------------------------------------------------------------------
-- Reverso
-- ---------------------------------------------------------------------------

insert into _ids (clave, id) values
  ('reverso_1', public.revertir_asiento(
    (select id from _ids where clave = 'empresa'),
    (select id from _ids where clave = 'asiento_1'),
    '2026-04-01',
    'Corrección demo'
  ));

select is(
  (select estado from public.asientos
   where id = (select id from _ids where clave = 'asiento_1')),
  'reversed'::text,
  'El asiento original queda en estado reversed'
);

select is(
  (select estado from public.asientos
   where id = (select id from _ids where clave = 'reverso_1')),
  'reversal'::text,
  'El asiento de reverso queda en estado reversal'
);

select is(
  (select numero from public.asientos
   where id = (select id from _ids where clave = 'reverso_1')),
  'JE-2026-00004'::text,
  'El asiento de reverso continúa la secuencia del año'
);

select is(
  (select coalesce(sum(l.debito), 0)::numeric(14,2)
   from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _ids where clave = 'reverso_1')
     and c.codigo = '4101'),
  1000.00::numeric(14,2),
  'El reverso debita la cuenta de ventas por el crédito original'
);

select is(
  (select coalesce(sum(l.credito), 0)::numeric(14,2)
   from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _ids where clave = 'reverso_1')
     and c.codigo = '1101'),
  1000.00::numeric(14,2),
  'El reverso acredita la cuenta de caja por el débito original'
);

select is(
  (select revertido_por from public.asientos
   where id = (select id from _ids where clave = 'asiento_1')),
  (select id from _ids where clave = 'reverso_1'),
  'El asiento original apunta a su reverso en revertido_por'
);

select throws_ok(
  format(
    'select public.revertir_asiento(%L, %L, %L, %L)',
    (select id from _ids where clave = 'empresa'),
    (select id from _ids where clave = 'asiento_1'),
    '2026-04-02', 'Doble reverso'
  ),
  '23514',
  null,
  'No se permite revertir dos veces el mismo asiento'
);

-- ---------------------------------------------------------------------------
-- Inmutabilidad de asientos contabilizados (a nivel de trigger)
-- ---------------------------------------------------------------------------

reset role;

select throws_ok(
  format(
    'delete from public.asientos where id = %L',
    (select id from _ids where clave = 'asiento_2')
  ),
  '23514',
  null,
  'El trigger impide borrar un asiento contabilizado'
);

select throws_ok(
  format(
    'update public.asiento_lineas set debito = 1, credito = 0 where asiento_id = %L',
    (select id from _ids where clave = 'asiento_2')
  ),
  '23514',
  null,
  'El trigger impide modificar líneas de un asiento contabilizado'
);

-- ---------------------------------------------------------------------------
-- Terceros
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id) values
  ('tercero_1', public.guardar_tercero(
    (select id from _ids where clave = 'empresa'),
    null, 'both', 'Proveedor Demo SRL', '4-04-00000-9',
    'proveedor@ejemplo.test', '809-000-0011', 'Calle Demo 11'
  ));

select is(
  (select rnc_normalizado from public.terceros
   where id = (select id from _ids where clave = 'tercero_1')),
  '404000009'::text,
  'El RNC del tercero queda normalizado'
);

select throws_ok(
  format(
    'select public.guardar_tercero(%L, null, %L, %L, %L)',
    (select id from _ids where clave = 'empresa'),
    'both', 'Proveedor Duplicado SRL', '404-000009'
  ),
  '23505',
  null,
  'No se repite el RNC normalizado dentro de la misma empresa'
);

select lives_ok(
  format(
    'select public.toggle_tercero_activo(%L, %L, false)',
    (select id from _ids where clave = 'empresa'),
    (select id from _ids where clave = 'tercero_1')
  ),
  'El tercero se puede desactivar'
);

select is(
  (select activo from public.terceros
   where id = (select id from _ids where clave = 'tercero_1')),
  false,
  'El tercero desactivado queda inactivo'
);

-- ---------------------------------------------------------------------------
-- Permisos por rol y reapertura de periodo
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L, %L, %L, %L, %L::jsonb, true)',
    (select id from _ids where clave = 'empresa'),
    '2026-05-01', 'Asiento de cliente', '',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 10, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 10
      )
    )::text
  ),
  '42501',
  null,
  'El rol cliente no puede crear asientos'
);

set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select lives_ok(
  format(
    'select public.crear_asiento_manual(%L, %L, %L, %L, %L::jsonb, true)',
    (select id from _ids where clave = 'empresa'),
    '2026-05-01', 'Asiento del contador', 'CONT-001',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_gasto'),
        'debito', 20, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 0, 'credito', 20
      )
    )::text
  ),
  'El rol contador sí puede crear asientos'
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  format(
    'select public.reabrir_periodo_contable(%L, %L)',
    (select id from _ids where clave = 'empresa'),
    (select id from _ids where clave = 'periodo_2025')
  ),
  'El periodo 2025 se puede reabrir'
);

insert into _ids (clave, id) values
  ('asiento_2025', public.crear_asiento_manual(
    (select id from _ids where clave = 'empresa'),
    '2025-06-15',
    'Asiento demo 2025',
    'REF-2025',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_caja'),
        'debito', 60, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_ventas'),
        'debito', 0, 'credito', 60
      )
    ),
    true
  ));

select is(
  (select numero from public.asientos
   where id = (select id from _ids where clave = 'asiento_2025')),
  'JE-2025-00001'::text,
  'Tras reabrir, el asiento de 2025 usa JE-2025-00001'
);

select * from finish();

rollback;
