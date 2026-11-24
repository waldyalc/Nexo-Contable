# AGENTS.md — Ley operativa de Nexo Contable

Este repositorio contiene **Nexo Contable**, un sistema de contabilidad **multi-empresa** para firmas contables en **República Dominicana (DGII / NCF / e-CF / 606 / 607)** construido con Next.js 16, React 19, TypeScript estricto, Tailwind 4, shadcn (Base UI) y Supabase.

> **Regla #1 — Repositorio público:** Este repo (`waldyalc/Nexo-Contable`) es **PÚBLICO**. Jamás subir `.env*`, tokens, llaves privadas ni archivos `work/*.sqlite*` con datos reales de clientes. El candado `src/lib/__tests__/datos-privados.test.ts` y `gitleaks` bloquean cualquier intento.

---

## 1. Roles de trabajo

* **Orquestador:** Planifica, revisa diffs de cada subagente, corre verificación completa (`pnpm typecheck && pnpm check && pnpm test`), integra ramas a `main`, administra Supabase remoto y nunca delega merges a `main`.
* **Subagente (DeepSeek V4.1 Flash):** Trabaja siempre en su propia rama/worktree aislado (`feat/*`, `fix/*`). Entrega cambios pequeños, probados, con commits en español. Nunca hace `git push --force`, nunca usa `--no-verify`, nunca aplica migraciones a producción ni usa `service_role` dentro de `src/app`.

---

## 2. Stack oficial

| Área | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, `src/proxy.ts` en lugar de `middleware.ts`) + React 19 |
| Lenguaje | TypeScript `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters` |
| UI | shadcn (`base-nova` sobre `@base-ui/react`, **NO Radix**) + Tailwind 4 CSS-first + `@tabler/icons-react` |
| Fechas | `date-fns` (`es`, `America/Santo_Domingo`) + `react-day-picker` v9/v10 + `MonthPicker` / `DatePicker` propios |
| Tablas y gráficos | `@tanstack/react-table` + `recharts` + `exceljs` |
| Formularios | `react-hook-form` + `@hookform/resolvers` + `zod` |
| Backend | **Supabase** (Auth con Email + Google OAuth, PostgreSQL + RLS Multi-Empresa, RPCs `security definer`, Storage privado) |
| Calidad | Biome (`pnpm check`), Vitest (`pnpm test`), pgTAP (`supabase/tests/`), Playwright (`pnpm test:e2e`), Husky + lint-staged |

---

## 3. Reglas de arquitectura Multi-Empresa (inviolables)

1. **Aislamiento total por `empresa_id`:** Toda tabla de negocio tiene `empresa_id uuid NOT NULL REFERENCES public.empresas(id)`. Todas las restricciones `UNIQUE` son compuestas por empresa: `(empresa_id, codigo)`, `(empresa_id, numero)`, `(empresa_id, ncf)`.
2. **RLS en el 100% de las tablas `public`:**
   - `anon` no lee ni escribe nada.
   - `authenticated` solo tiene `SELECT` filtrado por `public.rol_en_empresa(empresa_id) IS NOT NULL`.
   - **Cero escrituras directas (`INSERT`/`UPDATE`/`DELETE` revocados a `authenticated`).** Toda escritura pasa por RPCs `security definer` con `SET search_path = ''` que verifican `public.rol_en_empresa(p_empresa_id)`.
3. **Nunca exponer empresas sin sesión:** Jamás crear endpoints públicos que listen empresas o usuarios.
4. **Auth sin envío automático de correos:** Los usuarios iniciales se pre-aprovisionan sin enviar emails; entran con Google OAuth o correo/contraseña y si `debe_definir_password = true`, definen su clave en su primer ingreso.
5. **Supabase CLI aislada:** Usar siempre `pnpm supabase ...` (`scripts/supabase-cli.mjs`), que carga `SUPABASE_ACCESS_TOKEN` desde `.env.local` **sin tocar ni cerrar la cuenta global de Supabase del PC**.

---

## 4. Invariantes contables y DGII (República Dominicana)

* **Partida doble en SQL:** Todo documento contabilizado genera su asiento (`asientos` + `asiento_lineas`) en la misma transacción. Un trigger diferido garantiza `SUM(debito) = SUM(credito)` y mínimo 2 líneas.
* **Cero borrados físicos contables:** Los asientos y documentos contabilizados **nunca** se eliminan con `DELETE`; se anulan mediante `anular_documento` creando un asiento de reverso.
* **Precisión numérica:** Dinero en `NUMERIC(14,2)` (o centavos `BIGINT` consistentes); cantidades de inventario en `NUMERIC(18,4)` — **jamás `REAL` ni `FLOAT`**.
* **RNC normalizado:** Se limpia de guiones y espacios (`rnc_normalizado`) antes de validar unicidad o consultar la DGII.
* **Comprobantes DGII:** Soportar tanto serie `B` (`B01`–`B17`) como serie electrónica `E` (`E31`–`E47`) con numeración atómica (`FOR UPDATE`) por empresa.
* **Zona horaria:** Todas las fechas contables usan `America/Santo_Domingo` (`yyyy-MM-dd`).

---

## 5. Reglas de UI y Diseño

Ver [docs/DESIGN.md](docs/DESIGN.md) como fuente de verdad. Reglas mínimas obligatorias:
* Identidad de **Nexo Contable**: verde bosque `#176b53`, hover `#104d3d`, menta `#e8f4ee`, lienzo `#f6f7f5`, `Manrope` + `DM Sans`, montos con `tabular-nums` alineados a la derecha.
* **Prohibido `<input type="date">`, `<input type="month">` y `<select>` nativos** fuera de `src/components/ui/`. Usar siempre `DatePicker`, `DateRangePicker`, `MonthPicker` y `SelectCampo`.
* **Botones y toolbars uniformes:** Todos los botones en `BarraLista` / `EncabezadoPagina` deben tener altura consistente y `whitespace-nowrap` (jamás botones partidos en 3–4 líneas).
* **Selector Multi-Empresa:** Popover **"Mis empresas"** estilo Alegra en el topbar (buscador, `Principal`, check verde, `+ Agregar empresa`, paginación, `Gestionar empresas`).
* **Base UI (`@base-ui/react`):** Usar la prop `render` en triggers (NO `asChild` de Radix).

---

## 6. Candados automáticos (Locks)

Cada corrección de UI, seguridad o contabilidad se convierte en un candado automático:
* `src/lib/__tests__/datos-privados.test.ts` — Bloquea cualquier `.sqlite`, `.env` o credencial rastreada por git.
* `src/lib/__tests__/migraciones.test.ts` — Valida nombres `YYYYMMDDHHMMSS_nombre.sql`, sin duplicados ni archivos vacíos.
* `src/lib/__tests__/rpc-sin-extraer.test.ts` — Exige `supabase.rpc("nombre", ...)` inline.
* `src/lib/__tests__/paginacion.test.ts` — Evita truncamiento silencioso de PostgREST > 1,000 filas.
* `src/lib/__tests__/fechas-nativas.test.ts` *(Ola 2)* — Prohíbe `<input type="date">` y `<input type="month">`.
* `src/lib/__tests__/selects-nativos.test.ts` *(Ola 2)* — Prohíbe `<select>` nativos fuera de `src/components/ui/`.
* `src/lib/__tests__/tablas-listas.test.ts` *(Ola 2)* — Exige `TablaLista` y encabezados uniformes.

---

## 7. Skills disponibles (`.opencode/skills/`)

Lee siempre el skill pertinente antes de editar su área:
* `supabase-migraciones` · `motor-contable` · `diseno-ui` · `biome` · `probar-cambios` · `flujo-git` · `localhost` · `pedir-ayuda`.

---

## 8. Lista de "NUNCA"

* Nunca usar `any`, `@ts-ignore`, `!` (non-null assertion) ni `console.log` en código de app.
* Nunca usar `git commit --no-verify` ni `git push --force`.
* Nunca usar `SUPABASE_SERVICE_ROLE_KEY` dentro de `src/app/` o `src/components/`.
* Nunca editar una migración ya aplicada; crear siempre una migración nueva aditiva.
* Nunca hacer `supabase logout` en esta PC (usar siempre `pnpm supabase ...` con `.env.local`).
