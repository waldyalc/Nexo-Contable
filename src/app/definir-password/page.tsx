import { redirect } from "next/navigation";

import { DefinirPasswordForm } from "@/components/auth/definir-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Crear contraseña · Nexo Contable",
};

export const dynamic = "force-dynamic";

interface PerfilPassword {
  nombre: string | null;
  email: string | null;
  debe_definir_password: boolean | null;
}

export default async function DefinirPasswordPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("perfiles")
    .select("nombre, email, debe_definir_password")
    .eq("user_id", user.id)
    .maybeSingle();

  const perfil = data as PerfilPassword | null;

  if (!perfil) {
    await supabase.auth.signOut();
    redirect("/login?error=no-autorizado");
  }

  if (!perfil.debe_definir_password) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="relative w-full max-w-[460px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full bg-secondary/70 blur-2xl"
        />
        <div className="relative flex flex-col gap-6 rounded-[15px] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="flex items-center gap-2.5">
            <span className="font-display flex size-9 items-center justify-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground">
              N
            </span>
            <span className="font-display text-base font-bold tracking-[-0.03em] text-foreground">
              Nexo Contable
            </span>
          </div>
          <DefinirPasswordForm
            nombre={perfil.nombre ?? ""}
            email={perfil.email ?? user.email ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
