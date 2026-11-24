import { IconBuildingStore } from "@tabler/icons-react";

import { TarjetaLista } from "@/components/listas/tarjeta-lista";

export interface SinEmpresaActivaProps {
  descripcion: string;
}

/** Estado vacío de los módulos cuando el usuario no tiene empresa activa. */
export function SinEmpresaActiva({ descripcion }: SinEmpresaActivaProps) {
  return (
    <TarjetaLista>
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <IconBuildingStore className="size-6" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
          Aún no hay una empresa activa
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">{descripcion}</p>
      </div>
    </TarjetaLista>
  );
}
