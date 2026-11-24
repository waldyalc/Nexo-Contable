import {
  EsqueletoEncabezado,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";

export default function DocumentosLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Documentos"
        descripcion="Archivos de la empresa guardados en el almacenamiento privado con enlaces firmados temporales."
        acciones={1}
      />
      <EsqueletoTarjetas cantidad={3} className="xl:grid-cols-3" />
      <EsqueletoTabla
        titulo="Archivos almacenados"
        filtros={2}
        columnas={5}
        filas={10}
      />
    </>
  );
}
