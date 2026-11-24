import { IconBuilding, IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import {
  type AsientoReciente,
  DashboardVista,
  type DashboardVistaProps,
  type FilaEstadoResultadosDashboard,
  type ResumenEmpresa,
  type ResumenFirma,
} from "@/components/dashboard/dashboard-vista";
import type { PuntoIngresoGasto } from "@/components/dashboard/grafico-ingresos-gastos";
import type { RangoFechas } from "@/components/date-range-picker";
import { TarjetaLista } from "@/components/listas/tarjeta-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ETIQUETAS_ROL } from "@/components/shell/navegacion";
import { Button } from "@/components/ui/button";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { type Moneda, aNumero, hoySantoDomingo } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Resumen · Nexo Contable",
};

const ROLES_REPORTES = new Set([
  "admin_global",
  "admin_empresa",
  "contador",
  "auxiliar",
]);

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

interface AsientoFila {
  id: string;
  numero: string;
  fecha: string;
  descripcion: string;
  estado: string;
}

interface MesRango {
  desde: string;
  hasta: string;
  etiqueta: string;
}

function pad2(valor: number): string {
  return String(valor).padStart(2, "0");
}

function finDeMes(anio: number, mes: number): string {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${pad2(mes)}-${pad2(ultimoDia)}`;
}

function ultimosMeses(cantidad: number): MesRango[] {
  const hoy = hoySantoDomingo();
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const meses: MesRango[] = [];

  for (
    let desplazamiento = cantidad - 1;
    desplazamiento >= 0;
    desplazamiento -= 1
  ) {
    const total = anio * 12 + (mes - 1) - desplazamiento;
    const anioMes = Math.floor(total / 12);
    const numeroMes = (total % 12) + 1;
    const etiqueta = format(new Date(anioMes, numeroMes - 1, 1), "MMM yy", {
      locale: es,
    });

    meses.push({
      desde: `${anioMes}-${pad2(numeroMes)}-01`,
      hasta: finDeMes(anioMes, numeroMes),
      etiqueta: etiqueta.replace(/^./, (letra) => letra.toUpperCase()),
    });
  }

  return meses;
}

function rangoPorDefecto(): RangoFechas {
  const hoy = hoySantoDomingo();
  return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
}

function leerRango(
  params: Record<string, string | string[] | undefined>,
): RangoFechas {
  const porDefecto = rangoPorDefecto();
  const valorDesde = Array.isArray(params.desde)
    ? params.desde[0]
    : params.desde;
  const valorHasta = Array.isArray(params.hasta)
    ? params.hasta[0]
    : params.hasta;

  const desde =
    valorDesde && PATRON_FECHA.test(valorDesde) ? valorDesde : porDefecto.desde;
  const hasta =
    valorHasta && PATRON_FECHA.test(valorHasta) ? valorHasta : porDefecto.hasta;

  if (desde > hasta) return porDefecto;

  return { desde, hasta };
}

function aResumen(fila: {
  ventas: number;
  notas_credito_venta: number;
  compras: number;
  notas_credito_compra: number;
  itbis_ventas: number;
  itbis_compras: number;
  total_activos: number;
  total_pasivos: number;
  total_patrimonio: number;
  resultado: number;
  efectivo: number;
  documentos_pendientes: number;
  asientos: number;
}): ResumenEmpresa {
  return {
    ventas: aNumero(fila.ventas),
    notasCreditoVenta: aNumero(fila.notas_credito_venta),
    compras: aNumero(fila.compras),
    notasCreditoCompra: aNumero(fila.notas_credito_compra),
    itbisVentas: aNumero(fila.itbis_ventas),
    itbisCompras: aNumero(fila.itbis_compras),
    totalActivos: aNumero(fila.total_activos),
    totalPasivos: aNumero(fila.total_pasivos),
    totalPatrimonio: aNumero(fila.total_patrimonio),
    resultado: aNumero(fila.resultado),
    efectivo: aNumero(fila.efectivo),
    documentosPendientes: aNumero(fila.documentos_pendientes),
    asientos: aNumero(fila.asientos),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const params = await searchParams;
  const rango = leerRango(params);
  const empresa = contexto.empresaActiva;
  const moneda: Moneda = empresa?.monedaFuncional === "USD" ? "USD" : "DOP";

  const encabezado = (
    <EncabezadoPagina
      titulo="Resumen"
      descripcion={
        empresa
          ? `${empresa.nombreComercial} · ${ETIQUETAS_ROL[empresa.rol]}`
          : "Bienvenido a Nexo Contable."
      }
      migas={[{ etiqueta: "General" }, { etiqueta: "Resumen" }]}
      acciones={
        contexto.esAdminGlobal ? (
          <Button variant="outline" render={<Link href="/empresas" />}>
            <IconBuilding className="size-4" />
            Gestionar empresas
          </Button>
        ) : undefined
      }
    />
  );

  if (!empresa) {
    return (
      <>
        {encabezado}
        <TarjetaLista>
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <IconBuildingStore className="size-6" />
            </span>
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
              Aún no hay una empresa activa
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {contexto.esAdminGlobal
                ? "Crea la primera empresa de tu firma para comenzar a contabilizar facturas, gastos y comprobantes DGII."
                : "Tu usuario todavía no tiene empresas asignadas. Solicita acceso al administrador de tu firma."}
            </p>
            {contexto.esAdminGlobal ? (
              <Button render={<Link href="/empresas?nueva=1" />}>
                <IconPlus className="size-4" />
                Crear empresa
              </Button>
            ) : null}
          </div>
        </TarjetaLista>
      </>
    );
  }

  const rol = contexto.esAdminGlobal ? "admin_global" : empresa.rol;
  const puedeVerReportes = ROLES_REPORTES.has(rol);
  const supabase = await createClient();

  let error: string | null = null;

  if (!puedeVerReportes) {
    error =
      "Tu rol no incluye acceso a los reportes financieros. Consulta con el administrador de tu firma.";
  }

  const meses = ultimosMeses(6);

  const [
    asientosRespuesta,
    resumenRespuesta,
    estadoRespuesta,
    serieRespuesta,
    firmaRespuesta,
  ] = await Promise.all([
    supabase
      .from("asientos")
      .select("id, numero, fecha, descripcion, estado")
      .eq("empresa_id", empresa.id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .limit(8),
    puedeVerReportes
      ? supabase.rpc("reporte_resumen_empresa", {
          p_empresa_id: empresa.id,
          p_desde: rango.desde,
          p_hasta: rango.hasta,
        })
      : Promise.resolve({ data: null, error: null }),
    puedeVerReportes
      ? supabase.rpc("reporte_estado_resultados", {
          p_empresa_id: empresa.id,
          p_desde: rango.desde,
          p_hasta: rango.hasta,
        })
      : Promise.resolve({ data: null, error: null }),
    puedeVerReportes
      ? Promise.all(
          meses.map((mes) =>
            supabase.rpc("reporte_resumen_empresa", {
              p_empresa_id: empresa.id,
              p_desde: mes.desde,
              p_hasta: mes.hasta,
            }),
          ),
        )
      : Promise.resolve([]),
    contexto.esAdminGlobal
      ? supabase.rpc("reporte_resumen_firma", {
          p_desde: rango.desde,
          p_hasta: rango.hasta,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (asientosRespuesta.error && !error) {
    error = asientosRespuesta.error.message;
  }

  if (resumenRespuesta.error && !error) {
    error = resumenRespuesta.error.message;
  }

  if (estadoRespuesta.error && !error) {
    error = estadoRespuesta.error.message;
  }

  if (firmaRespuesta.error && !error) {
    error = firmaRespuesta.error.message;
  }

  const filaResumen = resumenRespuesta.data?.[0];
  const resumen = filaResumen ? aResumen(filaResumen) : null;

  const estadoResultados: FilaEstadoResultadosDashboard[] = (
    estadoRespuesta.data ?? []
  ).map((fila) => ({
    codigo: fila.codigo,
    nombre: fila.nombre,
    clasificacion: fila.clasificacion,
    monto: aNumero(fila.monto),
  }));

  const serieMensual: PuntoIngresoGasto[] = meses.map((mes, indice) => {
    const respuesta = serieRespuesta[indice];
    const fila = respuesta?.data?.[0];

    if (respuesta?.error && !error) {
      error = respuesta.error.message;
    }

    return {
      periodo: mes.etiqueta,
      ingresos: fila
        ? aNumero(fila.ventas) - aNumero(fila.notas_credito_venta)
        : 0,
      gastos: fila
        ? aNumero(fila.compras) - aNumero(fila.notas_credito_compra)
        : 0,
    };
  });

  const ultimosAsientos: AsientoReciente[] = (
    (asientosRespuesta.data as AsientoFila[] | null) ?? []
  ).map((fila) => ({
    id: fila.id,
    numero: fila.numero,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    estado: fila.estado,
  }));

  const firma: ResumenFirma[] | null =
    firmaRespuesta.data === null
      ? null
      : firmaRespuesta.data.map((fila) => ({
          empresaId: fila.empresa_id,
          empresa: fila.empresa,
          ...aResumen(fila),
        }));

  const props: DashboardVistaProps = {
    rango,
    resumen,
    estadoResultados,
    serieMensual,
    ultimosAsientos,
    firma,
    empresas: contexto.empresas.map((asignada) => ({
      id: asignada.id,
      nombreComercial: asignada.nombreComercial,
    })),
    empresaActivaId: empresa.id,
    esAdminGlobal: contexto.esAdminGlobal,
    moneda,
    error,
  };

  return (
    <>
      {encabezado}
      <DashboardVista key={empresa.id} {...props} />
    </>
  );
}
