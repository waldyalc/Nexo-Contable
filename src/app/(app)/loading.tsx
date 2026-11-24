import {
  EsqueletoEncabezado,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";

export default function AppLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Nexo Contable"
        descripcion="Preparando tu espacio de trabajo…"
        acciones={2}
      />
      <EsqueletoTarjetas cantidad={3} className="xl:grid-cols-3" />
      <EsqueletoTabla filas={6} columnas={5} />
    </>
  );
}
