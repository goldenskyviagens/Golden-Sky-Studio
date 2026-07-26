import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golden Sky Studio",
  description: "Criação de orçamentos e materiais de marketing — Golden Sky Viagens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-navy-100 text-navy-900 antialiased">{children}</body>
    </html>
  );
}
