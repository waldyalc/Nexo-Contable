# supabase/AGENTS.md — Reglas de Base de Datos y Migraciones

## 1. Disciplina de migraciones

* Nomenclatura estricta: `supabase/migrations/YYYYMMDDHHMMSS_snake_case.sql` usando timestamp UTC real estrictamente creciente.
* Las migraciones aplicadas **nunca se editan**: cualquier ajuste es una nueva migración aditiva.
* Orden interno recomendado por archivo:
  1. Tablas e índices (`empresa_id` obligatorio en toda tabla de negocio).
  2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
  3. `REVOKE ALL` de `anon`; `REVOKE INSERT, UPDATE, DELETE, TRUNCATE` de `authenticated`; `GRANT SELECT` a `authenticated`.
  4. Políticas RLS `FOR SELECT TO authenticated USING (...)` filtradas por `public.rol_en_empresa(empresa_id) IS NOT NULL`.
  5. Funciones RPC (`security definer`, `SET search_path = ''`) con verificación explícita de rol (`admin_global`, `admin_empresa`, `contador`, `auxiliar`, `cliente`) y `GRANT EXECUTE` explícito a `authenticated`.
  6. Seeds idempotentes (`ON CONFLICT DO NOTHING`) si aplican.

## 2. Modelo Multi-Empresa

* `public.perfiles(user_id, email, nombre, rol_global, debe_definir_password, activo, creado_en)`
  - `rol_global IN ('admin_global', 'usuario')`
* `public.empresas(id, nombre_comercial, razon_social, rnc, rnc_normalizado, ...)`
  - `rnc_normalizado` sin guiones ni espacios, con índice único parcial cuando no esté vacío.
* `public.empresa_usuarios(user_id, empresa_id, rol, es_principal, creado_en)`
  - `rol IN ('admin_empresa', 'contador', 'auxiliar', 'cliente')`
* Helper `public.rol_en_empresa(p_empresa_id uuid)`:
  - Retorna `'admin_global'` si el usuario autenticado es `admin_global` activo en `perfiles`.
  - Si no, retorna su `rol` en `empresa_usuarios` para `p_empresa_id`.
  - Retorna `NULL` si no tiene acceso (bloqueando RLS y lanzando `42501` en RPCs).

## 3. Reglas contables en SQL

* Dinero: `NUMERIC(14,2)` (o `BIGINT` en centavos — usar una sola convención consistente: **`BIGINT` en centavos** o **`NUMERIC(14,2)`**; en Nexo usamos **`NUMERIC(14,2)`** para claridad contable y compatibilidad con `MEDOXIGAS-CONTABILIDAD`, convirtiendo los centavos de SQLite `/ 100.0` en el script de migración).
* Cantidades de inventario: `NUMERIC(18,4)` — nunca `REAL`.
* Toda secuencia numerada (`JE-YYYY-00001`, facturas, NCF/e-CF `B01`–`B17` y `E31`–`E47`) usa bloqueo `FOR UPDATE` por `empresa_id`.
* Todo asiento contabilizado valida `SUM(debito) = SUM(credito)` y `COUNT(*) >= 2` mediante trigger `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`.

## 4. Tests pgTAP

* Toda migración nueva debe ir acompañada de pruebas en `supabase/tests/*_test.sql`.
* Obligatorio incluir tests de aislamiento multi-empresa (`rls_multi_empresa_test.sql`) que prueben que un usuario de la Empresa A recibe 0 filas de la Empresa B y error `42501` al intentar invocar RPCs de la Empresa B.
* Los agentes **nunca** ejecutan `supabase db push` ni escriben en producción sin orden expresa del Orquestador.
