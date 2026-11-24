import {
  EsqueletoEncabezado,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";

export default function UsuariosLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Usuarios"
        descripcion="Perfiles de la firma, su rol global y las empresas donde participan."
        acciones={1}
      />
      <EsqueletoTabla
        titulo="Listado de usuarios"
        filtros={2}
        columnas={6}
        filas={10}
      />
    </>
  );
}
