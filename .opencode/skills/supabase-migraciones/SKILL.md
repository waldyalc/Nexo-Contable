---
name: supabase-migraciones
description: Reglas para escribir migraciones SQL, políticas RLS multi-empresa, RPCs security definer y tests pgTAP en Nexo Contable.
---

# Skill: Migraciones Supabase Multi-Empresa

1. **Nomenclatura:** `supabase/migrations/YYYYMMDDHHMMSS_snake_case.sql` (timestamp UTC estrictamente creciente).
2. **Aditivas siempre:** nunca editar una migración ya aplicada.
3. **Aislamiento multi-empresa obligatorio:**
   - Toda tabla de negocio lleva `empresa_id uuid NOT NULL REFERENCES public.empresas(id)`.
   - Toda restricción `UNIQUE` es compuesta por `empresa_id`.
   - Habilitar RLS en el 100% de las tablas `public`, revocar todo a `anon`, revocar `INSERT/UPDATE/DELETE/TRUNCATE` a `authenticated` y conceder solo `SELECT` filtrado por `public.rol_en_empresa(empresa_id) IS NOT NULL`.
4. **Escrituras solo por RPC:** toda escritura usa `security definer` + `SET search_path = ''`, valida `public.rol_en_empresa(p_empresa_id)` (lanza `SQLSTATE '42501'` si no autorizado) y ejecuta todo en una sola transacción.
5. **Seguridad operativa:** los subagentes solo escriben archivos `.sql` y tests en `supabase/tests/*_test.sql`. Nunca corren `supabase db push` ni usan `service_role` en código de app.
