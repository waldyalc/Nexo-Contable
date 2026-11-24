"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hoySantoDomingo } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import catalogoBase from "../../../../data/catalogo-base.json";

export type ResultadoAccion =
  | { ok: true; mensaje: string; empresaId?: string }
  | { ok: false; error: string };

export interface DatosEmpresaForm {
  nombreComercial: string;
  razonSocial: string;
  rnc: string;
  tipoEmpresa: string;
  direccion: string;
  telefono: string;
  correo: string;
  representanteLegal: string;
  actividadEconomica: string;
  fechaInicio: string;
  regimenFiscal: string;
  monedaFuncional: string;
  periodoFiscal: string;
}

export interface EntradaCrearEmpresa extends DatosEmpresaForm {
  cargarCatalogo: boolean;
}

export interface EntradaEditarEmpresa extends DatosEmpresaForm {
  id: string;
  estado: "active" | "inactive";
}

const texto = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`);

const correoOpcional = z
  .string()
  .trim()
  .max(160)
  .refine(
    (valor) => valor === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
    "Correo inválido.",
  );

const fechaOpcional = z
  .string()
  .trim()
  .refine(
    (valor) => valor === "" || /^\d{4}-\d{2}-\d{2}$/.test(valor),
    "Fecha inválida.",
  );

const esquemaBase = z.object({
  nombreComercial: z
    .string()
    .trim()
    .min(1, "El nombre comercial es obligatorio.")
    .max(160, "Máximo 160 caracteres."),
  razonSocial: z
    .string()
    .trim()
    .min(1, "La razón social es obligatoria.")
    .max(160, "Máximo 160 caracteres."),
  rnc: texto(20),
  tipoEmpresa: texto(80),
  direccion: texto(300),
  telefono: texto(30),
  correo: correoOpcional,
  representanteLegal: texto(160),
  actividadEconomica: texto(200),
  fechaInicio: fechaOpcional,
  regimenFiscal: z.enum([
    "ordinario",
    "simplificado",
    "renta_presuntiva",
    "zona_franca",
  ]),
  monedaFuncional: z.enum(["DOP", "USD"]),
  periodoFiscal: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{2}$/, "Periodo fiscal inválido."),
});

const esquemaCrear = esquemaBase.extend({
  cargarCatalogo: z.boolean(),
});

const esquemaEditar = esquemaBase.extend({
  id: z.string().uuid("Empresa inválida."),
  estado: z.enum(["active", "inactive"]),
});

function parametrosEmpresa(datos: z.infer<typeof esquemaBase>) {
  return {
    p_nombre_comercial: datos.nombreComercial,
    p_razon_social: datos.razonSocial,
    p_rnc: datos.rnc,
    p_tipo_empresa: datos.tipoEmpresa,
    p_direccion: datos.direccion,
    p_telefono: datos.telefono,
    p_correo: datos.correo,
    p_representante_legal: datos.representanteLegal,
    p_actividad_economica: datos.actividadEconomica,
    p_fecha_inicio: datos.fechaInicio === "" ? null : datos.fechaInicio,
    p_regimen_fiscal: datos.regimenFiscal,
    p_moneda_funcional: datos.monedaFuncional,
    p_periodo_fiscal: datos.periodoFiscal,
  };
}

function refrescarListas() {
  revalidatePath("/empresas");
  revalidatePath("/dashboard");
  revalidatePath("/usuarios");
}

async function abrirPeriodoFiscal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<string | null> {
  const anio = hoySantoDomingo().slice(0, 4);

  const { error } = await supabase.rpc("crear_periodo_contable", {
    p_empresa_id: empresaId,
    p_nombre: `Periodo fiscal ${anio}`,
    p_fecha_inicio: `${anio}-01-01`,
    p_fecha_fin: `${anio}-12-31`,
  });

  return error ? `período fiscal (${error.message})` : null;
}

export async function crearEmpresaAction(
  datos: EntradaCrearEmpresa,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaCrear.safeParse(datos);

  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos de la empresa.",
    };
  }

  const { cargarCatalogo, ...empresa } = resultado.data;

  const { data, error } = await supabase.rpc("crear_empresa", {
    ...parametrosEmpresa(empresa),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (typeof data !== "string") {
    return { ok: false, error: "No pudimos obtener la empresa creada." };
  }

  const empresaId = data;
  const advertencias: string[] = [];

  if (cargarCatalogo) {
    const { error: errorCatalogo } = await supabase.rpc(
      "importar_catalogo_cuentas",
      { p_empresa_id: empresaId, p_cuentas: catalogoBase },
    );

    if (errorCatalogo) {
      advertencias.push(`catálogo base (${errorCatalogo.message})`);
    }

    const advertenciaPeriodo = await abrirPeriodoFiscal(supabase, empresaId);

    if (advertenciaPeriodo) {
      advertencias.push(advertenciaPeriodo);
    }
  }

  refrescarListas();

  if (advertencias.length > 0) {
    return {
      ok: true,
      empresaId,
      mensaje: `Empresa creada, pero faltó completar: ${advertencias.join("; ")}.`,
    };
  }

  return {
    ok: true,
    empresaId,
    mensaje: cargarCatalogo
      ? "Empresa creada con el catálogo base y su período fiscal abierto."
      : "Empresa creada correctamente.",
  };
}

export async function actualizarEmpresaAction(
  datos: EntradaEditarEmpresa,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaEditar.safeParse(datos);

  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos de la empresa.",
    };
  }

  const { id, estado, ...empresa } = resultado.data;

  const { error } = await supabase.rpc("actualizar_empresa", {
    p_empresa_id: id,
    p_estado: estado,
    ...parametrosEmpresa(empresa),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refrescarListas();

  return { ok: true, mensaje: "Empresa actualizada correctamente." };
}

export async function marcarEmpresaPrincipalAction(
  empresaId: string,
): Promise<ResultadoAccion> {
  const identificador = z.string().uuid().safeParse(empresaId);

  if (!identificador.success) {
    return { ok: false, error: "Empresa inválida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const { error } = await supabase.rpc("marcar_empresa_principal", {
    p_empresa_id: identificador.data,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refrescarListas();

  return { ok: true, mensaje: "Empresa marcada como principal." };
}
