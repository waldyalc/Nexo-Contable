# docs/motor-contable.md — Reglas del Motor Contable

1. **Partida doble estricta:** Todo asiento contabilizado tiene mínimo 2 líneas, cada línea tiene `debito > 0` XOR `credito > 0`, y `SUM(debito) = SUM(credito)`.
2. **Solo cuentas de movimiento:** No se permite contabilizar en cuentas con `es_agrupacion = true` o que tengan subcuentas hijas, ni en cuentas inactivas.
3. **Periodo abierto obligatorio:** Toda contabilización valida que la fecha caiga dentro de un registro en `periodos_contables` con `estado = 'open'` para esa `empresa_id`.
4. **Anulación por reverso:** `anular_documento` o `revertir_asiento` crea un asiento de contrapartida (`estado = 'reversal'`) invirtiendo débitos y créditos y marca el original como `reversed` / `void`. Jamás se borran asientos contabilizados.
5. **Ejemplo numérico (Factura de gasto RD$ 1,000 + ITBIS 18% = RD$ 1,180, retención ISR 10% = RD$ 100):**
   - Débito Gasto (`cuenta_id`): `1,000.00`
   - Débito ITBIS adelantado (`cuenta_impuesto_id`): `180.00`
   - Crédito Retención ISR por pagar (`cuenta_retencion_id`): `100.00`
   - Crédito Cuentas por pagar / Banco (`cuenta_control_id`): `1,080.00`
   - Total Débito `1,180.00` == Total Crédito `1,180.00`.
6. **Inventario (costo promedio ponderado):** En entradas aumenta `cantidad_disponible` (`numeric(18,4)`) y `valor_total` (`numeric(14,2)`). En salidas el costo unitario es `ROUND(valor_total / cantidad_disponible, 2)` (si sale el total disponible, consume exactamente `valor_total` para no dejar residuo de centavos).
