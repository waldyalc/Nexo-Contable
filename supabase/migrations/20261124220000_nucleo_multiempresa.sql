-- =============================================================================
-- Nexo Contable · Núcleo multi-empresa (Fase 1)
-- =============================================================================
-- Crea las tablas base del modelo multi-empresa:
--   · perfiles          → perfil de aplicación enlazado a auth.users.
--   · empresas          → empresa contable (RNL normalizado y único).
--   · empresa_usuarios  → asignación de usuarios a empresas con rol.
--   · auditoria         → bitácora append-only.
--
-- Autorización:
--   · public.es_admin_global()       → true si el usuario es admin_global activo.
--   · public.rol_en_empresa(uuid)    → rol del usuario en la empresa o NULL.
--   · public.exigir_rol_empresa(...) → lanza 42501 si el rol no está permitido.
--
-- Seguridad:
--   · RLS activo en todas las tablas; anon no ve nada.
--   · authenticated solo tiene SELECT filtrado por empresa.
--   · Toda escritura pasa por RPCs security definer con search_path vacío.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers generales
-- ---------------------------------------------------------------------------

-- Limpia un RNC/cédula: elimina espacios, guiones, puntos y cualquier carácter
-- que no sea alfanumérico y normaliza a mayúsculas.
create or replace function public.normalizar_rnc(p_rnc text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_rnc, ''), '[^[:alnum:]]', '', 'g'));
$$;

-- Mantiene actualizado_en al día en cada UPDATE.
create or replace function public.actualizar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas del núcleo
-- ---------------------------------------------------------------------------

create table public.perfiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null default '',
  rol_global text not null default 'usuario'
    check (rol_global in ('admin_global', 'usuario')),
  debe_definir_password boolean not null default true,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint perfiles_email_key unique (email)
);

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text not null,
  rnc text not null default '',
  rnc_normalizado text not null default '',
  tipo_empresa text not null default '',
  direccion text not null default '',
  telefono text not null default '',
  correo text not null default '',
  representante_legal text not null default '',
  actividad_economica text not null default '',
  fecha_inicio date,
  regimen_fiscal text not null default 'ordinario',
  moneda_funcional text not null default 'DOP',
  periodo_fiscal text not null default '01-12',
  estado text not null default 'active'
    check (estado in ('active', 'inactive')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index idx_empresas_rnc_normalizado_unique
  on public.empresas (rnc_normalizado)
  where rnc_normalizado <> '';

create table public.empresa_usuarios (
  user_id uuid not null references public.perfiles (user_id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  rol text not null
    check (rol in ('admin_empresa', 'contador', 'auxiliar', 'cliente')),
  es_principal boolean not null default false,
  creado_en timestamptz not null default now(),
  primary key (user_id, empresa_id)
);

create unique index idx_empresa_usuarios_principal_por_usuario
  on public.empresa_usuarios (user_id)
  where es_principal = true;

create index idx_empresa_usuarios_empresa on public.empresa_usuarios (empresa_id);

create table public.auditoria (
  id bigserial primary key,
  actor_id uuid references public.perfiles (user_id),
  empresa_id uuid references public.empresas (id) on delete cascade,
  accion text not null,
  entidad text not null,
  entidad_id text not null default '',
  detalles jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index idx_auditoria_empresa_creado on public.auditoria (empresa_id, creado_en desc);
create index idx_auditoria_actor on public.auditoria (actor_id);

-- ---------------------------------------------------------------------------
-- Funciones de trigger
-- ---------------------------------------------------------------------------

create or replace function public.empresas_normalizar_rnc()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rnc_normalizado := public.normalizar_rnc(new.rnc);
  return new;
end;
$$;

create or replace function public.auditoria_solo_insercion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La auditoría es append-only: no se permite % sobre public.auditoria', tg_op
    using errcode = '42501';
end;
$$;

create trigger empresas_normalizar_rnc
before insert or update on public.empresas
for each row
execute function public.empresas_normalizar_rnc();

create trigger perfiles_actualizado_en
before update on public.perfiles
for each row
execute function public.actualizar_actualizado_en();

create trigger empresas_actualizado_en
before update on public.empresas
for each row
execute function public.actualizar_actualizado_en();

create trigger auditoria_append_only
before update or delete on public.auditoria
for each row
execute function public.auditoria_solo_insercion();

-- ---------------------------------------------------------------------------
-- Autorización multi-empresa
-- ---------------------------------------------------------------------------

create or replace function public.es_admin_global()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and p.rol_global = 'admin_global'
      and p.activo = true
  );
$$;

create or replace function public.rol_en_empresa(p_empresa_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rol_global text;
  v_rol text;
begin
  if v_user_id is null or p_empresa_id is null then
    return null;
  end if;

  select p.rol_global
    into v_rol_global
  from public.perfiles p
  where p.user_id = v_user_id
    and p.activo = true;

  if v_rol_global is null then
    return null;
  end if;

  if v_rol_global = 'admin_global' then
    return 'admin_global';
  end if;

  select eu.rol
    into v_rol
  from public.empresa_usuarios eu
  where eu.user_id = v_user_id
    and eu.empresa_id = p_empresa_id;

  return v_rol;
end;
$$;

create or replace function public.exigir_rol_empresa(p_empresa_id uuid, p_roles text[])
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rol text;
begin
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Debe indicar al menos un rol permitido' using errcode = '22023';
  end if;

  v_rol := public.rol_en_empresa(p_empresa_id);

  if v_rol is null or not (v_rol = any (p_roles)) then
    raise exception 'Permiso denegado para la empresa % (rol requerido: %)',
      p_empresa_id, array_to_string(p_roles, ', ')
      using errcode = '42501';
  end if;

  return v_rol;
end;
$$;

-- Un usuario con rol admin_empresa/contador puede ver los perfiles de sus
-- compañeros de empresa; el resto solo se ve a sí mismo.
create or replace function public.comparte_empresa_con(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.empresa_usuarios colega
    join public.empresa_usuarios yo on yo.empresa_id = colega.empresa_id
    where colega.user_id = p_user_id
      and yo.user_id = auth.uid()
      and yo.rol in ('admin_empresa', 'contador')
  );
$$;

create or replace function public.registrar_auditoria(
  p_empresa_id uuid,
  p_accion text,
  p_entidad text,
  p_entidad_id text,
  p_detalles jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accion is null or btrim(p_accion) = '' then
    raise exception 'La acción de auditoría es obligatoria' using errcode = '22023';
  end if;

  if p_entidad is null or btrim(p_entidad) = '' then
    raise exception 'La entidad de auditoría es obligatoria' using errcode = '22023';
  end if;

  insert into public.auditoria (actor_id, empresa_id, accion, entidad, entidad_id, detalles)
  values (
    auth.uid(),
    p_empresa_id,
    p_accion,
    p_entidad,
    coalesce(p_entidad_id, ''),
    coalesce(p_detalles, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: solo lectura filtrada por empresa; escritura solo por RPC
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.empresas enable row level security;
alter table public.empresa_usuarios enable row level security;
alter table public.auditoria enable row level security;

revoke all on table public.perfiles from anon, authenticated;
revoke all on table public.empresas from anon, authenticated;
revoke all on table public.empresa_usuarios from anon, authenticated;
revoke all on table public.auditoria from anon, authenticated;
revoke all on sequence public.auditoria_id_seq from anon, authenticated;

grant select on table public.perfiles to authenticated;
grant select on table public.empresas to authenticated;
grant select on table public.empresa_usuarios to authenticated;
grant select on table public.auditoria to authenticated;

create policy perfiles_select on public.perfiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.es_admin_global()
  or public.comparte_empresa_con(user_id)
);

create policy empresas_select on public.empresas
for select to authenticated
using (public.rol_en_empresa(id) is not null);

create policy empresa_usuarios_select on public.empresa_usuarios
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.rol_en_empresa(empresa_id) in ('admin_global', 'admin_empresa')
);

create policy auditoria_select on public.auditoria
for select to authenticated
using (
  (empresa_id is null and public.es_admin_global())
  or (empresa_id is not null and public.rol_en_empresa(empresa_id) is not null)
);

-- ---------------------------------------------------------------------------
-- RPCs del núcleo
-- ---------------------------------------------------------------------------

create or replace function public.crear_empresa(
  p_nombre_comercial text,
  p_razon_social text,
  p_rnc text default '',
  p_tipo_empresa text default '',
  p_direccion text default '',
  p_telefono text default '',
  p_correo text default '',
  p_representante_legal text default '',
  p_actividad_economica text default '',
  p_fecha_inicio date default null,
  p_regimen_fiscal text default 'ordinario',
  p_moneda_funcional text default 'DOP',
  p_periodo_fiscal text default '01-12'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
begin
  if not public.es_admin_global() then
    raise exception 'Solo un administrador global puede crear empresas' using errcode = '42501';
  end if;

  if coalesce(btrim(p_nombre_comercial), '') = ''
    or coalesce(btrim(p_razon_social), '') = '' then
    raise exception 'El nombre comercial y la razón social son obligatorios'
      using errcode = '22023';
  end if;

  insert into public.empresas (
    nombre_comercial, razon_social, rnc, tipo_empresa, direccion, telefono,
    correo, representante_legal, actividad_economica, fecha_inicio,
    regimen_fiscal, moneda_funcional, periodo_fiscal
  )
  values (
    btrim(p_nombre_comercial),
    btrim(p_razon_social),
    coalesce(p_rnc, ''),
    coalesce(p_tipo_empresa, ''),
    coalesce(p_direccion, ''),
    coalesce(p_telefono, ''),
    coalesce(p_correo, ''),
    coalesce(p_representante_legal, ''),
    coalesce(p_actividad_economica, ''),
    p_fecha_inicio,
    coalesce(nullif(btrim(p_regimen_fiscal), ''), 'ordinario'),
    coalesce(nullif(btrim(p_moneda_funcional), ''), 'DOP'),
    coalesce(nullif(btrim(p_periodo_fiscal), ''), '01-12')
  )
  returning id into v_empresa_id;

  perform public.registrar_auditoria(
    v_empresa_id,
    'crear',
    'empresas',
    v_empresa_id::text,
    jsonb_build_object(
      'nombre_comercial', btrim(p_nombre_comercial),
      'rnc_normalizado', public.normalizar_rnc(p_rnc)
    )
  );

  return v_empresa_id;
end;
$$;

create or replace function public.actualizar_empresa(
  p_empresa_id uuid,
  p_nombre_comercial text,
  p_razon_social text,
  p_rnc text default '',
  p_tipo_empresa text default '',
  p_direccion text default '',
  p_telefono text default '',
  p_correo text default '',
  p_representante_legal text default '',
  p_actividad_economica text default '',
  p_fecha_inicio date default null,
  p_regimen_fiscal text default 'ordinario',
  p_moneda_funcional text default 'DOP',
  p_periodo_fiscal text default '01-12',
  p_estado text default 'active'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_global', 'admin_empresa']);

  if coalesce(btrim(p_nombre_comercial), '') = ''
    or coalesce(btrim(p_razon_social), '') = '' then
    raise exception 'El nombre comercial y la razón social son obligatorios'
      using errcode = '22023';
  end if;

  if p_estado is null or p_estado not in ('active', 'inactive') then
    raise exception 'Estado de empresa inválido: %', p_estado using errcode = '22023';
  end if;

  update public.empresas
  set nombre_comercial = btrim(p_nombre_comercial),
      razon_social = btrim(p_razon_social),
      rnc = coalesce(p_rnc, ''),
      tipo_empresa = coalesce(p_tipo_empresa, ''),
      direccion = coalesce(p_direccion, ''),
      telefono = coalesce(p_telefono, ''),
      correo = coalesce(p_correo, ''),
      representante_legal = coalesce(p_representante_legal, ''),
      actividad_economica = coalesce(p_actividad_economica, ''),
      fecha_inicio = p_fecha_inicio,
      regimen_fiscal = coalesce(nullif(btrim(p_regimen_fiscal), ''), 'ordinario'),
      moneda_funcional = coalesce(nullif(btrim(p_moneda_funcional), ''), 'DOP'),
      periodo_fiscal = coalesce(nullif(btrim(p_periodo_fiscal), ''), '01-12'),
      estado = p_estado
  where id = p_empresa_id;

  if not found then
    raise exception 'La empresa % no existe', p_empresa_id using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    'actualizar',
    'empresas',
    p_empresa_id::text,
    jsonb_build_object('estado', p_estado)
  );
end;
$$;

create or replace function public.asignar_usuario_empresa(
  p_user_id uuid,
  p_empresa_id uuid,
  p_rol text,
  p_es_principal boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_global', 'admin_empresa']);

  if p_user_id is null then
    raise exception 'El usuario es obligatorio' using errcode = '22023';
  end if;

  if p_rol is null or p_rol not in ('admin_empresa', 'contador', 'auxiliar', 'cliente') then
    raise exception 'Rol de empresa inválido: %', p_rol using errcode = '22023';
  end if;

  if not exists (select 1 from public.perfiles p where p.user_id = p_user_id) then
    raise exception 'El usuario % no existe', p_user_id using errcode = '22023';
  end if;

  if not exists (select 1 from public.empresas e where e.id = p_empresa_id) then
    raise exception 'La empresa % no existe', p_empresa_id using errcode = '22023';
  end if;

  if coalesce(p_es_principal, false) then
    update public.empresa_usuarios
    set es_principal = false
    where user_id = p_user_id
      and es_principal = true
      and empresa_id <> p_empresa_id;
  end if;

  insert into public.empresa_usuarios (user_id, empresa_id, rol, es_principal)
  values (p_user_id, p_empresa_id, p_rol, coalesce(p_es_principal, false))
  on conflict (user_id, empresa_id) do update
  set rol = excluded.rol,
      es_principal = excluded.es_principal;

  perform public.registrar_auditoria(
    p_empresa_id,
    'asignar_usuario',
    'empresa_usuarios',
    p_user_id::text,
    jsonb_build_object('rol', p_rol, 'es_principal', coalesce(p_es_principal, false))
  );
end;
$$;

create or replace function public.remover_usuario_empresa(
  p_user_id uuid,
  p_empresa_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_global', 'admin_empresa']);

  delete from public.empresa_usuarios
  where user_id = p_user_id
    and empresa_id = p_empresa_id;

  if not found then
    raise exception 'El usuario % no tiene acceso a la empresa %', p_user_id, p_empresa_id
      using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    'remover_usuario',
    'empresa_usuarios',
    p_user_id::text
  );
end;
$$;

create or replace function public.marcar_empresa_principal(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rol text;
begin
  v_rol := public.rol_en_empresa(p_empresa_id);

  if v_user_id is null or v_rol is null then
    raise exception 'Permiso denegado para la empresa %', p_empresa_id using errcode = '42501';
  end if;

  if not exists (select 1 from public.empresas e where e.id = p_empresa_id) then
    raise exception 'La empresa % no existe', p_empresa_id using errcode = '22023';
  end if;

  -- Un admin_global puede marcar como principal cualquier empresa aunque no
  -- tenga una fila explícita en empresa_usuarios.
  if v_rol = 'admin_global' then
    insert into public.empresa_usuarios (user_id, empresa_id, rol, es_principal)
    values (v_user_id, p_empresa_id, 'admin_empresa', false)
    on conflict (user_id, empresa_id) do nothing;
  end if;

  update public.empresa_usuarios
  set es_principal = false
  where user_id = v_user_id
    and empresa_id <> p_empresa_id
    and es_principal = true;

  update public.empresa_usuarios
  set es_principal = true
  where user_id = v_user_id
    and empresa_id = p_empresa_id;

  if not found then
    raise exception 'El usuario no tiene acceso a la empresa %', p_empresa_id
      using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    'marcar_principal',
    'empresa_usuarios',
    v_user_id::text
  );
end;
$$;

create or replace function public.completar_definicion_password()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;

  update public.perfiles
  set debe_definir_password = false
  where user_id = v_user_id;

  if not found then
    raise exception 'El perfil del usuario % no existe', v_user_id using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    null,
    'completar_password',
    'perfiles',
    v_user_id::text
  );
end;
$$;

create or replace function public.actualizar_usuario(
  p_user_id uuid,
  p_nombre text,
  p_activo boolean,
  p_rol_global text default null,
  p_debe_definir_password boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin_global() then
    raise exception 'Solo un administrador global puede actualizar usuarios'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'El usuario es obligatorio' using errcode = '22023';
  end if;

  if p_rol_global is not null and p_rol_global not in ('admin_global', 'usuario') then
    raise exception 'Rol global inválido: %', p_rol_global using errcode = '22023';
  end if;

  update public.perfiles
  set nombre = coalesce(p_nombre, nombre),
      activo = coalesce(p_activo, activo),
      rol_global = coalesce(p_rol_global, rol_global),
      debe_definir_password = coalesce(p_debe_definir_password, debe_definir_password)
  where user_id = p_user_id;

  if not found then
    raise exception 'El usuario % no existe', p_user_id using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    null,
    'actualizar',
    'perfiles',
    p_user_id::text,
    jsonb_build_object(
      'activo', p_activo,
      'rol_global', p_rol_global,
      'debe_definir_password', p_debe_definir_password
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke all on function public.normalizar_rnc(text) from public, anon, authenticated;
revoke all on function public.actualizar_actualizado_en() from public, anon, authenticated;
revoke all on function public.empresas_normalizar_rnc() from public, anon, authenticated;
revoke all on function public.auditoria_solo_insercion() from public, anon, authenticated;
revoke all on function public.es_admin_global() from public, anon, authenticated;
revoke all on function public.rol_en_empresa(uuid) from public, anon, authenticated;
revoke all on function public.exigir_rol_empresa(uuid, text[]) from public, anon, authenticated;
revoke all on function public.comparte_empresa_con(uuid) from public, anon, authenticated;
revoke all on function public.registrar_auditoria(uuid, text, text, text, jsonb)
  from public, anon, authenticated;

revoke all on function public.crear_empresa(
  text, text, text, text, text, text, text, text, text, date, text, text, text
) from public, anon, authenticated;
revoke all on function public.actualizar_empresa(
  uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.asignar_usuario_empresa(uuid, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.remover_usuario_empresa(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.marcar_empresa_principal(uuid)
  from public, anon, authenticated;
revoke all on function public.completar_definicion_password()
  from public, anon, authenticated;
revoke all on function public.actualizar_usuario(uuid, text, boolean, text, boolean)
  from public, anon, authenticated;

grant execute on function public.normalizar_rnc(text) to authenticated;
grant execute on function public.es_admin_global() to authenticated;
grant execute on function public.rol_en_empresa(uuid) to authenticated;
grant execute on function public.comparte_empresa_con(uuid) to authenticated;

grant execute on function public.crear_empresa(
  text, text, text, text, text, text, text, text, text, date, text, text, text
) to authenticated;
grant execute on function public.actualizar_empresa(
  uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text
) to authenticated;
grant execute on function public.asignar_usuario_empresa(uuid, uuid, text, boolean)
  to authenticated;
grant execute on function public.remover_usuario_empresa(uuid, uuid)
  to authenticated;
grant execute on function public.marcar_empresa_principal(uuid)
  to authenticated;
grant execute on function public.completar_definicion_password()
  to authenticated;
grant execute on function public.actualizar_usuario(uuid, text, boolean, text, boolean)
  to authenticated;
