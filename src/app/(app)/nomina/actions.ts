"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export type ResultadoNomina =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export interface DatosEmpleado {
  empresaId: string;
  id: string | null;
  codigo: string;
  nombre: string;
  cedula: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  salarioMensual: number;
  activo: boolean;
}

export interface DetalleNomina {
  empleadoId: string;
  salarioBruto: number;
  deducciones: number;
}

export interface DatosCorridaNomina {
  empresaId: string;
  /** Periodo en formato `aaaa-mm`. */
  periodo: string;
  fechaPago: string;
  cuentaGastoId: string;
  cuentaRetencionesId: string;
  cuentaPagoId: string;
  descripcion: string;
  detalles: DetalleNomina[];
}

export interface DatosAnulacionNomina {
  empresaId: string;
  corridaId: string;
  fechaAnulacion: string;
  motivo: string;
}

const identificador = z.string().uuid("Identificador inválido.");
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato aaaa-mm-dd.");
const texto = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`);
const montoNoNegativo = z
  .number()
  .finite("Monto inválido.")
  .nonnegative("El monto no puede ser negativo.");

const esquemaEmpleado = z.object({
  empresaId: identificador,
  id: identificador.nullable(),
  codigo: z
    .string()
    .trim()
    .min(1, "El código del empleado es obligatorio.")
    .max(40, "Máximo 40 caracteres."),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del empleado es obligatorio.")
    .max(160, "Máximo 160 caracteres."),
  cedula: texto(20),
  cargo: texto(80),
  departamento: texto(80),
  fechaIngreso: fecha,
  salarioMensual: montoNoNegativo,
  activo: z.boolean(),
});

const esquemaDetalle = z.object({
  empleadoId: identificador,
  salarioBruto: montoNoNegativo,
  deducciones: montoNoNegativo,
});

const esquemaCorrida = z.object({
  empresaId: identificador,
  periodo: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Selecciona el periodo de la nómina."),
  fechaPago: fecha,
  cuentaGastoId: identificador,
  cuentaRetencionesId: z.union([identificador, z.literal("")]),
  cuentaPagoId: identificador,
  descripcion: texto(200),
  detalles: z
    .array(esquemaDetalle)
    .min(1, "La corrida requiere al menos un empleado."),
});

const esquemaAnulacion = z.object({
  empresaId: identificador,
  corridaId: identificador,
  fechaAnulacion: fecha,
  motivo: z
    .string()
    .trim()
    .min(5, "Escribe el motivo de la anulación.")
    .max(300, "Máximo 300 caracteres."),
});

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return supabase;
}

function refrescar() {
  revalidatePath("/nomina");
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos enviados.";
}

export async function guardarEmpleadoAction(
  datos: DatosEmpleado,
): Promise<ResultadoNomina> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaEmpleado.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const empleado = resultado.data;
  const { error } = await supabase.rpc("guardar_empleado", {
    p_empresa_id: empleado.empresaId,
    p_id: empleado.id,
    p_codigo: empleado.codigo,
    p_nombre: empleado.nombre,
    p_cedula: empleado.cedula,
    p_cargo: empleado.cargo,
    p_departamento: empleado.departamento,
    p_fecha_ingreso: empleado.fechaIngreso,
    p_salario_mensual: empleado.salarioMensual,
    p_activo: empleado.activo,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return {
    ok: true,
    mensaje:
      empleado.id === null
        ? "Empleado creado correctamente."
        : "Empleado actualizado correctamente.",
  };
}

export async function contabilizarCorridaNominaAction(
  datos: DatosCorridaNomina,
): Promise<ResultadoNomina> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaCorrida.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const corrida = resultado.data;

  for (const detalle of corrida.detalles) {
    if (detalle.deducciones > detalle.salarioBruto) {
      return {
        ok: false,
        error:
          "Las deducciones de un empleado no pueden superar su salario bruto.",
      };
    }
  }

  const detalles: Json = corrida.detalles.map((detalle) => ({
    empleado_id: detalle.empleadoId,
    salario_bruto: detalle.salarioBruto,
    deducciones: detalle.deducciones,
  }));

  const { error } = await supabase.rpc("contabilizar_corrida_nomina", {
    p_empresa_id: corrida.empresaId,
    p_periodo: corrida.periodo.replace("-", ""),
    p_fecha_pago: corrida.fechaPago,
    p_cuenta_gasto_id: corrida.cuentaGastoId,
    p_cuenta_pago_id: corrida.cuentaPagoId,
    p_detalles: detalles,
    p_cuenta_retenciones_id:
      corrida.cuentaRetencionesId === "" ? null : corrida.cuentaRetencionesId,
    p_descripcion: corrida.descripcion,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return { ok: true, mensaje: "Corrida de nómina contabilizada." };
}

export async function anularCorridaNominaAction(
  datos: DatosAnulacionNomina,
): Promise<ResultadoNomina> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaAnulacion.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const anulacion = resultado.data;

  const { error } = await supabase.rpc("anular_corrida_nomina", {
    p_empresa_id: anulacion.empresaId,
    p_corrida_id: anulacion.corridaId,
    p_fecha_anulacion: anulacion.fechaAnulacion,
    p_motivo: anulacion.motivo,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return {
    ok: true,
    mensaje: "Corrida anulada con su asiento de reverso.",
  };
}
