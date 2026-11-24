begin;

select no_plan();

-- ---------------------------------------------------------------------------
-- 04 · Inventario, bancos, activos, nómina, storage y reportes
-- Datos 100% sintéticos; nunca datos reales de clientes.
-- ---------------------------------------------------------------------------

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'sintetico.oper.a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'sintetico.oper.b@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'sintetico.oper.global@example.test');

insert into public.perfiles (user_id, email, nombre, rol_global) values
  ('11111111-1111-1111-1111-111111111111', 'sintetico.oper.a@example.test', 'Usuario Oper A', 'usuario'),
  ('22222222-2222-2222-2222-222222222222', 'sintetico.oper.b@example.test', 'Usuario Oper B', 'usuario'),
  ('33333333-3333-3333-3333-333333333333', 'sintetico.oper.global@example.test', 'Admin Global Oper', 'admin_global')
on conflict (user_id) do nothing;

insert into public.empresas (id, nombre_comercial, razon_social, rnc, rnc_normalizado) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Empresa Oper A', 'Empresa Oper A SRL', '303030303', '303030303'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Empresa Oper B', 'Empresa Oper B SRL', '404040404', '404040404');

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
   '2202', 'ITBIS por pagar', 'liability', 'credit', 1, false, true, false, 'operating'),
  ('d0000009-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '1301', 'Inventario', 'asset', 'debit', 1, false, true, false, 'operating'),
  ('d0000010-0000-0000-0000-000000000010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '5102', 'Costo de ventas', 'cost', 'debit', 1, false, true, false, 'operating'),
  ('d0000011-0000-0000-0000-000000000011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '1501', 'Activo fijo', 'asset', 'debit', 1, false, true, false, 'investing'),
  ('d0000012-0000-0000-0000-000000000012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '1509', 'Depreciación acumulada', 'asset', 'credit', 1, false, true, false, 'investing'),
  ('d0000013-0000-0000-0000-000000000013', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '5201', 'Gasto depreciación', 'expense', 'debit', 1, false, true, false, 'operating'),
  ('d0000014-0000-0000-0000-000000000014', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '5301', 'Gasto nómina', 'expense', 'debit', 1, false, true, false, 'operating'),
  ('d0000015-0000-0000-0000-000000000015', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '2301', 'Nómina por pagar', 'liability', 'credit', 1, false, true, false, 'operating'),
  ('d0000016-0000-0000-0000-000000000016', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '2302', 'Retenciones de nómina', 'liability', 'credit', 1, false, true, false, 'operating');

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
-- Bancos y conciliación
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'banco', public.guardar_cuenta_bancaria(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cuenta principal',
  'd0000005-0000-0000-0000-000000000005', 'Banco Sintético', '000-000', 'DOP', 0, true
);

select ok(
  (select id from _ids where clave = 'banco') is not null,
  'guardar_cuenta_bancaria crea la cuenta bancaria'
);

insert into _ids (clave, id)
select 'movimiento', public.registrar_movimiento_bancario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'banco'),
  current_date, 'deposit', 1000, 'Depósito inicial', 'DEP-1',
  'd0000006-0000-0000-0000-000000000006'
);

select ok(
  (select id from _ids where clave = 'movimiento') is not null,
  'registrar_movimiento_bancario crea el movimiento y su asiento'
);

insert into _ids (clave, id)
select 'sesion', public.crear_sesion_conciliacion(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'banco'),
  current_date, 1000
);

select ok(
  (select id from _ids where clave = 'sesion') is not null,
  'crear_sesion_conciliacion crea la sesión de conciliación'
);

select is(
  (select saldo_libros from public.sesiones_conciliacion_bancaria
    where id = (select id from _ids where clave = 'sesion')),
  1000.00::numeric,
  'la conciliación calcula el saldo en libros desde los asientos'
);

select is(
  (select diferencia from public.sesiones_conciliacion_bancaria
    where id = (select id from _ids where clave = 'sesion')),
  0.00::numeric,
  'la conciliación calcula la diferencia contra el extracto'
);

select public.marcar_movimiento_conciliado(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select id from _ids where clave = 'movimiento'),
  (select id from _ids where clave = 'sesion'),
  true
);

select is(
  (select conciliado from public.movimientos_bancarios
    where id = (select id from _ids where clave = 'movimiento')),
  true,
  'marcar_movimiento_conciliado deja el movimiento conciliado'
);

select public.cerrar_sesion_conciliacion(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select id from _ids where clave = 'sesion')
);

select is(
  (select estado from public.sesiones_conciliacion_bancaria
    where id = (select id from _ids where clave = 'sesion')),
  'closed',
  'cerrar_sesion_conciliacion cierra la sesión'
);

insert into _ids (clave, id)
select 'importacion', public.importar_movimientos_bancarios(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'banco'),
  'extracto.csv',
  '[{"fecha":"2026-02-01","descripcion":"Cargo","referencia":"A1","tipo":"fee","monto":25},
    {"fecha":"2026-02-02","descripcion":"Abono","referencia":"A2","tipo":"deposit","monto":100}]'::jsonb
);

select is(
  (select total_filas from public.importaciones_bancarias
    where id = (select id from _ids where clave = 'importacion')),
  2,
  'la importación bancaria registra el total de filas'
);

select is(
  (select count(*) from public.movimientos_bancarios
    where importacion_id = (select id from _ids where clave = 'importacion')),
  2::bigint,
  'la importación bancaria inserta todos los movimientos'
);

-- ---------------------------------------------------------------------------
-- Inventario con costo promedio ponderado
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'articulo', public.guardar_articulo_inventario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SKU-1', 'Artículo sintético', 'UNIDAD', '',
  150, 'd0000009-0000-0000-0000-000000000009',
  'd0000010-0000-0000-0000-000000000010', 'd0000006-0000-0000-0000-000000000006',
  true
);

select ok(
  (select id from _ids where clave = 'articulo') is not null,
  'guardar_articulo_inventario crea el artículo'
);

select public.registrar_movimiento_inventario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'articulo'),
  current_date, 'in', 10, 100, 'd0000005-0000-0000-0000-000000000005'
);

select is(
  (select cantidad_disponible from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  10.0000::numeric,
  'la primera entrada suma 10 unidades'
);

select is(
  (select costo_promedio from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  100.00::numeric,
  'la primera entrada fija el costo promedio en 100'
);

select is(
  (select valor_total from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  1000.00::numeric,
  'la primera entrada valora el inventario en 1000'
);

select public.registrar_movimiento_inventario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'articulo'),
  current_date, 'in', 10, 120, 'd0000005-0000-0000-0000-000000000005'
);

select is(
  (select cantidad_disponible from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  20.0000::numeric,
  'la segunda entrada acumula 20 unidades'
);

select is(
  (select costo_promedio from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  110.00::numeric,
  'el costo promedio ponderado es 110'
);

select is(
  (select valor_total from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  2200.00::numeric,
  'el valor del inventario es 2200'
);

insert into _ids (clave, id)
select 'salida', public.registrar_movimiento_inventario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'articulo'),
  current_date, 'out', 20
);

select is(
  (select cantidad_disponible from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  0.0000::numeric,
  'la salida total deja el stock en cero'
);

select is(
  (select valor_total from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  0.00::numeric,
  'al agotar el stock no queda residuo de centavos'
);

select is(
  (select costo_total from public.movimientos_inventario
    where id = (select id from _ids where clave = 'salida')),
  2200.00::numeric,
  'la salida total consume exactamente el valor acumulado'
);

select throws_ok(
  format(
    'select public.registrar_movimiento_inventario(%L::uuid, %L::uuid, current_date, %L, 1)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'articulo'),
    'out'
  ),
  '22023',
  null,
  'rechaza una salida sin stock suficiente'
);

select public.registrar_movimiento_inventario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'articulo'),
  current_date, 'in', 3, 10, 'd0000005-0000-0000-0000-000000000005'
);

select is(
  (select costo_promedio from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  10.00::numeric,
  'una entrada posterior parte del costo capturado'
);

select public.registrar_movimiento_inventario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'articulo'),
  current_date, 'out', 1
);

select is(
  (select valor_total from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  20.00::numeric,
  'la salida parcial mantiene el valor restante'
);

select public.registrar_movimiento_inventario(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from _ids where clave = 'articulo'),
  current_date, 'adjustment', -2
);

select is(
  (select cantidad_disponible from public.articulos_inventario
    where id = (select id from _ids where clave = 'articulo')),
  0.0000::numeric,
  'un ajuste negativo saca el stock restante'
);

-- ---------------------------------------------------------------------------
-- Activos fijos y depreciación
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'activo', public.guardar_activo_fijo(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AF-1', 'Equipo sintético', current_date,
  1200, 12, 'd0000011-0000-0000-0000-000000000011',
  'd0000012-0000-0000-0000-000000000012', 'd0000013-0000-0000-0000-000000000013',
  'Equipos', 0
);

select ok(
  (select id from _ids where clave = 'activo') is not null,
  'guardar_activo_fijo crea el activo fijo'
);

select is(
  public.correr_depreciacion_periodo(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM'), current_date
  ),
  1,
  'correr_depreciacion_periodo deprecia un activo'
);

select is(
  (select depreciacion_acumulada from public.activos_fijos
    where id = (select id from _ids where clave = 'activo')),
  100.00::numeric,
  'la depreciación mensual es costo / vida útil'
);

select is(
  (select monto from public.depreciaciones_activos
    where activo_id = (select id from _ids where clave = 'activo')
      and periodo = to_char(current_date, 'YYYYMM')),
  100.00::numeric,
  'se registra la depreciación del periodo'
);

select is(
  public.correr_depreciacion_periodo(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM'), current_date
  ),
  0,
  'no duplica la depreciación del mismo periodo'
);

-- ---------------------------------------------------------------------------
-- Nómina
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'empleado', public.guardar_empleado(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EMP-1', 'Empleado Sintético', 50000,
  '000-0000000-0', 'Analista', 'Contabilidad', current_date, true
);

select ok(
  (select id from _ids where clave = 'empleado') is not null,
  'guardar_empleado crea el empleado'
);

insert into _ids (clave, id)
select 'corrida', public.contabilizar_corrida_nomina(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM'), current_date,
  'd0000014-0000-0000-0000-000000000014', 'd0000015-0000-0000-0000-000000000015',
  jsonb_build_array(jsonb_build_object(
    'empleado_id', (select id from _ids where clave = 'empleado'),
    'salario_bruto', 50000, 'deducciones', 5000
  )),
  'd0000016-0000-0000-0000-000000000016', 'Nómina sintética'
);

select ok(
  (select id from _ids where clave = 'corrida') is not null,
  'contabilizar_corrida_nomina crea la corrida contabilizada'
);

select is(
  (select total_bruto from public.corridas_nomina
    where id = (select id from _ids where clave = 'corrida')),
  50000.00::numeric,
  'la corrida suma el total bruto'
);

select is(
  (select total_deducciones from public.corridas_nomina
    where id = (select id from _ids where clave = 'corrida')),
  5000.00::numeric,
  'la corrida suma las deducciones'
);

select is(
  (select total_neto from public.corridas_nomina
    where id = (select id from _ids where clave = 'corrida')),
  45000.00::numeric,
  'la corrida calcula el neto a pagar'
);

-- ---------------------------------------------------------------------------
-- Documentos para reportes DGII y antigüedad
-- ---------------------------------------------------------------------------

select ok(
  public.guardar_secuencia_ncf(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B01', 'B01', 1, 100, null, true
  ) is not null,
  'crea la secuencia B01 para las ventas'
);

select ok(
  public.emitir_documento_financiero(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sales_invoice',
    'e0000002-0000-0000-0000-000000000002', current_date, 'Venta sintética',
    'd0000006-0000-0000-0000-000000000006', 'd0000007-0000-0000-0000-000000000007',
    2000, 360, 0, 0, null, 'B01', '', current_date + 30,
    'd0000008-0000-0000-0000-000000000008', null, null, '{}'::jsonb, 0, 0
  ) is not null,
  'emite la factura de venta del periodo'
);

select ok(
  public.emitir_documento_financiero(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sales_invoice',
    'e0000002-0000-0000-0000-000000000002', current_date - 45, 'Venta vencida',
    'd0000006-0000-0000-0000-000000000006', 'd0000007-0000-0000-0000-000000000007',
    1000, 0, 0, 0, 'FV-VENCIDA-0001', 'B01', 'B0100000009',
    current_date - 40, null, null, null, '{}'::jsonb, 0, 0
  ) is not null,
  'emite una factura de venta vencida'
);

select ok(
  public.emitir_documento_financiero(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purchase_invoice',
    'e0000001-0000-0000-0000-000000000001', current_date, 'Compra sintética 606',
    'd0000001-0000-0000-0000-000000000001', 'd0000004-0000-0000-0000-000000000004',
    1000, 180, 100, 0, 'FC-606-0001', 'B01', 'B0100000098', current_date + 30,
    'd0000002-0000-0000-0000-000000000002', 'd0000003-0000-0000-0000-000000000003',
    null, '{}'::jsonb, 100, 0
  ) is not null,
  'emite la compra incluida en el 606'
);

select ok(
  public.emitir_documento_financiero(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purchase_invoice',
    'e0000003-0000-0000-0000-000000000003', current_date, 'Compra sin NCF',
    'd0000001-0000-0000-0000-000000000001', 'd0000004-0000-0000-0000-000000000004',
    100, 0, 0, 0, 'FC-606-0002', '', '', null, null, null,
    null, '{}'::jsonb, null, null
  ) is not null,
  'emite una compra sin NCF para los excluidos del 606'
);

-- ---------------------------------------------------------------------------
-- Reportes contables
-- ---------------------------------------------------------------------------

select ok(
  (select count(*) from public.reporte_balanza_comprobacion(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    current_date - 100, current_date
  )) > 0,
  'la balanza de comprobación devuelve cuentas con movimiento'
);

select is(
  (select sum(monto) from public.reporte_estado_resultados(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    current_date - 100, current_date
  ) where clasificacion = 'income'),
  4000.00::numeric,
  'el estado de resultados suma los ingresos del periodo'
);

select ok(
  (select count(*) from public.reporte_libro_mayor(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'd0000005-0000-0000-0000-000000000005',
    current_date - 100, current_date
  )) = 4,
  'el libro mayor lista los movimientos del banco'
);

select is(
  (select sum(monto) from public.reporte_flujo_efectivo(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    current_date - 100, current_date
  )),
  (-1230.00)::numeric,
  'el flujo de efectivo neto coincide con los movimientos de banco'
);

select is(
  (select coalesce(sum(monto), 0) from public.reporte_balance_general(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date
  ) where clasificacion = 'asset'),
  (select coalesce(sum(monto), 0) from public.reporte_balance_general(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date
    ) where clasificacion in ('liability', 'equity'))
    + (select resultado from public.reporte_resumen_empresa(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 100, current_date
      )),
  'el balance general cuadra con pasivos, patrimonio y resultado'
);

select is(
  (select ventas from public.reporte_resumen_empresa(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 100, current_date
  )),
  3360.00::numeric,
  'el resumen de la empresa suma las ventas del periodo'
);

select is(
  (select documentos_pendientes from public.reporte_resumen_empresa(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date - 100, current_date
  )),
  4,
  'el resumen cuenta los documentos pendientes'
);

select is(
  (select bucket from public.reporte_antiguedad_saldos(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cxc', current_date
  ) where numero = 'FV-VENCIDA-0001'),
  '31_60',
  'la antigüedad clasifica la factura vencida en 31-60 días'
);

select is(
  (select saldo from public.reporte_antiguedad_saldos(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cxc', current_date
  ) where numero = 'FV-VENCIDA-0001'),
  1000.00::numeric,
  'la antigüedad reporta el saldo pendiente'
);

select is(
  (select count(*) from public.reporte_dgii_606(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  1::bigint,
  'el 606 incluye la compra con NCF válido'
);

select is(
  (select itbis_facturado from public.reporte_dgii_606(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  180.00::numeric,
  'el 606 reporta el ITBIS facturado'
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
  'el 606 marca la compra sin NCF como excluida'
);

select is(
  (select sum(monto_facturado) from public.reporte_dgii_607(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM')
  ) where incluido),
  2360.00::numeric,
  'el 607 suma las ventas del periodo'
);

select is(
  (select sum(monto_facturado) from public.reporte_dgii_607(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date - 45, 'YYYYMM')
  ) where incluido),
  1000.00::numeric,
  'el 607 del periodo anterior incluye la venta vencida'
);

-- ---------------------------------------------------------------------------
-- Storage privado
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'archivo', public.registrar_documento_almacenado(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'documentos_financieros',
  (select id::text from public.documentos_financieros
    where empresa_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1),
  'factura.pdf', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/2026/factura.pdf',
  'application/pdf', 1024
);

select ok(
  (select id from _ids where clave = 'archivo') is not null,
  'registrar_documento_almacenado guarda los metadatos'
);

select throws_ok(
  $$select public.registrar_documento_almacenado(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'documentos_financieros',
      'x', 'ajena.pdf', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/2026/ajena.pdf',
      'application/pdf', 10
    )$$,
  '22023',
  null,
  'rechaza una ruta de storage de otra empresa'
);

insert into storage.objects (bucket_id, name)
values ('documentos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/2026/factura.pdf');

select is(
  (select count(*) from storage.objects where bucket_id = 'documentos'),
  1::bigint,
  'el usuario de la empresa ve el objeto de su carpeta'
);

-- ---------------------------------------------------------------------------
-- Resumen de la firma (solo admin_global)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select * from public.reporte_resumen_firma(current_date - 100, current_date)$$,
  '42501',
  null,
  'un usuario normal no puede ver el resumen de la firma'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.reporte_resumen_firma(current_date - 100, current_date)),
  2::bigint,
  'el admin global ve el resumen de todas las empresas'
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Anulación de nómina por reverso
-- ---------------------------------------------------------------------------

select ok(
  public.anular_corrida_nomina(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (select id from _ids where clave = 'corrida'),
    current_date, 'Nómina de prueba'
  ) is not null,
  'anular_corrida_nomina genera el asiento de reverso'
);

select is(
  (select estado from public.corridas_nomina
    where id = (select id from _ids where clave = 'corrida')),
  'void',
  'la corrida anulada queda en estado void'
);

select throws_ok(
  format(
    'select public.contabilizar_corrida_nomina(%L::uuid, %L, current_date, %L::uuid, %L::uuid, %L::jsonb, %L::uuid, %L)',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', to_char(current_date, 'YYYYMM'),
    'd0000014-0000-0000-0000-000000000014', 'd0000015-0000-0000-0000-000000000015',
    jsonb_build_array(jsonb_build_object(
      'empleado_id', (select id from _ids where clave = 'empleado'),
      'salario_bruto', 1000, 'deducciones', 0
    ))::text,
    'd0000016-0000-0000-0000-000000000016', 'Repetición'
  ),
  '23505',
  null,
  'rechaza una segunda corrida para el mismo periodo'
);

-- ---------------------------------------------------------------------------
-- Eliminar documento almacenado
-- ---------------------------------------------------------------------------

select public.eliminar_documento_almacenado(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select id from _ids where clave = 'archivo')
);

select is(
  (select count(*) from public.documentos_almacenados
    where id = (select id from _ids where clave = 'archivo')),
  0::bigint,
  'eliminar_documento_almacenado borra los metadatos'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'documentos'),
  0::bigint,
  'eliminar_documento_almacenado borra el objeto del bucket privado'
);

-- ---------------------------------------------------------------------------
-- Aislamiento multi-empresa
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.articulos_inventario),
  0::bigint,
  'el usuario de la empresa B no ve inventario de la empresa A'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'documentos'),
  0::bigint,
  'el usuario de la empresa B no ve documentos de la empresa A'
);

select throws_ok(
  $$select public.guardar_articulo_inventario(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'SKU-X', 'Artículo ajeno', 'UNIDAD'
    )$$,
  '42501',
  null,
  'un usuario ajeno no puede crear artículos en otra empresa'
);

select * from finish();

rollback;
