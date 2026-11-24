# Nexo Contable

Sistema de contabilidad **multi-empresa** para República Dominicana construido con **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4**, **shadcn (Base UI)** y **Supabase** (Auth Email + Google OAuth, PostgreSQL + RLS multi-empresa, RPCs transaccionales y Storage).

## Inicio rápido

1. Copia `.env.example` a `.env.local` y completa tus credenciales de Supabase.
2. Instala dependencias:
   ```bash
   pnpm install
   ```
3. Ejecuta el servidor de desarrollo:
   ```bash
   pnpm dev
   ```
4. Verificación de calidad:
   ```bash
   pnpm typecheck && pnpm check && pnpm test
   ```

## Documentación clave

* [AGENTS.md](AGENTS.md) — Reglas operativas, arquitectura y candados.
* [supabase/AGENTS.md](supabase/AGENTS.md) — Disciplina de migraciones, RLS y pgTAP.
* [docs/DESIGN.md](docs/DESIGN.md) — Sistema de diseño (paleta verde Nexo, `MonthPicker`/`DatePicker`, Popover "Mis empresas").
* [docs/contrato-db.md](docs/contrato-db.md) y [docs/motor-contable.md](docs/motor-contable.md).
