import { EsqueletoEncabezado } from "@/components/carga/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

const CLAVES_TARJETAS = ["primera", "segunda", "tercera"] as const;

function TarjetasConfiguracionEsqueleto({ cantidad }: { cantidad: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CLAVES_TARJETAS.slice(0, cantidad).map((clave) => (
        <div
          key={clave}
          className="flex min-h-44 flex-col rounded-[15px] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <Skeleton className="size-10 rounded-[10px] bg-secondary/80" />
          <Skeleton className="mt-4 h-4 w-32 rounded-[6px]" />
          <Skeleton className="mt-2 h-3 w-full rounded-[6px]" />
          <Skeleton className="mt-1 h-3 w-4/5 rounded-[6px]" />
          <Skeleton className="mt-auto h-4 w-14 rounded-[6px]" />
        </div>
      ))}
    </div>
  );
}

export default function ConfiguracionLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Configuración"
        descripcion="Centraliza la administración de empresas, usuarios, parámetros fiscales DGII y seguridad de tu cuenta."
      />

      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-36 rounded-[6px]" />
        <TarjetasConfiguracionEsqueleto cantidad={3} />
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-56 rounded-[6px]" />
        <TarjetasConfiguracionEsqueleto cantidad={2} />
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32 rounded-[6px]" />
        <TarjetasConfiguracionEsqueleto cantidad={1} />
      </section>
    </>
  );
}
