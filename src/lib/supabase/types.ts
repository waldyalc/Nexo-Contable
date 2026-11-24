// Placeholder generado en Fase 0. Regenerar con `pnpm db:types` tras aplicar migraciones.
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
      importar_catalogo_cuentas: {
        Args: {
          p_empresa_id: string;
          p_cuentas: Json;
        };
        Returns: number;
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
      marcar_empresa_principal: {
        Args: { p_empresa_id: string };
        Returns: undefined;
      };
      completar_definicion_password: {
        Args: Record<string, never>;
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
      asignar_usuario_empresa: {
        Args: {
          p_user_id: string;
          p_empresa_id: string;
          p_rol: string;
          p_es_principal?: boolean;
        };
        Returns: undefined;
      };
      remover_usuario_empresa: {
        Args: {
          p_user_id: string;
          p_empresa_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
