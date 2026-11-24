# docs/DESIGN.md — Sistema de Diseño de Nexo Contable

Este documento es la fuente de verdad visual de **Nexo Contable**. Conserva la identidad verde limpia de Nexo Contable y aplica el rigor de componentes de shadcn (`base-nova` / Base UI) y el selector multi-empresa estilo Alegra.

---

## 1. Identidad y Tokens de Color (Paleta Nexo)

| Token CSS | Valor (Claro) | Uso |
| --- | --- | --- |
| `--primary` | `#176b53` | Botón primario, marca `N`, enlaces activos, día/mes seleccionado |
| `--primary-hover` | `#104d3d` | Hover de botón primario |
| `--primary-foreground` | `#ffffff` | Texto sobre `--primary` |
| `--secondary` | `#e8f4ee` | Ítem activo en sidebar, chips seleccionados, badges suaves |
| `--secondary-foreground` | `#176b53` | Texto sobre `--secondary` |
| `--background` | `#f6f7f5` | Lienzo principal del workspace |
| `--card` | `#ffffff` | Tarjetas, paneles, tablas y modales |
| `--foreground` | `#172a25` | Texto principal |
| `--muted-foreground` | `#66736d` | Subtítulos, encabezados de tabla, etiquetas secundarias |
| `--border` | `#e6ebe7` | Bordes de tarjetas, inputs y divisores |
| `--warning` | `#d39c48` | Pendientes, egresos en gráficos |
| `--destructive` | `#a84e4e` | Anulado, vencido, errores destructivos |

* **Radio base:** `0.625rem` (`10px`) en controles y `0.9375rem` (`15px`) en tarjetas principales (`TarjetaLista`, modales).
* **Sombra de tarjeta:** `0 16px 48px rgba(24, 63, 47, 0.05)` sutil y limpia.

---

## 2. Tipografía y Números

* **Títulos, marca y KPIs:** `Manrope` (pesos 600, 700, 800, `tracking-[-0.03em]`), cargada con `next/font/google`.
* **Cuerpo, formularios y tablas:** `DM Sans` (pesos 400, 500, 600, 700), cargada con `next/font/google`.
* **Montos financieros:** Siempre `tabular-nums`, alineados a la derecha, formato `es-DO` (`RD$ 1,250.00` / `US$ 100.00`).

---

## 3. Layout Principal y Selector Multi-Empresa (Estilo Alegra)

### Sidebar (izquierda, fija `248px`, colapsable en móvil con `Sheet`)
* Marca `N` + **Nexo Contable** arriba.
* Grupos claros:
  * **GENERAL:** Resumen
  * **OPERACIONES:** Banco · Inventario · Contabilidad · Cuentas por cobrar · Cuentas por pagar · Facturación · Gastos y compras · Impuestos · Activos fijos · Finanzas · Recursos humanos · Documentos
  * **ADMINISTRACIÓN** *(según rol)*: Empresas · Usuarios · Auditoría
* Perfil del usuario y botón cerrar sesión al pie.

### Topbar (`68px`, sticky con backdrop blur)
* Izquierda: botón menú móvil + `MigasDePan` (breadcrumbs).
* Derecha: **Popover "Mis empresas"** (estilo Alegra) + avatar de usuario.

### Especificación del Popover "Mis empresas" (`CompanySwitcher`)
* **Trigger pill:** altura `36px`, borde `--border`, fondo blanco, avatar/monograma de empresa + nombre truncado (`max-w-[180px] truncate`) + `IconChevronDown`.
* **Popover (`w-80 rounded-xl border bg-card shadow-lg`):**
  1. Cabecera: título **`Mis empresas`** + botón refrescar (`IconRefresh`) + botón cerrar (`IconX`).
  2. Campo de búsqueda instantánea (`Buscar...` con `IconSearch`).
  3. Lista scrolleable de empresas asignadas: monograma/logo + nombre comercial + etiqueta sutil `Principal` (si aplica) + `IconCheck` verde (`#176b53`) en la empresa activa.
  4. Enlace de acción **`+ Agregar empresa`** (solo `admin_global`).
  5. Paginador compacto (`1 de N < >`) cuando haya más de 6 empresas.
  6. Pie fijo con borde superior: botón **`Gestionar empresas`** (`IconBuilding`).

---

## 4. Reglas de Componentes (Corrección de Bugs de UI)

### Calendarios y Selectores de Fecha (Prohibidos los nativos)
* **`MonthPicker` (`src/components/month-picker.tsx`):**
  * Reemplaza `<input type="month">` en Gastos/Compras (606), Facturación (607), Impuestos y Nómina.
  * Trigger estilizado de altura `36px` (`h-9`) con `IconCalendar`, muestra `noviembre de 2026`.
  * Popover con barra de año (`< 2026 >`), grilla 4×3 de meses abreviados en español (`ene`…`dic`) con estado activo en `#176b53` y texto blanco, y pie con botones `Borrar` y `Este mes`.
* **`DatePicker` (`src/components/date-picker.tsx`):**
  * Basado en `react-day-picker` + `Popover` (Base UI `render` prop).
  * Valor interno `yyyy-MM-dd`, etiqueta visual `dd/MM/yyyy`, celdas `36px–40px`, atajo `Hoy` y opción `permitirLimpiar`.
* **`DateRangePicker` (`src/components/date-range-picker.tsx`):**
  * Panel de 2 meses + columna izquierda de atajos (*Hoy, Ayer, Esta semana, Este mes, Mes anterior, Este trimestre, Este año*) para reportes y libros.

### Botones y Barras de Acciones (`BarraLista` y `EncabezadoPagina`)
* **Prohibido aplastar botones o partir etiquetas en múltiples líneas:** todo botón usa `whitespace-nowrap shrink-0` y altura uniforme (`h-9` en toolbars, `h-10` en formularios).
* **Jerarquía máxima por vista:**
  1. **1 botón primario** (`variant="default"`, verde `#176b53`): ej. `+ Nueva factura`.
  2. **1–2 botones secundarios** (`variant="outline"`): ej. `Exportar 606`, `Terceros`.
  3. **Resto en menú desplegable `Acciones`** (`DropdownMenu`): ej. `Carga masiva Excel/CSV (606)`, `Nueva nota de crédito`.
* **Separación de contexto:** `Extraer 607` pertenece a **Facturación / Impuestos**, nunca a **Gastos y compras**.
* **Fila de filtros separada:** `MonthPicker`, buscador y filtro de estado van en una franja propia debajo del encabezado del panel, con `flex-wrap gap-2`.

### Tablas (`TarjetaLista` + `BarraLista` + `TablaLista<T>`)
* Contenedor `TarjetaLista` (`rounded-[15px] border bg-card`).
* Encabezados de tabla `h-12` (`48px`), mayúsculas `11px` tracking amplio, color `--muted-foreground`.
* Badges de estado `PillEstado` con punto indicador: `saldada` (verde), `pendiente` (ámbar), `vencida`/`anulada` (rojo), `borrador`/`inactiva` (gris).

### Login (Mismo diseño de Nexo + Google)
* Pantalla dividida en desktop (`1fr 1.15fr`): panel izquierdo verde suave `#eaf2ec` con marca Nexo, título editorial y círculos decorativos; panel derecho blanco con tarjeta centrada (`max-w-[410px]`).
* Incluye botón **`Continuar con Google`** (icono Google multicolor + borde limpio) + separador *"o ingresa con tu correo"* + formulario de correo y contraseña.
* Si el usuario entra por primera vez con `debe_definir_password = true`, se muestra una tarjeta limpia en el mismo estilo para crear su contraseña personal (mínimo 12 caracteres).
