import { IconCheck } from "@tabler/icons-react";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Iniciar sesión · Nexo Contable",
};

const BENEFICIOS = [
  "Multi-empresa con roles por firma y por cliente",
  "Cumplimiento DGII: NCF, e-CF, 606 y 607",
  "Partida doble garantizada en cada asiento",
];

function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="font-display flex size-10 items-center justify-center rounded-[12px] bg-primary text-lg font-bold text-primary-foreground shadow-[0_8px_20px_rgba(23,107,83,0.25)]">
        N
      </span>
      <span className="font-display text-lg font-bold tracking-[-0.03em] text-foreground">
        Nexo Contable
      </span>
    </span>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorParam = params.error;
  const codigoError = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.15fr]">
      <aside className="relative hidden overflow-hidden bg-[#eaf2ec] px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/60"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-primary/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-14 bottom-24 size-24 rounded-full border border-primary/15"
        />

        <Link href="/login" className="relative w-fit">
          <Marca />
        </Link>

        <div className="relative flex max-w-[440px] flex-col gap-6">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
            Contabilidad en línea · República Dominicana
          </p>
          <h2 className="font-display text-[2rem] leading-[1.15] font-bold tracking-[-0.03em] text-foreground">
            La contabilidad de tu firma, ordenada y en línea.
          </h2>
          <p className="text-sm leading-6 text-[#3d5a4f]">
            Centraliza clientes, comprobantes y estados financieros en un solo
            espacio seguro, con la identidad de Nexo Contable.
          </p>
          <ul className="flex flex-col gap-2.5">
            {BENEFICIOS.map((beneficio) => (
              <li
                key={beneficio}
                className="flex items-start gap-2 text-sm text-[#2f4a40]"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <IconCheck className="size-3" />
                </span>
                {beneficio}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[#4f6a5f]">
          Nexo Contable · Firma contable dominicana
        </p>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[410px]">
          <div className="mb-8 lg:hidden">
            <Marca />
          </div>
          <LoginForm codigoError={codigoError} />
        </div>
      </main>
    </div>
  );
}
