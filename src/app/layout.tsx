import "@/styles/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Plataforma CAC",
  description:
    "Servico privado de assistencia a processos SINARM/CAC (Guia de Trafego). Nao e orgao oficial.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <Header />
        <main className="py-8">{children}</main>
      </body>
    </html>
  );
}
