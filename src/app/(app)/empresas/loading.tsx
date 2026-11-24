import {
  EsqueletoEncabezado,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function EmpresasLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Empresas"
        descripcion="Administra las empresas de la firma y su empresa principal."
        acciones={1}
      />
      <EsqueletoTabla
        titulo="Listado de empresas"
        acciones={1}
        filtros={2}
        columnas={6}
        filas={10}
      />
    </>
  );
}
