-- =============================================================================
-- Nexo Contable · Motor contable (Fase 1)
-- =============================================================================
-- Periodos contables, catálogo de cuentas, asientos de partida doble y terceros.
--
-- Invariantes:
--   · Todo asiento contabilizado ('posted') o de reverso ('reversal') tiene
--     al menos 2 líneas, SUM(debito) = SUM(credito) y todas las líneas
--     pertenecen a la misma empresa del asiento.
--   · Nunca se borran asientos contabilizados: se revierten con un asiento
--     'reversal' que invierte débitos y créditos.
--   · No se contabiliza en cuentas inactivas, de agrupación o con subcuentas.
--   · Solo se contabiliza dentro de un periodo abierto.
--   · Numeración atómica por empresa y año: JE-YYYY-00001.
--
-- Escritura exclusivamente por RPCs security definer (search_path vacío).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.periodos_contables (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  estado text not null default 'open'
    check (estado in ('open', 'closed')),
  cerrado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint periodos_contables_fechas_validas check (fecha_fin >= fecha_inicio),
  constraint periodos_contables_empresa_nombre_key unique (empresa_id, nombre)
);

create index idx_periodos_contables_empresa
  on public.periodos_contables (empresa_id, fecha_inicio, fecha_fin);

create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  padre_id uuid,
  clasificacion text not null
    check (clasificacion in ('asset', 'liability', 'equity', 'income', 'cost', 'expense')),
  naturaleza text not null
    check (naturaleza in ('debit', 'credit')),
  nivel integer not null default 1 check (nivel >= 1),
  es_agrupacion boolean not null default false,
  activa boolean not null default true,
  es_equivalente_efectivo boolean not null default false,
  categoria_flujo_efectivo text not null default 'operating'
    check (categoria_flujo_efectivo in ('operating', 'investing', 'financing', 'other')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cuentas_empresa_codigo_key unique (empresa_id, codigo),
  constraint cuentas_empresa_id_key unique (empresa_id, id),
  constraint cuentas_padre_misma_empresa_fk
    foreign key (empresa_id, padre_id)
    references public.cuentas (empresa_id, id)
);

create index idx_cuentas_empresa on public.cuentas (empresa_id);
create index idx_cuentas_padre on public.cuentas (padre_id);

create table public.secuencias_asientos (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  anio integer not null,
  ultimo_numero integer not null default 0 check (ultimo_numero >= 0),
  primary key (empresa_id, anio)
);

create table public.asientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero text not null,
  fecha date not null,
  tipo_operacion text not null default 'manual',
  descripcion text not null,
  referencia text not null default '',
  estado text not null default 'draft'
    check (estado in ('draft', 'posted', 'reversed', 'reversal')),
  reverso_de uuid,
  revertido_por uuid,
  creado_por uuid references public.perfiles (user_id),
  contabilizado_por uuid references public.perfiles (user_id),
  contabilizado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint asientos_empresa_numero_key unique (empresa_id, numero),
  constraint asientos_empresa_id_key unique (empresa_id, id),
  constraint asientos_reverso_de_fk
    foreign key (empresa_id, reverso_de)
    references public.asientos (empresa_id, id),
  constraint asientos_revertido_por_fk
    foreign key (empresa_id, revertido_por)
    references public.asientos (empresa_id, id)
);

create index idx_asientos_empresa_fecha on public.asientos (empresa_id, fecha);
create index idx_asientos_empresa_estado on public.asientos (empresa_id, estado);
create index idx_asientos_reverso_de on public.asientos (reverso_de);

create table public.asiento_lineas (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  linea integer not null check (linea >= 1),
  cuenta_id uuid not null,
  descripcion text not null default '',
  debito numeric(14,2) not null default 0 check (debito >= 0),
  credito numeric(14,2) not null default 0 check (credito >= 0),
  creado_en timestamptz not null default now(),
  constraint asiento_lineas_un_lado check (
    (debito > 0 and credito = 0) or (credito > 0 and debito = 0)
  ),
  constraint asiento_lineas_asiento_linea_key unique (asiento_id, linea),
  constraint asiento_lineas_asiento_fk
    foreign key (empresa_id, asiento_id)
    references public.asientos (empresa_id, id) on delete cascade,
  constraint asiento_lineas_cuenta_fk
    foreign key (empresa_id, cuenta_id)
    references public.cuentas (empresa_id, id)
);

create index idx_asiento_lineas_asiento on public.asiento_lineas (asiento_id);
create index idx_asiento_lineas_empresa on public.asiento_lineas (empresa_id);
create index idx_asiento_lineas_cuenta on public.asiento_lineas (cuenta_id);

create table public.terceros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null
    check (tipo in ('customer', 'supplier', 'both')),
  nombre text not null,
  rnc text not null default '',
  rnc_normalizado text not null default '',
  correo text not null default '',
  telefono text not null default '',
  direccion text not null default '',
  cuenta_por_pagar_id uuid,
  cuenta_por_cobrar_id uuid,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint terceros_cuenta_por_pagar_fk
    foreign key (empresa_id, cuenta_por_pagar_id)
    references public.cuentas (empresa_id, id),
  constraint terceros_cuenta_por_cobrar_fk
    foreign key (empresa_id, cuenta_por_cobrar_id)
    references public.cuentas (empresa_id, id)
);

create unique index idx_terceros_rnc_normalizado_unique
  on public.terceros (empresa_id, rnc_normalizado)
  where rnc_normalizado <> '';

create index idx_terceros_empresa on public.terceros (empresa_id);
create index idx_terceros_cuenta_por_pagar on public.terceros (cuenta_por_pagar_id);
create index idx_terceros_cuenta_por_cobrar on public.terceros (cuenta_por_cobrar_id);

-- ---------------------------------------------------------------------------
-- Funciones de trigger
-- ---------------------------------------------------------------------------

create or replace function public.terceros_normalizar_rnc()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rnc_normalizado := public.normalizar_rnc(new.rnc);
  return new;
end;
$$;

create trigger periodos_contables_actualizado_en
before update on public.periodos_contables
for each row
execute function public.actualizar_actualizado_en();

create trigger cuentas_actualizado_en
before update on public.cuentas
for each row
execute function public.actualizar_actualizado_en();

create trigger asientos_actualizado_en
before update on public.asientos
for each row
execute function public.actualizar_actualizado_en();

create trigger terceros_actualizado_en
before update on public.terceros
for each row
execute function public.actualizar_actualizado_en();

create trigger terceros_normalizar_rnc
before insert or update on public.terceros
for each row
execute function public.terceros_normalizar_rnc();

-- ---------------------------------------------------------------------------
-- Invariantes del asiento: partida doble y pertenencia a la empresa
-- ---------------------------------------------------------------------------

create or replace function public._validar_asiento_cuadre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento_id uuid;
  v_estado text;
  v_empresa_id uuid;
  v_lineas integer;
  v_debitos numeric(14,2);
  v_creditos numeric(14,2);
  v_otra_empresa integer;
begin
  if tg_table_name = 'asientos' then
    v_asiento_id := new.id;
  elsif tg_op = 'DELETE' then
    v_asiento_id := old.asiento_id;
  else
    v_asiento_id := new.asiento_id;
  end if;

  select a.estado, a.empresa_id
    into v_estado, v_empresa_id
  from public.asientos a
  where a.id = v_asiento_id;

  -- El asiento pudo eliminarse en borrador: nada que validar.
  if not found then
    return null;
  end if;

  if v_estado not in ('posted', 'reversal') then
    return null;
  end if;

  select count(*),
         coalesce(sum(l.debito), 0),
         coalesce(sum(l.credito), 0),
         count(*) filter (where l.empresa_id <> v_empresa_id)
    into v_lineas, v_debitos, v_creditos, v_otra_empresa
  from public.asiento_lineas l
  where l.asiento_id = v_asiento_id;

  if v_lineas < 2 then
    raise exception 'El asiento % requiere al menos 2 líneas (tiene %)',
      v_asiento_id, v_lineas
      using errcode = '23514';
  end if;

  if v_otra_empresa > 0 then
    raise exception 'El asiento % tiene líneas de otra empresa', v_asiento_id
      using errcode = '23514';
  end if;

  if v_debitos <> v_creditos then
    raise exception 'El asiento % está descuadrado (débitos % vs créditos %)',
      v_asiento_id, v_debitos, v_creditos
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger asientos_cuadre
after insert or update on public.asientos
deferrable initially deferred
for each row
execute function public._validar_asiento_cuadre();

create constraint trigger asiento_lineas_cuadre
after insert or update or delete on public.asiento_lineas
deferrable initially deferred
for each row
execute function public._validar_asiento_cuadre();

-- Inmutabilidad: un asiento contabilizado no se elimina ni se altera (salvo
-- los campos de estado/contabilización usados por el motor).
create or replace function public.asientos_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado <> 'draft' then
      raise exception 'No se puede eliminar el asiento % en estado %; use revertir_asiento',
        old.numero, old.estado
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.estado <> 'draft' then
    if new.empresa_id is distinct from old.empresa_id
      or new.numero is distinct from old.numero
      or new.fecha is distinct from old.fecha
      or new.tipo_operacion is distinct from old.tipo_operacion
      or new.descripcion is distinct from old.descripcion
      or new.referencia is distinct from old.referencia
      or new.reverso_de is distinct from old.reverso_de
      or new.creado_por is distinct from old.creado_por
      or new.creado_en is distinct from old.creado_en then
      raise exception 'El asiento % ya está contabilizado y no puede modificarse; use revertir_asiento',
        old.numero
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger asientos_proteger
before update or delete on public.asientos
for each row
execute function public.asientos_proteger();

create or replace function public.asiento_lineas_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento_id uuid;
  v_estado text;
begin
  if tg_op = 'DELETE' then
    v_asiento_id := old.asiento_id;
  else
    v_asiento_id := new.asiento_id;
  end if;

  select a.estado
    into v_estado
  from public.asientos a
  where a.id = v_asiento_id;

  if v_estado is not null and v_estado <> 'draft' then
    raise exception 'No se pueden % líneas de un asiento contabilizado (estado %)',
      lower(tg_op), v_estado
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger asiento_lineas_proteger
before update or delete on public.asiento_lineas
for each row
execute function public.asiento_lineas_proteger();

-- ---------------------------------------------------------------------------
-- Helpers internos del motor (solo invocables por RPCs security definer)
-- ---------------------------------------------------------------------------

create or replace function public._siguiente_numero_asiento(
  p_empresa_id uuid,
  p_fecha date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio integer;
  v_numero integer;
begin
  if p_empresa_id is null or p_fecha is null then
    raise exception 'La empresa y la fecha son obligatorias para numerar el asiento'
      using errcode = '22023';
  end if;

  v_anio := extract(year from p_fecha)::integer;

  insert into public.secuencias_asientos (empresa_id, anio, ultimo_numero)
  values (p_empresa_id, v_anio, 0)
  on conflict (empresa_id, anio) do nothing;

  select s.ultimo_numero
    into v_numero
  from public.secuencias_asientos s
  where s.empresa_id = p_empresa_id
    and s.anio = v_anio
  for update;

  v_numero := v_numero + 1;

  update public.secuencias_asientos
  set ultimo_numero = v_numero
  where empresa_id = p_empresa_id
    and anio = v_anio;

  return format('JE-%s-%s', v_anio, lpad(v_numero::text, 5, '0'));
end;
$$;

create or replace function public._validar_periodo_abierto(
  p_empresa_id uuid,
  p_fecha date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_empresa_id is null or p_fecha is null then
    raise exception 'La empresa y la fecha son obligatorias para validar el periodo'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.periodos_contables pc
    where pc.empresa_id = p_empresa_id
      and pc.estado = 'open'
      and p_fecha between pc.fecha_inicio and pc.fecha_fin
  ) then
    raise exception 'No existe un periodo contable abierto para la empresa % en la fecha %',
      p_empresa_id, p_fecha
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public._validar_cuenta_movimiento(
  p_empresa_id uuid,
  p_cuenta_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_empresa_id is null or p_cuenta_id is null then
    raise exception 'La empresa y la cuenta son obligatorias' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.cuentas c
    where c.id = p_cuenta_id
      and c.empresa_id = p_empresa_id
      and c.activa = true
      and c.es_agrupacion = false
  ) then
    raise exception 'La cuenta % no es una cuenta de movimiento activa de la empresa %',
      p_cuenta_id, p_empresa_id
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.cuentas h
    where h.padre_id = p_cuenta_id
  ) then
    raise exception 'La cuenta % tiene subcuentas y no acepta movimientos', p_cuenta_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public._contabilizar_asiento_interno(
  p_empresa_id uuid,
  p_fecha date,
  p_tipo_operacion text,
  p_descripcion text,
  p_referencia text,
  p_lineas jsonb,
  p_estado text default 'posted'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento_id uuid;
  v_numero text;
  v_linea jsonb;
  v_indice integer := 0;
  v_cuenta_id uuid;
  v_debito numeric(14,2);
  v_credito numeric(14,2);
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_total_lineas integer;
begin
  if p_empresa_id is null or p_fecha is null then
    raise exception 'La empresa y la fecha del asiento son obligatorias'
      using errcode = '22023';
  end if;

  if p_estado is null or p_estado not in ('draft', 'posted') then
    raise exception 'Estado de asiento inválido: %', p_estado using errcode = '22023';
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'Las líneas del asiento deben ser un arreglo JSON'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.empresas e where e.id = p_empresa_id) then
    raise exception 'La empresa % no existe', p_empresa_id using errcode = '22023';
  end if;

  v_total_lineas := jsonb_array_length(p_lineas);

  if p_estado = 'posted' then
    perform public._validar_periodo_abierto(p_empresa_id, p_fecha);

    if v_total_lineas < 2 then
      raise exception 'Un asiento contabilizado requiere al menos 2 líneas'
        using errcode = '23514';
    end if;

    if coalesce(btrim(p_descripcion), '') = '' then
      raise exception 'La descripción del asiento es obligatoria' using errcode = '22023';
    end if;
  end if;

  v_numero := public._siguiente_numero_asiento(p_empresa_id, p_fecha);

  insert into public.asientos (
    empresa_id, numero, fecha, tipo_operacion, descripcion, referencia,
    estado, creado_por, contabilizado_por, contabilizado_en
  )
  values (
    p_empresa_id,
    v_numero,
    p_fecha,
    coalesce(nullif(btrim(p_tipo_operacion), ''), 'manual'),
    coalesce(p_descripcion, ''),
    coalesce(p_referencia, ''),
    p_estado,
    auth.uid(),
    case when p_estado = 'posted' then auth.uid() end,
    case when p_estado = 'posted' then now() end
  )
  returning id into v_asiento_id;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_indice := v_indice + 1;

    v_cuenta_id := nullif(btrim(coalesce(v_linea ->> 'cuenta_id', '')), '')::uuid;

    if v_cuenta_id is null then
      raise exception 'La línea % no tiene cuenta contable', v_indice
        using errcode = '22023';
    end if;

    perform public._validar_cuenta_movimiento(p_empresa_id, v_cuenta_id);

    v_debito := round(coalesce(nullif(v_linea ->> 'debito', '')::numeric, 0), 2);
    v_credito := round(coalesce(nullif(v_linea ->> 'credito', '')::numeric, 0), 2);

    if v_debito < 0 or v_credito < 0 then
      raise exception 'La línea % no admite montos negativos', v_indice
        using errcode = '23514';
    end if;

    if not (
      (v_debito > 0 and v_credito = 0)
      or (v_credito > 0 and v_debito = 0)
    ) then
      raise exception 'La línea % debe registrar débito o crédito (no ambos ni ninguno)',
        v_indice
        using errcode = '23514';
    end if;

    insert into public.asiento_lineas (
      asiento_id, empresa_id, linea, cuenta_id, descripcion, debito, credito
    )
    values (
      v_asiento_id,
      p_empresa_id,
      v_indice,
      v_cuenta_id,
      coalesce(v_linea ->> 'descripcion', ''),
      v_debito,
      v_credito
    );

    v_debitos := v_debitos + v_debito;
    v_creditos := v_creditos + v_credito;
  end loop;

  if p_estado = 'posted' and v_debitos <> v_creditos then
    raise exception 'El asiento está descuadrado (débitos % vs créditos %)',
      v_debitos, v_creditos
      using errcode = '23514';
  end if;

  return v_asiento_id;
end;
$$;

create or replace function public._revertir_asiento_interno(
  p_empresa_id uuid,
  p_asiento_id uuid,
  p_fecha_reverso date,
  p_motivo text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.asientos%rowtype;
  v_reverso_id uuid;
  v_numero text;
  v_linea record;
  v_indice integer := 0;
  v_descripcion text;
begin
  if p_empresa_id is null or p_asiento_id is null or p_fecha_reverso is null then
    raise exception 'La empresa, el asiento y la fecha de reverso son obligatorios'
      using errcode = '22023';
  end if;

  select *
    into v_original
  from public.asientos a
  where a.id = p_asiento_id
  for update;

  if not found then
    raise exception 'El asiento % no existe', p_asiento_id using errcode = '22023';
  end if;

  if v_original.empresa_id <> p_empresa_id then
    raise exception 'El asiento % no pertenece a la empresa %', p_asiento_id, p_empresa_id
      using errcode = '42501';
  end if;

  if v_original.estado <> 'posted' then
    raise exception 'Solo se revierten asientos contabilizados (estado actual: %)',
      v_original.estado
      using errcode = '23514';
  end if;

  if v_original.revertido_por is not null then
    raise exception 'El asiento % ya fue revertido', v_original.numero
      using errcode = '23514';
  end if;

  perform public._validar_periodo_abierto(p_empresa_id, p_fecha_reverso);

  v_numero := public._siguiente_numero_asiento(p_empresa_id, p_fecha_reverso);

  v_descripcion := format('Reverso del asiento %s', v_original.numero);
  if coalesce(btrim(p_motivo), '') <> '' then
    v_descripcion := v_descripcion || ': ' || btrim(p_motivo);
  end if;

  insert into public.asientos (
    empresa_id, numero, fecha, tipo_operacion, descripcion, referencia,
    estado, reverso_de, creado_por, contabilizado_por, contabilizado_en
  )
  values (
    p_empresa_id,
    v_numero,
    p_fecha_reverso,
    'reversal',
    v_descripcion,
    coalesce(nullif(v_original.referencia, ''), v_original.numero),
    'reversal',
    v_original.id,
    auth.uid(),
    auth.uid(),
    now()
  )
  returning id into v_reverso_id;

  for v_linea in
    select l.*
    from public.asiento_lineas l
    where l.asiento_id = v_original.id
    order by l.linea
  loop
    v_indice := v_indice + 1;

    insert into public.asiento_lineas (
      asiento_id, empresa_id, linea, cuenta_id, descripcion, debito, credito
    )
    values (
      v_reverso_id,
      p_empresa_id,
      v_indice,
      v_linea.cuenta_id,
      v_linea.descripcion,
      v_linea.credito,
      v_linea.debito
    );
  end loop;

  if v_indice < 2 then
    raise exception 'El asiento % no tiene líneas suficientes para revertirse',
      v_original.numero
      using errcode = '23514';
  end if;

  update public.asientos
  set estado = 'reversed',
      revertido_por = v_reverso_id
  where id = v_original.id;

  return v_reverso_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: solo lectura filtrada por empresa; escritura solo por RPC
-- ---------------------------------------------------------------------------

alter table public.periodos_contables enable row level security;
alter table public.cuentas enable row level security;
alter table public.secuencias_asientos enable row level security;
alter table public.asientos enable row level security;
alter table public.asiento_lineas enable row level security;
alter table public.terceros enable row level security;

revoke all on table public.periodos_contables from anon, authenticated;
revoke all on table public.cuentas from anon, authenticated;
revoke all on table public.secuencias_asientos from anon, authenticated;
revoke all on table public.asientos from anon, authenticated;
revoke all on table public.asiento_lineas from anon, authenticated;
revoke all on table public.terceros from anon, authenticated;

grant select on table public.periodos_contables to authenticated;
grant select on table public.cuentas to authenticated;
grant select on table public.secuencias_asientos to authenticated;
grant select on table public.asientos to authenticated;
grant select on table public.asiento_lineas to authenticated;
grant select on table public.terceros to authenticated;

create policy periodos_contables_select on public.periodos_contables
for select to authenticated
using (public.rol_en_empresa(empresa_id) is not null);

create policy cuentas_select on public.cuentas
for select to authenticated
using (public.rol_en_empresa(empresa_id) is not null);

create policy secuencias_asientos_select on public.secuencias_asientos
for select to authenticated
using (public.rol_en_empresa(empresa_id) is not null);

create policy asientos_select on public.asientos
for select to authenticated
using (public.rol_en_empresa(empresa_id) is not null);

create policy asiento_lineas_select on public.asiento_lineas
for select to authenticated
using (public.rol_en_empresa(empresa_id) is not null);

create policy terceros_select on public.terceros
for select to authenticated
using (public.rol_en_empresa(empresa_id) is not null);

-- ---------------------------------------------------------------------------
-- RPCs públicos
-- ---------------------------------------------------------------------------

create or replace function public.crear_periodo_contable(
  p_empresa_id uuid,
  p_nombre text,
  p_fecha_inicio date,
  p_fecha_fin date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_periodo_id uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador']
  );

  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'El nombre del periodo es obligatorio' using errcode = '22023';
  end if;

  if p_fecha_inicio is null or p_fecha_fin is null then
    raise exception 'Las fechas del periodo son obligatorias' using errcode = '22023';
  end if;

  if p_fecha_fin < p_fecha_inicio then
    raise exception 'La fecha final del periodo no puede ser anterior a la inicial'
      using errcode = '22023';
  end if;

  insert into public.periodos_contables (empresa_id, nombre, fecha_inicio, fecha_fin)
  values (p_empresa_id, btrim(p_nombre), p_fecha_inicio, p_fecha_fin)
  returning id into v_periodo_id;

  perform public.registrar_auditoria(
    p_empresa_id,
    'crear',
    'periodos_contables',
    v_periodo_id::text,
    jsonb_build_object('nombre', btrim(p_nombre), 'fecha_inicio', p_fecha_inicio, 'fecha_fin', p_fecha_fin)
  );

  return v_periodo_id;
end;
$$;

create or replace function public.cerrar_periodo_contable(
  p_empresa_id uuid,
  p_periodo_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador']
  );

  update public.periodos_contables
  set estado = 'closed',
      cerrado_en = coalesce(cerrado_en, now())
  where id = p_periodo_id
    and empresa_id = p_empresa_id;

  if not found then
    raise exception 'El periodo % no existe en la empresa %', p_periodo_id, p_empresa_id
      using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    'cerrar',
    'periodos_contables',
    p_periodo_id::text
  );
end;
$$;

create or replace function public.reabrir_periodo_contable(
  p_empresa_id uuid,
  p_periodo_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador']
  );

  update public.periodos_contables
  set estado = 'open',
      cerrado_en = null
  where id = p_periodo_id
    and empresa_id = p_empresa_id;

  if not found then
    raise exception 'El periodo % no existe en la empresa %', p_periodo_id, p_empresa_id
      using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    'reabrir',
    'periodos_contables',
    p_periodo_id::text
  );
end;
$$;

create or replace function public.crear_cuenta(
  p_empresa_id uuid,
  p_codigo text,
  p_nombre text,
  p_clasificacion text,
  p_naturaleza text,
  p_padre_id uuid default null,
  p_es_agrupacion boolean default false,
  p_es_equivalente_efectivo boolean default false,
  p_categoria_flujo_efectivo text default 'operating'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta_id uuid;
  v_nivel integer := 1;
  v_padre_nivel integer;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador']
  );

  if coalesce(btrim(p_codigo), '') = '' then
    raise exception 'El código de la cuenta es obligatorio' using errcode = '22023';
  end if;

  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'El nombre de la cuenta es obligatorio' using errcode = '22023';
  end if;

  if p_clasificacion is null
    or p_clasificacion not in ('asset', 'liability', 'equity', 'income', 'cost', 'expense') then
    raise exception 'Clasificación de cuenta inválida: %', p_clasificacion
      using errcode = '22023';
  end if;

  if p_naturaleza is null or p_naturaleza not in ('debit', 'credit') then
    raise exception 'Naturaleza de cuenta inválida: %', p_naturaleza
      using errcode = '22023';
  end if;

  if p_categoria_flujo_efectivo is not null
    and p_categoria_flujo_efectivo not in ('operating', 'investing', 'financing', 'other') then
    raise exception 'Categoría de flujo de efectivo inválida: %', p_categoria_flujo_efectivo
      using errcode = '22023';
  end if;

  if p_padre_id is not null then
    select c.nivel
      into v_padre_nivel
    from public.cuentas c
    where c.id = p_padre_id
      and c.empresa_id = p_empresa_id;

    if not found then
      raise exception 'La cuenta padre % no existe en la empresa %', p_padre_id, p_empresa_id
        using errcode = '22023';
    end if;

    v_nivel := v_padre_nivel + 1;
  end if;

  insert into public.cuentas (
    empresa_id, codigo, nombre, padre_id, clasificacion, naturaleza, nivel,
    es_agrupacion, es_equivalente_efectivo, categoria_flujo_efectivo
  )
  values (
    p_empresa_id,
    btrim(p_codigo),
    btrim(p_nombre),
    p_padre_id,
    p_clasificacion,
    p_naturaleza,
    v_nivel,
    coalesce(p_es_agrupacion, false),
    coalesce(p_es_equivalente_efectivo, false),
    coalesce(p_categoria_flujo_efectivo, 'operating')
  )
  returning id into v_cuenta_id;

  perform public.registrar_auditoria(
    p_empresa_id,
    'crear',
    'cuentas',
    v_cuenta_id::text,
    jsonb_build_object('codigo', btrim(p_codigo), 'nombre', btrim(p_nombre))
  );

  return v_cuenta_id;
end;
$$;

create or replace function public.actualizar_cuenta(
  p_empresa_id uuid,
  p_cuenta_id uuid,
  p_nombre text,
  p_activa boolean,
  p_es_agrupacion boolean default null,
  p_es_equivalente_efectivo boolean default null,
  p_categoria_flujo_efectivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador']
  );

  if p_nombre is not null and btrim(p_nombre) = '' then
    raise exception 'El nombre de la cuenta no puede quedar vacío' using errcode = '22023';
  end if;

  if p_categoria_flujo_efectivo is not null
    and p_categoria_flujo_efectivo not in ('operating', 'investing', 'financing', 'other') then
    raise exception 'Categoría de flujo de efectivo inválida: %', p_categoria_flujo_efectivo
      using errcode = '22023';
  end if;

  update public.cuentas
  set nombre = coalesce(btrim(p_nombre), nombre),
      activa = coalesce(p_activa, activa),
      es_agrupacion = coalesce(p_es_agrupacion, es_agrupacion),
      es_equivalente_efectivo = coalesce(p_es_equivalente_efectivo, es_equivalente_efectivo),
      categoria_flujo_efectivo = coalesce(p_categoria_flujo_efectivo, categoria_flujo_efectivo)
  where id = p_cuenta_id
    and empresa_id = p_empresa_id;

  if not found then
    raise exception 'La cuenta % no existe en la empresa %', p_cuenta_id, p_empresa_id
      using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    'actualizar',
    'cuentas',
    p_cuenta_id::text,
    jsonb_build_object('activa', p_activa)
  );
end;
$$;

create or replace function public.importar_catalogo_cuentas(
  p_empresa_id uuid,
  p_cuentas jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_codigo text;
  v_padre_codigo text;
  v_padre_id uuid;
  v_cuenta_id uuid;
  v_clasificacion text;
  v_naturaleza text;
  v_insertados integer := 0;
  v_afectadas integer;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador']
  );

  if p_cuentas is null or jsonb_typeof(p_cuentas) <> 'array' then
    raise exception 'El catálogo de cuentas debe ser un arreglo JSON' using errcode = '22023';
  end if;

  -- Primera pasada: alta idempotente por (empresa_id, codigo).
  for v_item in select value from jsonb_array_elements(p_cuentas) loop
    v_codigo := btrim(coalesce(v_item ->> 'code', ''));

    if v_codigo = '' then
      raise exception 'Toda cuenta del catálogo debe incluir un código' using errcode = '22023';
    end if;

    v_clasificacion := coalesce(nullif(btrim(v_item ->> 'classification'), ''), 'asset');
    v_naturaleza := coalesce(nullif(btrim(v_item ->> 'normal_balance'), ''), 'debit');

    if v_clasificacion not in ('asset', 'liability', 'equity', 'income', 'cost', 'expense') then
      raise exception 'Clasificación inválida % en la cuenta %', v_clasificacion, v_codigo
        using errcode = '22023';
    end if;

    if v_naturaleza not in ('debit', 'credit') then
      raise exception 'Naturaleza inválida % en la cuenta %', v_naturaleza, v_codigo
        using errcode = '22023';
    end if;

    insert into public.cuentas (
      empresa_id, codigo, nombre, clasificacion, naturaleza, nivel, es_agrupacion
    )
    values (
      p_empresa_id,
      v_codigo,
      coalesce(nullif(btrim(v_item ->> 'name'), ''), v_codigo),
      v_clasificacion,
      v_naturaleza,
      1,
      coalesce((v_item ->> 'is_header')::boolean, false)
    )
    on conflict (empresa_id, codigo) do nothing;

    get diagnostics v_afectadas = row_count;
    v_insertados := v_insertados + v_afectadas;
  end loop;

  -- Segunda pasada: resuelve padre_id y nivel.
  for v_item in select value from jsonb_array_elements(p_cuentas) loop
    v_codigo := btrim(coalesce(v_item ->> 'code', ''));
    v_padre_codigo := btrim(coalesce(v_item ->> 'parent_code', ''));
    v_padre_id := null;

    if v_padre_codigo <> '' then
      select c.id
        into v_padre_id
      from public.cuentas c
      where c.empresa_id = p_empresa_id
        and c.codigo = v_padre_codigo;

      if v_padre_id is null then
        raise exception 'No existe la cuenta padre % para la cuenta %',
          v_padre_codigo, v_codigo
          using errcode = '22023';
      end if;
    end if;

    update public.cuentas
    set padre_id = v_padre_id
    where empresa_id = p_empresa_id
      and codigo = v_codigo
      and padre_id is distinct from v_padre_id;
  end loop;

  -- Recalcula el nivel de forma recursiva para toda la empresa.
  with recursive arbol as (
    select c.id, 1 as nivel
    from public.cuentas c
    where c.empresa_id = p_empresa_id
      and c.padre_id is null
    union all
    select h.id, a.nivel + 1
    from public.cuentas h
    join arbol a on h.padre_id = a.id
    where h.empresa_id = p_empresa_id
  )
  update public.cuentas c
  set nivel = arbol.nivel
  from arbol
  where c.id = arbol.id
    and c.nivel <> arbol.nivel;

  perform public.registrar_auditoria(
    p_empresa_id,
    'importar',
    'cuentas',
    '',
    jsonb_build_object('insertadas', v_insertados, 'recibidas', jsonb_array_length(p_cuentas))
  );

  return v_insertados;
end;
$$;

create or replace function public.crear_asiento_manual(
  p_empresa_id uuid,
  p_fecha date,
  p_descripcion text,
  p_referencia text default '',
  p_lineas jsonb default '[]'::jsonb,
  p_contabilizar boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento_id uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador', 'auxiliar']
  );

  v_asiento_id := public._contabilizar_asiento_interno(
    p_empresa_id,
    p_fecha,
    'manual',
    p_descripcion,
    p_referencia,
    p_lineas,
    case when coalesce(p_contabilizar, true) then 'posted' else 'draft' end
  );

  perform public.registrar_auditoria(
    p_empresa_id,
    case when coalesce(p_contabilizar, true) then 'contabilizar' else 'crear_borrador' end,
    'asientos',
    v_asiento_id::text
  );

  return v_asiento_id;
end;
$$;

create or replace function public.contabilizar_asiento_borrador(
  p_empresa_id uuid,
  p_asiento_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento public.asientos%rowtype;
  v_lineas integer;
  v_debitos numeric(14,2);
  v_creditos numeric(14,2);
  v_linea record;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador', 'auxiliar']
  );

  select *
    into v_asiento
  from public.asientos a
  where a.id = p_asiento_id
    and a.empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception 'El asiento % no existe en la empresa %', p_asiento_id, p_empresa_id
      using errcode = '22023';
  end if;

  if v_asiento.estado <> 'draft' then
    raise exception 'El asiento % no está en borrador (estado: %)',
      v_asiento.numero, v_asiento.estado
      using errcode = '23514';
  end if;

  perform public._validar_periodo_abierto(p_empresa_id, v_asiento.fecha);

  select count(*), coalesce(sum(l.debito), 0), coalesce(sum(l.credito), 0)
    into v_lineas, v_debitos, v_creditos
  from public.asiento_lineas l
  where l.asiento_id = p_asiento_id;

  if v_lineas < 2 then
    raise exception 'El asiento % requiere al menos 2 líneas para contabilizarse',
      v_asiento.numero
      using errcode = '23514';
  end if;

  if v_debitos <> v_creditos then
    raise exception 'El asiento % está descuadrado (débitos % vs créditos %)',
      v_asiento.numero, v_debitos, v_creditos
      using errcode = '23514';
  end if;

  for v_linea in
    select l.cuenta_id
    from public.asiento_lineas l
    where l.asiento_id = p_asiento_id
  loop
    perform public._validar_cuenta_movimiento(p_empresa_id, v_linea.cuenta_id);
  end loop;

  update public.asientos
  set estado = 'posted',
      contabilizado_por = auth.uid(),
      contabilizado_en = now()
  where id = p_asiento_id;

  perform public.registrar_auditoria(
    p_empresa_id,
    'contabilizar',
    'asientos',
    p_asiento_id::text
  );
end;
$$;

create or replace function public.revertir_asiento(
  p_empresa_id uuid,
  p_asiento_id uuid,
  p_fecha_reverso date default current_date,
  p_motivo text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reverso_id uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador', 'auxiliar']
  );

  v_reverso_id := public._revertir_asiento_interno(
    p_empresa_id,
    p_asiento_id,
    coalesce(p_fecha_reverso, current_date),
    p_motivo
  );

  perform public.registrar_auditoria(
    p_empresa_id,
    'revertir',
    'asientos',
    p_asiento_id::text,
    jsonb_build_object('asiento_reverso', v_reverso_id, 'motivo', p_motivo)
  );

  return v_reverso_id;
end;
$$;

create or replace function public.guardar_tercero(
  p_empresa_id uuid,
  p_id uuid default null,
  p_tipo text default 'both',
  p_nombre text default '',
  p_rnc text default '',
  p_correo text default '',
  p_telefono text default '',
  p_direccion text default '',
  p_cuenta_por_pagar_id uuid default null,
  p_cuenta_por_cobrar_id uuid default null,
  p_activo boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tercero_id uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador', 'auxiliar']
  );

  if p_tipo is null or p_tipo not in ('customer', 'supplier', 'both') then
    raise exception 'Tipo de tercero inválido: %', p_tipo using errcode = '22023';
  end if;

  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'El nombre del tercero es obligatorio' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.terceros (
      empresa_id, tipo, nombre, rnc, correo, telefono, direccion,
      cuenta_por_pagar_id, cuenta_por_cobrar_id, activo
    )
    values (
      p_empresa_id,
      p_tipo,
      btrim(p_nombre),
      coalesce(p_rnc, ''),
      coalesce(p_correo, ''),
      coalesce(p_telefono, ''),
      coalesce(p_direccion, ''),
      p_cuenta_por_pagar_id,
      p_cuenta_por_cobrar_id,
      coalesce(p_activo, true)
    )
    returning id into v_tercero_id;
  else
    update public.terceros
    set tipo = p_tipo,
        nombre = btrim(p_nombre),
        rnc = coalesce(p_rnc, ''),
        correo = coalesce(p_correo, ''),
        telefono = coalesce(p_telefono, ''),
        direccion = coalesce(p_direccion, ''),
        cuenta_por_pagar_id = p_cuenta_por_pagar_id,
        cuenta_por_cobrar_id = p_cuenta_por_cobrar_id,
        activo = coalesce(p_activo, true)
    where id = p_id
      and empresa_id = p_empresa_id
    returning id into v_tercero_id;

    if v_tercero_id is null then
      raise exception 'El tercero % no existe en la empresa %', p_id, p_empresa_id
        using errcode = '22023';
    end if;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    case when p_id is null then 'crear' else 'actualizar' end,
    'terceros',
    v_tercero_id::text,
    jsonb_build_object('nombre', btrim(p_nombre), 'rnc_normalizado', public.normalizar_rnc(p_rnc))
  );

  return v_tercero_id;
end;
$$;

create or replace function public.toggle_tercero_activo(
  p_empresa_id uuid,
  p_tercero_id uuid,
  p_activo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_rol_empresa(
    p_empresa_id,
    array['admin_global', 'admin_empresa', 'contador', 'auxiliar']
  );

  update public.terceros
  set activo = coalesce(p_activo, true)
  where id = p_tercero_id
    and empresa_id = p_empresa_id;

  if not found then
    raise exception 'El tercero % no existe en la empresa %', p_tercero_id, p_empresa_id
      using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    'toggle_activo',
    'terceros',
    p_tercero_id::text,
    jsonb_build_object('activo', p_activo)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.terceros_normalizar_rnc() from public, anon, authenticated;
revoke all on function public._validar_asiento_cuadre() from public, anon, authenticated;
revoke all on function public.asientos_proteger() from public, anon, authenticated;
revoke all on function public.asiento_lineas_proteger() from public, anon, authenticated;
revoke all on function public._siguiente_numero_asiento(uuid, date)
  from public, anon, authenticated;
revoke all on function public._validar_periodo_abierto(uuid, date)
  from public, anon, authenticated;
revoke all on function public._validar_cuenta_movimiento(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._contabilizar_asiento_interno(uuid, date, text, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public._revertir_asiento_interno(uuid, uuid, date, text)
  from public, anon, authenticated;

revoke all on function public.crear_periodo_contable(uuid, text, date, date)
  from public, anon, authenticated;
revoke all on function public.cerrar_periodo_contable(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.reabrir_periodo_contable(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.crear_cuenta(uuid, text, text, text, text, uuid, boolean, boolean, text)
  from public, anon, authenticated;
revoke all on function public.actualizar_cuenta(uuid, uuid, text, boolean, boolean, boolean, text)
  from public, anon, authenticated;
revoke all on function public.importar_catalogo_cuentas(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.crear_asiento_manual(uuid, date, text, text, jsonb, boolean)
  from public, anon, authenticated;
revoke all on function public.contabilizar_asiento_borrador(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.revertir_asiento(uuid, uuid, date, text)
  from public, anon, authenticated;
revoke all on function public.guardar_tercero(uuid, uuid, text, text, text, text, text, text, uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.toggle_tercero_activo(uuid, uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.crear_periodo_contable(uuid, text, date, date)
  to authenticated;
grant execute on function public.cerrar_periodo_contable(uuid, uuid)
  to authenticated;
grant execute on function public.reabrir_periodo_contable(uuid, uuid)
  to authenticated;
grant execute on function public.crear_cuenta(uuid, text, text, text, text, uuid, boolean, boolean, text)
  to authenticated;
grant execute on function public.actualizar_cuenta(uuid, uuid, text, boolean, boolean, boolean, text)
  to authenticated;
grant execute on function public.importar_catalogo_cuentas(uuid, jsonb)
  to authenticated;
grant execute on function public.crear_asiento_manual(uuid, date, text, text, jsonb, boolean)
  to authenticated;
grant execute on function public.contabilizar_asiento_borrador(uuid, uuid)
  to authenticated;
grant execute on function public.revertir_asiento(uuid, uuid, date, text)
  to authenticated;
grant execute on function public.guardar_tercero(uuid, uuid, text, text, text, text, text, text, uuid, uuid, boolean)
  to authenticated;
grant execute on function public.toggle_tercero_activo(uuid, uuid, boolean)
  to authenticated;
