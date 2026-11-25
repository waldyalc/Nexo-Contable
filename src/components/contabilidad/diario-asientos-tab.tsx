"use client";

import {
  IconArrowBackUp,
  IconCheck,
  IconDots,
  IconEye,
  IconLoader2,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type AsientoListado,
  type CuentaContable,
  type LineaAsiento,
  contabilizarAsientoAction,
  crearAsientoManualAction,
  revertirAsientoAction,
} from "@/app/(app)/contabilidad/actions";
import { DatePicker } from "@/components/date-picker";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { BotonDescargar } from "@/components/reportes/boton-descargar";
import { SelectCampo } from "@/components/select-campo";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type Moneda,
  aNumero,
  formatearFecha,
  formatearMoneda,
  hoySantoDomingo,
} from "@/lib/formato";
import {
  describirRangoFechas,
  nombreArchivoConPeriodo,
  tablaLibroDiarioReporte,
} from "@/lib/reportes/adaptadores";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

const OPCIONES_ESTADO = [
  { value: "draft", label: "Borradores" },
  { value: "posted", label: "Contabilizados" },
  { value: "reversed", label: "Revertidos" },
  { value: "reversal", label: "Reversos" },
];

const ETIQUETA_ESTADO: Record<string, string> = {
  draft: "borrador",
  posted: "contabilizado",
  reversed: "anulado",
  reversal: "reverso",
};

interface LineaEntrada {
  id: number;
  cuentaId: string;
  descripcion: string;
  debito: string;
  credito: string;
}

function lineaVacia(id: number): LineaEntrada {
  return { id, cuentaId: "", descripcion: "", debito: "", credito: "" };
}

function estadoLegible(estado: string): string {
  return ETIQUETA_ESTADO[estado] ?? estado;
}

function unSoloLado(debito: number, credito: number): boolean {
  return debito > 0 !== credito > 0;
}

export interface DialogoAsientoManualProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  cuentas: readonly CuentaContable[];
  titulo?: string;
  descripcionInicial?: string;
  bloquearDescripcion?: boolean;
  permitirBorrador?: boolean;
}

/**
 * Diálogo de asiento manual con líneas dinámicas, partida doble y cuadre en
 * vivo. Se reutiliza para los balances iniciales de apertura.
 */
export function DialogoAsientoManual({
  abierto,
  onOpenChange,
  cuentas,
  titulo = "Nuevo asiento manual",
  descripcionInicial = "",
  bloquearDescripcion = false,
  permitirBorrador = true,
}: DialogoAsientoManualProps) {
  const router = useRouter();
  const siguienteId = useRef(3);
  const [fecha, setFecha] = useState(hoySantoDomingo());
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [referencia, setReferencia] = useState("");
  const [lineas, setLineas] = useState<LineaEntrada[]>([
    lineaVacia(1),
    lineaVacia(2),
  ]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cuentasConHijas = useMemo(() => {
    const padres = new Set<string>();
    for (const cuenta of cuentas) {
      if (cuenta.padreId) padres.add(cuenta.padreId);
    }
    return padres;
  }, [cuentas]);

  const opcionesCuenta = useMemo(
    () =>
      cuentas
        .filter(
          (cuenta) =>
            !cuenta.esAgrupacion &&
            cuenta.activa &&
            !cuentasConHijas.has(cuenta.id),
        )
        .map((cuenta) => ({
          value: cuenta.id,
          label: `${cuenta.codigo} · ${cuenta.nombre}`,
        })),
    [cuentas, cuentasConHijas],
  );

  useEffect(() => {
    if (!abierto) return;
    setFecha(hoySantoDomingo());
    setDescripcion(descripcionInicial);
    setReferencia("");
    setLineas([lineaVacia(1), lineaVacia(2)]);
    siguienteId.current = 3;
    setGuardando(false);
    setError(null);
  }, [abierto, descripcionInicial]);

  const totalDebito = lineas.reduce(
    (acumulado, linea) => acumulado + aNumero(linea.debito),
    0,
  );
  const totalCredito = lineas.reduce(
    (acumulado, linea) => acumulado + aNumero(linea.credito),
    0,
  );
  const diferencia = totalDebito - totalCredito;
  const cuadra = Math.abs(diferencia) < 0.005 && totalDebito > 0;
  const lineasValidas = lineas.filter((linea) => {
    if (linea.cuentaId === "") return false;
    return unSoloLado(aNumero(linea.debito), aNumero(linea.credito));
  });

  function actualizarLinea(
    id: number,
    campo: keyof Omit<LineaEntrada, "id">,
    valor: string,
  ) {
    setLineas((anteriores) =>
      anteriores.map((linea) => {
        if (linea.id !== id) return linea;
        if (campo === "debito" && valor !== "") {
          return { ...linea, debito: valor, credito: "" };
        }
        if (campo === "credito" && valor !== "") {
          return { ...linea, credito: valor, debito: "" };
        }
        return { ...linea, [campo]: valor };
      }),
    );
  }

  function agregarLinea() {
    setLineas((anteriores) => [...anteriores, lineaVacia(siguienteId.current)]);
    siguienteId.current += 1;
  }

  function quitarLinea(id: number) {
    setLineas((anteriores) => {
      if (anteriores.length <= 2) return anteriores;
      return anteriores.filter((linea) => linea.id !== id);
    });
  }

  async function guardar(contabilizar: boolean) {
    if (guardando) return;

    if (descripcion.trim() === "") {
      setError("La descripción del asiento es obligatoria.");
      return;
    }

    if (lineasValidas.length < 2) {
      setError(
        "Agrega al menos dos líneas con cuenta y un solo lado (débito o crédito).",
      );
      return;
    }

    if (contabilizar && !cuadra) {
      setError("El asiento debe estar cuadrado para contabilizarse.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await crearAsientoManualAction({
      fecha,
      descripcion,
      referencia,
      contabilizar,
      lineas: lineasValidas.map((linea) => ({
        cuentaId: linea.cuentaId,
        descripcion: linea.descripcion,
        debito: aNumero(linea.debito),
        credito: aNumero(linea.credito),
      })),
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
          onSubmit={(evento) => {
            evento.preventDefault();
            void guardar(true);
          }}
        >
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>
              Registra al menos dos líneas: cada una lleva débito o crédito,
              nunca ambos. El total de débitos debe igualar el de créditos.
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

          <div className="max-h-[64vh] overflow-y-auto pr-1">
            <FormGrid>
              <FormField htmlFor="asiento-fecha" label="Fecha" required>
                <DatePicker
                  id="asiento-fecha"
                  value={fecha}
                  onChange={setFecha}
                />
              </FormField>

              <FormField htmlFor="asiento-referencia" label="Referencia">
                <Input
                  id="asiento-referencia"
                  value={referencia}
                  onChange={(evento) => setReferencia(evento.target.value)}
                  placeholder="Ej. AJ-2026-001"
                />
              </FormField>

              <FormField
                htmlFor="asiento-descripcion"
                label="Descripción"
                required
                className="sm:col-span-2 lg:col-span-1"
              >
                <Input
                  id="asiento-descripcion"
                  value={descripcion}
                  onChange={(evento) => setDescripcion(evento.target.value)}
                  disabled={bloquearDescripcion}
                  placeholder="Concepto del asiento"
                />
              </FormField>
            </FormGrid>

            <div className="mt-4 flex flex-col gap-2">
              <div className="hidden gap-2 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_7rem_7rem_2.25rem]">
                <span>Cuenta</span>
                <span>Descripción</span>
                <span className="text-right">Débito</span>
                <span className="text-right">Crédito</span>
                <span />
              </div>

              {lineas.map((linea) => (
                <div
                  key={linea.id}
                  className="grid grid-cols-1 gap-2 rounded-[10px] border border-border bg-muted/30 p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_7rem_7rem_2.25rem] sm:items-center"
                >
                  <SelectCampo
                    opciones={opcionesCuenta}
                    valor={linea.cuentaId}
                    onCambio={(valor) =>
                      actualizarLinea(linea.id, "cuentaId", valor)
                    }
                    buscable
                    etiquetaVacia="Buscar cuenta…"
                    aria-label="Cuenta contable"
                  />
                  <Input
                    value={linea.descripcion}
                    onChange={(evento) =>
                      actualizarLinea(
                        linea.id,
                        "descripcion",
                        evento.target.value,
                      )
                    }
                    placeholder="Detalle de la línea"
                    aria-label="Descripción de la línea"
                  />
                  <Input
                    value={linea.debito}
                    onChange={(evento) =>
                      actualizarLinea(linea.id, "debito", evento.target.value)
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                    className="text-right tabular-nums"
                    aria-label="Débito"
                  />
                  <Input
                    value={linea.credito}
                    onChange={(evento) =>
                      actualizarLinea(linea.id, "credito", evento.target.value)
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                    className="text-right tabular-nums"
                    aria-label="Crédito"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar línea"
                    disabled={lineas.length <= 2}
                    onClick={() => quitarLinea(linea.id)}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </div>
              ))}

              <div>
                <Button type="button" variant="outline" onClick={agregarLinea}>
                  <IconPlus className="size-4" />
                  Agregar línea
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 rounded-[10px] border border-border bg-muted/40 p-3 sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Total débito
                </span>
                <span className="font-display text-lg font-semibold tabular-nums">
                  {formatearMoneda(totalDebito)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Total crédito
                </span>
                <span className="font-display text-lg font-semibold tabular-nums">
                  {formatearMoneda(totalCredito)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Diferencia
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold tabular-nums">
                    {formatearMoneda(diferencia)}
                  </span>
                  <PillEstado
                    estado={cuadra ? "cuadrado" : "descuadrado"}
                    tono={cuadra ? "exito" : "peligro"}
                  >
                    {cuadra ? "Cuadra" : "Descuadre"}
                  </PillEstado>
                </span>
              </div>
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
            {permitirBorrador ? (
              <Button
                type="button"
                variant="secondary"
                disabled={guardando || lineasValidas.length < 2}
                onClick={() => void guardar(false)}
              >
                Guardar borrador
              </Button>
            ) : null}
            <Button type="submit" disabled={guardando || !cuadra}>
              {guardando ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconCheck className="size-4" />
              )}
              Contabilizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface DiarioAsientosTabProps {
  asientos: readonly AsientoListado[];
  lineas: readonly LineaAsiento[];
  cuentas: readonly CuentaContable[];
  moneda: Moneda;
  empresa: EmpresaReporte;
}

export function DiarioAsientosTab({
  asientos,
  lineas,
  cuentas,
  moneda,
  empresa,
}: DiarioAsientosTabProps) {
  const router = useRouter();
  const [rango, setRango] = useState<RangoFechas>({ desde: "", hasta: "" });
  const [estado, setEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [dialogoNuevo, setDialogoNuevo] = useState(false);
  const [detalle, setDetalle] = useState<AsientoListado | null>(null);
  const [revertir, setRevertir] = useState<AsientoListado | null>(null);
  const [fechaReverso, setFechaReverso] = useState(hoySantoDomingo());
  const [motivoReverso, setMotivoReverso] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);

  const cuentasPorId = useMemo(
    () => new Map(cuentas.map((cuenta) => [cuenta.id, cuenta])),
    [cuentas],
  );

  const lineasPorAsiento = useMemo(() => {
    const mapa = new Map<string, LineaAsiento[]>();
    for (const linea of lineas) {
      const actuales = mapa.get(linea.asientoId) ?? [];
      actuales.push(linea);
      mapa.set(linea.asientoId, actuales);
    }
    return mapa;
  }, [lineas]);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return asientos.filter((asiento) => {
      if (estado !== "" && asiento.estado !== estado) return false;
      if (rango.desde !== "" && asiento.fecha < rango.desde) return false;
      if (rango.hasta !== "" && asiento.fecha > rango.hasta) return false;
      if (termino === "") return true;

      return (
        asiento.numero.toLowerCase().includes(termino) ||
        asiento.descripcion.toLowerCase().includes(termino) ||
        asiento.referencia.toLowerCase().includes(termino)
      );
    });
  }, [asientos, busqueda, estado, rango]);

  const filasDiarioReporte = useMemo(
    () =>
      filtradas.map((asiento) => {
        const movimientos = lineasPorAsiento.get(asiento.id) ?? [];
        return {
          numero: asiento.numero,
          fecha: asiento.fecha,
          descripcion: asiento.descripcion,
          referencia: asiento.referencia,
          debitos: movimientos.reduce(
            (acumulado, linea) => acumulado + linea.debito,
            0,
          ),
          creditos: movimientos.reduce(
            (acumulado, linea) => acumulado + linea.credito,
            0,
          ),
          estado: estadoLegible(asiento.estado),
        };
      }),
    [filtradas, lineasPorAsiento],
  );

  const subtituloDiario = useMemo(() => {
    const partes = [describirRangoFechas(rango.desde, rango.hasta)];
    const estadoActivo = OPCIONES_ESTADO.find(
      (opcion) => opcion.value === estado,
    );

    if (estadoActivo) partes.push(`Estado: ${estadoActivo.label}`);

    const termino = busqueda.trim();
    if (termino !== "") partes.push(`Búsqueda: ${termino}`);

    partes.push(`${filtradas.length} de ${asientos.length} asientos recientes`);
    return partes.join(" · ");
  }, [asientos.length, busqueda, estado, filtradas.length, rango]);

  const tablaDiario = useMemo(
    () =>
      tablaLibroDiarioReporte({
        subtitulo: subtituloDiario,
        empresa,
        filas: filasDiarioReporte,
      }),
    [empresa, filasDiarioReporte, subtituloDiario],
  );

  const archivoDiario = nombreArchivoConPeriodo(
    "libro-diario",
    rango.desde,
    rango.hasta,
  );

  async function contabilizar(asiento: AsientoListado) {
    setProcesando(asiento.id);
    const resultado = await contabilizarAsientoAction(asiento.id);
    setProcesando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    router.refresh();
  }

  async function confirmarReverso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!revertir || procesando !== null) return;

    setProcesando(revertir.id);
    const resultado = await revertirAsientoAction({
      asientoId: revertir.id,
      fecha: fechaReverso,
      motivo: motivoReverso,
    });
    setProcesando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    setRevertir(null);
    setMotivoReverso("");
    router.refresh();
  }

  const lineasDetalle = detalle ? (lineasPorAsiento.get(detalle.id) ?? []) : [];

  return (
    <>
      <TarjetaLista>
        <BarraLista
          titulo="Libro diario"
          descripcion={`${filtradas.length} de ${asientos.length} asientos recientes`}
          acciones={
            <>
              <Button onClick={() => setDialogoNuevo(true)}>
                <IconPlus className="size-4" />
                Nuevo asiento
              </Button>
              <BotonDescargar
                tabla={tablaDiario}
                nombreArchivo={archivoDiario}
              />
            </>
          }
          filtros={
            <>
              <DateRangePicker
                value={rango}
                onChange={setRango}
                className="w-full sm:w-64"
              />
              <SelectCampo
                opciones={OPCIONES_ESTADO}
                valor={estado}
                onCambio={setEstado}
                etiquetaVacia="Todos los estados"
                className="w-full sm:w-[180px]"
                aria-label="Filtrar por estado"
              />
              <Input
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar número, referencia o concepto…"
                aria-label="Buscar asientos"
                className="w-full sm:max-w-xs"
              />
            </>
          }
        >
          <TablaLista<AsientoListado>
            filas={filtradas}
            claveFila={(asiento) => asiento.id}
            paginacion={{ tamanoPagina: 15, etiqueta: "asientos" }}
            vacio={{
              titulo: "Sin asientos en el período",
              descripcion:
                "Registra un asiento manual o importa documentos para comenzar.",
              accion: (
                <Button onClick={() => setDialogoNuevo(true)}>
                  <IconPlus className="size-4" />
                  Nuevo asiento
                </Button>
              ),
            }}
            columnas={[
              {
                clave: "numero",
                encabezado: "Asiento",
                celda: (asiento) => (
                  <span className="font-medium tabular-nums">
                    {asiento.numero}
                  </span>
                ),
              },
              {
                clave: "fecha",
                encabezado: "Fecha",
                celda: (asiento) => formatearFecha(asiento.fecha),
              },
              {
                clave: "descripcion",
                encabezado: "Descripción",
                celda: (asiento) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{asiento.descripcion}</span>
                    {asiento.referencia ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {asiento.referencia}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                clave: "debitos",
                encabezado: "Débitos",
                alineacion: "derecha",
                celda: (asiento) => {
                  const movimientos = lineasPorAsiento.get(asiento.id) ?? [];
                  const total = movimientos.reduce(
                    (acumulado, linea) => acumulado + linea.debito,
                    0,
                  );
                  return formatearMoneda(total, moneda);
                },
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (asiento) => (
                  <PillEstado estado={estadoLegible(asiento.estado)} />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (asiento) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${asiento.numero}`}
                          disabled={procesando === asiento.id}
                        />
                      }
                    >
                      {procesando === asiento.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconDots className="size-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => setDetalle(asiento)}>
                        <IconEye className="size-4" />
                        Ver detalle
                      </DropdownMenuItem>
                      {asiento.estado === "draft" ? (
                        <DropdownMenuItem
                          onClick={() => void contabilizar(asiento)}
                        >
                          <IconCheck className="size-4" />
                          Contabilizar borrador
                        </DropdownMenuItem>
                      ) : null}
                      {asiento.estado === "posted" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setFechaReverso(hoySantoDomingo());
                              setMotivoReverso("");
                              setRevertir(asiento);
                            }}
                          >
                            <IconArrowBackUp className="size-4" />
                            Revertir asiento
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

      <DialogoAsientoManual
        abierto={dialogoNuevo}
        onOpenChange={setDialogoNuevo}
        cuentas={cuentas}
      />

      <Dialog
        open={detalle !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDetalle(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detalle?.numero ?? "Asiento"}</DialogTitle>
            <DialogDescription>
              {detalle
                ? `${formatearFecha(detalle.fecha)} · ${detalle.descripcion}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            <TablaLista<LineaAsiento>
              filas={lineasDetalle}
              claveFila={(linea) => linea.id}
              vacio={{ titulo: "Este asiento no tiene líneas." }}
              columnas={[
                {
                  clave: "cuenta",
                  encabezado: "Cuenta",
                  celda: (linea) => {
                    const cuenta = cuentasPorId.get(linea.cuentaId);
                    return cuenta
                      ? `${cuenta.codigo} · ${cuenta.nombre}`
                      : "Cuenta eliminada";
                  },
                },
                {
                  clave: "descripcion",
                  encabezado: "Descripción",
                  celda: (linea) => linea.descripcion || "—",
                },
                {
                  clave: "debito",
                  encabezado: "Débito",
                  alineacion: "derecha",
                  celda: (linea) =>
                    linea.debito > 0
                      ? formatearMoneda(linea.debito, moneda)
                      : "—",
                },
                {
                  clave: "credito",
                  encabezado: "Crédito",
                  alineacion: "derecha",
                  celda: (linea) =>
                    linea.credito > 0
                      ? formatearMoneda(linea.credito, moneda)
                      : "—",
                },
              ]}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revertir !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setRevertir(null);
        }}
      >
        <DialogContent>
          <form className="flex flex-col gap-4" onSubmit={confirmarReverso}>
            <DialogHeader>
              <DialogTitle>Revertir asiento</DialogTitle>
              <DialogDescription>
                {revertir
                  ? `Se creará un asiento de contrapartida para ${revertir.numero}.`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <FormGrid className="sm:grid-cols-1 lg:grid-cols-1">
              <FormField htmlFor="reverso-fecha" label="Fecha del reverso">
                <DatePicker
                  id="reverso-fecha"
                  value={fechaReverso}
                  onChange={setFechaReverso}
                />
              </FormField>
              <FormField htmlFor="reverso-motivo" label="Motivo">
                <Textarea
                  id="reverso-motivo"
                  value={motivoReverso}
                  onChange={(evento) => setMotivoReverso(evento.target.value)}
                  placeholder="Motivo de la anulación"
                  className="min-h-16"
                />
              </FormField>
            </FormGrid>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevertir(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={procesando !== null}
              >
                {procesando !== null ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconArrowBackUp className="size-4" />
                )}
                Revertir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
