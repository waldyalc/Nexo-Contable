import {
  EsqueletoEncabezado,
  EsqueletoPestanas,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function ContabilidadLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Contabilidad"
        descripcion="Catálogo de cuentas, libro diario, mayor y períodos contables."
      />
      <EsqueletoPestanas cantidad={4} />
      <EsqueletoTabla
        titulo="Catálogo de cuentas"
        acciones={2}
        filtros={2}
        columnas={6}
        filas={10}
      />
    </>
  );
}
