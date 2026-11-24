---
name: motor-contable
description: Invariantes de partida doble, precisión numérica, periodos cerrados y anulaciones por reverso en Nexo Contable.
---

# Skill: Motor Contable

1. **Partida doble en SQL:** cada factura, gasto, nota de crédito, pago, ajuste de inventario o depreciación crea su asiento (`asientos` + `asiento_lineas`) dentro de la misma transacción SQL.
2. **Invariantes:**
   - Mínimo 2 líneas por asiento contabilizado.
   - `SUM(debito) = SUM(credito)` validado por trigger diferido.
   - Cada línea tiene `debito > 0` XOR `credito > 0`.
   - Cuentas inactivas o de agrupación (`es_agrupacion = true`) nunca aceptan movimientos.
   - La fecha debe caer en un `periodos_contables` abierto (`estado = 'open'`) de esa `empresa_id`.
3. **Anulación = Reverso:** nunca usar `DELETE` en documentos o asientos contabilizados; generar un asiento inverso vía `anular_documento` / `revertir_asiento`.
4. **Precisión:** montos en `NUMERIC(14,2)`, cantidades de inventario en `NUMERIC(18,4)`. Nunca usar `REAL`/`FLOAT`.
5. **Tests primero:** antes de cambiar cualquier cálculo financiero o fiscal, escribir o actualizar el test Vitest / pgTAP correspondiente.
