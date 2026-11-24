-- ---------------------------------------------------------------------------
-- Nexo Contable · Ola 1 · Bancos, inventario, activos fijos, nómina y storage
--
-- Crea:
--   · Bancos: cuentas_bancarias, importaciones_bancarias,
--     sesiones_conciliacion_bancaria y movimientos_bancarios.
--   · Inventario con costo promedio ponderado y cantidades NUMERIC(18,4).
--   · Activos fijos y depreciación mensual sin residuo de centavos.
--   · Nómina: empleados y corridas_nomina contabilizadas por RPC.
--   · documentos_almacenados + bucket privado 'documentos' con RLS por empresa.
--
-- Escrituras exclusivamente por RPC SECURITY DEFINER (search_path = '').
-- Depende de las migraciones núcleo 20261124220000 y 20261124220100.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Bancos y conciliación bancaria
-- ---------------------------------------------------------------------------

create table public.cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  banco text not null default '',
  numero_cuenta text not null default '',
  moneda text not null default 'DOP',
  cuenta_contable_id uuid not null references public.cuentas(id),
  saldo_inicial numeric(14, 2) not null default 0,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cuentas_bancarias_nombre_check check (btrim(nombre) <> ''),
  constraint cuentas_bancarias_moneda_check check (moneda ~ '^[A-Z]{3}$'),
  constraint cuentas_bancarias_empresa_nombre_key unique (empresa_id, nombre)
);

create index cuentas_bancarias_empresa_idx on public.cuentas_bancarias (empresa_id);

create table public.importaciones_bancarias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cuenta_bancaria_id uuid not null references public.cuentas_bancarias(id) on delete cascade,
  nombre_archivo text not null default '',
  total_filas integer not null default 0 check (total_filas >= 0),
  importado_por uuid references public.perfiles(user_id),
  creado_en timestamptz not null default now()
);

create index importaciones_bancarias_empresa_idx
  on public.importaciones_bancarias (empresa_id, cuenta_bancaria_id);

create table public.sesiones_conciliacion_bancaria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cuenta_bancaria_id uuid not null references public.cuentas_bancarias(id) on delete cascade,
  fecha_corte date not null,
  saldo_extracto numeric(14, 2) not null default 0,
  saldo_libros numeric(14, 2) not null default 0,
  diferencia numeric(14, 2) not null default 0,
  estado text not null default 'open' check (estado in ('open', 'closed')),
  cerrada_en timestamptz,
  creado_en timestamptz not null default now()
);

create index sesiones_conciliacion_empresa_idx
  on public.sesiones_conciliacion_bancaria (empresa_id, cuenta_bancaria_id, fecha_corte);

create table public.movimientos_bancarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cuenta_bancaria_id uuid not null references public.cuentas_bancarias(id) on delete cascade,
  fecha date not null,
  descripcion text not null default '',
  referencia text not null default '',
  tipo text not null check (tipo in ('deposit', 'withdrawal', 'transfer', 'fee', 'interest')),
  monto numeric(14, 2) not null check (monto > 0),
  conciliado boolean not null default false,
  sesion_conciliacion_id uuid references public.sesiones_conciliacion_bancaria(id),
  importacion_id uuid references public.importaciones_bancarias(id) on delete set null,
  asiento_id uuid references public.asientos(id),
  creado_en timestamptz not null default now()
);

create index movimientos_bancarios_empresa_cuenta_idx
  on public.movimientos_bancarios (empresa_id, cuenta_bancaria_id, fecha);
create index movimientos_bancarios_sesion_idx
  on public.movimientos_bancarios (sesion_conciliacion_id)
  where sesion_conciliacion_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Inventario
-- ---------------------------------------------------------------------------

create table public.articulos_inventario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sku text not null,
  nombre text not null,
  descripcion text not null default '',
  unidad text not null default 'UNIDAD',
  cantidad_disponible numeric(18, 4) not null default 0 check (cantidad_disponible >= 0),
  costo_promedio numeric(14, 2) not null default 0 check (costo_promedio >= 0),
  valor_total numeric(14, 2) not null default 0 check (valor_total >= 0),
  precio_venta numeric(14, 2) not null default 0 check (precio_venta >= 0),
  cuenta_inventario_id uuid references public.cuentas(id),
  cuenta_costo_id uuid references public.cuentas(id),
  cuenta_ingreso_id uuid references public.cuentas(id),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint articulos_inventario_sku_check check (btrim(sku) <> ''),
  constraint articulos_inventario_nombre_check check (btrim(nombre) <> ''),
  constraint articulos_inventario_empresa_sku_key unique (empresa_id, sku)
);

create index articulos_inventario_empresa_idx on public.articulos_inventario (empresa_id);

create table public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  articulo_id uuid not null references public.articulos_inventario(id),
  fecha date not null,
  tipo text not null check (tipo in ('in', 'out', 'adjustment')),
  cantidad numeric(18, 4) not null check (cantidad > 0),
  costo_unitario numeric(14, 2) not null default 0 check (costo_unitario >= 0),
  costo_total numeric(14, 2) not null default 0 check (costo_total >= 0),
  referencia text not null default '',
  notas text not null default '',
  asiento_id uuid references public.asientos(id),
  creado_en timestamptz not null default now()
);

create index movimientos_inventario_empresa_articulo_idx
  on public.movimientos_inventario (empresa_id, articulo_id, fecha);

-- ---------------------------------------------------------------------------
-- 3. Activos fijos
-- ---------------------------------------------------------------------------

create table public.activos_fijos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  categoria text not null default '',
  fecha_adquisicion date not null,
  costo_adquisicion numeric(14, 2) not null check (costo_adquisicion >= 0),
  valor_residual numeric(14, 2) not null default 0 check (valor_residual >= 0),
  vida_util_meses integer not null check (vida_util_meses > 0),
  depreciacion_acumulada numeric(14, 2) not null default 0 check (depreciacion_acumulada >= 0),
  cuenta_activo_id uuid not null references public.cuentas(id),
  cuenta_depreciacion_acumulada_id uuid not null references public.cuentas(id),
  cuenta_gasto_depreciacion_id uuid not null references public.cuentas(id),
  estado text not null default 'active'
    check (estado in ('active', 'fully_depreciated', 'disposed')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint activos_fijos_codigo_check check (btrim(codigo) <> ''),
  constraint activos_fijos_nombre_check check (btrim(nombre) <> ''),
  constraint activos_fijos_residual_check check (valor_residual <= costo_adquisicion),
  constraint activos_fijos_depreciacion_check
    check (depreciacion_acumulada <= costo_adquisicion - valor_residual),
  constraint activos_fijos_empresa_codigo_key unique (empresa_id, codigo)
);

create index activos_fijos_empresa_estado_idx
  on public.activos_fijos (empresa_id, estado);

create table public.depreciaciones_activos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  activo_id uuid not null references public.activos_fijos(id) on delete cascade,
  periodo text not null,
  fecha date not null,
  monto numeric(14, 2) not null check (monto > 0),
  asiento_id uuid references public.asientos(id),
  creado_en timestamptz not null default now(),
  constraint depreciaciones_activos_periodo_check
    check (periodo ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  constraint depreciaciones_activos_activo_periodo_key unique (activo_id, periodo)
);

create index depreciaciones_activos_empresa_periodo_idx
  on public.depreciaciones_activos (empresa_id, periodo);

-- ---------------------------------------------------------------------------
-- 4. Recursos humanos y nómina
-- ---------------------------------------------------------------------------

create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  cedula text not null default '',
  cargo text not null default '',
  departamento text not null default '',
  fecha_ingreso date not null default current_date,
  salario_mensual numeric(14, 2) not null default 0 check (salario_mensual >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint empleados_codigo_check check (btrim(codigo) <> ''),
  constraint empleados_nombre_check check (btrim(nombre) <> ''),
  constraint empleados_empresa_codigo_key unique (empresa_id, codigo)
);

create index empleados_empresa_idx on public.empleados (empresa_id);

create table public.corridas_nomina (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  periodo text not null,
  fecha_pago date not null,
  descripcion text not null default '',
  total_bruto numeric(14, 2) not null default 0 check (total_bruto >= 0),
  total_deducciones numeric(14, 2) not null default 0 check (total_deducciones >= 0),
  total_neto numeric(14, 2) not null default 0 check (total_neto >= 0),
  detalles jsonb not null default '[]'::jsonb,
  cuenta_gasto_id uuid references public.cuentas(id),
  cuenta_retenciones_id uuid references public.cuentas(id),
  cuenta_pago_id uuid references public.cuentas(id),
  estado text not null default 'draft' check (estado in ('draft', 'posted', 'void')),
  asiento_id uuid references public.asientos(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint corridas_nomina_periodo_check
    check (periodo ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  constraint corridas_nomina_empresa_periodo_key unique (empresa_id, periodo)
);

create index corridas_nomina_empresa_idx on public.corridas_nomina (empresa_id, periodo);

-- ---------------------------------------------------------------------------
-- 5. Documentos y almacenamiento privado
-- ---------------------------------------------------------------------------

create table public.documentos_almacenados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  entidad text not null,
  entidad_id text not null default '',
  nombre_archivo text not null,
  ruta_storage text not null,
  mime_type text not null default '',
  tamano_bytes bigint not null default 0 check (tamano_bytes >= 0),
  subido_por uuid references public.perfiles(user_id),
  creado_en timestamptz not null default now(),
  constraint documentos_almacenados_entidad_check check (btrim(entidad) <> ''),
  constraint documentos_almacenados_ruta_check check (btrim(ruta_storage) <> ''),
  constraint documentos_almacenados_empresa_ruta_key unique (empresa_id, ruta_storage)
);

create index documentos_almacenados_empresa_entidad_idx
  on public.documentos_almacenados (empresa_id, entidad, entidad_id);

-- ---------------------------------------------------------------------------
-- 6. Triggers de actualizado_en
-- ---------------------------------------------------------------------------

create trigger cuentas_bancarias_actualizado_en
  before update on public.cuentas_bancarias
  for each row execute function public.actualizar_actualizado_en();
create trigger articulos_inventario_actualizado_en
  before update on public.articulos_inventario
  for each row execute function public.actualizar_actualizado_en();
create trigger activos_fijos_actualizado_en
  before update on public.activos_fijos
  for each row execute function public.actualizar_actualizado_en();
create trigger empleados_actualizado_en
  before update on public.empleados
  for each row execute function public.actualizar_actualizado_en();
create trigger corridas_nomina_actualizado_en
  before update on public.corridas_nomina
  for each row execute function public.actualizar_actualizado_en();

-- ---------------------------------------------------------------------------
-- 7. RLS y permisos de tablas
-- ---------------------------------------------------------------------------

alter table public.cuentas_bancarias enable row level security;
alter table public.importaciones_bancarias enable row level security;
alter table public.sesiones_conciliacion_bancaria enable row level security;
alter table public.movimientos_bancarios enable row level security;
alter table public.articulos_inventario enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.activos_fijos enable row level security;
alter table public.depreciaciones_activos enable row level security;
alter table public.empleados enable row level security;
alter table public.corridas_nomina enable row level security;
alter table public.documentos_almacenados enable row level security;

revoke all on table public.cuentas_bancarias from anon, authenticated;
revoke all on table public.importaciones_bancarias from anon, authenticated;
revoke all on table public.sesiones_conciliacion_bancaria from anon, authenticated;
revoke all on table public.movimientos_bancarios from anon, authenticated;
revoke all on table public.articulos_inventario from anon, authenticated;
revoke all on table public.movimientos_inventario from anon, authenticated;
revoke all on table public.activos_fijos from anon, authenticated;
revoke all on table public.depreciaciones_activos from anon, authenticated;
revoke all on table public.empleados from anon, authenticated;
revoke all on table public.corridas_nomina from anon, authenticated;
revoke all on table public.documentos_almacenados from anon, authenticated;

revoke insert, update, delete, truncate on table public.cuentas_bancarias from authenticated;
revoke insert, update, delete, truncate on table public.importaciones_bancarias from authenticated;
revoke insert, update, delete, truncate on table public.sesiones_conciliacion_bancaria from authenticated;
revoke insert, update, delete, truncate on table public.movimientos_bancarios from authenticated;
revoke insert, update, delete, truncate on table public.articulos_inventario from authenticated;
revoke insert, update, delete, truncate on table public.movimientos_inventario from authenticated;
revoke insert, update, delete, truncate on table public.activos_fijos from authenticated;
revoke insert, update, delete, truncate on table public.depreciaciones_activos from authenticated;
revoke insert, update, delete, truncate on table public.empleados from authenticated;
revoke insert, update, delete, truncate on table public.corridas_nomina from authenticated;
revoke insert, update, delete, truncate on table public.documentos_almacenados from authenticated;

grant select on table public.cuentas_bancarias to authenticated;
grant select on table public.importaciones_bancarias to authenticated;
grant select on table public.sesiones_conciliacion_bancaria to authenticated;
grant select on table public.movimientos_bancarios to authenticated;
grant select on table public.articulos_inventario to authenticated;
grant select on table public.movimientos_inventario to authenticated;
grant select on table public.activos_fijos to authenticated;
grant select on table public.depreciaciones_activos to authenticated;
grant select on table public.empleados to authenticated;
grant select on table public.corridas_nomina to authenticated;
grant select on table public.documentos_almacenados to authenticated;

create policy cuentas_bancarias_select on public.cuentas_bancarias
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy importaciones_bancarias_select on public.importaciones_bancarias
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy sesiones_conciliacion_select on public.sesiones_conciliacion_bancaria
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy movimientos_bancarios_select on public.movimientos_bancarios
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy articulos_inventario_select on public.articulos_inventario
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy movimientos_inventario_select on public.movimientos_inventario
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy activos_fijos_select on public.activos_fijos
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy depreciaciones_activos_select on public.depreciaciones_activos
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy empleados_select on public.empleados
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy corridas_nomina_select on public.corridas_nomina
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy documentos_almacenados_select on public.documentos_almacenados
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);

-- ---------------------------------------------------------------------------
-- 8. Storage privado
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists documentos_objetos_select on storage.objects;
create policy documentos_objetos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and public.rol_en_empresa(
      case
        when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    ) is not null
  );

drop policy if exists documentos_objetos_insert on storage.objects;
create policy documentos_objetos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and public.rol_en_empresa(
      case
        when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    ) is not null
  );

drop policy if exists documentos_objetos_update on storage.objects;
create policy documentos_objetos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documentos'
    and public.rol_en_empresa(
      case
        when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    ) is not null
  );

drop policy if exists documentos_objetos_delete on storage.objects;
create policy documentos_objetos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and public.rol_en_empresa(
      case
        when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    ) is not null
  );

-- ---------------------------------------------------------------------------
-- 9. RPCs de bancos y conciliación
-- ---------------------------------------------------------------------------

create or replace function public.guardar_cuenta_bancaria(
  p_empresa_id uuid,
  p_nombre text default null,
  p_cuenta_contable_id uuid default null,
  p_banco text default null,
  p_numero_cuenta text default null,
  p_moneda text default null,
  p_saldo_inicial numeric default null,
  p_activa boolean default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_moneda text := upper(nullif(btrim(coalesce(p_moneda, '')), ''));
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if p_cuenta_contable_id is not null then
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_contable_id);
  end if;

  if v_id is not null then
    update public.cuentas_bancarias c
       set nombre = coalesce(v_nombre, c.nombre),
           cuenta_contable_id = coalesce(p_cuenta_contable_id, c.cuenta_contable_id),
           banco = coalesce(nullif(btrim(coalesce(p_banco, '')), ''), c.banco),
           numero_cuenta = coalesce(
             nullif(btrim(coalesce(p_numero_cuenta, '')), ''), c.numero_cuenta
           ),
           moneda = coalesce(v_moneda, c.moneda),
           saldo_inicial = coalesce(round(p_saldo_inicial, 2), c.saldo_inicial),
           activa = coalesce(p_activa, c.activa)
     where c.id = v_id and c.empresa_id = p_empresa_id;

    if not found then
      raise exception 'cuenta bancaria no encontrada' using errcode = '22023';
    end if;
  else
    if v_nombre is null or p_cuenta_contable_id is null then
      raise exception 'el nombre y la cuenta contable son obligatorios' using errcode = '22023';
    end if;

    insert into public.cuentas_bancarias (
      empresa_id, nombre, banco, numero_cuenta, moneda,
      cuenta_contable_id, saldo_inicial, activa
    )
    values (
      p_empresa_id, v_nombre, btrim(coalesce(p_banco, '')),
      btrim(coalesce(p_numero_cuenta, '')), coalesce(v_moneda, 'DOP'),
      p_cuenta_contable_id, round(coalesce(p_saldo_inicial, 0), 2),
      coalesce(p_activa, true)
    )
    returning id into v_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'cuentas_bancarias', v_id::text,
    jsonb_build_object('nombre', v_nombre)
  );

  return v_id;
end;
$$;

create or replace function public.registrar_movimiento_bancario(
  p_empresa_id uuid,
  p_cuenta_bancaria_id uuid,
  p_fecha date,
  p_tipo text,
  p_monto numeric,
  p_descripcion text default '',
  p_referencia text default '',
  p_cuenta_contrapartida_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas_bancarias%rowtype;
  v_fecha date := coalesce(p_fecha, current_date);
  v_tipo text := lower(btrim(coalesce(p_tipo, '')));
  v_monto numeric(14, 2) := round(coalesce(p_monto, 0), 2);
  v_movimiento_id uuid;
  v_asiento_id uuid;
  v_lineas jsonb;
  v_descripcion text := btrim(coalesce(p_descripcion, ''));
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_tipo not in ('deposit', 'withdrawal', 'transfer', 'fee', 'interest') then
    raise exception 'tipo de movimiento bancario inválido: %', p_tipo using errcode = '22023';
  end if;

  if v_monto <= 0 then
    raise exception 'el monto del movimiento debe ser mayor a cero' using errcode = '22023';
  end if;

  select * into v_cuenta
    from public.cuentas_bancarias c
   where c.id = p_cuenta_bancaria_id and c.empresa_id = p_empresa_id;

  if not found then
    raise exception 'cuenta bancaria no encontrada' using errcode = '22023';
  end if;

  if not v_cuenta.activa then
    raise exception 'la cuenta bancaria está inactiva' using errcode = '22023';
  end if;

  if p_cuenta_contrapartida_id is not null then
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_contrapartida_id);

    if v_tipo in ('deposit', 'interest') then
      v_lineas := jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta.cuenta_contable_id,
          'descripcion', coalesce(nullif(v_descripcion, ''), v_tipo),
          'debito', v_monto,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', p_cuenta_contrapartida_id,
          'descripcion', coalesce(nullif(v_descripcion, ''), v_tipo),
          'debito', 0,
          'credito', v_monto
        )
      );
    else
      v_lineas := jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', p_cuenta_contrapartida_id,
          'descripcion', coalesce(nullif(v_descripcion, ''), v_tipo),
          'debito', v_monto,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta.cuenta_contable_id,
          'descripcion', coalesce(nullif(v_descripcion, ''), v_tipo),
          'debito', 0,
          'credito', v_monto
        )
      );
    end if;

    v_asiento_id := public._contabilizar_asiento_interno(
      p_empresa_id, v_fecha, 'bank_movement',
      coalesce(nullif(v_descripcion, ''), 'Movimiento bancario ' || v_cuenta.nombre),
      coalesce(nullif(btrim(p_referencia), ''), v_cuenta.nombre),
      v_lineas, 'posted'
    );
  end if;

  insert into public.movimientos_bancarios (
    empresa_id, cuenta_bancaria_id, fecha, descripcion, referencia,
    tipo, monto, conciliado, asiento_id
  )
  values (
    p_empresa_id, v_cuenta.id, v_fecha, v_descripcion,
    btrim(coalesce(p_referencia, '')), v_tipo, v_monto, false, v_asiento_id
  )
  returning id into v_movimiento_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'registrar', 'movimientos_bancarios', v_movimiento_id::text,
    jsonb_build_object('tipo', v_tipo, 'monto', v_monto, 'asiento_id', v_asiento_id)
  );

  return v_movimiento_id;
end;
$$;

create or replace function public.importar_movimientos_bancarios(
  p_empresa_id uuid,
  p_cuenta_bancaria_id uuid,
  p_nombre_archivo text,
  p_filas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas_bancarias%rowtype;
  v_importacion_id uuid;
  v_fila record;
  v_total integer := 0;
  v_fecha date;
  v_tipo text;
  v_monto numeric(14, 2);
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'la importación requiere al menos una fila' using errcode = '22023';
  end if;

  if jsonb_array_length(p_filas) > 2000 then
    raise exception 'la importación excede el máximo de 2000 filas' using errcode = '22023';
  end if;

  select * into v_cuenta
    from public.cuentas_bancarias c
   where c.id = p_cuenta_bancaria_id and c.empresa_id = p_empresa_id;

  if not found then
    raise exception 'cuenta bancaria no encontrada' using errcode = '22023';
  end if;

  insert into public.importaciones_bancarias (
    empresa_id, cuenta_bancaria_id, nombre_archivo, total_filas, importado_por
  )
  values (
    p_empresa_id, v_cuenta.id, btrim(coalesce(p_nombre_archivo, '')), 0, auth.uid()
  )
  returning id into v_importacion_id;

  for v_fila in select value from jsonb_array_elements(p_filas) loop
    v_fecha := coalesce(nullif(v_fila.value ->> 'fecha', '')::date, current_date);
    v_tipo := lower(nullif(btrim(coalesce(v_fila.value ->> 'tipo', '')), ''));
    v_tipo := coalesce(v_tipo, 'deposit');
    v_monto := round(coalesce((v_fila.value ->> 'monto')::numeric, 0), 2);

    if v_tipo not in ('deposit', 'withdrawal', 'transfer', 'fee', 'interest') then
      raise exception 'fila % con tipo de movimiento inválido: %', v_total + 1, v_tipo
        using errcode = '22023';
    end if;

    if v_monto <= 0 then
      raise exception 'fila % con monto inválido', v_total + 1 using errcode = '22023';
    end if;

    insert into public.movimientos_bancarios (
      empresa_id, cuenta_bancaria_id, fecha, descripcion, referencia,
      tipo, monto, conciliado, importacion_id
    )
    values (
      p_empresa_id, v_cuenta.id, v_fecha,
      btrim(coalesce(v_fila.value ->> 'descripcion', '')),
      btrim(coalesce(v_fila.value ->> 'referencia', '')),
      v_tipo, v_monto, false, v_importacion_id
    );

    v_total := v_total + 1;
  end loop;

  update public.importaciones_bancarias i
     set total_filas = v_total
   where i.id = v_importacion_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'importar', 'importaciones_bancarias', v_importacion_id::text,
    jsonb_build_object('archivo', p_nombre_archivo, 'filas', v_total)
  );

  return v_importacion_id;
end;
$$;

create or replace function public.crear_sesion_conciliacion(
  p_empresa_id uuid,
  p_cuenta_bancaria_id uuid,
  p_fecha_corte date,
  p_saldo_extracto numeric default 0,
  p_saldo_libros numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas_bancarias%rowtype;
  v_sesion_id uuid;
  v_libros numeric(14, 2);
  v_extracto numeric(14, 2) := round(coalesce(p_saldo_extracto, 0), 2);
  v_diferencia numeric(14, 2);
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  select * into v_cuenta
    from public.cuentas_bancarias c
   where c.id = p_cuenta_bancaria_id and c.empresa_id = p_empresa_id;

  if not found then
    raise exception 'cuenta bancaria no encontrada' using errcode = '22023';
  end if;

  if p_saldo_libros is not null then
    v_libros := round(p_saldo_libros, 2);
  else
    select coalesce(sum(l.debito - l.credito), 0)
      into v_libros
      from public.asiento_lineas l
      join public.asientos a on a.id = l.asiento_id
     where a.empresa_id = p_empresa_id
       and a.estado in ('posted', 'reversal')
       and a.fecha <= coalesce(p_fecha_corte, current_date)
       and l.cuenta_id = v_cuenta.cuenta_contable_id;

    v_libros := round(v_libros, 2);
  end if;

  v_diferencia := round(v_extracto - v_libros, 2);

  insert into public.sesiones_conciliacion_bancaria (
    empresa_id, cuenta_bancaria_id, fecha_corte,
    saldo_extracto, saldo_libros, diferencia, estado
  )
  values (
    p_empresa_id, v_cuenta.id, coalesce(p_fecha_corte, current_date),
    v_extracto, v_libros, v_diferencia, 'open'
  )
  returning id into v_sesion_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'crear', 'sesiones_conciliacion_bancaria', v_sesion_id::text,
    jsonb_build_object('saldo_extracto', v_extracto, 'saldo_libros', v_libros,
                       'diferencia', v_diferencia)
  );

  return v_sesion_id;
end;
$$;

create or replace function public.marcar_movimiento_conciliado(
  p_empresa_id uuid,
  p_movimiento_id uuid,
  p_sesion_id uuid,
  p_conciliado boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.sesiones_conciliacion_bancaria%rowtype;
  v_movimiento public.movimientos_bancarios%rowtype;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  select * into v_sesion
    from public.sesiones_conciliacion_bancaria s
   where s.id = p_sesion_id and s.empresa_id = p_empresa_id;

  if not found then
    raise exception 'sesión de conciliación no encontrada' using errcode = '22023';
  end if;

  if v_sesion.estado <> 'open' then
    raise exception 'la sesión de conciliación está cerrada' using errcode = '22023';
  end if;

  select * into v_movimiento
    from public.movimientos_bancarios m
   where m.id = p_movimiento_id and m.empresa_id = p_empresa_id;

  if not found then
    raise exception 'movimiento bancario no encontrado' using errcode = '22023';
  end if;

  if v_movimiento.cuenta_bancaria_id <> v_sesion.cuenta_bancaria_id then
    raise exception 'el movimiento no pertenece a la cuenta de la sesión'
      using errcode = '22023';
  end if;

  update public.movimientos_bancarios m
     set conciliado = coalesce(p_conciliado, true),
         sesion_conciliacion_id = case
           when coalesce(p_conciliado, true) then v_sesion.id
           else null
         end
   where m.id = v_movimiento.id;
end;
$$;

create or replace function public.cerrar_sesion_conciliacion(
  p_empresa_id uuid,
  p_sesion_id uuid,
  p_fecha_cierre date default current_date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.sesiones_conciliacion_bancaria%rowtype;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador']
  );

  select * into v_sesion
    from public.sesiones_conciliacion_bancaria s
   where s.id = p_sesion_id and s.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'sesión de conciliación no encontrada' using errcode = '22023';
  end if;

  if v_sesion.estado <> 'open' then
    raise exception 'la sesión de conciliación ya está cerrada' using errcode = '22023';
  end if;

  update public.sesiones_conciliacion_bancaria s
     set estado = 'closed',
         cerrada_en = now()
   where s.id = v_sesion.id;

  perform public.registrar_auditoria(
    p_empresa_id, 'cerrar', 'sesiones_conciliacion_bancaria', v_sesion.id::text,
    jsonb_build_object('fecha_cierre', coalesce(p_fecha_cierre, current_date))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. RPCs de inventario
-- ---------------------------------------------------------------------------

create or replace function public.guardar_articulo_inventario(
  p_empresa_id uuid,
  p_sku text default null,
  p_nombre text default null,
  p_unidad text default null,
  p_descripcion text default null,
  p_precio_venta numeric default null,
  p_cuenta_inventario_id uuid default null,
  p_cuenta_costo_id uuid default null,
  p_cuenta_ingreso_id uuid default null,
  p_activo boolean default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_sku text := nullif(btrim(coalesce(p_sku, '')), '');
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_unidad text := nullif(btrim(coalesce(p_unidad, '')), '');
  v_cuenta uuid;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  foreach v_cuenta in array array[
    p_cuenta_inventario_id, p_cuenta_costo_id, p_cuenta_ingreso_id
  ] loop
    if v_cuenta is not null then
      perform public._validar_cuenta_movimiento(p_empresa_id, v_cuenta);
    end if;
  end loop;

  if v_id is not null then
    update public.articulos_inventario a
       set sku = coalesce(v_sku, a.sku),
           nombre = coalesce(v_nombre, a.nombre),
           unidad = coalesce(v_unidad, a.unidad),
           descripcion = coalesce(nullif(btrim(coalesce(p_descripcion, '')), ''), a.descripcion),
           precio_venta = coalesce(round(p_precio_venta, 2), a.precio_venta),
           cuenta_inventario_id = coalesce(p_cuenta_inventario_id, a.cuenta_inventario_id),
           cuenta_costo_id = coalesce(p_cuenta_costo_id, a.cuenta_costo_id),
           cuenta_ingreso_id = coalesce(p_cuenta_ingreso_id, a.cuenta_ingreso_id),
           activo = coalesce(p_activo, a.activo)
     where a.id = v_id and a.empresa_id = p_empresa_id;

    if not found then
      raise exception 'artículo de inventario no encontrado' using errcode = '22023';
    end if;
  else
    if v_sku is null or v_nombre is null then
      raise exception 'el SKU y el nombre del artículo son obligatorios' using errcode = '22023';
    end if;

    insert into public.articulos_inventario (
      empresa_id, sku, nombre, descripcion, unidad, precio_venta,
      cuenta_inventario_id, cuenta_costo_id, cuenta_ingreso_id, activo
    )
    values (
      p_empresa_id, v_sku, v_nombre, btrim(coalesce(p_descripcion, '')),
      coalesce(v_unidad, 'UNIDAD'), round(coalesce(p_precio_venta, 0), 2),
      p_cuenta_inventario_id, p_cuenta_costo_id, p_cuenta_ingreso_id,
      coalesce(p_activo, true)
    )
    returning id into v_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'articulos_inventario', v_id::text,
    jsonb_build_object('sku', v_sku, 'nombre', v_nombre)
  );

  return v_id;
end;
$$;

create or replace function public.registrar_movimiento_inventario(
  p_empresa_id uuid,
  p_articulo_id uuid,
  p_fecha date,
  p_tipo text,
  p_cantidad numeric,
  p_costo_unitario numeric default null,
  p_cuenta_contrapartida_id uuid default null,
  p_referencia text default '',
  p_notas text default '',
  p_direccion text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_articulo public.articulos_inventario%rowtype;
  v_fecha date := coalesce(p_fecha, current_date);
  v_tipo text := lower(btrim(coalesce(p_tipo, '')));
  v_direccion text := lower(nullif(btrim(coalesce(p_direccion, '')), ''));
  v_cantidad numeric(18, 4) := round(abs(coalesce(p_cantidad, 0)), 4);
  v_costo numeric(14, 2);
  v_costo_total numeric(14, 2);
  v_nueva_cantidad numeric(18, 4);
  v_nuevo_valor numeric(14, 2);
  v_nuevo_promedio numeric(14, 2);
  v_contrapartida uuid;
  v_lineas jsonb;
  v_asiento_id uuid;
  v_movimiento_id uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_tipo not in ('in', 'out', 'adjustment') then
    raise exception 'tipo de movimiento de inventario inválido: %', p_tipo using errcode = '22023';
  end if;

  if v_cantidad <= 0 then
    raise exception 'la cantidad del movimiento debe ser distinta de cero' using errcode = '22023';
  end if;

  if v_tipo = 'in' then
    v_direccion := 'in';
  elsif v_tipo = 'out' then
    v_direccion := 'out';
  elsif v_direccion is null then
    v_direccion := case when coalesce(p_cantidad, 0) < 0 then 'out' else 'in' end;
  end if;

  if v_direccion not in ('in', 'out') then
    raise exception 'la dirección del ajuste debe ser in u out' using errcode = '22023';
  end if;

  select * into v_articulo
    from public.articulos_inventario a
   where a.id = p_articulo_id and a.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'artículo de inventario no encontrado' using errcode = '22023';
  end if;

  if not v_articulo.activo then
    raise exception 'el artículo de inventario está inactivo' using errcode = '22023';
  end if;

  if v_direccion = 'in' then
    v_costo := round(coalesce(p_costo_unitario, v_articulo.costo_promedio, 0), 2);

    if v_costo < 0 then
      raise exception 'el costo unitario no puede ser negativo' using errcode = '22023';
    end if;

    v_costo_total := round(v_cantidad * v_costo, 2);
    v_nueva_cantidad := v_articulo.cantidad_disponible + v_cantidad;
    v_nuevo_valor := round(v_articulo.valor_total + v_costo_total, 2);
    v_nuevo_promedio := case
      when v_nueva_cantidad > 0 then round(v_nuevo_valor / v_nueva_cantidad, 2)
      else 0
    end;
  else
    if v_cantidad > v_articulo.cantidad_disponible then
      raise exception 'stock insuficiente: disponible %, solicitado %',
        v_articulo.cantidad_disponible, v_cantidad using errcode = '22023';
    end if;

    if v_cantidad = v_articulo.cantidad_disponible then
      -- Al agotar el stock se consume exactamente el valor acumulado (sin residuo).
      v_costo_total := v_articulo.valor_total;
      v_costo := case
        when v_cantidad > 0 then round(v_articulo.valor_total / v_cantidad, 2)
        else 0
      end;
    else
      v_costo := round(v_articulo.valor_total / v_articulo.cantidad_disponible, 2);
      v_costo_total := round(v_cantidad * v_costo, 2);
    end if;

    v_nueva_cantidad := v_articulo.cantidad_disponible - v_cantidad;
    v_nuevo_valor := greatest(v_articulo.valor_total - v_costo_total, 0);

    if v_nueva_cantidad <= 0 then
      v_nueva_cantidad := 0;
      v_nuevo_valor := 0;
      v_nuevo_promedio := 0;
    else
      v_nuevo_promedio := round(v_nuevo_valor / v_nueva_cantidad, 2);
    end if;
  end if;

  -- Contabilidad: contrapartida explícita o cuenta de costo del artículo (salidas).
  v_contrapartida := p_cuenta_contrapartida_id;

  if v_contrapartida is null and v_direccion = 'out' then
    v_contrapartida := v_articulo.cuenta_costo_id;
  end if;

  if v_contrapartida is not null and v_costo_total > 0 then
    if v_articulo.cuenta_inventario_id is null then
      raise exception 'el artículo no tiene cuenta de inventario configurada'
        using errcode = '22023';
    end if;

    perform public._validar_cuenta_movimiento(p_empresa_id, v_articulo.cuenta_inventario_id);
    perform public._validar_cuenta_movimiento(p_empresa_id, v_contrapartida);

    if v_direccion = 'in' then
      v_lineas := jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_articulo.cuenta_inventario_id,
          'descripcion', 'Entrada de inventario ' || v_articulo.sku,
          'debito', v_costo_total,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', v_contrapartida,
          'descripcion', 'Entrada de inventario ' || v_articulo.sku,
          'debito', 0,
          'credito', v_costo_total
        )
      );
    else
      v_lineas := jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_contrapartida,
          'descripcion', 'Salida de inventario ' || v_articulo.sku,
          'debito', v_costo_total,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', v_articulo.cuenta_inventario_id,
          'descripcion', 'Salida de inventario ' || v_articulo.sku,
          'debito', 0,
          'credito', v_costo_total
        )
      );
    end if;

    v_asiento_id := public._contabilizar_asiento_interno(
      p_empresa_id, v_fecha, 'inventory_movement',
      'Movimiento de inventario ' || v_articulo.sku,
      coalesce(nullif(btrim(p_referencia), ''), v_articulo.sku),
      v_lineas, 'posted'
    );
  end if;

  insert into public.movimientos_inventario (
    empresa_id, articulo_id, fecha, tipo, cantidad, costo_unitario,
    costo_total, referencia, notas, asiento_id
  )
  values (
    p_empresa_id, v_articulo.id, v_fecha, v_tipo, v_cantidad, v_costo,
    v_costo_total, btrim(coalesce(p_referencia, '')), btrim(coalesce(p_notas, '')),
    v_asiento_id
  )
  returning id into v_movimiento_id;

  update public.articulos_inventario a
     set cantidad_disponible = v_nueva_cantidad,
         costo_promedio = v_nuevo_promedio,
         valor_total = v_nuevo_valor
   where a.id = v_articulo.id;

  perform public.registrar_auditoria(
    p_empresa_id, 'registrar', 'movimientos_inventario', v_movimiento_id::text,
    jsonb_build_object(
      'articulo_id', v_articulo.id, 'tipo', v_tipo, 'cantidad', v_cantidad,
      'costo_unitario', v_costo, 'costo_total', v_costo_total, 'asiento_id', v_asiento_id
    )
  );

  return v_movimiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPCs de activos fijos
-- ---------------------------------------------------------------------------

create or replace function public.guardar_activo_fijo(
  p_empresa_id uuid,
  p_codigo text default null,
  p_nombre text default null,
  p_fecha_adquisicion date default null,
  p_costo_adquisicion numeric default null,
  p_vida_util_meses integer default null,
  p_cuenta_activo_id uuid default null,
  p_cuenta_depreciacion_acumulada_id uuid default null,
  p_cuenta_gasto_depreciacion_id uuid default null,
  p_categoria text default null,
  p_valor_residual numeric default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_codigo text := nullif(btrim(coalesce(p_codigo, '')), '');
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_actual public.activos_fijos%rowtype;
  v_cuenta uuid;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  foreach v_cuenta in array array[
    p_cuenta_activo_id, p_cuenta_depreciacion_acumulada_id, p_cuenta_gasto_depreciacion_id
  ] loop
    if v_cuenta is not null then
      perform public._validar_cuenta_movimiento(p_empresa_id, v_cuenta);
    end if;
  end loop;

  if v_id is not null then
    select * into v_actual
      from public.activos_fijos a
     where a.id = v_id and a.empresa_id = p_empresa_id
     for update;

    if not found then
      raise exception 'activo fijo no encontrado' using errcode = '22023';
    end if;

    if v_actual.depreciacion_acumulada > 0
       and (p_costo_adquisicion is not null or p_vida_util_meses is not null
            or p_valor_residual is not null) then
      raise exception 'no se puede cambiar costo, vida útil ni valor residual de un activo depreciado'
        using errcode = '22023';
    end if;

    update public.activos_fijos a
       set codigo = coalesce(v_codigo, a.codigo),
           nombre = coalesce(v_nombre, a.nombre),
           categoria = coalesce(nullif(btrim(coalesce(p_categoria, '')), ''), a.categoria),
           fecha_adquisicion = coalesce(p_fecha_adquisicion, a.fecha_adquisicion),
           costo_adquisicion = coalesce(round(p_costo_adquisicion, 2), a.costo_adquisicion),
           valor_residual = coalesce(round(p_valor_residual, 2), a.valor_residual),
           vida_util_meses = coalesce(p_vida_util_meses, a.vida_util_meses),
           cuenta_activo_id = coalesce(p_cuenta_activo_id, a.cuenta_activo_id),
           cuenta_depreciacion_acumulada_id = coalesce(
             p_cuenta_depreciacion_acumulada_id, a.cuenta_depreciacion_acumulada_id
           ),
           cuenta_gasto_depreciacion_id = coalesce(
             p_cuenta_gasto_depreciacion_id, a.cuenta_gasto_depreciacion_id
           )
     where a.id = v_actual.id;
  else
    if v_codigo is null or v_nombre is null or p_fecha_adquisicion is null
       or p_costo_adquisicion is null or p_vida_util_meses is null
       or p_cuenta_activo_id is null or p_cuenta_depreciacion_acumulada_id is null
       or p_cuenta_gasto_depreciacion_id is null then
      raise exception 'código, nombre, fecha, costo, vida útil y cuentas son obligatorios'
        using errcode = '22023';
    end if;

    if round(p_costo_adquisicion, 2) < 0 or round(coalesce(p_valor_residual, 0), 2) < 0 then
      raise exception 'el costo y el valor residual no pueden ser negativos'
        using errcode = '22023';
    end if;

    if p_vida_util_meses <= 0 then
      raise exception 'la vida útil debe ser mayor a cero' using errcode = '22023';
    end if;

    if round(coalesce(p_valor_residual, 0), 2) > round(p_costo_adquisicion, 2) then
      raise exception 'el valor residual no puede exceder el costo de adquisición'
        using errcode = '22023';
    end if;

    insert into public.activos_fijos (
      empresa_id, codigo, nombre, categoria, fecha_adquisicion,
      costo_adquisicion, valor_residual, vida_util_meses,
      cuenta_activo_id, cuenta_depreciacion_acumulada_id,
      cuenta_gasto_depreciacion_id, estado
    )
    values (
      p_empresa_id, v_codigo, v_nombre, btrim(coalesce(p_categoria, '')),
      p_fecha_adquisicion, round(p_costo_adquisicion, 2),
      round(coalesce(p_valor_residual, 0), 2), p_vida_util_meses,
      p_cuenta_activo_id, p_cuenta_depreciacion_acumulada_id,
      p_cuenta_gasto_depreciacion_id, 'active'
    )
    returning id into v_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'activos_fijos', v_id::text,
    jsonb_build_object('codigo', v_codigo, 'nombre', v_nombre)
  );

  return v_id;
end;
$$;

create or replace function public.correr_depreciacion_periodo(
  p_empresa_id uuid,
  p_periodo text,
  p_fecha date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_periodo text := btrim(coalesce(p_periodo, ''));
  v_fecha date := coalesce(p_fecha, current_date);
  v_activo public.activos_fijos%rowtype;
  v_base numeric(14, 2);
  v_mensual numeric(14, 2);
  v_pendiente numeric(14, 2);
  v_monto numeric(14, 2);
  v_acumulada numeric(14, 2);
  v_asiento_id uuid;
  v_total integer := 0;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if v_periodo !~ '^[0-9]{4}(0[1-9]|1[0-2])$' then
    raise exception 'periodo inválido: % (use YYYYMM)', p_periodo using errcode = '22023';
  end if;

  if to_char(v_fecha, 'YYYYMM') <> v_periodo then
    raise exception 'la fecha % no pertenece al periodo %', v_fecha, v_periodo
      using errcode = '22023';
  end if;

  perform public._validar_periodo_abierto(p_empresa_id, v_fecha);

  for v_activo in
    select * from public.activos_fijos a
     where a.empresa_id = p_empresa_id and a.estado = 'active'
     order by a.codigo
     for update
  loop
    v_base := round(v_activo.costo_adquisicion - v_activo.valor_residual, 2);

    if v_base <= 0 then
      update public.activos_fijos a set estado = 'fully_depreciated' where a.id = v_activo.id;
      continue;
    end if;

    if exists (
      select 1 from public.depreciaciones_activos d
      where d.activo_id = v_activo.id and d.periodo = v_periodo
    ) then
      continue;
    end if;

    v_pendiente := round(v_base - v_activo.depreciacion_acumulada, 2);

    if v_pendiente <= 0 then
      update public.activos_fijos a set estado = 'fully_depreciated' where a.id = v_activo.id;
      continue;
    end if;

    v_mensual := greatest(round(v_base / v_activo.vida_util_meses, 2), 0.01);
    v_monto := least(v_mensual, v_pendiente);

    perform public._validar_cuenta_movimiento(p_empresa_id, v_activo.cuenta_gasto_depreciacion_id);
    perform public._validar_cuenta_movimiento(
      p_empresa_id, v_activo.cuenta_depreciacion_acumulada_id
    );

    v_asiento_id := public._contabilizar_asiento_interno(
      p_empresa_id, v_fecha, 'depreciation',
      'Depreciación ' || v_periodo || ' · ' || v_activo.nombre,
      v_activo.codigo,
      jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_activo.cuenta_gasto_depreciacion_id,
          'descripcion', 'Gasto de depreciación ' || v_activo.codigo,
          'debito', v_monto,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', v_activo.cuenta_depreciacion_acumulada_id,
          'descripcion', 'Depreciación acumulada ' || v_activo.codigo,
          'debito', 0,
          'credito', v_monto
        )
      ),
      'posted'
    );

    insert into public.depreciaciones_activos (
      empresa_id, activo_id, periodo, fecha, monto, asiento_id
    )
    values (p_empresa_id, v_activo.id, v_periodo, v_fecha, v_monto, v_asiento_id);

    v_acumulada := round(v_activo.depreciacion_acumulada + v_monto, 2);

    update public.activos_fijos a
       set depreciacion_acumulada = v_acumulada,
           estado = case when v_acumulada >= v_base then 'fully_depreciated' else 'active' end
     where a.id = v_activo.id;

    v_total := v_total + 1;
  end loop;

  perform public.registrar_auditoria(
    p_empresa_id, 'depreciar', 'activos_fijos', p_empresa_id::text,
    jsonb_build_object('periodo', v_periodo, 'activos_depreciados', v_total)
  );

  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. RPCs de nómina
-- ---------------------------------------------------------------------------

create or replace function public.guardar_empleado(
  p_empresa_id uuid,
  p_codigo text default null,
  p_nombre text default null,
  p_salario_mensual numeric default null,
  p_cedula text default null,
  p_cargo text default null,
  p_departamento text default null,
  p_fecha_ingreso date default null,
  p_activo boolean default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_codigo text := nullif(btrim(coalesce(p_codigo, '')), '');
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if v_id is not null then
    update public.empleados e
       set codigo = coalesce(v_codigo, e.codigo),
           nombre = coalesce(v_nombre, e.nombre),
           cedula = coalesce(nullif(btrim(coalesce(p_cedula, '')), ''), e.cedula),
           cargo = coalesce(nullif(btrim(coalesce(p_cargo, '')), ''), e.cargo),
           departamento = coalesce(
             nullif(btrim(coalesce(p_departamento, '')), ''), e.departamento
           ),
           fecha_ingreso = coalesce(p_fecha_ingreso, e.fecha_ingreso),
           salario_mensual = coalesce(round(p_salario_mensual, 2), e.salario_mensual),
           activo = coalesce(p_activo, e.activo)
     where e.id = v_id and e.empresa_id = p_empresa_id;

    if not found then
      raise exception 'empleado no encontrado' using errcode = '22023';
    end if;
  else
    if v_codigo is null or v_nombre is null or p_salario_mensual is null then
      raise exception 'código, nombre y salario mensual son obligatorios' using errcode = '22023';
    end if;

    if round(p_salario_mensual, 2) < 0 then
      raise exception 'el salario mensual no puede ser negativo' using errcode = '22023';
    end if;

    insert into public.empleados (
      empresa_id, codigo, nombre, cedula, cargo, departamento,
      fecha_ingreso, salario_mensual, activo
    )
    values (
      p_empresa_id, v_codigo, v_nombre, btrim(coalesce(p_cedula, '')),
      btrim(coalesce(p_cargo, '')), btrim(coalesce(p_departamento, '')),
      coalesce(p_fecha_ingreso, current_date), round(p_salario_mensual, 2),
      coalesce(p_activo, true)
    )
    returning id into v_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'empleados', v_id::text,
    jsonb_build_object('codigo', v_codigo, 'nombre', v_nombre)
  );

  return v_id;
end;
$$;

create or replace function public.contabilizar_corrida_nomina(
  p_empresa_id uuid,
  p_periodo text,
  p_fecha_pago date,
  p_cuenta_gasto_id uuid,
  p_cuenta_pago_id uuid,
  p_detalles jsonb,
  p_cuenta_retenciones_id uuid default null,
  p_descripcion text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_periodo text := btrim(coalesce(p_periodo, ''));
  v_fecha date := coalesce(p_fecha_pago, current_date);
  v_descripcion text := btrim(coalesce(p_descripcion, ''));
  v_item jsonb;
  v_empleado_id uuid;
  v_bruto numeric(14, 2);
  v_deducciones numeric(14, 2);
  v_neto numeric(14, 2);
  v_total_bruto numeric(14, 2) := 0;
  v_total_deducciones numeric(14, 2) := 0;
  v_total_neto numeric(14, 2) := 0;
  v_corrida_id uuid;
  v_asiento_id uuid;
  v_lineas jsonb := '[]'::jsonb;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if v_periodo !~ '^[0-9]{4}(0[1-9]|1[0-2])$' then
    raise exception 'periodo de nómina inválido: % (use YYYYMM)', p_periodo
      using errcode = '22023';
  end if;

  if p_detalles is null or jsonb_typeof(p_detalles) <> 'array'
     or jsonb_array_length(p_detalles) = 0 then
    raise exception 'la corrida de nómina requiere al menos un empleado' using errcode = '22023';
  end if;

  if p_cuenta_gasto_id is null or p_cuenta_pago_id is null then
    raise exception 'las cuentas de gasto y de pago son obligatorias' using errcode = '22023';
  end if;

  perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_gasto_id);
  perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_pago_id);

  if p_cuenta_retenciones_id is not null then
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_retenciones_id);
  end if;

  if exists (
    select 1 from public.corridas_nomina c
    where c.empresa_id = p_empresa_id and c.periodo = v_periodo
  ) then
    raise exception 'ya existe una corrida de nómina para el periodo %', v_periodo
      using errcode = '23505';
  end if;

  for v_item in select value from jsonb_array_elements(p_detalles) loop
    v_empleado_id := (v_item ->> 'empleado_id')::uuid;
    v_bruto := round(coalesce((v_item ->> 'salario_bruto')::numeric, 0), 2);
    v_deducciones := round(coalesce((v_item ->> 'deducciones')::numeric, 0), 2);
    v_neto := round(v_bruto - v_deducciones, 2);

    if v_empleado_id is null then
      raise exception 'cada detalle de nómina requiere empleado_id' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.empleados e
      where e.id = v_empleado_id and e.empresa_id = p_empresa_id and e.activo
    ) then
      raise exception 'empleado % no encontrado o inactivo', v_empleado_id
        using errcode = '22023';
    end if;

    if v_bruto < 0 or v_deducciones < 0 or v_neto < 0 then
      raise exception 'los montos de nómina no pueden ser negativos' using errcode = '22023';
    end if;

    v_total_bruto := round(v_total_bruto + v_bruto, 2);
    v_total_deducciones := round(v_total_deducciones + v_deducciones, 2);
    v_total_neto := round(v_total_neto + v_neto, 2);
  end loop;

  if v_total_bruto <= 0 then
    raise exception 'el total bruto de la nómina debe ser mayor a cero' using errcode = '22023';
  end if;

  if v_total_deducciones > 0 and p_cuenta_retenciones_id is null then
    raise exception 'la nómina con deducciones requiere cuenta de retenciones'
      using errcode = '22023';
  end if;

  v_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', p_cuenta_gasto_id,
    'descripcion', 'Gasto de nómina ' || v_periodo,
    'debito', v_total_bruto,
    'credito', 0
  ));

  if v_total_deducciones > 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', p_cuenta_retenciones_id,
      'descripcion', 'Deducciones de nómina ' || v_periodo,
      'debito', 0,
      'credito', v_total_deducciones
    ));
  end if;

  if v_total_neto > 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', p_cuenta_pago_id,
      'descripcion', 'Nómina neta por pagar ' || v_periodo,
      'debito', 0,
      'credito', v_total_neto
    ));
  end if;

  if jsonb_array_length(v_lineas) < 2 then
    raise exception 'la corrida de nómina no genera un asiento válido' using errcode = '22023';
  end if;

  v_asiento_id := public._contabilizar_asiento_interno(
    p_empresa_id, v_fecha, 'payroll',
    coalesce(nullif(v_descripcion, ''), 'Corrida de nómina ' || v_periodo),
    'NOM-' || v_periodo, v_lineas, 'posted'
  );

  insert into public.corridas_nomina (
    empresa_id, periodo, fecha_pago, descripcion, total_bruto,
    total_deducciones, total_neto, detalles, cuenta_gasto_id,
    cuenta_retenciones_id, cuenta_pago_id, estado, asiento_id
  )
  values (
    p_empresa_id, v_periodo, v_fecha,
    coalesce(nullif(v_descripcion, ''), 'Corrida de nómina ' || v_periodo),
    v_total_bruto, v_total_deducciones, v_total_neto, p_detalles,
    p_cuenta_gasto_id, p_cuenta_retenciones_id, p_cuenta_pago_id,
    'posted', v_asiento_id
  )
  returning id into v_corrida_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'contabilizar', 'corridas_nomina', v_corrida_id::text,
    jsonb_build_object(
      'periodo', v_periodo, 'total_bruto', v_total_bruto,
      'total_deducciones', v_total_deducciones, 'total_neto', v_total_neto,
      'asiento_id', v_asiento_id
    )
  );

  return v_corrida_id;
end;
$$;

create or replace function public.anular_corrida_nomina(
  p_empresa_id uuid,
  p_corrida_id uuid,
  p_fecha_anulacion date default current_date,
  p_motivo text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corrida public.corridas_nomina%rowtype;
  v_reverso uuid;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  select * into v_corrida
    from public.corridas_nomina c
   where c.id = p_corrida_id and c.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'corrida de nómina no encontrada' using errcode = '22023';
  end if;

  if v_corrida.estado <> 'posted' or v_corrida.asiento_id is null then
    raise exception 'solo se anulan corridas contabilizadas' using errcode = '22023';
  end if;

  v_reverso := public._revertir_asiento_interno(
    p_empresa_id, v_corrida.asiento_id, coalesce(p_fecha_anulacion, current_date),
    coalesce(nullif(btrim(p_motivo), ''), 'Anulación de nómina ' || v_corrida.periodo)
  );

  update public.corridas_nomina c
     set estado = 'void'
   where c.id = v_corrida.id;

  perform public.registrar_auditoria(
    p_empresa_id, 'anular', 'corridas_nomina', v_corrida.id::text,
    jsonb_build_object('periodo', v_corrida.periodo, 'reverso_asiento_id', v_reverso)
  );

  return v_reverso;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. RPCs de documentos almacenados
-- ---------------------------------------------------------------------------

create or replace function public.registrar_documento_almacenado(
  p_empresa_id uuid,
  p_entidad text,
  p_entidad_id text,
  p_nombre_archivo text,
  p_ruta_storage text,
  p_mime_type text default '',
  p_tamano_bytes bigint default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento_id uuid;
  v_ruta text := btrim(coalesce(p_ruta_storage, ''));
  v_entidad text := nullif(btrim(coalesce(p_entidad, '')), '');
  v_archivo text := nullif(btrim(coalesce(p_nombre_archivo, '')), '');
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_entidad is null or v_archivo is null or v_ruta = '' then
    raise exception 'entidad, nombre de archivo y ruta son obligatorios' using errcode = '22023';
  end if;

  if v_ruta !~ ('^' || p_empresa_id::text || '/[A-Za-z0-9._/-]+$') or v_ruta ~ '\.\.' then
    raise exception 'la ruta del documento debe iniciar con el identificador de la empresa'
      using errcode = '22023';
  end if;

  if coalesce(p_tamano_bytes, 0) < 0 then
    raise exception 'el tamaño del archivo no puede ser negativo' using errcode = '22023';
  end if;

  insert into public.documentos_almacenados (
    empresa_id, entidad, entidad_id, nombre_archivo, ruta_storage,
    mime_type, tamano_bytes, subido_por
  )
  values (
    p_empresa_id, v_entidad, btrim(coalesce(p_entidad_id, '')), v_archivo, v_ruta,
    btrim(coalesce(p_mime_type, '')), coalesce(p_tamano_bytes, 0), auth.uid()
  )
  returning id into v_documento_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'subir', 'documentos_almacenados', v_documento_id::text,
    jsonb_build_object('entidad', v_entidad, 'ruta_storage', v_ruta)
  );

  return v_documento_id;
end;
$$;

create or replace function public.eliminar_documento_almacenado(
  p_empresa_id uuid,
  p_documento_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento public.documentos_almacenados%rowtype;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  select * into v_documento
    from public.documentos_almacenados d
   where d.id = p_documento_id and d.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'documento almacenado no encontrado' using errcode = '22023';
  end if;

  delete from storage.objects o
   where o.bucket_id = 'documentos' and o.name = v_documento.ruta_storage;

  delete from public.documentos_almacenados d where d.id = v_documento.id;

  perform public.registrar_auditoria(
    p_empresa_id, 'eliminar', 'documentos_almacenados', v_documento.id::text,
    jsonb_build_object('ruta_storage', v_documento.ruta_storage)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Permisos de ejecución (nunca anon)
-- ---------------------------------------------------------------------------

revoke all on function public.guardar_cuenta_bancaria(uuid, text, uuid, text, text, text, numeric, boolean, uuid) from public, anon;
revoke all on function public.registrar_movimiento_bancario(uuid, uuid, date, text, numeric, text, text, uuid) from public, anon;
revoke all on function public.importar_movimientos_bancarios(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.crear_sesion_conciliacion(uuid, uuid, date, numeric, numeric) from public, anon;
revoke all on function public.marcar_movimiento_conciliado(uuid, uuid, uuid, boolean) from public, anon;
revoke all on function public.cerrar_sesion_conciliacion(uuid, uuid, date) from public, anon;
revoke all on function public.guardar_articulo_inventario(uuid, text, text, text, text, numeric, uuid, uuid, uuid, boolean, uuid) from public, anon;
revoke all on function public.registrar_movimiento_inventario(uuid, uuid, date, text, numeric, numeric, uuid, text, text, text) from public, anon;
revoke all on function public.guardar_activo_fijo(uuid, text, text, date, numeric, integer, uuid, uuid, uuid, text, numeric, uuid) from public, anon;
revoke all on function public.correr_depreciacion_periodo(uuid, text, date) from public, anon;
revoke all on function public.guardar_empleado(uuid, text, text, numeric, text, text, text, date, boolean, uuid) from public, anon;
revoke all on function public.contabilizar_corrida_nomina(uuid, text, date, uuid, uuid, jsonb, uuid, text) from public, anon;
revoke all on function public.anular_corrida_nomina(uuid, uuid, date, text) from public, anon;
revoke all on function public.registrar_documento_almacenado(uuid, text, text, text, text, text, bigint) from public, anon;
revoke all on function public.eliminar_documento_almacenado(uuid, uuid) from public, anon;

grant execute on function public.guardar_cuenta_bancaria(uuid, text, uuid, text, text, text, numeric, boolean, uuid) to authenticated;
grant execute on function public.registrar_movimiento_bancario(uuid, uuid, date, text, numeric, text, text, uuid) to authenticated;
grant execute on function public.importar_movimientos_bancarios(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.crear_sesion_conciliacion(uuid, uuid, date, numeric, numeric) to authenticated;
grant execute on function public.marcar_movimiento_conciliado(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.cerrar_sesion_conciliacion(uuid, uuid, date) to authenticated;
grant execute on function public.guardar_articulo_inventario(uuid, text, text, text, text, numeric, uuid, uuid, uuid, boolean, uuid) to authenticated;
grant execute on function public.registrar_movimiento_inventario(uuid, uuid, date, text, numeric, numeric, uuid, text, text, text) to authenticated;
grant execute on function public.guardar_activo_fijo(uuid, text, text, date, numeric, integer, uuid, uuid, uuid, text, numeric, uuid) to authenticated;
grant execute on function public.correr_depreciacion_periodo(uuid, text, date) to authenticated;
grant execute on function public.guardar_empleado(uuid, text, text, numeric, text, text, text, date, boolean, uuid) to authenticated;
grant execute on function public.contabilizar_corrida_nomina(uuid, text, date, uuid, uuid, jsonb, uuid, text) to authenticated;
grant execute on function public.anular_corrida_nomina(uuid, uuid, date, text) to authenticated;
grant execute on function public.registrar_documento_almacenado(uuid, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.eliminar_documento_almacenado(uuid, uuid) to authenticated;
