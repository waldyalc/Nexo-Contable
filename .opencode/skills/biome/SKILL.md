---
name: biome
description: Reglas de calidad, formateo estricto con Biome y filosofía de candados automáticos.
---

# Skill: Biome y Candados

1. Corre `pnpm check` antes de entregar cualquier cambio (y `pnpm check:fix` para auto-formatear).
2. Reglas activas: prohibido `any`, prohibido `!` (non-null assertion), prohibido `@ts-ignore`, prohibido `console.log` en código de app (solo `console.warn`/`console.error` cuando proceda).
3. **Cada corrección repetible se convierte en candado:** si encuentras un antipatrón (input de fecha nativo, select nativo, `supabase.rpc` extraído en variable, archivo privado rastreado), agrega o actualiza el test en `src/lib/__tests__/` con un mensaje que indique cómo corregirlo.
