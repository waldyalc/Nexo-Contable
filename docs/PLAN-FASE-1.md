# Plan de Fase 1 — Nexo Contable en Línea (Supabase + shadcn)

## Objetivo de Fase 1
Poner **Nexo Contable** en línea sobre **Supabase** (Auth Email + Google OAuth, PostgreSQL + RLS Multi-Empresa, RPCs `security definer` transaccionales y Storage privado) con la UI reconstruida en **shadcn (Base UI)**, preservando la identidad verde de Nexo (`#176b53` / `#e8f4ee`), arreglando los calendarios/toolbars y agregando el selector multi-empresa estilo Alegra ("Mis empresas").

*(Los módulos adicionales tipo Alegra — recurrentes, 608/IT-1/IR-17, búsqueda global Cmd+K, nómina RD avanzada — quedan para Fase 2).*

## Olas de Subagentes (DeepSeek V4.1 Flash en worktrees aislados)

* **Ola 1 — Backend Supabase y Motor Contable:**
  1. `db-nucleo-contable` (`feat/db-nucleo-contable`): `perfiles` (con `debe_definir_password`), `empresas` (RNC normalizado), `empresa_usuarios`, `rol_en_empresa()`, RLS multi-empresa, `cuentas`, `periodos_contables`, `asientos`/`asiento_lineas` (motor contable SQL + trigger diferido de cuadre + `anular_documento`), `terceros`, `auditoria` + tests pgTAP.
  2. `db-operaciones` (`feat/db-operaciones`): `documentos_financieros`, `documento_pagos`, `metodos_pago`, `secuencias_ncf` (series `B01`–`B17` y `E31`–`E47`), `cuentas_bancarias`, `movimientos_bancarios`, `importaciones_bancarias`, `sesiones_conciliacion_bancaria`, `articulos_inventario`, `movimientos_inventario` (`NUMERIC(18,4)`), `activos_fijos`, `depreciaciones_activos`, `empleados`, `corridas_nomina`, `documentos_almacenados` + bucket Storage `documentos` + RPCs de reportes/dashboards + tests pgTAP.
* **Ola 2 — Auth (Google + Contraseña en primer ingreso), Shell Multi-Empresa y UI Kit:**
  3. `ui-auth-shell` (`feat/ui-auth-shell`): Login Nexo + botón "Continuar con Google" + `/auth/callback` + modal/vista de definir contraseña en primer ingreso (`debe_definir_password`), `src/proxy.ts`, layout verde Nexo, sidebar por roles, Popover **"Mis empresas"** estilo Alegra, vistas de Empresas y Usuarios.
  4. `ui-design-system` (`feat/ui-design-system`): Kit shadcn Base UI con tokens Nexo: `MonthPicker` propio, `DatePicker`, `DateRangePicker`, `EncabezadoPagina`, `TarjetaLista`, `BarraLista`, `TablaLista<T>`, `PillEstado`, `FormCard`/`FormGrid` + candados (`fechas-nativas`, `selects-nativos`, `tablas-listas`, `diseno-paginas`).
* **Ola 3 — Módulos Actuales de Nexo (en paralelo):**
  5. `mod-contabilidad-reportes` (`feat/mod-contabilidad-reportes`): Resumen/Dashboard firma y empresa, Contabilidad (catálogo 347 cuentas, CSV, balances iniciales, diario, mayor, balanza, periodos) y Finanzas/Estados financieros.
  6. `mod-operaciones-dgii` (`feat/mod-operaciones-dgii`): Gastos y compras (toolbar corregida, sin Extraer 607), Facturación, CxC/CxP, notas de crédito, pagos, terceros + buscador defensivo RNC DGII, carga masiva 606/607 e Impuestos (secuencias B/E-CF, reglas, obligaciones y exportación 606/607 Excel/TXT con hoja de excluidos).
  7. `mod-bancos-inv-comp` (`feat/mod-bancos-inv-comp`): Bancos + importación CSV + conciliación con sesiones, Inventario + carga masiva + kardex, Activos fijos/depreciación, Recursos humanos/Nómina, Documentos (Storage) y Auditoría.
* **Ola 4 — Migración SQLite → Supabase y QA Integral:**
  8. `scripts-migracion` (`feat/scripts-migracion-sqlite`): `scripts/migrar-sqlite-a-supabase.ts` + `scripts/verificar-cuadre.ts` + `docs/pruebas/cuadre.sql`.
  9. `qa-e2e-visual` (`feat/qa-e2e-capturas`): `scripts/captura.ts` (Playwright desktop/móvil sin console errors ni 5xx) + specs E2E clave.
