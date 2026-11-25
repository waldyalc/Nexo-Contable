// Tipos de esquema y RPCs generados a partir de supabase/migrations/*.sql.
// Regenerar con `pnpm db:types` tras enlazar Supabase remoto si cambia el esquema.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: {
      actualizar_cuenta: {
        Args: {
          p_empresa_id: string;
          p_cuenta_id: string;
          p_nombre: string;
          p_activa: boolean;
          p_es_agrupacion?: boolean | null;
          p_es_equivalente_efectivo?: boolean | null;
          p_categoria_flujo_efectivo?: string | null;
        };
        Returns: undefined;
      };
      actualizar_empresa: {
        Args: {
          p_empresa_id: string;
          p_nombre_comercial: string;
          p_razon_social: string;
          p_rnc?: string;
          p_tipo_empresa?: string;
          p_direccion?: string;
          p_telefono?: string;
          p_correo?: string;
          p_representante_legal?: string;
          p_actividad_economica?: string;
          p_fecha_inicio?: string | null;
          p_regimen_fiscal?: string;
          p_moneda_funcional?: string;
          p_periodo_fiscal?: string;
          p_estado?: string;
        };
        Returns: undefined;
      };
      actualizar_usuario: {
        Args: {
          p_user_id: string;
          p_nombre: string;
          p_activo: boolean;
          p_rol_global?: string | null;
          p_debe_definir_password?: boolean | null;
        };
        Returns: undefined;
      };
      anular_corrida_nomina: {
        Args: {
          p_empresa_id: string;
          p_corrida_id: string;
          p_fecha_anulacion?: string;
          p_motivo?: string;
        };
        Returns: string;
      };
      anular_documento: {
        Args: {
          p_empresa_id: string;
          p_documento_id: string;
          p_fecha_anulacion?: string;
          p_motivo?: string;
        };
        Returns: string;
      };
      anular_pago_documento: {
        Args: {
          p_empresa_id: string;
          p_pago_id: string;
          p_fecha_anulacion?: string;
          p_motivo?: string;
        };
        Returns: string;
      };
      asignar_usuario_empresa: {
        Args: {
          p_user_id: string;
          p_empresa_id: string;
          p_rol: string;
          p_es_principal?: boolean;
        };
        Returns: undefined;
      };
      cerrar_periodo_contable: {
        Args: {
          p_empresa_id: string;
          p_periodo_id: string;
        };
        Returns: undefined;
      };
      cerrar_sesion_conciliacion: {
        Args: {
          p_empresa_id: string;
          p_sesion_id: string;
          p_fecha_cierre?: string;
        };
        Returns: undefined;
      };
      completar_definicion_password: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      consumir_siguiente_ncf: {
        Args: {
          p_empresa_id: string;
          p_tipo_comprobante: string;
          p_fecha?: string;
        };
        Returns: string;
      };
      contabilizar_asiento_borrador: {
        Args: {
          p_empresa_id: string;
          p_asiento_id: string;
        };
        Returns: undefined;
      };
      contabilizar_corrida_nomina: {
        Args: {
          p_empresa_id: string;
          p_periodo: string;
          p_fecha_pago: string;
          p_cuenta_gasto_id: string;
          p_cuenta_pago_id: string;
          p_detalles: Json;
          p_cuenta_retenciones_id?: string | null;
          p_descripcion?: string;
        };
        Returns: string;
      };
      correr_depreciacion_periodo: {
        Args: {
          p_empresa_id: string;
          p_periodo: string;
          p_fecha: string;
        };
        Returns: number;
      };
      crear_asiento_manual: {
        Args: {
          p_empresa_id: string;
          p_fecha: string;
          p_descripcion: string;
          p_referencia?: string;
          p_lineas?: Json;
          p_contabilizar?: boolean;
        };
        Returns: string;
      };
      crear_cuenta: {
        Args: {
          p_empresa_id: string;
          p_codigo: string;
          p_nombre: string;
          p_clasificacion: string;
          p_naturaleza: string;
          p_padre_id?: string | null;
          p_es_agrupacion?: boolean;
          p_es_equivalente_efectivo?: boolean;
          p_categoria_flujo_efectivo?: string;
        };
        Returns: string;
      };
      crear_empresa: {
        Args: {
          p_nombre_comercial: string;
          p_razon_social: string;
          p_rnc?: string;
          p_tipo_empresa?: string;
          p_direccion?: string;
          p_telefono?: string;
          p_correo?: string;
          p_representante_legal?: string;
          p_actividad_economica?: string;
          p_fecha_inicio?: string | null;
          p_regimen_fiscal?: string;
          p_moneda_funcional?: string;
          p_periodo_fiscal?: string;
        };
        Returns: string;
      };
      crear_periodo_contable: {
        Args: {
          p_empresa_id: string;
          p_nombre: string;
          p_fecha_inicio: string;
          p_fecha_fin: string;
        };
        Returns: string;
      };
      crear_sesion_conciliacion: {
        Args: {
          p_empresa_id: string;
          p_cuenta_bancaria_id: string;
          p_fecha_corte: string;
          p_saldo_extracto?: number;
          p_saldo_libros?: number | null;
        };
        Returns: string;
      };
      eliminar_documento_almacenado: {
        Args: {
          p_empresa_id: string;
          p_documento_id: string;
        };
        Returns: undefined;
      };
      emitir_documento_financiero: {
        Args: {
          p_empresa_id: string;
          p_tipo: string;
          p_tercero_id: string;
          p_fecha_emision: string;
          p_concepto: string;
          p_cuenta_id: string;
          p_cuenta_control_id: string;
          p_subtotal: number;
          p_impuesto?: number;
          p_retenciones?: number;
          p_otros_impuestos?: number;
          p_numero?: string | null;
          p_tipo_ncf?: string;
          p_ncf?: string;
          p_fecha_vencimiento?: string | null;
          p_cuenta_impuesto_id?: string | null;
          p_cuenta_retencion_id?: string | null;
          p_documento_acreditado_id?: string | null;
          p_detalles_fiscales?: Json;
          p_retencion_isr?: number | null;
          p_retencion_itbis?: number | null;
        };
        Returns: string;
      };
      asignar_ncf_documento_borrador: {
        Args: {
          p_empresa_id: string;
          p_documento_id: string;
          p_tipo_comprobante: string;
        };
        Returns: string;
      };
      contabilizar_documento_financiero: {
        Args: {
          p_empresa_id: string;
          p_documento_id: string;
        };
        Returns: string;
      };
      guardar_documento_borrador: {
        Args: {
          p_empresa_id: string;
          p_tipo: string;
          p_tercero_id: string;
          p_fecha_emision: string;
          p_concepto: string;
          p_cuenta_id: string | null;
          p_cuenta_control_id: string | null;
          p_subtotal: number;
          p_impuesto?: number;
          p_retenciones?: number;
          p_otros_impuestos?: number;
          p_numero?: string | null;
          p_tipo_ncf?: string;
          p_ncf?: string;
          p_fecha_vencimiento?: string | null;
          p_cuenta_impuesto_id?: string | null;
          p_cuenta_retencion_id?: string | null;
          p_documento_acreditado_id?: string | null;
          p_detalles_fiscales?: Json;
          p_retencion_isr?: number | null;
          p_retencion_itbis?: number | null;
          p_documento_id?: string | null;
          p_proforma?: boolean;
          p_lineas?: Json;
        };
        Returns: string;
      };
      es_admin_global: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      exigir_rol_empresa: {
        Args: {
          p_empresa_id: string;
          p_roles: string[];
        };
        Returns: string;
      };
      guardar_activo_fijo: {
        Args: {
          p_empresa_id: string;
          p_codigo?: string | null;
          p_nombre?: string | null;
          p_fecha_adquisicion?: string | null;
          p_costo_adquisicion?: number | null;
          p_vida_util_meses?: number | null;
          p_cuenta_activo_id?: string | null;
          p_cuenta_depreciacion_acumulada_id?: string | null;
          p_cuenta_gasto_depreciacion_id?: string | null;
          p_categoria?: string | null;
          p_valor_residual?: number | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_articulo_inventario: {
        Args: {
          p_empresa_id: string;
          p_sku?: string | null;
          p_nombre?: string | null;
          p_unidad?: string | null;
          p_descripcion?: string | null;
          p_precio_venta?: number | null;
          p_cuenta_inventario_id?: string | null;
          p_cuenta_costo_id?: string | null;
          p_cuenta_ingreso_id?: string | null;
          p_activo?: boolean | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_configuracion_fiscal: {
        Args: {
          p_empresa_id: string;
          p_tasa_itbis_bps?: number | null;
          p_retencion_isr_servicios_bps?: number | null;
          p_retencion_itbis_servicios_bps?: number | null;
          p_cuenta_itbis_adelantado_id?: string | null;
          p_cuenta_itbis_por_pagar_id?: string | null;
          p_cuenta_retencion_isr_id?: string | null;
          p_cuenta_retencion_itbis_id?: string | null;
          p_cuenta_cxc_default_id?: string | null;
          p_cuenta_cxp_default_id?: string | null;
        };
        Returns: string;
      };
      guardar_cuenta_bancaria: {
        Args: {
          p_empresa_id: string;
          p_nombre?: string | null;
          p_cuenta_contable_id?: string | null;
          p_banco?: string | null;
          p_numero_cuenta?: string | null;
          p_moneda?: string | null;
          p_saldo_inicial?: number | null;
          p_activa?: boolean | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_empleado: {
        Args: {
          p_empresa_id: string;
          p_codigo?: string | null;
          p_nombre?: string | null;
          p_salario_mensual?: number | null;
          p_cedula?: string | null;
          p_cargo?: string | null;
          p_departamento?: string | null;
          p_fecha_ingreso?: string | null;
          p_activo?: boolean | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_metodo_pago: {
        Args: {
          p_empresa_id: string;
          p_nombre?: string | null;
          p_cuenta_id?: string | null;
          p_deja_cxp_proveedor?: boolean | null;
          p_activo?: boolean | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_obligacion_fiscal: {
        Args: {
          p_empresa_id: string;
          p_codigo_formulario?: string | null;
          p_periodo?: string | null;
          p_fecha_limite?: string | null;
          p_estado?: string | null;
          p_monto_declarado?: number | null;
          p_referencia_presentacion?: string | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_regla_fiscal: {
        Args: {
          p_empresa_id: string;
          p_codigo?: string | null;
          p_nombre?: string | null;
          p_tipo?: string | null;
          p_tasa_bps?: number | null;
          p_cuenta_id?: string | null;
          p_activa?: boolean | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_secuencia_ncf: {
        Args: {
          p_empresa_id: string;
          p_tipo_comprobante?: string | null;
          p_prefijo?: string | null;
          p_numero_inicial?: number | null;
          p_numero_final?: number | null;
          p_fecha_vencimiento?: string | null;
          p_activo?: boolean | null;
          p_id?: string | null;
        };
        Returns: string;
      };
      guardar_tercero: {
        Args: {
          p_empresa_id: string;
          p_id?: string | null;
          p_tipo?: string;
          p_nombre?: string;
          p_rnc?: string;
          p_correo?: string;
          p_telefono?: string;
          p_direccion?: string;
          p_cuenta_por_pagar_id?: string | null;
          p_cuenta_por_cobrar_id?: string | null;
          p_activo?: boolean;
        };
        Returns: string;
      };
      importar_catalogo_cuentas: {
        Args: {
          p_empresa_id: string;
          p_cuentas: Json;
        };
        Returns: number;
      };
      importar_movimientos_bancarios: {
        Args: {
          p_empresa_id: string;
          p_cuenta_bancaria_id: string;
          p_nombre_archivo: string;
          p_filas: Json;
        };
        Returns: string;
      };
      marcar_empresa_principal: {
        Args: {
          p_empresa_id: string;
        };
        Returns: undefined;
      };
      marcar_movimiento_conciliado: {
        Args: {
          p_empresa_id: string;
          p_movimiento_id: string;
          p_sesion_id: string;
          p_conciliado?: boolean;
        };
        Returns: undefined;
      };
      marcar_obligacion_presentada: {
        Args: {
          p_empresa_id: string;
          p_obligacion_id: string;
          p_estado?: string;
          p_monto_declarado?: number | null;
          p_referencia_presentacion?: string | null;
        };
        Returns: undefined;
      };
      reabrir_periodo_contable: {
        Args: {
          p_empresa_id: string;
          p_periodo_id: string;
        };
        Returns: undefined;
      };
      registrar_auditoria: {
        Args: {
          p_empresa_id: string;
          p_accion: string;
          p_entidad: string;
          p_entidad_id: string;
          p_detalles?: Json;
        };
        Returns: undefined;
      };
      registrar_documento_almacenado: {
        Args: {
          p_empresa_id: string;
          p_entidad: string;
          p_entidad_id: string;
          p_nombre_archivo: string;
          p_ruta_storage: string;
          p_mime_type?: string;
          p_tamano_bytes?: number;
        };
        Returns: string;
      };
      registrar_movimiento_bancario: {
        Args: {
          p_empresa_id: string;
          p_cuenta_bancaria_id: string;
          p_fecha: string;
          p_tipo: string;
          p_monto: number;
          p_descripcion?: string;
          p_referencia?: string;
          p_cuenta_contrapartida_id?: string | null;
        };
        Returns: string;
      };
      registrar_movimiento_inventario: {
        Args: {
          p_empresa_id: string;
          p_articulo_id: string;
          p_fecha: string;
          p_tipo: string;
          p_cantidad: number;
          p_costo_unitario?: number | null;
          p_cuenta_contrapartida_id?: string | null;
          p_referencia?: string;
          p_notas?: string;
          p_direccion?: string | null;
        };
        Returns: string;
      };
      registrar_pago_documento: {
        Args: {
          p_empresa_id: string;
          p_documento_id: string;
          p_fecha_pago: string;
          p_monto: number;
          p_metodo_pago: string;
          p_cuenta_id: string;
          p_referencia?: string;
        };
        Returns: string;
      };
      remover_usuario_empresa: {
        Args: {
          p_user_id: string;
          p_empresa_id: string;
        };
        Returns: undefined;
      };
      reporte_antiguedad_saldos: {
        Args: {
          p_empresa_id: string;
          p_tipo: string;
          p_fecha_corte?: string;
        };
        Returns: Array<{
          documento_id: string;
          numero: string;
          tercero_id: string;
          tercero: string;
          fecha_emision: string;
          fecha_vencimiento: string;
          dias_vencido: number;
          saldo: number;
          bucket: string;
        }>;
      };
      reporte_balance_general: {
        Args: {
          p_empresa_id: string;
          p_fecha_corte: string;
        };
        Returns: Array<{
          clasificacion: string;
          cuenta_id: string;
          codigo: string;
          nombre: string;
          monto: number;
        }>;
      };
      reporte_balanza_comprobacion: {
        Args: {
          p_empresa_id: string;
          p_desde: string;
          p_hasta: string;
        };
        Returns: Array<{
          cuenta_id: string;
          codigo: string;
          nombre: string;
          clasificacion: string;
          naturaleza: string;
          saldo_anterior: number;
          debitos: number;
          creditos: number;
          saldo_actual: number;
        }>;
      };
      reporte_cambios_patrimonio: {
        Args: {
          p_empresa_id: string;
          p_desde: string;
          p_hasta: string;
        };
        Returns: Array<{
          tipo_fila: string;
          cuenta_id: string | null;
          codigo: string;
          nombre: string;
          saldo_inicial: number;
          debitos: number;
          creditos: number;
          movimiento_neto: number;
          saldo_final: number;
        }>;
      };
      reporte_dgii_606: {
        Args: {
          p_empresa_id: string;
          p_periodo: string;
        };
        Returns: Array<{
          documento_id: string;
          tercero_id: string;
          rnc: string;
          nombre: string;
          tipo_identificacion: string;
          tipo_comprobante: string;
          ncf: string;
          fecha_comprobante: string;
          fecha_pago: string;
          monto_facturado: number;
          base_imponible: number;
          itbis_facturado: number;
          retencion_isr: number;
          retencion_itbis: number;
          total_retenido: number;
          incluido: boolean;
          motivo_exclusion: string;
        }>;
      };
      reporte_dgii_607: {
        Args: {
          p_empresa_id: string;
          p_periodo: string;
        };
        Returns: Array<{
          documento_id: string;
          tercero_id: string;
          rnc: string;
          nombre: string;
          tipo_identificacion: string;
          tipo_comprobante: string;
          ncf: string;
          fecha_comprobante: string;
          monto_facturado: number;
          base_imponible: number;
          itbis_facturado: number;
          itbis_retenido: number;
          retencion_renta: number;
          otros_impuestos: number;
          total: number;
          metodo_pago: string;
          incluido: boolean;
          motivo_exclusion: string;
        }>;
      };
      reporte_estado_resultados: {
        Args: {
          p_empresa_id: string;
          p_desde: string;
          p_hasta: string;
        };
        Returns: Array<{
          clasificacion: string;
          cuenta_id: string;
          codigo: string;
          nombre: string;
          debitos: number;
          creditos: number;
          monto: number;
        }>;
      };
      reporte_flujo_efectivo: {
        Args: {
          p_empresa_id: string;
          p_desde: string;
          p_hasta: string;
        };
        Returns: Array<{
          categoria: string;
          monto: number;
        }>;
      };
      reporte_libro_mayor: {
        Args: {
          p_empresa_id: string;
          p_cuenta_id: string;
          p_desde: string;
          p_hasta: string;
        };
        Returns: Array<{
          fecha: string;
          asiento_id: string;
          asiento_numero: string;
          referencia: string;
          descripcion: string;
          debito: number;
          credito: number;
          saldo: number;
        }>;
      };
      reporte_resumen_empresa: {
        Args: {
          p_empresa_id: string;
          p_desde: string;
          p_hasta: string;
        };
        Returns: Array<{
          empresa_id: string;
          empresa: string;
          ventas: number;
          notas_credito_venta: number;
          compras: number;
          notas_credito_compra: number;
          itbis_ventas: number;
          itbis_compras: number;
          total_activos: number;
          total_pasivos: number;
          total_patrimonio: number;
          resultado: number;
          efectivo: number;
          documentos_pendientes: number;
          asientos: number;
        }>;
      };
      reporte_resumen_firma: {
        Args: {
          p_desde: string;
          p_hasta: string;
        };
        Returns: Array<{
          empresa_id: string;
          empresa: string;
          ventas: number;
          notas_credito_venta: number;
          compras: number;
          notas_credito_compra: number;
          itbis_ventas: number;
          itbis_compras: number;
          total_activos: number;
          total_pasivos: number;
          total_patrimonio: number;
          resultado: number;
          efectivo: number;
          documentos_pendientes: number;
          asientos: number;
        }>;
      };
      revertir_asiento: {
        Args: {
          p_empresa_id: string;
          p_asiento_id: string;
          p_fecha_reverso?: string;
          p_motivo?: string;
        };
        Returns: string;
      };
      rol_en_empresa: {
        Args: {
          p_empresa_id: string;
        };
        Returns: string;
      };
      toggle_tercero_activo: {
        Args: {
          p_empresa_id: string;
          p_tercero_id: string;
          p_activo: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
