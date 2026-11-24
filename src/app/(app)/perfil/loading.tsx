import { EsqueletoEncabezado } from "@/components/carga/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function PerfilLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Mi perfil y seguridad"
        descripcion="Consulta tu cuenta, tus empresas asignadas y actualiza tu contraseña."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5 rounded-[15px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 rounded-[6px]" />
            <Skeleton className="h-3 w-64 rounded-[6px]" />
          </div>

          <div className="flex items-center gap-3.5">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40 rounded-[6px]" />
              <Skeleton className="h-3 w-52 rounded-[6px]" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Skeleton className="h-3 w-40 rounded-[6px]" />
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-12 w-full rounded-[10px]" />
              <Skeleton className="h-12 w-full rounded-[10px]" />
              <Skeleton className="h-12 w-full rounded-[10px]" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-[15px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-44 rounded-[6px]" />
            <Skeleton className="h-3 w-72 rounded-[6px]" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-32 rounded-[6px]" />
              <Skeleton className="h-10 w-full rounded-[10px]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-44 rounded-[6px]" />
              <Skeleton className="h-10 w-full rounded-[10px]" />
            </div>
            <Skeleton className="h-9 w-full rounded-[10px] bg-secondary/80" />
            <Skeleton className="h-10 w-48 rounded-[10px]" />
          </div>
        </div>
      </div>
    </>
  );
}
