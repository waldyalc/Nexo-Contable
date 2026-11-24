import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  cuentasParaCampoDocumento,
  rellenarCuentasPorDefectoVacias,
  resolverCuentaRetencionDocumento,
  resolverCuentasInicialesDocumento,
} from "@/lib/operaciones/cuentas-opciones";
import type { CuentaOpcion } from "@/lib/operaciones/tipos";

const CUENTAS: CuentaOpcion[] = [
  {
    id: "gasto",
    codigo: "5101",
    nombre: "Gasto general",
    clasificacion: "expense",
  },
  {
    id: "costo",
    codigo: "5102",
    nombre: "Costo de ventas",
    clasificacion: "cost",
  },
  {
    id: "cxc",
    codigo: "1201",
    nombre: "Cuentas por cobrar",
    clasificacion: "asset",
  },
  {
    id: "itbis-adelantado",
    codigo: "1202",
    nombre: "ITBIS adelantado",
    clasificacion: "asset",
  },
  {
    id: "cxp",
    codigo: "2101",
    nombre: "Cuentas por pagar",
    clasificacion: "liability",
  },
  {
    id: "itbis-por-pagar",
    codigo: "2201",
    nombre: "ITBIS por pagar",
    clasificacion: "liability",
  },
  {
    id: "retencion-isr",
    codigo: "2202",
    nombre: "Retención ISR por pagar",
    clasificacion: "liability",
  },
  {
    id: "ingreso",
    codigo: "4101",
    nombre: "Ventas",
    clasificacion: "income",
  },
];

function ids(cuentas: readonly CuentaOpcion[]): string[] {
  return cuentas.map((cuenta) => cuenta.id);
}

function leer(relativa: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativa), "utf8");
}

describe("cuentasParaCampoDocumento", () => {
  it("la cuenta de control de compras solo ofrece pasivos como CxP y retenciones", () => {
    const resultado = cuentasParaCampoDocumento(CUENTAS, "compra", "control");

    expect(resultado.length).toBeGreaterThan(0);
    expect(
      resultado.every((cuenta) => cuenta.clasificacion === "liability"),
    ).toBe(true);
    expect(ids(resultado)).toContain("cxp");
    expect(ids(resultado)).not.toContain("gasto");
    expect(ids(resultado)).not.toContain("cxc");
  });

  it("la cuenta de control de ventas solo ofrece activos como CxC", () => {
    const resultado = cuentasParaCampoDocumento(CUENTAS, "venta", "control");

    expect(resultado.length).toBeGreaterThan(0);
    expect(resultado.every((cuenta) => cuenta.clasificacion === "asset")).toBe(
      true,
    );
    expect(ids(resultado)).toContain("cxc");
    expect(ids(resultado)).not.toContain("cxp");
  });

  it("la cuenta de retenciones siempre es liability en compra y venta", () => {
    for (const operacion of ["compra", "venta"] as const) {
      const resultado = cuentasParaCampoDocumento(
        CUENTAS,
        operacion,
        "retencion",
      );

      expect(resultado.length).toBeGreaterThan(0);
      expect(
        resultado.every((cuenta) => cuenta.clasificacion === "liability"),
      ).toBe(true);
    }
  });

  it("la cuenta principal mantiene las clasificaciones operativas de cada documento", () => {
    expect(
      ids(cuentasParaCampoDocumento(CUENTAS, "compra", "principal")),
    ).toEqual(["gasto", "costo", "cxc", "itbis-adelantado"]);
    expect(
      ids(cuentasParaCampoDocumento(CUENTAS, "venta", "principal")),
    ).toEqual([
      "cxc",
      "itbis-adelantado",
      "cxp",
      "itbis-por-pagar",
      "retencion-isr",
      "ingreso",
    ]);
  });

  it("el ITBIS de compras usa activos y el de ventas usa pasivos", () => {
    expect(
      ids(cuentasParaCampoDocumento(CUENTAS, "compra", "impuesto")),
    ).toEqual(["cxc", "itbis-adelantado"]);
    expect(
      ids(cuentasParaCampoDocumento(CUENTAS, "venta", "impuesto")),
    ).toEqual(["cxp", "itbis-por-pagar", "retencion-isr"]);
  });

  it("si no hay cuenta de ITBIS de la clasificación esperada, ofrece todas las cuentas de movimiento", () => {
    const sinActivos = CUENTAS.filter(
      (cuenta) => cuenta.clasificacion !== "asset",
    );

    expect(cuentasParaCampoDocumento(sinActivos, "compra", "impuesto")).toEqual(
      sinActivos,
    );
  });
});

describe("cuentas iniciales del documento", () => {
  const configuracion = {
    cuentaItbisAdelantadoId: "itbis-adelantado",
    cuentaItbisPorPagarId: "itbis-por-pagar",
    cuentaRetencionIsrId: "retencion-isr",
    cuentaRetencionItbisId: "retencion-itbis",
    cuentaCxcDefaultId: "cxc",
    cuentaCxpDefaultId: "cxp",
  };

  it("compra prellena CxP e ITBIS adelantado desde la configuración", () => {
    expect(resolverCuentasInicialesDocumento("compra", configuracion)).toEqual({
      cuentaControlId: "cxp",
      cuentaImpuestoId: "itbis-adelantado",
      cuentaRetencionId: "retencion-isr",
    });
  });

  it("venta prellena CxC e ITBIS por pagar desde la configuración", () => {
    expect(resolverCuentasInicialesDocumento("venta", configuracion)).toEqual({
      cuentaControlId: "cxc",
      cuentaImpuestoId: "itbis-por-pagar",
      cuentaRetencionId: "retencion-isr",
    });
  });

  it("elige la cuenta de retención según el impuesto retenido que aplique", () => {
    expect(resolverCuentaRetencionDocumento(configuracion, 100, 0)).toBe(
      "retencion-isr",
    );
    expect(resolverCuentaRetencionDocumento(configuracion, 0, 180)).toBe(
      "retencion-itbis",
    );
    expect(resolverCuentaRetencionDocumento(configuracion, 100, 180)).toBe(
      "retencion-isr",
    );
    expect(
      resolverCuentaRetencionDocumento(
        { cuentaRetencionItbisId: "retencion-itbis" },
        100,
        0,
      ),
    ).toBe("retencion-itbis");
  });

  it("rellena solo cuentas vacías y nunca pisa una selección existente", () => {
    const resultado = rellenarCuentasPorDefectoVacias(
      {
        cuentaControlId: "control-manual",
        cuentaImpuestoId: "",
        cuentaRetencionId: "retencion-manual",
      },
      "compra",
      configuracion,
    );

    expect(resultado).toEqual({
      cuentaControlId: "control-manual",
      cuentaImpuestoId: "itbis-adelantado",
      cuentaRetencionId: "retencion-manual",
    });
  });
});

describe("candado de cableado en documentos", () => {
  it("DocumentoFormDialog usa la lógica pura para los cuatro campos de cuentas", () => {
    const contenido = leer("src/components/gastos/documento-form-dialog.tsx");

    expect(
      contenido.match(/cuentasParaCampoDocumento\(/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(4);
    for (const campo of ["principal", "control", "impuesto", "retencion"]) {
      expect(contenido).toContain(`"${campo}"`);
    }
    expect(contenido).toContain("rellenarCuentasPorDefectoVacias");
    expect(contenido).toContain("resolverCuentaRetencionDocumento");
  });

  it("las páginas y vistas propagan los seis IDs de la configuración fiscal", () => {
    const archivos = [
      "src/app/(app)/gastos/page.tsx",
      "src/app/(app)/facturacion/page.tsx",
      "src/components/gastos/gastos-vista.tsx",
      "src/components/facturacion/facturacion-vista.tsx",
    ];
    const propiedades = [
      "cuentaItbisAdelantadoId",
      "cuentaItbisPorPagarId",
      "cuentaRetencionIsrId",
      "cuentaRetencionItbisId",
      "cuentaCxcDefaultId",
      "cuentaCxpDefaultId",
    ];

    for (const archivo of archivos) {
      const contenido = leer(archivo);
      for (const propiedad of propiedades) {
        expect(contenido, `${archivo} debe propagar ${propiedad}`).toContain(
          propiedad,
        );
      }
    }
  });

  it("las exportaciones 606/607 resincronizan su período y las vistas se remontan por empresa", () => {
    for (const archivo of [
      "src/components/gastos/gastos-vista.tsx",
      "src/components/facturacion/facturacion-vista.tsx",
    ]) {
      expect(leer(archivo)).toContain("setPeriodo(periodoInicial)");
    }

    expect(leer("src/app/(app)/gastos/page.tsx")).toContain("key={empresa.id}");
    expect(leer("src/app/(app)/facturacion/page.tsx")).toContain(
      "key={empresa.id}",
    );
  });
});
