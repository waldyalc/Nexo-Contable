-- =============================================================================
-- Nexo Contable · Permitir NCF históricos/irregulares de proveedores en documentos
-- =============================================================================
-- Las secuencias emitidas (`secuencias_ncf`) siguen exigiendo el formato oficial
-- DGII (B01-B17 / E31-E47). En `documentos_financieros`, los comprobantes de
-- compras históricas o de terceros pueden llegar con errores de digitación;
-- almacenarlos permite que `reporte_dgii_606` y `reporte_dgii_607` los detecten
-- y los envíen automáticamente a la hoja de Excluidos con su motivo exacto.
-- =============================================================================

alter table public.documentos_financieros
  drop constraint if exists documentos_financieros_ncf_check,
  drop constraint if exists documentos_financieros_tipo_ncf_check;

alter table public.documentos_financieros
  add constraint documentos_financieros_ncf_largo_check
    check (char_length(ncf) <= 30),
  add constraint documentos_financieros_tipo_ncf_largo_check
    check (char_length(tipo_ncf) <= 10);
