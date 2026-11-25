"use client";

import {
  IconCreditCard,
  IconDots,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconPower,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type CuentaContable,
  type MetodoPagoContable,
  guardarMetodoPagoAction,
} from "@/app/(app)/contabilidad/actions";
import { FormField } from "@/components/formularios/form-card";
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

export interface FormasPagoTabProps {
  metodos: readonly MetodoPagoContable[];
  cuentas: readonly CuentaContable[];
}

interface FormularioMetodo {
  nombre: string;
  cuentaId: string;
  dejaCxpProveedor: boolean;
  activo: boolean;
}

function formularioInicial(
  metodo: MetodoPagoContable | null,
): FormularioMetodo {
  return {
    nombre: metodo?.nombre ?? "",
    cuentaId: metodo?.cuentaId ?? "",
    dejaCxpProveedor: metodo?.dejaCxpProveedor ?? false,
    activo: metodo?.activo ?? true,
  };
}

export function FormasPagoTab({ metodos, cuentas }: FormasPagoTabProps) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState(false);
  const [editando, setEditando] = useState<MetodoPagoContable | null>(null);
  const [form, setForm] = useState<FormularioMetodo>(() =>
    formularioInicial(null),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cuentasPorId = useMemo(
    () => new Map(cuentas.map((cuenta) => [cuenta.id, cuenta])),
    [cuentas],
  );

  const opcionesCuentas = useMemo(() => {
    const padres = new Set<string>();
    for (const cuenta of cuentas) {
      if (cuenta.padreId) padres.add(cuenta.padreId);
    }

    return cuentas
      .filter(
        (cuenta) =>
          cuenta.activa &&
          !cuenta.esAgrupacion &&
          !padres.has(cuenta.id) &&
          ["asset", "liability", "equity"].includes(cuenta.clasificacion),
      )
      .map((cuenta) => ({
        value: cuenta.id,
        label: `${cuenta.codigo} · ${cuenta.nombre}`,
      }));
  }, [cuentas]);

  useEffect(() => {
    if (!dialogo) return;
    setForm(formularioInicial(editando));
    setError(null);
    setGuardando(false);
  }, [dialogo, editando]);

  function abrirNuevo() {
    setEditando(null);
    setDialogo(true);
  }

  function abrirEdicion(metodo: MetodoPagoContable) {
    setEditando(metodo);
    setDialogo(true);
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.nombre.trim() === "") {
      setError("Escribe el nombre de la forma de pago.");
      return;
    }
    if (form.cuentaId === "") {
      setError("Selecciona la cuenta contable.");
      return;
    }

    setError(null);
    setGuardando(true);
    const resultado = await guardarMetodoPagoAction({
      id: editando?.id ?? null,
      nombre: form.nombre,
      cuentaId: form.cuentaId,
      dejaCxpProveedor: form.dejaCxpProveedor,
      activo: form.activo,
    });
    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    setDialogo(false);
    router.refresh();
  }

  async function alternarActivo(metodo: MetodoPagoContable) {
    setProcesando(metodo.id);
    const resultado = await guardarMetodoPagoAction({
      id: metodo.id,
      nombre: metodo.nombre,
      cuentaId: metodo.cuentaId,
      dejaCxpProveedor: metodo.dejaCxpProveedor,
      activo: !metodo.activo,
    });
    setProcesando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(
      metodo.activo ? "Forma de pago desactivada." : "Forma de pago activada.",
    );
    router.refresh();
  }

  return (
    <>
      <TarjetaLista>
        <BarraLista
          titulo="Formas de pago"
          descripcion="Configura la cuenta que se acredita al registrar facturas de gasto. Si deja saldo, la factura queda abierta en Cuentas por Pagar."
          acciones={
            <Button onClick={abrirNuevo}>
              <IconPlus className="size-4" />
              Nueva forma de pago
            </Button>
          }
        >
          <TablaLista<MetodoPagoContable>
            filas={metodos}
            claveFila={(metodo) => metodo.id}
            ordenable
            paginacion={{ tamanoPagina: 12, etiqueta: "formas de pago" }}
            vacio={{
              titulo: "Aún no hay formas de pago",
              descripcion:
                "Crea opciones como Efectivo → Caja, Tarjeta → Tarjeta por pagar o Crédito del suplidor → Cuentas por pagar.",
              icono: <IconCreditCard className="size-8" />,
              accion: (
                <Button onClick={abrirNuevo}>
                  <IconPlus className="size-4" />
                  Nueva forma de pago
                </Button>
              ),
            }}
            columnas={[
              {
                clave: "nombre",
                encabezado: "Forma de pago",
                celda: (metodo) => (
                  <span className="font-medium">{metodo.nombre}</span>
                ),
              },
              {
                clave: "cuenta",
                encabezado: "Cuenta aplicada",
                celda: (metodo) => {
                  const cuenta = cuentasPorId.get(metodo.cuentaId);
                  return cuenta
                    ? `${cuenta.codigo} · ${cuenta.nombre}`
                    : "Cuenta no disponible";
                },
              },
              {
                clave: "comportamiento",
                encabezado: "Comportamiento",
                celda: (metodo) =>
                  metodo.dejaCxpProveedor
                    ? "Deja saldo en Cuentas por Pagar"
                    : "Factura pagada",
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (metodo) => (
                  <PillEstado estado={metodo.activo ? "activa" : "inactiva"} />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                ordenable: false,
                alineacion: "derecha",
                celda: (metodo) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${metodo.nombre}`}
                          disabled={procesando === metodo.id}
                        />
                      }
                    >
                      {procesando === metodo.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconDots className="size-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => abrirEdicion(metodo)}>
                        <IconPencil className="size-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void alternarActivo(metodo)}
                      >
                        <IconPower className="size-4" />
                        {metodo.activo ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="sm:max-w-lg">
          <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
            <DialogHeader>
              <DialogTitle>
                {editando ? "Editar forma de pago" : "Nueva forma de pago"}
              </DialogTitle>
              <DialogDescription>
                La configuración aplica solamente a la empresa activa.
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

            <FormField htmlFor="forma-pago-nombre" label="Nombre" required>
              <Input
                id="forma-pago-nombre"
                value={form.nombre}
                onChange={(evento) =>
                  setForm((anterior) => ({
                    ...anterior,
                    nombre: evento.target.value,
                  }))
                }
                placeholder="Efectivo, transferencia o crédito del suplidor"
                maxLength={100}
              />
            </FormField>

            <FormField
              htmlFor="forma-pago-cuenta"
              label="Cuenta contable"
              required
            >
              <SelectCampo
                id="forma-pago-cuenta"
                opciones={opcionesCuentas}
                valor={form.cuentaId}
                onCambio={(valor) =>
                  setForm((anterior) => ({ ...anterior, cuentaId: valor }))
                }
                etiquetaVacia="Selecciona la cuenta"
                buscable
                requerido
                aria-label="Cuenta de la forma de pago"
              />
            </FormField>

            <label
              htmlFor="forma-pago-cxp"
              className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5"
            >
              <Checkbox
                id="forma-pago-cxp"
                checked={form.dejaCxpProveedor}
                onCheckedChange={(valor) =>
                  setForm((anterior) => ({
                    ...anterior,
                    dejaCxpProveedor: valor,
                  }))
                }
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Dejar factura pendiente en Cuentas por Pagar
                </span>
                <span className="text-xs text-muted-foreground">
                  Úsalo para crédito del suplidor o cuentas por pagar a
                  accionistas; la cuenta debe ser un pasivo.
                </span>
              </span>
            </label>

            <label
              htmlFor="forma-pago-activa"
              className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5"
            >
              <Checkbox
                id="forma-pago-activa"
                checked={form.activo}
                onCheckedChange={(valor) =>
                  setForm((anterior) => ({ ...anterior, activo: valor }))
                }
              />
              <span className="text-sm font-medium text-foreground">
                Activa
              </span>
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={guardando}
                onClick={() => setDialogo(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconCreditCard className="size-4" />
                )}
                {editando ? "Guardar cambios" : "Crear forma de pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
