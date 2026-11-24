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
  IconShoppingCart,
  IconUserCog,
  IconUsersGroup,
} from "@tabler/icons-react";

import type { MigaDePan } from "@/components/pagina/migas-de-pan";
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
  titulo: "GENERAL" | "OPERACIONES" | "ADMINISTRACIÓN";
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
    titulo: "ADMINISTRACIÓN",
    items: [
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
    ],
  },
];

const TITULO_GRUPO: Record<GrupoNavegacion["titulo"], string> = {
  GENERAL: "General",
  OPERACIONES: "Operaciones",
  ADMINISTRACIÓN: "Administración",
};

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

/** Migas de pan de la ruta actual dentro del shell. */
export function migasParaRuta(pathname: string): MigaDePan[] {
  for (const grupo of GRUPOS_NAVEGACION) {
    for (const item of grupo.items) {
      const activa =
        pathname === item.href || pathname.startsWith(`${item.href}/`);

      if (!activa) continue;

      if (grupo.titulo === "GENERAL") {
        return [{ etiqueta: item.etiqueta }];
      }

      return [
        { etiqueta: TITULO_GRUPO[grupo.titulo] },
        { etiqueta: item.etiqueta, href: item.href },
      ];
    }
  }

  return [{ etiqueta: "Resumen", href: "/dashboard" }];
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
