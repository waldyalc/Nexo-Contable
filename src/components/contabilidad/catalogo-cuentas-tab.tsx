"use client";

import {
  IconCheck,
  IconDatabase,
  IconDots,
  IconFileSpreadsheet,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconPower,
  IconScale,
  IconSearch,
  IconUpload,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type CuentaContable,
  actualizarCuentaAction,
  crearCuentaAction,
  importarCatalogoBaseAction,
  importarCatalogoCsvAction,
} from "@/app/(app)/contabilidad/actions";
import { DialogoAsientoManual } from "@/components/contabilidad/diario-asientos-tab";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const OPCIONES_CLASIFICACION = [
  { value: "asset", label: "Activos" },
  { value: "liability", label: "Pasivos" },
  { value: "equity", label: "Patrimonio" },
  { value: "income", label: "Ingresos" },
  { value: "cost", label: "Costos" },
  { value: "expense", label: "Gastos" },
];

export const ETIQUETAS_CLASIFICACION: Record<string, string> = {
  asset: "Activo",
  liability: "Pasivo",
  equity: "Patrimonio",
  income: "Ingreso",
  cost: "Costo",
  expense: "Gasto",
};

const OPCIONES_NATURALEZA = [
  { value: "debit", label: "Deudora (débito)" },
  { value: "credit", label: "Acreedora (crédito)" },
];

const OPCIONES_CATEGORIA_FLUJO = [
  { value: "operating", label: "Operación" },
  { value: "investing", label: "Inversión" },
  { value: "financing", label: "Financiamiento" },
  { value: "other", label: "Otra" },
];

function etiquetaClasificacion(valor: string): string {
  return ETIQUETAS_CLASIFICACION[valor] ?? valor;
}

function etiquetaNaturaleza(valor: string): string {
  return valor === "credit" ? "Acreedora" : "Deudora";
}

export interface CatalogoCuentasTabProps {
  cuentas: readonly CuentaContable[];
}

export function CatalogoCuentasTab({ cuentas }: CatalogoCuentasTabProps) {
  const router = useRouter();
  const archivoCsv = useRef<HTMLInputElement>(null);
  const [busqueda, setBusqueda] = useState("");
  const [clasificacion, setClasificacion] = useState("");
  const [dialogoCuenta, setDialogoCuenta] = useState(false);
  const [cuentaEdicion, setCuentaEdicion] = useState<CuentaContable | null>(
    null,
  );
  const [dialogoBalances, setDialogoBalances] = useState(false);
  const [importando, setImportando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cuentasPorId = useMemo(
    () => new Map(cuentas.map((cuenta) => [cuenta.id, cuenta])),
    [cuentas],
  );

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return cuentas.filter((cuenta) => {
      if (clasificacion !== "" && cuenta.clasificacion !== clasificacion) {
        return false;
      }
      if (termino === "") return true;

      return (
        cuenta.codigo.toLowerCase().includes(termino) ||
        cuenta.nombre.toLowerCase().includes(termino)
      );
    });
  }, [busqueda, clasificacion, cuentas]);

  function abrirCrear() {
    setCuentaEdicion(null);
    setDialogoCuenta(true);
  }

  function abrirEditar(cuenta: CuentaContable) {
    setCuentaEdicion(cuenta);
    setDialogoCuenta(true);
  }

  function cambiarDialogo(abierto: boolean) {
    setDialogoCuenta(abierto);
    if (!abierto) setCuentaEdicion(null);
  }

  async function cargarCatalogoBase() {
    setImportando(true);
    const resultado = await importarCatalogoBaseAction();
    setImportando(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    router.refresh();
  }

  async function importarCsv(archivo: File) {
    setImportando(true);
    const texto = await archivo.text();
    const resultado = await importarCatalogoCsvAction(texto);
    setImportando(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    router.refresh();
  }

  async function alternarActiva(cuenta: CuentaContable) {
    setProcesando(cuenta.id);
    const resultado = await actualizarCuentaAction({
      cuentaId: cuenta.id,
      nombre: cuenta.nombre,
      activa: !cuenta.activa,
      esAgrupacion: cuenta.esAgrupacion,
      esEquivalenteEfectivo: cuenta.esEquivalenteEfectivo,
      categoriaFlujoEfectivo: cuenta.categoriaFlujoEfectivo,
    });
    setProcesando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    router.refresh();
  }

  return (
    <>
      <TarjetaLista>
        <BarraLista
          titulo="Catálogo de cuentas"
          descripcion={`${filtradas.length} de ${cuentas.length} cuentas`}
          acciones={
            <>
              <Button onClick={abrirCrear}>
                <IconPlus className="size-4" />
                Nueva cuenta
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      disabled={importando}
                      aria-label="Opciones de importación"
                    />
                  }
                >
                  {importando ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconUpload className="size-4" />
                  )}
                  Importar
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    onClick={() => void cargarCatalogoBase()}
                    disabled={importando}
                  >
                    <IconDatabase className="size-4" />
                    Cargar catálogo base (347 cuentas)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => archivoCsv.current?.click()}
                    disabled={importando}
                  >
                    <IconFileSpreadsheet className="size-4" />
                    Importar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                onClick={() => setDialogoBalances(true)}
              >
                <IconScale className="size-4" />
                Balances iniciales
              </Button>
            </>
          }
          filtros={
            <>
              <div className="relative w-full sm:max-w-xs">
                <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar por código o nombre…"
                  aria-label="Buscar cuentas"
                  className="h-9 pl-8"
                />
              </div>
              <SelectCampo
                opciones={OPCIONES_CLASIFICACION}
                valor={clasificacion}
                onCambio={setClasificacion}
                etiquetaVacia="Todas las clasificaciones"
                className="w-full sm:w-[210px]"
                aria-label="Filtrar por clasificación"
              />
            </>
          }
        >
          <TablaLista<CuentaContable>
            filas={filtradas}
            claveFila={(cuenta) => cuenta.id}
            paginacion={{ tamanoPagina: 25, etiqueta: "cuentas" }}
            vacio={{
              titulo: "Sin cuentas todavía",
              descripcion:
                "Carga el catálogo base de 347 cuentas o crea tu primera cuenta contable.",
              accion: (
                <Button onClick={abrirCrear}>
                  <IconPlus className="size-4" />
                  Nueva cuenta
                </Button>
              ),
            }}
            columnas={[
              {
                clave: "codigo",
                encabezado: "Código",
                celda: (cuenta) => (
                  <span className="font-medium tabular-nums">
                    {cuenta.codigo}
                  </span>
                ),
              },
              {
                clave: "nombre",
                encabezado: "Cuenta",
                celda: (cuenta) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{cuenta.nombre}</span>
                    {cuenta.padreId ? (
                      <span className="truncate text-xs text-muted-foreground">
                        Depende de{" "}
                        {cuentasPorId.get(cuenta.padreId)?.codigo ?? "—"}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                clave: "clasificacion",
                encabezado: "Clasificación",
                celda: (cuenta) => etiquetaClasificacion(cuenta.clasificacion),
              },
              {
                clave: "naturaleza",
                encabezado: "Naturaleza",
                celda: (cuenta) => etiquetaNaturaleza(cuenta.naturaleza),
              },
              {
                clave: "tipo",
                encabezado: "Tipo",
                celda: (cuenta) =>
                  cuenta.esAgrupacion ? (
                    <PillEstado estado="agrupación" tono="neutro" />
                  ) : (
                    <PillEstado estado="movimiento" tono="exito" />
                  ),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (cuenta) => (
                  <PillEstado estado={cuenta.activa ? "activa" : "inactiva"} />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (cuenta) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${cuenta.codigo}`}
                          disabled={procesando === cuenta.id}
                        />
                      }
                    >
                      {procesando === cuenta.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconDots className="size-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => abrirEditar(cuenta)}>
                        <IconPencil className="size-4" />
                        Editar cuenta
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void alternarActiva(cuenta)}
                      >
                        {cuenta.activa ? (
                          <IconPower className="size-4" />
                        ) : (
                          <IconCheck className="size-4" />
                        )}
                        {cuenta.activa ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <input
        ref={archivoCsv}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="Archivo CSV de cuentas"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          evento.target.value = "";
          if (!archivo) return;
          void importarCsv(archivo);
        }}
      />

      <DialogoCuenta
        abierto={dialogoCuenta}
        onOpenChange={cambiarDialogo}
        cuenta={cuentaEdicion}
        cuentas={cuentas}
      />

      <DialogoAsientoManual
        abierto={dialogoBalances}
        onOpenChange={setDialogoBalances}
        cuentas={cuentas}
        titulo="Balances iniciales"
        descripcionInicial="Balances iniciales"
        bloquearDescripcion
        permitirBorrador={false}
      />
    </>
  );
}

interface DialogoCuentaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  cuenta: CuentaContable | null;
  cuentas: readonly CuentaContable[];
}

interface FormCuenta {
  codigo: string;
  nombre: string;
  clasificacion: string;
  naturaleza: string;
  codigoPadre: string;
  esAgrupacion: boolean;
  esEquivalenteEfectivo: boolean;
  categoriaFlujoEfectivo: string;
}

function formInicial(
  cuenta: CuentaContable | null,
  cuentas: readonly CuentaContable[],
): FormCuenta {
  if (!cuenta) {
    return {
      codigo: "",
      nombre: "",
      clasificacion: "asset",
      naturaleza: "debit",
      codigoPadre: "",
      esAgrupacion: false,
      esEquivalenteEfectivo: false,
      categoriaFlujoEfectivo: "operating",
    };
  }

  const padre = cuentas.find((candidata) => candidata.id === cuenta.padreId);

  return {
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    clasificacion: cuenta.clasificacion,
    naturaleza: cuenta.naturaleza,
    codigoPadre: padre?.codigo ?? "",
    esAgrupacion: cuenta.esAgrupacion,
    esEquivalenteEfectivo: cuenta.esEquivalenteEfectivo,
    categoriaFlujoEfectivo: cuenta.categoriaFlujoEfectivo,
  };
}

function DialogoCuenta({
  abierto,
  onOpenChange,
  cuenta,
  cuentas,
}: DialogoCuentaProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormCuenta>(() =>
    formInicial(cuenta, cuentas),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm(formInicial(cuenta, cuentas));
    setError(null);
    setGuardando(false);
  }, [abierto, cuenta, cuentas]);

  const esEdicion = cuenta !== null;

  const opcionesPadre = useMemo(
    () =>
      cuentas
        .filter((candidata) => candidata.id !== cuenta?.id)
        .map((candidata) => ({
          value: candidata.codigo,
          label: `${candidata.codigo} · ${candidata.nombre}`,
        })),
    [cuenta, cuentas],
  );

  function actualizar<C extends keyof FormCuenta>(
    campo: C,
    valor: FormCuenta[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.codigo.trim() === "" || form.nombre.trim() === "") {
      setError("El código y el nombre de la cuenta son obligatorios.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = cuenta
      ? await actualizarCuentaAction({
          cuentaId: cuenta.id,
          nombre: form.nombre,
          activa: cuenta.activa,
          esAgrupacion: form.esAgrupacion,
          esEquivalenteEfectivo: form.esEquivalenteEfectivo,
          categoriaFlujoEfectivo: form.categoriaFlujoEfectivo,
        })
      : await crearCuentaAction({
          codigo: form.codigo,
          nombre: form.nombre,
          clasificacion: form.clasificacion,
          naturaleza: form.naturaleza,
          codigoPadre: form.codigoPadre,
          esAgrupacion: form.esAgrupacion,
          esEquivalenteEfectivo: form.esEquivalenteEfectivo,
          categoriaFlujoEfectivo: form.categoriaFlujoEfectivo,
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
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={guardar}>
          <DialogHeader>
            <DialogTitle>
              {esEdicion ? "Editar cuenta" : "Nueva cuenta"}
            </DialogTitle>
            <DialogDescription>
              Las cuentas de agrupación organizan el catálogo; solo las cuentas
              de movimiento aceptan asientos.
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
            <FormField htmlFor="cuenta-codigo" label="Código" required>
              <Input
                id="cuenta-codigo"
                value={form.codigo}
                onChange={(evento) => actualizar("codigo", evento.target.value)}
                disabled={esEdicion}
                placeholder="Ej. 11010101"
              />
            </FormField>

            <FormField
              htmlFor="cuenta-nombre"
              label="Nombre"
              required
              className="sm:col-span-2"
            >
              <Input
                id="cuenta-nombre"
                value={form.nombre}
                onChange={(evento) => actualizar("nombre", evento.target.value)}
                placeholder="Ej. Caja general"
              />
            </FormField>

            <FormField
              htmlFor="cuenta-clasificacion"
              label="Clasificación"
              required
            >
              <SelectCampo
                id="cuenta-clasificacion"
                opciones={OPCIONES_CLASIFICACION}
                valor={form.clasificacion}
                onCambio={(valor) => actualizar("clasificacion", valor)}
                deshabilitado={esEdicion}
                requerido
                aria-label="Clasificación"
              />
            </FormField>

            <FormField htmlFor="cuenta-naturaleza" label="Naturaleza" required>
              <SelectCampo
                id="cuenta-naturaleza"
                opciones={OPCIONES_NATURALEZA}
                valor={form.naturaleza}
                onCambio={(valor) => actualizar("naturaleza", valor)}
                deshabilitado={esEdicion}
                requerido
                aria-label="Naturaleza"
              />
            </FormField>

            <FormField htmlFor="cuenta-flujo" label="Categoría de flujo">
              <SelectCampo
                id="cuenta-flujo"
                opciones={OPCIONES_CATEGORIA_FLUJO}
                valor={form.categoriaFlujoEfectivo}
                onCambio={(valor) =>
                  actualizar("categoriaFlujoEfectivo", valor)
                }
                aria-label="Categoría de flujo de efectivo"
              />
            </FormField>

            {!esEdicion ? (
              <FormField
                htmlFor="cuenta-padre"
                label="Cuenta padre"
                className="sm:col-span-2"
              >
                <SelectCampo
                  id="cuenta-padre"
                  opciones={opcionesPadre}
                  valor={form.codigoPadre}
                  onCambio={(valor) => actualizar("codigoPadre", valor)}
                  buscable
                  etiquetaVacia="Sin cuenta padre"
                  aria-label="Cuenta padre"
                />
              </FormField>
            ) : null}
          </FormGrid>

          <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted/40 p-3">
            <label
              htmlFor="cuenta-agrupacion"
              className="flex cursor-pointer items-start gap-2.5"
            >
              <Checkbox
                id="cuenta-agrupacion"
                checked={form.esAgrupacion}
                onCheckedChange={(valor) => actualizar("esAgrupacion", valor)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Cuenta de agrupación
                </span>
                <span className="text-xs text-muted-foreground">
                  No admite movimientos ni asientos directos.
                </span>
              </span>
            </label>

            <label
              htmlFor="cuenta-efectivo"
              className="flex cursor-pointer items-start gap-2.5"
            >
              <Checkbox
                id="cuenta-efectivo"
                checked={form.esEquivalenteEfectivo}
                onCheckedChange={(valor) =>
                  actualizar("esEquivalenteEfectivo", valor)
                }
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Equivalente de efectivo
                </span>
                <span className="text-xs text-muted-foreground">
                  Se incluye en la posición de efectivo y en el flujo de
                  efectivo.
                </span>
              </span>
            </label>
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
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconCheck className="size-4" />
              )}
              {esEdicion ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
