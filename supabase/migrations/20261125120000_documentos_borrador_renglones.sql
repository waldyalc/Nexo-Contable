-- ---------------------------------------------------------------------------
-- Nexo Contable · Borradores de documentos, proformas y renglones
--
-- Restaura el flujo operativo original: Guardar borrador → Editar → Asignar
-- comprobante (proformas) → Contabilizar. Los renglones se conservan en
-- detalles_fiscales.lines y al contabilizar reparten la cuenta principal y
-- mueven inventario dentro de la misma transacción del asiento del documento.
--
-- Aditiva: no altera emitir_documento_financiero ni documentos ya contabilizados.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Helper interno de inventario para documentos financieros
-- ---------------------------------------------------------------------------

create or replace function public._aplicar_movimiento_inventario_documento(
  p_empresa_id uuid,
  p_articulo_id uuid,
  p_fecha date,
  p_direccion text,
  p_cantidad numeric,
  p_costo_unitario numeric,
  p_referencia text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_articulo public.articulos_inventario%rowtype;
  v_direccion text := lower(btrim(coalesce(p_direccion, '')));
  v_cantidad numeric(18, 4) := round(abs(coalesce(p_cantidad, 0)), 4);
  v_costo numeric(14, 2);
  v_costo_total numeric(14, 2);
  v_nueva_cantidad numeric(18, 4);
  v_nuevo_valor numeric(14, 2);
  v_nuevo_promedio numeric(14, 2);
  v_movimiento_id uuid;
begin
  if v_direccion not in ('in', 'out') then
    raise exception 'la dirección del movimiento de inventario debe ser in u out'
      using errcode = '22023';
  end if;

  if v_cantidad <= 0 then
    raise exception 'la cantidad del renglón de inventario debe ser mayor que cero'
      using errcode = '22023';
  end if;

  select * into v_articulo
    from public.articulos_inventario a
   where a.id = p_articulo_id and a.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'artículo de inventario no encontrado en la empresa'
      using errcode = '22023';
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
      raise exception 'stock insuficiente de %: disponible %, solicitado %',
        v_articulo.nombre, v_articulo.cantidad_disponible, v_cantidad
        using errcode = '22023';
    end if;

    if v_cantidad = v_articulo.cantidad_disponible then
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

  insert into public.movimientos_inventario (
    empresa_id, articulo_id, fecha, tipo, cantidad, costo_unitario,
    costo_total, referencia, notas, asiento_id
  )
  values (
    p_empresa_id, v_articulo.id, coalesce(p_fecha, current_date), v_direccion,
    v_cantidad, v_costo, v_costo_total, btrim(coalesce(p_referencia, '')),
    'Documento financiero', null
  )
  returning id into v_movimiento_id;

  update public.articulos_inventario a
     set cantidad_disponible = v_nueva_cantidad,
         costo_promedio = v_nuevo_promedio,
         valor_total = v_nuevo_valor
   where a.id = v_articulo.id;

  return v_movimiento_id;
end;
$$;

revoke all on function public._aplicar_movimiento_inventario_documento(uuid, uuid, date, text, numeric, numeric, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Guardar/editar borradores con renglones y detalles fiscales
-- ---------------------------------------------------------------------------

create or replace function public.guardar_documento_borrador(
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
  p_retencion_itbis numeric default null,
  p_documento_id uuid default null,
  p_proforma boolean default false,
  p_lineas jsonb default '[]'::jsonb
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
  v_lineas jsonb := '[]'::jsonb;
  v_linea jsonb;
  v_doc_id uuid := p_documento_id;
  v_existente public.documentos_financieros%rowtype;
  v_tercero public.terceros%rowtype;
  v_empresa_rnc text;
  v_propio boolean := false;
  v_numero text := nullif(btrim(coalesce(p_numero, '')), '');
  v_origen public.documentos_financieros%rowtype;
  v_saldo numeric(14, 2);
  v_cuenta_control uuid := p_cuenta_control_id;
  v_metodo_id uuid;
  v_metodo public.metodos_pago%rowtype;
  v_articulo public.articulos_inventario%rowtype;
  v_item_id uuid;
  v_cuenta_linea uuid;
  v_primera_cuenta uuid;
  v_cantidad numeric(18, 4);
  v_precio numeric(14, 2);
  v_monto_linea numeric(14, 2);
  v_suma_lineas numeric(14, 2) := 0;
  v_clasificacion text;
  v_proforma boolean := coalesce(p_proforma, false) and p_tipo = 'sales_invoice';
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

  if v_numero is null then
    raise exception 'el número interno del documento es obligatorio' using errcode = '22023';
  end if;

  if length(v_numero) > 40 then
    raise exception 'el número del documento no puede exceder 40 caracteres'
      using errcode = '22023';
  end if;

  if p_fecha_vencimiento is null then
    raise exception 'la fecha de vencimiento es obligatoria' using errcode = '22023';
  end if;

  if p_fecha_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha de emisión'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_detalles) <> 'object' then
    raise exception 'los detalles fiscales deben ser un objeto JSON' using errcode = '22023';
  end if;

  select * into v_tercero
    from public.terceros t
   where t.id = p_tercero_id and t.empresa_id = p_empresa_id;

  if not found or not v_tercero.activo then
    raise exception 'selecciona un tercero activo de esta empresa' using errcode = '22023';
  end if;

  if (v_tipo in ('sales_invoice', 'sales_credit') and v_tercero.tipo not in ('customer', 'both'))
     or (v_tipo in ('purchase_invoice', 'purchase_credit') and v_tercero.tipo not in ('supplier', 'both')) then
    raise exception 'el tipo de tercero no corresponde a la operación' using errcode = '22023';
  end if;

  if v_doc_id is not null then
    select * into v_existente
      from public.documentos_financieros d
     where d.id = v_doc_id and d.empresa_id = p_empresa_id
     for update;

    if not found then
      raise exception 'documento financiero no encontrado' using errcode = '22023';
    end if;

    if v_existente.estado <> 'draft' then
      raise exception 'solo se pueden editar documentos en borrador' using errcode = '22023';
    end if;

    if v_existente.tipo <> v_tipo then
      raise exception 'no se puede cambiar el tipo del documento en edición'
        using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from public.documentos_financieros d
    where d.empresa_id = p_empresa_id
      and d.numero = v_numero
      and (v_doc_id is null or d.id <> v_doc_id)
  ) then
    raise exception 'ya existe otro documento con ese número interno' using errcode = '23505';
  end if;

  -- Renglones: se normalizan y persisten en detalles_fiscales.lines. Con
  -- artículo, ventas usan su cuenta de ingreso y compras su cuenta de inventario.
  if p_lineas is not null and jsonb_typeof(p_lineas) = 'array' and jsonb_array_length(p_lineas) > 0 then
    if v_tipo in ('sales_credit', 'purchase_credit') then
      raise exception 'las notas de crédito no admiten distribución en renglones'
        using errcode = '22023';
    end if;

    if v_otros > 0 then
      raise exception 'cuando repartes la factura en renglones, otros impuestos deben ir en 0'
        using errcode = '22023';
    end if;

    for v_linea in select value from jsonb_array_elements(p_lineas) loop
      if jsonb_typeof(v_linea) <> 'object' then
        raise exception 'cada renglón debe ser un objeto JSON' using errcode = '22023';
      end if;

      v_item_id := nullif(btrim(coalesce(v_linea ->> 'item_id', '')), '')::uuid;
      v_cuenta_linea := nullif(btrim(coalesce(v_linea ->> 'account_id', '')), '')::uuid;
      v_cantidad := null;
      v_precio := null;

      if v_item_id is not null then
        select * into v_articulo
          from public.articulos_inventario a
         where a.id = v_item_id and a.empresa_id = p_empresa_id;

        if not found or not v_articulo.activo then
          raise exception 'selecciona un artículo de inventario válido en los renglones'
            using errcode = '22023';
        end if;

        v_cantidad := round(coalesce((v_linea ->> 'quantity')::numeric, 0), 4);
        if v_cantidad <= 0 then
          raise exception 'la cantidad del artículo debe ser mayor que cero'
            using errcode = '22023';
        end if;

        v_precio := round(
          case
            when v_tipo = 'sales_invoice' then coalesce(
              (v_linea ->> 'unit_price')::numeric,
              (v_linea ->> 'unit_cost')::numeric,
              0
            )
            else coalesce(
              (v_linea ->> 'unit_cost')::numeric,
              (v_linea ->> 'unit_price')::numeric,
              0
            )
          end,
          2
        );
        v_monto_linea := round(v_cantidad * v_precio, 2);

        if v_tipo = 'sales_invoice' then
          v_cuenta_linea := coalesce(v_cuenta_linea, v_articulo.cuenta_ingreso_id);
        else
          v_cuenta_linea := v_articulo.cuenta_inventario_id;
        end if;
      else
        v_monto_linea := round(coalesce((v_linea ->> 'amount')::numeric, 0), 2);
      end if;

      if v_cuenta_linea is null then
        raise exception 'cada renglón necesita una cuenta contable' using errcode = '22023';
      end if;

      perform public._validar_cuenta_movimiento(p_empresa_id, v_cuenta_linea);

      select c.clasificacion into v_clasificacion
        from public.cuentas c
       where c.empresa_id = p_empresa_id and c.id = v_cuenta_linea;

      if (v_tipo = 'sales_invoice' and v_clasificacion not in ('income', 'asset', 'liability'))
         or (v_tipo = 'purchase_invoice' and v_clasificacion not in ('expense', 'cost', 'asset')) then
        raise exception 'la cuenta de un renglón no corresponde a la operación'
          using errcode = '22023';
      end if;

      if v_monto_linea <= 0 then
        raise exception 'cada renglón debe tener un monto mayor que cero'
          using errcode = '22023';
      end if;

      if v_primera_cuenta is null then
        v_primera_cuenta := v_cuenta_linea;
      end if;

      v_suma_lineas := round(v_suma_lineas + v_monto_linea, 2);
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'account_id', v_cuenta_linea,
        'amount', v_monto_linea,
        'description', nullif(btrim(coalesce(v_linea ->> 'description', '')), ''),
        'item_id', v_item_id,
        'quantity', v_cantidad,
        'unit_price', case when v_tipo = 'sales_invoice' then v_precio end,
        'unit_cost', case when v_tipo = 'purchase_invoice' then v_precio end
      ));
    end loop;

    v_subtotal := v_suma_lineas;
    v_detalles := v_detalles || jsonb_build_object('lines', v_lineas);
  elsif p_lineas is not null and jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'los renglones deben ser un arreglo JSON' using errcode = '22023';
  else
    v_detalles := v_detalles - 'lines';
  end if;

  if v_subtotal <= 0 or v_impuesto < 0 or v_retenciones < 0 or v_otros < 0 then
    raise exception 'revisa subtotal, ITBIS, otros impuestos y retenciones'
      using errcode = '22023';
  end if;

  v_total := round(v_subtotal + v_impuesto + v_otros - v_retenciones, 2);
  if v_total <= 0 or v_retenciones > round(v_subtotal + v_impuesto + v_otros, 2) then
    raise exception 'el total del documento debe ser mayor a cero' using errcode = '22023';
  end if;

  if jsonb_array_length(v_lineas) > 0 then
    p_cuenta_id := v_primera_cuenta;
  end if;

  if p_cuenta_id is null then
    raise exception 'la cuenta contable principal es obligatoria' using errcode = '22023';
  end if;

  perform public._validar_cuenta_movimiento(p_empresa_id, p_cuenta_id);

  -- En compras la forma de pago define la cuenta de contrapartida, como en el
  -- flujo original. Si deja CxP, la configuración de la forma exige pasivo.
  if v_tipo = 'purchase_invoice' then
    v_metodo_id := nullif(btrim(coalesce(v_detalles ->> 'payment_method_id', '')), '')::uuid;

    if v_metodo_id is not null then
      select * into v_metodo
        from public.metodos_pago m
       where m.id = v_metodo_id and m.empresa_id = p_empresa_id and m.activo;

      if not found then
        raise exception 'selecciona una forma de pago activa para esta empresa'
          using errcode = '22023';
      end if;

      v_cuenta_control := v_metodo.cuenta_id;
      v_detalles := v_detalles || jsonb_build_object(
        'payment_method_id', v_metodo.id,
        'payment_method_name', v_metodo.nombre,
        'leaves_supplier_payable', v_metodo.deja_cxp_proveedor,
        'payment_date', coalesce(nullif(btrim(v_detalles ->> 'payment_date'), ''), v_fecha::text)
      );
    else
      v_detalles := v_detalles || jsonb_build_object('leaves_supplier_payable', true);
    end if;
  end if;

  if v_cuenta_control is null then
    raise exception 'la cuenta de control o forma de pago es obligatoria'
      using errcode = '22023';
  end if;

  perform public._validar_cuenta_movimiento(p_empresa_id, v_cuenta_control);

  if v_impuesto > 0 then
    if p_cuenta_impuesto_id is null then
      raise exception 'el documento con impuesto requiere cuenta de impuesto'
        using errcode = '22023';
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

  -- Notas de crédito: la factura original debe estar contabilizada y el borrador
  -- no puede exceder el saldo conocido al guardarse (se vuelve a validar al contabilizar).
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
           - coalesce((select sum(p.monto) from public.documento_pagos p
             where p.documento_id = v_origen.id and p.estado = 'active'), 0)
           - coalesce((select sum(nc.total) from public.documentos_financieros nc
             where nc.documento_acreditado_id = v_origen.id and nc.estado = 'posted'), 0)
      into v_saldo;

    if v_total > v_saldo then
      raise exception 'la nota de crédito (%) excede el saldo pendiente del documento (%)',
        v_total, v_saldo using errcode = '22023';
    end if;
  elsif p_documento_acreditado_id is not null then
    raise exception 'solo las notas de crédito pueden acreditar otro documento'
      using errcode = '22023';
  end if;

  -- NCF/proforma. En ventas normales el comprobante se reserva al guardar el
  -- borrador; las proformas quedan sin NCF hasta «Asignar comprobante».
  select regexp_replace(coalesce(e.rnc, ''), '[^0-9A-Za-z]', '', 'g')
    into v_empresa_rnc
    from public.empresas e
   where e.id = p_empresa_id;

  v_propio := v_tipo = 'purchase_invoice'
    and v_empresa_rnc <> ''
    and regexp_replace(coalesce(v_tercero.rnc, ''), '[^0-9A-Za-z]', '', 'g') = v_empresa_rnc;

  if v_tipo = 'sales_invoice' then
    if v_proforma then
      v_ncf := null;
      v_tipo_ncf := null;
      v_detalles := v_detalles || jsonb_build_object('proforma', true) - 'ncf_type';
    else
      v_detalles := v_detalles || jsonb_build_object('proforma', false);
      if v_ncf is null then
        if v_tipo_ncf is null then
          raise exception 'selecciona el tipo de comprobante de la factura'
            using errcode = '22023';
        end if;
        v_ncf := public.consumir_siguiente_ncf(p_empresa_id, v_tipo_ncf, v_fecha);
        v_detalles := v_detalles || jsonb_build_object('ncf_type', v_tipo_ncf);
      end if;
    end if;
  elsif v_tipo = 'purchase_invoice' and v_propio then
    v_tipo_ncf := coalesce(v_tipo_ncf, 'B13');
    if v_tipo_ncf not in ('B11', 'B13') then
      raise exception 'para gastos con el RNC propio selecciona B11 o B13'
        using errcode = '22023';
    end if;
    if v_tipo_ncf = 'B13' and (v_impuesto > 0 or round(coalesce(p_retencion_itbis, 0), 2) > 0) then
      raise exception 'el comprobante B13 no permite transparentar, retener ni adelantar ITBIS'
        using errcode = '22023';
    end if;
    if v_ncf is null then
      v_ncf := public.consumir_siguiente_ncf(p_empresa_id, v_tipo_ncf, v_fecha);
    end if;
    v_detalles := v_detalles || jsonb_build_object(
      'ncf_type', v_tipo_ncf,
      'minor_expense_ncf', v_tipo_ncf = 'B13'
    );
  elsif v_tipo in ('sales_credit', 'purchase_credit') and v_ncf is null and v_tipo_ncf is not null then
    v_ncf := public.consumir_siguiente_ncf(p_empresa_id, v_tipo_ncf, v_fecha);
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
      raise exception 'el tipo de comprobante % no es válido', v_tipo_ncf
        using errcode = '22023';
    end if;
  end if;

  if v_doc_id is null then
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
      v_cuenta_control, p_cuenta_impuesto_id, p_cuenta_retencion_id,
      p_documento_acreditado_id, 'draft', null, auth.uid()
    )
    returning id into v_doc_id;
  else
    update public.documentos_financieros d
       set numero = v_numero,
           ncf = coalesce(v_ncf, ''),
           tipo_ncf = coalesce(v_tipo_ncf, ''),
           tercero_id = p_tercero_id,
           fecha_emision = v_fecha,
           fecha_vencimiento = p_fecha_vencimiento,
           concepto = v_concepto,
           subtotal = v_subtotal,
           impuesto = v_impuesto,
           retenciones = v_retenciones,
           otros_impuestos = v_otros,
           total = v_total,
           detalles_fiscales = v_detalles,
           cuenta_id = p_cuenta_id,
           cuenta_control_id = v_cuenta_control,
           cuenta_impuesto_id = p_cuenta_impuesto_id,
           cuenta_retencion_id = p_cuenta_retencion_id,
           documento_acreditado_id = p_documento_acreditado_id
     where d.id = v_doc_id;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id,
    case when v_existente.id is null then 'crear_borrador' else 'editar_borrador' end,
    'documentos_financieros', v_doc_id::text,
    jsonb_build_object(
      'tipo', v_tipo, 'numero', v_numero, 'ncf', v_ncf, 'total', v_total,
      'proforma', v_proforma, 'renglones', jsonb_array_length(v_lineas)
    )
  );

  return v_doc_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Asignar comprobante a una factura proforma
-- ---------------------------------------------------------------------------

create or replace function public.asignar_ncf_documento_borrador(
  p_empresa_id uuid,
  p_documento_id uuid,
  p_tipo_comprobante text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_financieros%rowtype;
  v_tipo text := upper(nullif(btrim(coalesce(p_tipo_comprobante, '')), ''));
  v_ncf text;
  v_detalles jsonb;
begin
  perform public.exigir_rol_empresa(
    p_empresa_id, array['admin_empresa', 'contador']
  );

  if v_tipo is null or v_tipo !~ '^(B(01|02|14|15)|E(3[1-9]|4[0-7]))$' then
    raise exception 'selecciona B01, B02, B14, B15 o una serie electrónica válida'
      using errcode = '22023';
  end if;

  select * into v_doc
    from public.documentos_financieros d
   where d.id = p_documento_id and d.empresa_id = p_empresa_id
   for update;

  if not found then
    raise exception 'documento financiero no encontrado' using errcode = '22023';
  end if;

  if v_doc.tipo <> 'sales_invoice' or v_doc.estado <> 'draft' or v_doc.ncf <> '' then
    raise exception 'solo puedes asignar comprobante a una factura proforma pendiente'
      using errcode = '22023';
  end if;

  v_ncf := public.consumir_siguiente_ncf(p_empresa_id, v_tipo, v_doc.fecha_emision);
  v_detalles := v_doc.detalles_fiscales
    || jsonb_build_object('ncf_type', v_tipo, 'proforma', false);

  update public.documentos_financieros d
     set ncf = v_ncf,
         tipo_ncf = v_tipo,
         detalles_fiscales = v_detalles
   where d.id = v_doc.id;

  perform public.registrar_auditoria(
    p_empresa_id, 'asignar_ncf', 'documentos_financieros', v_doc.id::text,
    jsonb_build_object('numero', v_doc.numero, 'ncf', v_ncf, 'tipo_ncf', v_tipo)
  );

  return v_doc.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Contabilizar un borrador con distribución de renglones e inventario
-- ---------------------------------------------------------------------------

create or replace function public.contabilizar_documento_financiero(
  p_empresa_id uuid,
  p_documento_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_financieros%rowtype;
  v_detalles jsonb;
  v_distribucion jsonb;
  v_linea jsonb;
  v_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_origen public.documentos_financieros%rowtype;
  v_saldo numeric(14, 2);
  v_item_id uuid;
  v_cuenta_linea uuid;
  v_cantidad numeric(18, 4);
  v_monto numeric(14, 2);
  v_costo_unitario numeric(14, 2);
  v_costo_movimiento numeric(14, 2);
  v_movimiento_id uuid;
  v_movimientos uuid[] := '{}'::uuid[];
  v_articulo public.articulos_inventario%rowtype;
  v_descripcion text;
  v_metodo_id uuid;
  v_espera_pago boolean;
  v_pago_id uuid;
  v_metodo_nombre text;
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

  if v_doc.estado <> 'draft' then
    raise exception 'solo se pueden contabilizar documentos en borrador'
      using errcode = '22023';
  end if;

  if v_doc.ncf = '' then
    raise exception 'el NCF es obligatorio para contabilizar' using errcode = '22023';
  end if;

  v_detalles := coalesce(v_doc.detalles_fiscales, '{}'::jsonb);
  v_distribucion := v_detalles -> 'lines';

  -- Las notas vuelven a validar el saldo real en el momento de contabilizar.
  if v_doc.tipo in ('sales_credit', 'purchase_credit') then
    select * into v_origen
      from public.documentos_financieros d
     where d.id = v_doc.documento_acreditado_id and d.empresa_id = p_empresa_id
     for update;

    if not found or v_origen.estado <> 'posted' then
      raise exception 'el documento acreditado ya no está disponible' using errcode = '22023';
    end if;

    select v_origen.total
           - coalesce((select sum(p.monto) from public.documento_pagos p
             where p.documento_id = v_origen.id and p.estado = 'active'), 0)
           - coalesce((select sum(nc.total) from public.documentos_financieros nc
             where nc.documento_acreditado_id = v_origen.id and nc.estado = 'posted'), 0)
      into v_saldo;

    if v_doc.total > v_saldo then
      raise exception 'el saldo de la factura ya no cubre esta nota de crédito'
        using errcode = '22023';
    end if;
  end if;

  -- Contrapartida y retenciones en el mismo sentido del motor ya existente.
  if v_doc.tipo = 'purchase_invoice' then
    if v_distribucion is not null and jsonb_typeof(v_distribucion) = 'array'
       and jsonb_array_length(v_distribucion) > 0 then
      for v_linea in select value from jsonb_array_elements(v_distribucion) loop
        v_monto := round(coalesce((v_linea ->> 'amount')::numeric, 0), 2);
        v_cuenta_linea := nullif(btrim(coalesce(v_linea ->> 'account_id', '')), '')::uuid;
        if v_monto <= 0 or v_cuenta_linea is null then
          raise exception 'un renglón del borrador ya no es válido' using errcode = '22023';
        end if;

        v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
          'cuenta_id', v_cuenta_linea,
          'descripcion', coalesce(nullif(v_linea ->> 'description', ''), v_doc.concepto),
          'debito', v_monto,
          'credito', 0
        ));

        v_item_id := nullif(btrim(coalesce(v_linea ->> 'item_id', '')), '')::uuid;
        if v_item_id is not null then
          v_cantidad := round(coalesce((v_linea ->> 'quantity')::numeric, 0), 4);
          v_costo_unitario := case when v_cantidad > 0 then round(v_monto / v_cantidad, 2) else 0 end;
          v_movimiento_id := public._aplicar_movimiento_inventario_documento(
            p_empresa_id, v_item_id, v_doc.fecha_emision, 'in', v_cantidad,
            v_costo_unitario, 'Factura ' || v_doc.numero
          );
          v_movimientos := array_append(v_movimientos, v_movimiento_id);
        end if;
      end loop;
    else
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_id,
        'descripcion', v_doc.concepto,
        'debito', v_doc.subtotal + v_doc.otros_impuestos,
        'credito', 0
      ));
    end if;

    if v_doc.impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_impuesto_id,
        'descripcion', 'ITBIS adelantado ' || v_doc.numero,
        'debito', v_doc.impuesto,
        'credito', 0
      ));
    end if;

    if v_doc.retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_retencion_id,
        'descripcion', 'Retenciones ' || v_doc.numero,
        'debito', 0,
        'credito', v_doc.retenciones
      ));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_doc.cuenta_control_id,
      'descripcion', 'Cuentas por pagar ' || v_doc.numero,
      'debito', 0,
      'credito', v_doc.total
    ));
  elsif v_doc.tipo = 'purchase_credit' then
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta_id', v_doc.cuenta_control_id, 'descripcion', 'Cuentas por pagar ' || v_doc.numero, 'debito', v_doc.total, 'credito', 0)
    );

    if v_doc.retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_retencion_id, 'descripcion', 'Retenciones ' || v_doc.numero,
        'debito', v_doc.retenciones, 'credito', 0
      ));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_doc.cuenta_id, 'descripcion', v_doc.concepto,
      'debito', 0, 'credito', v_doc.subtotal + v_doc.otros_impuestos
    ));

    if v_doc.impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_impuesto_id, 'descripcion', 'ITBIS adelantado ' || v_doc.numero,
        'debito', 0, 'credito', v_doc.impuesto
      ));
    end if;
  elsif v_doc.tipo = 'sales_invoice' then
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta_id', v_doc.cuenta_control_id, 'descripcion', 'Cuentas por cobrar ' || v_doc.numero, 'debito', v_doc.total, 'credito', 0)
    );

    if v_doc.retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_retencion_id, 'descripcion', 'Retenciones ' || v_doc.numero,
        'debito', v_doc.retenciones, 'credito', 0
      ));
    end if;

    if v_distribucion is not null and jsonb_typeof(v_distribucion) = 'array'
       and jsonb_array_length(v_distribucion) > 0 then
      for v_linea in select value from jsonb_array_elements(v_distribucion) loop
        v_monto := round(coalesce((v_linea ->> 'amount')::numeric, 0), 2);
        v_cuenta_linea := nullif(btrim(coalesce(v_linea ->> 'account_id', '')), '')::uuid;
        v_descripcion := coalesce(nullif(v_linea ->> 'description', ''), v_doc.concepto);
        if v_monto <= 0 or v_cuenta_linea is null then
          raise exception 'un renglón del borrador ya no es válido' using errcode = '22023';
        end if;

        v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
          'cuenta_id', v_cuenta_linea,
          'descripcion', v_descripcion,
          'debito', 0,
          'credito', v_monto
        ));

        v_item_id := nullif(btrim(coalesce(v_linea ->> 'item_id', '')), '')::uuid;
        if v_item_id is not null then
          select * into v_articulo
            from public.articulos_inventario a
           where a.id = v_item_id and a.empresa_id = p_empresa_id;

          if not found then
            raise exception 'un artículo del detalle ya no existe' using errcode = '22023';
          end if;

          v_cantidad := round(coalesce((v_linea ->> 'quantity')::numeric, 0), 4);
          v_movimiento_id := public._aplicar_movimiento_inventario_documento(
            p_empresa_id, v_item_id, v_doc.fecha_emision, 'out', v_cantidad,
            null, 'Factura ' || v_doc.numero
          );
          v_movimientos := array_append(v_movimientos, v_movimiento_id);

          select m.costo_total into v_costo_movimiento
            from public.movimientos_inventario m
           where m.id = v_movimiento_id;

          if v_costo_movimiento > 0 then
            if v_articulo.cuenta_costo_id is null or v_articulo.cuenta_inventario_id is null then
              raise exception 'el artículo % no tiene cuentas de costo e inventario configuradas',
                v_articulo.nombre using errcode = '22023';
            end if;

            v_lineas := v_lineas || jsonb_build_array(
              jsonb_build_object(
                'cuenta_id', v_articulo.cuenta_costo_id,
                'descripcion', 'Costo de venta ' || v_articulo.sku,
                'debito', v_costo_movimiento,
                'credito', 0
              ),
              jsonb_build_object(
                'cuenta_id', v_articulo.cuenta_inventario_id,
                'descripcion', 'Salida de inventario ' || v_articulo.sku,
                'debito', 0,
                'credito', v_costo_movimiento
              )
            );
          end if;
        end if;
      end loop;
    else
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_id,
        'descripcion', v_doc.concepto,
        'debito', 0,
        'credito', v_doc.subtotal + v_doc.otros_impuestos
      ));
    end if;

    if v_doc.impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_impuesto_id,
        'descripcion', 'ITBIS por pagar ' || v_doc.numero,
        'debito', 0,
        'credito', v_doc.impuesto
      ));
    end if;
  else
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta_id', v_doc.cuenta_id, 'descripcion', v_doc.concepto, 'debito', v_doc.subtotal + v_doc.otros_impuestos, 'credito', 0)
    );

    if v_doc.impuesto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_impuesto_id, 'descripcion', 'ITBIS por pagar ' || v_doc.numero,
        'debito', v_doc.impuesto, 'credito', 0
      ));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_doc.cuenta_control_id, 'descripcion', 'Cuentas por cobrar ' || v_doc.numero,
      'debito', 0, 'credito', v_doc.total
    ));

    if v_doc.retenciones > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_doc.cuenta_retencion_id, 'descripcion', 'Retenciones ' || v_doc.numero,
        'debito', 0, 'credito', v_doc.retenciones
      ));
    end if;
  end if;

  v_asiento_id := public._contabilizar_asiento_interno(
    p_empresa_id, v_doc.fecha_emision, v_doc.tipo, v_doc.concepto,
    v_doc.numero, v_lineas, 'posted'
  );

  if array_length(v_movimientos, 1) is not null then
    update public.movimientos_inventario m
       set asiento_id = v_asiento_id
     where m.id = any(v_movimientos);
  end if;

  update public.documentos_financieros d
     set estado = 'posted',
         asiento_id = v_asiento_id
   where d.id = v_doc.id;

  -- Si la forma de pago no deja CxP, la compra nace saldada usando el mismo
  -- asiento del documento (exactamente el criterio del flujo original).
  if v_doc.tipo = 'purchase_invoice' then
    v_metodo_id := nullif(btrim(coalesce(v_detalles ->> 'payment_method_id', '')), '')::uuid;
    v_espera_pago := coalesce((v_detalles ->> 'leaves_supplier_payable')::boolean, true);
    v_metodo_nombre := coalesce(nullif(v_detalles ->> 'payment_method_name', ''), 'Forma de pago');

    if v_metodo_id is not null and not v_espera_pago then
      insert into public.documento_pagos (
        empresa_id, documento_id, fecha_pago, monto, metodo_pago, cuenta_id,
        referencia, asiento_id, estado, creado_por
      )
      values (
        p_empresa_id, v_doc.id,
        coalesce(nullif(v_detalles ->> 'payment_date', '')::date, v_doc.fecha_emision),
        v_doc.total, v_metodo_nombre, v_doc.cuenta_control_id,
        coalesce(nullif(v_detalles ->> 'bank_fee_reference', ''), v_doc.ncf),
        v_asiento_id, 'active', auth.uid()
      )
      returning id into v_pago_id;
    end if;
  end if;

  perform public.registrar_auditoria(
    p_empresa_id, 'contabilizar', 'documentos_financieros', v_doc.id::text,
    jsonb_build_object(
      'tipo', v_doc.tipo, 'numero', v_doc.numero, 'ncf', v_doc.ncf,
      'total', v_doc.total, 'asiento_id', v_asiento_id,
      'movimientos_inventario', coalesce(array_length(v_movimientos, 1), 0),
      'pago_automatico_id', v_pago_id
    )
  );

  return v_doc.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permisos RPC explícitos
-- ---------------------------------------------------------------------------

revoke all on function public.guardar_documento_borrador(uuid, text, uuid, date, text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, text, date, uuid, uuid, uuid, jsonb, numeric, numeric, uuid, boolean, jsonb) from public, anon;
revoke all on function public.asignar_ncf_documento_borrador(uuid, uuid, text) from public, anon;
revoke all on function public.contabilizar_documento_financiero(uuid, uuid) from public, anon;

grant execute on function public.guardar_documento_borrador(uuid, text, uuid, date, text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, text, date, uuid, uuid, uuid, jsonb, numeric, numeric, uuid, boolean, jsonb) to authenticated;
grant execute on function public.asignar_ncf_documento_borrador(uuid, uuid, text) to authenticated;
grant execute on function public.contabilizar_documento_financiero(uuid, uuid) to authenticated;
