import {
  EsqueletoEncabezado,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";

export default function CuentasPorPagarLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Cuentas por pagar"
        descripcion="Saldos de proveedores por antigüedad, pagos y anulaciones por reverso."
      />
      <EsqueletoTarjetas
        cantidad={6}
        className="lg:grid-cols-3 xl:grid-cols-6"
      />
      <EsqueletoTabla titulo="Documentos por pagar" columnas={8} filas={10} />
    </>
  );
}
