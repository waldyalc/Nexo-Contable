"use client";

import {
  IconArrowLeftRight,
  IconBuilding,
  IconBuildingStore,
  IconDots,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStar,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type DatosEmpresaForm,
  type ResultadoAccion,
  actualizarEmpresaAction,
  crearEmpresaAction,
  marcarEmpresaPrincipalAction,
} from "@/app/(app)/empresas/actions";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { iniciales } from "@/components/shell/navegacion";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RolContexto } from "@/lib/auth/sesion";
import { formatearRnc } from "@/lib/formato";
import { cn } from "@/lib/utils";

const ETIQUETAS_REGIMEN: Record<string, string> = {
  ordinario: "Ordinario",
  simplificado: "Simplificado",
  renta_presuntiva: "Renta presuntiva",
  zona_franca: "Zona franca",
};

const OPCIONES_REGIMEN = [
  { value: "ordinario", label: "Ordinario (Régimen General)" },
  { value: "simplificado", label: "Simplificado" },
  { value: "renta_presuntiva", label: "Renta presuntiva" },
  { value: "zona_franca", label: "Zona franca" },
];

const OPCIONES_MONEDA = [
  { value: "DOP", label: "Peso dominicano (DOP)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
];

const OPCIONES_ESTADO = [
  { value: "active", label: "Activa" },
  { value: "inactive", label: "Inactiva" },
];

const OPCIONES_FILTRO_ESTADO = [
  { value: "active", label: "Activas" },
  { value: "inactive", label: "Inactivas" },
];

export interface EmpresaListado {
  id: string;
  nombreComercial: string;
  razonSocial: string;
  rnc: string;
  tipoEmpresa: string;
  direccion: string;
  telefono: string;
  correo: string;
  representanteLegal: string;
  actividadEconomica: string;
  fechaInicio: string | null;
  regimenFiscal: string;
  monedaFuncional: string;
  periodoFiscal: string;
  estado: "active" | "inactive";
  esPrincipal: boolean;
  rol: RolContexto;
}

interface FormEmpresa extends DatosEmpresaForm {
  estado: "active" | "inactive";
}

interface ErroresForm {
  nombreComercial?: string;
  razonSocial?: string;
}

function formInicial(empresa: EmpresaListado | null): FormEmpresa {
  if (!empresa) {
    return {
      nombreComercial: "",
      razonSocial: "",
      rnc: "",
      tipoEmpresa: "",
      direccion: "",
      telefono: "",
      correo: "",
      representanteLegal: "",
      actividadEconomica: "",
      fechaInicio: "",
      regimenFiscal: "ordinario",
      monedaFuncional: "DOP",
      periodoFiscal: "01-12",
      estado: "active",
    };
  }

  return {
    nombreComercial: empresa.nombreComercial,
    razonSocial: empresa.razonSocial,
    rnc: empresa.rnc,
    tipoEmpresa: empresa.tipoEmpresa,
    direccion: empresa.direccion,
    telefono: empresa.telefono,
    correo: empresa.correo,
    representanteLegal: empresa.representanteLegal,
    actividadEconomica: empresa.actividadEconomica,
    fechaInicio: empresa.fechaInicio ?? "",
    regimenFiscal: empresa.regimenFiscal,
    monedaFuncional: empresa.monedaFuncional,
    periodoFiscal: empresa.periodoFiscal,
    estado: empresa.estado,
  };
}

function MonogramaEmpresa({ nombre }: { nombre: string }) {
  return (
    <span className="font-display flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-secondary text-[11px] font-bold text-secondary-foreground">
      {iniciales(nombre)}
    </span>
  );
}

export interface EmpresasVistaProps {
  empresas: readonly EmpresaListado[];
  esAdminGlobal: boolean;
  empresaActivaId: string | null;
  abrirNuevaInicial: boolean;
}

export function EmpresasVista({
  empresas,
  esAdminGlobal,
  empresaActivaId,
  abrirNuevaInicial,
}: EmpresasVistaProps) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [dialogoAbierto, setDialogoAbierto] = useState(abrirNuevaInicial);
  const [empresaEdicion, setEmpresaEdicion] = useState<EmpresaListado | null>(
    null,
  );
  const [accionId, setAccionId] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return empresas.filter((empresa) => {
      const cumpleEstado =
        estadoFiltro === "" || empresa.estado === estadoFiltro;
      if (!cumpleEstado) return false;
      if (termino === "") return true;

      return (
        empresa.nombreComercial.toLowerCase().includes(termino) ||
        empresa.razonSocial.toLowerCase().includes(termino) ||
        empresa.rnc.includes(termino)
      );
    });
  }, [empresas, busqueda, estadoFiltro]);

  const activa =
    empresas.find((empresa) => empresa.id === empresaActivaId) ?? null;

  function abrirCrear() {
    setEmpresaEdicion(null);
    setDialogoAbierto(true);
  }

  function abrirEdicion(empresa: EmpresaListado) {
    setEmpresaEdicion(empresa);
    setDialogoAbierto(true);
  }

  function cambiarDialogo(abierto: boolean) {
    setDialogoAbierto(abierto);
    if (!abierto) setEmpresaEdicion(null);
  }

  function puedeEditar(empresa: EmpresaListado): boolean {
    return esAdminGlobal || empresa.rol === "admin_empresa";
  }

  async function marcarPrincipal(empresa: EmpresaListado) {
    setAccionId(empresa.id);
    const resultado = await marcarEmpresaPrincipalAction(empresa.id);
    setAccionId(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    router.refresh();
  }

  async function cambiarEmpresa(empresa: EmpresaListado) {
    if (empresa.id === empresaActivaId) {
      toast.info("Ya estás trabajando en esta empresa.");
      return;
    }

    setAccionId(empresa.id);

    try {
      const respuesta = await fetch("/api/empresa-activa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresa.id }),
      });

      if (!respuesta.ok) {
        toast.error("No pudimos cambiar de empresa.");
        return;
      }

      toast.success("Empresa activa actualizada", {
        description: empresa.nombreComercial,
      });
      router.refresh();
    } catch {
      toast.error("No pudimos cambiar de empresa. Revisa tu conexión.");
    } finally {
      setAccionId(null);
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Empresas"
        descripcion={
          esAdminGlobal
            ? "Administra las empresas de la firma y su empresa principal."
            : "Empresas a las que tienes acceso según tu rol."
        }
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Empresas" }]}
        acciones={
          <Button variant="outline" onClick={() => router.refresh()}>
            <IconRefresh className="size-4" />
            Actualizar
          </Button>
        }
      />

      <TarjetaLista data-lista="empresas">
        <BarraLista
          titulo="Listado de empresas"
          descripcion={`${filtradas.length} de ${empresas.length} empresas`}
          acciones={
            esAdminGlobal ? (
              <Button onClick={abrirCrear}>
                <IconPlus className="size-4" />
                Nueva empresa
              </Button>
            ) : null
          }
          filtros={
            <>
              <div className="relative w-full sm:max-w-xs">
                <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar por nombre o RNC…"
                  aria-label="Buscar empresas"
                  className="h-9 pl-8"
                />
              </div>
              <SelectCampo
                id="filtro-estado-empresa"
                opciones={OPCIONES_FILTRO_ESTADO}
                valor={estadoFiltro}
                onCambio={setEstadoFiltro}
                etiquetaVacia="Todas"
                className="w-[150px]"
                aria-label="Filtrar por estado"
              />
            </>
          }
        >
          <TablaLista<EmpresaListado>
            filas={filtradas}
            claveFila={(empresa) => empresa.id}
            ordenable
            paginacion={{ tamanoPagina: 10, etiqueta: "empresas" }}
            vacio={{
              titulo: "Sin empresas todavía",
              descripcion: esAdminGlobal
                ? "Crea la primera empresa de tu firma para empezar a contabilizar."
                : "Cuando el administrador te asigne una empresa aparecerá aquí.",
              icono: <IconBuildingStore className="size-8" />,
              accion: esAdminGlobal ? (
                <Button onClick={abrirCrear}>
                  <IconPlus className="size-4" />
                  Nueva empresa
                </Button>
              ) : undefined,
            }}
            columnas={[
              {
                clave: "empresa",
                encabezado: "Empresa",
                celda: (empresa) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <MonogramaEmpresa nombre={empresa.nombreComercial} />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-foreground">
                          {empresa.nombreComercial}
                        </span>
                        {empresa.esPrincipal ? (
                          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                            Principal
                          </span>
                        ) : null}
                        {empresa.id === empresaActivaId ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Activa
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {empresa.razonSocial}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                clave: "rnc",
                encabezado: "RNC",
                celda: (empresa) =>
                  empresa.rnc === "" ? "—" : formatearRnc(empresa.rnc),
              },
              {
                clave: "regimen",
                encabezado: "Régimen",
                celda: (empresa) =>
                  ETIQUETAS_REGIMEN[empresa.regimenFiscal] ??
                  empresa.regimenFiscal,
              },
              {
                clave: "moneda",
                encabezado: "Moneda",
                celda: (empresa) => empresa.monedaFuncional,
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (empresa) => (
                  <PillEstado
                    estado={empresa.estado === "active" ? "activa" : "inactiva"}
                  />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (empresa) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${empresa.nombreComercial}`}
                          disabled={accionId === empresa.id}
                        />
                      }
                    >
                      {accionId === empresa.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconDots className="size-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={() => void cambiarEmpresa(empresa)}
                      >
                        <IconArrowLeftRight className="size-4" />
                        Cambiar a esta empresa
                      </DropdownMenuItem>
                      {puedeEditar(empresa) ? (
                        <DropdownMenuItem onClick={() => abrirEdicion(empresa)}>
                          <IconPencil className="size-4" />
                          Editar empresa
                        </DropdownMenuItem>
                      ) : null}
                      {!empresa.esPrincipal ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => void marcarPrincipal(empresa)}
                          >
                            <IconStar className="size-4" />
                            Marcar como principal
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

      {activa === null ? null : (
        <p className="text-xs text-muted-foreground">
          Empresa activa:{" "}
          <span className="font-medium">{activa.nombreComercial}</span> ·{" "}
          {ETIQUETAS_REGIMEN[activa.regimenFiscal] ?? activa.regimenFiscal} ·{" "}
          {activa.monedaFuncional}
        </p>
      )}

      <DialogoEmpresa
        abierto={dialogoAbierto}
        onOpenChange={cambiarDialogo}
        empresa={empresaEdicion}
        esAdminGlobal={esAdminGlobal}
      />
    </>
  );
}

interface DialogoEmpresaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresa: EmpresaListado | null;
  esAdminGlobal: boolean;
}

function DialogoEmpresa({
  abierto,
  onOpenChange,
  empresa,
  esAdminGlobal,
}: DialogoEmpresaProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormEmpresa>(formInicial(empresa));
  const [cargarCatalogo, setCargarCatalogo] = useState(true);
  const [errores, setErrores] = useState<ErroresForm>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const esEdicion = empresa !== null;

  useEffect(() => {
    if (!abierto) return;
    setForm(formInicial(empresa));
    setCargarCatalogo(true);
    setErrores({});
    setErrorGeneral(null);
    setGuardando(false);
  }, [abierto, empresa]);

  function actualizar<C extends keyof FormEmpresa>(
    campo: C,
    valor: FormEmpresa[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    const nuevosErrores: ErroresForm = {};
    if (form.nombreComercial.trim() === "") {
      nuevosErrores.nombreComercial = "El nombre comercial es obligatorio.";
    }
    if (form.razonSocial.trim() === "") {
      nuevosErrores.razonSocial = "La razón social es obligatoria.";
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setErrores({});
    setErrorGeneral(null);
    setGuardando(true);

    let resultado: ResultadoAccion;

    if (empresa) {
      resultado = await actualizarEmpresaAction({
        ...form,
        id: empresa.id,
        estado: form.estado,
      });
    } else {
      resultado = await crearEmpresaAction({ ...form, cargarCatalogo });
    }

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
      <DialogContent className="sm:max-w-3xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {esEdicion ? "Editar empresa" : "Nueva empresa"}
            </DialogTitle>
            <DialogDescription>
              {esEdicion
                ? "Actualiza los datos fiscales y el estado de la empresa."
                : "Registra una empresa de la firma. El RNC se normaliza automáticamente."}
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

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <FormGrid>
              <FormField
                htmlFor="empresa-nombre"
                label="Nombre comercial"
                required
                error={errores.nombreComercial}
              >
                <Input
                  id="empresa-nombre"
                  value={form.nombreComercial}
                  onChange={(evento) =>
                    actualizar("nombreComercial", evento.target.value)
                  }
                  placeholder="Ej. Farmacia Central"
                  aria-invalid={Boolean(errores.nombreComercial)}
                />
              </FormField>

              <FormField
                htmlFor="empresa-razon"
                label="Razón social"
                required
                error={errores.razonSocial}
              >
                <Input
                  id="empresa-razon"
                  value={form.razonSocial}
                  onChange={(evento) =>
                    actualizar("razonSocial", evento.target.value)
                  }
                  placeholder="Ej. Farmacia Central SRL"
                  aria-invalid={Boolean(errores.razonSocial)}
                />
              </FormField>

              <FormField htmlFor="empresa-rnc" label="RNC / Cédula">
                <Input
                  id="empresa-rnc"
                  value={form.rnc}
                  onChange={(evento) => actualizar("rnc", evento.target.value)}
                  placeholder="000-00000-0"
                  inputMode="numeric"
                />
              </FormField>

              <FormField htmlFor="empresa-tipo" label="Tipo de empresa">
                <Input
                  id="empresa-tipo"
                  value={form.tipoEmpresa}
                  onChange={(evento) =>
                    actualizar("tipoEmpresa", evento.target.value)
                  }
                  placeholder="SRL, EIRL, persona física…"
                />
              </FormField>

              <FormField htmlFor="empresa-telefono" label="Teléfono">
                <Input
                  id="empresa-telefono"
                  value={form.telefono}
                  onChange={(evento) =>
                    actualizar("telefono", evento.target.value)
                  }
                  placeholder="809-000-0000"
                />
              </FormField>

              <FormField htmlFor="empresa-correo" label="Correo">
                <Input
                  id="empresa-correo"
                  type="email"
                  value={form.correo}
                  onChange={(evento) =>
                    actualizar("correo", evento.target.value)
                  }
                  placeholder="contacto@empresa.com"
                />
              </FormField>

              <FormField
                htmlFor="empresa-representante"
                label="Representante legal"
              >
                <Input
                  id="empresa-representante"
                  value={form.representanteLegal}
                  onChange={(evento) =>
                    actualizar("representanteLegal", evento.target.value)
                  }
                />
              </FormField>

              <FormField
                htmlFor="empresa-actividad"
                label="Actividad económica"
              >
                <Input
                  id="empresa-actividad"
                  value={form.actividadEconomica}
                  onChange={(evento) =>
                    actualizar("actividadEconomica", evento.target.value)
                  }
                  placeholder="Ej. Comercio al por menor"
                />
              </FormField>

              <FormField
                htmlFor="empresa-fecha-inicio"
                label="Inicio de operaciones"
              >
                <DatePicker
                  id="empresa-fecha-inicio"
                  value={form.fechaInicio}
                  onChange={(valor) => actualizar("fechaInicio", valor)}
                  permitirLimpiar
                />
              </FormField>

              <FormField
                htmlFor="empresa-regimen"
                label="Régimen fiscal"
                required
              >
                <SelectCampo
                  id="empresa-regimen"
                  opciones={OPCIONES_REGIMEN}
                  valor={form.regimenFiscal}
                  onCambio={(valor) => actualizar("regimenFiscal", valor)}
                  requerido
                  aria-label="Régimen fiscal"
                />
              </FormField>

              <FormField
                htmlFor="empresa-moneda"
                label="Moneda funcional"
                required
              >
                <SelectCampo
                  id="empresa-moneda"
                  opciones={OPCIONES_MONEDA}
                  valor={form.monedaFuncional}
                  onCambio={(valor) => actualizar("monedaFuncional", valor)}
                  requerido
                  aria-label="Moneda funcional"
                />
              </FormField>

              {esEdicion ? (
                <FormField htmlFor="empresa-estado" label="Estado" required>
                  <SelectCampo
                    id="empresa-estado"
                    opciones={OPCIONES_ESTADO}
                    valor={form.estado}
                    onCambio={(valor) =>
                      actualizar(
                        "estado",
                        valor === "inactive" ? "inactive" : "active",
                      )
                    }
                    requerido
                    aria-label="Estado de la empresa"
                  />
                </FormField>
              ) : null}

              <FormField
                htmlFor="empresa-direccion"
                label="Dirección"
                className="sm:col-span-2 lg:col-span-3"
              >
                <Textarea
                  id="empresa-direccion"
                  value={form.direccion}
                  onChange={(evento) =>
                    actualizar("direccion", evento.target.value)
                  }
                  placeholder="Calle, número, sector, municipio"
                  className="min-h-16"
                />
              </FormField>
            </FormGrid>

            {!esEdicion && esAdminGlobal ? (
              <label
                htmlFor="empresa-catalogo"
                className={cn(
                  "mt-4 flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5",
                )}
              >
                <Checkbox
                  id="empresa-catalogo"
                  checked={cargarCatalogo}
                  onCheckedChange={(valor) => setCargarCatalogo(valor)}
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Cargar catálogo base de 347 cuentas y abrir período fiscal
                    del año actual
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Recomendado. Puedes ajustar las cuentas después desde
                    Contabilidad.
                  </span>
                </span>
              </label>
            ) : null}
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
                  {esEdicion ? "Guardar cambios" : "Crear empresa"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
