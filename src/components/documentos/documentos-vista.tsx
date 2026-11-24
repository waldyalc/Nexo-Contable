"use client";

import {
  IconDownload,
  IconFileDescription,
  IconFolders,
  IconLoader2,
  IconSearch,
  IconTrash,
  IconUpload,
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
  eliminarDocumentoAction,
  registrarDocumentoAction,
} from "@/app/(app)/documentos/actions";
import { TarjetasResumen } from "@/components/comunes/tarjetas-resumen";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import { BarraLista } from "@/components/listas/barra-lista";
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
import { ZONA_HORARIA } from "@/lib/formato";
import { createClient } from "@/lib/supabase/client";

export interface DocumentoListado {
  id: string;
  entidad: string;
  entidadId: string;
  nombreArchivo: string;
  rutaStorage: string;
  mimeType: string;
  tamanoBytes: number;
  creadoEn: string;
}

export type OpcionEntidad = OpcionSelect;

export interface DocumentosVistaProps {
  empresaId: string;
  documentos: readonly DocumentoListado[];
  opcionesEntidades: readonly OpcionEntidad[];
  filtroEntidad: string;
  puedeEscribir: boolean;
}

const TAMANO_MAXIMO = 50 * 1024 * 1024;

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatearFechaHora(valor: string): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat("es-DO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

function sanitizarSegmento(valor: string, respaldo: string): string {
  const limpio = valor
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return limpio === "" ? respaldo : limpio;
}

export function DocumentosVista({
  empresaId,
  documentos,
  opcionesEntidades,
  filtroEntidad,
  puedeEscribir,
}: DocumentosVistaProps) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [dialogoSubir, setDialogoSubir] = useState(false);
  const [documentoEliminar, setDocumentoEliminar] =
    useState<DocumentoListado | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (termino === "") return documentos;

    return documentos.filter(
      (documento) =>
        documento.nombreArchivo.toLowerCase().includes(termino) ||
        documento.entidad.toLowerCase().includes(termino) ||
        documento.entidadId.toLowerCase().includes(termino),
    );
  }, [documentos, busqueda]);

  const totales = useMemo(() => {
    const tamano = documentos.reduce(
      (total, documento) => total + documento.tamanoBytes,
      0,
    );
    const entidades = new Set(documentos.map((documento) => documento.entidad));

    return { tamano, entidades: entidades.size };
  }, [documentos]);

  function cambiarFiltro(valor: string) {
    router.replace(
      valor === "" ? "/documentos" : `/documentos?entidad=${valor}`,
      { scroll: false },
    );
  }

  async function descargar(documento: DocumentoListado) {
    setAccionId(documento.id);
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(documento.rutaStorage, 60);
    setAccionId(null);

    if (error || data === null) {
      toast.error(
        error ? error.message : "No pudimos generar el enlace de descarga.",
      );
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Documentos"
        descripcion="Archivos de la empresa guardados en el almacenamiento privado con enlaces firmados temporales."
        migas={[{ etiqueta: "Operaciones" }, { etiqueta: "Documentos" }]}
        acciones={
          puedeEscribir ? (
            <Button onClick={() => setDialogoSubir(true)}>
              <IconUpload className="size-4" />
              Subir documento
            </Button>
          ) : undefined
        }
      />

      <TarjetasResumen
        etiqueta="Resumen de documentos"
        datos={[
          {
            etiqueta: "Documentos",
            valor: String(documentos.length),
            detalle: "Carpeta privada de la empresa",
            icono: IconFolders,
          },
          {
            etiqueta: "Espacio usado",
            valor: formatearBytes(totales.tamano),
            detalle: "Suma de los archivos listados",
            icono: IconFileDescription,
          },
          {
            etiqueta: "Entidades vinculadas",
            valor: String(totales.entidades),
            detalle: "Facturas, gastos, pagos y más",
            icono: IconFileDescription,
          },
        ]}
      />

      <TarjetaLista data-lista="documentos-almacenados">
        <BarraLista
          titulo="Archivos almacenados"
          descripcion="Se muestran los últimos 500 documentos de la empresa."
          filtros={
            <>
              <div className="relative w-full sm:max-w-xs">
                <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar por archivo o entidad…"
                  aria-label="Buscar documentos"
                  className="h-9 pl-8"
                />
              </div>
              <SelectCampo
                id="filtro-entidad-documento"
                opciones={opcionesEntidades}
                valor={filtroEntidad}
                onCambio={cambiarFiltro}
                etiquetaVacia="Todas las entidades"
                className="w-[200px]"
                aria-label="Filtrar documentos por entidad"
              />
            </>
          }
        >
          <TablaLista<DocumentoListado>
            filas={filtrados}
            claveFila={(documento) => documento.id}
            paginacion={{ tamanoPagina: 20, etiqueta: "documentos" }}
            vacio={{
              titulo: "Sin documentos",
              descripcion:
                "Sube el primer archivo y quedará vinculado a la empresa activa.",
              icono: <IconFolders className="size-8" />,
            }}
            columnas={[
              {
                clave: "archivo",
                encabezado: "Archivo",
                celda: (documento) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {documento.nombreArchivo}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {documento.mimeType === ""
                        ? "Tipo desconocido"
                        : documento.mimeType}
                    </span>
                  </div>
                ),
              },
              {
                clave: "entidad",
                encabezado: "Entidad",
                celda: (documento) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-foreground">
                      {documento.entidad}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {documento.entidadId === ""
                        ? "Sin identificador"
                        : documento.entidadId}
                    </span>
                  </div>
                ),
              },
              {
                clave: "tamano",
                encabezado: "Tamaño",
                alineacion: "derecha",
                celda: (documento) => formatearBytes(documento.tamanoBytes),
              },
              {
                clave: "fecha",
                encabezado: "Subido",
                celda: (documento) => formatearFechaHora(documento.creadoEn),
              },
              {
                clave: "acciones",
                encabezado: "",
                alineacion: "derecha",
                celda: (documento) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Descargar ${documento.nombreArchivo}`}
                      disabled={accionId === documento.id}
                      onClick={() => void descargar(documento)}
                    >
                      {accionId === documento.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconDownload className="size-4" />
                      )}
                    </Button>
                    {puedeEscribir ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${documento.nombreArchivo}`}
                        onClick={() => setDocumentoEliminar(documento)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </BarraLista>
      </TarjetaLista>

      <DialogoSubir
        abierto={dialogoSubir}
        onOpenChange={setDialogoSubir}
        empresaId={empresaId}
        opcionesEntidades={opcionesEntidades}
      />

      <DialogoEliminar
        documento={documentoEliminar}
        onCerrar={() => setDocumentoEliminar(null)}
        empresaId={empresaId}
      />
    </>
  );
}

interface DialogoSubirProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  opcionesEntidades: readonly OpcionEntidad[];
}

function DialogoSubir({
  abierto,
  onOpenChange,
  empresaId,
  opcionesEntidades,
}: DialogoSubirProps) {
  const router = useRouter();
  const [entidad, setEntidad] = useState("factura");
  const [entidadId, setEntidadId] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setArchivo(null);
    setError(null);
    setSubiendo(false);
  }, [abierto]);

  function seleccionarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const seleccionado = evento.target.files?.[0] ?? null;

    if (seleccionado && seleccionado.size > TAMANO_MAXIMO) {
      setArchivo(null);
      setError("El archivo supera el máximo de 50 MB.");
      return;
    }

    setError(null);
    setArchivo(seleccionado);
  }

  async function subir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (subiendo) return;

    if (archivo === null) {
      setError("Selecciona el archivo a subir.");
      return;
    }

    const entidadLimpia = sanitizarSegmento(entidad, "");
    if (entidadLimpia === "") {
      setError("Indica la entidad del documento (factura, gasto, pago…).");
      return;
    }

    setError(null);
    setSubiendo(true);

    const nombreSeguro = sanitizarSegmento(archivo.name, "documento");
    const identificador = crypto.randomUUID();
    const ruta = `${empresaId}/${entidadLimpia}/${identificador}-${nombreSeguro}`;

    const supabase = createClient();
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(ruta, archivo, {
        contentType: archivo.type === "" ? undefined : archivo.type,
        upsert: false,
      });

    if (errorSubida) {
      setSubiendo(false);
      setError(errorSubida.message);
      return;
    }

    const resultado = await registrarDocumentoAction({
      empresaId,
      entidad: entidadLimpia,
      entidadId,
      nombreArchivo: archivo.name,
      rutaStorage: ruta,
      mimeType: archivo.type,
      tamanoBytes: archivo.size,
    });

    if (!resultado.ok) {
      await supabase.storage.from("documentos").remove([ruta]);
      setSubiendo(false);
      setError(resultado.error);
      return;
    }

    setSubiendo(false);
    toast.success(resultado.mensaje);
    setArchivo(null);
    setEntidadId("");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form className="flex flex-col gap-4" onSubmit={subir} noValidate>
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>
              El archivo se guarda en la carpeta privada de la empresa y se
              vincula a la entidad indicada.
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
            <FormField htmlFor="documento-entidad" label="Entidad" required>
              <SelectCampo
                id="documento-entidad"
                opciones={opcionesEntidades}
                valor={entidad}
                onCambio={setEntidad}
                requerido
                aria-label="Entidad del documento"
              />
            </FormField>

            <FormField
              htmlFor="documento-entidad-id"
              label="Identificador de la entidad"
            >
              <Input
                id="documento-entidad-id"
                value={entidadId}
                onChange={(evento) => setEntidadId(evento.target.value)}
                placeholder="Ej. FAC-2026-0001"
              />
            </FormField>

            <FormField
              htmlFor="documento-archivo"
              label="Archivo (máximo 50 MB)"
              required
              className="sm:col-span-2"
            >
              <Input
                id="documento-archivo"
                type="file"
                onChange={seleccionarArchivo}
                className="h-auto py-1.5"
              />
            </FormField>
          </FormGrid>

          {archivo ? (
            <p className="rounded-[10px] border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {archivo.name} · {formatearBytes(archivo.size)}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={subiendo}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={subiendo}>
              {subiendo ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <IconUpload className="size-4" />
                  Subir documento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoEliminarProps {
  documento: DocumentoListado | null;
  onCerrar: () => void;
  empresaId: string;
}

function DialogoEliminar({
  documento,
  onCerrar,
  empresaId,
}: DialogoEliminarProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!documento) return;
    setError(null);
    setEliminando(false);
  }, [documento]);

  async function eliminar() {
    if (!documento || eliminando) return;

    setError(null);
    setEliminando(true);

    const resultado = await eliminarDocumentoAction({
      empresaId,
      documentoId: documento.id,
      rutaStorage: documento.rutaStorage,
    });

    setEliminando(false);

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
      open={documento !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          setError(null);
          onCerrar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar documento</DialogTitle>
          <DialogDescription>
            {documento
              ? `Se quitará "${documento.nombreArchivo}" del almacenamiento privado. Esta acción no se puede deshacer.`
              : "Selecciona un documento."}
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

        <DialogFooter>
          <Button
            variant="outline"
            disabled={eliminando}
            onClick={() => {
              setError(null);
              onCerrar();
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={eliminando}
            onClick={() => void eliminar()}
          >
            {eliminando ? (
              <>
                <IconLoader2 className="size-4 animate-spin" />
                Eliminando…
              </>
            ) : (
              <>
                <IconTrash className="size-4" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
