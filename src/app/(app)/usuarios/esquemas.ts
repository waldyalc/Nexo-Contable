import { z } from "zod";

export const ROLES_EMPRESA_ASIGNABLES = [
  "admin_empresa",
  "contador",
  "auxiliar",
  "cliente",
] as const;

const LONGITUD_MAXIMA_PASSWORD_BYTES = 72;

function longitudPasswordCaracteres(valor: string): number {
  return Array.from(valor).length;
}

function longitudPasswordBytes(valor: string): number {
  return new TextEncoder().encode(valor).length;
}

const esquemaPasswordAdministrada = z
  .string()
  .refine(
    (valor) => longitudPasswordCaracteres(valor) >= 12,
    "La contraseña debe tener al menos 12 caracteres.",
  )
  .refine(
    (valor) => longitudPasswordBytes(valor) <= LONGITUD_MAXIMA_PASSWORD_BYTES,
    "La contraseña no puede superar 72 caracteres.",
  );

export const esquemaAsignacionEmpresaUsuario = z.object({
  empresaId: z.string().uuid("Empresa inválida."),
  rol: z.enum(ROLES_EMPRESA_ASIGNABLES, {
    errorMap: () => ({ message: "Rol de empresa inválido." }),
  }),
});

export const esquemaCrearUsuario = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(160, "El nombre no puede superar 160 caracteres."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "El correo es obligatorio.")
      .max(320, "El correo no puede superar 320 caracteres.")
      .email("El correo no tiene un formato válido."),
    password: esquemaPasswordAdministrada,
    rolGlobal: z.enum(["admin_global", "usuario"], {
      errorMap: () => ({ message: "Rol global inválido." }),
    }),
    activo: z.boolean(),
    empresas: z
      .array(esquemaAsignacionEmpresaUsuario)
      .max(100, "No se pueden asignar más de 100 empresas."),
  })
  .superRefine((valor, contexto) => {
    const ids = new Set<string>();
    for (const empresa of valor.empresas) {
      const id = empresa.empresaId.toLowerCase();
      if (ids.has(id)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["empresas"],
          message: "No repitas la misma empresa en la asignación.",
        });
        return;
      }
      ids.add(id);
    }
  });

export const esquemaRestablecerPasswordUsuario = z.object({
  userId: z.string().uuid("Usuario inválido."),
  password: esquemaPasswordAdministrada,
});

export type DatosCrearUsuario = z.infer<typeof esquemaCrearUsuario>;
export type DatosRestablecerPasswordUsuario = z.infer<
  typeof esquemaRestablecerPasswordUsuario
>;
