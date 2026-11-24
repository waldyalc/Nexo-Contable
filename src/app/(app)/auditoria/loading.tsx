import {
  EsqueletoEncabezado,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function AuditoriaLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Auditoría"
        descripcion="Registro append-only de las operaciones de la empresa activa."
        acciones={1}
      />
      <EsqueletoTabla
        titulo="Bitácora de la empresa"
        filtros={4}
        columnas={5}
        filas={12}
      />
    </>
  );
}
