import {
  EsqueletoEncabezado,
  EsqueletoPestanas,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";

export default function InventarioLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Inventario"
        descripcion="Artículos, costo promedio ponderado y kardex de movimientos."
        acciones={1}
      />
      <EsqueletoTarjetas cantidad={3} className="xl:grid-cols-3" />
      <EsqueletoPestanas cantidad={2} />
      <EsqueletoTabla
        titulo="Catálogo de artículos"
        descripcion="Precio de venta y cuentas contables de inventario, costo e ingreso."
        acciones={2}
        columnas={7}
        filas={10}
      />
    </>
  );
}
