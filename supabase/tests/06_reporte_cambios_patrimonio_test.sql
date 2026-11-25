-- =============================================================================
-- Nexo Contable · pgTAP 06 · Reporte de cambios en el patrimonio
-- Datos 100% sintéticos; nunca datos reales de clientes.
-- =============================================================================

begin;

select plan(20);

insert into auth.users (id, email) values
  ('66666666-6666-4666-8666-666666666661', 'patrimonio.global@example.test'),
  ('66666666-6666-4666-8666-666666666662', 'patrimonio.ajeno@example.test');

insert into public.perfiles (user_id, email, nombre, rol_global, debe_definir_password) values
  ('66666666-6666-4666-8666-666666666661', 'patrimonio.global@example.test', 'Admin Patrimonio', 'admin_global', false),
  ('66666666-6666-4666-8666-666666666662', 'patrimonio.ajeno@example.test', 'Usuario Ajeno', 'usuario', false);

insert into public.empresas (id, nombre_comercial, razon_social, rnc, rnc_normalizado) values
  ('c6000000-0000-4000-8000-000000000001', 'Patrimonio Sintético', 'Patrimonio Sintético SRL', '909090909', '909090909');

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666661","role":"authenticated"}';

create temp table _ctx (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ctx to authenticated;

select public.crear_periodo_contable(
  'c6000000-0000-4000-8000-000000000001',
  'Periodo patrimonio 2025-2026',
  '2025-01-01',
  '2026-12-31'
);

insert into _ctx (clave, id) values
  ('banco', public.crear_cuenta(
    'c6000000-0000-4000-8000-000000000001',
    '1101', 'Banco principal', 'asset', 'debit', null, false, true, 'operating'
  )),
  ('capital', public.crear_cuenta(
    'c6000000-0000-4000-8000-000000000001',
    '3101', 'Capital social', 'equity', 'credit'
  )),
  ('acumulados', public.crear_cuenta(
    'c6000000-0000-4000-8000-000000000001',
    '3102', 'Resultados acumulados', 'equity', 'credit'
  )),
  ('ventas', public.crear_cuenta(
    'c6000000-0000-4000-8000-000000000001',
    '4101', 'Ventas de servicios', 'income', 'credit'
  )),
  ('gastos', public.crear_cuenta(
    'c6000000-0000-4000-8000-000000000001',
    '5101', 'Gastos administrativos', 'expense', 'debit'
  )),
  ('costos', public.crear_cuenta(
    'c6000000-0000-4000-8000-000000000001',
    '5102', 'Costo de ventas', 'cost', 'debit'
  ));

-- Saldos iniciales antes del período consultado: capital 10,000 y
-- resultados acumulados 2,000 (saldo acreedor positivo).
insert into _ctx (clave, id) values
  ('apertura', public.crear_asiento_manual(
    'c6000000-0000-4000-8000-000000000001',
    '2025-12-31',
    'Aporte inicial y resultados acumulados sintéticos',
    'AP-INI',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'banco'),
        'debito', 12000, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'capital'),
        'debito', 0, 'credito', 10000
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'acumulados'),
        'debito', 0, 'credito', 2000
      )
    ),
    true
  ));

-- Aporte del período que luego se revierte: debe conservar débitos y créditos
-- brutos de auditoría, pero netear exactamente a cero en el movimiento.
insert into _ctx (clave, id) values
  ('aporte_revertido', public.crear_asiento_manual(
    'c6000000-0000-4000-8000-000000000001',
    '2026-03-10',
    'Aporte adicional sintético revertido',
    'AP-REV',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'banco'),
        'debito', 3000, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'capital'),
        'debito', 0, 'credito', 3000
      )
    ),
    true
  ));

select public.revertir_asiento(
  'c6000000-0000-4000-8000-000000000001',
  (select id from _ctx where clave = 'aporte_revertido'),
  '2026-03-11',
  'Reverso sintético del aporte'
);

-- Retiro contra resultados acumulados.
insert into _ctx (clave, id) values
  ('retiro', public.crear_asiento_manual(
    'c6000000-0000-4000-8000-000000000001',
    '2026-04-15',
    'Retiro sintético de resultados acumulados',
    'RET-001',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'acumulados'),
        'debito', 500, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'banco'),
        'debito', 0, 'credito', 500
      )
    ),
    true
  ));

-- Resultado del período: ingresos 4,000 - gastos 1,200 - costos 800 = 2,000.
insert into _ctx (clave, id) values
  ('venta', public.crear_asiento_manual(
    'c6000000-0000-4000-8000-000000000001',
    '2026-06-30',
    'Venta sintética de servicios',
    'VEN-001',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'banco'),
        'debito', 4000, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'ventas'),
        'debito', 0, 'credito', 4000
      )
    ),
    true
  )),
  ('gasto', public.crear_asiento_manual(
    'c6000000-0000-4000-8000-000000000001',
    '2026-07-15',
    'Gasto sintético administrativo',
    'GAS-001',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'gastos'),
        'debito', 1200, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'banco'),
        'debito', 0, 'credito', 1200
      )
    ),
    true
  )),
  ('costo', public.crear_asiento_manual(
    'c6000000-0000-4000-8000-000000000001',
    '2026-07-20',
    'Costo sintético de ventas',
    'COS-001',
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'costos'),
        'debito', 800, 'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select id from _ctx where clave = 'banco'),
        'debito', 0, 'credito', 800
      )
    ),
    true
  ));

select is(
  (select count(*) from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  )),
  4::bigint,
  'el reporte devuelve dos cuentas, el resultado del período y el total'
);

select is(
  (select saldo_inicial from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3101'),
  10000.00::numeric,
  'capital social inicia el período con saldo acreedor 10,000.00'
);

select is(
  (select debitos from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3101'),
  3000.00::numeric,
  'capital social conserva el débito bruto del reverso'
);

select is(
  (select creditos from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3101'),
  3000.00::numeric,
  'capital social conserva el crédito bruto del asiento revertido'
);

select is(
  (select movimiento_neto from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3101'),
  0.00::numeric,
  'el movimiento neto de capital se netea exactamente a 0.00 tras el reverso'
);

select is(
  (select saldo_final from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3101'),
  10000.00::numeric,
  'capital social termina en 10,000.00 después del reverso'
);

select is(
  (select saldo_inicial from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3102'),
  2000.00::numeric,
  'resultados acumulados inicia el período con saldo acreedor 2,000.00'
);

select is(
  (select movimiento_neto from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3102'),
  (-500.00)::numeric,
  'el retiro reduce resultados acumulados en 500.00'
);

select is(
  (select saldo_final from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where codigo = '3102'),
  1500.00::numeric,
  'resultados acumulados termina en 1,500.00'
);

select is(
  (select debitos from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'resultado'),
  2000.00::numeric,
  'la fila de resultado suma los débitos brutos de costos y gastos'
);

select is(
  (select creditos from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'resultado'),
  4000.00::numeric,
  'la fila de resultado suma los créditos brutos de ingresos'
);

select is(
  (select movimiento_neto from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'resultado'),
  2000.00::numeric,
  'el resultado del período es ingresos menos costos y gastos'
);

select is(
  (select saldo_final from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'resultado'),
  2000.00::numeric,
  'el resultado del período aumenta el patrimonio final'
);

select is(
  (select saldo_inicial from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'total'),
  12000.00::numeric,
  'el total inicia con el patrimonio acreedor acumulado'
);

select is(
  (select debitos from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'total'),
  5500.00::numeric,
  'el total suma los débitos brutos de patrimonio y resultado'
);

select is(
  (select creditos from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'total'),
  7000.00::numeric,
  'el total suma los créditos brutos de patrimonio y resultado'
);

select is(
  (select movimiento_neto from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'total'),
  1500.00::numeric,
  'el cambio neto total del patrimonio es 1,500.00'
);

select is(
  (select saldo_final from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001', '2026-01-01', '2026-12-31'
  ) where tipo_fila = 'total'),
  13500.00::numeric,
  'el patrimonio final total es saldo inicial más movimiento neto'
);

select throws_ok(
  $$select * from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001'::uuid, '2026-12-31'::date, '2026-01-01'::date
  )$$,
  '22023',
  null,
  'el reporte rechaza rangos de fechas invertidos'
);

set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666662","role":"authenticated"}';

select throws_ok(
  $$select * from public.reporte_cambios_patrimonio(
    'c6000000-0000-4000-8000-000000000001'::uuid, '2026-01-01'::date, '2026-12-31'::date
  )$$,
  '42501',
  null,
  'un usuario sin rol en la empresa recibe 42501 al consultar el reporte'
);

select * from finish();

rollback;
