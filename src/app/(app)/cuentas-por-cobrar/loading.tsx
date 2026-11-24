import {
  EsqueletoEncabezado,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";

export default function CuentasPorCobrarLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Cuentas por cobrar"
        descripcion="Saldos de clientes por antigüedad, cobros y anulaciones por reverso."
      />
      <EsqueletoTarjetas
        cantidad={6}
        className="lg:grid-cols-3 xl:grid-cols-6"
      />
      <EsqueletoTabla titulo="Documentos por cobrar" columnas={8} filas={10} />
    </>
  );
}
