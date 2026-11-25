import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
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

const SCRIPT_TEMA = `(function(){try{var tema=localStorage.getItem('nexo-tema');var oscuro=tema==='dark';var raiz=document.documentElement;raiz.classList.toggle('dark',oscuro);raiz.style.colorScheme=oscuro?'dark':'light';}catch(error){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script id="tema-nexo">{SCRIPT_TEMA}</script>
      </head>
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
