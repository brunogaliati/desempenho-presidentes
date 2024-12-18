import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Desempenho por Presidente 🇧🇷",
  description:
    "Acompanhe a evolução dos principais indicadores econômicos durante cada mandato presidencial do Brasil.",
  openGraph: {
    title: "Desempenho por Presidente 🇧🇷",
    description:
      "Acompanhe a evolução dos principais indicadores econômicos durante cada mandato presidencial do Brasil.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Desempenho por Presidente 🇧🇷",
    description:
      "Acompanhe a evolução dos principais indicadores econômicos durante cada mandato presidencial do Brasil.",
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🇧🇷</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
