-- =============================================================================
-- Nexo Contable · pgTAP 01 · Aislamiento multi-empresa y seguridad del núcleo
-- =============================================================================
-- Datos 100% sintéticos (empresa-a@ejemplo.test / RNC ficticios).
-- Verifica:
--   · Un usuario de la Empresa A no ve NADA de la Empresa B en ninguna tabla.
--   · Las RPCs de la Empresa B responden 42501.
--   · authenticated no puede escribir directamente en las tablas.
--   · admin_global ve y opera ambas empresas.
--   · rnc_normalizado único y completar_definicion_password().
--   · auditoría append-only.
-- =============================================================================

begin;

select plan(28);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

-- ---------------------------------------------------------------------------
-- Usuarios y perfiles sintéticos
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@ejemplo.test'),
  ('22222222-2222-2222-2222-222222222222', 'empresa-a@ejemplo.test'),
  ('33333333-3333-3333-3333-333333333333', 'empresa-b@ejemplo.test'),
  ('44444444-4444-4444-4444-444444444444', 'contador-a@ejemplo.test'),
  ('55555555-5555-5555-5555-555555555555', 'cliente-a@ejemplo.test');

insert into public.perfiles (user_id, email, nombre, rol_global, debe_definir_password) values
  ('11111111-1111-1111-1111-111111111111', 'admin@ejemplo.test', 'Admin Global', 'admin_global', false),
  ('22222222-2222-2222-2222-222222222222', 'empresa-a@ejemplo.test', 'Usuario A', 'usuario', true),
  ('33333333-3333-3333-3333-333333333333', 'empresa-b@ejemplo.test', 'Usuario B', 'usuario', true),
  ('44444444-4444-4444-4444-444444444444', 'contador-a@ejemplo.test', 'Contador A', 'usuario', false),
  ('55555555-5555-5555-5555-555555555555', 'cliente-a@ejemplo.test', 'Cliente A', 'usuario', false);

-- ---------------------------------------------------------------------------
-- Datos de las dos empresas (creados como admin_global)
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id) values
  ('empresa_a', public.crear_empresa(
    'Empresa Demo A SRL', 'Empresa Demo A SRL', '1-01-00000-1', 'SRL',
    'Calle Demo 1', '809-000-0001', 'empresa-a@ejemplo.test',
    'Representante A', 'Comercio', '2026-01-01'
  )),
  ('empresa_b', public.crear_empresa(
    'Empresa Demo B SRL', 'Empresa Demo B SRL', '2-02-00000-2', 'SRL',
    'Calle Demo 2', '809-000-0002', 'empresa-b@ejemplo.test',
    'Representante B', 'Servicios', '2026-01-01'
  ));

select public.asignar_usuario_empresa(
  '22222222-2222-2222-2222-222222222222',
  (select id from _ids where clave = 'empresa_a'),
  'admin_empresa',
  true
);
select public.asignar_usuario_empresa(
  '33333333-3333-3333-3333-333333333333',
  (select id from _ids where clave = 'empresa_b'),
  'admin_empresa',
  true
);
select public.asignar_usuario_empresa(
  '44444444-4444-4444-4444-444444444444',
  (select id from _ids where clave = 'empresa_a'),
  'contador',
  false
);
select public.asignar_usuario_empresa(
  '55555555-5555-5555-5555-555555555555',
  (select id from _ids where clave = 'empresa_a'),
  'cliente',
  false
);

insert into _ids (clave, id) values
  ('periodo_a', public.crear_periodo_contable(
    (select id from _ids where clave = 'empresa_a'),
    'Ejercicio 2026', '2026-01-01', '2026-12-31'
  )),
  ('periodo_b', public.crear_periodo_contable(
    (select id from _ids where clave = 'empresa_b'),
    'Ejercicio 2026', '2026-01-01', '2026-12-31'
  )),
  ('cuenta_a_1101', public.crear_cuenta(
    (select id from _ids where clave = 'empresa_a'),
    '1101', 'Caja A', 'asset', 'debit'
  )),
  ('cuenta_a_4101', public.crear_cuenta(
    (select id from _ids where clave = 'empresa_a'),
    '4101', 'Ventas A', 'income', 'credit'
  )),
  ('cuenta_b_1101', public.crear_cuenta(
    (select id from _ids where clave = 'empresa_b'),
    '1101', 'Caja B', 'asset', 'debit'
  )),
  ('cuenta_b_4101', public.crear_cuenta(
    (select id from _ids where clave = 'empresa_b'),
    '4101', 'Ventas B', 'income', 'credit'
  ));

insert into _ids (clave, id) values
  ('asiento_a', public.crear_asiento_manual(
    (select id from _ids where clave = 'empresa_a'),
    '2026-02-01',
    'Asiento demo A',
    'REF-A',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_a_1101'),
        'debito', 1000, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_a_4101'),
        'debito', 0, 'credito', 1000
      )
    ),
    true
  )),
  ('asiento_b', public.crear_asiento_manual(
    (select id from _ids where clave = 'empresa_b'),
    '2026-02-01',
    'Asiento demo B',
    'REF-B',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_b_1101'),
        'debito', 500, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ids where clave = 'cuenta_b_4101'),
        'debito', 0, 'credito', 500
      )
    ),
    true
  ));

select public.guardar_tercero(
  (select id from _ids where clave = 'empresa_a'),
  null, 'both', 'Cliente Demo A', '101-00000-1'
);
select public.guardar_tercero(
  (select id from _ids where clave = 'empresa_b'),
  null, 'both', 'Cliente Demo B', '202-00000-2'
);

-- ---------------------------------------------------------------------------
-- Aislamiento: usuario admin_empresa de la Empresa A
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.empresas),
  1::bigint,
  'Usuario A solo ve su propia empresa'
);

select is(
  (select count(*)::bigint from public.empresas
   where id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A no ve la Empresa B'
);

select is(
  (select count(*)::bigint from public.cuentas),
  2::bigint,
  'Usuario A ve solo las cuentas de su empresa'
);

select is(
  (select count(*)::bigint from public.cuentas
   where empresa_id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A ve 0 cuentas de la Empresa B'
);

select is(
  (select count(*)::bigint from public.periodos_contables
   where empresa_id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A ve 0 periodos de la Empresa B'
);

select is(
  (select count(*)::bigint from public.asientos
   where empresa_id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A ve 0 asientos de la Empresa B'
);

select is(
  (select count(*)::bigint from public.asiento_lineas
   where empresa_id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A ve 0 líneas de asiento de la Empresa B'
);

select is(
  (select count(*)::bigint from public.terceros
   where empresa_id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A ve 0 terceros de la Empresa B'
);

select is(
  (select count(*)::bigint from public.auditoria
   where empresa_id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A ve 0 registros de auditoría de la Empresa B'
);

select is(
  (select count(*)::bigint from public.perfiles
   where user_id = '33333333-3333-3333-3333-333333333333'),
  0::bigint,
  'Usuario A no ve el perfil del Usuario B'
);

select is(
  (select count(*)::bigint from public.empresa_usuarios
   where empresa_id = (select id from _ids where clave = 'empresa_b')),
  0::bigint,
  'Usuario A no ve las asignaciones de la Empresa B'
);

select throws_ok(
  format(
    'select public.crear_periodo_contable(%L, %L, %L, %L)',
    (select id from _ids where clave = 'empresa_b'),
    'Intruso', '2026-01-01', '2026-12-31'
  ),
  '42501',
  null,
  'Usuario A no puede crear periodos en la Empresa B'
);

select throws_ok(
  format(
    'select public.crear_cuenta(%L, %L, %L, %L, %L)',
    (select id from _ids where clave = 'empresa_b'),
    '9999', 'Cuenta intrusa', 'asset', 'debit'
  ),
  '42501',
  null,
  'Usuario A no puede crear cuentas en la Empresa B'
);

select throws_ok(
  format(
    'insert into public.cuentas (empresa_id, codigo, nombre, clasificacion, naturaleza) values (%L, %L, %L, %L, %L)',
    (select id from _ids where clave = 'empresa_a'),
    '9998', 'Cuenta directa', 'asset', 'debit'
  ),
  '42501',
  null,
  'authenticated no puede insertar cuentas directamente'
);

select throws_ok(
  format(
    'update public.empresas set nombre_comercial = %L where id = %L',
    'Empresa Hackeada', (select id from _ids where clave = 'empresa_a')
  ),
  '42501',
  null,
  'authenticated no puede actualizar empresas directamente'
);

select throws_ok(
  format(
    'delete from public.asientos where id = %L',
    (select id from _ids where clave = 'asiento_a')
  ),
  '42501',
  null,
  'authenticated no puede borrar asientos directamente'
);

-- ---------------------------------------------------------------------------
-- admin_global: ve y opera ambas empresas
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.empresas
   where id in (
     (select id from _ids where clave = 'empresa_a'),
     (select id from _ids where clave = 'empresa_b')
   )),
  2::bigint,
  'admin_global ve las dos empresas'
);

insert into _ids (clave, id)
select 'periodo_b_2025', public.crear_periodo_contable(
  (select id from _ids where clave = 'empresa_b'),
  'Ejercicio 2025', '2025-01-01', '2025-12-31'
);

select is(
  (select count(*)::bigint from public.periodos_contables
   where empresa_id = (select id from _ids where clave = 'empresa_b')
     and nombre = 'Ejercicio 2025'),
  1::bigint,
  'admin_global crea periodos en la Empresa B'
);

select lives_ok(
  format(
    'select public.cerrar_periodo_contable(%L, %L)',
    (select id from _ids where clave = 'empresa_b'),
    (select id from _ids where clave = 'periodo_b_2025')
  ),
  'admin_global cierra un periodo de la Empresa B'
);

select is(
  (select estado from public.periodos_contables
   where id = (select id from _ids where clave = 'periodo_b_2025')),
  'closed'::text,
  'El periodo cerrado queda en estado closed'
);

-- ---------------------------------------------------------------------------
-- RNC normalizado único
-- ---------------------------------------------------------------------------

select is(
  (select rnc_normalizado from public.empresas
   where id = (select id from _ids where clave = 'empresa_a')),
  '101000001'::text,
  'El RNC de la Empresa A queda normalizado sin guiones'
);

insert into _ids (clave, id)
select 'empresa_c', public.crear_empresa(
  'Empresa Demo C SRL', 'Empresa Demo C SRL', '3-03-00000-3', 'SRL',
  'Calle Demo 3', '809-000-0003', 'empresa-c@ejemplo.test',
  'Representante C', 'Comercio', '2026-01-01'
);

select is(
  (select rnc_normalizado from public.empresas
   where id = (select id from _ids where clave = 'empresa_c')),
  '303000003'::text,
  'El RNC de la Empresa C queda normalizado'
);

select throws_ok(
  format(
    'select public.crear_empresa(%L, %L, %L, %L)',
    'Empresa Demo D SRL', 'Empresa Demo D SRL', '303-000003', 'SRL'
  ),
  '23505',
  null,
  'No se puede repetir un RNC normalizado entre empresas'
);

-- ---------------------------------------------------------------------------
-- completar_definicion_password()
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select debe_definir_password from public.perfiles
   where user_id = '22222222-2222-2222-2222-222222222222'),
  true,
  'El Usuario A inicia con debe_definir_password en true'
);

select lives_ok(
  'select public.completar_definicion_password()',
  'El Usuario A completa la definición de su contraseña'
);

select is(
  (select debe_definir_password from public.perfiles
   where user_id = '22222222-2222-2222-2222-222222222222'),
  false,
  'El Usuario A queda con debe_definir_password en false'
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.auditoria
   where actor_id = '22222222-2222-2222-2222-222222222222'
     and entidad = 'perfiles'
     and accion = 'completar_password'),
  1::bigint,
  'La definición de contraseña queda auditada'
);

-- ---------------------------------------------------------------------------
-- Auditoría append-only
-- ---------------------------------------------------------------------------

reset role;

select throws_ok(
  'delete from public.auditoria',
  '42501',
  null,
  'La auditoría no permite DELETE ni siquiera al rol administrador'
);

select * from finish();

rollback;
