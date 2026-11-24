---
name: probar-cambios
description: Secuencia obligatoria de verificación antes de reportar una tarea como completada.
---

# Skill: Probar Cambios

Antes de terminar cualquier tarea:
1. Ejecuta `pnpm typecheck` (cero errores de TypeScript).
2. Ejecuta `pnpm check` (cero errores de Biome).
3. Ejecuta `pnpm test` (todos los tests Vitest y candados en verde).
4. Si modificaste configuración de Next.js, rutas de servidor o layouts raíz, valida además con `pnpm build`.
5. Jamás omitas hooks con `--no-verify`.
