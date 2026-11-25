"use client";

import { IconRefresh } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function BotonActualizar() {
  const router = useRouter();

  return (
    <Button variant="outline" onClick={() => router.refresh()}>
      <IconRefresh className="size-4" />
      Actualizar
    </Button>
  );
}
