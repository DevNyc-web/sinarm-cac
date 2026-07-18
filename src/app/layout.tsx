import "@/styles/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

// Marca neutra: sem "SINARM" no nome do produto, para nao sugerir vinculo com o
// orgao (docs/24 §5/§7).
export const metadata: Metadata = {
  title: "Assistente CAC — serviço privado",
  description:
    "Serviço privado de assistência para processos de CAC (Guia de Tráfego). Não somos órgão público e não garantimos aprovação.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <EnvironmentBanner />
        <Header />
        <main className="py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
