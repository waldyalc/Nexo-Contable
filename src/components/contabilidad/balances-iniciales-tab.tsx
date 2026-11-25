"use client";

import {
  IconCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconLoader2,
  IconUpload,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  type BalanceInicialListado,
  type PeriodoContable,
  contabilizarAsientoAction,
  crearBalanceInicialAction,
} from "@/app/(app)/contabilidad/actions";
import type { EntradaLineaBalanceInicial } from "@/app/(app)/contabilidad/actions";
import { leerArchivoBalances } from "@/components/contabilidad/balances-iniciales-utils";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
import { PillEstado } from "@/components/listas/pill-estado";
import { TablaLista } from "@/components/listas/tabla-lista";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Moneda,
  formatearFecha,
  formatearMoneda,
  hoySantoDomingo,
} from "@/lib/formato";

export interface BalancesInicialesTabProps {
  balances: readonly BalanceInicialListado[];
  periodos: readonly PeriodoContable[];
  moneda: Moneda;
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = "noopener";
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function BalancesInicialesTab({
  balances,
  periodos,
  moneda,
}: BalancesInicialesTabProps) {
  const router = useRouter();
  const archivoRef = useRef<HTMLInputElement | null>(null);
  const periodoAbierto = periodos.find((periodo) => periodo.estado === "open");
  const fechaInicial = periodoAbierto?.fechaInicio ?? hoySantoDomingo();
  const [fecha, setFecha] = useState(fechaInicial);
  const [descripcion, setDescripcion] = useState("Balances iniciales");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [lineas, setLineas] = useState<EntradaLineaBalanceInicial[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  const totales = useMemo(
    () =>
      lineas.reduce(
        (acumulado, linea) => ({
          debito: acumulado.debito + linea.debito,
          credito: acumulado.credito + linea.credito,
        }),
        { debito: 0, credito: 0 },
      ),
    [lineas],
  );
  const cuadra =
    lineas.length >= 2 && Math.abs(totales.debito - totales.credito) < 0.005;

  async function descargarPlantilla() {
    const { Workbook } = await import("exceljs");
    const libro = new Workbook();
    const hoja = libro.addWorksheet("Balances iniciales");
    hoja.columns = [
      { header: "account_code", key: "account_code", width: 18 },
      { header: "debit", key: "debit", width: 16 },
      { header: "credit", key: "credit", width: 16 },
      { header: "description", key: "description", width: 36 },
    ];
    hoja.getRow(1).font = { bold: true };
    const buffer = await libro.xlsx.writeBuffer();
    descargarBlob(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "plantilla-balances-iniciales.xlsx",
    );
  }

  async function leerArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) {
      setArchivoNombre("");
      setLineas([]);
      setErrores([]);
      return;
    }

    setLeyendo(true);
    setErrores([]);
    try {
      const resultado = await leerArchivoBalances(archivo);
      setArchivoNombre(archivo.name);
      setLineas(resultado.filas);
      setErrores(resultado.errores);
    } catch {
      setArchivoNombre(archivo.name);
      setLineas([]);
      setErrores([
        "No pudimos leer el archivo. Verifica que sea un Excel o CSV válido.",
      ]);
    } finally {
      setLeyendo(false);
    }
  }

  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || leyendo) return;

    if (fecha === "") {
      toast.error("Selecciona la fecha de apertura.");
      return;
    }
    if (lineas.length < 2 || errores.length > 0) {
      toast.error("Corrige el archivo antes de cargar los balances.");
      return;
    }
    if (!cuadra) {
      toast.error("El balance inicial debe cuadrar antes de cargarse.");
      return;
    }

    setGuardando(true);
    const resultado = await crearBalanceInicialAction({
      fecha,
      descripcion:
        descripcion.trim() === "" ? "Balances iniciales" : descripcion,
      lineas,
    });
    setGuardando(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    setLineas([]);
    setErrores([]);
    setArchivoNombre("");
    if (archivoRef.current) archivoRef.current.value = "";
    router.refresh();
  }

  async function contabilizar(balance: BalanceInicialListado) {
    setProcesando(balance.id);
    const resultado = await contabilizarAsientoAction(balance.id);
    setProcesando(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success("Balance inicial contabilizado.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <TarjetaLista>
        <BarraLista
          titulo="Carga de balances iniciales"
          descripcion="Importa débitos y créditos por código de cuenta. Se crea un borrador contable que luego debes contabilizar."
          acciones={
            <Button
              type="button"
              variant="outline"
              onClick={() => void descargarPlantilla()}
            >
              <IconDownload className="size-4" />
              Descargar plantilla Excel
            </Button>
          }
        />
        <form
          className="flex flex-col gap-4 border-t border-border px-4 py-4"
          onSubmit={importar}
          noValidate
        >
          <div className="rounded-[10px] border border-primary/15 bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
            Revisa el asiento borrador y contabilízalo cuando confirmes que
            corresponde al saldo de apertura de esta empresa.
          </div>

          <FormGrid>
            <FormField
              htmlFor="balance-fecha"
              label="Fecha de apertura"
              required
            >
              <DatePicker
                id="balance-fecha"
                value={fecha}
                onChange={setFecha}
              />
            </FormField>
            <FormField htmlFor="balance-descripcion" label="Descripción">
              <Input
                id="balance-descripcion"
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                maxLength={300}
              />
            </FormField>
            <FormField
              htmlFor="balance-archivo"
              label="Archivo Excel o CSV"
              required
            >
              <Input
                id="balance-archivo"
                ref={archivoRef}
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(evento) => void leerArchivo(evento)}
                className="h-auto py-1.5"
              />
            </FormField>
          </FormGrid>

          {leyendo ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              Leyendo archivo…
            </div>
          ) : null}

          {archivoNombre !== "" ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted/40 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {archivoNombre}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {lineas.length} líneas válidas · Débitos{" "}
                  {formatearMoneda(totales.debito, moneda)} · Créditos{" "}
                  {formatearMoneda(totales.credito, moneda)}
                </span>
              </div>
              {errores.length > 0 ? (
                <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-xs text-destructive">
                  {errores.slice(0, 8).map((mensaje) => (
                    <li key={mensaje}>{mensaje}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {cuadra
                    ? "El archivo está cuadrado y listo para crear el borrador."
                    : "El archivo aún no cuadra: revisa débitos y créditos."}
                </p>
              )}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                guardando || leyendo || lineas.length < 2 || errores.length > 0
              }
            >
              {guardando ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconUpload className="size-4" />
              )}
              Validar y cargar balances
            </Button>
          </div>
        </form>
      </TarjetaLista>

      <TarjetaLista>
        <BarraLista
          titulo="Cargas registradas"
          descripcion="Historial de asientos de apertura de la empresa activa."
        >
          <TablaLista<BalanceInicialListado>
            filas={balances}
            claveFila={(balance) => balance.id}
            paginacion={{ tamanoPagina: 10, etiqueta: "cargas" }}
            vacio={{
              titulo: "Todavía no hay cargas de balances iniciales",
              descripcion:
                "Descarga la plantilla, completa cuenta/débito/crédito y carga el archivo.",
              icono: <IconFileSpreadsheet className="size-8" />,
            }}
            columnas={[
              {
                clave: "numero",
                encabezado: "Asiento",
                celda: (balance) => (
                  <span className="font-medium tabular-nums">
                    {balance.numero}
                  </span>
                ),
              },
              {
                clave: "fecha",
                encabezado: "Fecha",
                celda: (balance) => formatearFecha(balance.fecha),
              },
              {
                clave: "descripcion",
                encabezado: "Descripción",
                celda: (balance) => balance.descripcion,
              },
              {
                clave: "debitos",
                encabezado: "Débitos",
                alineacion: "derecha",
                celda: (balance) => formatearMoneda(balance.debitos, moneda),
              },
              {
                clave: "creditos",
                encabezado: "Créditos",
                alineacion: "derecha",
                celda: (balance) => formatearMoneda(balance.creditos, moneda),
              },
              {
                clave: "estado",
                encabezado: "Estado",
                celda: (balance) => (
                  <PillEstado
                    estado={
                      balance.estado === "draft"
                        ? "borrador"
                        : balance.estado === "posted"
                          ? "contabilizado"
                          : "anulado"
                    }
                  />
                ),
              },
              {
                clave: "acciones",
                encabezado: "",
                alineacion: "derecha",
                ordenable: false,
                celda: (balance) =>
                  balance.estado === "draft" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={procesando === balance.id}
                      onClick={() => void contabilizar(balance)}
                    >
                      {procesando === balance.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconCheck className="size-4" />
                      )}
                      Contabilizar
                    </Button>
                  ) : null,
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>
    </div>
  );
}
