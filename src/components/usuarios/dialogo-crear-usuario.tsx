"use client";

import { IconLoader2, IconUserPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { crearUsuarioAction } from "@/app/(app)/usuarios/actions";
import {
  type DatosCrearUsuario,
  esquemaCrearUsuario,
} from "@/app/(app)/usuarios/esquemas";
import { FormField } from "@/components/formularios/form-card";
import {
  DialogoConfirmarDescarte,
  formularioTieneCambios,
} from "@/components/operaciones/dialogos-cartera";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { RolEmpresa } from "@/lib/auth/sesion";

import { CampoPassword } from "./campo-password";
import { OPCIONES_ROL_EMPRESA, OPCIONES_ROL_GLOBAL } from "./opciones-roles";
import type { EmpresaDisponible } from "./tipos";

interface FormularioCreacion {
  nombre: string;
  email: string;
  password: string;
  rolGlobal: "admin_global" | "usuario";
  activo: boolean;
}

const FORMULARIO_INICIAL: FormularioCreacion = {
  nombre: "",
  email: "",
  password: "",
  rolGlobal: "usuario",
  activo: true,
};

type CampoConError = "nombre" | "email" | "password" | "empresas";
type ErroresCreacion = Partial<Record<CampoConError, string>>;

function normalizarRolEmpresa(valor: string): RolEmpresa {
  if (
    valor === "admin_empresa" ||
    valor === "contador" ||
    valor === "auxiliar" ||
    valor === "cliente"
  ) {
    return valor;
  }
  return "contador";
}

export interface DialogoCrearUsuarioProps {
  abierto: boolean;
  empresasDisponibles: readonly EmpresaDisponible[];
  onOpenChange: (abierto: boolean) => void;
}

export function DialogoCrearUsuario({
  abierto,
  empresasDisponibles,
  onOpenChange,
}: DialogoCrearUsuarioProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormularioCreacion>(FORMULARIO_INICIAL);
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<string[]>(
    [],
  );
  const [rolesEmpresas, setRolesEmpresas] = useState<
    Record<string, RolEmpresa | undefined>
  >({});
  const [erroresCampos, setErroresCampos] = useState<ErroresCreacion>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (!abierto) {
      setConfirmandoDescarte(false);
      return;
    }

    setForm(FORMULARIO_INICIAL);
    setEmpresasSeleccionadas([]);
    setRolesEmpresas({});
    setErroresCampos({});
    setErrorGeneral(null);
    setGuardando(enviandoRef.current);
  }, [abierto]);

  function actualizar<C extends keyof FormularioCreacion>(
    campo: C,
    valor: FormularioCreacion[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
    setErroresCampos((anteriores) => {
      if (campo === "nombre") return { ...anteriores, nombre: undefined };
      if (campo === "email") return { ...anteriores, email: undefined };
      if (campo === "password") return { ...anteriores, password: undefined };
      return anteriores;
    });
  }

  function alternarEmpresa(empresaId: string, seleccionada: boolean) {
    setEmpresasSeleccionadas((anteriores) => {
      if (seleccionada) {
        return anteriores.includes(empresaId)
          ? anteriores
          : [...anteriores, empresaId];
      }
      return anteriores.filter((actual) => actual !== empresaId);
    });

    setRolesEmpresas((anteriores) => ({
      ...anteriores,
      [empresaId]: seleccionada
        ? (anteriores[empresaId] ?? "contador")
        : undefined,
    }));

    setErroresCampos((anteriores) =>
      anteriores.empresas ? { ...anteriores, empresas: undefined } : anteriores,
    );
  }

  function construirAsignaciones(): DatosCrearUsuario["empresas"] {
    return empresasDisponibles
      .filter((empresa) => empresasSeleccionadas.includes(empresa.id))
      .map((empresa) => ({
        empresaId: empresa.id,
        rol: rolesEmpresas[empresa.id] ?? "contador",
      }));
  }

  const hayCambios =
    formularioTieneCambios(form, FORMULARIO_INICIAL) ||
    empresasSeleccionadas.length > 0;

  function solicitarCierre(
    siguienteAbierto: boolean,
    cancelarEvento?: () => void,
  ) {
    if (siguienteAbierto) {
      onOpenChange(true);
      return;
    }
    if (enviandoRef.current || guardando) {
      cancelarEvento?.();
      return;
    }
    if (hayCambios) {
      cancelarEvento?.();
      setConfirmandoDescarte(true);
      return;
    }
    onOpenChange(false);
  }

  function descartarCambios() {
    setConfirmandoDescarte(false);
    onOpenChange(false);
  }

  function extraerErroresCampos(error: unknown): ErroresCreacion {
    if (typeof error !== "object" || error === null || !("issues" in error)) {
      return {};
    }

    const issues = (error as { issues?: unknown }).issues;
    if (!Array.isArray(issues)) return {};

    const errores: ErroresCreacion = {};
    for (const issue of issues) {
      if (typeof issue !== "object" || issue === null) continue;
      const registro = issue as { path?: unknown; message?: unknown };
      const campo = Array.isArray(registro.path) ? registro.path[0] : null;
      const mensaje =
        typeof registro.message === "string" ? registro.message : null;
      if (!mensaje) continue;
      if (campo === "nombre" && errores.nombre === undefined) {
        errores.nombre = mensaje;
      } else if (campo === "email" && errores.email === undefined) {
        errores.email = mensaje;
      } else if (campo === "password" && errores.password === undefined) {
        errores.password = mensaje;
      } else if (campo === "empresas" && errores.empresas === undefined) {
        errores.empresas = mensaje;
      }
    }
    return errores;
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || guardando) return;

    const validacion = esquemaCrearUsuario.safeParse({
      ...form,
      empresas: construirAsignaciones(),
    });

    if (!validacion.success) {
      setErroresCampos(extraerErroresCampos(validacion.error));
      setErrorGeneral("Revisa los campos marcados antes de crear el usuario.");
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setErrorGeneral(null);

    try {
      const resultado = await crearUsuarioAction(validacion.data);

      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      onOpenChange(false);
      router.refresh();
    } catch {
      setErrorGeneral("No pudimos crear el usuario. Inténtalo de nuevo.");
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguienteAbierto, detalles) =>
        solicitarCierre(siguienteAbierto, () => detalles.cancel())
      }
    >
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              La cuenta quedará confirmada sin enviar correos. Guarda la
              contraseña y compártela por un canal seguro.
            </DialogDescription>
          </DialogHeader>

          {errorGeneral ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errorGeneral}
            </p>
          ) : null}

          <div className="max-h-[62vh] overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                htmlFor="crear-usuario-nombre"
                label="Nombre"
                required
                error={erroresCampos.nombre}
              >
                <Input
                  id="crear-usuario-nombre"
                  value={form.nombre}
                  onChange={(evento) =>
                    actualizar("nombre", evento.target.value)
                  }
                  placeholder="Nombre y apellido"
                  autoComplete="off"
                  disabled={guardando}
                  aria-invalid={Boolean(erroresCampos.nombre)}
                />
              </FormField>

              <FormField
                htmlFor="crear-usuario-email"
                label="Correo"
                required
                error={erroresCampos.email}
              >
                <Input
                  id="crear-usuario-email"
                  type="email"
                  value={form.email}
                  onChange={(evento) =>
                    actualizar("email", evento.target.value)
                  }
                  placeholder="usuario@empresa.com"
                  autoComplete="off"
                  disabled={guardando}
                  aria-invalid={Boolean(erroresCampos.email)}
                />
              </FormField>

              <FormField
                htmlFor="crear-usuario-password"
                label="Contraseña"
                required
                error={erroresCampos.password}
                className="sm:col-span-2"
              >
                <CampoPassword
                  id="crear-usuario-password"
                  valor={form.password}
                  onCambio={(valor) => actualizar("password", valor)}
                  deshabilitado={guardando}
                  invalido={Boolean(erroresCampos.password)}
                  descritoPor={
                    erroresCampos.password
                      ? "crear-usuario-password-error"
                      : "crear-usuario-password-hint"
                  }
                />
                <p
                  id="crear-usuario-password-hint"
                  className="text-xs text-muted-foreground"
                >
                  Mínimo 12 caracteres. Generar crea una clave aleatoria de 16
                  caracteres y la deja visible para copiarla.
                </p>
              </FormField>

              <FormField
                htmlFor="crear-usuario-rol"
                label="Rol global"
                required
              >
                <SelectCampo
                  id="crear-usuario-rol"
                  opciones={OPCIONES_ROL_GLOBAL}
                  valor={form.rolGlobal}
                  onCambio={(valor) =>
                    actualizar(
                      "rolGlobal",
                      valor === "admin_global" ? "admin_global" : "usuario",
                    )
                  }
                  requerido
                  deshabilitado={guardando}
                  aria-label="Rol global del nuevo usuario"
                />
              </FormField>

              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="crear-usuario-activo">Usuario activo</Label>
                  <p className="text-xs text-muted-foreground">
                    Si lo desactivas, no podrá iniciar sesión.
                  </p>
                </div>
                <Switch
                  id="crear-usuario-activo"
                  checked={form.activo}
                  onCheckedChange={(valor) => actualizar("activo", valor)}
                  disabled={guardando}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium text-foreground">
                  Empresas asignadas
                </h3>
                <p className="text-xs text-muted-foreground">
                  Opcional para administradores globales. Si asignas varias, la
                  primera empresa activa de esta lista quedará como principal.
                </p>
              </div>

              {erroresCampos.empresas ? (
                <p role="alert" className="text-xs text-destructive">
                  {erroresCampos.empresas}
                </p>
              ) : null}

              {empresasDisponibles.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                  No hay empresas activas disponibles para asignar.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-[10px] border border-border">
                  <ul className="divide-y divide-border">
                    {empresasDisponibles.map((empresa) => {
                      const seleccionada = empresasSeleccionadas.includes(
                        empresa.id,
                      );
                      const rolActual = rolesEmpresas[empresa.id] ?? "contador";

                      return (
                        <li
                          key={empresa.id}
                          className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <label
                            htmlFor={`crear-usuario-empresa-${empresa.id}`}
                            className="flex min-w-0 cursor-pointer items-center gap-2.5"
                          >
                            <Checkbox
                              id={`crear-usuario-empresa-${empresa.id}`}
                              checked={seleccionada}
                              onCheckedChange={(valor) =>
                                alternarEmpresa(empresa.id, valor)
                              }
                              disabled={guardando}
                            />
                            <span className="truncate text-sm font-medium text-foreground">
                              {empresa.nombreComercial}
                            </span>
                          </label>

                          {seleccionada ? (
                            <SelectCampo
                              id={`crear-usuario-rol-empresa-${empresa.id}`}
                              opciones={OPCIONES_ROL_EMPRESA}
                              valor={rolActual}
                              onCambio={(valor) =>
                                setRolesEmpresas((anteriores) => ({
                                  ...anteriores,
                                  [empresa.id]: normalizarRolEmpresa(valor),
                                }))
                              }
                              requerido
                              deshabilitado={guardando}
                              className="w-full sm:w-52"
                              aria-label={`Rol en ${empresa.nombreComercial}`}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => solicitarCierre(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Creando…
                </>
              ) : (
                <>
                  <IconUserPlus className="size-4" />
                  Crear usuario
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <DialogoConfirmarDescarte
        abierto={confirmandoDescarte}
        onOpenChange={setConfirmandoDescarte}
        onDescartar={descartarCambios}
      />
    </Dialog>
  );
}
