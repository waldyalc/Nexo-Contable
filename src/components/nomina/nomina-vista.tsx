"use client";

import {
  IconBan,
  IconCash,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconReceipt2,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type DatosAnulacionNomina,
  anularCorridaNominaAction,
  contabilizarCorridaNominaAction,
  guardarEmpleadoAction,
} from "@/app/(app)/nomina/actions";
import { TarjetasResumen } from "@/components/comunes/tarjetas-resumen";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { MonthPicker } from "@/components/month-picker";
import { type OpcionSelect, SelectCampo } from "@/components/select-campo";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type Moneda,
  aNumero,
  formatearFecha,
  formatearMoneda,
  formatearPeriodoMes,
  hoySantoDomingo,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

export interface EmpleadoListado {
  id: string;
  codigo: string;
  nombre: string;
  cedula: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  salarioMensual: number;
  activo: boolean;
}

export interface CorridaNominaListado {
  id: string;
  periodo: string;
  fechaPago: string;
  descripcion: string;
  totalBruto: number;
  totalDeducciones: number;
  totalNeto: number;
  estado: "posted" | "void" | "draft";
}

export interface NominaVistaProps {
  empresaId: string;
  moneda: Moneda;
  empleados: readonly EmpleadoListado[];
  corridas: readonly CorridaNominaListado[];
  opcionesCuentas: readonly OpcionSelect[];
  puedeGestionar: boolean;
}

const OPCIONES_ESTADO = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const ETIQUETAS_CORRIDA: Record<string, string> = {
  posted: "Contabilizada",
  void: "Anulada",
  draft: "Borrador",
};

function periodoLegible(periodo: string): string {
  if (!/^\d{6}$/.test(periodo)) return periodo;
  return formatearPeriodoMes(`${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`);
}

export function NominaVista({
  empresaId,
  moneda,
  empleados,
  corridas,
  opcionesCuentas,
  puedeGestionar,
}: NominaVistaProps) {
  const [dialogoEmpleado, setDialogoEmpleado] = useState(false);
  const [empleadoEdicion, setEmpleadoEdicion] =
    useState<EmpleadoListado | null>(null);
  const [dialogoCorrida, setDialogoCorrida] = useState(false);
  const [corridaAnular, setCorridaAnular] =
    useState<CorridaNominaListado | null>(null);

  const totales = useMemo(() => {
    const activos = empleados.filter((empleado) => empleado.activo).length;
    const contabilizadas = corridas.filter(
      (corrida) => corrida.estado === "posted",
    ).length;
    const ultima = corridas.find((corrida) => corrida.estado === "posted");

    return {
      activos,
      contabilizadas,
      netoUltima: ultima?.totalNeto ?? 0,
      periodoUltima: ultima ? periodoLegible(ultima.periodo) : "Sin corridas",
    };
  }, [empleados, corridas]);

  return (
    <>
      <TarjetasResumen
        etiqueta="Resumen de nómina"
        datos={[
          {
            etiqueta: "Empleados activos",
            valor: String(totales.activos),
            detalle: `${empleados.length} empleados registrados`,
            icono: IconUsersGroup,
          },
          {
            etiqueta: "Nómina neta del último periodo",
            valor: formatearMoneda(totales.netoUltima, moneda),
            detalle: totales.periodoUltima,
            icono: IconCash,
          },
          {
            etiqueta: "Corridas contabilizadas",
            valor: String(totales.contabilizadas),
            detalle: `${corridas.length} corridas en total`,
            icono: IconReceipt2,
          },
        ]}
      />

      <Tabs defaultValue="empleados" className="gap-4">
        <TabsList>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="corridas">Corridas de nómina</TabsTrigger>
        </TabsList>

        <TabsContent value="empleados">
          <TarjetaLista data-lista="empleados">
            <BarraLista
              titulo="Empleados"
              descripcion="Datos laborales y salario mensual usado en la nómina."
              acciones={
                puedeGestionar ? (
                  <Button
                    onClick={() => {
                      setEmpleadoEdicion(null);
                      setDialogoEmpleado(true);
                    }}
                  >
                    <IconPlus className="size-4" />
                    Nuevo empleado
                  </Button>
                ) : undefined
              }
            >
              <TablaLista<EmpleadoListado>
                filas={empleados}
                claveFila={(empleado) => empleado.id}
                ordenable
                paginacion={{ tamanoPagina: 15, etiqueta: "empleados" }}
                vacio={{
                  titulo: "Sin empleados",
                  descripcion:
                    "Registra el primer empleado para preparar su corrida de nómina.",
                  icono: <IconUsersGroup className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "empleado",
                    encabezado: "Empleado",
                    celda: (empleado) => (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {empleado.nombre}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {empleado.codigo}
                          {empleado.cedula === ""
                            ? ""
                            : ` · Céd. ${empleado.cedula}`}
                        </span>
                      </div>
                    ),
                  },
                  {
                    clave: "cargo",
                    encabezado: "Cargo",
                    celda: (empleado) =>
                      empleado.cargo === "" ? "—" : empleado.cargo,
                  },
                  {
                    clave: "departamento",
                    encabezado: "Departamento",
                    celda: (empleado) =>
                      empleado.departamento === ""
                        ? "—"
                        : empleado.departamento,
                  },
                  {
                    clave: "ingreso",
                    encabezado: "Ingreso",
                    celda: (empleado) => formatearFecha(empleado.fechaIngreso),
                  },
                  {
                    clave: "salario",
                    encabezado: "Salario mensual",
                    alineacion: "derecha",
                    celda: (empleado) =>
                      formatearMoneda(empleado.salarioMensual, moneda),
                  },
                  {
                    clave: "estado",
                    encabezado: "Estado",
                    celda: (empleado) => (
                      <PillEstado
                        estado={empleado.activo ? "activo" : "inactivo"}
                      />
                    ),
                  },
                  {
                    clave: "acciones",
                    encabezado: "",
                    ordenable: false,
                    alineacion: "derecha",
                    celda: (empleado) =>
                      puedeGestionar ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${empleado.nombre}`}
                          onClick={() => {
                            setEmpleadoEdicion(empleado);
                            setDialogoEmpleado(true);
                          }}
                        >
                          <IconPencil className="size-4" />
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </BarraLista>
          </TarjetaLista>
        </TabsContent>

        <TabsContent value="corridas">
          <TarjetaLista data-lista="corridas-nomina">
            <BarraLista
              titulo="Corridas de nómina"
              descripcion="Cada corrida genera su asiento de gasto, retenciones y nómina neta por pagar."
              acciones={
                puedeGestionar ? (
                  <Button onClick={() => setDialogoCorrida(true)}>
                    <IconPlus className="size-4" />
                    Contabilizar corrida
                  </Button>
                ) : undefined
              }
            >
              <TablaLista<CorridaNominaListado>
                filas={corridas}
                claveFila={(corrida) => corrida.id}
                ordenable
                paginacion={{ tamanoPagina: 15, etiqueta: "corridas" }}
                vacio={{
                  titulo: "Sin corridas de nómina",
                  descripcion:
                    "Contabiliza la primera corrida con los empleados activos.",
                  icono: <IconCash className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "periodo",
                    encabezado: "Periodo",
                    celda: (corrida) => periodoLegible(corrida.periodo),
                  },
                  {
                    clave: "pago",
                    encabezado: "Fecha de pago",
                    celda: (corrida) => formatearFecha(corrida.fechaPago),
                  },
                  {
                    clave: "bruto",
                    encabezado: "Total bruto",
                    alineacion: "derecha",
                    celda: (corrida) =>
                      formatearMoneda(corrida.totalBruto, moneda),
                  },
                  {
                    clave: "deducciones",
                    encabezado: "Deducciones",
                    alineacion: "derecha",
                    celda: (corrida) =>
                      formatearMoneda(corrida.totalDeducciones, moneda),
                  },
                  {
                    clave: "neto",
                    encabezado: "Total neto",
                    alineacion: "derecha",
                    celda: (corrida) => (
                      <span className="font-medium text-foreground">
                        {formatearMoneda(corrida.totalNeto, moneda)}
                      </span>
                    ),
                  },
                  {
                    clave: "estado",
                    encabezado: "Estado",
                    celda: (corrida) => (
                      <PillEstado
                        estado={
                          ETIQUETAS_CORRIDA[corrida.estado] ?? corrida.estado
                        }
                      />
                    ),
                  },
                  {
                    clave: "acciones",
                    encabezado: "",
                    ordenable: false,
                    alineacion: "derecha",
                    celda: (corrida) =>
                      puedeGestionar && corrida.estado === "posted" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCorridaAnular(corrida)}
                        >
                          <IconBan className="size-4" />
                          Anular
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </BarraLista>
          </TarjetaLista>
        </TabsContent>
      </Tabs>

      <DialogoEmpleado
        abierto={dialogoEmpleado}
        onOpenChange={(abierto) => {
          setDialogoEmpleado(abierto);
          if (!abierto) setEmpleadoEdicion(null);
        }}
        empleado={empleadoEdicion}
        empresaId={empresaId}
        moneda={moneda}
      />

      <DialogoCorrida
        abierto={dialogoCorrida}
        onOpenChange={setDialogoCorrida}
        empresaId={empresaId}
        empleados={empleados}
        opcionesCuentas={opcionesCuentas}
        moneda={moneda}
      />

      <DialogoAnulacion
        corrida={corridaAnular}
        onCerrar={() => setCorridaAnular(null)}
        empresaId={empresaId}
      />
    </>
  );
}

interface DialogoEmpleadoProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empleado: EmpleadoListado | null;
  empresaId: string;
  moneda: Moneda;
}

interface FormEmpleado {
  codigo: string;
  nombre: string;
  cedula: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  salarioMensual: string;
  activo: string;
}

function formEmpleadoInicial(empleado: EmpleadoListado | null): FormEmpleado {
  if (!empleado) {
    return {
      codigo: "",
      nombre: "",
      cedula: "",
      cargo: "",
      departamento: "",
      fechaIngreso: hoySantoDomingo(),
      salarioMensual: "0",
      activo: "activo",
    };
  }

  return {
    codigo: empleado.codigo,
    nombre: empleado.nombre,
    cedula: empleado.cedula,
    cargo: empleado.cargo,
    departamento: empleado.departamento,
    fechaIngreso: empleado.fechaIngreso,
    salarioMensual: String(empleado.salarioMensual),
    activo: empleado.activo ? "activo" : "inactivo",
  };
}

function DialogoEmpleado({
  abierto,
  onOpenChange,
  empleado,
  empresaId,
  moneda,
}: DialogoEmpleadoProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormEmpleado>(formEmpleadoInicial(empleado));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm(formEmpleadoInicial(empleado));
    setError(null);
    setGuardando(false);
  }, [abierto, empleado]);

  function actualizar<C extends keyof FormEmpleado>(
    campo: C,
    valor: FormEmpleado[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.codigo.trim() === "" || form.nombre.trim() === "") {
      setError("El código y el nombre del empleado son obligatorios.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await guardarEmpleadoAction({
      empresaId,
      id: empleado ? empleado.id : null,
      codigo: form.codigo,
      nombre: form.nombre,
      cedula: form.cedula,
      cargo: form.cargo,
      departamento: form.departamento,
      fechaIngreso: form.fechaIngreso,
      salarioMensual: aNumero(form.salarioMensual),
      activo: form.activo === "activo",
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {empleado ? "Editar empleado" : "Nuevo empleado"}
            </DialogTitle>
            <DialogDescription>
              El salario mensual se usa como salario bruto por defecto en la
              corrida de nómina.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <FormGrid>
              <FormField htmlFor="empleado-codigo" label="Código" required>
                <Input
                  id="empleado-codigo"
                  value={form.codigo}
                  onChange={(evento) =>
                    actualizar("codigo", evento.target.value.toUpperCase())
                  }
                  placeholder="Ej. EMP-001"
                />
              </FormField>

              <FormField
                htmlFor="empleado-nombre"
                label="Nombre"
                required
                className="sm:col-span-2"
              >
                <Input
                  id="empleado-nombre"
                  value={form.nombre}
                  onChange={(evento) =>
                    actualizar("nombre", evento.target.value)
                  }
                />
              </FormField>

              <FormField htmlFor="empleado-cedula" label="Cédula">
                <Input
                  id="empleado-cedula"
                  value={form.cedula}
                  onChange={(evento) =>
                    actualizar("cedula", evento.target.value)
                  }
                  inputMode="numeric"
                  placeholder="000-0000000-0"
                />
              </FormField>

              <FormField htmlFor="empleado-cargo" label="Cargo">
                <Input
                  id="empleado-cargo"
                  value={form.cargo}
                  onChange={(evento) =>
                    actualizar("cargo", evento.target.value)
                  }
                />
              </FormField>

              <FormField htmlFor="empleado-departamento" label="Departamento">
                <Input
                  id="empleado-departamento"
                  value={form.departamento}
                  onChange={(evento) =>
                    actualizar("departamento", evento.target.value)
                  }
                />
              </FormField>

              <FormField htmlFor="empleado-ingreso" label="Fecha de ingreso">
                <DatePicker
                  id="empleado-ingreso"
                  value={form.fechaIngreso}
                  onChange={(valor) => actualizar("fechaIngreso", valor)}
                />
              </FormField>

              <FormField
                htmlFor="empleado-salario"
                label={`Salario mensual (${moneda})`}
                required
              >
                <Input
                  id="empleado-salario"
                  value={form.salarioMensual}
                  onChange={(evento) =>
                    actualizar("salarioMensual", evento.target.value)
                  }
                  inputMode="decimal"
                  className="text-right tabular-nums"
                />
              </FormField>

              <FormField htmlFor="empleado-estado" label="Estado" required>
                <SelectCampo
                  id="empleado-estado"
                  opciones={OPCIONES_ESTADO}
                  valor={form.activo}
                  onCambio={(valor) => actualizar("activo", valor)}
                  requerido
                  aria-label="Estado del empleado"
                />
              </FormField>
            </FormGrid>
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
                <>
                  <IconUsersGroup className="size-4" />
                  {empleado ? "Guardar cambios" : "Crear empleado"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface LineaNomina {
  incluido: boolean;
  bruto: string;
  deducciones: string;
}

interface DialogoCorridaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  empleados: readonly EmpleadoListado[];
  opcionesCuentas: readonly OpcionSelect[];
  moneda: Moneda;
}

function DialogoCorrida({
  abierto,
  onOpenChange,
  empresaId,
  empleados,
  opcionesCuentas,
  moneda,
}: DialogoCorridaProps) {
  const router = useRouter();
  const activos = useMemo(
    () => empleados.filter((empleado) => empleado.activo),
    [empleados],
  );
  const [periodo, setPeriodo] = useState(hoySantoDomingo().slice(0, 7));
  const [fechaPago, setFechaPago] = useState(hoySantoDomingo());
  const [cuentaGastoId, setCuentaGastoId] = useState("");
  const [cuentaRetencionesId, setCuentaRetencionesId] = useState("");
  const [cuentaPagoId, setCuentaPagoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<Record<string, LineaNomina>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    const iniciales: Record<string, LineaNomina> = {};
    for (const empleado of activos) {
      iniciales[empleado.id] = {
        incluido: true,
        bruto: String(empleado.salarioMensual),
        deducciones: "0",
      };
    }

    const hoy = hoySantoDomingo();
    setPeriodo(hoy.slice(0, 7));
    setFechaPago(hoy);
    setCuentaGastoId("");
    setCuentaRetencionesId("");
    setCuentaPagoId("");
    setDescripcion("");
    setLineas(iniciales);
    setError(null);
    setGuardando(false);
  }, [abierto, activos]);

  const totales = useMemo(() => {
    let bruto = 0;
    let deducciones = 0;

    for (const empleado of activos) {
      const linea = lineas[empleado.id];
      if (!linea?.incluido) continue;
      bruto += aNumero(linea.bruto);
      deducciones += aNumero(linea.deducciones);
    }

    return { bruto, deducciones, neto: bruto - deducciones };
  }, [activos, lineas]);

  function actualizarLinea(empleadoId: string, cambios: Partial<LineaNomina>) {
    setLineas((anterior) => {
      const actual = anterior[empleadoId] ?? {
        incluido: false,
        bruto: "0",
        deducciones: "0",
      };
      return { ...anterior, [empleadoId]: { ...actual, ...cambios } };
    });
  }

  async function contabilizar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (cuentaGastoId === "" || cuentaPagoId === "") {
      setError("Selecciona las cuentas de gasto y de pago de la nómina.");
      return;
    }

    const detalles = activos
      .filter((empleado) => lineas[empleado.id]?.incluido)
      .map((empleado) => {
        const linea = lineas[empleado.id];
        return {
          empleadoId: empleado.id,
          salarioBruto: aNumero(linea?.bruto ?? "0"),
          deducciones: aNumero(linea?.deducciones ?? "0"),
        };
      });

    if (detalles.length === 0) {
      setError("Selecciona al menos un empleado para la corrida.");
      return;
    }

    if (detalles.some((detalle) => detalle.salarioBruto <= 0)) {
      setError(
        "Cada empleado incluido debe tener un salario bruto mayor a cero.",
      );
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await contabilizarCorridaNominaAction({
      empresaId,
      periodo,
      fechaPago,
      cuentaGastoId,
      cuentaRetencionesId,
      cuentaPagoId,
      descripcion,
      detalles,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={contabilizar}
          noValidate
        >
          <DialogHeader>
            <DialogTitle>Contabilizar corrida de nómina</DialogTitle>
            <DialogDescription>
              El asiento debita el gasto de nómina y acredita las deducciones y
              el neto por pagar.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormGrid>
            <FormField htmlFor="corrida-periodo" label="Periodo" required>
              <MonthPicker
                id="corrida-periodo"
                value={periodo}
                onChange={setPeriodo}
              />
            </FormField>

            <FormField htmlFor="corrida-pago" label="Fecha de pago" required>
              <DatePicker
                id="corrida-pago"
                value={fechaPago}
                onChange={setFechaPago}
              />
            </FormField>

            <FormField htmlFor="corrida-descripcion" label="Descripción">
              <Input
                id="corrida-descripcion"
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                placeholder="Ej. Nómina quincenal"
              />
            </FormField>

            <FormField
              htmlFor="corrida-gasto"
              label="Cuenta de gasto"
              required
              className="sm:col-span-2 lg:col-span-1"
            >
              <SelectCampo
                id="corrida-gasto"
                opciones={opcionesCuentas}
                valor={cuentaGastoId}
                onCambio={setCuentaGastoId}
                buscable
                requerido
                etiquetaVacia="Buscar cuenta…"
                aria-label="Cuenta de gasto de nómina"
              />
            </FormField>

            <FormField
              htmlFor="corrida-retenciones"
              label="Cuenta de retenciones"
              className="sm:col-span-2 lg:col-span-1"
            >
              <SelectCampo
                id="corrida-retenciones"
                opciones={opcionesCuentas}
                valor={cuentaRetencionesId}
                onCambio={setCuentaRetencionesId}
                buscable
                etiquetaVacia="Sin retenciones"
                aria-label="Cuenta de retenciones de nómina"
              />
            </FormField>

            <FormField
              htmlFor="corrida-pago-cuenta"
              label="Cuenta de pago"
              required
              className="sm:col-span-2 lg:col-span-1"
            >
              <SelectCampo
                id="corrida-pago-cuenta"
                opciones={opcionesCuentas}
                valor={cuentaPagoId}
                onCambio={setCuentaPagoId}
                buscable
                requerido
                etiquetaVacia="Buscar cuenta…"
                aria-label="Cuenta de pago de nómina"
              />
            </FormField>
          </FormGrid>

          <div className="overflow-hidden rounded-[10px] border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Empleados incluidos
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {activos.length} empleados activos
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {activos.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No hay empleados activos para incluir en la corrida.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {activos.map((empleado) => {
                    const linea = lineas[empleado.id] ?? {
                      incluido: false,
                      bruto: "0",
                      deducciones: "0",
                    };

                    return (
                      <li
                        key={empleado.id}
                        className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_120px_120px]"
                      >
                        <label
                          htmlFor={`corrida-emp-${empleado.id}`}
                          className="flex min-w-0 items-center gap-2"
                        >
                          <Checkbox
                            id={`corrida-emp-${empleado.id}`}
                            checked={linea.incluido}
                            onCheckedChange={(valor) =>
                              actualizarLinea(empleado.id, {
                                incluido: valor === true,
                              })
                            }
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-foreground">
                              {empleado.nombre}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {empleado.codigo}
                            </span>
                          </span>
                        </label>

                        <Input
                          value={linea.bruto}
                          onChange={(evento) =>
                            actualizarLinea(empleado.id, {
                              bruto: evento.target.value,
                            })
                          }
                          inputMode="decimal"
                          aria-label={`Salario bruto de ${empleado.nombre}`}
                          className={cn(
                            "h-8 text-right tabular-nums",
                            !linea.incluido && "opacity-50",
                          )}
                          disabled={!linea.incluido}
                        />

                        <Input
                          value={linea.deducciones}
                          onChange={(evento) =>
                            actualizarLinea(empleado.id, {
                              deducciones: evento.target.value,
                            })
                          }
                          inputMode="decimal"
                          aria-label={`Deducciones de ${empleado.nombre}`}
                          className={cn(
                            "h-8 text-right tabular-nums",
                            !linea.incluido && "opacity-50",
                          )}
                          disabled={!linea.incluido}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border bg-muted/30 px-3 py-2 text-sm tabular-nums">
              <span className="flex flex-col">
                <span className="text-[11px] text-muted-foreground uppercase">
                  Bruto
                </span>
                <span className="font-medium text-foreground">
                  {formatearMoneda(totales.bruto, moneda)}
                </span>
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] text-muted-foreground uppercase">
                  Deducciones
                </span>
                <span className="font-medium text-foreground">
                  {formatearMoneda(totales.deducciones, moneda)}
                </span>
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] text-muted-foreground uppercase">
                  Neto
                </span>
                <span className="font-medium text-primary">
                  {formatearMoneda(totales.neto, moneda)}
                </span>
              </span>
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
                  Contabilizando…
                </>
              ) : (
                <>
                  <IconCash className="size-4" />
                  Contabilizar corrida
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoAnulacionProps {
  corrida: CorridaNominaListado | null;
  onCerrar: () => void;
  empresaId: string;
}

function DialogoAnulacion({
  corrida,
  onCerrar,
  empresaId,
}: DialogoAnulacionProps) {
  const router = useRouter();
  const [fechaAnulacion, setFechaAnulacion] = useState(hoySantoDomingo());
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!corrida) return;
    setFechaAnulacion(hoySantoDomingo());
    setMotivo("");
    setError(null);
    setGuardando(false);
  }, [corrida]);

  async function anular(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!corrida || guardando) return;

    if (motivo.trim().length < 5) {
      setError("Escribe el motivo de la anulación.");
      return;
    }

    setError(null);
    setGuardando(true);

    const datos: DatosAnulacionNomina = {
      empresaId,
      corridaId: corrida.id,
      fechaAnulacion,
      motivo,
    };

    const resultado = await anularCorridaNominaAction(datos);
    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onCerrar();
    router.refresh();
  }

  return (
    <Dialog
      open={corrida !== null}
      onOpenChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={anular} noValidate>
          <DialogHeader>
            <DialogTitle>Anular corrida de nómina</DialogTitle>
            <DialogDescription>
              {corrida
                ? `Se generará el asiento de reverso de la corrida ${periodoLegible(corrida.periodo)}.`
                : "Selecciona una corrida."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormField htmlFor="anular-fecha" label="Fecha de anulación" required>
            <DatePicker
              id="anular-fecha"
              value={fechaAnulacion}
              onChange={setFechaAnulacion}
            />
          </FormField>

          <FormField htmlFor="anular-motivo" label="Motivo" required>
            <Textarea
              id="anular-motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ej. Corrida duplicada del periodo"
              className="min-h-20"
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={onCerrar}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Anulando…
                </>
              ) : (
                <>
                  <IconBan className="size-4" />
                  Anular corrida
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
