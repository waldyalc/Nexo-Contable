"use server";

import { revalidatePath } from "next/cache";

import { MIME_EXCEL } from "@/lib/dgii/descarga";
import {
  type ContextoExportacion,
  type Fila606,
  type Fila607,
  generarExcel606,
  generarExcel607,
  generarTxt606,
  generarTxt607,
  nombreArchivo606,
  nombreArchivo607,
  nombreArchivoTxt606,
  nombreArchivoTxt607,
} from "@/lib/dgii/exportar-606-607";
import {
  esquemaConfiguracionFiscal,
  esquemaMetodoPago,
  esquemaObligacionFiscal,
  esquemaReglaFiscal,
  esquemaSecuenciaNcf,
} from "@/lib/operaciones/esquemas";
import type {
  ResultadoDescarga,
  ResultadoOperacion,
} from "@/lib/operaciones/tipos";
import { createClient } from "@/lib/supabase/server";

function refrescarImpuestos() {
  revalidatePath("/impuestos");
  revalidatePath("/dashboard");
}

async function exigirSesion(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

/** Guarda las tasas y cuentas por defecto de la configuración fiscal. */
export async function guardarConfiguracionFiscalAction(entrada: {
  empresaId: string;
  tasaItbisBps: number;
  retencionIsrServiciosBps: number;
  retencionItbisServiciosBps: number;
  cuentaItbisAdelantadoId: string | null;
  cuentaItbisPorPagarId: string | null;
  cuentaRetencionIsrId: string | null;
  cuentaRetencionItbisId: string | null;
  cuentaCxcDefaultId: string | null;
  cuentaCxpDefaultId: string | null;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaConfiguracionFiscal.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa la configuración fiscal.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("guardar_configuracion_fiscal", {
    p_empresa_id: datos.empresaId,
    p_tasa_itbis_bps: datos.tasaItbisBps,
    p_retencion_isr_servicios_bps: datos.retencionIsrServiciosBps,
    p_retencion_itbis_servicios_bps: datos.retencionItbisServiciosBps,
    p_cuenta_itbis_adelantado_id: datos.cuentaItbisAdelantadoId,
    p_cuenta_itbis_por_pagar_id: datos.cuentaItbisPorPagarId,
    p_cuenta_retencion_isr_id: datos.cuentaRetencionIsrId,
    p_cuenta_retencion_itbis_id: datos.cuentaRetencionItbisId,
    p_cuenta_cxc_default_id: datos.cuentaCxcDefaultId,
    p_cuenta_cxp_default_id: datos.cuentaCxpDefaultId,
  });

  if (error) return { ok: false, error: error.message };

  refrescarImpuestos();
  return { ok: true, mensaje: "Configuración fiscal actualizada." };
}

/** Crea o edita una secuencia NCF de serie B o electrónica E. */
export async function guardarSecuenciaNcfAction(entrada: {
  empresaId: string;
  id?: string | null;
  tipoComprobante: string;
  prefijo: string;
  numeroInicial: number;
  numeroFinal: number;
  fechaVencimiento: string | null;
  activo?: boolean;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaSecuenciaNcf.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ??
        "Revisa los datos de la secuencia.",
    };
  }

  const datos = resultado.data;

  if (datos.prefijo.slice(0, 3) !== datos.tipoComprobante) {
    return {
      ok: false,
      error: `El prefijo debe comenzar con el tipo de comprobante ${datos.tipoComprobante}.`,
    };
  }

  if (datos.numeroFinal < datos.numeroInicial) {
    return {
      ok: false,
      error: "El número final debe ser mayor o igual al inicial.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("guardar_secuencia_ncf", {
    p_empresa_id: datos.empresaId,
    p_id: datos.id ?? null,
    p_tipo_comprobante: datos.tipoComprobante,
    p_prefijo: datos.prefijo,
    p_numero_inicial: datos.numeroInicial,
    p_numero_final: datos.numeroFinal,
    p_fecha_vencimiento: datos.fechaVencimiento,
    p_activo: datos.activo ?? true,
  });

  if (error) return { ok: false, error: error.message };

  refrescarImpuestos();
  revalidatePath("/facturacion");
  return {
    ok: true,
    mensaje: datos.id ? "Secuencia actualizada." : "Secuencia NCF creada.",
  };
}

/** Crea o edita una regla fiscal (ITBIS, ISR o retenciones). */
export async function guardarReglaFiscalAction(entrada: {
  empresaId: string;
  id?: string | null;
  codigo: string;
  nombre: string;
  tipo: string;
  tasaBps: number;
  cuentaId: string | null;
  activa?: boolean;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaReglaFiscal.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error: resultado.error.issues[0]?.message ?? "Revisa la regla fiscal.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("guardar_regla_fiscal", {
    p_empresa_id: datos.empresaId,
    p_id: datos.id ?? null,
    p_codigo: datos.codigo,
    p_nombre: datos.nombre,
    p_tipo: datos.tipo,
    p_tasa_bps: datos.tasaBps,
    p_cuenta_id: datos.cuentaId,
    p_activa: datos.activa ?? true,
  });

  if (error) return { ok: false, error: error.message };

  refrescarImpuestos();
  return {
    ok: true,
    mensaje: datos.id ? "Regla fiscal actualizada." : "Regla fiscal creada.",
  };
}

/** Crea o edita un método de pago con su cuenta contable. */
export async function guardarMetodoPagoAction(entrada: {
  empresaId: string;
  id?: string | null;
  nombre: string;
  cuentaId: string;
  dejaCxpProveedor?: boolean;
  activo?: boolean;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaMetodoPago.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error: resultado.error.issues[0]?.message ?? "Revisa el método de pago.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("guardar_metodo_pago", {
    p_empresa_id: datos.empresaId,
    p_id: datos.id ?? null,
    p_nombre: datos.nombre,
    p_cuenta_id: datos.cuentaId,
    p_deja_cxp_proveedor: datos.dejaCxpProveedor ?? false,
    p_activo: datos.activo ?? true,
  });

  if (error) return { ok: false, error: error.message };

  refrescarImpuestos();
  return {
    ok: true,
    mensaje: datos.id
      ? "Método de pago actualizado."
      : "Método de pago creado.",
  };
}

/** Crea o edita una obligación fiscal (606, 607, IT-1, IR-17, IR-3). */
export async function guardarObligacionFiscalAction(entrada: {
  empresaId: string;
  id?: string | null;
  codigoFormulario: string;
  periodo: string;
  fechaLimite: string;
  estado?: "pending" | "filed" | "paid" | "overdue";
  montoDeclarado?: number;
  referenciaPresentacion?: string;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaObligacionFiscal.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa la obligación fiscal.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("guardar_obligacion_fiscal", {
    p_empresa_id: datos.empresaId,
    p_id: datos.id ?? null,
    p_codigo_formulario: datos.codigoFormulario,
    p_periodo: datos.periodo,
    p_fecha_limite: datos.fechaLimite,
    p_estado: datos.estado ?? "pending",
    p_monto_declarado: datos.montoDeclarado ?? 0,
    p_referencia_presentacion: datos.referenciaPresentacion ?? "",
  });

  if (error) return { ok: false, error: error.message };

  refrescarImpuestos();
  return {
    ok: true,
    mensaje: datos.id ? "Obligación actualizada." : "Obligación fiscal creada.",
  };
}

/** Marca una obligación como presentada (o pagada) con su referencia. */
export async function marcarObligacionPresentadaAction(entrada: {
  empresaId: string;
  obligacionId: string;
  estado: "filed" | "paid" | "overdue";
  montoDeclarado?: number;
  referenciaPresentacion?: string;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("marcar_obligacion_presentada", {
    p_empresa_id: entrada.empresaId,
    p_obligacion_id: entrada.obligacionId,
    p_estado: entrada.estado,
    p_monto_declarado: entrada.montoDeclarado ?? null,
    p_referencia_presentacion: entrada.referenciaPresentacion ?? null,
  });

  if (error) return { ok: false, error: error.message };

  refrescarImpuestos();
  return { ok: true, mensaje: "Obligación fiscal actualizada." };
}

interface EmpresaFila {
  rnc: string;
  razon_social: string;
}

/** Descarga el 606 o el 607 en Excel (dos hojas) o en TXT oficial. */
export async function exportarFormatoDgiiAction(entrada: {
  empresaId: string;
  formato: "606" | "607";
  periodo: string;
  tipo: "excel" | "txt";
}): Promise<ResultadoDescarga> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const supabase = await createClient();

  const { data: empresa, error: errorEmpresa } = await supabase
    .from("empresas")
    .select("rnc, razon_social")
    .eq("id", entrada.empresaId)
    .maybeSingle();

  if (errorEmpresa || empresa === null) {
    return { ok: false, error: "No pudimos leer los datos de la empresa." };
  }

  const datosEmpresa = empresa as EmpresaFila;
  const contexto: ContextoExportacion = {
    periodo: entrada.periodo,
    rncEmpresa: datosEmpresa.rnc,
    razonSocial: datosEmpresa.razon_social,
  };

  if (entrada.formato === "606") {
    const { data, error } = await supabase.rpc("reporte_dgii_606", {
      p_empresa_id: entrada.empresaId,
      p_periodo: entrada.periodo,
    });

    if (error) return { ok: false, error: error.message };

    const filas = (data ?? []) as Fila606[];

    if (entrada.tipo === "txt") {
      return {
        ok: true,
        nombreArchivo: nombreArchivoTxt606(entrada.periodo),
        mime: "text/plain;charset=utf-8",
        contenidoBase64: Buffer.from(
          generarTxt606(filas, contexto),
          "utf-8",
        ).toString("base64"),
      };
    }

    const libro = await generarExcel606(filas, contexto);
    return {
      ok: true,
      nombreArchivo: nombreArchivo606(entrada.periodo),
      mime: MIME_EXCEL,
      contenidoBase64: Buffer.from(libro).toString("base64"),
    };
  }

  const { data, error } = await supabase.rpc("reporte_dgii_607", {
    p_empresa_id: entrada.empresaId,
    p_periodo: entrada.periodo,
  });

  if (error) return { ok: false, error: error.message };

  const filas = (data ?? []) as Fila607[];

  if (entrada.tipo === "txt") {
    return {
      ok: true,
      nombreArchivo: nombreArchivoTxt607(entrada.periodo),
      mime: "text/plain;charset=utf-8",
      contenidoBase64: Buffer.from(
        generarTxt607(filas, contexto),
        "utf-8",
      ).toString("base64"),
    };
  }

  const libro = await generarExcel607(filas, contexto);
  return {
    ok: true,
    nombreArchivo: nombreArchivo607(entrada.periodo),
    mime: MIME_EXCEL,
    contenidoBase64: Buffer.from(libro).toString("base64"),
  };
}
