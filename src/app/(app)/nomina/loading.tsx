import {
  EsqueletoEncabezado,
  EsqueletoPestanas,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";

export default function NominaLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Recursos humanos y nómina"
        descripcion="Empleados, corridas de nómina y su contabilización con asiento automático."
        acciones={1}
      />
      <EsqueletoTarjetas cantidad={3} className="xl:grid-cols-3" />
      <EsqueletoPestanas cantidad={2} />
      <EsqueletoTabla
        titulo="Empleados"
        descripcion="Datos laborales y salario mensual usado en la nómina."
        acciones={1}
        columnas={6}
        filas={10}
      />
    </>
  );
}
