"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster de Nexo: tarjetas blancas con borde suave y tipografía DM Sans.
 * Se monta una sola vez en el layout de la aplicación.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-[15px] !border !border-border !bg-card !text-foreground !shadow-lg",
          title: "!font-display !font-semibold !tracking-[-0.01em]",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
          success: "!text-primary",
          error: "!text-destructive",
          warning: "!text-[var(--warning)]",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
