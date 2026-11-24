# docs/contrato-db.md — Contrato de Base de Datos (Supabase Multi-Empresa)

## 1. Convenciones globales

* **Motor:** PostgreSQL 15+ (Supabase).
* **Claves primarias:** `uuid DEFAULT gen_random_uuid()`.
* **Timestamps:** `timestamptz NOT NULL DEFAULT now()`.
* **Fechas contables:** `date` (zona horaria funcional `America/Santo_Domingo`).
* **Montos monetarios:** `numeric(14,2) NOT NULL DEFAULT 0`.
* **Cantidades de inventario:** `numeric(18,4) NOT NULL DEFAULT 0`.
* **Tasas en puntos básicos (bps):** `integer` (`1800` = `18.00%`).

## 2. Esquema por dominios (Fase 1)

### Núcleo y Acceso
* `perfiles`: `user_id (PK → auth.users)`, `email (unique)`, `nombre`, `rol_global ('admin_global'|'usuario')`, `debe_definir_password (boolean default true)`, `activo`, `creado_en`, `actualizado_en`.
* `empresas`: `id`, `nombre_comercial`, `razon_social`, `rnc`, `rnc_normalizado` (sin guiones/espacios), `tipo_empresa`, `direccion`, `telefono`, `correo`, `representante_legal`, `actividad_economica`, `fecha_inicio`, `regimen_fiscal`, `moneda_funcional ('DOP')`, `periodo_fiscal ('01-12')`, `estado ('active'|'inactive')`, `creado_en`, `actualizado_en`.
* `empresa_usuarios`: `(user_id, empresa_id)` PK, `rol ('admin_empresa'|'contador'|'auxiliar'|'cliente')`, `es_principal (boolean default false)`, `creado_en`.
* `auditoria`: `id bigserial`, `actor_id`, `empresa_id`, `accion`, `entidad`, `entidad_id`, `detalles jsonb`, `creado_en` (append-only).

### Contabilidad General
* `periodos_contables`: `id`, `empresa_id`, `nombre`, `fecha_inicio`, `fecha_fin`, `estado ('open'|'closed')`, `cerrado_en`.
* `cuentas`: `id`, `empresa_id`, `codigo`, `nombre`, `padre_id`, `clasificacion ('asset'|'liability'|'equity'|'income'|'cost'|'expense')`, `naturaleza ('debit'|'credit')`, `nivel`, `es_agrupacion`, `activa`, `es_equivalente_efectivo`, `categoria_flujo_efectivo ('operating'|'investing'|'financing'|'other')`. `UNIQUE(empresa_id, codigo)`.
* `asientos`: `id`, `empresa_id`, `numero`, `fecha`, `tipo_operacion`, `descripcion`, `referencia`, `estado ('draft'|'posted'|'reversed'|'reversal')`, `reverso_de`, `revertido_por`, `creado_por`, `contabilizado_por`, `contabilizado_en`. `UNIQUE(empresa_id, numero)`.
* `asiento_lineas`: `id`, `asiento_id`, `empresa_id`, `linea`, `cuenta_id`, `descripcion`, `debito numeric(14,2)`, `credito numeric(14,2)` (`CHECK NOT (debito > 0 AND credito > 0)`).

### Terceros, Facturación y Gastos
* `terceros`: `id`, `empresa_id`, `tipo ('customer'|'supplier'|'both')`, `nombre`, `rnc`, `rnc_normalizado`, `correo`, `telefono`, `cuenta_por_pagar_id`, `cuenta_por_cobrar_id`, `activo`.
* `metodos_pago`: `id`, `empresa_id`, `nombre`, `cuenta_id`, `deja_cxp_proveedor`, `activo`.
* `documentos_financieros`: `id`, `empresa_id`, `tipo ('sales_invoice'|'purchase_invoice'|'sales_credit'|'purchase_credit')`, `numero`, `ncf`, `tercero_id`, `fecha_emision`, `fecha_vencimiento`, `concepto`, `subtotal`, `impuesto`, `retenciones`, `otros_impuestos`, `total`, `detalles_fiscales jsonb`, `cuenta_id`, `cuenta_control_id`, `cuenta_impuesto_id`, `cuenta_retencion_id`, `documento_acreditado_id`, `estado ('draft'|'posted'|'void')`, `asiento_id`. `UNIQUE(empresa_id, numero)`, índice único parcial `(empresa_id, ncf) WHERE ncf <> ''`.
* `documento_pagos`: `id`, `empresa_id`, `documento_id`, `fecha_pago`, `monto`, `metodo_pago`, `cuenta_id`, `referencia`, `asiento_id`, `estado ('active'|'cancelled')`, `cancelado_en`.

### Bancos, Inventario, Fiscal, Activos, Nómina y Documentos
* `cuentas_bancarias`, `movimientos_bancarios`, `importaciones_bancarias`, `sesiones_conciliacion_bancaria`.
* `articulos_inventario`, `movimientos_inventario` (`cantidad numeric(18,4)`).
* `configuracion_fiscal`, `secuencias_ncf` (acepta `B01`–`B17` **y** `E31`–`E47`), `reglas_fiscales`, `obligaciones_fiscales`.
* `activos_fijos`, `depreciaciones_activos`.
* `empleados`, `corridas_nomina`.
* `documentos_almacenados` (metadatos del bucket privado `documentos` en Supabase Storage).

## 3. Política de Seguridad

* `public.rol_en_empresa(p_empresa_id uuid)` define todos los permisos.
* Escrituras exclusivamente mediante RPCs `security definer` (`SET search_path = ''`).
* Lecturas mediante RLS `SELECT` + RPCs de reporte `STABLE SECURITY INVOKER`.
