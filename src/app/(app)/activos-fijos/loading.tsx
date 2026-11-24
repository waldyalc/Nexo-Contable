import {
  EsqueletoEncabezado,
  EsqueletoPestanas,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";

export default function ActivosFijosLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Activos fijos"
        descripcion="Costo de adquisición, vida útil en meses y depreciación mensual contabilizada."
        acciones={1}
      />
      <EsqueletoTarjetas cantidad={3} className="xl:grid-cols-3" />
      <EsqueletoPestanas cantidad={2} />
      <EsqueletoTabla
        titulo="Registro de activos fijos"
        descripcion="Cada activo usa su cuenta de activo, depreciación acumulada y gasto de depreciación."
        acciones={2}
        columnas={7}
        filas={10}
      />
    </>
  );
}
