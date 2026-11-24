import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexo Contable",
  description:
    "Sistema de contabilidad multi-empresa para República Dominicana",
};

const SCRIPT_TEMA = `(function(){try{var clave='nexo-tema';var tema=localStorage.getItem(clave);var oscuro=tema==='dark'||(tema!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var raiz=document.documentElement;raiz.classList.toggle('dark',oscuro);raiz.style.colorScheme=oscuro?'dark':'light';}catch(error){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="tema-nexo" strategy="beforeInteractive">
          {SCRIPT_TEMA}
        </Script>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
