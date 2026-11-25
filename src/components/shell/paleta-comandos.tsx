"use client";

import type { Icon } from "@tabler/icons-react";
import {
  IconBook2,
  IconFileInvoice,
  IconLoader2,
  IconSearch,
  IconShoppingCart,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type ResultadosBusqueda,
  buscarGlobalAction,
} from "@/app/(app)/busqueda/acciones";
import {
  GRUPOS_NAVEGACION,
  type ItemNavegacion,
  RUTAS_PERFIL_ADMIN,
  filtrarGruposPorRol,
} from "@/components/shell/navegacion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EmpresaAsignada, RolContexto } from "@/lib/auth/sesion";
import {
  type Moneda,
  formatearFecha,
  formatearMoneda,
  formatearRnc,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

const RESULTADOS_VACIOS: ResultadosBusqueda = {
  terceros: [],
  ventas: [],
  compras: [],
  cuentas: [],
};

const SECCIONES = [
  "Módulos",
  "Terceros",
  "Facturas de venta",
  "Compras",
  "Cuentas contables",
] as const;

type SeccionPaleta = (typeof SECCIONES)[number];

interface EntradaPaleta {
  id: string;
  seccion: SeccionPaleta;
  titulo: string;
  detalle: string;
  href: string;
  icono: Icon;
}

export interface PaletaComandosProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  rolActivo: RolContexto | null;
  empresa: EmpresaAsignada | null;
}

function normalizarTexto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function itemsNavegacionParaRol(rol: RolContexto | null): ItemNavegacion[] {
  const visibles: ItemNavegacion[] = [];
  const vistos = new Set<string>();

  const agregar = (item: ItemNavegacion) => {
    if (vistos.has(item.href)) return;
    vistos.add(item.href);
    visibles.push(item);
  };

  for (const grupo of filtrarGruposPorRol(GRUPOS_NAVEGACION, rol)) {
    for (const item of grupo.items) agregar(item);
  }

  for (const item of RUTAS_PERFIL_ADMIN) {
    if (!item.roles || (rol != null && item.roles.includes(rol))) {
      agregar(item);
    }
  }

  return visibles;
}

function etiquetaTipoTercero(tipo: "customer" | "supplier" | "both"): string {
  if (tipo === "customer") return "Cliente";
  if (tipo === "supplier") return "Proveedor";
  return "Cliente y proveedor";
}

function hrefTercero(tipo: "customer" | "supplier" | "both"): string {
  if (tipo === "supplier") return "/gastos";
  return "/facturacion";
}

function detalleDocumento(
  documento: ResultadosBusqueda["ventas"][number],
  moneda: Moneda,
): string {
  const partes = [documento.tercero];
  const fecha = formatearFecha(documento.fechaEmision);
  if (fecha !== "") partes.push(fecha);
  partes.push(formatearMoneda(documento.total, moneda));
  return partes.join(" · ");
}

export function PaletaComandos({
  abierto,
  onAbiertoChange,
  rolActivo,
  empresa,
}: PaletaComandosProps) {
  const router = useRouter();
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] =
    useState<ResultadosBusqueda>(RESULTADOS_VACIOS);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const solicitudRef = useRef(0);
  const seleccionadoRef = useRef<HTMLButtonElement | null>(null);

  const moneda: Moneda = empresa?.monedaFuncional === "USD" ? "USD" : "DOP";

  useEffect(() => {
    if (!abierto) return;

    solicitudRef.current += 1;
    setTermino("");
    setResultados(RESULTADOS_VACIOS);
    setCargando(false);
    setError(null);
    setIndice(0);
  }, [abierto]);

  useEffect(() => {
    const alTeclearGlobal = (evento: globalThis.KeyboardEvent) => {
      if (
        (evento.ctrlKey || evento.metaKey) &&
        evento.key.toLowerCase() === "k"
      ) {
        evento.preventDefault();
        onAbiertoChange(!abierto);
      }
    };

    window.addEventListener("keydown", alTeclearGlobal);
    return () => window.removeEventListener("keydown", alTeclearGlobal);
  }, [abierto, onAbiertoChange]);

  useEffect(() => {
    if (!abierto) return;

    const consulta = termino.trim();
    if (consulta.length < 2) {
      solicitudRef.current += 1;
      setResultados(RESULTADOS_VACIOS);
      setCargando(false);
      setError(null);
      return;
    }

    setCargando(true);
    setError(null);

    const espera = window.setTimeout(() => {
      const solicitud = ++solicitudRef.current;

      void buscarGlobalAction(consulta)
        .then((respuesta) => {
          if (solicitud !== solicitudRef.current) return;

          if (respuesta.ok) {
            setResultados(respuesta.resultados);
            setError(null);
          } else {
            setResultados(RESULTADOS_VACIOS);
            setError(respuesta.error);
          }
          setIndice(0);
        })
        .catch(() => {
          if (solicitud !== solicitudRef.current) return;
          setResultados(RESULTADOS_VACIOS);
          setError("No pudimos completar la búsqueda. Inténtalo de nuevo.");
        })
        .finally(() => {
          if (solicitud === solicitudRef.current) setCargando(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(espera);
      solicitudRef.current += 1;
    };
  }, [abierto, termino]);

  const modulos = useMemo(() => itemsNavegacionParaRol(rolActivo), [rolActivo]);
  const terminoNormalizado = normalizarTexto(termino.trim());
  const busquedaActiva = termino.trim().length >= 2;

  const entradas = useMemo(() => {
    const entradasModulos: EntradaPaleta[] = modulos
      .filter(
        (item) =>
          terminoNormalizado === "" ||
          normalizarTexto(item.etiqueta).includes(terminoNormalizado),
      )
      .map((item) => ({
        id: `modulo-${item.href}`,
        seccion: "Módulos",
        titulo: item.etiqueta,
        detalle: "Ir al módulo",
        href: item.href,
        icono: item.icono,
      }));

    if (!busquedaActiva) return entradasModulos;

    const entradasTerceros: EntradaPaleta[] = resultados.terceros.map(
      (tercero) => {
        const rnc =
          tercero.rnc.trim() === ""
            ? "Sin RNC"
            : `RNC ${formatearRnc(tercero.rnc)}`;

        return {
          id: `tercero-${tercero.id}`,
          seccion: "Terceros",
          titulo: tercero.nombre,
          detalle: `${etiquetaTipoTercero(tercero.tipo)} · ${rnc}`,
          href: hrefTercero(tercero.tipo),
          icono: IconUsersGroup,
        };
      },
    );

    const entradasVentas: EntradaPaleta[] = resultados.ventas.map(
      (documento) => ({
        id: `venta-${documento.id}`,
        seccion: "Facturas de venta",
        titulo:
          documento.ncf === ""
            ? documento.numero
            : `${documento.numero} · ${documento.ncf}`,
        detalle: detalleDocumento(documento, moneda),
        href: "/facturacion",
        icono: IconFileInvoice,
      }),
    );

    const entradasCompras: EntradaPaleta[] = resultados.compras.map(
      (documento) => ({
        id: `compra-${documento.id}`,
        seccion: "Compras",
        titulo:
          documento.ncf === ""
            ? documento.numero
            : `${documento.numero} · ${documento.ncf}`,
        detalle: detalleDocumento(documento, moneda),
        href: "/gastos",
        icono: IconShoppingCart,
      }),
    );

    const entradasCuentas: EntradaPaleta[] = resultados.cuentas.map(
      (cuenta) => ({
        id: `cuenta-${cuenta.id}`,
        seccion: "Cuentas contables",
        titulo: `${cuenta.codigo} · ${cuenta.nombre}`,
        detalle: cuenta.clasificacion.replaceAll("_", " "),
        href: "/contabilidad",
        icono: IconBook2,
      }),
    );

    return [
      ...entradasModulos,
      ...entradasTerceros,
      ...entradasVentas,
      ...entradasCompras,
      ...entradasCuentas,
    ];
  }, [busquedaActiva, modulos, moneda, resultados, terminoNormalizado]);

  const indicePorId = useMemo(
    () => new Map(entradas.map((entrada, posicion) => [entrada.id, posicion])),
    [entradas],
  );

  const indiceSeguro =
    entradas.length === 0 ? 0 : Math.min(indice, entradas.length - 1);
  const claveSeleccion =
    entradas.length === 0
      ? "sin-resultados"
      : `${entradas.length}:${indiceSeguro}`;

  useEffect(() => {
    if (claveSeleccion === "sin-resultados") return;
    seleccionadoRef.current?.scrollIntoView({ block: "nearest" });
  }, [claveSeleccion]);

  function seleccionarEntrada(entrada: EntradaPaleta) {
    onAbiertoChange(false);
    router.push(entrada.href);
  }

  function alTeclearBusqueda(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      if (entradas.length > 0) {
        setIndice((actual) => (actual + 1) % entradas.length);
      }
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      if (entradas.length > 0) {
        setIndice((actual) => (actual - 1 + entradas.length) % entradas.length);
      }
      return;
    }

    if (evento.key === "Enter") {
      evento.preventDefault();
      const entrada = entradas.at(indiceSeguro);
      if (entrada) seleccionarEntrada(entrada);
      return;
    }

    if (evento.key === "Escape") {
      evento.preventDefault();
      onAbiertoChange(false);
    }
  }

  const totalDatos =
    resultados.terceros.length +
    resultados.ventas.length +
    resultados.compras.length +
    resultados.cuentas.length;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[10vh] max-h-[82vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl print:hidden"
      >
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <DialogDescription className="sr-only">
          Busca módulos, terceros, documentos y cuentas de la empresa activa.
        </DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-3">
          <IconSearch className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            type="text"
            value={termino}
            onChange={(evento) => {
              setTermino(evento.target.value);
              setIndice(0);
            }}
            onKeyDown={alTeclearBusqueda}
            placeholder="Buscar módulos, terceros, documentos o cuentas…"
            aria-label="Búsqueda global"
            role="combobox"
            aria-expanded="true"
            aria-controls="paleta-resultados"
            aria-autocomplete="list"
            aria-activedescendant={
              entradas.length > 0 ? `paleta-opcion-${indiceSeguro}` : undefined
            }
            className="h-12 rounded-none border-0 bg-transparent px-1 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0"
          />
          {cargando ? (
            <IconLoader2 className="size-4 shrink-0 animate-spin text-primary" />
          ) : (
            <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ESC
            </kbd>
          )}
        </div>

        <div
          id="paleta-resultados"
          className="max-h-[min(56vh,480px)] overflow-y-auto px-2 py-2"
        >
          {SECCIONES.map((seccion) => {
            const entradasSeccion = entradas.filter(
              (entrada) => entrada.seccion === seccion,
            );
            if (entradasSeccion.length === 0) return null;

            return (
              <section key={seccion} className="mb-2 last:mb-0">
                <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {seccion}
                </p>
                <ul className="flex flex-col">
                  {entradasSeccion.map((entrada) => {
                    const indiceEntrada = indicePorId.get(entrada.id) ?? 0;
                    const activa =
                      entradas.length > 0 && indiceEntrada === indiceSeguro;
                    const Icono = entrada.icono;

                    return (
                      <li key={entrada.id}>
                        <button
                          ref={activa ? seleccionadoRef : undefined}
                          type="button"
                          id={`paleta-opcion-${indiceEntrada}`}
                          onClick={() => seleccionarEntrada(entrada)}
                          onMouseEnter={() => setIndice(indiceEntrada)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors",
                            activa
                              ? "bg-secondary text-secondary-foreground"
                              : "text-foreground hover:bg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-[9px]",
                              activa
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icono className="size-4" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">
                              {entrada.titulo}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {entrada.detalle}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {cargando ? (
            <div className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin text-primary" />
              Buscando en la empresa activa…
            </div>
          ) : null}

          {error !== null ? (
            <p
              role="alert"
              className="mx-2 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          {!cargando && error === null && entradas.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No hay coincidencias para esta búsqueda.
            </p>
          ) : null}

          {!cargando &&
          error === null &&
          busquedaActiva &&
          totalDatos === 0 &&
          entradas.length > 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No encontramos terceros, documentos ni cuentas con ese término.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {empresa
              ? `Búsqueda limitada a ${empresa.nombreComercial}`
              : "No hay una empresa activa"}
          </span>
          <span className="hidden shrink-0 items-center gap-1 sm:flex">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              ↑↓
            </kbd>
            <span>navegar</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              Enter
            </kbd>
            <span>abrir</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
