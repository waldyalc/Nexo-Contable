import {
  EsqueletoEncabezado,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function FacturacionLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Facturación"
        descripcion="Facturas de venta con NCF de serie B o e-CF electrónico y formato 607."
      />
      <EsqueletoTabla
        titulo="Facturas emitidas"
        acciones={4}
        filtros={3}
        columnas={8}
        filas={10}
      />
    </>
  );
}
