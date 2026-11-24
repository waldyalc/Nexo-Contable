import {
  EsqueletoEncabezado,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function GastosLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Gastos y compras"
        descripcion="Comprobantes de compra con su NCF, retenciones y formato 606."
      />
      <EsqueletoTabla
        titulo="Compras registradas"
        acciones={4}
        filtros={3}
        columnas={8}
        filas={10}
      />
    </>
  );
}
