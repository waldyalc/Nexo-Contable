"use client";

import {
  IconCheck,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconUserOff,
  IconUsers,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  type EntradaTercero,
  guardarTerceroAction,
  toggleTerceroActivoAction,
} from "@/app/(app)/gastos/terceros-actions";
import { useAccionOptimista } from "@/components/comunes/use-accion-optimista";
import { FormField } from "@/components/formularios/form-card";
import { PillEstado } from "@/components/listas/pill-estado";
import {
  DialogoConfirmarDescarte,
  formularioTieneCambios,
} from "@/components/operaciones/dialogos-cartera";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { DatosContribuyenteDgii } from "@/lib/dgii/consulta";
import { normalizarRnc } from "@/lib/formato";
import type {
  CuentaOpcion,
  TerceroListado,
  TipoTercero,
} from "@/lib/operaciones/tipos";
import { cn } from "@/lib/utils";

const OPCIONES_TIPO = [
  { value: "customer", label: "Cliente" },
  { value: "supplier", label: "Proveedor" },
  { value: "both", label: "Cliente y proveedor" },
];

const OPCIONES_FILTRO = [
  { value: "customer", label: "Clientes" },
  { value: "supplier", label: "Proveedores" },
  { value: "both", label: "Ambos" },
];

const ETIQUETAS_TIPO: Record<TipoTercero, string> = {
  customer: "Cliente",
  supplier: "Proveedor",
  both: "Cliente y proveedor",
};

type RespuestaDgii =
  | { ok: true; datos: DatosContribuyenteDgii }
  | { ok: false; error: string; mensaje: string };

interface FormTercero {
  tipo: TipoTercero;
  nombre: string;
  rnc: string;
  correo: string;
  telefono: string;
  direccion: string;
  cuentaPorPagarId: string;
  cuentaPorCobrarId: string;
  activo: boolean;
}

type AccionDescarteTerceros = "cancelar-formulario" | "cerrar-sheet";

function formInicial(
  tercero: TerceroListado | null,
  tipo: TipoTercero,
): FormTercero {
  if (!tercero) {
    return {
      tipo,
      nombre: "",
      rnc: "",
      correo: "",
      telefono: "",
      direccion: "",
      cuentaPorPagarId: "",
      cuentaPorCobrarId: "",
      activo: true,
    };
  }

  return {
    tipo: tercero.tipo,
    nombre: tercero.nombre,
    rnc: tercero.rnc,
    correo: tercero.correo,
    telefono: tercero.telefono,
    direccion: tercero.direccion,
    cuentaPorPagarId: tercero.cuentaPorPagarId ?? "",
    cuentaPorCobrarId: tercero.cuentaPorCobrarId ?? "",
    activo: tercero.activo,
  };
}

interface CambioActivoTercero {
  terceroId: string;
  activo: boolean;
}

function conCambioActivoTercero(
  actuales: readonly TerceroListado[],
  cambio: CambioActivoTercero,
): TerceroListado[] {
  return actuales.map((tercero) =>
    tercero.id === cambio.terceroId
      ? { ...tercero, activo: cambio.activo }
      : tercero,
  );
}

export interface TercerosSheetProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  terceros: readonly TerceroListado[];
  cuentas: readonly CuentaOpcion[];
  tipoInicial?: TipoTercero;
}

/**
 * Panel de terceros reutilizable desde Gastos y Facturación: lista, busca,
 * crea y edita clientes/proveedores, con el botón «Consultar DGII» que
 * autocompleta la razón social desde el padrón (nunca sobrescribe si el portal
 * falla).
 */
export function TercerosSheet({
  abierto,
  onOpenChange,
  empresaId,
  terceros,
  cuentas,
  tipoInicial = "supplier",
}: TercerosSheetProps) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [editando, setEditando] = useState<TerceroListado | null>(null);
  const [creando, setCreando] = useState(false);
  const [tercerosOptimistas, aplicarTerceroOptimista] = useOptimistic(
    terceros,
    conCambioActivoTercero,
  );
  const accionOptimista = useAccionOptimista();
  const [formularioSucio, setFormularioSucio] = useState(false);
  const [formularioGuardando, setFormularioGuardando] = useState(false);
  const [descartePendiente, setDescartePendiente] =
    useState<AccionDescarteTerceros | null>(null);
  const enFormulario = creando || editando !== null;

  const notificarEstadoFormulario = useCallback(
    (sucio: boolean, guardando: boolean) => {
      setFormularioSucio(sucio);
      setFormularioGuardando(guardando);
    },
    [],
  );

  useEffect(() => {
    if (!abierto) {
      setEditando(null);
      setCreando(false);
      setBusqueda("");
      setFiltroTipo("");
      setFormularioSucio(false);
      setFormularioGuardando(false);
      setDescartePendiente(null);
    }
  }, [abierto]);

  useEffect(() => {
    if (!enFormulario) {
      setFormularioSucio(false);
      setFormularioGuardando(false);
    }
  }, [enFormulario]);

  const opcionesCuentas = useMemo(
    () =>
      cuentas.map((cuenta) => ({
        value: cuenta.id,
        label: `${cuenta.codigo} · ${cuenta.nombre}`,
      })),
    [cuentas],
  );

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return tercerosOptimistas.filter((tercero) => {
      const coincideTipo =
        filtroTipo === "" ||
        tercero.tipo === filtroTipo ||
        tercero.tipo === "both";
      if (!coincideTipo) return false;
      if (termino === "") return true;
      return (
        tercero.nombre.toLowerCase().includes(termino) ||
        normalizarRnc(tercero.rnc).includes(normalizarRnc(termino))
      );
    });
  }, [tercerosOptimistas, busqueda, filtroTipo]);

  function alternarActivo(tercero: TerceroListado) {
    const activo = !tercero.activo;

    accionOptimista.ejecutar({
      clave: tercero.id,
      entrada: {
        empresaId,
        terceroId: tercero.id,
        activo,
      },
      aplicarOptimista: () =>
        aplicarTerceroOptimista({ terceroId: tercero.id, activo }),
      revertirOptimista: () =>
        aplicarTerceroOptimista({
          terceroId: tercero.id,
          activo: tercero.activo,
        }),
      accion: (entrada) => toggleTerceroActivoAction(entrada),
      mostrarExito: true,
      alExito: () => router.refresh(),
      mensajeErrorInesperado:
        "No pudimos cambiar el estado del tercero. Inténtalo de nuevo.",
    });
  }

  function salirFormulario() {
    setCreando(false);
    setEditando(null);
  }

  function solicitarCancelacionFormulario() {
    if (formularioGuardando) return;
    if (formularioSucio) {
      setDescartePendiente("cancelar-formulario");
      return;
    }
    salirFormulario();
  }

  function solicitarCierre(
    siguienteAbierto: boolean,
    cancelarEvento?: () => void,
  ) {
    if (siguienteAbierto) {
      onOpenChange(true);
      return;
    }
    if (formularioGuardando) {
      cancelarEvento?.();
      return;
    }
    if (enFormulario && formularioSucio) {
      cancelarEvento?.();
      setDescartePendiente("cerrar-sheet");
      return;
    }
    onOpenChange(false);
  }

  function descartarCambios() {
    const accion = descartePendiente;
    setDescartePendiente(null);
    if (accion === "cancelar-formulario") {
      salirFormulario();
      return;
    }
    if (accion === "cerrar-sheet") {
      onOpenChange(false);
    }
  }

  function cambiarConfirmacionDescarte(abiertoConfirmacion: boolean) {
    if (!abiertoConfirmacion) setDescartePendiente(null);
  }

  return (
    <Sheet
      open={abierto}
      onOpenChange={(siguienteAbierto, detalles) =>
        solicitarCierre(siguienteAbierto, () => detalles.cancel())
      }
    >
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>
            {enFormulario ? "Datos del tercero" : "Terceros"}
          </SheetTitle>
          <SheetDescription>
            {enFormulario
              ? "Completa el RNC con «Consultar DGII» para traer la razón social oficial."
              : "Clientes y proveedores compartidos entre Compras y Facturación."}
          </SheetDescription>
        </SheetHeader>

        {enFormulario ? (
          <FormularioTercero
            empresaId={empresaId}
            tercero={editando}
            tipoInicial={tipoInicial}
            opcionesCuentas={opcionesCuentas}
            onCancelar={solicitarCancelacionFormulario}
            onEstadoFormulario={notificarEstadoFormulario}
            onGuardado={() => {
              salirFormulario();
              router.refresh();
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
              <div className="relative min-w-0 flex-1">
                <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar por nombre o RNC…"
                  aria-label="Buscar terceros"
                  className="h-9 pl-8"
                />
              </div>
              <SelectCampo
                id="terceros-filtro-tipo"
                opciones={OPCIONES_FILTRO}
                valor={filtroTipo}
                onCambio={setFiltroTipo}
                etiquetaVacia="Todos"
                className="w-[150px]"
                aria-label="Filtrar por tipo"
              />
              <Button
                type="button"
                onClick={() => {
                  setEditando(null);
                  setCreando(true);
                }}
                className="h-9 whitespace-nowrap"
              >
                <IconPlus className="size-4" />
                Nuevo tercero
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtrados.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                    <IconUsers className="size-6" />
                  </span>
                  <p className="font-display text-base font-semibold text-foreground">
                    Sin terceros todavía
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Registra tu primer cliente o proveedor para emitir facturas
                    y compras.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtrados.map((tercero) => (
                    <li
                      key={tercero.id}
                      className="flex items-start justify-between gap-3 px-5 py-3"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {tercero.nombre}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {ETIQUETAS_TIPO[tercero.tipo]} ·{" "}
                          {tercero.rnc === "" ? "Sin RNC" : tercero.rnc}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <PillEstado
                          estado={tercero.activo ? "activo" : "inactivo"}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${tercero.nombre}`}
                          onClick={() => {
                            setCreando(false);
                            setEditando(tercero);
                          }}
                        >
                          <IconPencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${tercero.activo ? "Inactivar" : "Activar"} ${tercero.nombre}`}
                          disabled={accionOptimista.enCurso(tercero.id)}
                          onClick={() => alternarActivo(tercero)}
                        >
                          {accionOptimista.enCurso(tercero.id) ? (
                            <IconLoader2 className="size-4 animate-spin" />
                          ) : tercero.activo ? (
                            <IconUserOff className="size-4" />
                          ) : (
                            <IconCheck className="size-4" />
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SheetFooter className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              {filtrados.length} de {terceros.length} terceros
            </SheetFooter>
          </>
        )}
      </SheetContent>
      <DialogoConfirmarDescarte
        abierto={descartePendiente !== null}
        onOpenChange={cambiarConfirmacionDescarte}
        onDescartar={descartarCambios}
      />
    </Sheet>
  );
}

interface FormularioTerceroProps {
  empresaId: string;
  tercero: TerceroListado | null;
  tipoInicial: TipoTercero;
  opcionesCuentas: readonly { value: string; label: string }[];
  onCancelar: () => void;
  onEstadoFormulario: (sucio: boolean, guardando: boolean) => void;
  onGuardado: () => void;
}

function FormularioTercero({
  empresaId,
  tercero,
  tipoInicial,
  opcionesCuentas,
  onCancelar,
  onEstadoFormulario,
  onGuardado,
}: FormularioTerceroProps) {
  const [form, setForm] = useState<FormTercero>(
    formInicial(tercero, tipoInicial),
  );
  const [formReferencia, setFormReferencia] = useState<FormTercero>(
    formInicial(tercero, tipoInicial),
  );
  const [guardando, setGuardando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const enviandoRef = useRef(false);

  useEffect(() => {
    const inicial = formInicial(tercero, tipoInicial);
    setForm(inicial);
    setFormReferencia(inicial);
    setGuardando(enviandoRef.current);
    setErrorGeneral(null);
    setErrorNombre(null);
  }, [tercero, tipoInicial]);

  const hayCambios = formularioTieneCambios(form, formReferencia);

  useEffect(() => {
    onEstadoFormulario(hayCambios, guardando);
  }, [guardando, hayCambios, onEstadoFormulario]);

  function actualizar<C extends keyof FormTercero>(
    campo: C,
    valor: FormTercero[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function consultarDgii() {
    const numero = normalizarRnc(form.rnc);

    if (numero === "") {
      toast.error("Escribe el RNC o la cédula antes de consultar.");
      return;
    }

    setConsultando(true);

    try {
      const respuesta = await fetch(
        `/api/dgii/rnc?numero=${encodeURIComponent(numero)}`,
      );
      const cuerpo = (await respuesta.json()) as RespuestaDgii;

      if (!cuerpo.ok) {
        toast.error(cuerpo.mensaje);
        return;
      }

      setForm((anterior) => ({
        ...anterior,
        nombre: cuerpo.datos.nombre,
        direccion:
          anterior.direccion === "" && cuerpo.datos.direccion !== null
            ? cuerpo.datos.direccion
            : anterior.direccion,
      }));
      toast.success("Contribuyente encontrado en la DGII", {
        description: cuerpo.datos.nombre,
      });
    } catch {
      toast.error("No pudimos consultar la DGII. Revisa tu conexión.");
    } finally {
      setConsultando(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || guardando) return;

    if (form.nombre.trim() === "") {
      setErrorNombre("El nombre del tercero es obligatorio.");
      return;
    }

    setErrorNombre(null);
    setErrorGeneral(null);
    enviandoRef.current = true;
    setGuardando(true);

    const entrada: EntradaTercero = {
      empresaId,
      id: tercero?.id ?? null,
      tipo: form.tipo,
      nombre: form.nombre,
      rnc: form.rnc,
      correo: form.correo,
      telefono: form.telefono,
      direccion: form.direccion,
      cuentaPorPagarId:
        form.cuentaPorPagarId === "" ? null : form.cuentaPorPagarId,
      cuentaPorCobrarId:
        form.cuentaPorCobrarId === "" ? null : form.cuentaPorCobrarId,
      activo: form.activo,
    };

    try {
      const resultado = await guardarTerceroAction(entrada);

      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setFormReferencia(form);
      onGuardado();
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  return (
    <form
      className="flex flex-1 flex-col overflow-hidden"
      onSubmit={guardar}
      noValidate
    >
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {errorGeneral ? (
          <p
            role="alert"
            className="mb-4 rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {errorGeneral}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <FormField htmlFor="tercero-tipo" label="Tipo" required>
            <SelectCampo
              id="tercero-tipo"
              opciones={OPCIONES_TIPO}
              valor={form.tipo}
              onCambio={(valor) =>
                actualizar(
                  "tipo",
                  valor === "customer" || valor === "supplier" ? valor : "both",
                )
              }
              requerido
              aria-label="Tipo de tercero"
            />
          </FormField>

          <FormField
            htmlFor="tercero-nombre"
            label="Nombre / Razón social"
            required
            error={errorNombre ?? undefined}
          >
            <Input
              id="tercero-nombre"
              value={form.nombre}
              onChange={(evento) => actualizar("nombre", evento.target.value)}
              placeholder="Ej. Distribuidora Nacional SRL"
              aria-invalid={Boolean(errorNombre)}
            />
          </FormField>

          <FormField htmlFor="tercero-rnc" label="RNC / Cédula">
            <div className="flex items-center gap-2">
              <Input
                id="tercero-rnc"
                value={form.rnc}
                onChange={(evento) => actualizar("rnc", evento.target.value)}
                placeholder="000-00000-0"
                inputMode="numeric"
                className="min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 whitespace-nowrap"
                disabled={consultando}
                onClick={() => void consultarDgii()}
              >
                {consultando ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconSearch className="size-4" />
                )}
                Consultar DGII
              </Button>
            </div>
          </FormField>

          <FormField htmlFor="tercero-telefono" label="Teléfono">
            <Input
              id="tercero-telefono"
              value={form.telefono}
              onChange={(evento) => actualizar("telefono", evento.target.value)}
              placeholder="809-000-0000"
            />
          </FormField>

          <FormField htmlFor="tercero-correo" label="Correo">
            <Input
              id="tercero-correo"
              type="email"
              value={form.correo}
              onChange={(evento) => actualizar("correo", evento.target.value)}
              placeholder="contacto@empresa.com"
            />
          </FormField>

          <FormField htmlFor="tercero-cxp" label="Cuenta por pagar">
            <SelectCampo
              id="tercero-cxp"
              opciones={opcionesCuentas}
              valor={form.cuentaPorPagarId}
              onCambio={(valor) => actualizar("cuentaPorPagarId", valor)}
              etiquetaVacia="Usar cuenta por defecto"
              buscable
              aria-label="Cuenta por pagar del tercero"
            />
          </FormField>

          <FormField htmlFor="tercero-cxc" label="Cuenta por cobrar">
            <SelectCampo
              id="tercero-cxc"
              opciones={opcionesCuentas}
              valor={form.cuentaPorCobrarId}
              onCambio={(valor) => actualizar("cuentaPorCobrarId", valor)}
              etiquetaVacia="Usar cuenta por defecto"
              buscable
              aria-label="Cuenta por cobrar del tercero"
            />
          </FormField>

          <FormField
            htmlFor="tercero-direccion"
            label="Dirección"
            className="sm:col-span-2"
          >
            <Textarea
              id="tercero-direccion"
              value={form.direccion}
              onChange={(evento) =>
                actualizar("direccion", evento.target.value)
              }
              placeholder="Calle, número, sector, municipio"
              className="min-h-16"
            />
          </FormField>

          <label
            htmlFor="tercero-activo"
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5 sm:col-span-2",
            )}
          >
            <Checkbox
              id="tercero-activo"
              checked={form.activo}
              onCheckedChange={(valor) => actualizar("activo", valor)}
            />
            <span className="text-sm font-medium text-foreground">
              Tercero activo para nuevos documentos
            </span>
          </label>
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={guardando}
          onClick={onCancelar}
        >
          Cancelar
        </Button>
        <Button type="submit" className="h-9" disabled={guardando}>
          {guardando ? (
            <>
              <IconLoader2 className="size-4 animate-spin" />
              Guardando…
            </>
          ) : (
            <>{tercero ? "Guardar cambios" : "Crear tercero"}</>
          )}
        </Button>
      </SheetFooter>
    </form>
  );
}
