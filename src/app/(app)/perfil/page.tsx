import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { PerfilVista } from "@/components/perfil/perfil-vista";
import { obtenerContextoApp } from "@/lib/auth/sesion";

export default async function PerfilPage() {
  const contexto = await obtenerContextoApp();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Mi perfil y seguridad"
        descripcion="Consulta tu cuenta, tus empresas asignadas y actualiza tu contraseña."
      />
      <PerfilVista contexto={contexto} />
    </div>
  );
}
