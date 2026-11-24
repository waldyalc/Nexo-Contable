import {
  EsqueletoEncabezado,
  EsqueletoPestanas,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function FinanzasLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Finanzas"
        descripcion="Estados financieros de la empresa activa."
      />
      <EsqueletoPestanas cantidad={3} />
      <EsqueletoTabla
        titulo="Estado de resultados"
        acciones={2}
        filtros={1}
        columnas={3}
        filas={12}
      />
    </>
  );
}
