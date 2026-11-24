-- ---------------------------------------------------------------------------
-- Nexo Contable · Ola 1 · Documentos fiscales, NCF, métodos de pago y pagos
--
-- Crea el dominio fiscal y de documentos financieros de Fase 1:
--   · metodos_pago / configuracion_fiscal / reglas_fiscales
--   · secuencias_ncf (series B01-B17 y electrónicas E31-E47)
--   · obligaciones_fiscales (606, 607, IT-1, IR-17, IR-3)
--   · documentos_financieros + documento_pagos
--
-- Reglas multi-empresa:
--   · empresa_id NOT NULL en todas las tablas y UNIQUE compuestas por empresa.
--   · RLS SELECT; escrituras solo por RPC SECURITY DEFINER con search_path = ''.
--   · Dinero NUMERIC(14,2); partida doble delegada a _contabilizar_asiento_interno.
--
-- Depende de las migraciones núcleo 20261124220000 y 20261124220100
-- (perfiles, empresas, cuentas, asientos, terceros y helpers contables).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------

create table public.metodos_pago (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  cuenta_id uuid not null references public.cuentas(id),
  deja_cxp_proveedor boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint metodos_pago_nombre_check check (btrim(nombre) <> ''),
  constraint metodos_pago_empresa_nombre_key unique (empresa_id, nombre)
);

create index metodos_pago_empresa_idx on public.metodos_pago (empresa_id);

create table public.configuracion_fiscal (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  tasa_itbis_bps integer not null default 1800
    check (tasa_itbis_bps >= 0 and tasa_itbis_bps <= 10000),
  retencion_isr_servicios_bps integer not null default 1000
    check (retencion_isr_servicios_bps >= 0 and retencion_isr_servicios_bps <= 10000),
  retencion_itbis_servicios_bps integer not null default 3000
    check (retencion_itbis_servicios_bps >= 0 and retencion_itbis_servicios_bps <= 10000),
  cuenta_itbis_adelantado_id uuid references public.cuentas(id),
  cuenta_itbis_por_pagar_id uuid references public.cuentas(id),
  cuenta_retencion_isr_id uuid references public.cuentas(id),
  cuenta_retencion_itbis_id uuid references public.cuentas(id),
  cuenta_cxc_default_id uuid references public.cuentas(id),
  cuenta_cxp_default_id uuid references public.cuentas(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.secuencias_ncf (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo_comprobante text not null,
  serie text not null,
  prefijo text not null,
  numero_inicial bigint not null,
  numero_final bigint not null,
  numero_actual bigint not null default 0,
  fecha_vencimiento date,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint secuencias_ncf_tipo_check
    check (tipo_comprobante ~ '^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$'),
  constraint secuencias_ncf_serie_check check (serie in ('B', 'E')),
  constraint secuencias_ncf_serie_tipo_check check (left(tipo_comprobante, 1) = serie),
  constraint secuencias_ncf_prefijo_check
    check (left(prefijo, 3) = tipo_comprobante and prefijo ~ '^[A-Z0-9]{3,6}$'),
  constraint secuencias_ncf_rango_check
    check (numero_inicial >= 1 and numero_final >= numero_inicial),
  constraint secuencias_ncf_actual_check
    check (numero_actual >= 0 and numero_actual <= numero_final),
  constraint secuencias_ncf_empresa_unica unique (empresa_id, tipo_comprobante, prefijo, numero_inicial)
);

create index secuencias_ncf_empresa_tipo_idx
  on public.secuencias_ncf (empresa_id, tipo_comprobante) where activo;

create table public.reglas_fiscales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  tipo text not null,
  tasa_bps integer not null,
  cuenta_id uuid references public.cuentas(id),
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint reglas_fiscales_tipo_check
    check (tipo in ('itbis', 'isr', 'retencion_itbis', 'retencion_isr', 'otro')),
  constraint reglas_fiscales_tasa_check check (tasa_bps >= 0 and tasa_bps <= 10000),
  constraint reglas_fiscales_codigo_check check (btrim(codigo) <> ''),
  constraint reglas_fiscales_empresa_codigo_key unique (empresa_id, codigo)
);

create index reglas_fiscales_empresa_idx on public.reglas_fiscales (empresa_id);

create table public.obligaciones_fiscales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo_formulario text not null,
  periodo text not null,
  fecha_limite date not null,
  estado text not null default 'pending'
    check (estado in ('pending', 'filed', 'paid', 'overdue')),
  monto_declarado numeric(14, 2) not null default 0 check (monto_declarado >= 0),
  referencia_presentacion text not null default '',
  presentado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint obligaciones_fiscales_codigo_check check (btrim(codigo_formulario) <> ''),
  constraint obligaciones_fiscales_periodo_check
    check (periodo ~ '^[0-9]{6}$' and right(periodo, 2)::integer between 1 and 12),
  constraint obligaciones_fiscales_empresa_key
    unique (empresa_id, codigo_formulario, periodo)
);

create index obligaciones_fiscales_empresa_periodo_idx
  on public.obligaciones_fiscales (empresa_id, periodo);

create table public.documentos_financieros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null,
  numero text not null,
  ncf text not null default '',
  tipo_ncf text not null default '',
  tercero_id uuid not null references public.terceros(id),
  fecha_emision date not null,
  fecha_vencimiento date,
  concepto text not null,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  impuesto numeric(14, 2) not null default 0 check (impuesto >= 0),
  retenciones numeric(14, 2) not null default 0 check (retenciones >= 0),
  otros_impuestos numeric(14, 2) not null default 0 check (otros_impuestos >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  detalles_fiscales jsonb not null default '{}'::jsonb,
  cuenta_id uuid not null references public.cuentas(id),
  cuenta_control_id uuid not null references public.cuentas(id),
  cuenta_impuesto_id uuid references public.cuentas(id),
  cuenta_retencion_id uuid references public.cuentas(id),
  documento_acreditado_id uuid references public.documentos_financieros(id),
  estado text not null default 'posted' check (estado in ('draft', 'posted', 'void')),
  asiento_id uuid references public.asientos(id),
  creado_por uuid references public.perfiles(user_id),
  anulado_en timestamptz,
  motivo_anulacion text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint documentos_financieros_tipo_check
    check (tipo in ('sales_invoice', 'purchase_invoice', 'sales_credit', 'purchase_credit')),
  constraint documentos_financieros_numero_check check (btrim(numero) <> ''),
  constraint documentos_financieros_concepto_check check (btrim(concepto) <> ''),
  constraint documentos_financieros_tipo_ncf_check
    check (tipo_ncf = '' or tipo_ncf ~ '^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$'),
  constraint documentos_financieros_ncf_check
    check (
      ncf = ''
      or ncf ~ '^(B(0[1-9]|1[0-7])[0-9]{8}|E(3[1-9]|4[0-7])[0-9]{10})$'
    ),
  constraint documentos_financieros_vencimiento_check
    check (fecha_vencimiento is null or fecha_vencimiento >= fecha_emision),
  constraint documentos_financieros_empresa_numero_key unique (empresa_id, numero)
);

create unique index idx_documentos_financieros_empresa_ncf
  on public.documentos_financieros (empresa_id, ncf)
  where ncf <> '' and estado <> 'void';

create index documentos_financieros_empresa_fecha_idx
  on public.documentos_financieros (empresa_id, fecha_emision);
create index documentos_financieros_empresa_tipo_idx
  on public.documentos_financieros (empresa_id, tipo);
create index documentos_financieros_tercero_idx
  on public.documentos_financieros (empresa_id, tercero_id);
create index documentos_financieros_acreditado_idx
  on public.documentos_financieros (documento_acreditado_id)
  where documento_acreditado_id is not null;

create table public.documento_pagos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  documento_id uuid not null references public.documentos_financieros(id),
  fecha_pago date not null,
  monto numeric(14, 2) not null check (monto > 0),
  metodo_pago text not null default '',
  cuenta_id uuid not null references public.cuentas(id),
  referencia text not null default '',
  asiento_id uuid references public.asientos(id),
  estado text not null default 'active' check (estado in ('active', 'cancelled')),
  cancelado_en timestamptz,
  motivo_cancelacion text not null default '',
  creado_por uuid references public.perfiles(user_id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index documento_pagos_empresa_documento_idx
  on public.documento_pagos (empresa_id, documento_id);
create index documento_pagos_empresa_estado_idx
  on public.documento_pagos (empresa_id, estado);

-- ---------------------------------------------------------------------------
-- 2. Triggers de actualizado_en e inmutabilidad
-- ---------------------------------------------------------------------------

create trigger metodos_pago_actualizado_en
  before update on public.metodos_pago
  for each row execute function public.actualizar_actualizado_en();
create trigger configuracion_fiscal_actualizado_en
  before update on public.configuracion_fiscal
  for each row execute function public.actualizar_actualizado_en();
create trigger secuencias_ncf_actualizado_en
  before update on public.secuencias_ncf
  for each row execute function public.actualizar_actualizado_en();
create trigger reglas_fiscales_actualizado_en
  before update on public.reglas_fiscales
  for each row execute function public.actualizar_actualizado_en();
create trigger obligaciones_fiscales_actualizado_en
  before update on public.obligaciones_fiscales
  for each row execute function public.actualizar_actualizado_en();
create trigger documentos_financieros_actualizado_en
  before update on public.documentos_financieros
  for each row execute function public.actualizar_actualizado_en();
create trigger documento_pagos_actualizado_en
  before update on public.documento_pagos
  for each row execute function public.actualizar_actualizado_en();

create or replace function public._bloquear_borrado_documento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado <> 'draft' then
    raise exception 'no se puede eliminar un documento contabilizado; use anular_documento'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger documentos_financieros_sin_borrado
  before delete on public.documentos_financieros
  for each row execute function public._bloquear_borrado_documento();

-- ---------------------------------------------------------------------------
-- 3. RLS y permisos de tablas
-- ---------------------------------------------------------------------------

alter table public.metodos_pago enable row level security;
alter table public.configuracion_fiscal enable row level security;
alter table public.secuencias_ncf enable row level security;
alter table public.reglas_fiscales enable row level security;
alter table public.obligaciones_fiscales enable row level security;
alter table public.documentos_financieros enable row level security;
alter table public.documento_pagos enable row level security;

revoke all on table public.metodos_pago from anon, authenticated;
revoke all on table public.configuracion_fiscal from anon, authenticated;
revoke all on table public.secuencias_ncf from anon, authenticated;
revoke all on table public.reglas_fiscales from anon, authenticated;
revoke all on table public.obligaciones_fiscales from anon, authenticated;
revoke all on table public.documentos_financieros from anon, authenticated;
revoke all on table public.documento_pagos from anon, authenticated;

revoke insert, update, delete, truncate on table public.metodos_pago from authenticated;
revoke insert, update, delete, truncate on table public.configuracion_fiscal from authenticated;
revoke insert, update, delete, truncate on table public.secuencias_ncf from authenticated;
revoke insert, update, delete, truncate on table public.reglas_fiscales from authenticated;
revoke insert, update, delete, truncate on table public.obligaciones_fiscales from authenticated;
revoke insert, update, delete, truncate on table public.documentos_financieros from authenticated;
revoke insert, update, delete, truncate on table public.documento_pagos from authenticated;

grant select on table public.metodos_pago to authenticated;
grant select on table public.configuracion_fiscal to authenticated;
grant select on table public.secuencias_ncf to authenticated;
grant select on table public.reglas_fiscales to authenticated;
grant select on table public.obligaciones_fiscales to authenticated;
grant select on table public.documentos_financieros to authenticated;
grant select on table public.documento_pagos to authenticated;

create policy metodos_pago_select on public.metodos_pago
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy configuracion_fiscal_select on public.configuracion_fiscal
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy secuencias_ncf_select on public.secuencias_ncf
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy reglas_fiscales_select on public.reglas_fiscales
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy obligaciones_fiscales_select on public.obligaciones_fiscales
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy documentos_financieros_select on public.documentos_financieros
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);
create policy documento_pagos_select on public.documento_pagos
  for select to authenticated
  using (public.rol_en_empresa(empresa_id) is not null);

-- ---------------------------------------------------------------------------
-- 4. RPCs de configuración fiscal
-- ---------------------------------------------------------------------------

create or replace function public.guardar_metodo_pago(
  p_empresa_id uuid,
  p_nombre text default null,
  p_cuenta_id uuid default null,
  p_deja_cxp_proveedor boolean default null,
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
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if p_cuenta_id is not null then
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_id);
  end if;

  if v_id is not null then
    update public.metodos_pago m
       set nombre = coalesce(v_nombre, m.nombre),
           cuenta_id = coalesce(p_cuenta_id, m.cuenta_id),
           deja_cxp_proveedor = coalesce(p_deja_cxp_proveedor, m.deja_cxp_proveedor),
           activo = coalesce(p_activo, m.activo)
     where m.id = v_id and m.empresa_id = p_empresa_id;

    if not found then
      raise exception 'método de pago no encontrado' using errcode = '22023';
    end if;
  else
    if v_nombre is null or p_cuenta_id is null then
      raise exception 'el nombre y la cuenta contable son obligatorios' using errcode = '22023';
    end if;

    insert into public.metodos_pago (empresa_id, nombre, cuenta_id, deja_cxp_proveedor, activo)
    values (
      p_empresa_id, v_nombre, p_cuenta_id,
      coalesce(p_deja_cxp_proveedor, false), coalesce(p_activo, true)
    )
    returning id into v_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'metodos_pago', v_id::text,
    jsonb_build_object('nombre', v_nombre)
  );

  return v_id;
end;
$$;

create or replace function public.guardar_configuracion_fiscal(
  p_empresa_id uuid,
  p_tasa_itbis_bps integer default null,
  p_retencion_isr_servicios_bps integer default null,
  p_retencion_itbis_servicios_bps integer default null,
  p_cuenta_itbis_adelantado_id uuid default null,
  p_cuenta_itbis_por_pagar_id uuid default null,
  p_cuenta_retencion_isr_id uuid default null,
  p_cuenta_retencion_itbis_id uuid default null,
  p_cuenta_cxc_default_id uuid default null,
  p_cuenta_cxp_default_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual public.configuracion_fiscal%rowtype;
  v_cuentas uuid[] := array[
    p_cuenta_itbis_adelantado_id,
    p_cuenta_itbis_por_pagar_id,
    p_cuenta_retencion_isr_id,
    p_cuenta_retencion_itbis_id,
    p_cuenta_cxc_default_id,
    p_cuenta_cxp_default_id
  ];
  v_cuenta uuid;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  foreach v_cuenta in array v_cuentas loop
    if v_cuenta is not null then
      perform public._validar_cuenta_movimiento(p_empresa_id, v_cuenta);
    end if;
  end loop;

  select * into v_actual
    from public.configuracion_fiscal c
   where c.empresa_id = p_empresa_id;

  insert into public.configuracion_fiscal (
    empresa_id, tasa_itbis_bps, retencion_isr_servicios_bps,
    retencion_itbis_servicios_bps, cuenta_itbis_adelantado_id,
    cuenta_itbis_por_pagar_id, cuenta_retencion_isr_id,
    cuenta_retencion_itbis_id, cuenta_cxc_default_id, cuenta_cxp_default_id
  )
  values (
    p_empresa_id,
    coalesce(p_tasa_itbis_bps, v_actual.tasa_itbis_bps, 1800),
    coalesce(p_retencion_isr_servicios_bps, v_actual.retencion_isr_servicios_bps, 1000),
    coalesce(p_retencion_itbis_servicios_bps, v_actual.retencion_itbis_servicios_bps, 3000),
    coalesce(p_cuenta_itbis_adelantado_id, v_actual.cuenta_itbis_adelantado_id),
    coalesce(p_cuenta_itbis_por_pagar_id, v_actual.cuenta_itbis_por_pagar_id),
    coalesce(p_cuenta_retencion_isr_id, v_actual.cuenta_retencion_isr_id),
    coalesce(p_cuenta_retencion_itbis_id, v_actual.cuenta_retencion_itbis_id),
    coalesce(p_cuenta_cxc_default_id, v_actual.cuenta_cxc_default_id),
    coalesce(p_cuenta_cxp_default_id, v_actual.cuenta_cxp_default_id)
  )
  on conflict (empresa_id) do update
     set tasa_itbis_bps = excluded.tasa_itbis_bps,
         retencion_isr_servicios_bps = excluded.retencion_isr_servicios_bps,
         retencion_itbis_servicios_bps = excluded.retencion_itbis_servicios_bps,
         cuenta_itbis_adelantado_id = excluded.cuenta_itbis_adelantado_id,
         cuenta_itbis_por_pagar_id = excluded.cuenta_itbis_por_pagar_id,
         cuenta_retencion_isr_id = excluded.cuenta_retencion_isr_id,
         cuenta_retencion_itbis_id = excluded.cuenta_retencion_itbis_id,
         cuenta_cxc_default_id = excluded.cuenta_cxc_default_id,
         cuenta_cxp_default_id = excluded.cuenta_cxp_default_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'configuracion_fiscal', p_empresa_id::text,
    jsonb_build_object('tasa_itbis_bps', coalesce(p_tasa_itbis_bps, v_actual.tasa_itbis_bps, 1800))
  );

  return p_empresa_id;
end;
$$;

create or replace function public.guardar_secuencia_ncf(
  p_empresa_id uuid,
  p_tipo_comprobante text default null,
  p_prefijo text default null,
  p_numero_inicial bigint default null,
  p_numero_final bigint default null,
  p_fecha_vencimiento date default null,
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
  v_tipo text := upper(nullif(btrim(coalesce(p_tipo_comprobante, '')), ''));
  v_prefijo text := upper(nullif(btrim(coalesce(p_prefijo, '')), ''));
  v_existente public.secuencias_ncf%rowtype;
  v_final bigint;
  v_limite bigint;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if v_id is not null then
    select * into v_existente
      from public.secuencias_ncf s
     where s.id = v_id and s.empresa_id = p_empresa_id
     for update;

    if not found then
      raise exception 'secuencia NCF no encontrada' using errcode = '22023';
    end if;

    if (v_tipo is not null and v_tipo <> v_existente.tipo_comprobante)
       or (v_prefijo is not null and v_prefijo <> v_existente.prefijo) then
      raise exception 'no se puede cambiar el tipo ni el prefijo de una secuencia NCF existente'
        using errcode = '22023';
    end if;

    v_final := coalesce(p_numero_final, v_existente.numero_final);

    if v_final < v_existente.numero_actual then
      raise exception 'el número final no puede ser menor al número actual (%)',
        v_existente.numero_actual using errcode = '22023';
    end if;

    if v_final > (case when v_existente.serie = 'B' then 99999999 else 9999999999 end) then
      raise exception 'el número final excede los dígitos permitidos para la serie %',
        v_existente.serie using errcode = '22023';
    end if;

    update public.secuencias_ncf s
       set numero_final = v_final,
           fecha_vencimiento = coalesce(p_fecha_vencimiento, s.fecha_vencimiento),
           activo = coalesce(p_activo, s.activo)
     where s.id = v_existente.id;

    perform public.registrar_auditoria(
      p_empresa_id, 'guardar', 'secuencias_ncf', v_existente.id::text,
      jsonb_build_object('tipo_comprobante', v_existente.tipo_comprobante,
                         'prefijo', v_existente.prefijo, 'numero_final', v_final)
    );

    return v_existente.id;
  end if;

  if v_tipo is null or v_prefijo is null or p_numero_inicial is null or p_numero_final is null then
    raise exception 'tipo, prefijo, número inicial y número final son obligatorios'
      using errcode = '22023';
  end if;

  if v_tipo !~ '^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$' then
    raise exception 'tipo de comprobante NCF inválido: %', v_tipo using errcode = '22023';
  end if;

  if left(v_prefijo, 3) <> v_tipo then
    raise exception 'el prefijo debe comenzar con el tipo de comprobante %', v_tipo
      using errcode = '22023';
  end if;

  if p_numero_final < p_numero_inicial then
    raise exception 'el número final debe ser mayor o igual al inicial' using errcode = '22023';
  end if;

  v_limite := case when left(v_tipo, 1) = 'B' then 99999999 else 9999999999 end;
  if p_numero_inicial < 1 or p_numero_final > v_limite then
    raise exception 'el rango de numeración excede los dígitos permitidos para la serie %',
      left(v_tipo, 1) using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.secuencias_ncf s
     where s.empresa_id = p_empresa_id
       and s.tipo_comprobante = v_tipo
       and s.prefijo = v_prefijo
       and s.numero_inicial <= p_numero_final
       and s.numero_final >= p_numero_inicial
  ) then
    raise exception 'el rango de numeración se solapa con otra secuencia existente'
      using errcode = '22023';
  end if;

  insert into public.secuencias_ncf (
    empresa_id, tipo_comprobante, serie, prefijo,
    numero_inicial, numero_final, numero_actual, fecha_vencimiento, activo
  )
  values (
    p_empresa_id, v_tipo, left(v_tipo, 1), v_prefijo,
    p_numero_inicial, p_numero_final, p_numero_inicial - 1,
    p_fecha_vencimiento, coalesce(p_activo, true)
  )
  returning id into v_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'secuencias_ncf', v_id::text,
    jsonb_build_object('tipo_comprobante', v_tipo, 'prefijo', v_prefijo,
                       'numero_inicial', p_numero_inicial, 'numero_final', p_numero_final)
  );

  return v_id;
end;
$$;

create or replace function public.consumir_siguiente_ncf(
  p_empresa_id uuid,
  p_tipo_comprobante text,
  p_fecha date default current_date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text := upper(btrim(coalesce(p_tipo_comprobante, '')));
  v_fecha date := coalesce(p_fecha, current_date);
  v_seq public.secuencias_ncf%rowtype;
  v_siguiente bigint;
  v_digitos integer;
  v_ncf text;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']);

  if v_tipo !~ '^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$' then
    raise exception 'tipo de comprobante NCF inválido: %', p_tipo_comprobante
      using errcode = '22023';
  end if;

  select * into v_seq
    from public.secuencias_ncf s
   where s.empresa_id = p_empresa_id
     and s.tipo_comprobante = v_tipo
     and s.activo
     and (s.fecha_vencimiento is null or s.fecha_vencimiento >= v_fecha)
     and s.numero_actual < s.numero_final
   order by s.fecha_vencimiento nulls last, s.creado_en, s.id
   limit 1
   for update;

  if not found then
    raise exception 'no hay una secuencia NCF activa disponible para el comprobante %', v_tipo
      using errcode = '22023';
  end if;

  v_siguiente := v_seq.numero_actual + 1;
  v_digitos := case when v_seq.serie = 'B' then 8 else 10 end;

  if length(v_siguiente::text) > v_digitos then
    raise exception 'la secuencia % excede los % dígitos de la serie %',
      v_seq.prefijo, v_digitos, v_seq.serie using errcode = '22023';
  end if;

  v_ncf := v_seq.prefijo || lpad(v_siguiente::text, v_digitos, '0');

  update public.secuencias_ncf s
     set numero_actual = v_siguiente,
         activo = (v_siguiente < s.numero_final)
   where s.id = v_seq.id;

  return v_ncf;
end;
$$;

create or replace function public.guardar_regla_fiscal(
  p_empresa_id uuid,
  p_codigo text default null,
  p_nombre text default null,
  p_tipo text default null,
  p_tasa_bps integer default null,
  p_cuenta_id uuid default null,
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
  v_codigo text := upper(nullif(btrim(coalesce(p_codigo, '')), ''));
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_tipo text := lower(nullif(btrim(coalesce(p_tipo, '')), ''));
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if p_cuenta_id is not null then
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_id);
  end if;

  if v_id is not null then
    update public.reglas_fiscales r
       set codigo = coalesce(v_codigo, r.codigo),
           nombre = coalesce(v_nombre, r.nombre),
           tipo = coalesce(v_tipo, r.tipo),
           tasa_bps = coalesce(p_tasa_bps, r.tasa_bps),
           cuenta_id = coalesce(p_cuenta_id, r.cuenta_id),
           activa = coalesce(p_activa, r.activa)
     where r.id = v_id and r.empresa_id = p_empresa_id;

    if not found then
      raise exception 'regla fiscal no encontrada' using errcode = '22023';
    end if;
  else
    if v_codigo is null or v_nombre is null or v_tipo is null or p_tasa_bps is null then
      raise exception 'código, nombre, tipo y tasa son obligatorios' using errcode = '22023';
    end if;

    insert into public.reglas_fiscales (
      empresa_id, codigo, nombre, tipo, tasa_bps, cuenta_id, activa
    )
    values (
      p_empresa_id, v_codigo, v_nombre, v_tipo, p_tasa_bps,
      p_cuenta_id, coalesce(p_activa, true)
    )
    returning id into v_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'reglas_fiscales', v_id::text,
    jsonb_build_object('codigo', v_codigo, 'tipo', v_tipo)
  );

  return v_id;
end;
$$;

create or replace function public.guardar_obligacion_fiscal(
  p_empresa_id uuid,
  p_codigo_formulario text default null,
  p_periodo text default null,
  p_fecha_limite date default null,
  p_estado text default null,
  p_monto_declarado numeric default null,
  p_referencia_presentacion text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_codigo text := upper(nullif(btrim(coalesce(p_codigo_formulario, '')), ''));
  v_periodo text := nullif(btrim(coalesce(p_periodo, '')), '');
  v_estado text := lower(nullif(btrim(coalesce(p_estado, '')), ''));
  v_actual public.obligaciones_fiscales%rowtype;
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if v_estado is not null and v_estado not in ('pending', 'filed', 'paid', 'overdue') then
    raise exception 'estado de obligación fiscal inválido: %', v_estado using errcode = '22023';
  end if;

  if v_periodo is not null
     and (v_periodo !~ '^[0-9]{6}$' or right(v_periodo, 2)::integer not between 1 and 12) then
    raise exception 'periodo de obligación fiscal inválido: % (use YYYYMM)', p_periodo
      using errcode = '22023';
  end if;

  if v_id is null and v_codigo is not null and v_periodo is not null then
    select o.id into v_id
      from public.obligaciones_fiscales o
     where o.empresa_id = p_empresa_id
       and o.codigo_formulario = v_codigo
       and o.periodo = v_periodo;
  end if;

  if v_id is not null then
    select * into v_actual
      from public.obligaciones_fiscales o
     where o.id = v_id and o.empresa_id = p_empresa_id
     for update;

    if not found then
      raise exception 'obligación fiscal no encontrada' using errcode = '22023';
    end if;

    v_estado := coalesce(v_estado, v_actual.estado);

    update public.obligaciones_fiscales o
       set codigo_formulario = coalesce(v_codigo, o.codigo_formulario),
           periodo = coalesce(v_periodo, o.periodo),
           fecha_limite = coalesce(p_fecha_limite, o.fecha_limite),
           estado = v_estado,
           monto_declarado = coalesce(round(p_monto_declarado, 2), o.monto_declarado),
           referencia_presentacion = coalesce(
             nullif(btrim(coalesce(p_referencia_presentacion, '')), ''),
             o.referencia_presentacion
           ),
           presentado_en = case
             when v_estado in ('filed', 'paid') then coalesce(o.presentado_en, now())
             else o.presentado_en
           end
     where o.id = v_id;
  else
    if v_codigo is null or v_periodo is null or p_fecha_limite is null then
      raise exception 'formulario, periodo y fecha límite son obligatorios' using errcode = '22023';
    end if;

    insert into public.obligaciones_fiscales (
      empresa_id, codigo_formulario, periodo, fecha_limite, estado,
      monto_declarado, referencia_presentacion, presentado_en
    )
    values (
      p_empresa_id, v_codigo, v_periodo, p_fecha_limite,
      coalesce(v_estado, 'pending'),
      round(coalesce(p_monto_declarado, 0), 2),
      coalesce(btrim(p_referencia_presentacion), ''),
      case when coalesce(v_estado, 'pending') in ('filed', 'paid') then now() else null end
    )
    returning id into v_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'guardar', 'obligaciones_fiscales', v_id::text,
    jsonb_build_object('codigo_formulario', v_codigo, 'periodo', v_periodo, 'estado', v_estado)
  );

  return v_id;
end;
$$;

create or replace function public.marcar_obligacion_presentada(
  p_empresa_id uuid,
  p_obligacion_id uuid,
  p_estado text default 'filed',
  p_monto_declarado numeric default null,
  p_referencia_presentacion text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text := lower(btrim(coalesce(p_estado, 'filed')));
begin
  perform public.exigir_rol_empresa(p_empresa_id, array['admin_empresa', 'contador']);

  if v_estado not in ('filed', 'paid', 'overdue') then
    raise exception 'estado de presentación inválido: %', v_estado using errcode = '22023';
  end if;

  update public.obligaciones_fiscales o
     set estado = v_estado,
         monto_declarado = coalesce(round(p_monto_declarado, 2), o.monto_declarado),
         referencia_presentacion = coalesce(
           nullif(btrim(coalesce(p_referencia_presentacion, '')), ''),
           o.referencia_presentacion
         ),
         presentado_en = case when v_estado in ('filed', 'paid') then now() else o.presentado_en end
   where o.id = p_obligacion_id and o.empresa_id = p_empresa_id;

  if not found then
    raise exception 'obligación fiscal no encontrada' using errcode = '22023';
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'presentar', 'obligaciones_fiscales', p_obligacion_id::text,
    jsonb_build_object('estado', v_estado, 'monto_declarado', p_monto_declarado)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Emisión y anulación de documentos financieros
-- ---------------------------------------------------------------------------

create or replace function public.emitir_documento_financiero(
  p_empresa_id uuid,
  p_tipo text,
  p_tercero_id uuid,
  p_fecha_emision date,
  p_concepto text,
  p_cuenta_id uuid,
  p_cuenta_control_id uuid,
  p_subtotal numeric,
  p_impuesto numeric default 0,
  p_retenciones numeric default 0,
  p_otros_impuestos numeric default 0,
  p_numero text default null,
  p_tipo_ncf text default '',
  p_ncf text default '',
  p_fecha_vencimiento date default null,
  p_cuenta_impuesto_id uuid default null,
  p_cuenta_retencion_id uuid default null,
  p_documento_acreditado_id uuid default null,
  p_detalles_fiscales jsonb default '{}'::jsonb,
  p_retencion_isr numeric default null,
  p_retencion_itbis numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text := lower(btrim(coalesce(p_tipo, '')));
  v_fecha date := coalesce(p_fecha_emision, current_date);
  v_concepto text := nullif(btrim(coalesce(p_concepto, '')), '');
  v_subtotal numeric(14, 2) := round(coalesce(p_subtotal, 0), 2);
  v_impuesto numeric(14, 2) := round(coalesce(p_impuesto, 0), 2);
  v_retenciones numeric(14, 2) := round(coalesce(p_retenciones, 0), 2);
  v_otros numeric(14, 2) := round(coalesce(p_otros_impuestos, 0), 2);
  v_total numeric(14, 2);
  v_ncf text := upper(nullif(btrim(coalesce(p_ncf, '')), ''));
  v_tipo_ncf text := upper(nullif(btrim(coalesce(p_tipo_ncf, '')), ''));
  v_detalles jsonb := coalesce(p_detalles_fiscales, '{}'::jsonb);
  v_doc_id uuid;
  v_numero text;
  v_prefijo_doc text;
  v_consecutivo integer;
  v_origen public.documentos_financieros%rowtype;
  v_saldo numeric(14, 2);
  v_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_tipo not in ('sales_invoice', 'purchase_invoice', 'sales_credit', 'purchase_credit') then
    raise exception 'tipo de documento financiero inválido: %', p_tipo using errcode = '22023';
  end if;

  if v_concepto is null then
    raise exception 'el concepto del documento es obligatorio' using errcode = '22023';
  end if;

  if v_subtotal < 0 or v_impuesto < 0 or v_retenciones < 0 or v_otros < 0 then
    raise exception 'los montos del documento no pueden ser negativos' using errcode = '22023';
  end if;

  v_total := round(v_subtotal + v_impuesto + v_otros - v_retenciones, 2);

  if v_total <= 0 then
    raise exception 'el total del documento debe ser mayor a cero' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.terceros t
    where t.id = p_tercero_id and t.empresa_id = p_empresa_id
  ) then
    raise exception 'tercero no encontrado en la empresa' using errcode = '22023';
  end if;

  if p_cuenta_id is null or p_cuenta_control_id is null then
    raise exception 'las cuentas principal y de control son obligatorias' using errcode = '22023';
  end if;

  perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_id);
  perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_control_id);

  if v_impuesto > 0 then
    if p_cuenta_impuesto_id is null then
      raise exception 'el documento con impuesto requiere cuenta de impuesto' using errcode = '22023';
    end if;
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_impuesto_id);
  elsif p_cuenta_impuesto_id is not null then
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_impuesto_id);
  end if;

  if v_retenciones > 0 then
    if p_cuenta_retencion_id is null then
      raise exception 'el documento con retenciones requiere cuenta de retención'
        using errcode = '22023';
    end if;
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_retencion_id);
  elsif p_cuenta_retencion_id is not null then
    perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_retencion_id);
  end if;

  if p_fecha_vencimiento is not null and p_fecha_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha de emisión'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_detalles) <> 'object' then
    raise exception 'los detalles fiscales deben ser un objeto JSON' using errcode = '22023';
  end if;

  -- Claves opcionales retencion_isr / retencion_itbis en detalles_fiscales (606/607).
  if round(coalesce(p_retencion_isr, 0), 2) < 0
     or round(coalesce(p_retencion_itbis, 0), 2) < 0
     or round(coalesce(p_retencion_isr, 0), 2) + round(coalesce(p_retencion_itbis, 0), 2)
        > v_retenciones then
    raise exception 'las retenciones detalladas no pueden exceder el total de retenciones'
      using errcode = '22023';
  end if;

  if p_retencion_isr is not null then
    v_detalles := v_detalles || jsonb_build_object('retencion_isr', round(p_retencion_isr, 2));
  end if;
  if p_retencion_itbis is not null then
    v_detalles := v_detalles || jsonb_build_object('retencion_itbis', round(p_retencion_itbis, 2));
  end if;

  -- Notas de crédito: validar documento acreditado y saldo pendiente.
  if v_tipo in ('sales_credit', 'purchase_credit') then
    if p_documento_acreditado_id is null then
      raise exception 'la nota de crédito requiere el documento acreditado'
        using errcode = '22023';
    end if;

    select * into v_origen
      from public.documentos_financieros d
     where d.id = p_documento_acreditado_id and d.empresa_id = p_empresa_id
     for update;

    if not found then
      raise exception 'documento acreditado no encontrado' using errcode = '22023';
    end if;

    if v_origen.estado <> 'posted' then
      raise exception 'el documento acreditado no está contabilizado' using errcode = '22023';
    end if;

    if (v_tipo = 'sales_credit' and v_origen.tipo <> 'sales_invoice')
       or (v_tipo = 'purchase_credit' and v_origen.tipo <> 'purchase_invoice') then
      raise exception 'el tipo de nota de crédito no corresponde al documento acreditado'
        using errcode = '22023';
    end if;

    select v_origen.total
           - coalesce((
               select sum(p.monto) from public.documento_pagos p
               where p.documento_id = v_origen.id and p.estado = 'active'
             ), 0)
           - coalesce((
               select sum(nc.total) from public.documentos_financieros nc
               where nc.documento_acreditado_id = v_origen.id and nc.estado = 'posted'
             ), 0)
      into v_saldo;

    if v_total > v_saldo then
      raise exception 'la nota de crédito (%) excede el saldo pendiente del documento (%)',
        v_total, v_saldo using errcode = '22023';
    end if;
  else
    if p_documento_acreditado_id is not null then
      raise exception 'solo las notas de crédito pueden acreditar otro documento'
        using errcode = '22023';
    end if;
  end if;

  -- NCF: ventas pueden consumir secuencia propia; compras registran NCF del proveedor.
  if v_tipo in ('sales_invoice', 'sales_credit') then
    if v_ncf is null and v_tipo_ncf is not null then
      v_ncf := public.consumir_siguiente_ncf(p_empresa_id, v_tipo_ncf, v_fecha);
    end if;
  else
    if v_tipo_ncf is not null and v_ncf is null then
      raise exception 'el NCF del proveedor es obligatorio si se indica el tipo de comprobante'
        using errcode = '22023';
    end if;
  end if;

  if v_ncf is not null then
    if v_tipo_ncf is null then
      v_tipo_ncf := left(v_ncf, 3);
    end if;

    if left(v_ncf, 3) <> v_tipo_ncf then
      raise exception 'el NCF % no corresponde al tipo de comprobante %', v_ncf, v_tipo_ncf
        using errcode = '22023';
    end if;

    if v_ncf !~ '^(B(0[1-9]|1[0-7])[0-9]{8}|E(3[1-9]|4[0-7])[0-9]{10})$' then
      raise exception 'el NCF % no tiene un formato válido de la DGII', v_ncf
        using errcode = '22023';
    end if;

    if v_tipo_ncf !~ '^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$' then
      raise exception 'el tipo de comprobante % no es válido', v_tipo_ncf using errcode = '22023';
    end if;
  end if;

  -- Número interno correlativo por empresa/tipo/año (protegido con candado de aviso).
  if p_numero is not null and btrim(p_numero) <> '' then
    v_numero := btrim(p_numero);

    if length(v_numero) > 40 then
      raise exception 'el número del documento no puede exceder 40 caracteres'
        using errcode = '22023';
    end if;
  else
    perform pg_advisory_xact_lock(
      hashtextextended('documentos_financieros:' || p_empresa_id::text, 0)
    );

    v_prefijo_doc := case v_tipo
      when 'sales_invoice' then 'FV'
      when 'purchase_invoice' then 'FC'
      when 'sales_credit' then 'NCV'
      else 'NCC'
    end;

    select coalesce(max((regexp_match(d.numero, '([0-9]+)$'))[1]::integer), 0) + 1
      into v_consecutivo
      from public.documentos_financieros d
     where d.empresa_id = p_empresa_id
       and d.tipo = v_tipo
       and d.numero like v_prefijo_doc || '-' || to_char(v_fecha, 'YYYY') || '-%';

    v_numero := v_prefijo_doc || '-' || to_char(v_fecha, 'YYYY') || '-'
      || lpad(v_consecutivo::text, 5, '0');
  end if;

  -- Asiento contable según docs/motor-contable.md §5 (misma transacción).
  if v_tipo = 'purchase_invoice' then
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', p_cuenta_id,
        'descripcion', v_concepto,
        'debito', v_subtotal + v_otros,
        'credito', 0
      )
    );

    if v_impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_impuesto_id,
        'descripcion', 'ITBIS adelantado ' || v_numero,
        'debito', v_impuesto,
        'credito', 0
      ));
    end if;

    if v_retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_retencion_id,
        'descripcion', 'Retenciones ' || v_numero,
        'debito', 0,
        'credito', v_retenciones
      ));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', p_cuenta_control_id,
      'descripcion', 'Cuentas por pagar ' || v_numero,
      'debito', 0,
      'credito', v_total
    ));
  elsif v_tipo = 'purchase_credit' then
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', p_cuenta_id,
        'descripcion', v_concepto,
        'debito', 0,
        'credito', v_subtotal + v_otros
      )
    );

    if v_impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_impuesto_id,
        'descripcion', 'ITBIS adelantado ' || v_numero,
        'debito', 0,
        'credito', v_impuesto
      ));
    end if;

    if v_retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_retencion_id,
        'descripcion', 'Retenciones ' || v_numero,
        'debito', v_retenciones,
        'credito', 0
      ));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', p_cuenta_control_id,
      'descripcion', 'Cuentas por pagar ' || v_numero,
      'debito', v_total,
      'credito', 0
    ));
  elsif v_tipo = 'sales_invoice' then
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', p_cuenta_control_id,
        'descripcion', 'Cuentas por cobrar ' || v_numero,
        'debito', v_total,
        'credito', 0
      )
    );

    if v_retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_retencion_id,
        'descripcion', 'Retenciones ' || v_numero,
        'debito', v_retenciones,
        'credito', 0
      ));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', p_cuenta_id,
      'descripcion', v_concepto,
      'debito', 0,
      'credito', v_subtotal + v_otros
    ));

    if v_impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_impuesto_id,
        'descripcion', 'ITBIS por pagar ' || v_numero,
        'debito', 0,
        'credito', v_impuesto
      ));
    end if;
  else
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', p_cuenta_control_id,
        'descripcion', 'Cuentas por cobrar ' || v_numero,
        'debito', 0,
        'credito', v_total
      )
    );

    if v_retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_retencion_id,
        'descripcion', 'Retenciones ' || v_numero,
        'debito', 0,
        'credito', v_retenciones
      ));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', p_cuenta_id,
      'descripcion', v_concepto,
      'debito', v_subtotal + v_otros,
      'credito', 0
    ));

    if v_impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', p_cuenta_impuesto_id,
        'descripcion', 'ITBIS por pagar ' || v_numero,
        'debito', v_impuesto,
        'credito', 0
      ));
    end if;
  end if;

  v_asiento_id := public._contabilizar_asiento_interno(
    p_empresa_id, v_fecha, v_tipo, v_concepto, v_numero, v_lineas, 'posted'
  );

  insert into public.documentos_financieros (
    empresa_id, tipo, numero, ncf, tipo_ncf, tercero_id, fecha_emision,
    fecha_vencimiento, concepto, subtotal, impuesto, retenciones,
    otros_impuestos, total, detalles_fiscales, cuenta_id, cuenta_control_id,
    cuenta_impuesto_id, cuenta_retencion_id, documento_acreditado_id,
    estado, asiento_id, creado_por
  )
  values (
    p_empresa_id, v_tipo, v_numero, coalesce(v_ncf, ''), coalesce(v_tipo_ncf, ''),
    p_tercero_id, v_fecha, p_fecha_vencimiento, v_concepto, v_subtotal,
    v_impuesto, v_retenciones, v_otros, v_total, v_detalles, p_cuenta_id,
    p_cuenta_control_id, p_cuenta_impuesto_id, p_cuenta_retencion_id,
    p_documento_acreditado_id, 'posted', v_asiento_id, auth.uid()
  )
  returning id into v_doc_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'emitir', 'documentos_financieros', v_doc_id::text,
    jsonb_build_object(
      'tipo', v_tipo, 'numero', v_numero, 'ncf', v_ncf, 'total', v_total,
      'asiento_id', v_asiento_id
    )
  );

  return v_doc_id;
end;
$$;

create or replace function public.anular_documento(
  p_empresa_id uuid,
  p_documento_id uuid,
  p_fecha_anulacion date default current_date,
  p_motivo text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_financieros%rowtype;
  v_fecha date := coalesce(p_fecha_anulacion, current_date);
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_reverso uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador']
  );

  select * into v_doc
    from public.documentos_financieros d
   where d.id = p_documento_id and d.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'documento financiero no encontrado' using errcode = '22023';
  end if;

  if v_doc.estado = 'void' then
    raise exception 'el documento ya está anulado' using errcode = '22023';
  end if;

  if v_doc.estado <> 'posted' or v_doc.asiento_id is null then
    raise exception 'solo se anulan documentos contabilizados' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.documento_pagos p
    where p.documento_id = v_doc.id and p.estado = 'active'
  ) then
    raise exception 'anule primero los pagos activos del documento' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.documentos_financieros nc
    where nc.documento_acreditado_id = v_doc.id and nc.estado = 'posted'
  ) then
    raise exception 'anule primero las notas de crédito aplicadas al documento'
      using errcode = '22023';
  end if;

  v_reverso := public._revertir_asiento_interno(
    p_empresa_id, v_doc.asiento_id, v_fecha,
    coalesce(nullif(v_motivo, ''), 'Anulación del documento ' || v_doc.numero)
  );

  update public.documentos_financieros d
     set estado = 'void',
         anulado_en = now(),
         motivo_anulacion = v_motivo
   where d.id = v_doc.id;

  perform public.registrar_auditoria(
    p_empresa_id, 'anular', 'documentos_financieros', v_doc.id::text,
    jsonb_build_object(
      'numero', v_doc.numero, 'motivo', v_motivo, 'reverso_asiento_id', v_reverso
    )
  );

  return v_reverso;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Pagos de documentos
-- ---------------------------------------------------------------------------

create or replace function public.registrar_pago_documento(
  p_empresa_id uuid,
  p_documento_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_metodo_pago text,
  p_cuenta_id uuid,
  p_referencia text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_financieros%rowtype;
  v_fecha date := coalesce(p_fecha_pago, current_date);
  v_monto numeric(14, 2) := round(coalesce(p_monto, 0), 2);
  v_saldo numeric(14, 2);
  v_pago_id uuid;
  v_lineas jsonb;
  v_asiento_id uuid;
  v_referencia text := btrim(coalesce(p_referencia, ''));
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador', 'auxiliar']
  );

  if v_monto <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  select * into v_doc
    from public.documentos_financieros d
   where d.id = p_documento_id and d.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'documento financiero no encontrado' using errcode = '22023';
  end if;

  if v_doc.estado <> 'posted' then
    raise exception 'solo se pagan documentos contabilizados' using errcode = '22023';
  end if;

  if v_doc.tipo not in ('sales_invoice', 'purchase_invoice') then
    raise exception 'solo se registran pagos sobre facturas' using errcode = '22023';
  end if;

  select v_doc.total
         - coalesce((
             select sum(p.monto) from public.documento_pagos p
             where p.documento_id = v_doc.id and p.estado = 'active'
           ), 0)
         - coalesce((
             select sum(nc.total) from public.documentos_financieros nc
             where nc.documento_acreditado_id = v_doc.id and nc.estado = 'posted'
           ), 0)
    into v_saldo;

  if v_saldo <= 0 then
    raise exception 'el documento no tiene saldo pendiente' using errcode = '22023';
  end if;

  if v_monto > v_saldo then
    raise exception 'el pago (%) excede el saldo pendiente (%)', v_monto, v_saldo
      using errcode = '22023';
  end if;

  perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_id);

  if v_doc.tipo = 'sales_invoice' then
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', p_cuenta_id,
        'descripcion', 'Cobro ' || v_doc.numero,
        'debito', v_monto,
        'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', v_doc.cuenta_control_id,
        'descripcion', 'Cobro ' || v_doc.numero,
        'debito', 0,
        'credito', v_monto
      )
    );
  else
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', v_doc.cuenta_control_id,
        'descripcion', 'Pago ' || v_doc.numero,
        'debito', v_monto,
        'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', p_cuenta_id,
        'descripcion', 'Pago ' || v_doc.numero,
        'debito', 0,
        'credito', v_monto
      )
    );
  end if;

  v_asiento_id := public._contabilizar_asiento_interno(
    p_empresa_id, v_fecha, 'payment',
    'Pago del documento ' || v_doc.numero,
    coalesce(nullif(v_referencia, ''), v_doc.numero), v_lineas, 'posted'
  );

  insert into public.documento_pagos (
    empresa_id, documento_id, fecha_pago, monto, metodo_pago, cuenta_id,
    referencia, asiento_id, estado, creado_por
  )
  values (
    p_empresa_id, v_doc.id, v_fecha, v_monto, btrim(coalesce(p_metodo_pago, '')),
    p_cuenta_id, v_referencia, v_asiento_id, 'active', auth.uid()
  )
  returning id into v_pago_id;

  perform public.registrar_auditoria(
    p_empresa_id, 'pagar', 'documento_pagos', v_pago_id::text,
    jsonb_build_object(
      'documento_id', v_doc.id, 'monto', v_monto,
      'metodo_pago', p_metodo_pago, 'asiento_id', v_asiento_id
    )
  );

  return v_pago_id;
end;
$$;

create or replace function public.anular_pago_documento(
  p_empresa_id uuid,
  p_pago_id uuid,
  p_fecha_anulacion date default current_date,
  p_motivo text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.documento_pagos%rowtype;
  v_fecha date := coalesce(p_fecha_anulacion, current_date);
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_reverso uuid;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador']
  );

  select * into v_pago
    from public.documento_pagos p
   where p.id = p_pago_id and p.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'pago no encontrado' using errcode = '22023';
  end if;

  if v_pago.estado <> 'active' then
    raise exception 'el pago ya está anulado' using errcode = '22023';
  end if;

  if v_pago.asiento_id is null then
    raise exception 'el pago no tiene asiento contable' using errcode = '22023';
  end if;

  v_reverso := public._revertir_asiento_interno(
    p_empresa_id, v_pago.asiento_id, v_fecha,
    coalesce(nullif(v_motivo, ''), 'Anulación de pago')
  );

  update public.documento_pagos p
     set estado = 'cancelled',
         cancelado_en = now(),
         motivo_cancelacion = v_motivo
   where p.id = v_pago.id;

  perform public.registrar_auditoria(
    p_empresa_id, 'anular', 'documento_pagos', v_pago.id::text,
    jsonb_build_object('documento_id', v_pago.documento_id, 'motivo', v_motivo,
                       'reverso_asiento_id', v_reverso)
  );

  return v_reverso;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Permisos de ejecución (nunca anon)
-- ---------------------------------------------------------------------------

revoke all on function public.guardar_metodo_pago(uuid, text, uuid, boolean, boolean, uuid) from public, anon;
revoke all on function public.guardar_configuracion_fiscal(uuid, integer, integer, integer, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.guardar_secuencia_ncf(uuid, text, text, bigint, bigint, date, boolean, uuid) from public, anon;
revoke all on function public.guardar_regla_fiscal(uuid, text, text, text, integer, uuid, boolean, uuid) from public, anon;
revoke all on function public.guardar_obligacion_fiscal(uuid, text, text, date, text, numeric, text, uuid) from public, anon;
revoke all on function public.marcar_obligacion_presentada(uuid, uuid, text, numeric, text) from public, anon;
revoke all on function public.consumir_siguiente_ncf(uuid, text, date) from public, anon;
revoke all on function public.emitir_documento_financiero(uuid, text, uuid, date, text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, text, date, uuid, uuid, uuid, jsonb, numeric, numeric) from public, anon;
revoke all on function public.anular_documento(uuid, uuid, date, text) from public, anon;
revoke all on function public.registrar_pago_documento(uuid, uuid, date, numeric, text, uuid, text) from public, anon;
revoke all on function public.anular_pago_documento(uuid, uuid, date, text) from public, anon;
revoke all on function public._bloquear_borrado_documento() from public, anon;

grant execute on function public.guardar_metodo_pago(uuid, text, uuid, boolean, boolean, uuid) to authenticated;
grant execute on function public.guardar_configuracion_fiscal(uuid, integer, integer, integer, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.guardar_secuencia_ncf(uuid, text, text, bigint, bigint, date, boolean, uuid) to authenticated;
grant execute on function public.guardar_regla_fiscal(uuid, text, text, text, integer, uuid, boolean, uuid) to authenticated;
grant execute on function public.guardar_obligacion_fiscal(uuid, text, text, date, text, numeric, text, uuid) to authenticated;
grant execute on function public.marcar_obligacion_presentada(uuid, uuid, text, numeric, text) to authenticated;
grant execute on function public.consumir_siguiente_ncf(uuid, text, date) to authenticated;
grant execute on function public.emitir_documento_financiero(uuid, text, uuid, date, text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, text, date, uuid, uuid, uuid, jsonb, numeric, numeric) to authenticated;
grant execute on function public.anular_documento(uuid, uuid, date, text) to authenticated;
grant execute on function public.registrar_pago_documento(uuid, uuid, date, numeric, text, uuid, text) to authenticated;
grant execute on function public.anular_pago_documento(uuid, uuid, date, text) to authenticated;
