"use client";

import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBuildingBank,
  IconCheck,
  IconFileSpreadsheet,
  IconLoader2,
  IconLock,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconScale,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
} from "react";
import { toast } from "sonner";

import {
  type DatosCierreConciliacion,
  type MovimientoConciliacion,
  cerrarSesionConciliacionAction,
  crearSesionConciliacionAction,
  guardarCuentaBancariaAction,
  importarMovimientosBancariosAction,
  listarMovimientosConciliacionAction,
  marcarMovimientoConciliadoAction,
  registrarMovimientoBancarioAction,
} from "@/app/(app)/bancos/actions";
import { TarjetasResumen } from "@/components/comunes/tarjetas-resumen";
import { useAccionOptimista } from "@/components/comunes/use-accion-optimista";
import { DatePicker } from "@/components/date-picker";
import {
  DateRangePicker,
  type RangoFechas,
} from "@/components/date-range-picker";
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
import {
  type FilaExtractoBancario,
  parsearExtractoCsv,
} from "@/lib/bancos/csv-extracto";
import {
  type Moneda,
  ZONA_HORARIA,
  aNumero,
  formatearFecha,
  formatearMoneda,
  hoySantoDomingo,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

export interface CuentaBancariaListado {
  id: string;
  nombre: string;
  banco: string;
  numeroCuenta: string;
  moneda: string;
  cuentaContableId: string;
  saldoInicial: number;
  activa: boolean;
}

export interface MovimientoListado {
  id: string;
  cuentaBancariaId: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: string;
  monto: number;
  conciliado: boolean;
  sesionId: string | null;
}

export interface ImportacionListado {
  id: string;
  cuentaBancariaId: string;
  nombreArchivo: string;
  totalFilas: number;
  creadoEn: string;
}

export interface SesionListado {
  id: string;
  cuentaBancariaId: string;
  fechaCorte: string;
  saldoExtracto: number;
  saldoLibros: number;
  diferencia: number;
  estado: "open" | "closed";
  cerradaEn: string | null;
}

export interface BancosVistaProps {
  empresaId: string;
  moneda: Moneda;
  cuentas: readonly CuentaBancariaListado[];
  movimientos: readonly MovimientoListado[];
  importaciones: readonly ImportacionListado[];
  sesiones: readonly SesionListado[];
  opcionesCuentasContables: readonly OpcionSelect[];
  filtros: { cuenta: string; desde: string; hasta: string };
  puedeGestionar: boolean;
  puedeOperar: boolean;
}

const ETIQUETAS_TIPO: Record<string, string> = {
  deposit: "Depósito",
  withdrawal: "Retiro",
  transfer: "Transferencia",
  fee: "Comisión",
  interest: "Interés",
};

const TONO_TIPO: Record<string, TonoPill> = {
  deposit: "exito",
  interest: "exito",
  withdrawal: "peligro",
  fee: "peligro",
  transfer: "neutro",
};

const OPCIONES_TIPO = [
  { value: "deposit", label: "Depósito" },
  { value: "withdrawal", label: "Retiro" },
  { value: "transfer", label: "Transferencia" },
  { value: "fee", label: "Comisión bancaria" },
  { value: "interest", label: "Interés" },
];

const OPCIONES_MONEDA = [
  { value: "DOP", label: "Peso dominicano (DOP)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
];

const OPCIONES_ESTADO = [
  { value: "activa", label: "Activa" },
  { value: "inactiva", label: "Inactiva" },
];

function esEntrada(tipo: string): boolean {
  return tipo === "deposit" || tipo === "interest";
}

function monedaDe(cuenta: CuentaBancariaListado): Moneda {
  return cuenta.moneda === "USD" ? "USD" : "DOP";
}

function formatearFechaHora(valor: string): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return formatearFecha(valor);

  return new Intl.DateTimeFormat("es-DO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

interface CambioConciliacionOptimista {
  id: string;
  conciliado: boolean;
  sesionId: string | null;
}

function conCambioConciliacion(
  actuales: readonly MovimientoConciliacion[],
  cambio: CambioConciliacionOptimista,
): MovimientoConciliacion[] {
  return actuales.map((movimiento) =>
    movimiento.id === cambio.id
      ? {
          ...movimiento,
          conciliado: cambio.conciliado,
          sesionId: cambio.sesionId,
        }
      : movimiento,
  );
}

export function BancosVista({
  empresaId,
  moneda,
  cuentas,
  movimientos,
  importaciones,
  sesiones,
  opcionesCuentasContables,
  filtros,
  puedeGestionar,
  puedeOperar,
}: BancosVistaProps) {
  const router = useRouter();

  const [dialogoCuenta, setDialogoCuenta] = useState(false);
  const [cuentaEdicion, setCuentaEdicion] =
    useState<CuentaBancariaListado | null>(null);
  const [dialogoMovimiento, setDialogoMovimiento] = useState(false);
  const [dialogoImportar, setDialogoImportar] = useState(false);
  const [dialogoSesion, setDialogoSesion] = useState(false);
  const [sesionDetalle, setSesionDetalle] = useState<SesionListado | null>(
    null,
  );
  const [movimientosSesion, setMovimientosSesion] = useState<
    MovimientoConciliacion[]
  >([]);
  const [movimientosOptimistas, aplicarMovimientoOptimista] = useOptimistic(
    movimientosSesion,
    conCambioConciliacion,
  );
  const accionOptimista = useAccionOptimista();
  const [cargandoSesion, setCargandoSesion] = useState(false);
  const [accionId, setAccionId] = useState<string | null>(null);
  const [filtroCuenta, setFiltroCuenta] = useState(filtros.cuenta);
  const [rango, setRango] = useState<RangoFechas>({
    desde: filtros.desde,
    hasta: filtros.hasta,
  });

  const nombreCuenta = useMemo(() => {
    const mapa = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta.nombre]));
    return (id: string) => mapa.get(id) ?? "—";
  }, [cuentas]);

  const opcionesFiltroCuenta = useMemo(
    () => cuentas.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre })),
    [cuentas],
  );

  const nombreCuentaContable = useMemo(() => {
    const mapa = new Map(
      opcionesCuentasContables.map((opcion) => [opcion.value, opcion.label]),
    );
    return (id: string) => mapa.get(id) ?? "—";
  }, [opcionesCuentasContables]);

  const totales = useMemo(() => {
    const activas = cuentas.filter((cuenta) => cuenta.activa).length;
    const saldoInicial = cuentas.reduce(
      (total, cuenta) => total + cuenta.saldoInicial,
      0,
    );
    const abiertas = sesiones.filter(
      (sesion) => sesion.estado === "open",
    ).length;

    return { activas, saldoInicial, abiertas };
  }, [cuentas, sesiones]);

  const sesionActiva = sesionDetalle;

  useEffect(() => {
    if (!sesionDetalle) {
      setMovimientosSesion([]);
      return;
    }

    let activo = true;
    setCargandoSesion(true);

    void listarMovimientosConciliacionAction(
      sesionDetalle.cuentaBancariaId,
    ).then((resultado) => {
      if (!activo) return;
      setCargandoSesion(false);

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      setMovimientosSesion(resultado.movimientos);
    });

    return () => {
      activo = false;
    };
  }, [sesionDetalle]);

  const conciliados = useMemo(() => {
    if (!sesionActiva) return [] as MovimientoConciliacion[];
    return movimientosOptimistas.filter(
      (movimiento) =>
        movimiento.conciliado && movimiento.sesionId === sesionActiva.id,
    );
  }, [movimientosOptimistas, sesionActiva]);

  const netoConciliado = useMemo(
    () =>
      conciliados.reduce(
        (total, movimiento) =>
          total +
          (esEntrada(movimiento.tipo) ? movimiento.monto : -movimiento.monto),
        0,
      ),
    [conciliados],
  );

  const diferenciaEnVivo = sesionActiva
    ? sesionActiva.saldoExtracto - (sesionActiva.saldoLibros + netoConciliado)
    : 0;

  function aplicarFiltros(cuenta: string, siguiente: RangoFechas) {
    const params = new URLSearchParams();
    if (cuenta !== "") params.set("cuenta", cuenta);
    if (siguiente.desde !== "") params.set("desde", siguiente.desde);
    if (siguiente.hasta !== "") params.set("hasta", siguiente.hasta);
    const consulta = params.toString();
    router.replace(consulta === "" ? "/bancos" : `/bancos?${consulta}`, {
      scroll: false,
    });
  }

  function abrirNuevaCuenta() {
    setCuentaEdicion(null);
    setDialogoCuenta(true);
  }

  function abrirEdicionCuenta(cuenta: CuentaBancariaListado) {
    setCuentaEdicion(cuenta);
    setDialogoCuenta(true);
  }

  function alternarConciliado(movimiento: MovimientoConciliacion) {
    const sesion = sesionDetalle;
    if (!sesion) return;

    const conciliar = !(
      movimiento.conciliado && movimiento.sesionId === sesion.id
    );
    const cambio: CambioConciliacionOptimista = {
      id: movimiento.id,
      conciliado: conciliar,
      sesionId: conciliar ? sesion.id : null,
    };

    accionOptimista.ejecutar({
      clave: movimiento.id,
      entrada: {
        empresaId,
        movimientoId: movimiento.id,
        sesionId: sesion.id,
        conciliado: conciliar,
      },
      aplicarOptimista: () => aplicarMovimientoOptimista(cambio),
      accion: (entrada) => marcarMovimientoConciliadoAction(entrada),
      alExito: () => {
        setMovimientosSesion((actual) => conCambioConciliacion(actual, cambio));
        router.refresh();
      },
      mensajeErrorInesperado:
        "No pudimos actualizar la conciliación del movimiento. Inténtalo de nuevo.",
    });
  }

  async function cerrarSesion() {
    const sesion = sesionDetalle;
    if (!sesion) return;

    setAccionId(sesion.id);
    const datos: DatosCierreConciliacion = {
      empresaId,
      sesionId: sesion.id,
      fechaCierre: hoySantoDomingo(),
    };
    const resultado = await cerrarSesionConciliacionAction(datos);
    setAccionId(null);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    setSesionDetalle(null);
    router.refresh();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Banco y conciliación"
        descripcion="Cuentas bancarias, movimientos, importación de extractos y conciliación con el mayor contable."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Banco" }]}
        acciones={
          <Button variant="outline" onClick={() => router.refresh()}>
            <IconRefresh className="size-4" />
            Actualizar
          </Button>
        }
      />

      <TarjetasResumen
        etiqueta="Resumen bancario"
        datos={[
          {
            etiqueta: "Cuentas activas",
            valor: String(totales.activas),
            detalle: `${cuentas.length} cuentas registradas`,
            icono: IconBuildingBank,
          },
          {
            etiqueta: "Saldo inicial total",
            valor: formatearMoneda(totales.saldoInicial, moneda),
            detalle: "Suma de las cuentas bancarias",
            icono: IconScale,
          },
          {
            etiqueta: "Sesiones abiertas",
            valor: String(totales.abiertas),
            detalle: `${sesiones.length} sesiones en total`,
            icono: IconLock,
          },
        ]}
      />

      <Tabs defaultValue="cuentas" className="gap-4">
        <TabsList>
          <TabsTrigger value="cuentas">Cuentas bancarias</TabsTrigger>
          <TabsTrigger value="movimientos">
            Movimientos e importación
          </TabsTrigger>
          <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
        </TabsList>

        <TabsContent value="cuentas">
          <TarjetaLista data-lista="cuentas-bancarias">
            <BarraLista
              titulo="Cuentas bancarias"
              descripcion="Vincula cada cuenta con su cuenta contable de efectivo."
              acciones={
                puedeGestionar ? (
                  <Button onClick={abrirNuevaCuenta}>
                    <IconPlus className="size-4" />
                    Nueva cuenta
                  </Button>
                ) : undefined
              }
            >
              <TablaLista<CuentaBancariaListado>
                filas={cuentas}
                claveFila={(cuenta) => cuenta.id}
                ordenable
                paginacion={{ tamanoPagina: 10, etiqueta: "cuentas" }}
                vacio={{
                  titulo: "Sin cuentas bancarias",
                  descripcion:
                    "Crea la primera cuenta y vincúlala a una cuenta contable de efectivo.",
                  icono: <IconBuildingBank className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "cuenta",
                    encabezado: "Cuenta",
                    celda: (cuenta) => (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {cuenta.nombre}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {cuenta.banco === "" ? "Sin banco" : cuenta.banco}
                          {cuenta.numeroCuenta === ""
                            ? ""
                            : ` · ${cuenta.numeroCuenta}`}
                        </span>
                      </div>
                    ),
                  },
                  {
                    clave: "contable",
                    encabezado: "Cuenta contable",
                    celda: (cuenta) => (
                      <span className="text-sm text-muted-foreground">
                        {nombreCuentaContable(cuenta.cuentaContableId)}
                      </span>
                    ),
                  },
                  {
                    clave: "moneda",
                    encabezado: "Moneda",
                    celda: (cuenta) => cuenta.moneda,
                  },
                  {
                    clave: "saldo",
                    encabezado: "Saldo inicial",
                    alineacion: "derecha",
                    celda: (cuenta) =>
                      formatearMoneda(cuenta.saldoInicial, monedaDe(cuenta)),
                  },
                  {
                    clave: "estado",
                    encabezado: "Estado",
                    celda: (cuenta) => (
                      <PillEstado
                        estado={cuenta.activa ? "activa" : "inactiva"}
                      />
                    ),
                  },
                  {
                    clave: "acciones",
                    encabezado: "",
                    ordenable: false,
                    alineacion: "derecha",
                    celda: (cuenta) =>
                      puedeGestionar ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${cuenta.nombre}`}
                          onClick={() => abrirEdicionCuenta(cuenta)}
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

        <TabsContent value="movimientos" className="flex flex-col gap-4">
          <TarjetaLista data-lista="movimientos-bancarios">
            <BarraLista
              titulo="Movimientos bancarios"
              descripcion="Filtra por cuenta y rango de fechas. Se muestran hasta 1.000 movimientos."
              acciones={
                puedeOperar ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setDialogoImportar(true)}
                    >
                      <IconFileSpreadsheet className="size-4" />
                      Importar extracto CSV
                    </Button>
                    <Button onClick={() => setDialogoMovimiento(true)}>
                      <IconPlus className="size-4" />
                      Registrar movimiento
                    </Button>
                  </>
                ) : undefined
              }
              filtros={
                <>
                  <SelectCampo
                    id="filtro-cuenta-banco"
                    opciones={opcionesFiltroCuenta}
                    valor={filtroCuenta}
                    etiquetaVacia="Todas las cuentas"
                    onCambio={(valor) => {
                      setFiltroCuenta(valor);
                      aplicarFiltros(valor, rango);
                    }}
                    className="w-[220px]"
                    aria-label="Filtrar por cuenta bancaria"
                  />
                  <div className="w-[260px]">
                    <DateRangePicker
                      value={rango}
                      onChange={(siguiente) => {
                        setRango(siguiente);
                        aplicarFiltros(filtroCuenta, siguiente);
                      }}
                      placeholder="Rango de fechas"
                    />
                  </div>
                </>
              }
            >
              <TablaLista<MovimientoListado>
                filas={movimientos}
                claveFila={(movimiento) => movimiento.id}
                paginacion={{ tamanoPagina: 25, etiqueta: "movimientos" }}
                vacio={{
                  titulo: "Sin movimientos",
                  descripcion:
                    "Registra un movimiento manual o importa el extracto del banco.",
                  icono: <IconArrowDownLeft className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "fecha",
                    encabezado: "Fecha",
                    celda: (movimiento) => formatearFecha(movimiento.fecha),
                  },
                  {
                    clave: "cuenta",
                    encabezado: "Cuenta",
                    celda: (movimiento) =>
                      nombreCuenta(movimiento.cuentaBancariaId),
                  },
                  {
                    clave: "descripcion",
                    encabezado: "Descripción",
                    celda: (movimiento) => (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-foreground">
                          {movimiento.descripcion === ""
                            ? "Sin descripción"
                            : movimiento.descripcion}
                        </span>
                        {movimiento.referencia === "" ? null : (
                          <span className="truncate text-xs text-muted-foreground">
                            Ref. {movimiento.referencia}
                          </span>
                        )}
                      </div>
                    ),
                  },
                  {
                    clave: "tipo",
                    encabezado: "Tipo",
                    celda: (movimiento) => (
                      <PillEstado
                        estado={
                          ETIQUETAS_TIPO[movimiento.tipo] ?? movimiento.tipo
                        }
                        tono={TONO_TIPO[movimiento.tipo] ?? "neutro"}
                      />
                    ),
                  },
                  {
                    clave: "monto",
                    encabezado: "Monto",
                    alineacion: "derecha",
                    celda: (movimiento) => (
                      <span
                        className={cn(
                          "font-medium",
                          esEntrada(movimiento.tipo)
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {esEntrada(movimiento.tipo) ? "+" : "−"}
                        {formatearMoneda(movimiento.monto, moneda)}
                      </span>
                    ),
                  },
                  {
                    clave: "conciliado",
                    encabezado: "Conciliación",
                    celda: (movimiento) => (
                      <PillEstado
                        estado={
                          movimiento.conciliado ? "conciliado" : "pendiente"
                        }
                        tono={movimiento.conciliado ? "exito" : "pendiente"}
                      />
                    ),
                  },
                ]}
              />
            </BarraLista>
          </TarjetaLista>

          <TarjetaLista data-lista="importaciones-bancarias">
            <BarraLista
              titulo="Historial de importaciones"
              descripcion="Archivos de extractos cargados a las cuentas bancarias."
            >
              <TablaLista<ImportacionListado>
                filas={importaciones}
                claveFila={(importacion) => importacion.id}
                vacio={{
                  titulo: "Sin importaciones",
                  descripcion:
                    "Cuando importes un extracto CSV aparecerá en este historial.",
                  icono: <IconFileSpreadsheet className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "fecha",
                    encabezado: "Cargado",
                    celda: (importacion) =>
                      formatearFechaHora(importacion.creadoEn),
                  },
                  {
                    clave: "cuenta",
                    encabezado: "Cuenta",
                    celda: (importacion) =>
                      nombreCuenta(importacion.cuentaBancariaId),
                  },
                  {
                    clave: "archivo",
                    encabezado: "Archivo",
                    celda: (importacion) => importacion.nombreArchivo,
                  },
                  {
                    clave: "filas",
                    encabezado: "Filas",
                    alineacion: "derecha",
                    celda: (importacion) => String(importacion.totalFilas),
                  },
                ]}
              />
            </BarraLista>
          </TarjetaLista>
        </TabsContent>

        <TabsContent value="conciliacion" className="flex flex-col gap-4">
          <TarjetaLista data-lista="sesiones-conciliacion">
            <BarraLista
              titulo="Sesiones de conciliación"
              descripcion="Compara el saldo del extracto con el saldo en libros y marca los movimientos conciliados."
              acciones={
                puedeOperar ? (
                  <Button onClick={() => setDialogoSesion(true)}>
                    <IconPlus className="size-4" />
                    Nueva sesión
                  </Button>
                ) : undefined
              }
            >
              <TablaLista<SesionListado>
                filas={sesiones}
                claveFila={(sesion) => sesion.id}
                ordenable
                paginacion={{ tamanoPagina: 10, etiqueta: "sesiones" }}
                vacio={{
                  titulo: "Sin sesiones de conciliación",
                  descripcion:
                    "Crea una sesión con la fecha de corte y el saldo del extracto.",
                  icono: <IconScale className="size-8" />,
                }}
                columnas={[
                  {
                    clave: "cuenta",
                    encabezado: "Cuenta",
                    celda: (sesion) => nombreCuenta(sesion.cuentaBancariaId),
                  },
                  {
                    clave: "corte",
                    encabezado: "Fecha de corte",
                    celda: (sesion) => formatearFecha(sesion.fechaCorte),
                  },
                  {
                    clave: "extracto",
                    encabezado: "Saldo extracto",
                    alineacion: "derecha",
                    celda: (sesion) =>
                      formatearMoneda(sesion.saldoExtracto, moneda),
                  },
                  {
                    clave: "libros",
                    encabezado: "Saldo en libros",
                    alineacion: "derecha",
                    celda: (sesion) =>
                      formatearMoneda(sesion.saldoLibros, moneda),
                  },
                  {
                    clave: "diferencia",
                    encabezado: "Diferencia",
                    alineacion: "derecha",
                    celda: (sesion) => (
                      <span
                        className={cn(
                          sesion.diferencia === 0
                            ? "text-muted-foreground"
                            : "font-medium text-[var(--warning)]",
                        )}
                      >
                        {formatearMoneda(sesion.diferencia, moneda)}
                      </span>
                    ),
                  },
                  {
                    clave: "estado",
                    encabezado: "Estado",
                    celda: (sesion) => (
                      <PillEstado
                        estado={
                          sesion.estado === "open" ? "abierta" : "cerrada"
                        }
                        tono={sesion.estado === "open" ? "exito" : "neutro"}
                      />
                    ),
                  },
                  {
                    clave: "acciones",
                    encabezado: "",
                    ordenable: false,
                    alineacion: "derecha",
                    celda: (sesion) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSesionDetalle(sesion)}
                      >
                        {sesion.estado === "open" ? "Conciliar" : "Ver detalle"}
                      </Button>
                    ),
                  },
                ]}
              />
            </BarraLista>
          </TarjetaLista>
        </TabsContent>
      </Tabs>

      <DialogoCuenta
        abierto={dialogoCuenta}
        onOpenChange={(abierto) => {
          setDialogoCuenta(abierto);
          if (!abierto) setCuentaEdicion(null);
        }}
        cuenta={cuentaEdicion}
        empresaId={empresaId}
        opcionesCuentas={opcionesCuentasContables}
        monedaEmpresa={moneda}
      />

      <DialogoMovimiento
        abierto={dialogoMovimiento}
        onOpenChange={setDialogoMovimiento}
        empresaId={empresaId}
        cuentas={cuentas}
        opcionesCuentas={opcionesCuentasContables}
        cuentaInicial={filtroCuenta}
        moneda={moneda}
      />

      <DialogoImportar
        abierto={dialogoImportar}
        onOpenChange={setDialogoImportar}
        empresaId={empresaId}
        cuentas={cuentas}
        cuentaInicial={filtroCuenta}
      />

      <DialogoSesion
        abierto={dialogoSesion}
        onOpenChange={setDialogoSesion}
        empresaId={empresaId}
        cuentas={cuentas}
        moneda={moneda}
      />

      <Dialog
        open={sesionActiva !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setSesionDetalle(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Conciliación bancaria</DialogTitle>
            <DialogDescription>
              {sesionActiva
                ? `${nombreCuenta(sesionActiva.cuentaBancariaId)} · corte ${formatearFecha(sesionActiva.fechaCorte)}`
                : "Selecciona una sesión."}
            </DialogDescription>
          </DialogHeader>

          {sesionActiva ? (
            <>
              <dl className="grid gap-2 sm:grid-cols-4">
                <DatoConciliacion
                  etiqueta="Saldo extracto"
                  valor={formatearMoneda(sesionActiva.saldoExtracto, moneda)}
                />
                <DatoConciliacion
                  etiqueta="Saldo en libros"
                  valor={formatearMoneda(sesionActiva.saldoLibros, moneda)}
                />
                <DatoConciliacion
                  etiqueta="Neto conciliado"
                  valor={formatearMoneda(netoConciliado, moneda)}
                />
                <DatoConciliacion
                  etiqueta="Diferencia en vivo"
                  valor={formatearMoneda(diferenciaEnVivo, moneda)}
                  resaltado={diferenciaEnVivo !== 0}
                />
              </dl>

              <div className="max-h-[46vh] overflow-y-auto rounded-[10px] border border-border">
                {cargandoSesion ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <IconLoader2 className="size-4 animate-spin" />
                    Cargando movimientos…
                  </div>
                ) : movimientosOptimistas.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    La cuenta no tiene movimientos registrados.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {movimientosOptimistas.map((movimiento) => {
                      const enSesion =
                        movimiento.conciliado &&
                        movimiento.sesionId === sesionActiva.id;

                      return (
                        <li
                          key={movimiento.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm text-foreground">
                              {formatearFecha(movimiento.fecha)} ·{" "}
                              {movimiento.descripcion === ""
                                ? "Sin descripción"
                                : movimiento.descripcion}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {ETIQUETAS_TIPO[movimiento.tipo] ??
                                movimiento.tipo}{" "}
                              · {formatearMoneda(movimiento.monto, moneda)}
                            </span>
                          </div>

                          {sesionActiva.estado === "open" ? (
                            <Button
                              variant={enSesion ? "secondary" : "outline"}
                              size="sm"
                              disabled={accionOptimista.enCurso(movimiento.id)}
                              onClick={() => alternarConciliado(movimiento)}
                            >
                              {accionOptimista.enCurso(movimiento.id) ? (
                                <IconLoader2 className="size-4 animate-spin" />
                              ) : (
                                <IconCheck className="size-4" />
                              )}
                              {enSesion ? "Conciliado" : "Conciliar"}
                            </Button>
                          ) : (
                            <PillEstado
                              estado={enSesion ? "conciliado" : "pendiente"}
                              tono={enSesion ? "exito" : "pendiente"}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSesionDetalle(null)}
                >
                  Cerrar
                </Button>
                {sesionActiva.estado === "open" && puedeGestionar ? (
                  <Button
                    disabled={accionId === sesionActiva.id}
                    onClick={() => void cerrarSesion()}
                  >
                    {accionId === sesionActiva.id ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconLock className="size-4" />
                    )}
                    Cerrar sesión de conciliación
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DatoConciliacion({
  etiqueta,
  valor,
  resaltado = false,
}: {
  etiqueta: string;
  valor: string;
  resaltado?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] bg-muted/50 px-3 py-2">
      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {etiqueta}
      </dt>
      <dd
        className={cn(
          "font-display text-base font-semibold tabular-nums",
          resaltado ? "text-[var(--warning)]" : "text-foreground",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

interface DialogoCuentaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  cuenta: CuentaBancariaListado | null;
  empresaId: string;
  opcionesCuentas: readonly OpcionSelect[];
  monedaEmpresa: Moneda;
}

interface FormCuenta {
  nombre: string;
  banco: string;
  numeroCuenta: string;
  moneda: "DOP" | "USD";
  cuentaContableId: string;
  saldoInicial: string;
  activa: string;
}

function formCuentaInicial(
  cuenta: CuentaBancariaListado | null,
  monedaEmpresa: Moneda,
): FormCuenta {
  if (!cuenta) {
    return {
      nombre: "",
      banco: "",
      numeroCuenta: "",
      moneda: monedaEmpresa,
      cuentaContableId: "",
      saldoInicial: "0",
      activa: "activa",
    };
  }

  return {
    nombre: cuenta.nombre,
    banco: cuenta.banco,
    numeroCuenta: cuenta.numeroCuenta,
    moneda: cuenta.moneda === "USD" ? "USD" : "DOP",
    cuentaContableId: cuenta.cuentaContableId,
    saldoInicial: String(cuenta.saldoInicial),
    activa: cuenta.activa ? "activa" : "inactiva",
  };
}

function DialogoCuenta({
  abierto,
  onOpenChange,
  cuenta,
  empresaId,
  opcionesCuentas,
  monedaEmpresa,
}: DialogoCuentaProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormCuenta>(
    formCuentaInicial(cuenta, monedaEmpresa),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm(formCuentaInicial(cuenta, monedaEmpresa));
    setError(null);
    setGuardando(false);
  }, [abierto, cuenta, monedaEmpresa]);

  function actualizar<C extends keyof FormCuenta>(
    campo: C,
    valor: FormCuenta[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.nombre.trim() === "") {
      setError("El nombre de la cuenta es obligatorio.");
      return;
    }

    if (form.cuentaContableId === "") {
      setError("Selecciona la cuenta contable de efectivo.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await guardarCuentaBancariaAction({
      empresaId,
      id: cuenta ? cuenta.id : null,
      nombre: form.nombre,
      banco: form.banco,
      numeroCuenta: form.numeroCuenta,
      moneda: form.moneda,
      cuentaContableId: form.cuentaContableId,
      saldoInicial: aNumero(form.saldoInicial),
      activa: form.activa === "activa",
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
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {cuenta ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"}
            </DialogTitle>
            <DialogDescription>
              Vincula la cuenta bancaria con su cuenta contable de efectivo.
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
            <FormField htmlFor="banco-nombre" label="Nombre" required>
              <Input
                id="banco-nombre"
                value={form.nombre}
                onChange={(evento) => actualizar("nombre", evento.target.value)}
                placeholder="Ej. Operaciones Banco Popular"
              />
            </FormField>

            <FormField htmlFor="banco-entidad" label="Banco">
              <Input
                id="banco-entidad"
                value={form.banco}
                onChange={(evento) => actualizar("banco", evento.target.value)}
                placeholder="Ej. Banco Popular"
              />
            </FormField>

            <FormField htmlFor="banco-numero" label="Número de cuenta">
              <Input
                id="banco-numero"
                value={form.numeroCuenta}
                onChange={(evento) =>
                  actualizar("numeroCuenta", evento.target.value)
                }
                placeholder="000-000000-0"
              />
            </FormField>

            <FormField htmlFor="banco-moneda" label="Moneda" required>
              <SelectCampo
                id="banco-moneda"
                opciones={OPCIONES_MONEDA}
                valor={form.moneda}
                onCambio={(valor) =>
                  actualizar("moneda", valor === "USD" ? "USD" : "DOP")
                }
                requerido
                aria-label="Moneda de la cuenta"
              />
            </FormField>

            <FormField
              htmlFor="banco-contable"
              label="Cuenta contable"
              required
              className="sm:col-span-2"
            >
              <SelectCampo
                id="banco-contable"
                opciones={opcionesCuentas}
                valor={form.cuentaContableId}
                onCambio={(valor) => actualizar("cuentaContableId", valor)}
                buscable
                requerido
                etiquetaVacia="Buscar cuenta contable…"
                aria-label="Cuenta contable de efectivo"
              />
            </FormField>

            <FormField htmlFor="banco-saldo" label="Saldo inicial">
              <Input
                id="banco-saldo"
                value={form.saldoInicial}
                onChange={(evento) =>
                  actualizar("saldoInicial", evento.target.value)
                }
                inputMode="decimal"
                placeholder="0.00"
                className="text-right tabular-nums"
              />
            </FormField>

            <FormField htmlFor="banco-estado" label="Estado" required>
              <SelectCampo
                id="banco-estado"
                opciones={OPCIONES_ESTADO}
                valor={form.activa}
                onCambio={(valor) => actualizar("activa", valor)}
                requerido
                aria-label="Estado de la cuenta bancaria"
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
                  Guardando…
                </>
              ) : (
                <>
                  <IconBuildingBank className="size-4" />
                  {cuenta ? "Guardar cambios" : "Crear cuenta"}
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
  cuentas: readonly CuentaBancariaListado[];
  opcionesCuentas: readonly OpcionSelect[];
  cuentaInicial: string;
  moneda: Moneda;
}

interface FormMovimiento {
  cuentaBancariaId: string;
  fecha: string;
  tipo: string;
  monto: string;
  descripcion: string;
  referencia: string;
  cuentaContrapartidaId: string;
}

function DialogoMovimiento({
  abierto,
  onOpenChange,
  empresaId,
  cuentas,
  opcionesCuentas,
  cuentaInicial,
  moneda,
}: DialogoMovimientoProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormMovimiento>({
    cuentaBancariaId: cuentaInicial !== "" ? cuentaInicial : "",
    fecha: hoySantoDomingo(),
    tipo: "deposit",
    monto: "",
    descripcion: "",
    referencia: "",
    cuentaContrapartidaId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const primera =
      cuentaInicial !== "" ? cuentaInicial : (cuentas[0]?.id ?? "");

    setForm({
      cuentaBancariaId: primera,
      fecha: hoySantoDomingo(),
      tipo: "deposit",
      monto: "",
      descripcion: "",
      referencia: "",
      cuentaContrapartidaId: "",
    });
    setError(null);
    setGuardando(false);
  }, [abierto, cuentaInicial, cuentas]);

  function actualizar<C extends keyof FormMovimiento>(
    campo: C,
    valor: FormMovimiento[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  const opcionesCuentasBancarias = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: cuenta.nombre,
  }));

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (form.cuentaBancariaId === "") {
      setError("Selecciona la cuenta bancaria.");
      return;
    }

    const monto = aNumero(form.monto);
    if (monto <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await registrarMovimientoBancarioAction({
      empresaId,
      cuentaBancariaId: form.cuentaBancariaId,
      fecha: form.fecha,
      tipo: form.tipo,
      monto,
      descripcion: form.descripcion,
      referencia: form.referencia,
      cuentaContrapartidaId: form.cuentaContrapartidaId,
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
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>Registrar movimiento bancario</DialogTitle>
            <DialogDescription>
              Con una cuenta de contrapartida se genera el asiento contable del
              movimiento.
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
            <FormField htmlFor="mov-cuenta" label="Cuenta bancaria" required>
              <SelectCampo
                id="mov-cuenta"
                opciones={opcionesCuentasBancarias}
                valor={form.cuentaBancariaId}
                onCambio={(valor) => actualizar("cuentaBancariaId", valor)}
                requerido
                aria-label="Cuenta bancaria"
              />
            </FormField>

            <FormField htmlFor="mov-fecha" label="Fecha" required>
              <DatePicker
                id="mov-fecha"
                value={form.fecha}
                onChange={(valor) => actualizar("fecha", valor)}
              />
            </FormField>

            <FormField htmlFor="mov-tipo" label="Tipo" required>
              <SelectCampo
                id="mov-tipo"
                opciones={OPCIONES_TIPO}
                valor={form.tipo}
                onCambio={(valor) => actualizar("tipo", valor)}
                requerido
                aria-label="Tipo de movimiento"
              />
            </FormField>

            <FormField htmlFor="mov-monto" label={`Monto (${moneda})`} required>
              <Input
                id="mov-monto"
                value={form.monto}
                onChange={(evento) => actualizar("monto", evento.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="text-right tabular-nums"
              />
            </FormField>

            <FormField htmlFor="mov-referencia" label="Referencia">
              <Input
                id="mov-referencia"
                value={form.referencia}
                onChange={(evento) =>
                  actualizar("referencia", evento.target.value)
                }
                placeholder="Ej. DEP-001"
              />
            </FormField>

            <FormField
              htmlFor="mov-contrapartida"
              label="Cuenta de contrapartida"
              className="sm:col-span-2"
            >
              <SelectCampo
                id="mov-contrapartida"
                opciones={opcionesCuentas}
                valor={form.cuentaContrapartidaId}
                onCambio={(valor) => actualizar("cuentaContrapartidaId", valor)}
                buscable
                etiquetaVacia="Sin contabilizar"
                aria-label="Cuenta de contrapartida"
              />
            </FormField>

            <FormField
              htmlFor="mov-descripcion"
              label="Descripción"
              className="sm:col-span-2 lg:col-span-3"
            >
              <Input
                id="mov-descripcion"
                value={form.descripcion}
                onChange={(evento) =>
                  actualizar("descripcion", evento.target.value)
                }
                placeholder="Detalle del movimiento"
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

interface DialogoImportarProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  cuentas: readonly CuentaBancariaListado[];
  cuentaInicial: string;
}

interface ArchivoParseado {
  nombre: string;
  filas: FilaExtractoBancario[];
  errores: string[];
}

function DialogoImportar({
  abierto,
  onOpenChange,
  empresaId,
  cuentas,
  cuentaInicial,
}: DialogoImportarProps) {
  const router = useRouter();
  const [cuentaId, setCuentaId] = useState(cuentaInicial);
  const [archivo, setArchivo] = useState<ArchivoParseado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setCuentaId(cuentaInicial !== "" ? cuentaInicial : (cuentas[0]?.id ?? ""));
    setArchivo(null);
    setError(null);
    setGuardando(false);
  }, [abierto, cuentaInicial, cuentas]);

  function leerArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const seleccionado = evento.target.files?.[0];

    if (!seleccionado) {
      setArchivo(null);
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      const contenido = typeof lector.result === "string" ? lector.result : "";
      const parseado = parsearExtractoCsv(contenido);
      setArchivo({
        nombre: seleccionado.name,
        filas: parseado.filas,
        errores: parseado.errores,
      });
    };
    lector.readAsText(seleccionado);
  }

  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (cuentaId === "") {
      setError("Selecciona la cuenta bancaria.");
      return;
    }

    if (!archivo || archivo.filas.length === 0) {
      setError("Carga un archivo CSV con al menos un movimiento válido.");
      return;
    }

    if (archivo.errores.length > 0) {
      setError("Corrige los errores del archivo antes de importar.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await importarMovimientosBancariosAction({
      empresaId,
      cuentaBancariaId: cuentaId,
      nombreArchivo: archivo.nombre,
      filas: archivo.filas,
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

  const opcionesCuentasBancarias = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: cuenta.nombre,
  }));

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={importar} noValidate>
          <DialogHeader>
            <DialogTitle>Importar extracto bancario</DialogTitle>
            <DialogDescription>
              Columnas: fecha, descripción, referencia, tipo y monto. Admite
              separador coma o punto y coma.
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

          <FormField htmlFor="importar-cuenta" label="Cuenta bancaria" required>
            <SelectCampo
              id="importar-cuenta"
              opciones={opcionesCuentasBancarias}
              valor={cuentaId}
              onCambio={setCuentaId}
              requerido
              aria-label="Cuenta bancaria a importar"
            />
          </FormField>

          <FormField htmlFor="importar-archivo" label="Archivo CSV" required>
            <Input
              id="importar-archivo"
              type="file"
              accept=".csv,text/csv"
              onChange={leerArchivo}
              className="h-auto py-1.5"
            />
          </FormField>

          {archivo ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">{archivo.nombre}</p>
              <p className="text-muted-foreground tabular-nums">
                {archivo.filas.length} movimientos válidos ·{" "}
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
                  {archivo.filas.slice(0, 5).map((fila, indice) => (
                    <li key={`${fila.fecha}-${indice}`}>
                      {formatearFecha(fila.fecha)} ·{" "}
                      {fila.descripcion || "Sin descripción"} ·{" "}
                      {ETIQUETAS_TIPO[fila.tipo] ?? fila.tipo} ·{" "}
                      {formatearMoneda(fila.monto)}
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
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <IconFileSpreadsheet className="size-4" />
                  Importar extracto
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoSesionProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  cuentas: readonly CuentaBancariaListado[];
  moneda: Moneda;
}

function DialogoSesion({
  abierto,
  onOpenChange,
  empresaId,
  cuentas,
  moneda,
}: DialogoSesionProps) {
  const router = useRouter();
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [fechaCorte, setFechaCorte] = useState(hoySantoDomingo());
  const [saldoExtracto, setSaldoExtracto] = useState("0");
  const [saldoLibros, setSaldoLibros] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setCuentaId(cuentas[0]?.id ?? "");
    setFechaCorte(hoySantoDomingo());
    setSaldoExtracto("0");
    setSaldoLibros("");
    setError(null);
    setGuardando(false);
  }, [abierto, cuentas]);

  const opcionesCuentasBancarias = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: cuenta.nombre,
  }));

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    if (cuentaId === "") {
      setError("Selecciona la cuenta bancaria.");
      return;
    }

    setError(null);
    setGuardando(true);

    const resultado = await crearSesionConciliacionAction({
      empresaId,
      cuentaBancariaId: cuentaId,
      fechaCorte,
      saldoExtracto: aNumero(saldoExtracto),
      saldoLibros: saldoLibros.trim() === "" ? null : aNumero(saldoLibros),
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
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={crear} noValidate>
          <DialogHeader>
            <DialogTitle>Nueva sesión de conciliación</DialogTitle>
            <DialogDescription>
              El saldo en libros se calcula desde el mayor si lo dejas vacío.
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
              htmlFor="sesion-cuenta"
              label="Cuenta bancaria"
              required
              className="sm:col-span-2"
            >
              <SelectCampo
                id="sesion-cuenta"
                opciones={opcionesCuentasBancarias}
                valor={cuentaId}
                onCambio={setCuentaId}
                requerido
                aria-label="Cuenta bancaria de la sesión"
              />
            </FormField>

            <FormField htmlFor="sesion-corte" label="Fecha de corte" required>
              <DatePicker
                id="sesion-corte"
                value={fechaCorte}
                onChange={setFechaCorte}
              />
            </FormField>

            <FormField
              htmlFor="sesion-extracto"
              label={`Saldo del extracto (${moneda})`}
              required
            >
              <Input
                id="sesion-extracto"
                value={saldoExtracto}
                onChange={(evento) => setSaldoExtracto(evento.target.value)}
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </FormField>

            <FormField
              htmlFor="sesion-libros"
              label={`Saldo en libros (${moneda})`}
              className="sm:col-span-2"
            >
              <Input
                id="sesion-libros"
                value={saldoLibros}
                onChange={(evento) => setSaldoLibros(evento.target.value)}
                inputMode="decimal"
                placeholder="Calcular desde el mayor"
                className="text-right tabular-nums"
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
                  Creando…
                </>
              ) : (
                <>
                  <IconScale className="size-4" />
                  Crear sesión
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
