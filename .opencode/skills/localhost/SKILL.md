---
name: localhost
description: Reglas para servidores locales y pruebas visuales sin ensuciar producción.
---

# Skill: Localhost y Entorno

1. No levantes servidores dev en segundo plano ni ejecutes capturas visuales a menos que tu asignación lo pida explícitamente.
2. Nunca cierres la sesión global de Supabase CLI del usuario (`supabase logout` prohibido); usa siempre `pnpm supabase ...` (`scripts/supabase-cli.mjs`) con `.env.local`.
3. Nunca escribas datos de prueba en la base de producción; usa tests unitarios, transacciones con `ROLLBACK` o pruebas pgTAP locales.
