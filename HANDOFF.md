# HANDOFF.md — Estado actual de Nexo Contable

Última actualización: **2026-11-25** · Rama: `main` · Fase completada: **Fase 1 (100%) + Modernización UX/exportaciones (onda completa)**.

---

## 1. Qué está terminado y funcionando en vivo

- **Repositorio público:** `https://github.com/waldyalc/Nexo-Contable` (rama `main`, 0 secretos ni datos privados rastreados).
- **Preview oficial (Tailscale only):** URL configurada en `NEXT_PUBLIC_APP_URL` dentro de `.env.local` (puerto `3020`).
  - Servicio systemd: `nexo-contable-preview.service` (`pnpm start --port 3020 --hostname 127.0.0.1`).
  - Proxy Tailscale Serve: `tailscale serve --bg --https=3020 http://127.0.0.1:3020`.
- **Base de datos Supabase remoto:** Proyecto **Nexo Contable** (`SUPABASE_PROJECT_REF` en `.env.local`, PostgreSQL 17).
  - **7 migraciones aplicadas** (`20261124220000` hasta `20261124230500`): núcleo multi-empresa, motor contable SQL con partida doble diferida, documentos fiscales/pagos, NCF serie `B01`–`B17` + e-CF serie `E31`–`E47`, bancos/conciliación, inventario `NUMERIC(18,4)` con costo promedio exacto, activos fijos, nómina, Storage privado `documentos` y 10 reportes (`STABLE SECURITY INVOKER`).
  - **Migración inicial SQLite → Supabase completada y verificada:** ejecutada con `scripts/migrar-nexo-sqlite.ts` (usuarios pre-aprovisionados sin envío automático de correos) y auditada con `scripts/verificar-cuadre.ts` con **partida doble cuadrada al centavo (`Débitos == Créditos`, 0 descuadres)**.
- **UI completa en Next.js 16 + shadcn Base UI (paleta verde Nexo):**
  - Auth split-screen + botón **"Continuar con Google"** + `/auth/callback` + `/definir-password` (mínimo 12 caracteres, sin registro público).
  - Topbar con **Popover "Mis empresas"** estilo Alegra + **Menú de perfil (`UserMenu`)** arriba a la derecha (Configuración, Empresas, Usuarios, Auditoría, Mi perfil y seguridad, Cerrar sesión).
  - Sidebar limpia con `GENERAL` (Resumen), `OPERACIONES` (12 módulos) y `SISTEMA` (**Configuración** `/configuracion`), sin bloque repetido del usuario al pie.
  - Todos los módulos de Fase 1 activos: `/dashboard` (empresa + vista de firma), `/contabilidad`, `/finanzas`, `/gastos` (sin `Extraer 607`, `MonthPicker` propio), `/facturacion`, `/cuentas-por-cobrar`, `/cuentas-por-pagar`, `/impuestos` (606/607 Excel Incluidos+Excluidos + TXT, NCF B/E-CF), `/bancos`, `/inventario`, `/activos-fijos`, `/nomina`, `/documentos`, `/configuracion`, `/perfil`, `/empresas`, `/usuarios`, `/auditoria` y `/api/dgii/rnc`.
  - Rendimiento optimizado sobre Tailscale: `obtenerContextoApp()` con `React.cache()` + `getClaims()`, `prefetch={false}` en navegación y `src/app/(app)/loading.tsx`.

---

## 2. Suite de calidad verificada

- `pnpm typecheck` ✅
- `pnpm check` ✅ (Biome)
- `pnpm test` ✅ (164 tests + todos los candados)
- `pnpm test:pgtap` ✅ (5 suites / 188 aserciones sobre PostgreSQL local desechable)
- `E2E_BASE_URL=http://127.0.0.1:3020 pnpm test:e2e` ✅ (8/8 Playwright)
- `scripts/captura-todas.ts` ✅ (34/34 capturas desktop + móvil con 0 errores)

## 2.1 Modernización UX y exportaciones (2026-11-25)

Onda completa de modernización integrada en `main` (17+ fusiones de worktrees T3, todas verificadas):

- **Bugs operativos corregidos:** cuentas fiscales por campo en documentos (control CxP solo pasivos, CxC solo activos, ITBIS y retenciones correctos), prellenado fiscal sin pisar selecciones, sincronización de período en exportación 606/607, diálogos de impuestos que mostraban registros congelados, estado cruzado al cambiar de empresa (`key={empresa.id}` en todas las vistas), separación vertical del dashboard.
- **UX fundamentos:** esqueletos reales + `loading.tsx` por ruta + error/404; streaming Suspense en 9 páginas (encabezado en 0ms); `BuscadorLista` (debounce+URL) y `FilaNavegable`; modo oscuro persistente (claro por defecto) con selector Claro/Oscuro dentro del menú de perfil; búsqueda global `Ctrl+K`; CSS de impresión global; UI optimista con reversión compensatoria en bancos/contabilidad/impuestos/terceros; protección de formularios (confirmación de descarte + bloqueo doble envío); React Compiler activado.
- **Exportación unificada:** motor `src/lib/reportes/exportar/` (Excel/PDF con encabezado dinámico de empresa activa, timestamp `America/Santo_Domingo`) conectado en estado de resultados, balance general, flujo de efectivo, libro diario, libro mayor, balanza y antigüedad CxC/CxP; detalle imprimible/PDF de documentos en gastos y facturación con pagos y asiento contable.
- **Cambio de empresa robusto:** recarga completa del documento (patrón Alegra) — elimina el congelamiento de clics por portales huérfanos; empresas inactivas ocultas del selector.
- **Topbar:** migas duplicadas eliminadas, búsqueda centrada (rejilla `minmax(0,1fr) auto`), nombre de empresa oculto bajo `sm` para no tapar el buscador.

---

## 3. Pendientes inmediatos y Fase 2

1. **Google OAuth:** Waldy está configurando el cliente OAuth en Google Cloud Console y pegando `Client ID` + `Client Secret` en *Supabase → Authentication → Providers → Google* (Redirect URI: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`).
2. **Despliegue de producción (Vercel o dominio VPS):** Pendiente definición del dominio final de producción para agregarlo a `Redirect URLs` en Supabase Auth.
3. **Fase 2 (planificada aparte, no mezclada en Fase 1):** facturas/pagos recurrentes, formatos 608 / IT-1 / IR-17, búsqueda global `Cmd+K` y nómina RD avanzada (TSS/AFP/SFS/ISR).
