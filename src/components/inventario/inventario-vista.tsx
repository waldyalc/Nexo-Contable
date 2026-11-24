"use client";

import {
  IconAdjustments,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconFileSpreadsheet,
  IconHistory,
  IconLoader2,
  IconPackages,
  IconPencil,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import {
  type DatosMovimientoInventario,
  cargaMasivaArticulosAction,
  guardarArticuloAction,
  registrarMovimientoInventarioAction,
} from "@/app/(app)/inventario/actions";
import { TarjetasResumen } from "@/components/comunes/tarjetas-resumen";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado, type TonoPill } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type Moneda,
  aNumero,
  formatearCantidad,
  formatearFecha,
  formatearMoneda,
  hoySantoDomingo,
} from "@/lib/formato";
import {
  type FilaArticuloCarga,
  MAXIMO_FILAS_ARTICULOS,
  type ResultadoFilasArticulos,
  filasDesdeMatriz,
  parsearArticulosCsv,
} from "@/lib/inventario/filas-articulos";

export interface ArticuloListado {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  cantidadDisponible: number;
  costoPromedio: number;
  valorTotal: number;
  precioVenta: number;
  cuentaInventarioId: string;
  cuentaCostoId: string;
  cuentaIngresoId: string;
  activo: boolean;
}

export interface MovimientoInventarioListado {
  id: string;
  articuloId: string;
  fecha: string;
  tipo: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  referencia: string;
  notas: string;
}

export interface InventarioVistaProps {
  empresaId: string;
  moneda: Moneda;
  articulos: readonly ArticuloListado[];
  movimientos: readonly MovimientoInventarioListado[];
  opcionesCuentas: readonly OpcionSelect[];
  filtroArticulo: string;
  puedeGestionar: boolean;
  puedeOperar: boolean;
}

const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  in: "Entrada",
  out: "Salida",
  adjustment: "Ajuste",
};

const TONO_MOVIMIENTO: Record<string, TonoPill> = {
  in: "exito",
  out: "peligro",
  adjustment: "pendiente",
};

const OPCIONES_TIPO_MOVIMIENTO = [
  { value: "in", label: "Entrada (aumenta el stock)" },
  { value: "out", label: "Salida (disminuye el stock)" },
  { value: "adjustment", label: "Ajuste de inventario" },
];

const OPCIONES_DIRECCION = [
  { value: "in", label: "Ajuste hacia arriba" },
  { value: "out", label: "Ajuste hacia abajo" },
];

const OPCIONES_ESTADO = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

export function InventarioVista({
  empresaId,
  moneda,
  articulos,
  movimientos,
  opcionesCuentas,
  filtroArticulo,
  puedeGestionar,
  puedeOperar,
}: InventarioVistaProps) {
  const router = useRouter();
  const [dialogoArticulo, setDialogoArticulo] = useState(false);
  const [articuloEdicion, setArticuloEdicion] =
    useState<ArticuloListado | null>(null);
  const [dialogoCarga, setDialogoCarga] = useState(false);
  const [dialogoMovimiento, setDialogoMovimiento] = useState(false);
  const [articuloFiltro, setArticuloFiltro] = useState(filtroArticulo);

  const nombreArticulo = useMemo(() => {
    const mapa = new Map(
      articulos.map((articulo) => [
        articulo.id,
        `${articulo.sku} · ${articulo.nombre}`,
      ]),
    );
    return (id: string) => mapa.get(id) ?? "—";
  }, [articulos]);

  const opcionesArticulos = useMemo(
    () =>
      articulos.map((articulo) => ({
        value: articulo.id,
        label: `${articulo.sku} · ${articulo.nombre}`,
      })),
    [articulos],
  );

  const totales = useMemo(() => {
    const activos = articulos.filter((articulo) => articulo.activo).length;
    const valor = articulos.reduce(
      (total, articulo) => total + articulo.valorTotal,
      0,
    );
    const unidades = articulos.reduce(
      (total, articulo) => total + articulo.cantidadDisponible,
      0,
    );

    return { activos, valor, unidades };
  }, [articulos]);

  function cambiarFiltro(valor: string) {
    setArticuloFiltro(valor);
    router.replace(
      valor === "" ? "/inventario" : `/inventario?articulo=${valor}`,
      { scroll: false },
    );
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Artículos, costo promedio ponderado y kardex de movimientos."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Inventario" }]}
        acciones={
          <Button variant="outline" onClick={() => router.refresh()}>
            <IconRefresh className="size-4" />
            Actualizar
          </Button>
        }
      />

      <TarjetasResumen
        etiqueta="Resumen de inventario"
        datos={[
          {
            etiqueta: "Artículos activos",
            valor: String(totales.activos),
            detalle: `${articulos.length} artículos registrados`,
            icono: IconPackages,
          },
          {
            etiqueta: "Valor del inventario",
            valor: formatearMoneda(totales.valor, moneda),
            detalle: "Costo promedio acumulado",
            icono: IconHistory,
          },
          {
            etiqueta: "Unidades disponibles",
            valor: formatearCantidad(totales.unidades, 4),
            detalle: "Suma de cantidades en existencia",
            icono: IconAdjustments,
          },
        ]}
      />

      <Tabs defaultValue="articulos" className="gap-4">
        <TabsList>
          <TabsTrigger value="articulos">Artículos</TabsTrigger>
          <TabsTrigger value="kardex">Kardex / Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="articulos">
          <TarjetaLista data-lista="articulos-inventario">
            <BarraLista
              titulo="Catálogo de artículos"
              descripcion="Precio de venta y cuentas contables de inventario, costo e ingreso."
              acciones={
                puedeGestionar ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setDialogoCarga(true)}
                    >
                      <IconFileSpreadsheet className="size-4" />
                      Carga masiva Excel/CSV
                    </Button>
                    <Button
                      onClick={() => {
                        setArticuloEdicion(null);
                        setDialogoArticulo(true);
                      }}
                    >
                      <IconPlus className="size-4" />
                      Nuevo artículo
                    </Button>
                  </>
                ) : undefined
              }
            >
              <TablaLista<ArticuloListado>
                filas={articulos}
                claveFila={(articulo) => articulo.id}
                ordenable
                paginacion={{ tamanoPagina: 15, etiqueta: "artículos" }}
                vacio={{
                  titulo: "Sin artículos",
                  descripcion:
                    "Crea el primer artículo o carga el catálogo desde Excel o CSV.",
                  icono: <IconPackages className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "sku",
                    encabezado: "SKU",
                    celda: (articulo) => (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {articulo.sku}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {articulo.nombre}
                        </span>
                      </div>
                    ),
                  },
                  {
                    clave: "unidad",
                    encabezado: "Unidad",
                    celda: (articulo) => articulo.unidad,
                  },
                  {
                    clave: "disponible",
                    encabezado: "Disponible",
                    alineacion: "derecha",
                    celda: (articulo) =>
                      formatearCantidad(articulo.cantidadDisponible, 4),
                  },
                  {
                    clave: "costo",
                    encabezado: "Costo promedio",
                    alineacion: "derecha",
                    celda: (articulo) =>
                      formatearMoneda(articulo.costoPromedio, moneda),
                  },
                  {
                    clave: "valor",
                    encabezado: "Valor total",
                    alineacion: "derecha",
                    celda: (articulo) =>
                      formatearMoneda(articulo.valorTotal, moneda),
                  },
                  {
                    clave: "precio",
                    encabezado: "Precio venta",
                    alineacion: "derecha",
                    celda: (articulo) =>
                      formatearMoneda(articulo.precioVenta, moneda),
                  },
                  {
                    clave: "estado",
                    encabezado: "Estado",
                    celda: (articulo) => (
                      <PillEstado
                        estado={articulo.activo ? "activo" : "inactivo"}
                      />
                    ),
                  },
                  {
                    clave: "acciones",
                    encabezado: "",
                    ordenable: false,
                    alineacion: "derecha",
                    celda: (articulo) =>
                      puedeGestionar ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${articulo.nombre}`}
                          onClick={() => {
                            setArticuloEdicion(articulo);
                            setDialogoArticulo(true);
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

        <TabsContent value="kardex">
          <TarjetaLista data-lista="movimientos-inventario">
            <BarraLista
              titulo="Kardex de movimientos"
              descripcion="Entradas, salidas y ajustes con costo promedio ponderado. Se muestran hasta 500 movimientos del filtro."
              acciones={
                puedeOperar ? (
                  <Button onClick={() => setDialogoMovimiento(true)}>
                    <IconPlus className="size-4" />
                    Registrar movimiento
                  </Button>
                ) : undefined
              }
              filtros={
                <div className="w-full sm:max-w-sm">
                  <SelectCampo
                    id="filtro-articulo-kardex"
                    opciones={opcionesArticulos}
                    valor={articuloFiltro}
                    onCambio={cambiarFiltro}
                    etiquetaVacia="Todos los artículos"
                    buscable
                    aria-label="Filtrar kardex por artículo"
                  />
                </div>
              }
            >
              <TablaLista<MovimientoInventarioListado>
                filas={movimientos}
                claveFila={(movimiento) => movimiento.id}
                paginacion={{ tamanoPagina: 25, etiqueta: "movimientos" }}
                vacio={{
                  titulo: "Sin movimientos",
                  descripcion:
                    "Registra una entrada, una salida o un ajuste de inventario.",
                  icono: <IconArrowDownLeft className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "fecha",
                    encabezado: "Fecha",
                    celda: (movimiento) => formatearFecha(movimiento.fecha),
                  },
                  {
                    clave: "articulo",
                    encabezado: "Artículo",
                    celda: (movimiento) =>
                      nombreArticulo(movimiento.articuloId),
                  },
                  {
                    clave: "tipo",
                    encabezado: "Tipo",
                    celda: (movimiento) => (
                      <PillEstado
                        estado={
                          ETIQUETAS_MOVIMIENTO[movimiento.tipo] ??
                          movimiento.tipo
                        }
                        tono={TONO_MOVIMIENTO[movimiento.tipo] ?? "neutro"}
                      />
                    ),
                  },
                  {
                    clave: "cantidad",
                    encabezado: "Cantidad",
                    alineacion: "derecha",
                    celda: (movimiento) =>
                      formatearCantidad(movimiento.cantidad, 4),
                  },
                  {
                    clave: "costo-unitario",
                    encabezado: "Costo unitario",
                    alineacion: "derecha",
                    celda: (movimiento) =>
                      formatearMoneda(movimiento.costoUnitario, moneda),
                  },
                  {
                    clave: "costo-total",
                    encabezado: "Costo total",
                    alineacion: "derecha",
                    celda: (movimiento) =>
                      formatearMoneda(movimiento.costoTotal, moneda),
                  },
                  {
                    clave: "referencia",
                    encabezado: "Referencia",
                    celda: (movimiento) =>
                      movimiento.referencia === ""
                        ? "—"
                        : movimiento.referencia,
                  },
                ]}
              />
            </BarraLista>
          </TarjetaLista>
        </TabsContent>
      </Tabs>

      <DialogoArticulo
        abierto={dialogoArticulo}
        onOpenChange={(abierto) => {
          setDialogoArticulo(abierto);
          if (!abierto) setArticuloEdicion(null);
        }}
        articulo={articuloEdicion}
        empresaId={empresaId}
        opcionesCuentas={opcionesCuentas}
        moneda={moneda}
      />

      <DialogoCargaMasiva
        abierto={dialogoCarga}
        onOpenChange={setDialogoCarga}
        empresaId={empresaId}
      />

      <DialogoMovimiento
        abierto={dialogoMovimiento}
        onOpenChange={setDialogoMovimiento}
        empresaId={empresaId}
        articulos={articulos}
        opcionesCuentas={opcionesCuentas}
        articuloInicial={articuloFiltro}
        moneda={moneda}
      />
    </>
  );
}

interface DialogoArticuloProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  articulo: ArticuloListado | null;
  empresaId: string;
  opcionesCuentas: readonly OpcionSelect[];
  moneda: Moneda;
}

interface FormArticulo {
  sku: string;
  nombre: string;
  unidad: string;
  descripcion: string;
  precioVenta: string;
  cuentaInventarioId: string;
  cuentaCostoId: string;
  cuentaIngresoId: string;
  activo: string;
}

function formArticuloInicial(articulo: ArticuloListado | null): FormArticulo {
  if (!articulo) {
    return {
      sku: "",
      nombre: "",
      unidad: "UNIDAD",
      descripcion: "",
      precioVenta: "0",
      cuentaInventarioId: "",
      cuentaCostoId: "",
      cuentaIngresoId: "",
      activo: "activo",
    };
  }

  return {
    sku: articulo.sku,
    nombre: articulo.nombre,
    unidad: articulo.unidad,
    descripcion: articulo.descripcion,
    precioVenta: String(articulo.precioVenta),
    cuentaInventarioId: articulo.cuentaInventarioId,
    cuentaCostoId: articulo.cuentaCostoId,
    cuentaIngresoId: articulo.cuentaIngresoId,
    activo: articulo.activo ? "activo" : "inactivo",
  };
}

function DialogoArticulo({
  abierto,
  onOpenChange,
  articulo,
  empresaId,
  opcionesCuentas,
  moneda,
}: DialogoArticuloProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormArticulo>(formArticuloInicial(articulo));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm(formArticuloInicial(articulo));
    setError(null);
    setGuardando(false);
  }, [abierto, articulo]);

  function actualizar<C extends keyof FormArticulo>(
    campo: C,
    valor: FormArticulo[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.sku.trim() === "" || form.nombre.trim() === "") {
      setError("El SKU y el nombre del artículo son obligatorios.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await guardarArticuloAction({
      empresaId,
      id: articulo ? articulo.id : null,
      sku: form.sku,
      nombre: form.nombre,
      unidad: form.unidad,
      descripcion: form.descripcion,
      precioVenta: aNumero(form.precioVenta),
      cuentaInventarioId: form.cuentaInventarioId,
      cuentaCostoId: form.cuentaCostoId,
      cuentaIngresoId: form.cuentaIngresoId,
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
              {articulo ? "Editar artículo" : "Nuevo artículo"}
            </DialogTitle>
            <DialogDescription>
              El costo promedio y las existencias se actualizan con los
              movimientos del kardex.
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
              <FormField htmlFor="articulo-sku" label="SKU" required>
                <Input
                  id="articulo-sku"
                  value={form.sku}
                  onChange={(evento) =>
                    actualizar("sku", evento.target.value.toUpperCase())
                  }
                  placeholder="Ej. ART-001"
                />
              </FormField>

              <FormField
                htmlFor="articulo-nombre"
                label="Nombre"
                required
                className="sm:col-span-2"
              >
                <Input
                  id="articulo-nombre"
                  value={form.nombre}
                  onChange={(evento) =>
                    actualizar("nombre", evento.target.value)
                  }
                  placeholder="Ej. Aceite de motor 20W-50"
                />
              </FormField>

              <FormField htmlFor="articulo-unidad" label="Unidad">
                <Input
                  id="articulo-unidad"
                  value={form.unidad}
                  onChange={(evento) =>
                    actualizar("unidad", evento.target.value.toUpperCase())
                  }
                  placeholder="UNIDAD, GALÓN, CAJA…"
                />
              </FormField>

              <FormField
                htmlFor="articulo-precio"
                label={`Precio de venta (${moneda})`}
              >
                <Input
                  id="articulo-precio"
                  value={form.precioVenta}
                  onChange={(evento) =>
                    actualizar("precioVenta", evento.target.value)
                  }
                  inputMode="decimal"
                  className="text-right tabular-nums"
                />
              </FormField>

              <FormField htmlFor="articulo-estado" label="Estado" required>
                <SelectCampo
                  id="articulo-estado"
                  opciones={OPCIONES_ESTADO}
                  valor={form.activo}
                  onCambio={(valor) => actualizar("activo", valor)}
                  requerido
                  aria-label="Estado del artículo"
                />
              </FormField>

              <FormField
                htmlFor="articulo-inventario"
                label="Cuenta de inventario"
                className="sm:col-span-2 lg:col-span-1"
              >
                <SelectCampo
                  id="articulo-inventario"
                  opciones={opcionesCuentas}
                  valor={form.cuentaInventarioId}
                  onCambio={(valor) => actualizar("cuentaInventarioId", valor)}
                  buscable
                  etiquetaVacia="Sin asignar"
                  aria-label="Cuenta de inventario"
                />
              </FormField>

              <FormField
                htmlFor="articulo-costo"
                label="Cuenta de costo"
                className="sm:col-span-2 lg:col-span-1"
              >
                <SelectCampo
                  id="articulo-costo"
                  opciones={opcionesCuentas}
                  valor={form.cuentaCostoId}
                  onCambio={(valor) => actualizar("cuentaCostoId", valor)}
                  buscable
                  etiquetaVacia="Sin asignar"
                  aria-label="Cuenta de costo"
                />
              </FormField>

              <FormField
                htmlFor="articulo-ingreso"
                label="Cuenta de ingreso"
                className="sm:col-span-2 lg:col-span-1"
              >
                <SelectCampo
                  id="articulo-ingreso"
                  opciones={opcionesCuentas}
                  valor={form.cuentaIngresoId}
                  onCambio={(valor) => actualizar("cuentaIngresoId", valor)}
                  buscable
                  etiquetaVacia="Sin asignar"
                  aria-label="Cuenta de ingreso"
                />
              </FormField>

              <FormField
                htmlFor="articulo-descripcion"
                label="Descripción"
                className="sm:col-span-2 lg:col-span-3"
              >
                <Textarea
                  id="articulo-descripcion"
                  value={form.descripcion}
                  onChange={(evento) =>
                    actualizar("descripcion", evento.target.value)
                  }
                  className="min-h-16"
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
                  <IconPackages className="size-4" />
                  {articulo ? "Guardar cambios" : "Crear artículo"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function leerArchivoArticulos(
  archivo: File,
): Promise<ResultadoFilasArticulos> {
  if (archivo.name.toLowerCase().endsWith(".csv")) {
    const texto = await archivo.text();
    return parsearArticulosCsv(texto);
  }

  const { Workbook } = await import("exceljs");
  const libro = new Workbook();
  const contenido = await archivo.arrayBuffer();
  await libro.xlsx.load(contenido);
  const hoja = libro.worksheets[0];

  if (!hoja) {
    return { filas: [], errores: ["El libro de Excel no tiene hojas."] };
  }

  const matriz: string[][] = [];

  hoja.eachRow((fila) => {
    const celdas: string[] = [];
    fila.eachCell({ includeEmpty: true }, (celda) => {
      celdas.push(celda.text === undefined ? "" : String(celda.text));
    });
    matriz.push(celdas);
  });

  return filasDesdeMatriz(matriz);
}

interface DialogoCargaMasivaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
}

interface ArchivoArticulos {
  nombre: string;
  filas: FilaArticuloCarga[];
  errores: string[];
}

function DialogoCargaMasiva({
  abierto,
  onOpenChange,
  empresaId,
}: DialogoCargaMasivaProps) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<ArchivoArticulos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setArchivo(null);
    setCargando(false);
    setGuardando(false);
    setError(null);
  }, [abierto]);

  async function leerArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const seleccionado = evento.target.files?.[0];

    if (!seleccionado) {
      setArchivo(null);
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const resultado = await leerArchivoArticulos(seleccionado);
      setArchivo({
        nombre: seleccionado.name,
        filas: resultado.filas,
        errores: resultado.errores,
      });
    } catch {
      setError(
        "No pudimos leer el archivo. Verifica que sea un Excel o CSV válido.",
      );
    } finally {
      setCargando(false);
    }
  }

  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (!archivo || archivo.filas.length === 0) {
      setError("Carga un archivo con al menos un artículo válido.");
      return;
    }

    if (archivo.errores.length > 0) {
      setError("Corrige los errores del archivo antes de cargarlo.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await cargaMasivaArticulosAction(
      empresaId,
      archivo.filas,
    );

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
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={importar} noValidate>
          <DialogHeader>
            <DialogTitle>Carga masiva de artículos</DialogTitle>
            <DialogDescription>
              Archivo Excel (.xlsx) o CSV con las columnas: SKU, nombre, unidad,
              descripción y precio de venta. Máximo {MAXIMO_FILAS_ARTICULOS}{" "}
              artículos por carga.
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

          <FormField htmlFor="masiva-archivo" label="Archivo" required>
            <Input
              id="masiva-archivo"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(evento) => void leerArchivo(evento)}
              disabled={cargando}
              className="h-auto py-1.5"
            />
          </FormField>

          {cargando ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              Leyendo archivo…
            </div>
          ) : null}

          {archivo ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">{archivo.nombre}</p>
              <p className="text-muted-foreground tabular-nums">
                {archivo.filas.length} artículos válidos ·{" "}
                {archivo.errores.length} errores
              </p>

              {archivo.errores.length > 0 ? (
                <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-xs text-destructive">
                  {archivo.errores.slice(0, 8).map((mensaje) => (
                    <li key={mensaje}>{mensaje}</li>
                  ))}
                </ul>
              ) : (
                <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
                  {archivo.filas.slice(0, 6).map((fila) => (
                    <li key={fila.sku}>
                      {fila.sku} · {fila.nombre} · {fila.unidad}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || cargando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Cargando…
                </>
              ) : (
                <>
                  <IconFileSpreadsheet className="size-4" />
                  Cargar artículos
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoMovimientoProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  articulos: readonly ArticuloListado[];
  opcionesCuentas: readonly OpcionSelect[];
  articuloInicial: string;
  moneda: Moneda;
}

interface FormMovimiento {
  articuloId: string;
  fecha: string;
  tipo: "in" | "out" | "adjustment";
  cantidad: string;
  costoUnitario: string;
  direccion: string;
  cuentaContrapartidaId: string;
  referencia: string;
  notas: string;
}

function DialogoMovimiento({
  abierto,
  onOpenChange,
  empresaId,
  articulos,
  opcionesCuentas,
  articuloInicial,
  moneda,
}: DialogoMovimientoProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormMovimiento>({
    articuloId: articuloInicial,
    fecha: hoySantoDomingo(),
    tipo: "in",
    cantidad: "",
    costoUnitario: "",
    direccion: "in",
    cuentaContrapartidaId: "",
    referencia: "",
    notas: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm({
      articuloId:
        articuloInicial !== "" ? articuloInicial : (articulos[0]?.id ?? ""),
      fecha: hoySantoDomingo(),
      tipo: "in",
      cantidad: "",
      costoUnitario: "",
      direccion: "in",
      cuentaContrapartidaId: "",
      referencia: "",
      notas: "",
    });
    setError(null);
    setGuardando(false);
  }, [abierto, articuloInicial, articulos]);

  const opcionesArticulos = articulos
    .filter((articulo) => articulo.activo)
    .map((articulo) => ({
      value: articulo.id,
      label: `${articulo.sku} · ${articulo.nombre}`,
    }));

  function actualizar<C extends keyof FormMovimiento>(
    campo: C,
    valor: FormMovimiento[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.articuloId === "") {
      setError("Selecciona el artículo.");
      return;
    }

    const cantidad = aNumero(form.cantidad);
    if (cantidad <= 0) {
      setError("La cantidad debe ser mayor a cero.");
      return;
    }

    setError(null);
    setGuardando(true);

    const datos: DatosMovimientoInventario = {
      empresaId,
      articuloId: form.articuloId,
      fecha: form.fecha,
      tipo: form.tipo,
      cantidad,
      costoUnitario:
        form.tipo === "in" && form.costoUnitario.trim() !== ""
          ? aNumero(form.costoUnitario)
          : null,
      cuentaContrapartidaId: form.cuentaContrapartidaId,
      referencia: form.referencia,
      notas: form.notas,
      direccion:
        form.tipo === "adjustment"
          ? form.direccion === "out"
            ? "out"
            : "in"
          : "",
    };

    const resultado = await registrarMovimientoInventarioAction(datos);
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
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>Registrar movimiento de inventario</DialogTitle>
            <DialogDescription>
              Las salidas usan el costo promedio ponderado del artículo. En las
              entradas puedes indicar el costo unitario.
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
            <FormField
              htmlFor="inv-mov-articulo"
              label="Artículo"
              required
              className="sm:col-span-2"
            >
              <SelectCampo
                id="inv-mov-articulo"
                opciones={opcionesArticulos}
                valor={form.articuloId}
                onCambio={(valor) => actualizar("articuloId", valor)}
                buscable
                requerido
                etiquetaVacia="Buscar artículo…"
                aria-label="Artículo del movimiento"
              />
            </FormField>

            <FormField htmlFor="inv-mov-fecha" label="Fecha" required>
              <DatePicker
                id="inv-mov-fecha"
                value={form.fecha}
                onChange={(valor) => actualizar("fecha", valor)}
              />
            </FormField>

            <FormField htmlFor="inv-mov-tipo" label="Tipo" required>
              <SelectCampo
                id="inv-mov-tipo"
                opciones={OPCIONES_TIPO_MOVIMIENTO}
                valor={form.tipo}
                onCambio={(valor) =>
                  actualizar(
                    "tipo",
                    valor === "out"
                      ? "out"
                      : valor === "adjustment"
                        ? "adjustment"
                        : "in",
                  )
                }
                requerido
                aria-label="Tipo de movimiento de inventario"
              />
            </FormField>

            <FormField htmlFor="inv-mov-cantidad" label="Cantidad" required>
              <Input
                id="inv-mov-cantidad"
                value={form.cantidad}
                onChange={(evento) =>
                  actualizar("cantidad", evento.target.value)
                }
                inputMode="decimal"
                placeholder="0.0000"
                className="text-right tabular-nums"
              />
            </FormField>

            {form.tipo === "in" ? (
              <FormField
                htmlFor="inv-mov-costo"
                label={`Costo unitario (${moneda})`}
              >
                <Input
                  id="inv-mov-costo"
                  value={form.costoUnitario}
                  onChange={(evento) =>
                    actualizar("costoUnitario", evento.target.value)
                  }
                  inputMode="decimal"
                  placeholder="Costo promedio"
                  className="text-right tabular-nums"
                />
              </FormField>
            ) : null}

            {form.tipo === "adjustment" ? (
              <FormField htmlFor="inv-mov-direccion" label="Dirección" required>
                <SelectCampo
                  id="inv-mov-direccion"
                  opciones={OPCIONES_DIRECCION}
                  valor={form.direccion}
                  onCambio={(valor) => actualizar("direccion", valor)}
                  requerido
                  aria-label="Dirección del ajuste"
                />
              </FormField>
            ) : null}

            <FormField
              htmlFor="inv-mov-contrapartida"
              label="Cuenta de contrapartida"
              className="sm:col-span-2"
            >
              <SelectCampo
                id="inv-mov-contrapartida"
                opciones={opcionesCuentas}
                valor={form.cuentaContrapartidaId}
                onCambio={(valor) => actualizar("cuentaContrapartidaId", valor)}
                buscable
                etiquetaVacia="Usar la cuenta de costo del artículo"
                aria-label="Cuenta de contrapartida"
              />
            </FormField>

            <FormField htmlFor="inv-mov-referencia" label="Referencia">
              <Input
                id="inv-mov-referencia"
                value={form.referencia}
                onChange={(evento) =>
                  actualizar("referencia", evento.target.value)
                }
                placeholder="Ej. FAC-001"
              />
            </FormField>

            <FormField
              htmlFor="inv-mov-notas"
              label="Notas"
              className="sm:col-span-2"
            >
              <Input
                id="inv-mov-notas"
                value={form.notas}
                onChange={(evento) => actualizar("notas", evento.target.value)}
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
                  Registrando…
                </>
              ) : (
                <>
                  <IconArrowUpRight className="size-4" />
                  Registrar movimiento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
