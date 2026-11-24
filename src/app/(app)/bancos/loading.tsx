import {
  EsqueletoEncabezado,
  EsqueletoPestanas,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function BancosLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Banco y conciliación"
        descripcion="Cuentas bancarias, movimientos, importación de extractos y conciliación con el mayor contable."
        acciones={1}
      />
      <EsqueletoPestanas cantidad={3} />
      <EsqueletoTabla
        titulo="Cuentas bancarias"
        descripcion="Vincula cada cuenta con su cuenta contable de efectivo."
        acciones={1}
        columnas={6}
        filas={8}
      />
    </>
  );
}
