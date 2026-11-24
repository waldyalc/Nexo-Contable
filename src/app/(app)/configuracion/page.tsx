import {
  IconArrowRight,
  IconBook2,
  IconBuilding,
  IconHistory,
  IconReceiptTax,
  IconShieldLock,
  IconUserCog,
} from "@tabler/icons-react";
import Link from "next/link";

import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { obtenerContextoApp } from "@/lib/auth/sesion";

interface TarjetaConfig {
  titulo: string;
  descripcion: string;
  href: string;
  icono: typeof IconBuilding;
  visible: boolean;
}

export default async function ConfiguracionPage() {
  const contexto = await obtenerContextoApp();
  const esAdmin =
    contexto.esAdminGlobal || contexto.rolActivo === "admin_empresa";
  const esContable = esAdmin || contexto.rolActivo === "contador";

  const secciones: Array<{ titulo: string; items: TarjetaConfig[] }> = [
    {
      titulo: "Firma y accesos",
      items: [
        {
          titulo: "Empresas",
          descripcion:
            "Crea, edita y administra las empresas de la firma y define tu empresa principal.",
          href: "/empresas",
          icono: IconBuilding,
          visible: contexto.esAdminGlobal,
        },
        {
          titulo: "Usuarios y roles",
          descripcion:
            "Administra perfiles, permisos globales y asignaciones de acceso por empresa.",
          href: "/usuarios",
          icono: IconUserCog,
          visible: esAdmin,
        },
        {
          titulo: "Auditoría",
          descripcion:
            "Revisa la bitácora inmutable de asientos, documentos y cambios administrativos.",
          href: "/auditoria",
          icono: IconHistory,
          visible: esAdmin,
        },
      ],
    },
    {
      titulo: "Contabilidad y cumplimiento DGII",
      items: [
        {
          titulo: "Impuestos, NCF y e-CF",
          descripcion:
            "Configura secuencias serie B y E, tasas de ITBIS/ISR, métodos de pago y formatos 606/607.",
          href: "/impuestos",
          icono: IconReceiptTax,
          visible: esContable,
        },
        {
          titulo: "Catálogo de cuentas y períodos",
          descripcion:
            "Administra el plan de cuentas (347 cuentas base), balances iniciales y cierre de períodos.",
          href: "/contabilidad",
          icono: IconBook2,
          visible: esContable,
        },
      ],
    },
    {
      titulo: "Cuenta personal",
      items: [
        {
          titulo: "Mi perfil y seguridad",
          descripcion:
            "Consulta tus empresas asignadas y actualiza tu contraseña personal.",
          href: "/perfil",
          icono: IconShieldLock,
          visible: true,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Centraliza la administración de empresas, usuarios, parámetros fiscales DGII y seguridad de tu cuenta."
      />

      {secciones.map((seccion) => {
        const visibles = seccion.items.filter((i) => i.visible);
        if (visibles.length === 0) return null;

        return (
          <section key={seccion.titulo} className="flex flex-col gap-3">
            <h2 className="font-display text-sm font-bold tracking-[-0.02em] text-muted-foreground uppercase">
              {seccion.titulo}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibles.map((item) => {
                const Icono = item.icono;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className="group flex flex-col justify-between rounded-[15px] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <div>
                      <div className="flex size-10 items-center justify-center rounded-[10px] bg-secondary text-primary">
                        <Icono className="size-5" />
                      </div>
                      <h3 className="font-display mt-4 text-base font-bold text-foreground">
                        {item.titulo}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.descripcion}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                      <span>Abrir</span>
                      <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
