---
name: diseno-ui
description: Reglas de diseño Nexo Contable con shadcn Base UI, paleta verde, MonthPicker/DatePicker propios y Popover Mis empresas.
---

# Skill: Diseño UI (Nexo Contable)

Lee siempre `docs/DESIGN.md` antes de crear o editar componentes.

1. **Identidad Nexo:** verde bosque `#176b53`, hover `#104d3d`, menta `#e8f4ee`, lienzo `#f6f7f5`, `Manrope` + `DM Sans`, montos con `tabular-nums` alineados a la derecha en `RD$`/`US$`.
2. **Base UI (`@base-ui/react`), NO Radix:** los triggers de Popover/Dialog/Menu usan la prop `render`, jamás `asChild`.
3. **Controles nativos prohibidos:** nunca usar `<input type="date">`, `<input type="month">` ni `<select>` nativos fuera de `src/components/ui/`. Usar `DatePicker`, `DateRangePicker`, `MonthPicker` y `SelectCampo`.
4. **Botones y barras limpias:** en `BarraLista` y `EncabezadoPagina` todos los botones llevan altura uniforme (`h-9`) y `whitespace-nowrap shrink-0`. Máximo 1 botón primario por vista; agrupar acciones secundarias en menú desplegable.
5. **Tablas unificadas:** usar siempre `TarjetaLista`, `BarraLista`, `TablaLista<T>` y `PillEstado`.
6. **Iconos:** usar únicamente `@tabler/icons-react`.
