"use client";

import {
  IconDots,
  IconKey,
  IconLoader2,
  IconPencil,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUserPlus,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  actualizarUsuarioAction,
  asignarEmpresaUsuarioAction,
  removerEmpresaUsuarioAction,
} from "@/app/(app)/usuarios/actions";
import { FormField } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { ETIQUETAS_ROL, iniciales } from "@/components/shell/navegacion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { RolContexto } from "@/lib/auth/sesion";

import { DialogoCrearUsuario } from "./dialogo-crear-usuario";
import { DialogoRestablecerPassword } from "./dialogo-restablecer-password";
import { OPCIONES_ROL_EMPRESA, OPCIONES_ROL_GLOBAL } from "./opciones-roles";
import type { EmpresaDisponible } from "./tipos";

const OPCIONES_FILTRO_ESTADO = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

export interface AsignacionUsuario {
  empresaId: string;
  empresaNombre: string;
  rol: string;
  esPrincipal: boolean;
}

export interface UsuarioListado {
  userId: string;
  email: string;
  nombre: string;
  rolGlobal: "admin_global" | "usuario";
  activo: boolean;
  debeDefinirPassword: boolean;
  asignaciones: AsignacionUsuario[];
}

export type { EmpresaDisponible };

function etiquetaRol(rol: string): string {
  if (
    rol === "admin_global" ||
    rol === "admin_empresa" ||
    rol === "contador" ||
    rol === "auxiliar" ||
    rol === "cliente" ||
    rol === "usuario"
  ) {
    return ETIQUETAS_ROL[rol as RolContexto];
  }
  return rol;
}

function MonogramaUsuario({ nombre }: { nombre: string }) {
  return (
    <span className="font-display flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
      {iniciales(nombre)}
    </span>
  );
}

export interface UsuariosVistaProps {
  usuarios: readonly UsuarioListado[];
  empresasDisponibles: readonly EmpresaDisponible[];
  esAdminGlobal: boolean;
  usuarioActualId: string;
}

export function UsuariosVista({
  usuarios,
  empresasDisponibles,
  esAdminGlobal,
  usuarioActualId,
}: UsuariosVistaProps) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [usuarioEdicion, setUsuarioEdicion] = useState<UsuarioListado | null>(
    null,
  );
  const [usuarioAsignacion, setUsuarioAsignacion] =
    useState<UsuarioListado | null>(null);
  const [usuarioPassword, setUsuarioPassword] = useState<UsuarioListado | null>(
    null,
  );
  const [creandoUsuario, setCreandoUsuario] = useState(false);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const cumpleEstado =
        estadoFiltro === "" ||
        (estadoFiltro === "active" ? usuario.activo : !usuario.activo);
      if (!cumpleEstado) return false;
      if (termino === "") return true;

      const empresas = usuario.asignaciones
        .map((asignacion) => asignacion.empresaNombre.toLowerCase())
        .join(" ");

      return (
        usuario.nombre.toLowerCase().includes(termino) ||
        usuario.email.toLowerCase().includes(termino) ||
        etiquetaRol(usuario.rolGlobal).toLowerCase().includes(termino) ||
        empresas.includes(termino)
      );
    });
  }, [usuarios, busqueda, estadoFiltro]);

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Perfiles de la firma, su rol global y las empresas donde participan."
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Usuarios" }]}
        acciones={
          <Button variant="outline" onClick={() => router.refresh()}>
            <IconRefresh className="size-4" />
            Actualizar
          </Button>
        }
      />

      <TarjetaLista data-lista="usuarios">
        <BarraLista
          titulo="Listado de usuarios"
          descripcion={`${filtrados.length} de ${usuarios.length} usuarios`}
          acciones={
            esAdminGlobal ? (
              <Button onClick={() => setCreandoUsuario(true)}>
                <IconUserPlus className="size-4" />
                Nuevo usuario
              </Button>
            ) : undefined
          }
          filtros={
            <>
              <div className="relative w-full sm:max-w-xs">
                <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar por nombre, correo o empresa…"
                  aria-label="Buscar usuarios"
                  className="h-9 pl-8"
                />
              </div>
              <SelectCampo
                id="filtro-estado-usuario"
                opciones={OPCIONES_FILTRO_ESTADO}
                valor={estadoFiltro}
                onCambio={setEstadoFiltro}
                etiquetaVacia="Todos"
                className="w-[150px]"
                aria-label="Filtrar por estado"
              />
            </>
          }
        >
          <TablaLista<UsuarioListado>
            filas={filtrados}
            claveFila={(usuario) => usuario.userId}
            ordenable
            paginacion={{ tamanoPagina: 10, etiqueta: "usuarios" }}
            vacio={{
              titulo: "Sin usuarios",
              descripcion:
                "Crea usuarios confirmados desde Nuevo usuario y gestiona sus roles y accesos aquí.",
              icono: <IconUsersGroup className="size-8" />,
            }}
            columnas={[
              {
                clave: "usuario",
                encabezado: "Usuario",
                celda: (usuario) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <MonogramaUsuario
                      nombre={
                        usuario.nombre.trim() === ""
                          ? usuario.email
                          : usuario.nombre
                      }
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-foreground">
                          {usuario.nombre.trim() === ""
                            ? usuario.email
                            : usuario.nombre}
                        </span>
                        {usuario.userId === usuarioActualId ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Tú
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {usuario.email}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                clave: "rolGlobal",
                encabezado: "Rol global",
                celda: (usuario) => (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {etiquetaRol(usuario.rolGlobal)}
                  </span>
                ),
              },
              {
                clave: "empresas",
                encabezado: "Empresas",
                ordenable: false,
                celda: (usuario) =>
                  usuario.asignaciones.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Sin empresas
                    </span>
                  ) : (
                    <div className="flex max-w-[320px] flex-wrap gap-1">
                      {usuario.asignaciones.slice(0, 3).map((asignacion) => (
                        <span
                          key={asignacion.empresaId}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                        >
                          {asignacion.empresaNombre}
                          <span className="text-[10px] font-normal opacity-80">
                            · {etiquetaRol(asignacion.rol)}
                          </span>
                          {asignacion.esPrincipal ? (
                            <span className="text-[10px]">★</span>
                          ) : null}
                        </span>
                      ))}
                      {usuario.asignaciones.length > 3 ? (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          +{usuario.asignaciones.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (usuario) => (
                  <PillEstado estado={usuario.activo ? "activo" : "inactivo"} />
                ),
              },
              {
                clave: "password",
                encabezado: "Contraseña",
                celda: (usuario) =>
                  usuario.debeDefinirPassword ? (
                    <PillEstado estado="por definir" tono="pendiente" />
                  ) : (
                    <PillEstado estado="definida" tono="exito" />
                  ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (usuario) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${usuario.email}`}
                        />
                      }
                    >
                      <IconDots className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem
                        onClick={() => setUsuarioAsignacion(usuario)}
                      >
                        <IconUserPlus className="size-4" />
                        Asignar empresa
                      </DropdownMenuItem>
                      {esAdminGlobal ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setUsuarioEdicion(usuario)}
                          >
                            <IconPencil className="size-4" />
                            Editar usuario
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setUsuarioPassword(usuario)}
                          >
                            <IconKey className="size-4" />
                            Restablecer contraseña
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <DialogoEditarUsuario
        abierto={usuarioEdicion !== null}
        usuario={usuarioEdicion}
        onOpenChange={(abierto) => {
          if (!abierto) setUsuarioEdicion(null);
        }}
      />

      <DialogoAsignarEmpresa
        abierto={usuarioAsignacion !== null}
        usuario={usuarioAsignacion}
        empresasDisponibles={empresasDisponibles}
        onOpenChange={(abierto) => {
          if (!abierto) setUsuarioAsignacion(null);
        }}
      />

      <DialogoCrearUsuario
        abierto={creandoUsuario}
        empresasDisponibles={empresasDisponibles}
        onOpenChange={setCreandoUsuario}
      />

      <DialogoRestablecerPassword
        abierto={usuarioPassword !== null}
        usuario={usuarioPassword}
        onOpenChange={(abierto) => {
          if (!abierto) setUsuarioPassword(null);
        }}
      />
    </>
  );
}

interface DialogoEditarUsuarioProps {
  abierto: boolean;
  usuario: UsuarioListado | null;
  onOpenChange: (abierto: boolean) => void;
}

function DialogoEditarUsuario({
  abierto,
  usuario,
  onOpenChange,
}: DialogoEditarUsuarioProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [rolGlobal, setRolGlobal] = useState<"admin_global" | "usuario">(
    "usuario",
  );
  const [activo, setActivo] = useState(true);
  const [debeDefinirPassword, setDebeDefinirPassword] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto || !usuario) return;
    setNombre(usuario.nombre);
    setRolGlobal(usuario.rolGlobal);
    setActivo(usuario.activo);
    setDebeDefinirPassword(usuario.debeDefinirPassword);
    setErrorGeneral(null);
    setGuardando(false);
  }, [abierto, usuario]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!usuario || guardando) return;

    setGuardando(true);
    setErrorGeneral(null);

    const resultado = await actualizarUsuarioAction({
      userId: usuario.userId,
      nombre,
      rolGlobal,
      activo,
      debeDefinirPassword,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setErrorGeneral(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              {usuario?.email ?? ""} · Los cambios aplican de inmediato.
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

          <div className="flex flex-col gap-4">
            <FormField htmlFor="usuario-nombre" label="Nombre">
              <Input
                id="usuario-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                placeholder="Nombre y apellido"
              />
            </FormField>

            <FormField htmlFor="usuario-rol" label="Rol global" required>
              <SelectCampo
                id="usuario-rol"
                opciones={OPCIONES_ROL_GLOBAL}
                valor={rolGlobal}
                onCambio={(valor) =>
                  setRolGlobal(
                    valor === "admin_global" ? "admin_global" : "usuario",
                  )
                }
                requerido
                aria-label="Rol global"
              />
            </FormField>

            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="usuario-activo">Usuario activo</Label>
                <p className="text-xs text-muted-foreground">
                  Un usuario inactivo no puede iniciar sesión.
                </p>
              </div>
              <Switch
                id="usuario-activo"
                checked={activo}
                onCheckedChange={(valor) => setActivo(valor)}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="usuario-password">
                  Debe definir contraseña
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se le pedirá crear su clave personal en el próximo ingreso.
                </p>
              </div>
              <Switch
                id="usuario-password"
                checked={debeDefinirPassword}
                onCheckedChange={(valor) => setDebeDefinirPassword(valor)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoAsignarEmpresaProps {
  abierto: boolean;
  usuario: UsuarioListado | null;
  empresasDisponibles: readonly EmpresaDisponible[];
  onOpenChange: (abierto: boolean) => void;
}

function DialogoAsignarEmpresa({
  abierto,
  usuario,
  empresasDisponibles,
  onOpenChange,
}: DialogoAsignarEmpresaProps) {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<AsignacionUsuario[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [rol, setRol] = useState("contador");
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [removiendo, setRemoviendo] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !usuario) return;
    setAsignaciones(usuario.asignaciones);
    setEmpresaId("");
    setRol("contador");
    setEsPrincipal(false);
    setErrorGeneral(null);
    setGuardando(false);
    setRemoviendo(null);
  }, [abierto, usuario]);

  const opcionesEmpresas = empresasDisponibles.map((empresa) => ({
    value: empresa.id,
    label: empresa.nombreComercial,
  }));

  async function asignar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!usuario || guardando) return;

    if (empresaId === "") {
      setErrorGeneral("Selecciona la empresa que quieres asignar.");
      return;
    }

    const empresa = empresasDisponibles.find(
      (disponible) => disponible.id === empresaId,
    );

    setGuardando(true);
    setErrorGeneral(null);

    const resultado = await asignarEmpresaUsuarioAction({
      userId: usuario.userId,
      empresaId,
      rol,
      esPrincipal,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setErrorGeneral(resultado.error);
      return;
    }

    setAsignaciones((anteriores) => {
      const resto = anteriores
        .filter((asignacion) => asignacion.empresaId !== empresaId)
        .map((asignacion) =>
          esPrincipal ? { ...asignacion, esPrincipal: false } : asignacion,
        );

      return [
        ...resto,
        {
          empresaId,
          empresaNombre: empresa?.nombreComercial ?? "Empresa",
          rol,
          esPrincipal,
        },
      ];
    });
    setEmpresaId("");
    setEsPrincipal(false);
    toast.success(resultado.mensaje);
    router.refresh();
  }

  async function remover(asignacion: AsignacionUsuario) {
    if (!usuario) return;

    const clave = `${asignacion.empresaId}`;
    setRemoviendo(clave);
    const resultado = await removerEmpresaUsuarioAction({
      userId: usuario.userId,
      empresaId: asignacion.empresaId,
    });
    setRemoviendo(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    setAsignaciones((anteriores) =>
      anteriores.filter((actual) => actual.empresaId !== asignacion.empresaId),
    );
    toast.success(resultado.mensaje);
    router.refresh();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Asignar empresa y rol</DialogTitle>
          <DialogDescription>
            {usuario?.nombre.trim() === "" || usuario === null
              ? (usuario?.email ?? "")
              : `${usuario.nombre} · ${usuario.email}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Accesos actuales
          </p>
          {asignaciones.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              Este usuario todavía no tiene empresas asignadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {asignaciones.map((asignacion) => (
                <li
                  key={asignacion.empresaId}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {asignacion.empresaNombre}
                      </span>
                      {asignacion.esPrincipal ? (
                        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          Principal
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {etiquetaRol(asignacion.rol)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remover ${asignacion.empresaNombre}`}
                    disabled={removiendo !== null}
                    onClick={() => void remover(asignacion)}
                  >
                    {removiendo === asignacion.empresaId ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconTrash className="size-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <form className="flex flex-col gap-4" onSubmit={asignar} noValidate>
          {errorGeneral ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errorGeneral}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="asignar-empresa" label="Empresa" required>
              <SelectCampo
                id="asignar-empresa"
                opciones={opcionesEmpresas}
                valor={empresaId}
                onCambio={setEmpresaId}
                etiquetaVacia="Selecciona una empresa"
                buscable={empresasDisponibles.length > 6}
                requerido
                aria-label="Empresa a asignar"
              />
            </FormField>

            <FormField htmlFor="asignar-rol" label="Rol en la empresa" required>
              <SelectCampo
                id="asignar-rol"
                opciones={OPCIONES_ROL_EMPRESA}
                valor={rol}
                onCambio={setRol}
                requerido
                aria-label="Rol en la empresa"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="asignar-principal">Empresa principal</Label>
              <p className="text-xs text-muted-foreground">
                Será la empresa que se abra por defecto al iniciar sesión.
              </p>
            </div>
            <Switch
              id="asignar-principal"
              checked={esPrincipal}
              onCheckedChange={(valor) => setEsPrincipal(valor)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Asignando…
                </>
              ) : (
                "Asignar empresa"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
