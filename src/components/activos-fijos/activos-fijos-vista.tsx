"use client";

import {
  IconBuilding,
  IconCalendarStats,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconScale,
  IconTrendingDown,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type DatosDepreciacion,
  correrDepreciacionAction,
  guardarActivoFijoAction,
} from "@/app/(app)/activos-fijos/actions";
import { TarjetasResumen } from "@/components/comunes/tarjetas-resumen";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado, type TonoPill } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { MonthPicker } from "@/components/month-picker";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { type OpcionSelect, SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
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
import {
  type Moneda,
  aNumero,
  formatearFecha,
  formatearMoneda,
  formatearPeriodoMes,
  hoySantoDomingo,
} from "@/lib/formato";

export interface ActivoFijoListado {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  fechaAdquisicion: string;
  costoAdquisicion: number;
  valorResidual: number;
  vidaUtilMeses: number;
  depreciacionAcumulada: number;
  cuentaActivoId: string;
  cuentaDepreciacionAcumuladaId: string;
  cuentaGastoDepreciacionId: string;
  estado: "active" | "fully_depreciated" | "disposed";
}

export interface DepreciacionListado {
  id: string;
  activoId: string;
  periodo: string;
  fecha: string;
  monto: number;
}

export interface ActivosFijosVistaProps {
  empresaId: string;
  moneda: Moneda;
  activos: readonly ActivoFijoListado[];
  depreciaciones: readonly DepreciacionListado[];
  opcionesCuentas: readonly OpcionSelect[];
  puedeGestionar: boolean;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  active: "Activo",
  fully_depreciated: "Totalmente depreciado",
  disposed: "Dado de baja",
};

const TONO_ESTADO: Record<string, TonoPill> = {
  active: "exito",
  fully_depreciated: "neutro",
  disposed: "peligro",
};

function valorEnLibros(activo: ActivoFijoListado): number {
  return activo.costoAdquisicion - activo.depreciacionAcumulada;
}

function periodoLegible(periodo: string): string {
  if (!/^\d{6}$/.test(periodo)) return periodo;
  return formatearPeriodoMes(`${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`);
}

export function ActivosFijosVista({
  empresaId,
  moneda,
  activos,
  depreciaciones,
  opcionesCuentas,
  puedeGestionar,
}: ActivosFijosVistaProps) {
  const router = useRouter();
  const [dialogoActivo, setDialogoActivo] = useState(false);
  const [activoEdicion, setActivoEdicion] = useState<ActivoFijoListado | null>(
    null,
  );
  const [dialogoDepreciacion, setDialogoDepreciacion] = useState(false);

  const nombreActivo = useMemo(() => {
    const mapa = new Map(
      activos.map((activo) => [
        activo.id,
        `${activo.codigo} · ${activo.nombre}`,
      ]),
    );
    return (id: string) => mapa.get(id) ?? "—";
  }, [activos]);

  const totales = useMemo(() => {
    const costo = activos.reduce(
      (total, activo) => total + activo.costoAdquisicion,
      0,
    );
    const depreciado = activos.reduce(
      (total, activo) => total + activo.depreciacionAcumulada,
      0,
    );

    return {
      costo,
      depreciado,
      libros: costo - depreciado,
      vigentes: activos.filter((activo) => activo.estado === "active").length,
    };
  }, [activos]);

  return (
    <>
      <EncabezadoPagina
        titulo="Activos fijos"
        descripcion="Costo de adquisición, vida útil en meses y depreciación mensual contabilizada."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Activos fijos" }]}
        acciones={
          <Button variant="outline" onClick={() => router.refresh()}>
            <IconRefresh className="size-4" />
            Actualizar
          </Button>
        }
      />

      <TarjetasResumen
        etiqueta="Resumen de activos fijos"
        datos={[
          {
            etiqueta: "Costo de adquisición",
            valor: formatearMoneda(totales.costo, moneda),
            detalle: `${activos.length} activos registrados`,
            icono: IconBuilding,
          },
          {
            etiqueta: "Depreciación acumulada",
            valor: formatearMoneda(totales.depreciado, moneda),
            detalle: `${totales.vigentes} activos vigentes`,
            icono: IconTrendingDown,
          },
          {
            etiqueta: "Valor en libros",
            valor: formatearMoneda(totales.libros, moneda),
            detalle: "Costo menos depreciación acumulada",
            icono: IconScale,
          },
        ]}
      />

      <Tabs defaultValue="activos" className="gap-4">
        <TabsList>
          <TabsTrigger value="activos">Activos fijos</TabsTrigger>
          <TabsTrigger value="depreciaciones">
            Historial de depreciaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activos">
          <TarjetaLista data-lista="activos-fijos">
            <BarraLista
              titulo="Registro de activos fijos"
              descripcion="Cada activo usa su cuenta de activo, depreciación acumulada y gasto de depreciación."
              acciones={
                puedeGestionar ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setDialogoDepreciacion(true)}
                    >
                      <IconCalendarStats className="size-4" />
                      Correr depreciación
                    </Button>
                    <Button
                      onClick={() => {
                        setActivoEdicion(null);
                        setDialogoActivo(true);
                      }}
                    >
                      <IconPlus className="size-4" />
                      Nuevo activo
                    </Button>
                  </>
                ) : undefined
              }
            >
              <TablaLista<ActivoFijoListado>
                filas={activos}
                claveFila={(activo) => activo.id}
                ordenable
                paginacion={{ tamanoPagina: 15, etiqueta: "activos" }}
                vacio={{
                  titulo: "Sin activos fijos",
                  descripcion:
                    "Registra el primer activo para calcular su depreciación mensual.",
                  icono: <IconBuilding className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "activo",
                    encabezado: "Activo",
                    celda: (activo) => (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {activo.nombre}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {activo.codigo}
                          {activo.categoria === ""
                            ? ""
                            : ` · ${activo.categoria}`}
                        </span>
                      </div>
                    ),
                  },
                  {
                    clave: "fecha",
                    encabezado: "Adquisición",
                    celda: (activo) => formatearFecha(activo.fechaAdquisicion),
                  },
                  {
                    clave: "costo",
                    encabezado: "Costo",
                    alineacion: "derecha",
                    celda: (activo) =>
                      formatearMoneda(activo.costoAdquisicion, moneda),
                  },
                  {
                    clave: "residual",
                    encabezado: "Valor residual",
                    alineacion: "derecha",
                    celda: (activo) =>
                      formatearMoneda(activo.valorResidual, moneda),
                  },
                  {
                    clave: "vida",
                    encabezado: "Vida útil",
                    alineacion: "derecha",
                    celda: (activo) => `${activo.vidaUtilMeses} meses`,
                  },
                  {
                    clave: "depreciado",
                    encabezado: "Depreciación",
                    alineacion: "derecha",
                    celda: (activo) =>
                      formatearMoneda(activo.depreciacionAcumulada, moneda),
                  },
                  {
                    clave: "libros",
                    encabezado: "Valor en libros",
                    alineacion: "derecha",
                    celda: (activo) =>
                      formatearMoneda(valorEnLibros(activo), moneda),
                  },
                  {
                    clave: "estado",
                    encabezado: "Estado",
                    celda: (activo) => (
                      <PillEstado
                        estado={
                          ETIQUETAS_ESTADO[activo.estado] ?? activo.estado
                        }
                        tono={TONO_ESTADO[activo.estado] ?? "neutro"}
                      />
                    ),
                  },
                  {
                    clave: "acciones",
                    encabezado: "",
                    ordenable: false,
                    alineacion: "derecha",
                    celda: (activo) =>
                      puedeGestionar ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${activo.nombre}`}
                          onClick={() => {
                            setActivoEdicion(activo);
                            setDialogoActivo(true);
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

        <TabsContent value="depreciaciones">
          <TarjetaLista data-lista="depreciaciones-activos">
            <BarraLista
              titulo="Historial de depreciaciones"
              descripcion="Depreciaciones mensuales contabilizadas por periodo."
            >
              <TablaLista<DepreciacionListado>
                filas={depreciaciones}
                claveFila={(depreciacion) => depreciacion.id}
                paginacion={{ tamanoPagina: 25, etiqueta: "depreciaciones" }}
                vacio={{
                  titulo: "Sin depreciaciones",
                  descripcion:
                    "Corre la depreciación de un periodo para ver el historial.",
                  icono: <IconCalendarStats className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "periodo",
                    encabezado: "Periodo",
                    celda: (depreciacion) =>
                      periodoLegible(depreciacion.periodo),
                  },
                  {
                    clave: "activo",
                    encabezado: "Activo",
                    celda: (depreciacion) =>
                      nombreActivo(depreciacion.activoId),
                  },
                  {
                    clave: "fecha",
                    encabezado: "Fecha contable",
                    celda: (depreciacion) => formatearFecha(depreciacion.fecha),
                  },
                  {
                    clave: "monto",
                    encabezado: "Monto",
                    alineacion: "derecha",
                    celda: (depreciacion) =>
                      formatearMoneda(depreciacion.monto, moneda),
                  },
                ]}
              />
            </BarraLista>
          </TarjetaLista>
        </TabsContent>
      </Tabs>

      <DialogoActivo
        abierto={dialogoActivo}
        onOpenChange={(abierto) => {
          setDialogoActivo(abierto);
          if (!abierto) setActivoEdicion(null);
        }}
        activo={activoEdicion}
        empresaId={empresaId}
        opcionesCuentas={opcionesCuentas}
        moneda={moneda}
      />

      <DialogoDepreciacion
        abierto={dialogoDepreciacion}
        onOpenChange={setDialogoDepreciacion}
        empresaId={empresaId}
      />
    </>
  );
}

interface DialogoActivoProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  activo: ActivoFijoListado | null;
  empresaId: string;
  opcionesCuentas: readonly OpcionSelect[];
  moneda: Moneda;
}

interface FormActivo {
  codigo: string;
  nombre: string;
  categoria: string;
  fechaAdquisicion: string;
  costoAdquisicion: string;
  valorResidual: string;
  vidaUtilMeses: string;
  cuentaActivoId: string;
  cuentaDepreciacionAcumuladaId: string;
  cuentaGastoDepreciacionId: string;
}

function formActivoInicial(activo: ActivoFijoListado | null): FormActivo {
  if (!activo) {
    return {
      codigo: "",
      nombre: "",
      categoria: "",
      fechaAdquisicion: hoySantoDomingo(),
      costoAdquisicion: "0",
      valorResidual: "0",
      vidaUtilMeses: "60",
      cuentaActivoId: "",
      cuentaDepreciacionAcumuladaId: "",
      cuentaGastoDepreciacionId: "",
    };
  }

  return {
    codigo: activo.codigo,
    nombre: activo.nombre,
    categoria: activo.categoria,
    fechaAdquisicion: activo.fechaAdquisicion,
    costoAdquisicion: String(activo.costoAdquisicion),
    valorResidual: String(activo.valorResidual),
    vidaUtilMeses: String(activo.vidaUtilMeses),
    cuentaActivoId: activo.cuentaActivoId,
    cuentaDepreciacionAcumuladaId: activo.cuentaDepreciacionAcumuladaId,
    cuentaGastoDepreciacionId: activo.cuentaGastoDepreciacionId,
  };
}

function DialogoActivo({
  abierto,
  onOpenChange,
  activo,
  empresaId,
  opcionesCuentas,
  moneda,
}: DialogoActivoProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormActivo>(formActivoInicial(activo));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const baseBloqueada = activo !== null && activo.depreciacionAcumulada > 0;

  useEffect(() => {
    if (!abierto) return;
    setForm(formActivoInicial(activo));
    setError(null);
    setGuardando(false);
  }, [abierto, activo]);

  function actualizar<C extends keyof FormActivo>(
    campo: C,
    valor: FormActivo[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.codigo.trim() === "" || form.nombre.trim() === "") {
      setError("El código y el nombre del activo son obligatorios.");
      return;
    }

    if (
      form.cuentaActivoId === "" ||
      form.cuentaDepreciacionAcumuladaId === "" ||
      form.cuentaGastoDepreciacionId === ""
    ) {
      setError("Selecciona las tres cuentas contables del activo.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await guardarActivoFijoAction({
      empresaId,
      id: activo ? activo.id : null,
      codigo: form.codigo,
      nombre: form.nombre,
      categoria: form.categoria,
      fechaAdquisicion: form.fechaAdquisicion,
      costoAdquisicion: baseBloqueada ? null : aNumero(form.costoAdquisicion),
      valorResidual: baseBloqueada ? null : aNumero(form.valorResidual),
      vidaUtilMeses: baseBloqueada
        ? null
        : Math.trunc(aNumero(form.vidaUtilMeses)),
      cuentaActivoId: form.cuentaActivoId,
      cuentaDepreciacionAcumuladaId: form.cuentaDepreciacionAcumuladaId,
      cuentaGastoDepreciacionId: form.cuentaGastoDepreciacionId,
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
              {activo ? "Editar activo fijo" : "Nuevo activo fijo"}
            </DialogTitle>
            <DialogDescription>
              La depreciación se calcula por mes sobre el costo menos el valor
              residual.
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
              <FormField htmlFor="activo-codigo" label="Código" required>
                <Input
                  id="activo-codigo"
                  value={form.codigo}
                  onChange={(evento) =>
                    actualizar("codigo", evento.target.value.toUpperCase())
                  }
                  placeholder="Ej. AF-001"
                />
              </FormField>

              <FormField
                htmlFor="activo-nombre"
                label="Nombre"
                required
                className="sm:col-span-2"
              >
                <Input
                  id="activo-nombre"
                  value={form.nombre}
                  onChange={(evento) =>
                    actualizar("nombre", evento.target.value)
                  }
                  placeholder="Ej. Camioneta Toyota Hilux"
                />
              </FormField>

              <FormField htmlFor="activo-categoria" label="Categoría">
                <Input
                  id="activo-categoria"
                  value={form.categoria}
                  onChange={(evento) =>
                    actualizar("categoria", evento.target.value)
                  }
                  placeholder="Vehículos, mobiliario…"
                />
              </FormField>

              <FormField
                htmlFor="activo-fecha"
                label="Fecha de adquisición"
                required
              >
                <DatePicker
                  id="activo-fecha"
                  value={form.fechaAdquisicion}
                  onChange={(valor) => actualizar("fechaAdquisicion", valor)}
                />
              </FormField>

              <FormField
                htmlFor="activo-vida"
                label="Vida útil (meses)"
                required
              >
                <Input
                  id="activo-vida"
                  value={form.vidaUtilMeses}
                  onChange={(evento) =>
                    actualizar("vidaUtilMeses", evento.target.value)
                  }
                  inputMode="numeric"
                  disabled={baseBloqueada}
                  className="text-right tabular-nums"
                />
              </FormField>

              <FormField
                htmlFor="activo-costo"
                label={`Costo de adquisición (${moneda})`}
                required
              >
                <Input
                  id="activo-costo"
                  value={form.costoAdquisicion}
                  onChange={(evento) =>
                    actualizar("costoAdquisicion", evento.target.value)
                  }
                  inputMode="decimal"
                  disabled={baseBloqueada}
                  className="text-right tabular-nums"
                />
              </FormField>

              <FormField
                htmlFor="activo-residual"
                label={`Valor residual (${moneda})`}
              >
                <Input
                  id="activo-residual"
                  value={form.valorResidual}
                  onChange={(evento) =>
                    actualizar("valorResidual", evento.target.value)
                  }
                  inputMode="decimal"
                  disabled={baseBloqueada}
                  className="text-right tabular-nums"
                />
              </FormField>

              {baseBloqueada ? (
                <p className="rounded-[10px] border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Este activo ya tiene depreciación acumulada: el costo, el
                  valor residual y la vida útil no se pueden modificar. Puedes
                  actualizar el código, el nombre, la categoría y las cuentas.
                </p>
              ) : null}

              <FormField
                htmlFor="activo-cuenta-activo"
                label="Cuenta del activo"
                required
                className="sm:col-span-2 lg:col-span-1"
              >
                <SelectCampo
                  id="activo-cuenta-activo"
                  opciones={opcionesCuentas}
                  valor={form.cuentaActivoId}
                  onCambio={(valor) => actualizar("cuentaActivoId", valor)}
                  buscable
                  requerido
                  etiquetaVacia="Buscar cuenta…"
                  aria-label="Cuenta contable del activo"
                />
              </FormField>

              <FormField
                htmlFor="activo-cuenta-depreciacion"
                label="Depreciación acumulada"
                required
                className="sm:col-span-2 lg:col-span-1"
              >
                <SelectCampo
                  id="activo-cuenta-depreciacion"
                  opciones={opcionesCuentas}
                  valor={form.cuentaDepreciacionAcumuladaId}
                  onCambio={(valor) =>
                    actualizar("cuentaDepreciacionAcumuladaId", valor)
                  }
                  buscable
                  requerido
                  etiquetaVacia="Buscar cuenta…"
                  aria-label="Cuenta de depreciación acumulada"
                />
              </FormField>

              <FormField
                htmlFor="activo-cuenta-gasto"
                label="Gasto de depreciación"
                required
                className="sm:col-span-2 lg:col-span-1"
              >
                <SelectCampo
                  id="activo-cuenta-gasto"
                  opciones={opcionesCuentas}
                  valor={form.cuentaGastoDepreciacionId}
                  onCambio={(valor) =>
                    actualizar("cuentaGastoDepreciacionId", valor)
                  }
                  buscable
                  requerido
                  etiquetaVacia="Buscar cuenta…"
                  aria-label="Cuenta de gasto de depreciación"
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
                  <IconBuilding className="size-4" />
                  {activo ? "Guardar cambios" : "Crear activo"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoDepreciacionProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
}

function DialogoDepreciacion({
  abierto,
  onOpenChange,
  empresaId,
}: DialogoDepreciacionProps) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(hoySantoDomingo().slice(0, 7));
  const [fecha, setFecha] = useState(hoySantoDomingo());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const hoy = hoySantoDomingo();
    setPeriodo(hoy.slice(0, 7));
    setFecha(hoy);
    setError(null);
    setGuardando(false);
  }, [abierto]);

  function cambiarPeriodo(valor: string) {
    setPeriodo(valor);
    if (/^\d{4}-\d{2}$/.test(valor) && !fecha.startsWith(valor)) {
      setFecha(`${valor}-01`);
    }
  }

  async function correr(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      setError("Selecciona el periodo a depreciar.");
      return;
    }

    if (!fecha.startsWith(periodo)) {
      setError("La fecha de contabilización debe pertenecer al periodo.");
      return;
    }

    setError(null);
    setGuardando(true);

    const datos: DatosDepreciacion = { empresaId, periodo, fecha };
    const resultado = await correrDepreciacionAction(datos);

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
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={correr} noValidate>
          <DialogHeader>
            <DialogTitle>Correr depreciación mensual</DialogTitle>
            <DialogDescription>
              Contabiliza la depreciación del periodo en todos los activos
              vigentes. Un activo no se deprecia dos veces en el mismo mes.
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

          <FormGrid className="sm:grid-cols-2">
            <FormField
              htmlFor="depreciacion-periodo"
              label="Periodo"
              required
              className="sm:col-span-2"
            >
              <MonthPicker
                id="depreciacion-periodo"
                value={periodo}
                onChange={cambiarPeriodo}
              />
            </FormField>

            <FormField
              htmlFor="depreciacion-fecha"
              label="Fecha de contabilización"
              required
              className="sm:col-span-2"
            >
              <DatePicker
                id="depreciacion-fecha"
                value={fecha}
                onChange={setFecha}
              />
            </FormField>
          </FormGrid>

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
                  Depreciando…
                </>
              ) : (
                <>
                  <IconCalendarStats className="size-4" />
                  Correr depreciación
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
