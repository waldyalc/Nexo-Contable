import type { Icon } from "@tabler/icons-react";
import {
  IconBook2,
  IconBuilding,
  IconBuildingBank,
  IconBusinessplan,
  IconClipboardList,
  IconFileInvoice,
  IconFolders,
  IconHistory,
  IconLayoutDashboard,
  IconPackages,
  IconReceipt2,
  IconReceiptTax,
  IconScale,
  IconSettings,
  IconShoppingCart,
  IconUserCircle,
  IconUserCog,
  IconUsersGroup,
} from "@tabler/icons-react";

import type { RolContexto } from "@/lib/auth/sesion";

export const ETIQUETAS_ROL: Record<RolContexto, string> = {
  admin_global: "Administrador global",
  admin_empresa: "Administrador de empresa",
  contador: "Contador",
  auxiliar: "Auxiliar",
  cliente: "Cliente",
  usuario: "Usuario",
};

export interface ItemNavegacion {
  etiqueta: string;
  href: string;
  icono: Icon;
  /** Sin `roles`, el ítem es visible para cualquier usuario autenticado. */
  roles?: readonly RolContexto[];
}

export interface GrupoNavegacion {
  titulo: "GENERAL" | "OPERACIONES" | "SISTEMA";
  items: readonly ItemNavegacion[];
}

const OPERATIVOS: readonly RolContexto[] = [
  "admin_global",
  "admin_empresa",
  "contador",
  "auxiliar",
];

const CONTABLES: readonly RolContexto[] = [
  "admin_global",
  "admin_empresa",
  "contador",
];

/** Menú lateral de Nexo, en el orden exacto de `docs/DESIGN.md`. */
export const GRUPOS_NAVEGACION: readonly GrupoNavegacion[] = [
  {
    titulo: "GENERAL",
    items: [
      {
        etiqueta: "Resumen",
        href: "/dashboard",
        icono: IconLayoutDashboard,
      },
    ],
  },
  {
    titulo: "OPERACIONES",
    items: [
      {
        etiqueta: "Banco",
        href: "/bancos",
        icono: IconBuildingBank,
        roles: OPERATIVOS,
      },
      {
        etiqueta: "Inventario",
        href: "/inventario",
        icono: IconPackages,
        roles: OPERATIVOS,
      },
      {
        etiqueta: "Contabilidad",
        href: "/contabilidad",
        icono: IconBook2,
        roles: CONTABLES,
      },
      {
        etiqueta: "Cuentas por cobrar",
        href: "/cuentas-por-cobrar",
        icono: IconReceipt2,
        roles: OPERATIVOS,
      },
      {
        etiqueta: "Cuentas por pagar",
        href: "/cuentas-por-pagar",
        icono: IconClipboardList,
        roles: OPERATIVOS,
      },
      {
        etiqueta: "Facturación",
        href: "/facturacion",
        icono: IconFileInvoice,
        roles: OPERATIVOS,
      },
      {
        etiqueta: "Gastos y compras",
        href: "/gastos",
        icono: IconShoppingCart,
        roles: OPERATIVOS,
      },
      {
        etiqueta: "Impuestos",
        href: "/impuestos",
        icono: IconReceiptTax,
        roles: CONTABLES,
      },
      {
        etiqueta: "Activos fijos",
        href: "/activos-fijos",
        icono: IconScale,
        roles: CONTABLES,
      },
      {
        etiqueta: "Finanzas",
        href: "/finanzas",
        icono: IconBusinessplan,
        roles: CONTABLES,
      },
      {
        etiqueta: "Recursos humanos",
        href: "/nomina",
        icono: IconUsersGroup,
        roles: OPERATIVOS,
      },
      {
        etiqueta: "Documentos",
        href: "/documentos",
        icono: IconFolders,
      },
    ],
  },
  {
    titulo: "SISTEMA",
    items: [
      {
        etiqueta: "Configuración",
        href: "/configuracion",
        icono: IconSettings,
      },
    ],
  },
];

/** Rutas administrativas accesibles desde el menú de perfil y Configuración. */
export const RUTAS_PERFIL_ADMIN: readonly ItemNavegacion[] = [
  {
    etiqueta: "Configuración",
    href: "/configuracion",
    icono: IconSettings,
  },
  {
    etiqueta: "Empresas",
    href: "/empresas",
    icono: IconBuilding,
    roles: ["admin_global"],
  },
  {
    etiqueta: "Usuarios",
    href: "/usuarios",
    icono: IconUserCog,
    roles: ["admin_global", "admin_empresa"],
  },
  {
    etiqueta: "Auditoría",
    href: "/auditoria",
    icono: IconHistory,
    roles: ["admin_global", "admin_empresa"],
  },
  {
    etiqueta: "Mi perfil y seguridad",
    href: "/perfil",
    icono: IconUserCircle,
  },
];

/** Filtra el menú según el rol efectivo del usuario en la empresa activa. */
export function filtrarGruposPorRol(
  grupos: readonly GrupoNavegacion[],
  rol: RolContexto | null,
): GrupoNavegacion[] {
  return grupos
    .map((grupo) => ({
      titulo: grupo.titulo,
      items: grupo.items.filter(
        (item) => !item.roles || (rol != null && item.roles.includes(rol)),
      ),
    }))
    .filter((grupo) => grupo.items.length > 0);
}

/** Iniciales de una empresa o persona para el monograma circular. */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);

  if (palabras.length === 0) return "N";

  const primera = palabras[0]?.[0] ?? "";
  const segunda =
    palabras.length > 1 ? (palabras[1]?.[0] ?? "") : (palabras[0]?.[1] ?? "");

  return `${primera}${segunda}`.toUpperCase();
}
