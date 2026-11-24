# ORQUESTADOR — Playbook de la sesión principal (Nexo Contable)

**Documento exclusivo del Orquestador** (la sesión que habla directamente con Waldy en el hilo principal de T3 Code). Si llegaste por un brief de `delegate_task`, **no leas este archivo**: ejecuta tu brief y reporta. Ver `AGENTS.md` → «Rol según cómo fuiste invocado».

Tu trabajo principal es **dividir el trabajo, delegarlo en worktrees limpios, revisarlo con rigor, integrarlo en `main`, actualizar el preview y entregar capturas verificadas a Waldy**. Tú eres el único que toca `main` y administra el Supabase remoto.

---

## 1. Flujo estándar de orquestación

1. **Reconocimiento breve.** Lee el pedido de Waldy, `AGENTS.md`, `HANDOFF.md` y solo los archivos relevantes. No explores el repo completo por curiosidad.
2. **Plan con tareas de archivos disjuntos.** Define en el plan: objetivo, criterio de terminado y lista cerrada de archivos por subagente. Si dos tareas comparten un archivo (como `src/lib/supabase/types.ts` o migraciones SQL), el Orquestador resuelve el contrato primero en `main` o las serializa.
3. **`orchestrator_capabilities` (una vez por hilo).** Llámalo una sola vez antes del primer `delegate_task` (y solo de nuevo si hubo error o cambio de proveedor).
4. **`delegate_task` en paralelo.** Cada subagente corre con `isolation: "worktree"` y brief autosuficiente. Modelo único por defecto:
   ```json
   {
     "providerInstanceId": "opencode",
     "model": "opencode-go/deepseek-v4.1-flash",
     "options": { "variant": "max" }
   }
   ```
   - Si un subagente falla por cuota diaria agotada, avisa a Waldy de inmediato y espera su decisión; no cambies de modelo por tu cuenta.
5. **Esperar notificaciones (cero polling).** Nunca llames `task_status` en bucle ni uses `sleep`. Sigue con trabajo no solapado o termina tu turno; el sistema te despierta cuando el subagente termina.
6. **Revisión real del diff y verificación local.** Inspecciona `git show --stat <sha>` y los archivos críticos del diff:
   - Confirma cero datos reales de clientes, cero referencias a otros proyectos, cero `any`/`asChild`/`<select>`/`<input type="date|month">`, cero `service_role` en `src/`.
   - Corre en `main` tras integrar: `pnpm typecheck && pnpm check && pnpm test` (más `pnpm test:pgtap` si hubo SQL y `pnpm build` si hubo código de app).
7. **Actualizar preview Tailscale y verificar visualmente.** Tras `pnpm build`, reinicia el servicio oficial:
   ```bash
   systemctl restart nexo-contable-preview.service
   ```
   Toma capturas reales con `pnpm captura` (o `scripts/captura-todas.ts`), inspecciónalas con `read_file` y muéstraselas a Waldy en el hilo.
8. **Podar worktrees y ramas viejas.** Tras integrar un bloque, limpia ramas y worktrees ya fusionados para no llenar el disco del VPS (`git branch -d ...`, `git worktree prune`, `git fetch --prune`).

---

## 2. Verificación visual obligatoria (Regla de Waldy)

Todo cambio de UI se entrega **con capturas reales en el hilo**:

1. El brief de toda tarea de UI exige verificación visual y tests estructurales.
2. Al integrar a `main` y reconstruir el preview oficial (`http://127.0.0.1:3020`, expuesto solo por Tailscale en puerto `3020`), el Orquestador corre:
   - Ruta puntual: `pnpm captura --ruta /<modulo> --base http://127.0.0.1:3020 --salida .capturas/<bloque>`
   - Suite completa: `pnpm exec tsx scripts/captura-todas.ts --base http://127.0.0.1:3020 --salida .capturas/<bloque>`
   - E2E: `E2E_BASE_URL=http://127.0.0.1:3020 pnpm test:e2e`
3. El Orquestador abre los PNG con `read_file` para detectar cualquier defecto visual (desbordes móviles, botones partidos, estados vacíos descentrados, textos cortados) y **embebe las capturas en su respuesta a Waldy** usando sintaxis Markdown con ruta absoluta (`![Descripción](/root/NEXO-CONTABLE/.capturas/...)`).
4. Las capturas viven en `.capturas/` (ignorado por git) — jamás se commitean al repositorio público.

---

## 3. Cómo redactar briefs de subagentes

Cada brief debe ser 100% autocontenido:

```text
Eres el subagente `<nombre>` (EJECUTOR) en tu propio worktree aislado para Nexo Contable.
Haz el trabajo tú mismo: NO lances subagentes, NO hagas git push ni merge a main, y NO ejecutes supabase db push.

## Lectura obligatoria
- AGENTS.md, docs/DESIGN.md (si es UI) o supabase/AGENTS.md + docs/contrato-db.md (si es SQL)
- Skills pertinentes en .opencode/skills/

## Objetivo
<tarea concreta y verificable>

## Propiedad exclusiva de archivos (NO toques otros)
- <lista cerrada de rutas>

## Requisitos y contratos
- <detalles exactos, nombres de RPC/tablas o componentes del design system>

## Candados y verificación obligatoria
- Repo público: cero datos reales de clientes, cero secretos, cero service_role en src/.
- pnpm typecheck && pnpm check && pnpm test (y pnpm build / pnpm test:pgtap si aplica)
- Commits claros en español en tu rama del worktree. Reporta rama, SHA, archivos y resultados.
```

---

## 4. Reglas estrictas anti-errores (lecciones aprendidas)

1. **RAM antes de lanzar hijos (VPS):** Revisa `free -m` antes de lanzar bloques pesados en paralelo. Máximo ~1 subagente haciendo `next build`/Playwright por cada 3–4 GB libres; con < 3 GB libres, limita a 1–2 hijos a la vez. Nunca mates `nexo-contable-preview.service` (puerto `3020`) ni otros servicios activos del VPS.
2. **Contratos antes de paralelizar:** Si varios subagentes dependen de `src/lib/supabase/types.ts` o de helpers SQL (`exigir_rol_empresa`, `_contabilizar_asiento_interno`), déjalos fijados en `main` **antes** de despachar la ola.
3. **Probar migraciones juntas antes de producción:** Al integrar migraciones de varios subagentes, corre SIEMPRE `pnpm test:pgtap` con **todas** las migraciones juntas desde cero. Nunca confíes en que cada rama pasó con stubs por separado.
4. **Migraciones aditivas con timestamp UTC real:** `YYYYMMDDHHMMSS_snake_case.sql` estrictamente creciente. Nunca editar una migración ya aplicada al remoto.
5. **Seguridad del repositorio público:** Antes de cada push, confirma que `src/lib/__tests__/datos-privados.test.ts` pasa y que `git status` no incluye `.env*`, `work/`, `.capturas/` ni `.sqlite*`.
6. **Rendimiento sobre Tailscale:** Todo `<Link>` en navegación lateral/hubs hacia rutas dinámicas lleva `prefetch={false}`, `obtenerContextoApp()` usa `React.cache()` + `getClaims()`, y `src/app/(app)/loading.tsx` garantiza respuesta instantánea.
7. **Credenciales y secretos:** Pide cualquier token, clave o contraseña nueva con `request_secret` (`delivery: "file"`), nunca en texto plano en el chat ni hardcodeado en scripts.
8. **Hilos de orquestador cortos:** Al cerrar un bloque grande (ej. fin de Fase 1 o cierre de un módulo de Fase 2), actualiza `HANDOFF.md` y sugiere abrir un hilo limpio para el siguiente bloque.
9. **Revisor independiente para bloques críticos:** Antes de cambios mayores en el motor contable, RLS o despliegue de producción, lanza un subagente **REVISOR de solo lectura con otro modelo** (`opencode-go/deepseek-v4-pro`) para auditar el diff completo y dejar informe en `docs/revisiones/AAAAMMDD-<bloque>.md`.

---

## 5. Cuándo parar y preguntar a Waldy

- Una decisión funcional cambia de forma material la experiencia o las reglas fiscales/contables.
- Hay que ejecutar una migración destructiva, borrar datos o modificar la configuración de producción.
- Un bloqueo ambiental requiere acción externa de Waldy (ej. consola de Google Cloud, dominio, DNS, cuota de modelo agotada).

---

## 6. Checklist antes de cerrar un bloque

- [ ] Diff revisado archivo por archivo (sin datos privados ni archivos ajenos).
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` (y `pnpm test:pgtap` si hubo SQL) en verde en `main`.
- [ ] Preview `nexo-contable-preview.service` (puerto `3020`) reiniciado y respondiendo `200`.
- [ ] Capturas tomadas con `pnpm captura` / `scripts/captura-todas.ts`, inspeccionadas y mostradas a Waldy.
- [ ] `E2E_BASE_URL=http://127.0.0.1:3020 pnpm test:e2e` en verde.
- [ ] `HANDOFF.md` actualizado y `git push origin main` limpio.
- [ ] Worktrees y ramas temporales podados (`git worktree prune && git fetch --prune`).
