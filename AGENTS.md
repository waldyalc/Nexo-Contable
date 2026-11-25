# AGENTS.md — Ley operativa de Nexo Contable

Sistema de **contabilidad multi-empresa en línea** para firmas contables en **República Dominicana (DGII / NCF serie `B01`–`B17` / e-CF serie `E31`–`E47` / 606 / 607)**. Dueño: Waldy Alcántara.

> **Regla #1 — Repositorio público:** Este repo (`waldyalc/Nexo-Contable`) es **PÚBLICO**. Jamás subir `.env*`, tokens, llaves privadas, correos reales de clientes, nombres reales de empresas clientes ni archivos `work/*.sqlite*`. El candado `src/lib/__tests__/datos-privados.test.ts` bloquea cualquier intento.

- **Repositorio:** `waldyalc/Nexo-Contable`. **`main` es la única rama de larga vida.**
- **Base de datos:** Supabase, proyecto **Nexo Contable** (`SUPABASE_PROJECT_REF` en `.env.local`, PostgreSQL 17). **Única fuente de la verdad.** Aislamiento multi-empresa con RLS estricto y `public.rol_en_empresa(empresa_id)`.
- **Stack oficial:** Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript `strict` (`noUncheckedIndexedAccess`), Tailwind 4 CSS-first, shadcn (`base-nova` sobre `@base-ui/react`, **NO Radix**), `@tabler/icons-react`, `date-fns` (`es`, `America/Santo_Domingo`), `react-day-picker`, `@tanstack/react-table`, `recharts`, `exceljs`, `zod`, Biome, Vitest, pgTAP y Playwright.
- **Identidad visual:** `docs/DESIGN.md` es la ley — verde bosque `#176b53`, hover `#104d3d`, menta `#e8f4ee`, lienzo `#f6f7f5`, `Manrope` + `DM Sans`, montos con `tabular-nums` alineados a la derecha (`RD$` / `US$`), selector multi-empresa **"Mis empresas"** y menú de perfil en el topbar.

---

## 1. Rol según cómo fuiste invocado

**Lee esto primero. Orquestador y subagente nunca se confunden.**

### Sesión principal (Orquestador / Tech Lead)

Si estás hablando **directamente con Waldy en el hilo principal de T3 Code**, eres el **Orquestador**:

- Analizas el pedido, diseñas el plan y lo divides en tareas con **archivos disjuntos** (dos subagentes nunca escriben el mismo archivo).
- Delegas con `delegate_task` e `isolation: "worktree"`. **Modelo único por defecto:** **DeepSeek V4.1 Flash** (`providerInstanceId: "opencode"`, `model: "opencode-go/deepseek-v4.1-flash"`, `options: { variant: "max" }`); usa otro solo si Waldy lo pide o para un subagente revisor independiente.
- **Cuota agotada:** si un hijo devuelve error de cuota diaria agotada, avisa a Waldy de inmediato y espera su decisión; no lo relances en otro modelo sin preguntar.
- Revisas el diff real, corres verificación completa (`pnpm typecheck && pnpm check && pnpm test && pnpm build`, y `pnpm test:pgtap` si hubo SQL), integras a `main`, reinicias el preview oficial (`nexo-contable-preview.service`) y muestras las capturas reales a Waldy.
- **Nunca tomas capturas de pantalla tú mismo ni delegas agentes de verificación visual** (regla de Waldy, 25-11-2026): si un agente hizo algo, él mismo corre el script de capturas y las incluye en su reporte. Tú las revisas con `read_file` y se las presentas a Waldy.
- **Solo tú lees `docs/ORQUESTADOR.md`**: es tu playbook obligatorio.
- Waldy aprueba lo irreversible: deploy a producción, migraciones que borran o alteran datos, borrar datos y planes pagos.

### Subagente / tarea delegada (Ejecutor o Revisor)

Si llegaste por un brief de `delegate_task`, eres **Ejecutor** (o Revisor), no el orquestador:

- **Prueba visual SIEMPRE (regla de Waldy):** si tocaste UI o diseño, tu reporte incluye **capturas de pantalla del resultado funcionando** con Playwright (`pnpm captura`). Si tu tarea es backend/motor/scripts, la evidencia son los tests (`pnpm test`, `pnpm test:pgtap`). Sin evidencia, la tarea no está terminada.
- **No leas `docs/ORQUESTADOR.md`** ni asumas el rol de orquestador.
- Ejecuta el brief **tú mismo** en tu worktree: código, tests y docs de tu tarea.
- Verifica en local con `pnpm typecheck && pnpm check && pnpm test` (y `pnpm build` / `pnpm test:pgtap` según corresponda).
- Haz commits claros en español en tu rama y **nunca hagas `git push` ni merge a `main`** salvo orden explícita del brief.
- **Nunca lances subagentes** ni apliques migraciones al Supabase remoto.
- Reporta al Orquestador: rama, SHA, archivos cambiados, verificación y bloqueos.

---

## 2. Antes de empezar e ir rápido

- Lee `AGENTS.md`, `HANDOFF.md` y solo los archivos/skills que pida el brief.
- Carga la skill aplicable en `.opencode/skills/<nombre>/SKILL.md`:
  - `supabase-migraciones` · `motor-contable` · `diseno-ui` · `biome` · `probar-cambios` · `flujo-git` · `localhost` · `pedir-ayuda`.
- No explores el repo ni `node_modules` por curiosidad; copia un patrón real existente del repo.
- Si te atascas, usa la skill `pedir-ayuda`: reporta el bloqueo sin improvisar atajos.

---

## 3. Reglas de arquitectura Multi-Empresa (inviolables)

1. **Aislamiento total por `empresa_id`:** Toda tabla de negocio lleva `empresa_id uuid NOT NULL REFERENCES public.empresas(id)`. Toda restricción `UNIQUE` es compuesta por empresa: `(empresa_id, codigo)`, `(empresa_id, numero)`, `(empresa_id, ncf)`.
2. **RLS en el 100% de las tablas `public`:**
   - `anon` no lee ni escribe nada.
   - `authenticated` solo tiene `SELECT` filtrado por `public.rol_en_empresa(empresa_id) IS NOT NULL`.
   - **Cero escrituras directas (`INSERT`/`UPDATE`/`DELETE` revocados a `authenticated`).** Toda escritura pasa por RPCs `security definer` con `SET search_path = ''` que verifican `public.exigir_rol_empresa(p_empresa_id, ...)`.
3. **Reportes `STABLE SECURITY INVOKER`:** Los reportes contables incluyen `estado IN ('posted', 'reversed', 'reversal')` para que los reversos neteen exactamente a `0.00` y conserven pista completa de auditoría.
4. **Auth sin envío automático de correos:** Sin registro público (`disable_signup = true`). Cuentas pre-aprovisionadas entran con Google OAuth o correo/contraseña y, si `debe_definir_password = true`, definen su clave personal (mínimo 12 caracteres) en `/definir-password`.
5. **Supabase CLI aislada:** Usar siempre `pnpm supabase ...` (`scripts/supabase-cli.mjs`), que lee `SUPABASE_ACCESS_TOKEN` desde `.env.local` **sin tocar ni cerrar la cuenta global de Supabase del VPS/PC**. Jamás ejecutar `supabase logout`.

---

## 4. Invariantes contables y DGII (República Dominicana)

- **Partida doble en SQL:** Todo documento contabilizado genera su asiento (`asientos` + `asiento_lineas`) en la misma transacción. Un trigger diferido (`DEFERRABLE INITIALLY DEFERRED`) garantiza `SUM(debito) = SUM(credito)` y mínimo 2 líneas.
- **Cero borrados físicos contables:** Los asientos y documentos contabilizados **nunca** se eliminan con `DELETE`; se anulan mediante `anular_documento` / `revertir_asiento` creando un asiento `reversal`.
- **Precisión numérica:** Dinero en `NUMERIC(14,2)`; cantidades de inventario en `NUMERIC(18,4)` — **jamás `REAL` ni `FLOAT`**. En scripts de migración desde centavos usar `BigInt` (`centavosADecimal`).
- **RNC normalizado:** Se limpia de guiones y espacios (`rnc_normalizado`) antes de validar unicidad o consultar la DGII (`/api/dgii/rnc`).
- **Comprobantes DGII:** Soportar serie `B` (`B01`–`B17`, 11 chars) y serie electrónica `E` (`E31`–`E47`, 13 chars) con numeración atómica (`FOR UPDATE`) por empresa. Los exportadores 606/607 generan Excel con hoja **Incluidos** + hoja **Excluidos** (con motivo) y TXT oficial DGII.
- **Zona horaria:** Todas las fechas contables usan `America/Santo_Domingo` (`yyyy-MM-dd`).

---

## 5. Reglas de UI, Navegación y Rendimiento

Ver `docs/DESIGN.md` como fuente de verdad:
- **Paleta Nexo:** `#176b53`, `#104d3d`, `#e8f4ee`, `#f6f7f5`, `Manrope` + `DM Sans`, montos `tabular-nums` alineados a la derecha.
- **Base UI (`@base-ui/react`), NO Radix:** Usar siempre la prop `render` en triggers (JAMÁS `asChild`).
- **Prohibidos controles nativos:** Nunca `<input type="date">`, `<input type="month">` ni `<select>` fuera de `src/components/ui/`. Usar `MonthPicker`, `DatePicker`, `DateRangePicker` y `SelectCampo`.
- **Botones y toolbars uniformes:** Altura `h-9` y `whitespace-nowrap shrink-0` (jamás botones partidos en varias líneas). Máximo 1 botón primario por vista; `Extraer 607` nunca va en Gastos y compras.
- **Navegación oficial:**
  - Sidebar limpia con `GENERAL` (Resumen), `OPERACIONES` (Banco, Inventario, Contabilidad, CxC, CxP, Facturación, Gastos y compras, Impuestos, Activos fijos, Finanzas, Recursos humanos, Documentos) y `SISTEMA` (**Configuración** `/configuracion`), sin bloque repetido del usuario al pie.
  - Topbar con **Popover "Mis empresas"** estilo Alegra + **Menú de perfil (`UserMenu`)** arriba a la derecha (Configuración, Empresas, Usuarios, Auditoría, Mi perfil y seguridad, Cerrar sesión).
- **Rendimiento obligatorio (túnel Tailscale + SSR dinámico):**
  - `obtenerContextoApp()` siempre memorizado con `React.cache()`, validación JWT local con `getClaims()` y lecturas en paralelo (`Promise.all`).
  - Usar `prefetch={false}` en los `<Link>` de menús/hubs hacia rutas dinámicas para evitar tormentas de SSR simultáneos.
  - Mantener `src/app/(app)/loading.tsx` activo para respuesta instantánea al cambiar de módulo.

---

## 6. Comandos verificados (copy-paste)

| Para… | Comando |
| --- | --- |
| Instalar dependencias | `pnpm install` |
| Desarrollo local | `pnpm dev` |
| Tipos estrictos | `pnpm typecheck` |
| Formato + lint + imports | `pnpm check` (`pnpm check:fix` para arreglar) |
| Tests unitarios + candados | `pnpm test` |
| Tests SQL / RLS pgTAP local (sin Docker) | `pnpm test:pgtap` (`scripts/pgtap-local.sh`, Postgres local desechable) |
| Pruebas E2E Playwright | `E2E_BASE_URL=http://127.0.0.1:3020 pnpm test:e2e` |
| Build producción | `pnpm build` |
| Capturas de una ruta (desktop + móvil) | `pnpm captura --ruta /gastos --base http://127.0.0.1:3020` |
| Capturas de todas las rutas (batch) | `pnpm exec tsx scripts/captura-todas.ts --base http://127.0.0.1:3020` |
| Supabase CLI aislada | `pnpm supabase <comando>` |
| Migrar SQLite local → Supabase | `pnpm exec tsx scripts/migrar-nexo-sqlite.ts --sqlite work/nexo-contable.sqlite --usuarios work/usuarios-iniciales.json [--dry-run]` |
| Verificar cuadre contable | `pnpm exec tsx scripts/verificar-cuadre.ts --salida work/reporte-cuadre.md` |

---

## 7. Preview oficial en el VPS y capturas al terminar

- **Enlace oficial Tailscale:** `NEXT_PUBLIC_APP_URL` en `.env.local` (puerto `3020`, tailnet only, no expuesto a internet público).
- **Servicio systemd:** `nexo-contable-preview.service` (`pnpm start --port 3020 --hostname 127.0.0.1` en `/root/NEXO-CONTABLE`).
- **Nunca** mates otros servicios del VPS en puertos ajenos a `3020`. Para actualizar el preview de Nexo tras integrar en `main`: `pnpm build && systemctl restart nexo-contable-preview.service`.
- **Capturas obligatorias:** Usar `pnpm captura` (`scripts/captura.ts`) o `scripts/captura-todas.ts`. Credenciales QA en `.env.pruebas` (ignorado por git, `chmod 600`) y sesión guardada en `~/.nexo-contable/storage-qa.json` (fuera del repo). El script **falla con exit 1** ante cualquier `console.error`, `pageerror` o HTTP `>= 500`. Las capturas se guardan en `.capturas/` (ignorado por git) y se embeben en la respuesta a Waldy.

---

## 8. Candados automáticos (Locks)

> **Regla de oro:** cada vez que Waldy corrija algo repetible, no lo apuntes solo en este archivo: conviértelo en un **test** (Vitest, pgTAP o Playwright) y agrégalo abajo.

Candados activos:
- `src/lib/__tests__/datos-privados.test.ts` — Bloquea `.env*`, `.sqlite`, `.db`, `.pem`, `.key`, `work/` y `backups/` rastreados por git.
- `src/lib/__tests__/migraciones.test.ts` — Exige `YYYYMMDDHHMMSS_snake_case.sql`, sin duplicados ni archivos vacíos.
- `src/lib/__tests__/rpc-sin-extraer.test.ts` — Exige `supabase.rpc("nombre", ...)` inline (evita romper `this`).
- `src/lib/__tests__/paginacion.test.ts` — Evita truncamiento silencioso de PostgREST > 1,000 filas (exige `.range()`, `.limit()`, `.single()`, `.maybeSingle()`, `head: true` o `paginarConsulta`).
- `src/lib/__tests__/fechas-nativas.test.ts` — Prohíbe `<input type="date">` y `<input type="month">` fuera de `src/components/ui/`.
- `src/lib/__tests__/selects-nativos.test.ts` — Prohíbe `<select>` nativos fuera de `src/components/ui/`.
- `src/lib/__tests__/tablas-listas.test.ts` — Exige `whitespace-nowrap` en `Button`/`BarraLista`, encabezados `h-12` en `TablaLista` y prohíbe `asChild` de Radix.
- `supabase/tests/01..05_*_test.sql` — 188 aserciones pgTAP (aislamiento multi-empresa, partida doble, NCF/e-CF, inventario `NUMERIC(18,4)`, bancos, reportes, `admin_global` y neteo de reversos).
- `tests/e2e/smoke.spec.ts` y `tests/e2e/ui-controles.spec.ts` — Verifican login sin registro público, 0 errores en todas las rutas, Popover "Mis empresas", 0 controles nativos en DOM, ausencia de `Extraer 607` en Gastos y 0 overflow móvil.

---

## 9. Lista de "NUNCA"

- Nunca usar `any`, `@ts-ignore`, `!` (non-null assertion) ni `console.log` en código de app o scripts Biome-verificados (usar `process.stdout.write` / `console.error` en scripts CLI).
- Nunca usar `git commit --no-verify` ni `git push --force`.
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` dentro de `src/app/` o `src/components/`.
- Nunca editar una migración ya aplicada; crear siempre una migración nueva aditiva.
- Nunca ejecutar `supabase logout` en el VPS/PC.
- Nunca subir datos reales de clientes, correos reales ni bases `.sqlite` al repositorio público.
